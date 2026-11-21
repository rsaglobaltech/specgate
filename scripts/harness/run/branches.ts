/**
 * The repository a run works on, as git tells it: which branches exist, which
 * one a requirement is cut from, whether the base has fallen behind, the
 * worktree a branch is already checked out in, and what is uncommitted.
 *
 * Reads and, for the integration branches a parallel run leaves, deletes.
 * Nothing here decides what a requirement does next.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, info, resolveGeneratedConflicts, warn } from "./shared";
/**
 * The paths `git status` shows: changed, staged, deleted or untracked — what a
 * run cut from the last commit leaves out (REQ-490). Sorted, `/`-separated.
 */
export function uncommittedPaths(projectDir: string): string[] {
  const r = git(projectDir, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (r.status !== 0) {
    throw new Error(`git status failed: ${r.stderr || r.stdout}`);
  }
  const out: string[] = [];
  const entries = String(r.stdout).split("\0");
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    out.push(entry.slice(3));
    // A rename or copy carries its old path as the next entry: left out too.
    if (entry[0] === "R" || entry[0] === "C") {
      if (entries[i + 1]) out.push(entries[i + 1]);
      i += 1;
    }
  }
  return [...new Set(out)].sort();
}

export function branchExists(projectDir: string, branch: string): boolean {
  const r = git(projectDir, ["branch", "--list", branch]);
  return r.status === 0 && r.stdout.trim() !== "";
}

/**
 * REQ-579: the \`harness/base/REQ-NNN\` branches a run made to merge several
 * dependencies into — derived again on every run, so none is kept. One still
 * checked out (a kept worktree) is left.
 */
export function dropIntegrationBranches(projectDir: string): void {
  const refs = git(projectDir, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/harness/base/",
  ]);
  if (refs.status !== 0) return;
  for (const branch of String(refs.stdout).split("\n").filter(Boolean)) {
    git(projectDir, ["branch", "-D", branch]);
  }
}

/**
 * The repository's main line, for the staleness check.
 *
 * `origin/HEAD` is authoritative when it is set; otherwise the conventional
 * names, in order. A repository with none of them simply gets no warning —
 * guessing wrong would be worse than staying quiet.
 */
export function defaultBranch(projectDir: string): string | null {
  const head = git(projectDir, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (head.status === 0) {
    const ref = String(head.stdout).trim().replace("refs/remotes/", "");
    if (ref) return ref;
  }
  for (const name of ["main", "master"]) {
    if (git(projectDir, ["rev-parse", "--verify", "--quiet", name]).status === 0) return name;
  }
  return null;
}

/** How many commits `target` has that `ref` does not. */
export function commitsBehind(projectDir: string, ref: string, target: string): number {
  const r = git(projectDir, ["rev-list", "--count", `${ref}..${target}`]);
  if (r.status !== 0) return 0;
  return Number(String(r.stdout).trim()) || 0;
}

/**
 * Warn when the base a requirement is cut from is missing work that the main
 * line already has.
 *
 * This is H9. `--base-branch harness/REQ-001` behaves exactly as git says it
 * should — the new branch inherits its base, not `main` — and it cost two
 * agent runs to discover, because a fix that had landed on `main` was simply
 * not there and the gate failed for a reason that had nothing to do with the
 * requirement. Deriving the base (below) removes the need to pass the flag;
 * this says so out loud when the derived base is stale anyway.
 */
export function warnIfBaseIsStale(projectDir: string, reqId: string, base: string): void {
  const mainLine = defaultBranch(projectDir);
  if (!mainLine || mainLine === base) return;
  const behind = commitsBehind(projectDir, base, mainLine);
  if (behind === 0) return;
  warn(
    `${reqId}: base ${base} is ${behind} commit(s) behind ${mainLine}. ` +
      `A fix that landed on ${mainLine} is not in this worktree — a gate failure may not be about ${reqId}.`
  );
}

/**
 * Where a requirement's worktree is cut from.
 *
 * A requirement that builds on another needs that other's code to exist, and
 * the only place it exists during a run is the dependency's own
 * `harness/REQ-NNN` branch. Deriving this is what closes H12's other half:
 * nobody has to know the order and pass `--base-branch` by hand.
 *
 * Dependencies that are already `DONE` contribute nothing here — their work is
 * in the run's base already.
 *
 * @param deps   the requirement's dependencies, in declaration order
 * @param passed REQ → branch, for the dependencies that passed in this run
 */
export function deriveBase(
  projectDir: string,
  reqId: string,
  deps: string[],
  passed: Map<string, string>,
  ctx: { baseRef: string }
): { base: string } | { error: string } {
  const branches = deps.map((d) => passed.get(d)).filter((b): b is string => Boolean(b));

  if (branches.length === 0) return { base: ctx.baseRef };
  if (branches.length === 1) return { base: branches[0] };

  // More than one dependency produced code, on branches that know nothing of
  // each other. Cutting from one would silently omit the rest, so they are
  // integrated into a throwaway base first. This is not the merge the harness
  // refuses to do — that one is into a branch a human reviews; this is
  // assembling the context the requirement was declared to need, and a
  // conflict here is a real finding rather than a nuisance.
  const integration = `harness/base/${reqId}`;
  git(projectDir, ["branch", "-D", integration]);
  const cut = git(projectDir, ["branch", integration, ctx.baseRef]);
  if (cut.status !== 0) {
    return { error: `could not create ${integration}: ${cut.stderr || cut.stdout}` };
  }

  const worktree = path.join(
    os.tmpdir(),
    `specgate-harness-base-${reqId}-${crypto.randomBytes(4).toString("hex")}`
  );
  const add = git(projectDir, ["worktree", "add", worktree, integration]);
  if (add.status !== 0) {
    return { error: `could not check out ${integration}: ${add.stderr || add.stdout}` };
  }

  try {
    for (const branch of branches) {
      const merge = git(worktree, ["merge", "--no-edit", branch]);
      if (merge.status === 0) continue;

      const unresolved = resolveGeneratedConflicts(worktree);
      if (unresolved.length > 0) {
        git(worktree, ["merge", "--abort"]);
        return {
          error:
            `${branch} conflicts with the other dependencies of ${reqId} in ` +
            `${unresolved.join(", ")}. Those are source files; a human has to decide.`,
        };
      }
    }
  } finally {
    git(projectDir, ["worktree", "remove", "--force", worktree]);
  }

  info(`${reqId}: base is ${branches.join(" + ")} integrated into ${integration}`);
  return { base: integration };
}

/**
 * Commit a failed attempt so the branch carries what the agent wrote.
 *
 * Returns false when there was nothing to commit — an agent that produced no
 * files at all, which is itself worth knowing and is reported as such.
 */
/**
 * The worktree already checked out on `branch`, if git still knows of one.
 *
 * After an interruption the worktree survives — the process died before its
 * `finally` could remove it — holding the agent's uncommitted partial work.
 * Re-using it is the difference between resuming and starting over.
 */
export function existingWorktreeFor(projectDir: string, branch: string): string | null {
  const listed = git(projectDir, ["worktree", "list", "--porcelain"]);
  if (listed.status !== 0) return null;

  let current: string | null = null;
  for (const line of (listed.stdout || "").split("\n")) {
    if (line.startsWith("worktree ")) current = line.slice("worktree ".length).trim();
    else if (line.trim() === `branch refs/heads/${branch}` && current) {
      return fs.existsSync(current) ? current : null;
    }
  }
  return null;
}

/**
 * Can git commit here? Returns the problem, or `""`.
 *
 * Asked before the first worktree rather than at the commit step. The harness
 * commits for every green requirement and again to preserve a failed attempt,
 * so a missing identity costs a whole attempt — agent time included — to
 * discover something a single command fixes.
 */
export function gitIdentityProblem(projectDir: string): string {
  const missing = ["user.name", "user.email"].filter((key) => {
    const r = git(projectDir, ["config", "--get", key]);
    return r.status !== 0 || !String(r.stdout || "").trim();
  });
  if (missing.length === 0) return "";

  return (
    `git has no ${missing.join(" and ")} configured, and the harness commits on ` +
    `every requirement it lands. It would fail after the agent had already run.\n` +
    `Fix: git config user.name "Your Name" && git config user.email "you@example.com"`
  );
}
