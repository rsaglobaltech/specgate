#!/usr/bin/env node
/**
 * The git merge driver for `docs/specs/capabilities/<x>/spec.md` (REQ-166).
 *
 * Same contract as `merge-traceability.ts`: git passes %O %A %B, the result is
 * written to %A, and a non-zero exit marks the path unmerged with the markers
 * left in it. `specgate harness init` registers it as `specgate-spec`.
 *
 * With one change per ticket, two branches often archive into the same
 * capability. Git merges by lines, so two different requirements added at the
 * end of the file conflict, and a capability new on both branches is an add/add
 * conflict on the whole file. This merges by requirement instead: different
 * requirements are united, and only a requirement both sides rewrote differently
 * is left to a person — the case `change_overlap` warned about before either
 * branch was merged.
 *
 * The decision is `mergeCapabilitySpec`, pure and tested without git; a file
 * that does not parse as a capability spec goes to git's own line merge.
 */

import * as fs from "node:fs";
import { spawnSync } from "node:child_process";

import { mergeCapabilitySpec } from "../packages/core/src/domain/CapabilitySpecMerge";

export function main(argv: string[]): number {
  const [basePath, oursPath, theirsPath] = argv;
  if (!basePath || !oursPath || !theirsPath) {
    process.stderr.write(
      "merge-capability-spec: expected the three paths git passes as %O %A %B.\n" +
        "Fix: this is a git merge driver, not a command to run by hand. See\n" +
        "     `specgate harness init`, which registers it.\n"
    );
    return 2;
  }

  const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
  const result = mergeCapabilitySpec(read(basePath), read(oursPath), read(theirsPath));

  if (result.unparsable) {
    // Not ours to judge: the same line merge git would have done without us.
    const lines = spawnSync(
      "git",
      ["merge-file", "-L", "ours", "-L", "base", "-L", "theirs", oursPath, basePath, theirsPath],
      { encoding: "utf8" }
    );
    return lines.status === 0 ? 0 : 1;
  }

  fs.writeFileSync(oursPath, result.content, "utf8");
  if (result.conflicts.length === 0) return 0;

  process.stderr.write(
    `capability spec: ${result.conflicts.length} requirement(s) rewritten differently on both sides: ` +
      `${result.conflicts.join(", ")}\n` +
      "Fix: open the file and, for each conflict, write the requirement as it should be\n" +
      "     once both changes hold, deleting the <<<<<<< ======= >>>>>>> lines.\n" +
      "     Then `specgate check` confirms the specs and their tests still agree.\n"
  );
  return 1;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
