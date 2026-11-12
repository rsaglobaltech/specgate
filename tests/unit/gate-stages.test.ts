/**
 * studio-phase3-json: every `check --json` answer lists the gate's stages
 * (REQ-503), and the last result is kept and read back with `check --last`
 * and the API's `lastCheck(dir)` (REQ-504).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import * as api from "../../scripts/api";
import { git, newProject, removeProject, specRequirement, write } from "../helpers/project";
import { runCli } from "../helpers/cli";

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

/** A project whose tests always fail, as a script: quoting a `node -e` differs per shell. */
function failingTests(dir: string): void {
  write(dir, "fail.js", "process.exit(3);\n");
  write(dir, "harness.config.yaml", 'harness_version: 1\ntest_cmd: "node fail.js"\n');
}

type Stage = {
  stage: string;
  result: string;
  command: string | null;
  findings: Array<{ code: string; message: string; file?: string }>;
};

test("REQ-503 SCN-503a: validate fails on an Approved requirement no test names — the stages before it, its own finding, and the tests not run", () => {
  const dir = newProject("sg-stages-");
  try {
    specRequirement(dir, "REQ-001", "Place an order", "status=Approved");
    failingTests(dir);
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const doc = json(r);
    assert.equal(doc.check, null, "the failure keeps its null shape");
    const stages: Stage[] = doc.stages;
    assert.deepEqual(
      stages.map((s) => s.stage),
      ["ids", "changes", "validate", "architecture", "tests"]
    );
    const of = (name: string) => stages.find((s) => s.stage === name) as Stage;
    assert.ok(["passed", "skipped"].includes(of("ids").result));
    assert.ok(["passed", "skipped"].includes(of("changes").result));
    assert.equal(of("validate").result, "failed");
    assert.equal(of("validate").command, "specgate validate --strict");
    assert.ok(
      of("validate").findings.some((f) => f.code === "strict_tdd_1" && f.message.includes("TDD-1")),
      JSON.stringify(of("validate").findings)
    );
    assert.ok(of("validate").findings.some((f) => f.code === "check_validate_failed"));
    assert.equal(of("architecture").result, "skipped");
    assert.equal(of("tests").result, "not run");
    assert.equal(of("tests").command, "node fail.js");
  } finally {
    removeProject(dir);
  }
});

test("REQ-503: a passing check lists every stage too", () => {
  const dir = newProject("sg-stages-");
  try {
    write(dir, "ok.js", "\n");
    write(dir, "harness.config.yaml", 'harness_version: 1\ntest_cmd: "node ok.js"\n');
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const stages: Stage[] = json(r).stages;
    assert.equal(stages.find((s) => s.stage === "validate")?.result, "passed");
    assert.equal(stages.find((s) => s.stage === "tests")?.result, "passed");
  } finally {
    removeProject(dir);
  }
});

test("REQ-504 SCN-504a: no check yet, then a failed one kept with its time, commit and stages; git status stays clean", async () => {
  const dir = newProject("sg-last-");
  try {
    failingTests(dir);
    assert.equal(runCli(["matrix", "--project-dir", dir]).status, 0);
    assert.equal(git(dir, "init", "-q").status, 0);
    git(dir, "add", "-A");
    assert.equal(git(dir, "commit", "-qm", "seed").status, 0);
    const head = git(dir, "rev-parse", "HEAD").stdout.trim();

    const first = runCli(["check", "--last", "--json", dir]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const none = json(first);
    assert.equal(none.lastCheck, null);
    assert.equal(none.status[0].code, "last_check_none");
    assert.equal(none.status[0].fix, "specgate check");
    assert.deepEqual(await api.lastCheck(dir), none);

    const before = Date.now();
    assert.equal(runCli(["check", dir]).status, 1);

    const kept = json(runCli(["check", "--last", "--json", dir]));
    assert.equal(kept.lastCheck.passed, false);
    assert.equal(kept.lastCheck.commit, head);
    assert.ok(Date.parse(kept.lastCheck.ranAt) >= before - 1000, kept.lastCheck.ranAt);
    const tests = kept.lastCheck.stages.find((s: Stage) => s.stage === "tests");
    assert.equal(tests.result, "failed");
    assert.ok(kept.status.some((d: { code: string }) => d.code === "check_tests_failed"));
    assert.deepEqual(await api.lastCheck(dir), kept);

    assert.equal(git(dir, "status", "--porcelain").stdout, "", "the check left the tree as it was");
  } finally {
    removeProject(dir);
  }
});

test("REQ-504: outside git the result is kept in .specgate/, ignored there", () => {
  const dir = newProject("sg-last-");
  try {
    write(dir, "ok.js", "\n");
    write(dir, "harness.config.yaml", 'harness_version: 1\ntest_cmd: "node ok.js"\n');
    assert.equal(runCli(["check", dir]).status, 0);
    const ignore = fs.readFileSync(path.join(dir, ".specgate", ".gitignore"), "utf8");
    assert.match(ignore, /^last-check\.json$/m);
    const kept = json(runCli(["check", "--last", "--json", dir]));
    assert.equal(kept.lastCheck.passed, true);
    assert.equal(kept.lastCheck.commit, null);
  } finally {
    removeProject(dir);
  }
});
