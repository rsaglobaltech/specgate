"use strict";

/**
 * The cross-process lock around `git worktree add`.
 *
 * The defect it exists for is not hypothetical: CI produced it on macOS and
 * Ubuntu, roughly one run in three, as
 *
 *   fatal: failed to read .git/worktrees/<name>/commondir: Undefined error: 0
 *
 * and reported the requirement as `fail` with "the agent produced no files" —
 * a race in the harness attributed to the agent.
 *
 * The stress case below spawns real processes racing on one repository, which
 * is what the harness does under `--concurrency`. It fails without the lock.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const ROOT = require("node:path")
  .resolve(__dirname)
  .split(/[\\/]tests(?:[\\/]|$)/)[0]
  .replace(/[\\/]dist$/, "");

const { withWorktreeLock } = require("../../scripts/harness/worktree-lock");

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-lock-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "a.txt"), "a\n", "utf8");
  git("add", "-A");
  git("commit", "-qm", "seed");
  return dir;
}

const clean = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });

// ── the mechanism ────────────────────────────────────────────────────────────

test("the lock is released even when the work throws", () => {
  // A lock left behind by a failed attempt would stall every later run for two
  // minutes, turning one bad requirement into a stuck pipeline.
  const dir = repo();
  try {
    assert.throws(() => {
      withWorktreeLock(dir, () => {
        throw new Error("boom");
      });
    }, /boom/);
    assert.equal(
      fs.existsSync(path.join(dir, ".git", "specgate-worktree.lock")),
      false,
      "the lock outlived the failure"
    );
  } finally {
    clean(dir);
  }
});

test("a lock held by a process that no longer exists is broken, not waited on", () => {
  // Otherwise a machine that was rebooted mid-run refuses to start for two
  // minutes and nothing says why.
  const dir = repo();
  const lock = path.join(dir, ".git", "specgate-worktree.lock");
  fs.mkdirSync(lock, { recursive: true });
  // A pid that cannot be running: 2^22 is above every platform's pid_max.
  fs.writeFileSync(
    path.join(lock, "owner.json"),
    JSON.stringify({ pid: 4194304, at: Date.now() }),
    "utf8"
  );
  try {
    const started = Date.now();
    const value = withWorktreeLock(dir, () => "ran");
    assert.equal(value, "ran");
    assert.ok(Date.now() - started < 5000, "it waited for a dead holder");
  } finally {
    clean(dir);
  }
});

test("the lock returns whatever the work returns", () => {
  const dir = repo();
  try {
    assert.deepEqual(
      withWorktreeLock(dir, () => ({ ok: 1 })),
      { ok: 1 }
    );
  } finally {
    clean(dir);
  }
});

// ── the race it exists for ───────────────────────────────────────────────────

test("concurrent processes can each add a worktree without corrupting the metadata", () => {
  // Six processes, one repository, all creating worktrees at once. Without the
  // lock this reproduces `failed to read .git/worktrees/<name>/commondir`.
  const dir = repo();
  const runner = path.join(os.tmpdir(), `wt-add-${process.pid}.js`);
  fs.writeFileSync(
    runner,
    `
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { withWorktreeLock } = require(${JSON.stringify(
      path.join(ROOT, "dist", "scripts", "harness", "worktree-lock.js")
    )});
const [repoDir, name] = process.argv.slice(2);
withWorktreeLock(repoDir, () => {
  execFileSync("git", ["worktree", "add", "-b", name, path.join(repoDir, "..", name), "HEAD"], {
    cwd: repoDir,
    stdio: "pipe",
  });
});
`,
    "utf8"
  );

  try {
    const children = Array.from({ length: 6 }, (_, i) =>
      spawnSync(process.execPath, [runner, dir, `wt-${i}`], { encoding: "utf8" })
    );
    const failed = children
      .map((c, i) => ({ i, status: c.status, err: c.stderr }))
      .filter((c) => c.status !== 0);
    assert.deepEqual(
      failed.map((f) => `wt-${f.i}: ${String(f.err).slice(0, 200)}`),
      [],
      "a concurrent worktree add failed"
    );

    const listed = execFileSync("git", ["worktree", "list"], { cwd: dir, encoding: "utf8" });
    for (let i = 0; i < 6; i++) {
      assert.match(listed, new RegExp(`wt-${i}`), `wt-${i} is missing from the worktree list`);
    }
  } finally {
    fs.rmSync(runner, { force: true });
    clean(dir);
    for (let i = 0; i < 6; i++) clean(path.join(path.dirname(dir), `wt-${i}`));
  }
});
