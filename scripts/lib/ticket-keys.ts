/**
 * The ticket key travels with the work (ADR-0039): a Git host linked to Jira
 * shows a ticket's branch, commits and pull request only when they name its
 * key. On a ticket's branch, a commit that does not is invisible to the
 * ticket, so `check` says which.
 */

import { spawnSync } from "node:child_process";
import { warning } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import { resolveBase } from "./base-ids";
import { assertSafeGitRef } from "../../packages/core/src/domain/GitSafety";

/** `feature/KAN-13-register-vehicle-entry` → `KAN-13`. */
const TICKET_BRANCH = /^(?:feature|bugfix|hotfix)\/([A-Z][A-Z0-9_]+-\d+)(?:-|$)/;

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

/** The base: `--base`, SPECGATE_BASE or origin's default, else develop, main, master. */
export function baseFor(dir: string, given?: string): string | null {
  const resolved = resolveBase(dir, given);
  if (resolved) {
    // Throws for a ref git would read as an option: a base that cannot be
    // used is an error, never "no base" — that would mean HEAD.
    assertSafeGitRef(resolved, "base");
    return resolved;
  }
  for (const name of ["develop", "main", "master"]) {
    if (git(dir, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]).status === 0)
      return name;
  }
  return null;
}

export function ticketKeyFindings(dir: string, given?: string): Diagnostic[] {
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.status !== 0) return [];
  const key = TICKET_BRANCH.exec(branch.stdout.trim())?.[1];
  if (!key) return [];
  let base: string | null;
  try {
    base = baseFor(dir, given);
  } catch {
    return [];
  }
  if (!base || base === branch.stdout.trim()) return [];
  const log = git(dir, ["log", `${base}..HEAD`, "--format=%h%x09%s"]);
  if (log.status !== 0) return [];
  const named = new RegExp(`(^|[^A-Z0-9_-])${key}(?![0-9])`);
  return log.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, subject]) => !named.test(subject ?? ""))
    .map(([sha, subject]) =>
      warning("ticket_key_missing", `Commit ${sha} "${subject}" does not name ${key}.`, {
        target: sha,
        fix: `Reword it to start with ${key} (git commit --amend for the last one), so Jira shows it in ${key}.`,
      })
    );
}
