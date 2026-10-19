/**
 * `specops diff` — shows what would change in the project if each pack
 * in `.specops.lock` were re-expanded (optionally at a different
 * `--pack-version`). Writes nothing to the project directory.
 *
 * Strategy:
 *   1. For each pack entry: expand into a temp dir with the chosen version
 *   2. Compare the temp dir to the project copy — `diffDirs` reduces both to
 *      content hashes, which is enough because render is deterministic for a
 *      fixed pack version + vars
 *   3. Emit a per-pack summary listing added (+) and modified (~) files
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";

import { readLock } from "../../../specops/lock";
import type { LockJson } from "../../../specops/lock";
import type { PackEntry } from "../../../../packages/core/src/domain/Lockfile";
import { resolveProjectDir } from "../../../lib/project-root";
import { resolveRemotePack } from "../../../../packages/core/src/infrastructure/RemotePackResolver";
import { deriveDelta, materialiseChange } from "../../../specops/as_change";
import { diffDirs } from "../../../../packages/core/src/infrastructure/DirectorySnapshot";
import type { FileChangeSet } from "../../../../packages/core/src/domain/FileChangeSet";
import type { Diagnostic } from "../../../lib/diagnostics";
import { agentIo, AgentIo } from "../../../lib/agent";
import * as ui from "../../../lib/ui";

// Three levels up from dist/scripts/cli/commands/specops is dist/scripts.
const EXPAND_SCRIPT = path.join(__dirname, "..", "..", "..", "expand_domain_pack.js");

function info(msg: string): void {
  process.stdout.write(ui.logLine(msg));
}
function error(msg: string): void {
  process.stderr.write(ui.fail(msg));
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate specops diff [--project-dir <path>] [--pack <pack-id>] [--pack-version <tag>] [--cache-dir <path>] [--var KEY=VALUE]... [--format text|json] [--json]\n\n" +
      "Reports files that would be added or modified if `specops sync` ran at\n" +
      "the chosen version. Writes nothing to the project directory.\n\n" +
      "  --as-change       Derive the bump as a reviewable change: compares the\n" +
      "                    packs' requirement models and writes a change folder\n" +
      "                    with a proposal and delta specs. Add --dry-run to see\n" +
      "                    the summary without writing it.\n" +
      "  --var KEY=VALUE   Extra template variable (repeatable). Use it when a\n" +
      "                    newer pack version requires a variable the lockfile\n" +
      "                    predates.\n" +
      "With --json (or --format json; --plan is the older spelling), emits a machine-readable\n" +
      "structure suitable for AI agents and editor integrations.\n"
  );
}

/** Parsed command-line options for this command. */
export interface DiffArgs {
  projectDir: string;
  pack: string;
  packVersion: string;
  cacheDir: string;
  format: string;
  asChange: boolean;
  dryRun: boolean;
  /** `--var KEY=VALUE`, repeatable. */
  vars: Record<string, string>;
}

/** One pack's outcome under `--as-change`. */
interface AsChangeResultBase {
  packId: string;
  currentVersion: string;
  targetVersion: string;
  summary: { added: string[]; modified: string[]; removed: string[] };
}

/** Nothing behavioural changed between the two versions. */
interface NoChangeResult extends AsChangeResultBase {
  change: null;
  message: string;
}

/** A change folder was written, or would be on a dry run. */
interface ChangeWrittenResult extends AsChangeResultBase {
  change: string;
  files: string[];
  dryRun: boolean;
}

type AsChangeResult = NoChangeResult | ChangeWrittenResult;

/** A result with a change id wrote (or would write) a change folder. */
function wroteChange(r: AsChangeResult): r is ChangeWrittenResult {
  return Boolean(r.change);
}

export function parseArgs(argv: string[]): DiffArgs {
  const args: DiffArgs = {
    projectDir: ".",
    pack: "",
    packVersion: "",
    cacheDir: "",
    format: "text",
    asChange: false,
    dryRun: false,
    vars: {} as Record<string, string>,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--project-dir") {
      args.projectDir = argv[++i] || "";
      continue;
    }
    if (token === "--pack") {
      args.pack = argv[++i] || "";
      continue;
    }
    if (token === "--pack-version") {
      args.packVersion = argv[++i] || "";
      continue;
    }
    if (token === "--cache-dir") {
      args.cacheDir = argv[++i] || "";
      continue;
    }
    if (token === "--var") {
      const pair = argv[++i] || "";
      const eq = pair.indexOf("=");
      if (eq <= 0) throw new Error(`Invalid --var (expected KEY=VALUE): ${pair}`);
      args.vars[pair.slice(0, eq)] = pair.slice(eq + 1);
      continue;
    }
    if (token === "--format") {
      args.format = argv[++i] || "";
      continue;
    }
    if (token === "--plan" || token === "--json") {
      // `--json` is the contract spelling (ADR-0017); `--plan` predates it and
      // keeps working rather than breaking pipelines that already use it.
      args.format = "json";
      continue;
    }
    if (token === "--as-change") {
      args.asChange = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!["text", "json"].includes(args.format)) {
    throw new Error(`Invalid --format: ${args.format}. Expected: text | json.`);
  }
  return args;
}

export function buildExpandArgs(
  entry: PackEntry,
  version: string,
  tmpDir: string,
  cacheDir: string,
  extraVars: Record<string, string> = {}
): string[] {
  const out = [
    "--pack-repo",
    entry.repo,
    "--pack-version",
    version,
    "--pack",
    entry.pack_id,
    "--project-dir",
    tmpDir,
  ];
  if (cacheDir) out.push("--cache-dir", cacheDir);
  // CLI --var values extend/override the lockfile's recorded vars — needed
  // when a newer pack version requires a variable the lockfile predates.
  const vars = { ...(entry.vars || {}), ...extraVars };
  for (const [key, value] of Object.entries(vars)) {
    out.push("--var", `${key}=${value}`);
  }
  return out;
}

function printChanges(entry: PackEntry, version: string, changes: FileChangeSet): void {
  const header = `── ${entry.pack_id} @ ${version}${
    version !== entry.version ? ` (current: ${entry.version})` : ""
  } ──`;
  process.stdout.write(`\n${header}\n`);
  if (changes.added.length === 0 && changes.modified.length === 0) {
    process.stdout.write("  (no changes)\n");
    return;
  }
  for (const f of changes.added) process.stdout.write(`  + ${f}\n`);
  for (const f of changes.modified) process.stdout.write(`  ~ ${f}\n`);
  process.stdout.write(
    `\n  ${changes.added.length} added · ${changes.modified.length} modified · ` +
      `${changes.unchanged.length} unchanged\n`
  );
}

/**
 * `--as-change`: resolve the pack at both versions, compare their requirement
 * models, and write the difference as a change folder.
 *
 * Both sides come from `pack.yaml`, never from a rendered tree — a pack that
 * only reformats templates yields no deltas, which is the property that makes
 * this more useful than the file diff rather than noisier than it.
 */
export function runAsChange(args: DiffArgs, projectDir: string, lock: LockJson): void {
  const results: AsChangeResult[] = [];
  let matched = 0;

  for (const entry of lock.packs) {
    if (args.pack && entry.pack_id !== args.pack) continue;
    matched += 1;

    const targetVersion = args.packVersion || entry.version;
    if (!entry.repo) {
      throw new Error(
        `Pack "${entry.pack_id}" has no repo in .specops.lock; --as-change needs a versioned pack repository.`
      );
    }

    const current = resolveRemotePack({
      repo: entry.repo,
      version: entry.version,
      cacheDir: args.cacheDir || undefined,
    });
    const target =
      targetVersion === entry.version
        ? current
        : resolveRemotePack({
            repo: entry.repo,
            version: targetVersion,
            cacheDir: args.cacheDir || undefined,
          });

    const derived = deriveDelta(current.packRoot, target.packRoot, entry.pack_id, {
      // Provenance rides with the requirement so `archive` can carry it into
      // the capability spec, and a later reader can tell pack-owned from local.
      origin: `pack:${entry.pack_id}@${targetVersion}`,
      // Generated prose follows the project's language setting; the grammar
      // (SHALL, GIVEN/WHEN/THEN, the section headings) never does.
      projectDir,
    });

    if (!derived.markdown) {
      results.push({
        packId: entry.pack_id,
        currentVersion: entry.version,
        targetVersion: targetVersion,
        change: null,
        summary: derived.summary,
        message: "No requirement changed; nothing to review.",
      });
      continue;
    }

    const written = materialiseChange(projectDir, entry, targetVersion, derived, {
      dryRun: args.dryRun,
    });
    results.push({
      packId: entry.pack_id,
      currentVersion: entry.version,
      targetVersion: targetVersion,
      change: written.changeId,
      files: written.files,
      summary: derived.summary,
      dryRun: args.dryRun === true,
    });
  }

  if (matched === 0) {
    throw new Error(`No packs matched${args.pack ? ` --pack ${args.pack}` : ""}.`);
  }

  if (args.format === "json") {
    process.stdout.write(
      JSON.stringify({ schemaVersion: 1, projectDir, changes: results, status: [] }, null, 2) + "\n"
    );
    return;
  }

  for (const r of results) {
    const header = `── ${r.packId} @ ${r.targetVersion}${
      r.targetVersion !== r.currentVersion ? ` (current: ${r.currentVersion})` : ""
    } ──`;
    process.stdout.write(`\n${header}\n`);
    if (!wroteChange(r)) {
      process.stdout.write(`  ${r.message}\n`);
      continue;
    }
    for (const id of r.summary.added) process.stdout.write(`  + ${id}\n`);
    for (const id of r.summary.modified) process.stdout.write(`  ~ ${id}\n`);
    for (const id of r.summary.removed) process.stdout.write(`  - ${id}\n`);
    process.stdout.write(
      `\n  ${r.summary.added.length} added · ${r.summary.modified.length} modified · ` +
        `${r.summary.removed.length} removed\n`
    );
    if (r.dryRun) {
      process.stdout.write(`\n  Would create change '${r.change}' (dry run — nothing written).\n`);
    } else {
      process.stdout.write(`\n  Change '${r.change}' created:\n`);
      for (const f of r.files) process.stdout.write(`    + ${f}\n`);
      process.stdout.write(`\n  Review it, then: specgate change validate ${r.change}\n`);
    }
  }
  process.stdout.write("\n");
}

export class DiffCommand extends BaseCommand {
  public execute() {
    let args;
    try {
      args = parseArgs(this.args);
    } catch (err) {
      // parseArgs doesn't know about format, default to assuming json if --json is passed
      const io: AgentIo = agentIo(
        this.args.includes("--json") ||
          (this.args.includes("--format") && this.args.includes("json"))
      );
      return io.fail({ changes: null }, [
        {
          severity: "error",
          code: "specops_diff_usage",
          message: (err as Error).message || String(err),
        },
      ]);
    }

    const io: AgentIo = agentIo(args.format === "json");
    try {
      const projectDir = resolveProjectDir(args.projectDir);
      const lock = readLock(projectDir);
      if (!lock) {
        return io.fail({ changes: null }, [
          {
            severity: "error",
            code: "no_lockfile",
            message: `No .specops.lock found in ${projectDir}`,
          },
        ]);
      }
      if (!Array.isArray(lock.packs) || lock.packs.length === 0) {
        return io.fail({ changes: null }, [
          {
            severity: "error",
            code: "specops_lock_empty",
            message: ".specops.lock has no pack entries.",
          },
        ]);
      }

      if (args.asChange) {
        runAsChange(args, projectDir, lock);
        return;
      }

      const jsonOut = {
        schemaVersion: 1,
        projectDir,
        diffs: [] as unknown[],
        status: [] as Diagnostic[],
      };
      let matched = 0;
      for (const entry of lock.packs) {
        if (args.pack && entry.pack_id !== args.pack) continue;
        matched += 1;

        const version = args.packVersion || entry.version;
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specops-diff-"));
        try {
          const expandArgs = buildExpandArgs(entry, version, tmpDir, args.cacheDir, args.vars);
          const result = spawnSync(process.execPath, [EXPAND_SCRIPT, ...expandArgs], {
            encoding: "utf8",
          });
          if (result.status !== 0) {
            if (args.format === "json") {
              jsonOut.diffs.push({
                packId: entry.pack_id,
                currentVersion: entry.version,
                targetVersion: version,
                error: result.stderr || result.stdout || "expand failed",
              });
            } else {
              error(`expand failed for ${entry.pack_id}:\n${result.stderr || result.stdout}`);
            }
            continue;
          }
          const changes = diffDirs(projectDir, tmpDir);
          if (args.format === "json") {
            jsonOut.diffs.push({
              packId: entry.pack_id,
              currentVersion: entry.version,
              targetVersion: version,
              added: changes.added,
              modified: changes.modified,
              unchangedCount: changes.unchanged.length,
            });
          } else {
            printChanges(entry, version, changes);
          }
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }

      if (matched === 0) {
        error(`No packs matched${args.pack ? ` --pack ${args.pack}` : ""}.`);
        process.exit(1);
      }

      if (args.format === "json") {
        process.stdout.write(JSON.stringify(jsonOut, null, 2) + "\n");
      } else {
        info(`Diff completed for ${matched} pack(s).`);
      }
    } catch (err) {
      return io.fail({ changes: null }, [
        {
          severity: "error",
          code: "specops_diff_error",
          message: (err as Error).message || String(err),
        },
      ]);
    }
  }
}
