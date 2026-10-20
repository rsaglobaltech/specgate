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
    ? `${key} ${requirement}: implement via specgate harness`
    : `feat(${requirement}): implement via specgate harness`;
  return `${subject}\n\nAttempt ${attempt}/${maxAttempts}.`;
}
