import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { requirementsIn } from "../../packages/core/src/domain/DerivedMatrix";
import { withoutFences } from "../../packages/core/src/domain/QuotedText";
import { assertSafeGitRef } from "../../packages/core/src/domain/GitSafety";
import { highestReservedReq } from "../../packages/core/src/infrastructure/ChangeWorkspace";

/**
 * Requirement ids checked against the base branch (ADR-0036).
 *
 * Every branch allocates ids as max+1 over its own checkout, so two branches
 * can both hand out REQ-120. Renumbering after the fact is refused on purpose
 * (an id is in tests, tags and commits by then), so the collision is caught
 * before the merge instead: the same id with a different title on the base.
 */

export interface IdCollision {
  id: string;
  here: string;
  base: string;
}

export type BaseIdCheck =
  | { state: "skipped"; reason: string }
  | { state: "checked"; base: string; collisions: IdCollision[]; nextFree: string };

/** The part of a delta that declares requirements: ADDED and MODIFIED, never REMOVED. */
function declaringPart(delta: string): string {
  return delta.replace(/^## REMOVED Requirements[\s\S]*?(?=^## |(?![\s\S]))/gm, "");
}

/** `relPath → source` for every spec file that declares requirements. */
type Reader = { list(): string[]; read(rel: string): string | null };

function titles(reader: Reader): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of reader.list()) {
    const source = reader.read(rel);
    if (source === null) continue;
    const text = rel.startsWith("docs/specs/changes/") ? declaringPart(source) : source;
    for (const req of requirementsIn(withoutFences(text))) {
      if (/^REQ-\d+$/.test(req.id) && !out.has(req.id)) out.set(req.id, req.title);
    }
  }
  return out;
}

const SPEC_FILE = (rel: string) =>
  rel === "spec.md" ||
  /^docs\/specs\/capabilities\/.+\/spec\.md$/.test(rel) ||
  /^docs\/specs\/changes\/(?!archive\/)[^/]+\/specs\/.+\/spec\.md$/.test(rel);

function walk(root: string, rel: string, out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, child, out);
    else if (SPEC_FILE(child)) out.push(child);
  }
}

function workingTree(projectDir: string): Reader {
  return {
    list() {
      const files: string[] = [];
      if (fs.existsSync(path.join(projectDir, "spec.md"))) files.push("spec.md");
      walk(projectDir, "docs/specs", files);
      return files;
    },
    read(rel) {
      try {
        return fs.readFileSync(path.join(projectDir, rel), "utf8");
      } catch {
        return null;
      }
    },
  };
}

function git(projectDir: string, args: string[]) {
  return spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
}

/** The project's path inside its repository, `""` at the root. */
function prefixIn(projectDir: string): string | null {
  const r = git(projectDir, ["rev-parse", "--show-prefix"]);
  return r.status === 0 ? r.stdout.trim().replace(/\/$/, "") : null;
}

function atRef(projectDir: string, ref: string, prefix: string): Reader {
  const p = (rel: string) => (prefix ? `${prefix}/${rel}` : rel);
  return {
    list() {
      const r = git(projectDir, [
        "ls-tree",
        "-r",
        "--name-only",
        ref,
        "--",
        p("spec.md"),
        p("docs/specs"),
      ]);
      if (r.status !== 0) return [];
      return r.stdout
        .split("\n")
        .filter(Boolean)
        .map((f) => (prefix ? f.slice(prefix.length + 1) : f))
        .filter(SPEC_FILE);
    },
    read(rel) {
      const r = git(projectDir, ["show", `${ref}:${p(rel)}`]);
      return r.status === 0 ? r.stdout : null;
    },
  };
}

/** `--base`, then SPECGATE_BASE, then the remote's default branch. */
export function resolveBase(projectDir: string, given?: string): string | null {
  const wanted = given || process.env.SPECGATE_BASE || "";
  if (wanted) return wanted;
  const head = git(projectDir, ["rev-parse", "--abbrev-ref", "origin/HEAD"]);
  return head.status === 0 && head.stdout.trim() !== "origin/HEAD" ? head.stdout.trim() : null;
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

export function checkIdsAgainstBase(projectDir: string, given?: string): BaseIdCheck {
  const prefix = prefixIn(projectDir);
  if (prefix === null) return { state: "skipped", reason: "not a git repository" };
  const base = resolveBase(projectDir, given);
  if (!base) return { state: "skipped", reason: "no base branch (pass --base <branch>)" };
  try {
    assertSafeGitRef(base);
  } catch {
    return { state: "skipped", reason: `'${base}' is not a usable git ref` };
  }
  if (git(projectDir, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).status !== 0) {
    return { state: "skipped", reason: `base '${base}' is not available here (fetch it)` };
  }

  const here = titles(workingTree(projectDir));
  const there = titles(atRef(projectDir, base, prefix));
  // Only ids this branch introduced can collide. One both sides already held
  // where they last met is concurrent editing, not a reused id (REQ-120):
  // renumbering it would break every test that names it.
  const met = git(projectDir, ["merge-base", "HEAD", base]);
  const inherited =
    met.status === 0 ? titles(atRef(projectDir, met.stdout.trim(), prefix)) : new Map();
  const collisions: IdCollision[] = [];
  for (const [id, title] of here) {
    if (inherited.has(id)) continue;
    const other = there.get(id);
    if (other !== undefined && norm(other) !== norm(title)) {
      collisions.push({ id, here: title, base: other });
    }
  }
  const number = (id: string) => Number(id.slice(4)) || 0;
  const highest = Math.max(highestReservedReq(projectDir), ...[...there.keys()].map(number), 0);
  return {
    state: "checked",
    base,
    collisions: collisions.sort((a, b) => number(a.id) - number(b.id)),
    nextFree: `REQ-${String(highest + 1).padStart(3, "0")}`,
  };
}
