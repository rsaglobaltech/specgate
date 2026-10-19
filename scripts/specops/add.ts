#!/usr/bin/env node
/**
 * `specops add` — thin npm-install-style wrapper around `expand`.
 *
 *   specgate specops add --pack-repo https://github.com/acme/x.git \
 *                    --pack-version v0.1.0 --pack backend \
 *                    --var PROJECT_NAME=Foo --var PROJECT_SLUG=foo
 *
 * Delegates the actual work to `expand_domain_pack.js`, which already
 * writes/updates `.specops.lock` and persists the vars. The reason this
 * command exists is ergonomic:
 *
 *   1. Project root is auto-detected from cwd (no need for --project-dir).
 *   2. Mental model aligns with `npm install` / `specops remove`.
 *   3. Pre-flight checks the arguments the user *almost certainly* needs.
 */

import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../lib/command";

import { resolveProjectDir } from "../lib/project-root";
import { errorMessage } from "../lib/diagnostics";

const EXPAND_SCRIPT = path.join(__dirname, "..", "expand_domain_pack.js");

import { c } from "../lib/ui";

/** Parsed command-line options for this command. */
export interface SpecopsAddOptions {
  packRepo: string;
  packRoot: string;
  packVersion: string;
  pack: string;
  projectDir: string;
  cacheDir: string;
  vars: string[];
  dryRun: boolean;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}➕ specops add${c.reset}  ${c.dim}— add a pack to this project${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate specops add${c.reset} --pack-repo <url> --pack-version <tag> --pack <pack-id> [--var K=V]... [--project-dir <path>] [--cache-dir <path>] [--dry-run]\n` +
      `    ${c.cyan}specgate specops add${c.reset} --pack-root <path> --pack <pack-id> [--var K=V]... [--project-dir <path>]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--pack-repo <url>${c.reset}      ${c.dim}Git URL of the pack repository.${c.reset}\n` +
      `    ${c.green}--pack-version <tag>${c.reset}   ${c.dim}Git tag/sha to pin (required with --pack-repo).${c.reset}\n` +
      `    ${c.green}--pack-root <path>${c.reset}     ${c.dim}Local directory containing packs (alternative to --pack-repo).${c.reset}\n` +
      `    ${c.green}--pack <pack-id>${c.reset}       ${c.dim}Pack identifier, e.g. parking-management/backend.${c.reset}\n` +
      `    ${c.green}--var KEY=VALUE${c.reset}        ${c.dim}Template variable (repeatable). Persisted to .specops.lock.${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset}   ${c.dim}Project root (auto-detected from cwd if omitted).${c.reset}\n` +
      `    ${c.green}--cache-dir <path>${c.reset}     ${c.dim}Override the remote-pack cache directory.${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}              ${c.dim}Print actions without writing.${c.reset}\n` +
      `    ${c.green}-h, --help${c.reset}             ${c.dim}Show this help.${c.reset}\n\n` +
      `  ${c.bold}EXAMPLES${c.reset}\n` +
      `    ${c.yellow}$${c.reset} specgate specops add --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git \\\n        --pack-version v0.1.0 --pack backend \\\n        --var PROJECT_NAME="Smart Parking" --var PROJECT_SLUG=smart-parking --var DOMAIN="parking ops"\n` +
      `    ${c.yellow}$${c.reset} specgate specops add --pack-root ./domain-packs --pack billing/backend --var PROJECT_NAME="..." --var PROJECT_SLUG=...\n\n`
  );
}

export function parseArgs(argv: string[]): SpecopsAddOptions {
  const opts: SpecopsAddOptions = {
    packRepo: "",
    packRoot: "",
    packVersion: "",
    pack: "",
    projectDir: ".",
    cacheDir: "",
    vars: [] as string[],
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pack-repo" && argv[i + 1]) opts.packRepo = argv[++i];
    else if (a === "--pack-root" && argv[i + 1]) opts.packRoot = argv[++i];
    else if (a === "--pack-version" && argv[i + 1]) opts.packVersion = argv[++i];
    else if (a === "--pack" && argv[i + 1]) opts.pack = argv[++i];
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--cache-dir" && argv[i + 1]) opts.cacheDir = argv[++i];
    else if (a === "--var" && argv[i + 1]) opts.vars.push(argv[++i]);
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

export class AddCommand extends BaseCommand {
  public execute() {
    const opts = parseArgs(this.args);

    if (!opts.pack) {
      process.stderr.write(`${c.red}✖${c.reset}  --pack <pack-id> is required.\n`);
      usage();
      process.exit(2);
    }
    if (opts.packRepo && opts.packRoot) {
      process.stderr.write(
        `${c.red}✖${c.reset}  Pass either --pack-repo or --pack-root, not both.\n`
      );
      process.exit(2);
    }
    if (!opts.packRepo && !opts.packRoot) {
      process.stderr.write(
        `${c.red}✖${c.reset}  Either --pack-repo (with --pack-version) or --pack-root is required.\n`
      );
      process.exit(2);
    }
    if (opts.packRepo && !opts.packVersion) {
      process.stderr.write(
        `${c.red}✖${c.reset}  --pack-repo requires --pack-version (pin to a git tag or sha).\n`
      );
      process.exit(2);
    }

    let projectDir;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      process.stderr.write(`${errorMessage(err)}\n`);
      process.exit(2);
    }

    const expandArgs: string[] = [];
    if (opts.packRepo) {
      expandArgs.push("--pack-repo", opts.packRepo, "--pack-version", opts.packVersion);
    } else {
      expandArgs.push("--pack-root", opts.packRoot);
    }
    expandArgs.push("--pack", opts.pack, "--project-dir", projectDir);
    if (opts.cacheDir) expandArgs.push("--cache-dir", opts.cacheDir);
    for (const v of opts.vars) expandArgs.push("--var", v);
    if (opts.dryRun) expandArgs.push("--dry-run");

    process.stdout.write(
      `${c.cyan}ℹ${c.reset}  Adding ${c.bold}${opts.pack}${c.reset}${
        opts.packVersion ? ` @ ${c.bold}${opts.packVersion}${c.reset}` : ""
      } to ${c.dim}${projectDir}${c.reset}\n`
    );

    const result = spawnSync(process.execPath, [EXPAND_SCRIPT, ...expandArgs], {
      stdio: "inherit",
    });
    process.exit(typeof result.status === "number" ? result.status : 1);
  }
}

if (require.main === module) new AddCommand(process.argv.slice(2)).execute();
