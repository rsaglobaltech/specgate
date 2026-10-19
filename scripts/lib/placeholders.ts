// specgate:allow-placeholders — this module is the {{VAR}} scanner itself.

/**
 * The one unresolved-placeholder scan.
 *
 * `validate` and `doctor` each had their own copy, and they drifted: fixing
 * `validate` to skip dependency trees, template files and documentation that
 * quotes the syntax left `doctor` reporting 64 errors on this very repository,
 * every one of them a false positive. Two checkers answering the same question
 * differently is worse than one imperfect checker.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export const PLACEHOLDER_RE = /\{\{[A-Z_][A-Z0-9_]*\}\}/;

/**
 * Syntax-neutral on purpose: put it in whatever comment form the file uses —
 * `<!-- specgate:allow-placeholders -->` in markdown, `// specgate:allow-placeholders`
 * in code. Same convention as the `specgate:trace` marker.
 */
export const PLACEHOLDER_ALLOW_RE = /specgate:allow-placeholders/;

/**
 * Never scanned: dependency trees and build output are not the project's specs,
 * and template libraries inside node_modules are full of {{...}} tokens that
 * would report as unresolved placeholders in any project with dependencies
 * installed.
 */
export const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  // Generated reports — mutation HTML embeds mutated source, template tokens
  // and all.
  "reports",
  "vendor",
  ".git",
  ".next",
  ".gradle",
  ".specops",
]);

/**
 * Paths git is told to ignore, asked of git itself.
 *
 * SKIP_DIRS is a fixed list and cannot know what a given project ignores. This
 * repository generates a `book/` directory that is gitignored and full of
 * `{{VAR}}` — because it documents the placeholder syntax — and `validate`
 * reported every one of them as an unresolved placeholder. A project's own
 * ignore file already states what is not source; asking it is more honest than
 * growing the list one report at a time.
 *
 * Best-effort: no git, no repository, or a git that errors means an empty set
 * and the fixed list alone. A scan that refuses to run without git would be a
 * worse failure than the one it prevents.
 */
function gitIgnoredNames(dir: string): Set<string> {
  const ignored = new Set<string>();
  try {
    const r = spawnSync(
      "git",
      ["-C", dir, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory"],
      {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
      }
    );
    if (r.status !== 0 || !r.stdout) return ignored;
    for (const line of r.stdout.split("\n")) {
      const trimmed = line.trim().replace(/\/$/, "");
      if (trimmed) ignored.add(path.resolve(dir, trimmed));
    }
  } catch {
    // git is optional here — see the docblock.
  }
  return ignored;
}

export function walk(dir: string, ignored: Set<string> | null = null): string[] {
  const skipIgnored = ignored || gitIgnoredNames(dir);
  const out: string[] = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (skipIgnored.has(path.resolve(full))) continue;
    if (entry.isDirectory()) out.push(...walk(full, skipIgnored));
    else out.push(full);
  }
  return out;
}

/** True when the file is exempt for a stated reason, rather than by accident. */
export function isExempt(file: string, content: string): boolean {
  // A .tpl file is unrendered by definition — its {{VAR}} tokens are the point,
  // not a defect. Generated projects never contain .tpl files, so this does not
  // weaken the check for the projects the gate is aimed at; it only stops it
  // firing on template and pack repositories.
  if (file.endsWith(".tpl")) return true;
  // Documentation that explains the template syntax has to be able to quote it.
  // An explicit per-file opt-out keeps that honest: you have to say so.
  return PLACEHOLDER_ALLOW_RE.test(content);
}

/**
 * Every file under `rootDir` that still carries an unresolved `{{TOKEN}}`,
 * as paths relative to `rootDir` with POSIX separators.
 */
export function findUnresolvedPlaceholders(rootDir: string): string[] {
  const offenders: string[] = [];
  for (const file of walk(rootDir)) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (isExempt(file, content)) continue;
    if (PLACEHOLDER_RE.test(content)) {
      offenders.push(path.relative(rootDir, file).split(path.sep).join("/"));
    }
  }
  return offenders;
}

/** The distinct variable names still unresolved, for an actionable message. */
export function missingVariables(rootDir: string, offenders: readonly string[]): string[] {
  const names = new Set<string>();
  for (const rel of offenders) {
    let content;
    try {
      content = fs.readFileSync(path.join(rootDir, rel), "utf8");
    } catch {
      continue;
    }
    for (const m of content.matchAll(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g)) names.add(m[1]);
  }
  return [...names].sort();
}
