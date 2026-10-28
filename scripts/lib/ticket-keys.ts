/**
 * The ticket key travels with the work (ADR-0039): a Git host linked to Jira
 * shows a ticket's branch, commits and pull request only when they name its
 * key. On a ticket's branch, a commit that does not is invisible to the
 * ticket, so `check` says which.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { warning } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import { resolveBase } from "./base-ids";
import { assertSafeGitRef } from "../../packages/core/src/domain/GitSafety";

/**
 * `feature/KAN-13-register-vehicle-entry` → `KAN-13`; with a team before the
 * key, as agentkit names it, `feature/parking/KAN-13` too (REQ-170).
 */
export const TICKET_BRANCH = /^(?:feature|bugfix|hotfix)\/(?:[^/]+\/)?([A-Z][A-Z0-9_]+-\d+)(?:-|$)/;

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
    base = ticketBase(dir, given);
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

const CHANGES = path.join("docs", "specs", "changes");
const JIRA_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

function specFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? specFiles(full) : e.name === "spec.md" ? [full] : [];
  });
}

/** The ticket of the open change whose delta holds `requirement`, or null (REQ-156). */
export function ticketKeyOf(projectDir: string, requirement: string): string | null {
  const changes = path.join(projectDir, CHANGES);
  if (!fs.existsSync(changes)) return null;
  const heading = new RegExp(`^###\\s+Requirement:\\s+${requirement}(?![0-9])`, "m");
  for (const e of fs.readdirSync(changes, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "archive" || e.name.startsWith(".")) continue;
    const dir = path.join(changes, e.name);
    if (!specFiles(path.join(dir, "specs")).some((f) => heading.test(fs.readFileSync(f, "utf8"))))
      continue;
    const yaml = path.join(dir, "change.yaml");
    const key = fs.existsSync(yaml)
      ? /^ticket:\s*(\S+)\s*$/m.exec(fs.readFileSync(yaml, "utf8"))?.[1]
      : undefined;
    return key && JIRA_KEY.test(key) ? key : null;
  }
  return null;
}

/** The harness's commit for a requirement: the ticket key first when it has one. */
export function harnessCommitMessage(
  projectDir: string,
  requirement: string,
  attempt: number,
  maxAttempts: number
): string {
  const key = ticketKeyOf(projectDir, requirement);
  const subject = key
    ? `feat(${requirement}): ${key} implement via specgate harness`
    : `feat(${requirement}): implement via specgate harness`;
  return `${subject}\n\nAttempt ${attempt}/${maxAttempts}.`;
}

/** `pr.base` from `alm.config.yaml`: the branch a ticket's pull request targets. */
export function prBase(dir: string): string | null {
  let yaml: string;
  try {
    yaml = fs.readFileSync(path.join(dir, "alm.config.yaml"), "utf8");
  } catch {
    return null;
  }
  const block = /^pr:\s*\n((?:[ \t]+.*\n?)*)/m.exec(yaml)?.[1] ?? "";
  const base = /^[ \t]+base:[ \t]*["']?([^\s"'#]+)/m.exec(block)?.[1];
  if (!base) return null;
  try {
    assertSafeGitRef(base, "base");
  } catch {
    return null;
  }
  const exists = (ref: string) =>
    git(dir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0;
  const remote = `origin/${base}`;
  if (!exists(base)) return exists(remote) ? remote : null;
  // Nobody updates their local develop: behind origin it would make every
  // colleague's commit merged from origin look like this ticket's (REQ-148).
  // The local branch only when it already holds origin's, e.g. unpushed work.
  if (!exists(remote)) return base;
  return git(dir, ["merge-base", "--is-ancestor", remote, base]).status === 0 ? base : remote;
}

/**
 * The base a ticket's work is measured against. An explicit `--base` or
 * SPECGATE_BASE first; then `pr.base`, the branch its pull request targets;
 * then the remote's default. With gitflow the remote's default is `main` while
 * the work starts from `develop`: measured from `main`, every commit of
 * `develop` looked like the ticket's (REQ-148).
 */
export function ticketBase(dir: string, given?: string): string | null {
  if (given || process.env.SPECGATE_BASE) return baseFor(dir, given);
  return prBase(dir) ?? baseFor(dir);
}
