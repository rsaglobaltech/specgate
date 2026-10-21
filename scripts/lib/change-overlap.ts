/**
 * Two open changes that rewrite the same requirement (REQ-160).
 *
 * With one change per ticket, two developers can each modify REQ-012 on their
 * own branch. Reserved ids do not help — the requirement already exists — and
 * git only notices when the text conflicts: two rewrites that touch different
 * lines merge cleanly, and the second silently replaces the first. So the
 * changes are read where they are: the working tree, and every local and
 * remote-tracking branch not yet merged into this one (`git grep`, no
 * checkout).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { warning } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";

const CHANGES = "docs/specs/changes";
/** Refs per `git grep` call: a long branch list stays under the argument limit. */
const BATCH = 200;
const SECTION = /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements/;
const REQUIREMENT = /^###\s+Requirement:\s+(REQ-[\w.]+)/;
/** A path inside an open change's delta, with the change's id. */
const OPEN_DELTA = /^docs\/specs\/changes\/([^/]+)\/specs\/.+\.md$/;

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const isOpen = (changeId: string) => changeId !== "archive" && !changeId.startsWith(".");

/** What a delta does to requirements: the ones it rewrites, and the ids it adds. */
interface Touches {
  rewrites: Set<string>;
  adds: Set<string>;
}

const touches = (): Touches => ({ rewrites: new Set(), adds: new Set() });

function read(lines: string[], into: Touches): void {
  let section = "";
  for (const line of lines) {
    const s = SECTION.exec(line);
    if (s) {
      section = s[1];
      continue;
    }
    const r = REQUIREMENT.exec(line);
    if (!r) continue;
    if (section === "MODIFIED" || section === "REMOVED") into.rewrites.add(r[1]);
    else if (section === "ADDED") into.adds.add(r[1]);
  }
}

const empty = (t: Touches) => t.rewrites.size === 0 && t.adds.size === 0;

function deltaFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? deltaFiles(full) : e.name.endsWith(".md") ? [full] : [];
  });
}

/** Open change → what it does to requirements, in the working tree. */
function localChanges(projectDir: string): Map<string, Touches> {
  const out = new Map<string, Touches>();
  const changes = path.join(projectDir, CHANGES);
  if (!fs.existsSync(changes)) return out;
  for (const e of fs.readdirSync(changes, { withFileTypes: true })) {
    if (!e.isDirectory() || !isOpen(e.name)) continue;
    const t = touches();
    for (const file of deltaFiles(path.join(changes, e.name, "specs"))) {
      read(fs.readFileSync(file, "utf8").split("\n"), t);
    }
    if (!empty(t)) out.set(e.name, t);
  }
  return out;
}

const shortRef = (ref: string) => ref.replace(/^refs\/(heads|remotes)\//, "");

/** Branches not yet merged into HEAD: the ones whose open changes can still collide. */
function unmergedRefs(projectDir: string): string[] {
  const current = git(projectDir, ["symbolic-ref", "-q", "HEAD"]).stdout.trim();
  const refs = git(projectDir, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/heads",
    "refs/remotes",
  ]);
  if (refs.status !== 0) return [];
  return refs.stdout
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r && r !== current && !r.endsWith("/HEAD"))
    .filter((r) => git(projectDir, ["merge-base", "--is-ancestor", r, "HEAD"]).status !== 0);
}

/** `branch → change → what it does`, read from every unmerged branch. */
function branchChanges(projectDir: string): Map<string, Map<string, Touches>> {
  const out = new Map<string, Map<string, Touches>>();
  const refs = unmergedRefs(projectDir);
  for (let i = 0; i < refs.length; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const found = git(projectDir, [
      "grep",
      "-n",
      "-E",
      "^(## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements|### +Requirement: +REQ-)",
      ...batch,
      "--",
      CHANGES,
    ]);
    // 1 is "no match", which is an answer.
    if (found.status !== 0) continue;
    const byFile = new Map<string, string[]>();
    for (const line of found.stdout.split("\n")) {
      const ref = batch.find((r) => line.startsWith(`${r}:`));
      if (!ref) continue;
      const rest = line.slice(ref.length + 1);
      const m = /^([^:]+):\d+:(.*)$/.exec(rest);
      if (!m) continue;
      const key = `${ref}\u0000${m[1]}`;
      if (!byFile.has(key)) byFile.set(key, []);
      byFile.get(key)!.push(m[2]);
    }
    for (const [key, lines] of byFile) {
      const [ref, file] = key.split("\u0000");
      const change = OPEN_DELTA.exec(file)?.[1];
      if (!change || !isOpen(change)) continue;
      const branch = shortRef(ref);
      if (!out.has(branch)) out.set(branch, new Map());
      const changes = out.get(branch)!;
      if (!changes.has(change)) changes.set(change, touches());
      read(lines, changes.get(change)!);
    }
  }
  return out;
}

const CLASH_FIX =
  "Two requirements cannot share an id. Renumber the one whose branch is not merged yet: " +
  "a new id above both, in its delta and in the tests that name it.";

const FIX =
  "Agree which goes first. Merge that one, bring it into the other branch, and draft the second " +
  "change again over the requirement as merged, so neither rewrite silently replaces the other.";

/**
 * `change_overlap` for each requirement an open change here rewrites that
 * another open change also rewrites — on this branch or on an unmerged one —
 * and `change_id_clash` for each id it adds that a change on an unmerged
 * branch adds too.
 */
export function changeOverlaps(projectDir: string): Diagnostic[] {
  const local = localChanges(projectDir);
  if (local.size === 0) return [];
  const out: Diagnostic[] = [];
  const said = new Set<string>();
  const clash = (req: string, mine: string, other: string, where: string) => {
    const key = `clash\u0000${req}\u0000${other}`;
    if (said.has(key)) return;
    said.add(key);
    out.push(
      warning(
        "change_id_clash",
        `${req} is added by ${mine} and also by change ${other} ${where}.`,
        {
          target: req,
          fix: CLASH_FIX,
        }
      )
    );
  };
  const say = (req: string, mine: string, other: string, where: string) => {
    const key = `${req}\u0000${[mine, other].sort().join("\u0000")}`;
    if (said.has(key)) return;
    said.add(key);
    out.push(
      warning(
        "change_overlap",
        `${req} is rewritten by ${mine} and also by change ${other} ${where}.`,
        { target: req, fix: FIX }
      )
    );
  };

  const ids = [...local.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (const req of local.get(ids[i])!.rewrites) {
        if (local.get(ids[j])!.rewrites.has(req)) say(req, ids[i], ids[j], "on this branch");
      }
    }
  }

  for (const [branch, changes] of branchChanges(projectDir)) {
    for (const [other, theirs] of changes) {
      // The same change on its own pushed branch, or an older copy of it.
      if (local.has(other)) continue;
      for (const [mine, t] of local) {
        for (const req of t.rewrites)
          if (theirs.rewrites.has(req)) say(req, mine, other, `on ${branch}`);
        // Reserved on two clones before either fetched the other (REQ-164).
        for (const req of t.adds) if (theirs.adds.has(req)) clash(req, mine, other, `on ${branch}`);
      }
    }
  }
  return out;
}
