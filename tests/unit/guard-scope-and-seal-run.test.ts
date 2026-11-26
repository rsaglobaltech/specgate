/**
 * guard-scope-and-seal-run: the design's scope refused when the file is
 * written, not only at the gate (REQ-793); a person sealing acceptance tests
 * sees them run once first (REQ-794).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const guard = require("../../scripts/plugin/guard-hook");

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");
const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const FEES = "docs/specs/changes/draft-fees";
const DELTA = [
  "# Delta — fees", "", "## ADDED Requirements", "",
  "### Requirement: REQ-031 — The late fee", "",
  "<!-- specgate:trace status=Draft actor=Member kind=functional -->", "",
  "The system SHALL charge 0.50 for each day a book is late.", "",
  "#### Scenario: SCN-031 — Three days late costs 1.50", "",
  "- GIVEN a book returned 3 days late", "- WHEN the fee is computed", "- THEN the fee is 1.50", "",
].join("\n");

/** An adopted project with draft-fees approved, its design naming src/fees.js, and a test naming REQ-031. */
function project(o: { approve?: boolean; acceptanceCmd?: string } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-gscope-")));
  made.push(dir);
  const env = { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: "1" };
  const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: dir, encoding: "utf8", env });
  run("git", ["init", "-q"]);
  run("git", ["config", "user.email", "t@t"]);
  run("git", ["config", "user.name", "t"]);
  const adopted = run(process.execPath, [CLI, "adopt", "--project-dir", dir, "--no-ci"]);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  const cfg = path.join(dir, "harness.config.yaml");
  const harness = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "";
  w(dir, "harness.config.yaml", `${harness.replace(/^(test_cmd|bdd_cmd|acceptance_cmd):.*\n?/gm, "").replace(/\s*$/, "")}\ntest_cmd: "node -e 0"\n${o.acceptanceCmd ? `acceptance_cmd: ${JSON.stringify(o.acceptanceCmd)}\n` : ""}`);
  const proposed = run(process.execPath, [CLI, "propose", "draft-fees", "--project-dir", dir]);
  assert.equal(proposed.status, 0, proposed.stdout + proposed.stderr);
  w(dir, `${FEES}/specs/draft-fees/spec.md`, DELTA);
  w(dir, `${FEES}/design.md`, "# Design: draft-fees\n\n## Modules\n\n- `src/fees.js` — the fee of a late book.\n");
  if (o.approve !== false) {
    const approved = run(process.execPath, [CLI, "change", "approve", "draft-fees", "--project-dir", dir]);
    assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  }
  run("git", ["add", "-A"]);
  run("git", ["commit", "-qm", "seed"]);
  w(dir, "test/fees.test.js", "// REQ-031 SCN-031: the late fee\n");
  return { dir, run };
}

const write = (dir: string, file: string) =>
  guard.decide({ cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, file), content: "x" } }, {});

test("REQ-793 SCN-793a: a new source file the approved design does not name is refused when it is written", () => {
  const { dir } = project();
  const outside = write(dir, "src/export.js");
  assert.equal(outside.allow, false);
  assert.match(outside.message, /file_outside_design/);
  assert.match(outside.message, /src\/export\.js/);
  assert.match(outside.message, /specgate propose/);
  // The file the design names is allowed, and so is one that already exists.
  assert.equal(write(dir, "src/fees.js").allow, true);
  w(dir, "src/index.js", "// there before\n");
  assert.equal(write(dir, "src/index.js").allow, true);
});

test("REQ-793: with no approved design, or the rule scope off, the guard does not judge the scope", () => {
  const unapproved = project({ approve: false });
  assert.doesNotMatch(String(write(unapproved.dir, "src/export.js").message ?? ""), /file_outside_design/);
  const off = project();
  w(off.dir, ".specgate/gate.yaml", "preset: standard\nrules:\n  scope: off\n");
  assert.equal(write(off.dir, "src/export.js").allow, true);
});

test("REQ-794 SCN-794a: sealing runs the acceptance tests once and shows the person why they fail", () => {
  const { dir, run } = project({ acceptanceCmd: "node {files}" });
  w(dir, "test/acceptance/fees.acc.js", "require('../../../src/fees.js');\n");
  w(dir, `${FEES}/acceptance-tests.md`, "- test/acceptance/fees.acc.js — SCN-031\n");
  const r = run(process.execPath, [CLI, "change", "approve", "draft-fees", "--layer", "acceptance", "--project-dir", dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const said = r.stdout + r.stderr;
  assert.match(said, /sealed/i);
  assert.match(said, /ran once/i);
  assert.match(said, /Cannot find module '\.\.\/\.\.\/\.\.\/src\/fees\.js'/);
});
