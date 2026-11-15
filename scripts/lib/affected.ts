/**
 * `check --affected`: what changed since the base, read from git, and the
 * tests it needs (REQ-510 … REQ-513). The decision is
 * `packages/core/src/domain/AffectedTests.ts`; this reads what it decides on.
 *
 * Paths are project-relative with `/`, as git prints them with `--relative`
 * and as the matrix writes them, on every platform. `-z` keeps a path with a
 * space or an accent as it is.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  type AffectedSelection,
  type ChangedFile,
  type MatrixLinks,
  globalFile,
  inertFile,
  selectAffected,
  specFile,
} from "../../packages/core/src/domain/AffectedTests";
import { isTestByName } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import { matrixScenarios } from "../cli/commands/spec/MatrixCommand";
import { baseRefOf } from "./quality-run";
import { ImportGraph } from "./import-graph";

function git(projectDir: string, args: string[]) {
  return spawnSync("git", ["-c", "core.quotepath=false", "-C", projectDir, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** `a\0b\0` → `["a", "b"]`. */
const nulList = (text: string) =>
  String(text || "")
    .split("\0")
    .filter(Boolean);

/** Every file of the project git knows or would add: tracked and untracked, not ignored. */
export function projectFiles(projectDir: string): Set<string> | null {
  const r = git(projectDir, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (r.status !== 0) return null;
  const deleted = new Set(nulList(git(projectDir, ["ls-files", "-z", "--deleted"]).stdout));
  return new Set(nulList(r.stdout).filter((f) => !deleted.has(f)));
}

/** A path git wrote in C quotes — `"caf\303\251.md"` — as it is. */
export function unquoteGitPath(text: string): string {
  if (!text.startsWith('"') || !text.endsWith('"')) return text;
  const bytes: number[] = [];
  const body = text.slice(1, -1);
  const simple: Record<string, number> = { n: 10, t: 9, r: 13, '"': 34, "\\": 92, a: 7, b: 8 };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") {
      bytes.push(...Buffer.from(ch, "utf8"));
      continue;
    }
    const next = body[i + 1];
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(simple[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** The lines each file's hunks wrote, and the text they removed or wrote, from `git diff -U0`. */
export function parseZeroContextDiff(
  patch: string
): Map<string, { lines: number[]; text: string[] }> {
  const out = new Map<string, { lines: number[]; text: string[] }>();
  let minus = "";
  let current: { lines: number[]; text: string[] } | null = null;
  let inHunk = false;
  const pathOf = (header: string) => {
    const raw = unquoteGitPath(header.trim());
    return raw.replace(/^[ab]\//, "");
  };
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      current = null;
      minus = "";
      continue;
    }
    if (!inHunk && line.startsWith("--- ")) {
      minus = line.slice(4);
      continue;
    }
    if (!inHunk && line.startsWith("+++ ")) {
      const plus = line.slice(4);
      const file = plus.trim() === "/dev/null" ? pathOf(minus) : pathOf(plus);
      current = out.get(file) || { lines: [], text: [] };
      out.set(file, current);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      inHunk = true;
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      if (count === 0) {
        // A removal sits between line `start` and the next: both sections count.
        current.lines.push(Math.max(start, 1), start + 1);
      } else {
        for (let n = start; n < start + count; n++) current.lines.push(n);
      }
      continue;
    }
    if (inHunk && current && (line.startsWith("+") || line.startsWith("-"))) {
      current.text.push(line.slice(1));
    }
  }
  return out;
}

export type ChangesSince =
  | { ok: true; base: { ref: string; commit: string }; changed: ChangedFile[] }
  | { ok: false; reason: string };

/** What changed since the base, the working tree and untracked files included. */
export function changesSince(projectDir: string, explicitBase = ""): ChangesSince {
  if (git(projectDir, ["rev-parse", "--is-inside-work-tree"]).status !== 0) {
    return { ok: false, reason: "this project is not in a git repository" };
  }
  const base = baseRefOf(projectDir, explicitBase);
  if (!base || (explicitBase && base.ref !== explicitBase)) {
    return {
      ok: false,
      reason: explicitBase
        ? `the base ${explicitBase} shares no history with HEAD here`
        : "no base branch was found to compare with (pass --base <ref>)",
    };
  }
  const diff = git(projectDir, [
    "diff",
    "-z",
    "--no-renames",
    "--no-ext-diff",
    "--name-status",
    "--relative",
    base.commit,
    "--",
  ]);
  if (diff.status !== 0) {
    return { ok: false, reason: `git could not compare with ${base.ref}` };
  }
  const changed = new Map<string, ChangedFile>();
  const fields = nulList(diff.stdout);
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i][0];
    const file = fields[i + 1];
    changed.set(file, {
      path: file,
      kind: status === "A" ? "added" : status === "D" ? "deleted" : "modified",
      lines: [],
      text: "",
    });
  }
  for (const file of nulList(
    git(projectDir, ["ls-files", "-z", "--others", "--exclude-standard"]).stdout
  )) {
    changed.set(file, { path: file, kind: "added", lines: null, text: "" });
  }

  // The changed lines of spec and feature files: which requirement they are in.
  const textual = [...changed.values()]
    .filter((f) => f.lines !== null && (specFile(f.path) || /\.feature$/i.test(f.path)))
    .map((f) => f.path);
  for (let i = 0; i < textual.length; i += 100) {
    const r = git(projectDir, [
      "diff",
      "-U0",
      "--no-renames",
      "--no-color",
      "--no-ext-diff",
      "--relative",
      base.commit,
      "--",
      ...textual.slice(i, i + 100),
    ]);
    for (const [file, hunks] of parseZeroContextDiff(r.stdout || "")) {
      const f = changed.get(file);
      if (!f) continue;
      f.lines = hunks.lines;
      f.text = hunks.text.join("\n");
    }
  }
  return {
    ok: true,
    base,
    changed: [...changed.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/** What `check --affected` decided, with what it decided from. */
export interface AffectedPlan extends AffectedSelection {
  /** The ref compared with, or null when none could be. */
  base: string | null;
  /** The files that changed since it, project-relative. */
  changed: string[];
  /** The matrix rows the decision read, for the cache's dependencies. */
  rows: MatrixLinks[];
  /** The import graph, when one was read. */
  graph: ImportGraph | null;
  files: Set<string> | null;
}

/** Which tests `check --affected` runs here, or the whole suite and why. */
export function planAffected(
  projectDir: string,
  opts: { base?: string; fullOn?: readonly string[] } = {}
): AffectedPlan {
  const since = changesSince(projectDir, opts.base || "");
  if (!since.ok) {
    return {
      mode: "full",
      reason: since.reason,
      cause: "no-base",
      requirements: [],
      tests: [],
      base: null,
      changed: [],
      rows: [],
      graph: null,
      files: null,
    };
  }
  const rows: MatrixLinks[] = matrixScenarios(projectDir).map((r) => ({
    requirement: r.requirement,
    feature: r.feature,
    tests: r.tests,
    code: r.code,
  }));
  const texts = new Map<string, string>();
  for (const f of since.changed) {
    if (f.kind === "deleted" || !(specFile(f.path) || /\.feature$/i.test(f.path))) continue;
    try {
      texts.set(f.path, fs.readFileSync(path.join(projectDir, ...f.path.split("/")), "utf8"));
    } catch {
      /* gone since git listed it */
    }
  }

  // The imports, only when a changed file is code the matrix may not link.
  const fullOn = opts.fullOn || [];
  const needsGraph = since.changed.some(
    (f) =>
      !specFile(f.path) &&
      !/\.feature$/i.test(f.path) &&
      !globalFile(f.path, fullOn) &&
      !inertFile(f.path)
  );
  const files = needsGraph ? projectFiles(projectDir) : null;
  const graph = files ? new ImportGraph(projectDir, files) : null;
  const linkedTests = new Set(rows.flatMap((r) => r.tests));
  const allTests = files
    ? [...files].filter((f) => isTestByName(f) || linkedTests.has(f)).sort()
    : [];
  const importedBy = graph ? graph.importedBy(allTests) : new Map<string, string[]>();

  const selection = selectAffected({
    changed: since.changed,
    rows,
    texts,
    isTest: isTestByName,
    exists: (rel) => fs.existsSync(path.join(projectDir, ...rel.split("/"))),
    importedBy,
    fullOn,
  });
  return {
    ...selection,
    base: since.base.ref,
    changed: since.changed.map((f) => f.path),
    rows,
    graph,
    files,
  };
}
