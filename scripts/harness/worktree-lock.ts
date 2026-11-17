/**
 * One `git worktree add` at a time, across processes.
 *
 * ## The defect
 *
 * `--concurrency` runs each requirement in its own **process**, and every one
 * of them creates a worktree in the same repository. Git writes
 * `.git/worktrees/<name>/` incrementally — `gitdir`, then `commondir`, then the
 * rest — and a sibling `git worktree add` scanning that directory can read an
 * entry that is half there:
 *
 * ```
 * fatal: failed to read .git/worktrees/specgate-harness-REQ-000-b300c79f/commondir:
 *        Undefined error: 0
 * ```
 *
 * Observed on CI on both macOS and Ubuntu, roughly one run in three. It is the
 * same family as the `git worktree prune` race the parent already avoids by
 * pruning once before anything is created — that one was fixed, this one was
 * not.
 *
 * The failure is worse than a crash, because it is *attributed*: the run
 * reports the requirement as `fail` with "the agent produced no files", so a
 * race in the harness reads as the agent's fault.
 *
 * ## Why a lock directory
 *
 * `mkdir` either creates or fails, atomically, on every platform this runs on —
 * no `O_EXCL` flag juggling and nothing to clean up if the process dies holding
 * a file handle. The pid and timestamp inside make a stale lock diagnosable
 * rather than mysterious.
 *
 * ## Why only around `add`
 *
 * The lock covers creating the worktree and nothing else. The agent, the gate
 * and the tests — the parts that take minutes — stay parallel, so the ceiling
 * on throughput is unchanged. `git worktree add` on a warm repository takes
 * tens of milliseconds.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isSameProcess } from "../lib/process-start";

/** How long to wait for the holder before giving up. */
const WAIT_MS = 30_000;
/** A lock older than this is assumed abandoned by a process that died. */
const STALE_MS = 120_000;
const POLL_MS = 25;

interface LockInfo {
  pid: number;
  at: number;
}

/**
 * In the repository's git directory. REQ-578: \`.git\` is a file in a project
 * that is itself a worktree or a submodule, where a folder inside it can never
 * be made — the directory it points to holds the lock instead.
 */
function lockDir(projectDir: string): string {
  const dotGit = path.join(projectDir, ".git");
  try {
    if (fs.statSync(dotGit).isFile()) {
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, "utf8"));
      if (m) {
        const gitDir = path.resolve(projectDir, m[1].trim());
        // A linked worktree's git dir names the common one in \`commondir\`.
        let common = gitDir;
        try {
          common = path.resolve(
            gitDir,
            fs.readFileSync(path.join(gitDir, "commondir"), "utf8").trim()
          );
        } catch {
          /* a submodule: its git dir is its own */
        }
        return path.join(common, "specgate-worktree.lock");
      }
    }
  } catch {
    /* no .git: the folder below is made, or the run goes unlocked */
  }
  return path.join(dotGit, "specgate-worktree.lock");
}

function readInfo(dir: string): LockInfo | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

/** A lock just made, whose holder has not written its owner yet (REQ-578). */
const BEING_TAKEN_MS = 5_000;

/** True when the holder is gone, or has been holding it implausibly long. */
function isStale(info: LockInfo | null, dir: string): boolean {
  if (!info) {
    // REQ-578: between mkdir and owner.json the lock is being taken, not abandoned.
    try {
      return Date.now() - fs.statSync(dir).mtimeMs > BEING_TAKEN_MS;
    } catch {
      return true;
    }
  }
  if (Date.now() - info.at > STALE_MS) return true;
  try {
    // Signal 0 tests for existence without touching the process.
    process.kill(info.pid, 0);
  } catch {
    return true;
  }
  // REQ-593: alive, but a process that started after the lock is not its holder.
  return !isSameProcess(info.pid, info.at);
}

function sleep(ms: number): void {
  // Synchronous on purpose: the caller is `spawnSync` code with no event loop
  // to yield to, and the wait is milliseconds.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` with the worktree lock held.
 *
 * Never fails the caller: if the lock cannot be taken within `WAIT_MS` the work
 * runs anyway. A harness that refuses to start because of its own mutex would
 * be a worse bug than the race it is avoiding, and the race is recoverable —
 * git reports it and the requirement is retried.
 */
export function withWorktreeLock<T>(projectDir: string, fn: () => T): T {
  const dir = lockDir(projectDir);
  const deadline = Date.now() + WAIT_MS;
  let held = false;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(dir, { recursive: false });
      fs.writeFileSync(
        path.join(dir, "owner.json"),
        JSON.stringify({ pid: process.pid, at: Date.now() }),
        "utf8"
      );
      held = true;
      break;
    } catch (e) {
      // REQ-578: a lock that cannot be made at all is not waited for 30 s.
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") break;
      if (isStale(readInfo(dir), dir)) {
        // Break it rather than wait out a holder that no longer exists.
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* another process broke it first; try again */
        }
        continue;
      }
      sleep(POLL_MS);
    }
  }

  try {
    return fn();
  } finally {
    if (held) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* the next holder breaks it as stale */
      }
    }
  }
}
