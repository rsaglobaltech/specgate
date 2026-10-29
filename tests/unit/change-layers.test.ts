"use strict";

/**
 * The three layers of a change (REQ-282..REQ-289, ADR-0042): Discover by
 * product, Design by the architect, Tasks by the developer.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const layers = () => require("../../packages/core/src/domain/ChangeLayers");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-layers-"));
  made.push(root);
  fs.writeFileSync(path.join(root, "spec.md"), "# Spec\n", "utf8");
  fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n",
    "utf8"
  );
  return root;
}

function cli(root: string, ...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args, "--project-dir", root], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_PROFILE: "" },
  });
}

const json = (r: CliResult) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
const out = (r: CliResult) => `${r.stdout}${r.stderr}`;
const changeDir = (root: string, id: string) => path.join(root, "docs", "specs", "changes", id);
const put = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};
const codes = (r: CliResult) =>
  (json(r).items || []).flatMap((i: { issues?: { code: string }[] }) =>
    (i.issues || []).map((d) => d.code)
  );
const diags = (r: CliResult) =>
  (json(r).items || []).flatMap(
    (i: { issues?: { code: string; message: string; target?: string; fix?: string }[] }) =>
      i.issues || []
  );

const GOOD_DELTA = `# Delta — pricing

## ADDED Requirements

### Requirement: REQ-001 — Peak rate

The system SHALL charge the peak rate above 100 orders an hour.

#### Scenario: SCN-001 — Peak hour

- GIVEN 120 orders in the last hour
- WHEN a customer checks out
- THEN the peak rate is charged
`;

const DISCOVER = (criteria: string[], extra = "") => `# Discover: add-pricing

> Owner: product

## Context

Shops lose money at lunch time.${extra}

## Use case

A customer checks out at lunch time and pays the peak rate.

## Acceptance criteria

${criteria.map((c) => `- ${c}`).join("\n")}
`;

/** A layered change with its delta, ready for the layer rules. */
function layered(root: string, discover: string, design: string, tasks?: string) {
  const r = cli(root, "change", "new", "add-pricing", "--capability", "pricing", "--json");
  assert.equal(r.status, 0, out(r));
  const dir = changeDir(root, "add-pricing");
  put(path.join(dir, "specs", "pricing", "spec.md"), GOOD_DELTA);
  put(path.join(dir, "discover.md"), discover);
  put(path.join(dir, "design.md"), design);
  if (tasks !== undefined) put(path.join(dir, "tasks.md"), tasks);
  return dir;
}

// ── REQ-282 ──────────────────────────────────────────────────────────────────

test("REQ-282 SCN-282a, REQ-100 SCN-100a: a new change", () => {
  const root = mkProject();
  const r = cli(root, "change", "new", "add-pricing", "--json");
  assert.equal(r.status, 0, out(r));
  const dir = changeDir(root, "add-pricing");
  for (const [file, owner] of [
    ["discover.md", "product"],
    ["design.md", "architect"],
    ["tasks.md", "developer"],
  ]) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    assert.match(text, new RegExp(`Owner: ${owner}`), file);
  }
  assert.match(fs.readFileSync(path.join(dir, "change.yaml"), "utf8"), /^schema: layered$/m);
  assert.equal(fs.existsSync(path.join(dir, "proposal.md")), false);
});

// ── REQ-283 ──────────────────────────────────────────────────────────────────

test("REQ-283 SCN-283a: a change written with 0.27", () => {
  const root = mkProject();
  const dir = changeDir(root, "add-pricing");
  put(
    path.join(dir, "change.yaml"),
    "specgate_change_version: 1\nschema: spec-driven\nrigor: lite\nreq_range: [REQ-001, REQ-003]\n"
  );
  put(path.join(dir, "proposal.md"), "# Proposal: add-pricing\n\n## Intent\n\nPeak pricing.\n");
  put(path.join(dir, "tasks.md"), "# Tasks\n\n- [ ] 1.1 Write the delta\n");
  put(path.join(dir, "specs", "pricing", "spec.md"), GOOD_DELTA);
  const r = cli(root, "change", "validate", "add-pricing", "--json");
  assert.equal(r.status, 0, out(r));
  const d = diags(r).find((x: { code: string }) => x.code === "layer_no_design");
  assert.ok(d, out(r));
  assert.match(d.fix, /specgate migrate 1\.0/);
});

test("REQ-283 SCN-283b: the migration's design", () => {
  const proposal =
    "# Proposal: add-pricing\n\n## Intent\n\nShops lose money.\n\n## Acceptance criteria\n\n- AC-1: peak rate above 100 orders\n\n## Approach\n\nA pricing table per region.\n";
  const design = layers().designFromProposal(proposal, "add-pricing");
  const mechanisms = design.split("## Mechanisms")[1].split("## Channels")[0];
  assert.match(mechanisms, /A pricing table per region/);
  assert.match(mechanisms, /AC-1/);
});

// ── REQ-284 ──────────────────────────────────────────────────────────────────

test("REQ-284 SCN-284a: a database in the business story", () => {
  const root = mkProject();
  layered(
    root,
    DISCOVER(["AC-1: peak rate above 100 orders"], " The prices are stored in PostgreSQL."),
    "# Design\n\n## Mechanisms\n\nAC-1 — a rate table.\n"
  );
  const r = cli(root, "change", "validate", "add-pricing", "--json");
  const d = diags(r).find((x: { code: string }) => x.code === "layer_discover_technical");
  assert.ok(d, out(r));
  assert.match(d.message, /PostgreSQL/i);
});

test('REQ-284 SCN-284a: "the rest of" is not REST', () => {
  // Found migrating a 0.27 change: the word, in lower case, is plain English.
  const root = mkProject();
  layered(
    root,
    DISCOVER(["AC-1: peak rate above 100 orders"], " The rest of the week keeps the normal rate."),
    "# Design\n\n## Mechanisms\n\nAC-1 — a rate table.\n"
  );
  const r = cli(root, "change", "validate", "add-pricing", "--json");
  assert.ok(!diags(r).some((x: { code: string }) => x.code === "layer_discover_technical"), out(r));
});

test("REQ-282: change new names the layers it wrote, not a proposal", () => {
  const root = mkProject();
  const r = cli(root, "change", "new", "add-pricing");
  assert.equal(r.status, 0, out(r));
  assert.doesNotMatch(out(r), /write the proposal/);
  assert.match(out(r), /discover/);
});

// ── REQ-285 ──────────────────────────────────────────────────────────────────

test("REQ-285 SCN-285a: a criterion the design forgot", () => {
  const root = mkProject();
  layered(
    root,
    DISCOVER(["AC-1: peak rate above 100 orders", "AC-2: the receipt shows the rate"]),
    "# Design\n\n## Mechanisms\n\nAC-1 — a rate table checked at checkout.\n"
  );
  const r = cli(root, "change", "validate", "add-pricing", "--strict", "--json");
  assert.equal(r.status, 1, out(r));
  const missed = diags(r)
    .filter((x: { code: string }) => x.code === "layer_design_misses_criterion")
    .map((x: { target?: string }) => x.target);
  assert.deepEqual(missed, ["AC-2"]);
});

// ── REQ-286 ──────────────────────────────────────────────────────────────────

test("REQ-286 SCN-286a: a task with no requirement", () => {
  const root = mkProject();
  layered(
    root,
    DISCOVER(["AC-1: peak rate above 100 orders"]),
    "# Design\n\n## Mechanisms\n\nAC-1 — a rate table.\n",
    "# Tasks\n\n## 1. Specification\n\n- [x] 1.1 Write the delta spec\n\n## 2. Implementation\n\n- [ ] 2.1 REQ-005 — the price list\n- [ ] 2.2 Refactor the client\n"
  );
  const r = cli(root, "change", "validate", "add-pricing", "--json");
  const found = diags(r).filter(
    (x: { code: string }) => x.code === "layer_task_without_requirement"
  );
  assert.equal(found.length, 1, out(r));
  assert.match(found[0].message, /2\.2 Refactor the client/);
});

// ── REQ-287 ──────────────────────────────────────────────────────────────────

test("REQ-287 SCN-287a: the story rewritten during the design", () => {
  const root = mkProject();
  const dir = layered(
    root,
    DISCOVER(["AC-1: peak rate above 100 orders"]),
    "# Design\n\n## Mechanisms\n\nAC-1 — a rate table.\n"
  );
  const git = (...a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  // CI runners have no global identity.
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-qm", "the story agreed");
  const agreed = git("rev-parse", "--short", "HEAD").stdout.trim();

  let r = cli(root, "change", "validate", "add-pricing", "--json");
  assert.ok(!codes(r).includes("layer_discover_rewritten"), "unchanged: no warning");

  put(path.join(dir, "discover.md"), DISCOVER(["AC-1: peak rate above 500 orders"]));
  r = cli(root, "change", "validate", "add-pricing", "--json");
  const d = diags(r).find((x: { code: string }) => x.code === "layer_discover_rewritten");
  assert.ok(d, out(r));
  assert.match(d.message, new RegExp(agreed));
});

// ── REQ-288 ──────────────────────────────────────────────────────────────────

test("REQ-288 SCN-288a: the next layer and its owner", () => {
  const root = mkProject();
  cli(root, "change", "new", "add-pricing");
  const doc = json(cli(root, "change", "status", "add-pricing", "--json"));
  assert.deepEqual(
    doc.artifacts.map((a: { id: string }) => a.id),
    ["discover", "specs", "design", "tasks"]
  );
  assert.ok(doc.nextSteps.includes("Write discover.md (product)"), JSON.stringify(doc.nextSteps));
});

test("REQ-288 SCN-288b: a module drafted from the brief", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-layers-brief-"));
  made.push(parent);
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"app","version":"1.0.0","scripts":{"test":"node --test test/"}}\n'
  );
  fs.writeFileSync(path.join(dir, "lib", "index.js"), "module.exports = {};\n");
  const init = spawnSync(process.execPath, [CLI_PATH, "init"], { cwd: dir, encoding: "utf8" });
  assert.equal(init.status, 0, out(init));
  fs.writeFileSync(
    path.join(dir, "docs", "brief.md"),
    "---\nproduct: Shop\nsurfaces: [api]\nactors:\n  - { name: Clerk, surfaces: [api] }\nmodules: [pricing]\n---\n\n# Brief\n\nPeak prices at lunch time.\n"
  );
  const r = spawnSync(process.execPath, [CLI_PATH, "propose", "--from-brief", "pricing"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, out(r));
  const draft = changeDir(dir, "draft-pricing");
  for (const f of ["discover.md", "design.md", "tasks.md"]) {
    assert.ok(fs.existsSync(path.join(draft, f)), f);
  }
  assert.match(fs.readFileSync(path.join(draft, "change.yaml"), "utf8"), /^schema: layered$/m);
  const guide = fs.readFileSync(path.join(draft, "DRAFTING.md"), "utf8");
  for (const f of ["discover.md", "design.md", "tasks.md"]) assert.match(guide, new RegExp(f));
});

// ── REQ-289 ──────────────────────────────────────────────────────────────────

test("REQ-289 SCN-289a: reviewing a layered draft", () => {
  const root = mkProject();
  const r = cli(root, "change", "new", "draft-pricing", "--capability", "pricing", "--json");
  assert.equal(r.status, 0, out(r));
  const dir = changeDir(root, "draft-pricing");
  put(path.join(dir, "specs", "pricing", "spec.md"), GOOD_DELTA);
  put(path.join(dir, "discover.md"), DISCOVER(["AC-1: peak rate above 100 orders"]));
  const [d] = require("../../scripts/lib/studio-app").drafts(root);
  assert.ok(d, "the draft is listed");
  assert.deepEqual(
    d.layers.map((l: { id: string; owner: string; written: boolean }) => [
      l.id,
      l.owner,
      l.written,
    ]),
    [
      ["discover", "product", true],
      ["design", "architect", false],
      ["tasks", "developer", false],
    ]
  );
});
