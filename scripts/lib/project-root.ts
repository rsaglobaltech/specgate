/**
 * Tiny shared helper used by every command that operates on a project
 * directory (plan, done, specops sync/diff/add/remove).
 *
 * Auto-detection walks up from cwd looking for spec-driven sentinels:
 *   - spec.md
 *   - .specops.lock
 *   - specops.config.yaml
 *
 * The user can always override with `--project-dir <path>`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const SENTINELS = ["spec.md", ".specops.lock", "specops.config.yaml"];

export function isSpecDrivenDir(dir: string): boolean {
  for (const name of SENTINELS) {
    if (fs.existsSync(path.join(dir, name))) return true;
  }
  return false;
}

// Canonicalise a path through fs.realpathSync so macOS symlinks (e.g. /tmp →
// /private/tmp) don't cause path-equality surprises downstream — both for the
// JSON output of `plan` and for assertions in unit tests. Falls back to the
// input when the path does not yet exist on disk.
function canonical(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

export function findProjectRoot(start: string): string | null {
  let dir = path.resolve(start);
  const { root } = path.parse(dir);
  while (true) {
    if (isSpecDrivenDir(dir)) return canonical(dir);
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

/**
 * Resolve a project directory:
 *   1. If `explicit` was passed (and is not the default "."), use it.
 *   2. Otherwise walk up from cwd looking for sentinels.
 *   3. Fall back to cwd.
 *
 * The returned path is always canonicalised through `fs.realpathSync` when the
 * directory exists, so cross-platform behaviour (notably macOS /tmp symlinks)
 * stays consistent.
 *
 * Pass `requireSentinel: true` to throw when no sentinel is found AND the
 * user did not pass --project-dir.
 */
export function resolveProjectDir(explicit: string, opts?: { requireSentinel?: boolean }): string {
  const passed = explicit && explicit !== "." ? explicit : null;
  if (passed) return canonical(path.resolve(passed));

  const found = findProjectRoot(process.cwd());
  if (found) return found;

  if (opts && opts.requireSentinel) {
    throw new Error(
      "No spec-driven project detected in this directory tree. " +
        "Run from a directory that contains spec.md, .specops.lock, or specops.config.yaml, " +
        "or pass --project-dir explicitly."
    );
  }
  return canonical(path.resolve(process.cwd()));
}

export function findCliRoot(startDir = __dirname): string {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, "..", "..");
}
