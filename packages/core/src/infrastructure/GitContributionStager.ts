/**
 * Staging a contribution as a git branch.
 *
 * Clones the pack repository, branches from the version the project actually
 * consumed — so the diff a maintainer sees is against the code the
 * contribution was written on — writes the files, and commits. What those
 * files say is domain; see `domain/PackContribution`.
 */

import * as fs from "node:fs";
import { assertSafeGitRef, assertSafeGitRepo } from "../domain/GitSafety";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

function git(args: string[], cwd: string | undefined): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw new Error(`git ${args[0]} failed to run: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/**
 * Clone the pack, branch, write the contribution, commit. Nothing leaves the
 * machine — the caller is handed a branch and the command that would publish it.
 */
/** One file of a contribution; the first one's `message` becomes the commit message. */
export interface ContributionFile {
  file: string;
  contents: string;
  message?: string;
}

export function stageContribution(
  repo: string,
  version: string,
  branch: string,
  files: ContributionFile[],
  outDir?: string | null
): { dir: string; branch: string; files: string[] } {
  const dir = outDir || fs.mkdtempSync(path.join(os.tmpdir(), "specgate-contribute-"));
  fs.mkdirSync(dir, { recursive: true });

  // See `GitSafety`: `--` stops git reading a leading `-` as an option, and the
  // check stops `ext::`, which a separator cannot.
  git(["clone", "--quiet", "--", assertSafeGitRepo(repo, "pack repository"), dir], undefined);
  // Branch from the version the project actually consumed, so the diff a
  // maintainer sees is against the code the contribution was written on.
  try {
    git(["checkout", "--quiet", assertSafeGitRef(version, "pack version"), "--"], dir);
  } catch {
    // A lockfile can pin a commit that is not a branch tip; detached HEAD is fine.
  }
  git(["checkout", "--quiet", "-b", branch], dir);

  const written: string[] = [];
  for (const f of files) {
    const full = path.join(dir, f.file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents, "utf8");
    written.push(f.file);
  }

  git(["add", "--", ...written], dir);
  git(
    [
      "-c",
      "user.name=specgate",
      "-c",
      "user.email=specgate@localhost",
      "commit",
      "--quiet",
      "-m",
      files[0].message || "Contribute requirements from a consuming project",
    ],
    dir
  );

  return { dir, branch, files: written };
}

// ── Command ───────────────────────────────────────────────────────────────────
