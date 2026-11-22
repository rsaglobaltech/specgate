/**
 * brief-from-workshop: a DDD workshop's boards — exported by DDD Toolbox, made
 * on dddtoolbox.com with its own editor (a motor-claims workshop: a story, an
 * Event Storming wall and three Bounded Context Canvases) — become the brief's
 * modules (REQ-655), each drafted from its model (REQ-656), in one command
 * with propose --from-model (REQ-657). Only the files are read.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const FIX = path.join(ROOT_DIR, "tests", "fixtures", "ddd");
const BOARDS = [
  "siniestros-story",
  "siniestros-event-storming",
  "canvas-siniestros",
  "canvas-polizas",
  "canvas-pagos",
].map((n) => path.join(FIX, `${n}.json`));

const git = (dir: string, ...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });

function project(t: TestContext, brief: string | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-workshop-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  if (brief !== null) {
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "brief.md"), brief);
  }
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
  const cli = (...a: string[]) =>
    spawnSync(process.execPath, [CLI, ...a], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  return { dir, cli, read };
}

test("REQ-655 SCN-655a: the claims workshop imported into a project with no brief — a model per context, the brief's modules, actors and cards", (t: TestContext) => {
  const p = project(t, null);
  const r = p.cli("brief", "import", ...BOARDS, "--json");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.deepEqual(doc.brief.import.contexts, ["siniestros", "polizas", "pagos"]);
  for (const m of ["siniestros", "polizas", "pagos"])
    assert.ok(fs.existsSync(path.join(p.dir, "docs", "brief", "models", `${m}.yaml`)), m);
  const siniestros = p.read("docs/brief/models/siniestros.yaml");
  assert.match(siniestros, /^context: Siniestros$/m);
  assert.match(siniestros, /relationship: ACL/);
  assert.match(siniestros, /command: Declarar siniestro/);
  const brief = p.read("docs/brief.md");
  assert.match(brief, /^modules: \[siniestros, polizas, pagos\]$/m);
  assert.match(brief, /- \{ name: Tramitador, surfaces: \[web\] \}/);
  assert.match(brief, /- \{ name: Sistema de pagos, surfaces: \[api\] \}/);
  assert.match(brief, /^## From the DDD workshop$/m);
  assert.match(brief, /^### Siniestros — `siniestros`$/m);
  assert.match(brief, /docs\/brief\/models\/siniestros\.yaml/);
  // The brief reads as specgate reads any brief: its front matter is whole.
  const check = p.cli("propose", "--from-brief", "--check", "--json");
  const checked = JSON.parse(check.stdout.slice(check.stdout.indexOf("{")));
  const errors =
    JSON.stringify(checked).match(
      /"code":"(B\d_[a-z_]+|brief_[a-z_]+)"[^}]*"severity":"error"|"severity":"error"[^}]*"code":"(B\d_[a-z_]+|brief_[a-z_]+)"/g
    ) ?? [];
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test("REQ-655 SCN-655b: an existing brief kept — its module and every line it had, and the workshop's three modules", (t: TestContext) => {
  const before = [
    "---",
    "product: Tienda",
    "surfaces: [web]",
    "actors:",
    "  - { name: Cliente, surfaces: [web] }",
    "modules: [catalogo]",
    "---",
    "",
    "# Tienda",
    "",
    "El cliente busca productos en el catálogo.",
    "",
  ].join("\n");
  const p = project(t, before);
  const r = p.cli("brief", "import", ...BOARDS);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const brief = p.read("docs/brief.md");
  assert.match(brief, /^modules: \[catalogo, siniestros, polizas, pagos\]$/m);
  assert.match(brief, /^surfaces: \[web, api\]$/m);
  for (const line of before.split("\n").filter((l) => l && !/^(modules|surfaces):/.test(l)))
    assert.ok(brief.includes(line), `kept: ${line}`);
  // Imported again, a canvas given twice: nothing added twice.
  p.cli("brief", "import", ...BOARDS, BOARDS[2]!);
  const again = p.read("docs/brief.md");
  assert.equal(again.match(/^### Siniestros — `siniestros`$/gm)?.length, 1);
  assert.equal(again.match(/name: Tramitador/g)?.length, 1);
});

test("REQ-656 SCN-656a: the siniestros module drafted — its model named in DRAFTING.md, a value the model states passes D6", (t: TestContext) => {
  const p = project(t, null);
  p.cli("brief", "import", ...BOARDS);
  git(p.dir, "add", "-A");
  git(p.dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "workshop");
  const r = p.cli("propose", "--from-brief", "siniestros", "--json");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const drafting = p.read("docs/specs/changes/draft-siniestros/DRAFTING.md");
  assert.match(drafting, /the workshop's model:\*\* `docs\/brief\/models\/siniestros\.yaml`/);
  // A scenario stating 75 %, a value only the model gives.
  const spec = path.join(p.dir, "docs/specs/changes/draft-siniestros/specs/siniestros/spec.md");
  const cfg = p.read("docs/specs/changes/draft-siniestros/change.yaml");
  const req = /req_range: \[(REQ-\d+)/.exec(cfg)![1];
  const scn = /scn_range: \[(SCN-\d+)/.exec(cfg)![1];
  fs.writeFileSync(
    spec,
    [
      "# Delta — siniestros",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${req} — Pérdida total`,
      "",
      `<!-- specgate:trace status=Draft actor=Tramitador kind=functional -->`,
      "",
      "The system SHALL declare a total loss when the damage exceeds 75 % of the vehicle's value.",
      "",
      `#### Scenario: ${scn} — Daño del 80 %`,
      "",
      "- GIVEN a vehicle whose damage is above 75 % of its value",
      "- WHEN the Tramitador records the expert's report",
      "- THEN the claim is a total loss",
      "",
    ].join("\n")
  );
  const check = p.cli("draft", "--check", "draft-siniestros", "--json");
  const doc = JSON.parse(check.stdout.slice(check.stdout.indexOf("{")));
  const d6 = JSON.stringify(doc).match(/D6[^"]*"[^}]*75/g);
  assert.equal(d6, null, "75 % is stated in the workshop's model");
});

test("REQ-657 SCN-657a: propose --from-model — the models and the brief written, siniestros's draft opened, polizas and pagos next", (t: TestContext) => {
  const p = project(t, null);
  const r = p.cli("propose", "--from-model", ...BOARDS);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(path.join(p.dir, "docs/brief/models/pagos.yaml")));
  assert.ok(fs.existsSync(path.join(p.dir, "docs/specs/changes/draft-siniestros/DRAFTING.md")));
  assert.match(r.stdout, /specgate propose --from-brief polizas/);
  assert.match(r.stdout, /specgate propose --from-brief pagos/);
});
