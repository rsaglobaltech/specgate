/**
 * The highest id a change uses on any branch (REQ-152).
 *
 * Ids are allocated as max + 1, and a checkout only sees its own branch: two
 * tickets opened on two branches both minted REQ-002 (KAN-13 and KAN-14).
 * `git grep` reads the changes of every local and remote-tracking branch
 * without checking any of them out. Outside a repository, there is nothing
 * to read and the answer is 0.
 */

import { spawnSync } from "node:child_process";

const CHANGES = "docs/specs/changes";
/** Refs per `git grep` call: a long branch list stays under the argument limit. */
const BATCH = 200;

export function highestOnOtherBranches(projectDir: string, prefix: "REQ" | "SCN"): number {
  const refs = spawnSync(
    "git",
    ["-C", projectDir, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"],
    { encoding: "utf8" }
  );
  if (refs.status !== 0) return 0;
  const names = refs.stdout
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r && !r.endsWith("/HEAD"));
  let max = 0;
  for (let i = 0; i < names.length; i += BATCH) {
    const found = spawnSync(
      "git",
      [
        "-C",
        projectDir,
        "grep",
        "-h",
        "-o",
        "-E",
        `${prefix}-[0-9]+`,
        ...names.slice(i, i + BATCH),
        "--",
        CHANGES,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    // 1 is "no match", which is an answer, not a failure.
    if (found.status !== 0) continue;
    for (const m of found.stdout.matchAll(new RegExp(`${prefix}-(\\d+)`, "g"))) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}
