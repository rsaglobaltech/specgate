#!/usr/bin/env node
/**
 * The git merge driver for `docs/specs/traceability.md`.
 *
 * ## What git does with this file
 *
 * Git calls a merge driver as a plain process, with three temporary files:
 *
 *     merge-traceability.js %O %A %B
 *                           │  │  └── theirs: the branch being merged in
 *                           │  └───── ours: the current version, AND the file
 *                           │              the driver must overwrite with the
 *                           │              result. Git reads the answer back
 *                           │              out of this path.
 *                           └──────── base: the common ancestor. Git passes an
 *                                     empty file when there is none.
 *
 * Exit 0 means "merged, use %A". A non-zero exit means "conflict" — git keeps
 * whatever %A now contains, which is why the markers are written into it before
 * exiting 1, and marks the path unmerged so `git status` lists it.
 *
 * ## Wiring it up
 *
 * Two halves, and only one of them is committed:
 *
 *   1. `.gitattributes`, in the repository:
 *          docs/specs/traceability.md merge=specgate-matrix
 *
 *   2. git config, which is **local to each clone**:
 *          git config merge.specgate-matrix.name "specgate traceability matrix merge"
 *          git config merge.specgate-matrix.driver "node <path>/merge-traceability.js %O %A %B"
 *
 * `specgate harness init` writes both. A fresh clone has only the first, and git
 * then falls back to its built-in line merge — the conflict you would have had
 * anyway. That fallback is why this can be rolled out gradually: an unconfigured
 * checkout is no worse off, never silently wrong. `specgate doctor` reports the
 * gap rather than leaving it to be discovered mid-merge.
 *
 * The decision itself is not here. `mergeTraceability` is domain, pure, and
 * tested without git; this file is the process boundary and nothing else.
 */

import * as fs from "node:fs";

import { mergeTraceability } from "../packages/core/src/domain/TraceabilityMerge";

export function main(argv: string[]): number {
  const [basePath, oursPath, theirsPath] = argv;
  if (!basePath || !oursPath || !theirsPath) {
    process.stderr.write(
      "merge-traceability: expected the three paths git passes as %O %A %B.\n" +
        "Fix: this is a git merge driver, not a command to run by hand. See\n" +
        "     `specgate harness init`, which registers it.\n"
    );
    return 2;
  }

  // A missing base is normal — git passes an empty file for an unrelated
  // history — so it reads as "no common ancestor" rather than as an error.
  const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
  const result = mergeTraceability(read(basePath), read(oursPath), read(theirsPath));

  fs.writeFileSync(oursPath, result.content, "utf8");

  if (result.conflicts.length === 0) return 0;

  process.stderr.write(
    `traceability.md: ${result.conflicts.length} row(s) need a decision: ` +
      `${result.conflicts.join(", ")}\n` +
      "Fix: open the file, and for each conflict keep exactly one of the two rows,\n" +
      "     deleting the <<<<<<< ======= >>>>>>> lines. Never keep both — a\n" +
      "     duplicated requirement is the corruption this file must not have.\n" +
      "     Then `specgate validate <project>` confirms the result is well formed.\n"
  );
  return 1;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
