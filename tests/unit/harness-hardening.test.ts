"use strict";

/**
 * REQ-184..186 — the harness over a night of work (fuhrerschein, S11, S13, S14).
 *
 * A twenty-requirement chain filled the disk with copies of build caches and
 * stopped with ENOSPC; re-running delivered requirements stopped at their old
 * branches and ran in an order nobody asked for; and a test run started by
 * hand in the same working copy broke the post-merge gate, which undid a
 * merge whose attempt had passed.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  copyableFiles,
  lowDiskMessage,
  orderAsGiven,
  existingBranchAction,
  acquireRunLock,
  branchMergedInto,
  runLockHolder,
} = require("../../scripts/lib/harness-guard");

function git(cwd: string, ...args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-guard-"));
  git(dir, "init", "-q");
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w(".gitignore", ".next/\ntest-results/\nnode_modules/\n");
  w("spec.md", "# Spec\n");
  w("apps/web/page.tsx", "export {};\n");
  w("apps/web/.next/cache/webpack/0.pack", "x".repeat(1000));
  w("apps/web/test-results/trace.zip", "zip");
  w("node_modules/a/index.js", "");
  git(dir, "add", "-A");
  w("docs/new.md", "# untracked, not ignored\n");
  return dir;
}

test("REQ-184 SCN-184a: the in-flight copy takes what git keeps, never build caches", () => {
  const dir = repo();
  try {
    const files = copyableFiles(dir).sort();
    assert.deepEqual(files, [".gitignore", "apps/web/page.tsx", "docs/new.md", "spec.md"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-184 SCN-184b: the harness stops before a requirement when the disk is nearly full", () => {
  const GB = 1024 ** 3;
  assert.equal(lowDiskMessage(10 * GB, 2 * GB, "C:\\"), null);
  const msg = lowDiskMessage(0.1 * GB, 2 * GB, "C:\\");
  assert.match(msg, /0\.1 GB free on C:\\/);
  assert.match(msg, /2 GB/);
});

test("REQ-185 SCN-185a: --req runs in the order given", () => {
  const pending = [
    { requirement: "REQ-085" },
    { requirement: "REQ-017" },
    { requirement: "REQ-052" },
  ];
  assert.deepEqual(
    orderAsGiven(pending, ["REQ-017", "REQ-052", "REQ-085"]).map(
      (r: { requirement: string }) => r.requirement
    ),
    ["REQ-017", "REQ-052", "REQ-085"]
  );
  assert.deepEqual(
    orderAsGiven(pending, []).map((r: { requirement: string }) => r.requirement),
    ["REQ-085", "REQ-017", "REQ-052"],
    "without --req the plan's order stands"
  );
});

test("REQ-185 SCN-185b: a branch already merged is recreated without --force; one with unmerged work still asks", () => {
  const base = { exists: true, resume: false, force: false };
  assert.equal(existingBranchAction({ ...base, merged: true }), "recreate");
  assert.equal(existingBranchAction({ ...base, merged: false }), "skip");
  assert.equal(existingBranchAction({ ...base, merged: false, force: true }), "recreate");
  assert.equal(existingBranchAction({ ...base, merged: false, resume: true }), "resume");
  assert.equal(existingBranchAction({ ...base, exists: false, merged: false }), "new");
});

test("REQ-185 SCN-185b: merged means work made on the branch and merged, not a branch left at the base", () => {
  const dir = repo();
  try {
    git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "base");
    git(dir, "branch", "harness/REQ-001");
    assert.equal(branchMergedInto(dir, "harness/REQ-001", "HEAD"), false, "made nothing");

    git(dir, "checkout", "-q", "-b", "harness/REQ-002");
    fs.writeFileSync(path.join(dir, "two.txt"), "2\n");
    git(dir, "add", "two.txt");
    git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "work");
    git(dir, "checkout", "-q", "-");
    assert.equal(branchMergedInto(dir, "harness/REQ-002", "HEAD"), false, "work not merged yet");

    git(
      dir,
      "-c",
      "user.email=t@t",
      "-c",
      "user.name=t",
      "merge",
      "-q",
      "--no-ff",
      "-m",
      "merge",
      "harness/REQ-002"
    );
    assert.equal(branchMergedInto(dir, "harness/REQ-002", "HEAD"), true, "work merged");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-186 SCN-186a: one harness run at a time in a working copy", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-lock-"));
  try {
    const release = acquireRunLock(dir, ["REQ-007"]);
    assert.equal(typeof release, "function");
    const holder = runLockHolder(dir);
    assert.equal(holder.pid, process.pid);
    assert.deepEqual(holder.reqs, ["REQ-007"]);
    assert.equal(acquireRunLock(dir, ["REQ-008"]), null, "a second run is refused");
    release();
    assert.equal(runLockHolder(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-186 SCN-186b: a lock left by a process that is gone does not block", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-lock-"));
  try {
    fs.mkdirSync(path.join(dir, ".harness", "events"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".harness", "events", "run.lock"),
      JSON.stringify({ pid: 2147483646, started: 1, reqs: ["REQ-001"] })
    );
    assert.equal(runLockHolder(dir), null);
    const release = acquireRunLock(dir, ["REQ-002"]);
    assert.equal(typeof release, "function");
    release();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
