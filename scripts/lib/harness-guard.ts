import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * What keeps a long harness run from hurting itself (REQ-184..186): copies
 * that leave build caches behind, a disk that fills up, an order nobody asked
 * for, old branches in the way, and two runs in one working copy.
 */

/**
 * The files a copy of the project needs: everything git tracks or would track,
 * relative to `dir`. Build caches, dependencies and test output are ignored by
 * the project and stay out — the in-flight copy of a web app carried its whole
 * `.next/cache` until the disk was full (REQ-184). `null` outside a git
 * repository.
 */
export function copyableFiles(dir: string): string[] | null {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: dir,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return [...new Set(r.stdout.split("\0").filter(Boolean))].filter((f) =>
    fs.existsSync(path.join(dir, f))
  );
}

const GB = 1024 ** 3;
const gb = (n: number) => `${Math.round((n / GB) * 10) / 10} GB`;

/** The free space under `dir`, in bytes; `null` when the platform cannot say. */
export function freeBytes(dir: string): number | null {
  try {
    const st = fs.statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return null;
  }
}

/** The free space a requirement needs before it starts: 2 GB, or SPECGATE_HARNESS_MIN_FREE_GB. */
export function minFreeBytes(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SPECGATE_HARNESS_MIN_FREE_GB);
  return (Number.isFinite(n) && n >= 0 ? n : 2) * GB;
}

/** Why a requirement should not start for lack of disk, or `null` when there is room. */
export function lowDiskMessage(free: number | null, min: number, where: string): string | null {
  if (free === null || free >= min) return null;
  return (
    `only ${gb(free)} free on ${where}; a requirement needs at least ${gb(min)} ` +
    `(a worktree, its dependencies and its build). Free some space and re-run; ` +
    `SPECGATE_HARNESS_MIN_FREE_GB changes the threshold.`
  );
}

/** The requirements in the order `--req` gave them; the plan's order without it (REQ-185). */
export function orderAsGiven<T extends { requirement: string }>(
  pending: T[],
  given: string[]
): T[] {
  if (given.length === 0) return pending;
  const at = new Map(given.map((id, i) => [id, i]));
  return [...pending].sort(
    (a, b) => (at.get(a.requirement) ?? Infinity) - (at.get(b.requirement) ?? Infinity)
  );
}

/**
 * What to do with a requirement's branch before it runs (REQ-185). A branch
 * already merged into the one the run starts from holds nothing that would be
 * lost: it is recreated, as `--force` would, without asking for `--force`.
 */
export function existingBranchAction(b: {
  exists: boolean;
  merged: boolean;
  resume: boolean;
  force: boolean;
}): "new" | "resume" | "recreate" | "skip" {
  if (!b.exists) return "new";
  if (b.resume) return "resume";
  if (b.force || b.merged) return "recreate";
  return "skip";
}

/**
 * Whether a requirement's branch holds work and all of it is already in
 * `base` (REQ-185). A branch with no commit of its own does not count: an
 * interrupted attempt leaves one, with its work in a worktree still to resume.
 */
export function branchMergedInto(projectDir: string, branch: string, base: string): boolean {
  const run = (...args: string[]) =>
    spawnSync("git", args, { cwd: projectDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const tip = run("rev-parse", "--verify", "--quiet", branch).stdout.trim();
  if (!tip) return false;
  if (run("merge-base", "--is-ancestor", tip, base).status !== 0) return false;
  // On the base's own line, the tip is a commit the base already had: the
  // branch made nothing. Merged work reaches the base through a merge.
  const line = new Set(run("rev-list", "--first-parent", base).stdout.split("\n"));
  if (line.has(tip)) return false;
  return !run("worktree", "list", "--porcelain").stdout.includes(`branch refs/heads/${branch}`);
}

// Beside the events, which git ignores: a lock that showed as an untracked
// file made the run's own workers refuse a working tree that was not clean.
const LOCK = path.join(".harness", "events", "run.lock");

export interface RunLock {
  pid: number;
  started: number;
  reqs: string[];
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The run holding the working copy, or `null` when none does (a lock whose process is gone does not count). */
export function runLockHolder(projectDir: string): RunLock | null {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(projectDir, LOCK), "utf8")) as RunLock;
    return Number.isInteger(lock.pid) && alive(lock.pid) ? lock : null;
  } catch {
    return null;
  }
}

/**
 * Take the working copy for this run (REQ-186): the post-merge gate runs in it,
 * and a second run, or tests started by hand, sharing it broke that gate and
 * undid a merge whose attempt had passed. Returns the release, or `null` when
 * another live run holds it.
 */
export function acquireRunLock(projectDir: string, reqs: string[]): (() => void) | null {
  if (runLockHolder(projectDir)) return null;
  const file = path.join(projectDir, LOCK);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ignore = path.join(path.dirname(file), ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  const lock: RunLock = { pid: process.pid, started: Math.floor(Date.now() / 1000), reqs };
  fs.writeFileSync(file, JSON.stringify(lock), "utf8");
  const release = () => {
    try {
      const now = JSON.parse(fs.readFileSync(file, "utf8")) as RunLock;
      if (now.pid === process.pid) fs.rmSync(file, { force: true });
    } catch {
      /* already gone */
    }
  };
  process.once("exit", release);
  return release;
}

/** A request to stop once the requirement in progress ends (REQ-209). */
const STOP = path.join(".harness", "events", "stop");

/** Ask the run working in this project to stop after its current requirement. */
export function requestStop(projectDir: string): void {
  const file = path.join(projectDir, STOP);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${new Date().toISOString()}\n`, "utf8");
}

/** Whether a stop was asked; the request is consumed. */
export function takeStop(projectDir: string): boolean {
  const file = path.join(projectDir, STOP);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}
