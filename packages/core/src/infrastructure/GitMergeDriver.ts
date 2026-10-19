/**
 * Three-way merge primitive for `specops sync`.
 *
 * Given the common ancestor (`base` — what the pack rendered last sync),
 * the working copy (`local` — what is in the project now, possibly
 * hand-edited) and the new render (`incoming` — what the pack renders at
 * the target version), produce a merged result.
 *
 * Delegates to `git merge-file`, which is always available wherever the
 * CLI runs (the project is a git repo by construction). `git merge-file`
 * exit codes: 0 = clean, N>0 = number of conflict regions, <0 = error.
 *
 * Pure-ish: writes only to a throwaway temp dir, never to the project.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export const DEFAULT_LABELS = {
  local: "local (your edits)",
  base: "base (last sync)",
  incoming: "incoming (new pack version)",
};

/** What a three-way merge produced, and how many regions it could not settle. */
export interface MergeResult {
  merged: string;
  conflict: boolean;
  conflicts: number;
}

export function threeWayMerge(
  base: string,
  local: string,
  incoming: string,
  labels: Partial<typeof DEFAULT_LABELS> = {}
): MergeResult {
  const lbl = { ...DEFAULT_LABELS, ...labels };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specops-merge-"));
  try {
    const localPath = path.join(tmpDir, "local");
    const basePath = path.join(tmpDir, "base");
    const incomingPath = path.join(tmpDir, "incoming");
    fs.writeFileSync(localPath, local, "utf8");
    fs.writeFileSync(basePath, base, "utf8");
    fs.writeFileSync(incomingPath, incoming, "utf8");

    const result = spawnSync(
      "git",
      [
        "merge-file",
        "-p",
        "-L",
        lbl.local,
        "-L",
        lbl.base,
        "-L",
        lbl.incoming,
        localPath,
        basePath,
        incomingPath,
      ],
      { encoding: "utf8" }
    );

    if (result.error) {
      throw new Error(`git merge-file failed to run: ${result.error.message}`);
    }
    if (typeof result.status !== "number" || result.status < 0) {
      throw new Error(`git merge-file errored: ${result.stderr || "unknown error"}`);
    }

    return {
      merged: result.stdout,
      conflict: result.status > 0,
      conflicts: result.status,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
