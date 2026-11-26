/**
 * recover-guidance REQ-787: a red suite caused by another requirement says so,
 * and that repairing its code — never its test — is within the change.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { failingElsewhere, elsewhereFix } = require("../../scripts/lib/tests-elsewhere");
const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("REQ-787: the failing tests' requirements are read from the runner's output", () => {
  const node = "✔ REQ-002 SCN-002a: three days late (1ms)\n✖ REQ-001: the project loads and names itself (2ms)\n";
  assert.deepEqual(failingElsewhere(node, ["REQ-002"]), ["REQ-001"]);
  // One of the requirements being delivered is red: the usual message.
  assert.deepEqual(failingElsewhere("✖ REQ-002 SCN-002a: three days late\n", ["REQ-002"]), []);
  // A failing test that names nothing: the usual message too.
  assert.deepEqual(failingElsewhere("✖ loads\n", ["REQ-002"]), []);
  // Other runners.
  assert.deepEqual(failingElsewhere("not ok 3 - REQ-001 project loads\n", ["REQ-002"]), ["REQ-001"]);
  assert.deepEqual(failingElsewhere("[ERROR] Tests run: 3, Failures: 1 <<< FAILURE! REQ-001 loadsIT\n", ["REQ-002"]), ["REQ-001"]);
  const e = elsewhereFix(["REQ-001"], ["REQ-002"], "specgate apply REQ-002");
  assert.match(e.message, /REQ-001, not REQ-002/);
  assert.match(e.fix, /code so its test passes again — never its test/);
  assert.match(e.fix, /scope judges new files only/);
});

test("REQ-787 SCN-787a: REQ-001 is red while REQ-002 is delivered — apply names it and says how", () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-recover-")));
  made.push(dir);
  const cli = (args: string[]) =>
    spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
      cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", SPECGATE_SKIP_DOCTOR: "1", SPECGATE_ASSUME_TTY: "1" },
    });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli(["adopt", "--no-ci"]).status, 0);
  assert.equal(cli(["propose", "fees", "--capability", "fees"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/fees/specs/fees/spec.md");
  const id = (fs.readFileSync(delta, "utf8").match(/REQ-\d+/) || ["REQ-002"])[0];
  fs.writeFileSync(delta, ["# Delta — fees", "", "## ADDED Requirements", "",
    `### Requirement: ${id} — Late fee`, "", "<!-- specgate:trace actor=Librarian kind=functional -->", "",
    "The system SHALL charge 0.50 per late day.", "",
    `#### Scenario: SCN-${id.slice(4)}a — Three days late`, "", "- GIVEN a book 3 days late", "- WHEN the fee is computed", "- THEN it is 1.50", ""].join("\n"));
  assert.equal(cli(["change", "approve", "fees"]).status, 0);
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(path.join(dir, "test/fees.test.js"), `// ${id} SCN-${id.slice(4)}a: three days late\n`);
  // Not a nested `node --test`: under this runner it would exit 0 (NODE_TEST_CONTEXT).
  // The suite as node's runner reports it: REQ-002 green, REQ-001 red.
  fs.writeFileSync(
    path.join(dir, "test/run.js"),
    `console.log("✔ ${id} SCN-${id.slice(4)}a: three days late (1ms)");\nconsole.log("✖ REQ-001: the project loads and names itself (2ms)");\nprocess.exit(1);\n`
  );
  assert.equal(cli(["config", "set", "test_cmd", "node test/run.js"]).status, 0);
  const r = cli(["apply", id]);
  assert.notEqual(r.status, 0);
  const all = r.stdout + r.stderr;
  assert.match(all, /done_tests_failed/);
  assert.match(all, /REQ-001/);
  assert.match(all, /never its test/);
});

test("REQ-787: the agents' instructions say the same", () => {
  const tpl = fs.readFileSync(path.join(ROOT_DIR, "templates", "base", "AGENTS.md.tpl"), "utf8");
  assert.match(tpl, /a red test of a requirement delivered before is repaired in its code, within your change/);
});
