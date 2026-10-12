#!/usr/bin/env node
/**
 * `specops remove <pack-id>` — drop a pack entry from `.specops.lock`.
 *
 * By design this DOES NOT delete generated files (would be too easy to
 * destroy hand-edited tests). Run `specgate specops sync` afterwards if you
 * want to regenerate the rest of the lockfile without the removed pack.
 *
 *   specgate specops remove parking-management/backend
 */

import { resolveProjectDir } from "../lib/project-root";
import { DiskLockfileRepository } from "../../packages/core/src/infrastructure/DiskLockfileRepository";
import { RemovePackUseCase } from "../../packages/core/src/application/RemovePackUseCase";
import { Lockfile } from "../../packages/core/src/domain/Lockfile";
import { BaseCommand } from "../lib/command";

import { c } from "../lib/ui";

/** Parsed command-line options for this command. */
export interface SpecopsRemoveOptions {
  packId: string | null;
  projectDir: string;
  dryRun: boolean;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}➖ specops remove${c.reset}  ${c.dim}— drop a pack from .specops.lock${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate specops remove${c.reset} <pack-id> [--project-dir <path>] [--dry-run]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset}  ${c.dim}Project root (auto-detected from cwd if omitted).${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}             ${c.dim}Show what would be removed; touch nothing.${c.reset}\n` +
      `    ${c.green}-h, --help${c.reset}            ${c.dim}Show this help.${c.reset}\n\n` +
      `  ${c.bold}NOTES${c.reset}\n` +
      `    ${c.dim}Generated files are NOT deleted automatically — review with \`git status\` and remove anything you no longer want.${c.reset}\n\n`
  );
}

export function parseArgs(argv) {
  const opts: SpecopsRemoveOptions = { packId: null, projectDir: ".", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    } else if (!opts.packId) {
      opts.packId = a;
    } else {
      process.stderr.write(`Unexpected positional argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

export class RemoveCommand extends BaseCommand {
  public execute() {
    const opts = parseArgs(this.args);
    if (!opts.packId) {
      process.stderr.write(
        `${c.red}✖${c.reset}  pack-id is required (e.g. parking-management/backend).\n`
      );
      usage();
      process.exit(2);
    }

    let projectDir;
    try {
      projectDir = resolveProjectDir(opts.projectDir, { requireSentinel: true });
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }

    const repo = new DiskLockfileRepository(projectDir);
    const useCase = new RemovePackUseCase(repo);
    const result = useCase.execute(opts.packId, { dryRun: opts.dryRun });

    if (!result.ok) {
      process.stderr.write(`${c.red}✖${c.reset}  ${result.message}\n`);
      process.exit(1);
    }

    if (opts.dryRun) {
      process.stdout.write(
        `${c.yellow}…${c.reset}  [dry-run] would remove ${c.bold}${opts.packId}${c.reset} from ${Lockfile.FILENAME} (${result.removedCount} entry).\n`
      );
      process.exit(0);
    }

    process.stdout.write(
      `${c.green}✔${c.reset}  Removed ${c.bold}${opts.packId}${c.reset} from ${Lockfile.FILENAME} (${result.removedCount} entry).\n` +
        `${c.dim}   Generated files were not deleted. Inspect with \`git status\` and remove anything unwanted.${c.reset}\n`
    );
    process.exit(0);
  }
}

if (require.main === module) new RemoveCommand(process.argv.slice(2)).execute();
