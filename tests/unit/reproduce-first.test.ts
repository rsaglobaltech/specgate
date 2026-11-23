/**
 * reproduce-first (trust curve, phase 2): a reported bug opens a change that
 * must reproduce it (REQ-681); its scenario is seen red before it is fixed
 * (REQ-682); it is delivered only after that red (REQ-683).
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
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
const codes = (r: { stdout: string }) => JSON.parse(r.stdout).status.map((s: { code: string }) => s.code);

/** An `init` project with catalogo (REQ-050, reached at /products/:id), trust catalogo 4, a bdd_cmd that exits as `scenarios.exit` says. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-repro-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  const made = sg(dir, "init");
  assert.equal(made.status, 0, made.stdout + made.stderr);
  w(
    dir,
    "docs/specs/capabilities/catalogo/spec.md",
    "# catalogo\n\n## Requirements\n\n### Requirement: REQ-050 — Show a product\n\n<!-- specgate:trace status=Draft route=/products/:id -->\n\nThe system SHALL show a product with its price.\n\n#### Scenario: SCN-050 — Shown\n\n- GIVEN a product\n- WHEN the customer opens it\n- THEN it is shown\n"
  );
  w(dir, ".specgate/gate.yaml", "preset: standard\nbdd: required\ntrust: { catalogo: 4 }\n");
  w(dir, "run-scenarios.js", 'const fs=require("fs");const code=Number(fs.readFileSync("scenarios.exit","utf8"));console.log((code?"1 failed":"1 passed")+" for "+process.argv[2]);process.exit(code);\n');
  w(dir, "scenarios.exit", "1");
  fs.appendFileSync(path.join(dir, "harness.config.yaml"), 'bdd_cmd: "node run-scenarios.js {tags}"\n');
  return dir;
}

/** `reproduce` run in `dir`; the requirement it opened. */
function reproduce(dir: string): string {
  const r = sg(dir, "reproduce", "fix-precio", "--capability", "catalogo", "--title", "The price shows without its discount", "--ticket", "KAN-21", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).reproduce.requirement;
}

test("REQ-681 SCN-681a: a bug in catalogo opens a change that must reproduce it", () => {
  const dir = project();
  const req = reproduce(dir);
  assert.match(req, /^REQ-\d+$/);
  const change = "docs/specs/changes/fix-precio";
  assert.match(read(dir, `${change}/change.yaml`), /^kind: bug$/m);
  const delta = read(dir, `${change}/specs/catalogo/spec.md`);
  assert.match(delta, new RegExp(`### Requirement: ${req} — The price shows without its discount`));
  assert.match(delta, /specgate:trace[^>]*repro=required/);
  const discover = read(dir, `${change}/discover.md`);
  assert.match(discover, /KAN-21/);
  assert.match(discover, /\/products\/:id/);
  assert.match(read(dir, ".specgate/gate.yaml"), /catalogo: 3/);
  const human = sg(dir, "reproduce", "fix-otro", "--capability", "catalogo", "--title", "Stock wrong");
  assert.match(human.stdout, /specgate reproduce run REQ-\d+/);
});

test("REQ-682 SCN-682a: red, kept", () => {
  const dir = project();
  const req = reproduce(dir);
  const r = sg(dir, "reproduce", "run", req, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const red = JSON.parse(read(dir, `.specgate/evidence/${req}/red.json`));
  assert.equal(red.command, `node run-scenarios.js @${req}`);
  assert.notEqual(red.exitCode, 0);
  assert.match(read(dir, `.specgate/evidence/${req}/red.log`), /1 failed/);
  assert.match(sg(dir, "reproduce", "run", req).stdout, /reproduced/i);
});

test("REQ-682 SCN-682b: green, refused", () => {
  const dir = project();
  const req = reproduce(dir);
  w(dir, "scenarios.exit", "0");
  const r = sg(dir, "reproduce", "run", req, "--json");
  assert.notEqual(r.status, 0);
  assert.ok(codes(r).includes("repro_not_red"), r.stdout);
  assert.equal(fs.existsSync(path.join(dir, `.specgate/evidence/${req}/red.json`)), false);
  // No runner, no reproduction.
  const bare = project();
  const id = reproduce(bare);
  fs.writeFileSync(path.join(bare, "harness.config.yaml"), read(bare, "harness.config.yaml").replace(/^bdd_cmd:.*\n/m, ""));
  assert.ok(codes(sg(bare, "reproduce", "run", id, "--json")).includes("repro_no_runner"));
});

/** The bug change written and approved, a test naming its requirement. */
function readyToApply(dir: string, req: string) {
  const file = "docs/specs/changes/fix-precio/specs/catalogo/spec.md";
  w(
    dir,
    file,
    read(dir, file).replace(/#### Scenario:[\s\S]*$/, `#### Scenario: SCN-${req.slice(4)} — Discount shown\n\n- GIVEN a product priced 100 with a 10% discount\n- WHEN the customer opens it\n- THEN the price shows 90\n`)
  );
  w(dir, `tests/precio.test.ts`, `// ${req}\n`);
  const approved = sg(dir, "change", "approve", "fix-precio", "--json");
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
}

test("REQ-683 SCN-683a: never seen red, never delivered", () => {
  const dir = project();
  const req = reproduce(dir);
  readyToApply(dir, req);
  w(dir, "scenarios.exit", "0");
  const r = sg(dir, "apply", req, "--json");
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /apply_not_reproduced/);
  assert.match(r.stdout, new RegExp(`specgate reproduce run ${req}`));
  assert.doesNotMatch(read(dir, "docs/specs/changes/fix-precio/specs/catalogo/spec.md"), /status=Implemented/);
});

test("REQ-683 SCN-683b: red, then green — delivered with both", () => {
  const dir = project();
  const req = reproduce(dir);
  readyToApply(dir, req);
  assert.equal(sg(dir, "reproduce", "run", req).status, 0);
  w(dir, "scenarios.exit", "0");
  const r = sg(dir, "apply", req);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const evidence = JSON.parse(read(dir, `.specgate/evidence/${req}/evidence.json`));
  assert.notEqual(evidence.red.exitCode, 0);
  assert.equal(evidence.scenarios.exitCode, 0);
});
