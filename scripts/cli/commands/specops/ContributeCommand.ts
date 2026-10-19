#!/usr/bin/env node
/**
 * `specgate specops contribute --change <id>` — the loop back to the pack.
 *
 * SpecOps has always been one-way: knowledge flows down from the pack into
 * the project, and a local improvement dies where it was written. `sync`
 * marks the edited file `kept` and the pack never hears about it. This
 * command is the return path: take a local change, express it in the pack's
 * own vocabulary, and stage it on a branch of a clone of the pack repo.
 *
 * **It never pushes, and it never edits the pack's `pack.yaml`.**
 * Pushing to someone else's repository is not a side effect this command gets
 * to have (see the plan's R7); and merging a YAML fragment into a structured
 * file is a judgement call — which use case does this belong under, does the
 * REQ id collide — that a maintainer makes, not a script. The contribution
 * lands as its own reviewable file and the push command is printed for the
 * human to run.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { BaseCommand } from "../../../lib/command";
import { readLock } from "../../../specops/lock";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseDelta } from "../../../../packages/core/src/domain/SpecParser";
import { listDeltas, paths } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { error, warning, printDiagnostics, errorMessage } from "../../../lib/diagnostics";
import type { Diagnostic } from "../../../lib/diagnostics";
import type { RequirementNode } from "../../../../packages/core/src/domain/SpecParser";
import {
  deltaToPackFragment,
  contributionReadme,
} from "../../../../packages/core/src/domain/PackContribution";
import { stageContribution } from "../../../../packages/core/src/infrastructure/GitContributionStager";

import { c } from "../../../lib/ui";

/** Parsed command-line options for this command. */
export interface ContributeOptions {
  projectDir: string;
  change: string;
  pack: string;
  out: string;
  branch: string;
  dryRun: boolean;
  json: boolean;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}📤 specops contribute${c.reset}  ${c.dim}— send a local change back to the pack${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate specops contribute${c.reset} --change <change-id> [options]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--change <id>${c.reset}        ${c.dim}The local change to contribute (required).${c.reset}\n` +
      `    ${c.green}--pack <pack-id>${c.reset}     ${c.dim}Target pack; defaults to the only one in the lockfile.${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset} ${c.dim}Project root (default: auto-detected).${c.reset}\n` +
      `    ${c.green}--out <path>${c.reset}         ${c.dim}Where to place the clone (default: a temp dir).${c.reset}\n` +
      `    ${c.green}--branch <name>${c.reset}      ${c.dim}Branch name (default: contribute/<change-id>).${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}            ${c.dim}Print the fragment and the plan; clone nothing.${c.reset}\n` +
      `    ${c.green}--json${c.reset}               ${c.dim}One JSON document on stdout.${c.reset}\n\n` +
      `  ${c.dim}Never pushes. The push command is printed for you to run.${c.reset}\n\n`
  );
}

export function parseArgs(argv: string[]): ContributeOptions {
  const opts: ContributeOptions = {
    projectDir: ".",
    change: "",
    pack: "",
    out: "",
    branch: "",
    dryRun: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--change" && argv[i + 1]) opts.change = argv[++i];
    else if (a === "--pack" && argv[i + 1]) opts.pack = argv[++i];
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--branch" && argv[i + 1]) opts.branch = argv[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

// ── Git staging ───────────────────────────────────────────────────────────────

// ── Command ───────────────────────────────────────────────────────────────────

export class ContributeCommand extends BaseCommand {
  public execute() {
    const opts = parseArgs(this.args);
    const nullShape = { contribution: null };

    const fail = (diags: Diagnostic[]): never => {
      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ ...nullShape, status: diags }, null, 2)}\n`);
      } else {
        printDiagnostics(diags);
      }
      process.exit(1);
    };

    if (!opts.change) {
      return fail([
        error("change_required", "`specops contribute` expects --change <change-id>.", {
          fix: "Run `specgate change list` to see active changes.",
        }),
      ]);
    }

    const projectDir = resolveProjectDir(opts.projectDir);
    const p = paths(projectDir);

    if (!fs.existsSync(p.change(opts.change))) {
      return fail([
        error("change_not_found", `Change "${opts.change}" does not exist.`, {
          target: opts.change,
          fix: "Run `specgate change list`.",
        }),
      ]);
    }

    const lock = readLock(projectDir);
    if (!lock || !Array.isArray(lock.packs) || lock.packs.length === 0) {
      return fail([
        error("no_lockfile", "No .specops.lock with pack entries in this project.", {
          fix: "`contribute` sends a change upstream to a pack; add one with `specgate specops add`.",
        }),
      ]);
    }

    const candidates = opts.pack ? lock.packs.filter((e) => e.pack_id === opts.pack) : lock.packs;
    if (candidates.length === 0) {
      return fail([
        error("pack_not_found", `No pack "${opts.pack}" in .specops.lock.`, {
          target: opts.pack,
          fix: `Available: ${lock.packs.map((e) => e.pack_id).join(", ")}.`,
        }),
      ]);
    }
    if (candidates.length > 1) {
      return fail([
        error("ambiguous_pack", "Several packs are locked; name the one to contribute to.", {
          fix: `Use --pack with one of: ${lock.packs.map((e) => e.pack_id).join(", ")}.`,
        }),
      ]);
    }
    const entry = candidates[0];

    const deltas = listDeltas(projectDir, opts.change);
    if (deltas.length === 0) {
      return fail([
        error("change_has_no_deltas", `Change "${opts.change}" carries no delta specs.`, {
          target: opts.change,
          fix: "There is nothing to send upstream; a contribution is made of requirements.",
        }),
      ]);
    }

    // Merge every delta in the change into one fragment: upstream cares about
    // requirements, not about how the consuming project filed them.
    const combined: Record<"added" | "modified" | "removed", RequirementNode[]> = {
      added: [],
      modified: [],
      removed: [],
    };
    for (const d of deltas) {
      const parsed = parseDelta(fs.readFileSync(d.file, "utf8"));
      combined.added.push(...parsed.added);
      combined.modified.push(...parsed.modified);
      combined.removed.push(...parsed.removed);
    }

    const fragment = deltaToPackFragment(combined, { changeId: opts.change });
    if (!fragment) {
      return fail([
        error("nothing_to_contribute", `Change "${opts.change}" declares no requirement changes.`, {
          target: opts.change,
          fix: "Add requirements to the delta before contributing.",
        }),
      ]);
    }

    const summary = {
      added: combined.added.map((r) => r.id || r.name),
      modified: combined.modified.map((r) => r.id || r.name),
      removed: combined.removed.map((r) => r.id || r.name),
    };

    const proposalFile = path.join(p.change(opts.change), "proposal.md");
    const proposal = fs.existsSync(proposalFile) ? fs.readFileSync(proposalFile, "utf8") : "";
    const branch = opts.branch || `contribute/${opts.change}`;
    const base = path.posix.join("contributions", opts.change);

    const files = [
      {
        file: path.posix.join(base, "fragment.yaml"),
        contents: fragment,
        message: `Contribute ${summary.added.length + summary.modified.length} requirement(s) from a consuming project`,
      },
      {
        file: path.posix.join(base, "delta.md"),
        contents: deltas.map((d) => fs.readFileSync(d.file, "utf8")).join("\n\n---\n\n"),
      },
      {
        file: path.posix.join(base, "README.md"),
        contents: contributionReadme(opts.change, entry.pack_id, proposal, summary),
      },
    ];

    if (opts.dryRun) {
      const payload = {
        contribution: {
          change: opts.change,
          pack: entry.pack_id,
          repo: entry.repo,
          branch,
          files: files.map((f) => f.file),
          summary,
          dryRun: true,
        },
        status: [],
      };
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        process.stdout.write(
          `\n  ${c.bold}Contribution plan${c.reset} ${c.dim}(dry run — nothing cloned)${c.reset}\n\n` +
            `    ${c.dim}pack:${c.reset}   ${entry.pack_id} ${c.dim}(${entry.repo})${c.reset}\n` +
            `    ${c.dim}branch:${c.reset} ${branch}\n\n` +
            files.map((f) => `    ${c.green}+${c.reset} ${f.file}\n`).join("") +
            `\n${fragment
              .split("\n")
              .map((l) => `    ${c.dim}${l}${c.reset}`)
              .join("\n")}\n\n`
        );
      }
      return;
    }

    if (!entry.repo) {
      return fail([
        error("pack_has_no_repo", `Pack "${entry.pack_id}" has no repo in .specops.lock.`, {
          target: entry.pack_id,
          fix: "A contribution needs a git repository to branch from.",
        }),
      ]);
    }

    let staged;
    try {
      staged = stageContribution(entry.repo, entry.version, branch, files, opts.out);
    } catch (err) {
      return fail([
        error("contribute_stage_failed", `Could not stage the contribution: ${errorMessage(err)}`, {
          target: entry.pack_id,
          fix: "Check that git is on PATH and the pack repository is reachable.",
        }),
      ]);
    }

    const pushCommand = `git -C ${staged.dir} push -u origin ${branch}`;
    const payload = {
      contribution: {
        change: opts.change,
        pack: entry.pack_id,
        repo: entry.repo,
        branch,
        clone: staged.dir,
        files: staged.files,
        summary,
        pushCommand,
      },
      status: [
        warning("contribute_not_pushed", "The branch exists locally and was not pushed.", {
          fix: pushCommand,
        }),
      ],
    };

    if (opts.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    process.stdout.write(
      `\n  ${c.green}✔${c.reset} Contribution staged on ${c.bold}${branch}${c.reset}\n\n` +
        `    ${c.dim}pack:${c.reset}  ${entry.pack_id}\n` +
        `    ${c.dim}clone:${c.reset} ${staged.dir}\n\n` +
        staged.files.map((f) => `    ${c.green}+${c.reset} ${f}\n`).join("") +
        `\n  ${c.yellow}Nothing was pushed.${c.reset} To publish it:\n\n` +
        `    ${c.cyan}${pushCommand}${c.reset}\n\n`
    );
  }
}
