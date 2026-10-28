"use strict";

/**
 * REQ-266, REQ-267 — quality checks inside a harness worktree. semgrep in
 * Docker could not read the worktree's git folder, hung until its timeout, and
 * the agent was told to fix what it found (truck-flote S52).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { dockerArgs } = require("../../scripts/lib/quality-run");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function tmp(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

const CHECK = {
  name: "semgrep",
  run: "semgrep scan --sarif --output .specgate/quality/semgrep.sarif",
  when: "end",
  gate: true,
  runner: "docker",
  image: "semgrep/semgrep:1.99.0",
  network: true,
  shell: false,
  volumes: [],
  env: [],
  timeout: 900,
  sarif: ".specgate/quality/semgrep.sarif",
  report: null,
  scope: "diff",
  profile: "",
  docker: false,
  needs: "",
};

test("REQ-266 SCN-266a: semgrep in a harness worktree", () => {
  const repo = tmp("specgate-wt-repo-");
  fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "seed");
  const wt = path.join(tmp("specgate-wt-parent-"), "wt");
  assert.equal(git(repo, "worktree", "add", "-q", wt).status, 0);

  const args = dockerArgs(CHECK, wt, CHECK.run, "c1");
  const common = fs.realpathSync(path.join(repo, ".git"));
  const mount = args.find((a: string) => a.endsWith(":/.specgate-git:ro"));
  assert.ok(mount, args.join(" "));
  assert.equal(fs.realpathSync(mount.slice(0, -":/.specgate-git:ro".length)), common);
  assert.ok(args.includes("GIT_DIR=/.specgate-git/worktrees/wt"), args.join(" "));
  assert.ok(args.includes("GIT_WORK_TREE=/src"), args.join(" "));

  // The main tree's own .git is a folder inside /src: nothing more to mount.
  const main = dockerArgs(CHECK, repo, CHECK.run, "c2");
  assert.ok(!main.some((a: string) => a.includes(".specgate-git")), main.join(" "));
});

test("REQ-267 SCN-267a: a scanner that fails before it reports", () => {
  const parent = tmp("specgate-wt-setup-");
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .split("\n")
      .filter((l: string) => !l.includes("REQ-001"))
      .join("\n")
  );
  fs.writeFileSync(
    path.join(dir, "broken-scanner.js"),
    "process.stderr.write('fatal: not a git repository');\nprocess.exit(2);\n"
  );
  fs.appendFileSync(
    path.join(dir, "harness.config.yaml"),
    [
      "",
      "checks:",
      "  - name: scan",
      '    run: "node broken-scanner.js"',
      "    runner: local",
      "    when: attempt",
      "    sarif: .specgate/quality/scan.sarif",
      "",
    ].join("\n")
  );
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  const agentFile = path.join(parent, "agent.js");
  fs.writeFileSync(
    agentFile,
    'require("node:fs").writeFileSync("src-written.ts", "export const a = 1;\\n");\n'
  );
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      dir,
      "--req",
      "REQ-000",
      "--agent",
      `"${process.execPath}" "${agentFile}" {prompt_file}`,
      "--max-attempts",
      "3",
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  const out = r.stdout + r.stderr;
  assert.match(out, /attempt 1\/3/, out);
  assert.doesNotMatch(out, /attempt 2\/3/, out);
  assert.match(out, /could not run/, out);
  assert.match(out, /not a git repository/, out);
  assert.doesNotMatch(out, /Fix what the check found/, out);
});
