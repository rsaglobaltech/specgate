/**
 * Packs that distribute changes.
 *
 * A pack can ship a `changes/` directory alongside its templates. On `sync`
 * those land in the project as **proposed** changes — never applied, never
 * archived. The consuming team reviews and archives them like any other
 * change, which is what keeps the pack from silently rewriting a project's
 * specification.
 *
 * It also gives the pack a semantic changelog: `changes/archive/` upstream is
 * the record of what each version actually decided, in requirements rather
 * than in commit messages.
 *
 * Deliberately additive and non-destructive: an existing change folder in the
 * project is never touched. A pack cannot clobber local work in flight.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { paths } from "./ChangeWorkspace";

function copyTree(from: string, to: string): string[] {
  const written: string[] = [];
  const walk = (src: string, dest: string) => {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) walk(s, d);
      else if (entry.isFile()) {
        fs.copyFileSync(s, d);
        written.push(d);
      }
    }
  };
  walk(from, to);
  return written;
}

/**
 * Deposit a pack's `changes/` into the project as proposed changes.
 *
 * @param packRoot   the resolved pack repository root
 * @param packId     e.g. `parking-management/backend`
 * @returns { deposited, skipped } — change ids, not file paths
 */
export function depositPackChanges(
  projectDir: string,
  packRoot: string,
  packId: string,
  opts?: { dryRun?: boolean }
): { deposited: string[]; skipped: string[] } {
  const o = opts || {};
  const source = path.join(packRoot, packId, "changes");
  const deposited: string[] = [];
  const skipped: string[] = [];

  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    return { deposited, skipped };
  }

  const p = paths(projectDir);

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // A pack's own archive is history, not a proposal — never deposited.
    if (!entry.isDirectory() || entry.name === "archive") continue;

    const target = p.change(entry.name);
    if (fs.existsSync(target)) {
      // Local work in flight under the same id always wins.
      skipped.push(entry.name);
      continue;
    }
    if (!o.dryRun) copyTree(path.join(source, entry.name), target);
    deposited.push(entry.name);
  }

  return { deposited, skipped };
}
