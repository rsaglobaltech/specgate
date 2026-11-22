/**
 * bdd-gate: executable scenarios in every project. An approved change's
 * scenarios become feature files before any code (REQ-660); the gate requires
 * a runner and the files up to date (REQ-661); apply runs the requirement's
 * scenarios (REQ-662); new, adopted and migrated projects are set up (REQ-663).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
const CHANGE = "docs/specs/changes/draft-pedidos";
const FEATURE = "features/pedidos/REQ-031.feature";

const DELTA = [
  "# Delta — pedidos",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-031 — Cancel an order",
  "",
  "The system SHALL let the customer cancel an order not shipped yet.",
  "",
  "#### Scenario: SCN-031 — Cancelled before shipping",
  "",
  '- GIVEN the order "A-1" not shipped',
  '- WHEN the customer cancels "A-1"',
  '- THEN "A-1" is cancelled',
  "",
  "#### Scenario: SCN-032 — Shipped, not cancelled",
  "",
  '- GIVEN the order "A-2" shipped',
  '- WHEN the customer cancels "A-2"',
  '- THEN "A-2" is not cancelled',
  "",
  "<!-- specgate:trace actor=Customer kind=functional -->",
  "",
].join("\n");

/** A project with draft-pedidos written and its layers ready, `gate` as its gate.yaml. */
function project(o: { gate?: string | null; harness?: string[] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-bdd-"));
  madeDirs.push(dir);
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  // A project as adopt makes it, its gate then set as the test says.
  const adopted = spawnSync(process.execPath, [CLI, "adopt", "--project-dir", dir, "--no-ci"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  const harness = read(dir, "harness.config.yaml").replace(/^bdd_cmd:.*\n?/m, "");
  w(
    dir,
    "harness.config.yaml",
    `${harness.replace(/\s*$/, "")}\n${(o.harness ?? []).join("\n")}\n`
  );
  if (o.gate === null) fs.rmSync(path.join(dir, ".specgate/gate.yaml"), { force: true });
  else w(dir, ".specgate/gate.yaml", o.gate ?? "preset: standard\nbdd: required\n");
  w(
    dir,
    `${CHANGE}/change.yaml`,
    "specgate_change_version: 1\nschema: layered\nreq_range: [REQ-031, REQ-033]\n"
  );
  w(
    dir,
    `${CHANGE}/discover.md`,
    "# Discover: draft-pedidos\n\n## Context\n\nCustomers cancel orders.\n\n## Acceptance criteria\n\n- AC-1: An order not shipped can be cancelled.\n"
  );
  w(
    dir,
    `${CHANGE}/design.md`,
    "# Design: draft-pedidos\n\n- AC-1 — the order module cancels it.\n"
  );
  w(
    dir,
    `${CHANGE}/tasks.md`,
    "# Tasks\n\n## 1. Specification\n\n- [x] 1.1 Write the delta spec\n\n## 2. Implementation\n\n- [ ] 2.1 REQ-031 — cancel an order\n"
  );
  w(dir, `${CHANGE}/specs/pedidos/spec.md`, DELTA);
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  const approve = () => {
    for (const layer of ["discover", "design", "tasks"]) {
      const r = cli("change", "approve", "draft-pedidos", "--layer", layer);
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
  };
  const codes = (...args: string[]) => {
    // validate takes the folder as its argument.
    const r =
      args[0] === "validate"
        ? spawnSync(process.execPath, [CLI, "validate", dir, "--json"], {
            cwd: dir,
            encoding: "utf8",
            env: { ...process.env, NO_COLOR: "1" },
          })
        : cli(...args, "--json");
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    return JSON.stringify(doc);
  };
  return { dir, cli, approve, codes };
}

test("REQ-660 SCN-660a: approved, before any code — REQ-031's feature file, tagged with its change, with SCN-031 and SCN-032", () => {
  const p = project();
  assert.equal(fs.existsSync(path.join(p.dir, FEATURE)), false);
  p.approve();
  const feature = read(p.dir, FEATURE);
  assert.match(feature, /^@change:draft-pedidos$/m);
  assert.match(feature, /^Feature: Cancel an order$/m);
  assert.match(feature, /@REQ-031 @SCN-031/);
  assert.match(feature, /@REQ-031 @SCN-032/);
  assert.match(feature, /Given the order "A-1" not shipped/);
});

test("REQ-660 SCN-660b: archived, the change's tag dropped, the scenarios kept", () => {
  const p = project();
  p.approve();
  const { dropChangeTag } = require("../../scripts/lib/bdd");
  assert.deepEqual(dropChangeTag(p.dir, "draft-pedidos"), [FEATURE]);
  const feature = read(p.dir, FEATURE);
  assert.doesNotMatch(feature, /@change:/);
  assert.match(feature, /@REQ-031 @SCN-031/);
});

test("REQ-660: the delta changed after approval — change features writes the file again", () => {
  const p = project({ harness: ['bdd_cmd: "node -e 0 {tags}"'] });
  p.approve();
  w(
    p.dir,
    `${CHANGE}/specs/pedidos/spec.md`,
    DELTA.replace(
      "#### Scenario: SCN-032 — Shipped, not cancelled",
      "#### Scenario: SCN-033 — Shipped, not cancelled"
    )
  );
  assert.match(p.codes("validate"), /bdd_feature_stale/);
  assert.equal(p.cli("change", "features", "draft-pedidos").status, 0);
  assert.match(read(p.dir, FEATURE), /@SCN-033/);
  assert.doesNotMatch(p.codes("validate"), /bdd_feature_stale/);
});

test("REQ-661 SCN-661a: required, draft-pedidos approved, no runner — bdd_cmd_missing names it, its fix config set bdd_cmd", () => {
  const p = project();
  // Before any approval: a reminder, not a failure.
  assert.match(
    p.codes("validate"),
    /"code":"bdd_cmd_missing","severity":"warning"|"severity":"warning"[^}]*"code":"bdd_cmd_missing"/
  );
  p.approve();
  const doc = p.codes("validate");
  assert.match(doc, /bdd_cmd_missing/);
  assert.match(doc, /draft-pedidos/);
  assert.match(doc, /specgate config set bdd_cmd/);
  assert.notEqual(
    spawnSync(process.execPath, [CLI, "validate", p.dir], { cwd: p.dir, encoding: "utf8" }).status,
    0
  );
});

test("REQ-661 SCN-661b: an approved requirement without its feature — bdd_feature_missing, its fix change features", () => {
  const p = project({ harness: ['bdd_cmd: "node -e 0 {tags}"'] });
  p.approve();
  fs.rmSync(path.join(p.dir, FEATURE));
  const doc = p.codes("validate");
  assert.match(doc, /bdd_feature_missing/);
  assert.match(doc, /specgate change features draft-pedidos/);
});

test("REQ-661 SCN-661c: not set up yet — a warning with migrate bdd, the gate as it was", () => {
  const p = project({ gate: null });
  const doc = p.codes("validate");
  assert.match(doc, /bdd_not_set_up/);
  assert.match(doc, /specgate migrate bdd/);
  assert.doesNotMatch(doc, /bdd_cmd_missing/);
});

function applyProject(bddExit: number) {
  const p = project({
    harness: [
      'test_cmd: "node -e 0"',
      `bdd_cmd: "node -e \\"process.exit(process.argv[1] === '@REQ-031' ? ${bddExit} : 3)\\" {tags}"`,
    ],
  });
  const matrix = read(p.dir, "docs/specs/traceability.md");
  w(
    p.dir,
    "docs/specs/traceability.md",
    `${matrix.replace(/\s*$/, "")}\n| REQ-031 | SCN-031, SCN-032 | \`features/pedidos/REQ-031.feature\` | - | - | - | - | \`src/orders.js\` | tests/orders.test.js | Approved |\n`
  );
  w(p.dir, "src/orders.js", "module.exports = {};\n");
  w(p.dir, "tests/orders.test.js", "// REQ-031 SCN-031 SCN-032: cancel an order\n");
  p.approve();
  return p;
}

test("REQ-662 SCN-662a: a scenario failing — apply refuses with apply_bdd_failed, the command naming @REQ-031", () => {
  const p = applyProject(1);
  const r = p.cli("apply", "REQ-031", "--json");
  const doc = r.stdout.slice(r.stdout.indexOf("{"));
  assert.match(doc, /apply_bdd_failed/, r.stdout + r.stderr);
  assert.match(doc, /@REQ-031/);
  assert.notEqual(r.status, 0);
});

test("REQ-662 SCN-662b: its scenarios pass, it is delivered", () => {
  const p = applyProject(0);
  const r = p.cli("apply", "REQ-031", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.equal(doc.requirement.status, "Implemented");
});

test("REQ-663 SCN-663a: a web project migrated — bdd: required, playwright-bdd's command, the approved change's features", () => {
  const p = project({ gate: "preset: standard\n" });
  w(
    p.dir,
    "apps/web/package.json",
    JSON.stringify({ devDependencies: { "@playwright/test": "~1.63.0" } })
  );
  p.approve();
  fs.rmSync(path.join(p.dir, "features"), { recursive: true, force: true });
  const r = p.cli("migrate", "bdd");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(p.dir, ".specgate/gate.yaml"), /^bdd: required$/m);
  assert.match(
    read(p.dir, "harness.config.yaml"),
    /bdd_cmd: 'npx bddgen && npx playwright test --grep "\{tags\}"'/
  );
  assert.ok(fs.existsSync(path.join(p.dir, FEATURE)), "the approved change's feature written");
});

test("REQ-663: a new project's gate requires executable scenarios", () => {
  const { gatePolicyTemplate } = require("../../scripts/lib/gate-policy");
  assert.match(gatePolicyTemplate(), /^bdd: required$/m);
});

test("REQ-663 SCN-663b: a project with its own test:bdd script — that script runs the scenarios", () => {
  const p = project({ gate: "preset: standard\n" });
  w(
    p.dir,
    "package.json",
    JSON.stringify({ scripts: { "test:bdd": "npm run test:bdd --workspace apps/web --" } })
  );
  assert.equal(p.cli("migrate", "bdd").status, 0);
  assert.match(
    read(p.dir, "harness.config.yaml"),
    /bdd_cmd: 'npm run test:bdd --silent -- --grep "\{tags\}"'/
  );
});

test("REQ-663: a project forja made, wired by init --forja — adopted, its gate requiring the scenarios through forja's test:bdd", () => {
  const { wireForjaProject } = require("../../scripts/cli/commands/project/Forja");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-forja-bdd-"));
  madeDirs.push(dir);
  w(dir, "forja.config.json", JSON.stringify({ version: 1, name: "demo" }));
  w(
    dir,
    "package.json",
    JSON.stringify({
      scripts: { test: "node -e 0", "test:bdd": "npm run test:bdd --workspace apps/web --" },
    })
  );
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  const r = wireForjaProject(dir, CLI);
  assert.equal(r.bdd, true);
  assert.match(read(dir, ".specgate/gate.yaml"), /^bdd: required$/m);
  assert.match(
    read(dir, "harness.config.yaml"),
    /bdd_cmd: 'npm run test:bdd --silent -- --grep "\{tags\}"'/
  );
});
