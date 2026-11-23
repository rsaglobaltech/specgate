/**
 * lab-fixes: what trying specgate end to end on a real project found
 * (2026-11-23) — the principles the agent never read nor its gate ran
 * (REQ-692, REQ-693), chaining under trust (REQ-694), a dry run that showed
 * a prompt the trust level would skip (REQ-695), tooling and exam fixtures
 * taken for code (REQ-696), and an exam that told the agent its criterion
 * (REQ-697).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { principlesStage } = require("../../scripts/harness/run/gate");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp(prefix = "specgate-labfix-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

const P1 = [
  "# Principles",
  "",
  "## P1 — Code names its requirement",
  "",
  "Every source file names the requirement it delivers in a comment.",
  "",
  `<!-- specgate:principle run="! grep -L 'REQ-[0-9]' src/*.js | grep ." -->`,
  "",
].join("\n");

/** A project `harness run` can plan: `specgate init`, its REQ-000 left to do. */
function project() {
  const parent = tmp("specgate-labfix-p-");
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  return { parent, dir };
}
const commit = (dir: string) => {
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
};

test("REQ-692 SCN-692a: P1 in the prompt", () => {
  const { dir } = project();
  w(dir, "docs/specs/principles.md", P1);
  commit(dir);
  const r = sg(dir, "harness", "run", "--req", "REQ-000", "--dry-run");
  const out = r.stdout + r.stderr;
  assert.match(out, /## Principles/, out);
  assert.match(out, /P1 — Code names its requirement\*\*: Every source file names the requirement/);
});

test("REQ-693 SCN-693a: code without its requirement's id fails the stage principles", () => {
  const dir = tmp();
  w(dir, "docs/specs/principles.md", P1);
  w(dir, "src/x.js", "export const x = 1;\n");
  const stages: string[] = [];
  const failed = principlesStage(dir, (stage: string, result: string) =>
    stages.push(`${stage}:${result}`)
  );
  assert.ok(failed, "the gate fails");
  assert.equal(failed.stage, "principles");
  assert.match(failed.output, /P1 \(Code names its requirement\)/);
  assert.deepEqual(stages, ["principles:fail"]);

  w(dir, "src/x.js", "// REQ-004\nexport const x = 1;\n");
  assert.equal(principlesStage(dir), null, "named, it passes");

  w(dir, "docs/specs/principles.md", P1.replace('run="', 'level="warn" run="'));
  w(dir, "src/x.js", "export const x = 1;\n");
  assert.equal(principlesStage(dir), null, "a warn-level principle does not fail the gate");
});

/** An `init` project: REQ-001, its scenario, a derived matrix. */
function initProject() {
  const dir = tmp();
  git(dir, "init", "-q");
  const r = spawnSync(process.execPath, [CLI, "init"], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return dir;
}
const json = (r: { stdout: string; stderr: string }) => {
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(r.stdout + r.stderr);
  }
};

test("REQ-696 SCN-696a: the scenario runner mentions the requirement, and is not its code", () => {
  // The lab's REQ-006 is this project's REQ-001: the one its `init` gives.
  const dir = initProject();
  w(dir, "scripts/scenarios.mjs", "// Runs the scenarios: node scripts/scenarios.mjs @REQ-001\n");
  assert.equal(sg(dir, "config", "set", "bdd_cmd", "node scripts/scenarios.mjs").status, 0);
  const entry = json(sg(dir, "map", "--json")).map.requirements.find(
    (e: { requirement: string }) => e.requirement === "REQ-001"
  );
  assert.deepEqual(entry.code, [], JSON.stringify(entry));

  // Without the command naming it, the same file is code by mention: the control.
  assert.equal(sg(dir, "config", "set", "bdd_cmd", "node other.mjs").status, 0);
  const named = json(sg(dir, "map", "--json")).map.requirements.find(
    (e: { requirement: string }) => e.requirement === "REQ-001"
  );
  assert.deepEqual(named.code, ["scripts/scenarios.mjs"]);
});

test("REQ-696 SCN-696b: an exam fixture is not a test", () => {
  const dir = initProject();
  const t = '// REQ-001 SCN-001\nrequire("node:test")("ok", () => {});\n';
  w(dir, "test/baseline.test.js", t);
  w(dir, "evals/conventions/tasks/t/test/baseline.test.js", t);
  const row = json(sg(dir, "matrix", "--json")).matrix.scenarios.find(
    (s: { requirement: string }) => s.requirement === "REQ-001"
  );
  assert.deepEqual(row.tests, ["test/baseline.test.js"]);
});
