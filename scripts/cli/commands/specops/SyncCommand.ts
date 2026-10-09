#!/usr/bin/env node
/**
 * `specops sync` — re-expands every pack recorded in `.specops.lock` and
 * reconciles the result with the project using three-way merge.
 *
 * Falls back to `specops.config.yaml` when no lockfile exists, allowing
 * fresh clones to bootstrap before the first lock is written.
 *
 * Conflict detection (vs. the old blind-overwrite behaviour):
 *   For each file the pack renders, sync compares three versions —
 *     base     = what the pack rendered last sync (.specops/baseline/<pack>)
 *     local    = what is in the project now (possibly hand-edited by a
 *                human or an AI agent)
 *     incoming = what the pack renders at the target version
 *   and classifies the file as added / unchanged / updated / kept /
 *   merged / conflict. Local edits are preserved; genuine conflicts get
 *   git-style merge markers (or are skipped with --abort-on-conflict).
 *
 * Exit code is non-zero when any file is left in a conflicted state, so
 * CI and agent harnesses can detect that a human needs to intervene.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";

import { readLock, writeLock, upsertPackEntry, newLock } from "../../../specops/lock";
import {
  readConfig,
  configToPacks,
  CONFIG_FILE,
} from "../../../../packages/core/src/infrastructure/SpecopsConfigFile";
import { walkFiles } from "../../../../packages/core/src/infrastructure/DirectorySnapshot";
import { readBaseline, snapshotBaseline } from "../../../specops/manifest";
import { threeWayMerge } from "../../../../packages/core/src/infrastructure/GitMergeDriver";
import {
  CONFLICT_OUTCOMES,
  OUTCOME_LABEL,
} from "../../../../packages/core/src/domain/Reconciliation";
import { reconcileTraced } from "../../../../packages/core/src/domain/TraceMerge";
import { CATALOG_DOCS } from "../../../../packages/core/src/domain/CatalogMerge";
import { DERIVED_MARKER } from "../../../../packages/core/src/domain/DerivedMatrix";
import { isDerivedProject } from "../../../lib/derived-writes";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
import { resolveProjectDir } from "../../../lib/project-root";
import { resolveRemotePack } from "../../../../packages/core/src/infrastructure/RemotePackResolver";
import { depositPackChanges } from "../../../../packages/core/src/infrastructure/PackChangeDeposit";

// Three levels up from dist/scripts/cli/commands/specops is dist/scripts.
const EXPAND_SCRIPT = path.join(__dirname, "..", "..", "..", "expand_domain_pack.js");

function info(msg) {
  process.stdout.write(`ℹ️ [INFO] ${msg}\n`);
}
function warn(msg) {
  process.stdout.write(`⚠️  [WARN] ${msg}\n`);
}
function error(msg) {
  process.stderr.write(`❌ [ERROR] ${msg}\n`);
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate specops sync [--project-dir <path>] [--pack <pack-id>] [--pack-version <tag>] [--cache-dir <path>] [--var KEY=VALUE]... [--dry-run] [--force] [--abort-on-conflict]\n\n" +
      "Re-expands packs recorded in .specops.lock (or specops.config.yaml if no\n" +
      "lockfile exists) and three-way merges the result into the project,\n" +
      "preserving local edits. With --pack-version, bumps the matching pack(s)\n" +
      "to a new tag/SHA.\n\n" +
      "  --var KEY=VALUE       Extra template variable (repeatable). Use it when a\n" +
      "                        newer pack version requires a variable the lockfile\n" +
      "                        predates; the value is persisted back to .specops.lock.\n" +
      "  --force               Overwrite locally-edited files with the pack version.\n" +
      "  --abort-on-conflict   Leave conflicting files untouched instead of writing markers.\n" +
      "  --dry-run             Report what would change without writing anything.\n"
  );
}

export function parseArgs(argv) {
  const args = {
    projectDir: ".",
    pack: "",
    packVersion: "",
    cacheDir: "",
    dryRun: false,
    force: false,
    abortOnConflict: false,
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
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--abort-on-conflict") {
      args.abortOnConflict = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (args.force && args.abortOnConflict) {
    throw new Error("--force and --abort-on-conflict are mutually exclusive.");
  }
  return args;
}

export function buildExpandArgs(entry, version, projectDir, cacheDir, dryRun, extraVars = {}) {
  const out = [
    "--pack-repo",
    entry.repo,
    "--pack-version",
    version,
    "--pack",
    entry.pack_id,
    "--project-dir",
    projectDir,
  ];
  if (cacheDir) {
    out.push("--cache-dir", cacheDir);
  }
  // CLI --var values extend/override the lockfile's recorded vars — needed
  // when a newer pack version requires a variable the lockfile predates.
  const vars = { ...(entry.vars || {}), ...extraVars };
  for (const [key, value] of Object.entries(vars)) {
    out.push("--var", `${key}=${value}`);
  }
  if (dryRun) out.push("--dry-run");
  return out;
}

export function resolvePacks(projectDir) {
  const lock = readLock(projectDir);
  if (lock) {
    if (!Array.isArray(lock.packs) || lock.packs.length === 0) {
      throw new Error(".specops.lock has no pack entries.");
    }
    return { packs: lock.packs, source: ".specops.lock" };
  }

  const config = readConfig(projectDir);
  if (config) {
    return { packs: configToPacks(config), source: CONFIG_FILE };
  }

  throw new Error(
    `No .specops.lock or ${CONFIG_FILE} found in ${projectDir}.\n` +
      `Run 'expand --pack-repo ...' first, or create a ${CONFIG_FILE}.`
  );
}

/**
 * Classify a single file and (unless dryRun) apply the chosen action.
 * Returns { outcome, baselineContent } where baselineContent is what should
 * be recorded as the next merge base for this file.
 */
export function reconcileFile(rel, incoming, projectDir, packId, args, seeded = null) {
  const localPath = path.join(projectDir, rel);
  const local = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
  // A file sync seeded the render with is one `expand` merges into rather
  // than writes whole: what it rendered is the project's copy plus this
  // pack's changes, so the project's copy is the base.
  const base = seeded !== null ? seeded : readBaseline(projectDir, packId, rel);

  const decision = reconcileTraced(base, local, incoming, args, threeWayMerge);

  if (decision.write !== null && !args.dryRun) {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, decision.write, "utf8");
  }

  return { outcome: decision.outcome, baselineContent: decision.baselineContent };
}

/**
 * Where the pack's own source tree lives, for reading anything `expand` does
 * not render — currently the `changes/` a pack may ship.
 *
 * Remote packs come from the resolver's cache (already populated by the expand
 * that just ran, so this costs nothing); local packs are read in place.
 * Returns null when neither applies, and the caller simply skips the step.
 */
function resolvePackRootForChanges(entry, version, args) {
  if (entry.pack_root) return entry.pack_root;
  if (!entry.repo) return null;
  try {
    const resolved = resolveRemotePack({
      repo: entry.repo,
      version,
      cacheDir: args.cacheDir || undefined,
    });
    return resolved.packRoot;
  } catch {
    return null;
  }
}

function syncPack(entry, args, projectDir) {
  const version = args.packVersion || entry.version;
  const bumping = args.packVersion && args.packVersion !== entry.version;
  info(`Syncing ${entry.pack_id} @ ${version}` + (bumping ? ` (was ${entry.version})` : ""));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specops-sync-"));
  const seeded = seedRender(projectDir, tmpDir);
  try {
    // Always render into a throwaway dir (never --dry-run: we need the bytes).
    const expandArgs = buildExpandArgs(entry, version, tmpDir, args.cacheDir, false, args.vars);
    const result = spawnSync(process.execPath, [EXPAND_SCRIPT, ...expandArgs], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      error(`expand failed for ${entry.pack_id}:\n${result.stderr || result.stdout}`);
      return { ok: false, conflicts: 0 };
    }

    const tmpLock = readLock(tmpDir);
    const resolvedEntry =
      (tmpLock && tmpLock.packs.find((p) => p.pack_id === entry.pack_id)) || null;

    const renderedFiles = walkFiles(tmpDir);
    const counts = {};
    const conflictFiles = [];
    const baselineEntries = [];

    for (const rel of renderedFiles) {
      // A generated matrix is regenerated once every pack is in, never merged.
      if (seeded.derived && rel === MATRIX) continue;
      const incoming = fs.readFileSync(path.join(tmpDir, rel), "utf8");
      const seed = seeded.files.has(rel) ? seeded.files.get(rel) : null;
      // Seeded and untouched: this pack has nothing to say about the file.
      if (seed !== null && incoming === seed) continue;
      const { outcome, baselineContent } = reconcileFile(
        rel,
        incoming,
        projectDir,
        entry.pack_id,
        args,
        seed
      );
      counts[outcome] = (counts[outcome] || 0) + 1;
      if (CONFLICT_OUTCOMES.has(outcome)) conflictFiles.push({ rel, outcome });
      if (baselineContent !== null && seed === null) {
        baselineEntries.push({ rel, content: baselineContent });
      }
    }

    printPackSummary(entry.pack_id, version, counts, conflictFiles);

    // A pack may ship `changes/`. They land as proposed changes — never
    // applied — so the consuming team reviews them like any other change.
    // Additive: a change id already present locally is skipped, not replaced.
    try {
      const resolved = resolvePackRootForChanges(entry, version, args);
      if (resolved) {
        const { deposited, skipped } = depositPackChanges(projectDir, resolved, entry.pack_id, {
          dryRun: args.dryRun,
        });
        for (const id of deposited) {
          info(`  proposed change from pack: ${id}${args.dryRun ? " (dry-run)" : ""}`);
        }
        for (const id of skipped) {
          warn(`  pack change '${id}' skipped — a local change with that id already exists`);
        }
      }
    } catch (err) {
      warn(`  could not read changes shipped by ${entry.pack_id}: ${err.message}`);
    }

    if (!args.dryRun) {
      snapshotBaseline(
        projectDir,
        entry.pack_id,
        baselineEntries,
        { version: (resolvedEntry && resolvedEntry.version) || version },
        { dryRun: false }
      );
    }

    return {
      ok: true,
      conflicts: conflictFiles.length,
      resolvedEntry,
      version,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const MATRIX = "docs/specs/traceability.md";

/**
 * The entry's previous `expanded_at`, when nothing that decides the expansion
 * changed. A sync that changed nothing rewrote the timestamp anyway, so every
 * `specops sync` left a one-line diff in `.specops.lock` to commit or revert
 * (golden_app finding #30). The timestamp now moves only with the pack.
 */
const sortedJson = (o) =>
  JSON.stringify(
    Object.keys(o || {})
      .sort()
      .map((k) => [k, o[k]])
  );

export function keptExpandedAt(lock, resolved): string | null {
  const prev = ((lock && lock.packs) || []).find((p) => p.pack_id === resolved.pack_id);
  if (!prev || !prev.expanded_at) return null;
  const same =
    prev.repo === resolved.repo &&
    prev.version === resolved.version &&
    prev.commit === resolved.commit &&
    sortedJson(prev.vars) === sortedJson(resolved.vars);
  return same ? prev.expanded_at : null;
}

/**
 * Give the throwaway render what `expand` would find in the project, for the
 * files it merges into instead of writing whole. Rendered into an empty
 * directory, a derived project's pack wrote a hand-kept matrix (a false
 * "no merge base" conflict on traceability.md, finding #23), never wrote the
 * trace fields into the capability specs (so a pack's new `depends_on` never
 * arrived, #24), and every shared catalog held one pack's rows (#22).
 *
 * The matrix gets only its marker — `expand` then writes trace fields
 * instead of rows; spec.md and the catalogs get the project's copy.
 */
export function seedRender(projectDir, tmpDir) {
  const files = new Map<string, string>();
  const derived = isDerivedProject(projectDir);
  const copy = (rel) => {
    const from = path.join(projectDir, rel);
    if (!fs.existsSync(from)) return;
    const content = fs.readFileSync(from, "utf8");
    fs.mkdirSync(path.dirname(path.join(tmpDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, rel), content, "utf8");
    files.set(rel, content);
  };
  if (derived) {
    fs.mkdirSync(path.join(tmpDir, "docs", "specs"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, MATRIX), `${DERIVED_MARKER}\n`, "utf8");
    copy("spec.md");
  }
  for (const rel of CATALOG_DOCS) copy(rel);
  return { derived, files };
}

function printPackSummary(packId, version, counts, conflictFiles) {
  const parts = Object.keys(OUTCOME_LABEL)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${OUTCOME_LABEL[k]}`);
  process.stdout.write(`\n── ${packId} @ ${version} ──\n`);
  process.stdout.write(`  ${parts.length ? parts.join(" · ") : "no files"}\n`);
  for (const { rel, outcome } of conflictFiles) {
    warn(`  ${rel} — ${OUTCOME_LABEL[outcome]}`);
  }
}

export class SyncCommand extends BaseCommand {
  public execute() {
    try {
      const args = parseArgs(this.args);
      const projectDir = resolveProjectDir(args.projectDir);
      const { packs, source } = resolvePacks(projectDir);

      info(`Reading pack list from ${source}`);
      if (args.dryRun) info("Dry run — no files will be written.");

      let matched = 0;
      let totalConflicts = 0;
      let anyFailure = false;
      const lockUpdates = [];

      for (const entry of packs) {
        if (args.pack && entry.pack_id !== args.pack) continue;
        matched += 1;

        const res = syncPack(entry, args, projectDir);
        if (!res.ok) {
          anyFailure = true;
          continue;
        }
        totalConflicts += res.conflicts;
        if (res.resolvedEntry) lockUpdates.push(res.resolvedEntry);
      }

      if (matched === 0) {
        error(`No packs matched${args.pack ? ` --pack ${args.pack}` : ""}.`);
        process.exit(1);
      }

      // Persist resolved versions/commits to the project lockfile.
      if (!args.dryRun && lockUpdates.length > 0) {
        let lock = readLock(projectDir) || newLock();
        for (const resolved of lockUpdates) {
          lock = upsertPackEntry(lock, {
            repo: resolved.repo,
            version: resolved.version,
            commit: resolved.commit,
            pack_id: resolved.pack_id,
            expanded_at:
              keptExpandedAt(lock, resolved) || resolved.expanded_at || new Date().toISOString(),
            vars: resolved.vars || {},
          });
        }
        writeLock(projectDir, lock);
      }

      // The trace fields are in; the generated matrix follows from them.
      if (!args.dryRun && isDerivedProject(projectDir) && refreshDerivedMatrix(projectDir)) {
        info(`Regenerated ${MATRIX} from the synced specs.`);
      }

      if (anyFailure) {
        error("One or more packs failed to expand.");
        process.exit(1);
      }

      if (totalConflicts > 0) {
        process.stdout.write("\n");
        error(
          `Sync completed with ${totalConflicts} conflicting file(s). ` +
            `Resolve them, then re-run 'specops sync'.`
        );
        process.exit(1);
      }

      info(`Sync completed for ${matched} pack(s) with no conflicts.`);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  }
}
