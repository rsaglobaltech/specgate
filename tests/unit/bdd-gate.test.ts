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
  // adopt writes harness.config.yaml only when it finds something to put in it (an agent here, none in CI).
  const config = path.join(dir, "harness.config.yaml");
  const harness = (fs.existsSync(config) ? read(dir, "harness.config.yaml") : "").replace(
    /^bdd_cmd:.*\n?/m,
    ""
  );
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

/** A Node project made by `specgate init` here, its package.json as given. */
function initialised(pkg: object) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-init-bdd-"));
  madeDirs.push(dir);
  w(dir, "package.json", JSON.stringify(pkg));
  git(dir, "init", "-q");
  const sg = (...args: string[]) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" });
  const r = sg("init", "--no-capabilities");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { dir, sg };
}

test("REQ-663 SCN-663c: a new project with no runner — bdd left unset, the gate warning, apply delivering as before", () => {
  const { dir, sg } = initialised({ name: "app", scripts: { test: "node --test" } });
  assert.doesNotMatch(read(dir, ".specgate/gate.yaml"), /^bdd: required$/m);
  const check = sg("check", "--json");
  assert.ok(
    /bdd_not_set_up/.test(check.stdout) && /specgate migrate bdd/.test(check.stdout),
    check.stdout + check.stderr
  );
  const added = JSON.parse(sg("new", "Totals are rounded half-up", "--json").stdout);
  const id = added.requirement.id ?? added.requirement;
  const spec = read(dir, "spec.md");
  const at = spec.indexOf(id);
  const obligation = /^The system MUST satisfy:.*\n\n> Written by Specgate\..*$/m;
  w(
    dir,
    "spec.md",
    spec.slice(0, at) +
      spec.slice(at).replace(obligation, "The system SHALL round every total half-up to the cent.")
  );
  const feature = "features/totals-are-rounded-half-up.feature";
  w(
    dir,
    feature,
    read(dir, feature)
      .replace("<the state before the action>", "a basket totalling 10.005")
      .replace("<the action under test>", "the total is shown")
      .replace("<the observable outcome>", "it reads 10.01")
  );
  w(dir, "test/total.test.js", `// ${id}\nrequire("node:test")("${id} totals", () => {});\n`);
  sg("config", "set", "test_cmd", "node --test");
  const r = sg("apply", id);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /apply_bdd_missing/);
});

test("REQ-663 SCN-663d: a new project with its own test:bdd script — required, that script runs the scenarios", () => {
  const { dir } = initialised({
    name: "app",
    scripts: { test: "node --test", "test:bdd": "cucumber-js" },
  });
  assert.match(read(dir, ".specgate/gate.yaml"), /^bdd: required$/m);
  assert.match(
    read(dir, "harness.config.yaml"),
    /bdd_cmd: 'npm run test:bdd --silent -- --grep "\{tags\}"'/
  );
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

test("REQ-660: an approved change's feature file is no orphan — doctor, status and fix leave it to the archive", () => {
  const p = project();
  p.approve();
  const doctor = p.cli("doctor");
  assert.doesNotMatch(doctor.stdout + doctor.stderr, new RegExp(`orphan feature.*${FEATURE}`));
  const status = JSON.parse(p.cli("status", "--json").stdout);
  assert.ok(
    !(status.orphanFeatures ?? []).includes(FEATURE),
    JSON.stringify(status.orphanFeatures)
  );
  const { detectOrphans } = require("../../scripts/cli/commands/spec/PlanCommand");
  assert.deepEqual(
    detectOrphans(p.dir, []).filter((f: string) => f === FEATURE),
    []
  );
});

test("REQ-666 SCN-666a: one scenario passes, one fails — each with its line, scenario_failed naming the other", () => {
  const p = project({ harness: ["bdd_cmd: node only031.js {tags}"] });
  w(
    p.dir,
    "only031.js",
    "const t = process.argv[2]; console.log('ran ' + t); process.exit(t === '@SCN-031' ? 0 : 1);\n"
  );
  p.approve();
  const r = p.cli("scenarios", "REQ-031", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const results = doc.scenarios.results;
  assert.deepEqual(
    results.map((s: any) => [s.id, s.passed, s.file]),
    [
      ["SCN-031", true, FEATURE],
      ["SCN-032", false, FEATURE],
    ]
  );
  const lines = read(p.dir, FEATURE).split("\n");
  for (const s of results)
    assert.match(lines[s.line - 1], /Scenario:/, `${s.id} at its Scenario line`);
  assert.match(results[1].output, /ran @SCN-032/);
  assert.equal(doc.status.find((d: any) => d.code === "scenario_failed")?.target, "SCN-032");
});

test("REQ-666 SCN-666b: no runner — bdd_cmd_missing, its fix config set bdd_cmd", () => {
  const p = project();
  p.approve();
  const r = p.cli("scenarios", "REQ-031", "--json");
  assert.notEqual(r.status, 0);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.equal(doc.status[0].code, "bdd_cmd_missing");
  assert.match(doc.status[0].fix, /specgate config set bdd_cmd/);
});

// ── gate-runs-scenarios REQ-733…REQ-735: the scenarios run where the gate runs ──

/** REQ-031's code and test in place and committed; `bdd` is what `bdd_cmd` exits with for each tag. */
function gatedProject(bdd: Record<string, number>, gate = "preset: standard\nbdd: required\n") {
  const table = JSON.stringify(bdd).replace(/"/g, "'");
  const p = project({
    gate,
    harness: [
      'test_cmd: "node -e 0"',
      `bdd_cmd: "node -e \\"process.exit((${table})[process.argv[1]] ?? 3)\\" {tags}"`,
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
  git(p.dir, "add", "-A");
  git(p.dir, "commit", "-qm", "seed");
  const agent = path.join(path.dirname(p.dir), `agent-${path.basename(p.dir)}.js`);
  fs.writeFileSync(
    agent,
    'require("node:fs").writeFileSync("src/cancel.js", "// REQ-031\\nmodule.exports = 1;\\n");\n'
  );
  madeDirs.push(agent);
  const harness = (...extra: string[]) =>
    spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        p.dir,
        "--req",
        "REQ-031",
        "--agent",
        `"${process.execPath}" "${agent}" {prompt_file}`,
        "--skip-doctor",
        "--max-attempts",
        "1",
        ...extra,
      ],
      { cwd: p.dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
    );
  return { ...p, harness };
}

test("REQ-733 SCN-733a: built to a test that says something else — the harness fails at the stage scenarios, and delivers nothing", () => {
  const p = gatedProject({ "@REQ-031": 1, "@SCN-031": 1, "@SCN-032": 0 });
  const r = p.harness();
  const said = r.stdout + r.stderr;
  assert.match(said, /0 passed/, said);
  assert.match(said, /scenarios/, said);
  assert.match(said, /SCN-031/, "the scenario that failed is named");
  assert.doesNotMatch(
    git(p.dir, "show", "harness/REQ-031:docs/specs/changes/draft-pedidos/specs/pedidos/spec.md")
      .stdout,
    /status=Implemented/
  );
});

test("REQ-733 SCN-733b: its scenarios pass — the gate has the stage scenarios, and the requirement is delivered", () => {
  const p = gatedProject({ "@REQ-031": 0, "@SCN-031": 0, "@SCN-032": 0 });
  const r = p.harness();
  const said = r.stdout + r.stderr;
  assert.match(said, /1 passed/, said);
  assert.match(said, /passed scenarios/, said);
});

test("REQ-733 SCN-733c: not required, not run — the harness gate has no stage scenarios", () => {
  const p = gatedProject({ "@REQ-031": 1 }, "preset: standard\n");
  const r = p.harness();
  const said = r.stdout + r.stderr;
  assert.match(said, /1 passed/, said);
  assert.doesNotMatch(said, /(started|passed|failed) scenarios/, said);
});

/** REQ-031 delivered with its scenarios green; then `bdd_cmd` is what the test says. */
function deliveredProject(after: Record<string, number>) {
  const p = gatedProject({ "@REQ-031": 0, "@SCN-031": 0, "@SCN-032": 0 });
  const applied = p.cli("apply", "REQ-031", "--json");
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  const table = JSON.stringify(after).replace(/"/g, "'");
  w(
    p.dir,
    "harness.config.yaml",
    read(p.dir, "harness.config.yaml").replace(
      /^bdd_cmd:.*$/m,
      `bdd_cmd: "node -e \\"process.exit((${table})[process.argv[1]] ?? 3)\\" {tags}"`
    )
  );
  return p;
}

test("REQ-734 SCN-734a: code changed after delivery — check fails at scenarios naming the requirement and the scenario", () => {
  const p = deliveredProject({ "@REQ-031": 1, "@SCN-031": 1, "@SCN-032": 0 });
  const r = spawnSync(process.execPath, [CLI, "check", p.dir, "--json"], {
    cwd: p.dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.notEqual(r.status, 0, r.stdout);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const stage = doc.stages.find((s: { stage: string }) => s.stage === "scenarios");
  assert.equal(stage.result, "failed", JSON.stringify(doc.stages));
  const finding = JSON.stringify(doc.status);
  assert.match(finding, /check_scenarios_failed/);
  assert.match(finding, /REQ-031/);
  assert.match(finding, /SCN-031/);
  assert.doesNotMatch(finding, /SCN-032 /, "the scenario that passed is not blamed");
});

test("REQ-734: the delivered requirements' scenarios pass — check passes with the stage scenarios", () => {
  const p = deliveredProject({ "@REQ-031": 0, "@SCN-031": 0, "@SCN-032": 0 });
  const r = spawnSync(process.execPath, [CLI, "check", p.dir, "--json"], {
    cwd: p.dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.equal(doc.stages.find((s: { stage: string }) => s.stage === "scenarios").result, "passed");
});

test("REQ-734 SCN-734b: --no-scenarios leaves the stage out at the Developer's word, and says so", () => {
  const p = deliveredProject({ "@REQ-031": 1, "@SCN-031": 1 });
  const r = spawnSync(process.execPath, [CLI, "check", p.dir, "--no-scenarios", "--json"], {
    cwd: p.dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const stage = doc.stages.find((s: { stage: string }) => s.stage === "scenarios");
  assert.equal(stage.result, "skipped");
  assert.match(JSON.stringify(stage), /--no-scenarios/);
});

test("REQ-735 SCN-735a SCN-735b: delivered on a test alone — apply says its scenarios were not run, and status counts it", () => {
  const p = gatedProject({ "@REQ-031": 1 }, "preset: standard\n");
  const r = p.cli("apply", "REQ-031");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /its scenarios were not run/);
  assert.match(r.stdout + r.stderr, /specgate migrate bdd/);
  const s = p.cli("status", "--json");
  const doc = JSON.parse(s.stdout.slice(s.stdout.indexOf("{")));
  assert.equal(doc.deliveredWithoutScenarios, 1, s.stdout.slice(0, 600));
});

test("REQ-735: where the scenarios are run, apply does not say they were not", () => {
  const p = gatedProject({ "@REQ-031": 0, "@SCN-031": 0, "@SCN-032": 0 });
  const r = p.cli("apply", "REQ-031");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /its scenarios were not run/);
  const s = p.cli("status", "--json");
  assert.equal(JSON.parse(s.stdout.slice(s.stdout.indexOf("{"))).deliveredWithoutScenarios, 0);
});

test("REQ-822 SCN-822a: the adoption baseline, tagged @skip by migrate bdd, the gate warning until then", () => {
  const { dir, sg } = initialised({
    name: "app",
    scripts: { test: "node --test" },
    devDependencies: { "@playwright/test": "~1.63.0" },
  });
  const baseline = [
    "Feature: Existing behaviour is preserved",
    "",
    "  Scenario: Existing test suite stays green",
    "    Given the project is built from a clean checkout",
    "    When the full test suite runs",
    "    Then every existing test passes",
    "",
  ].join("\n");
  w(dir, "features/adoption/baseline.feature", baseline);
  w(dir, ".specgate/gate.yaml", "preset: standard\nbdd: required\n");
  assert.match(sg("check", "--json").stdout, /bdd_baseline_runs/);
  const r = sg("migrate", "bdd", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).migrate.baselineSkipped, true);
  assert.match(
    read(dir, "features/adoption/baseline.feature"),
    /\n {2}@skip\n {2}Scenario: Existing test suite stays green/
  );
  assert.doesNotMatch(sg("check", "--json").stdout, /bdd_baseline_runs/);
  const again = sg("migrate", "bdd", "--json");
  assert.equal(
    JSON.parse(again.stdout.slice(again.stdout.indexOf("{"))).migrate.baselineSkipped,
    false,
    "once"
  );
});

test("REQ-822: an adoption whose gate requires the scenarios writes the baseline already skipped", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-adopt-bdd-"));
  madeDirs.push(dir);
  w(
    dir,
    "package.json",
    JSON.stringify({ name: "app", devDependencies: { "@playwright/test": "~1.63.0" } })
  );
  git(dir, "init", "-q");
  const r = spawnSync(process.execPath, [CLI, "adopt", "--no-capabilities", "--yes"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(dir, ".specgate/gate.yaml"), /^bdd: required$/m);
  assert.match(
    read(dir, "features/adoption/baseline.feature"),
    /@skip\n {2}Scenario: Existing test suite stays green/
  );
});

test("REQ-823 SCN-823a: apply shows the scenarios as a stage, as it shows the tests", () => {
  const p = applyProject(0);
  const r = p.cli("apply", "REQ-031");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const tests = r.stdout.indexOf("Tests ");
  const scenarios = r.stdout.search(/Scenarios {7}node -e/);
  assert.ok(tests >= 0 && scenarios > tests, r.stdout);
});
