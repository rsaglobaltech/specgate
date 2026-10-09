import { migrateAiRules } from "../../../agents/contract-file";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { error, warning, info, errorMessage } from "../../../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../../../lib/agent";
import { threeWayMerge } from "../../../../packages/core/src/infrastructure/GitMergeDriver";
import { TOOLS, ALL_TOOLS, renamedPaths, AGENT_NAMESPACE } from "../../../agents/init";
import { BaseCommand } from "../../../lib/command";

export const BASELINE_DIR = path.join(".csda", "baseline");

const COLOR =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR ? "\x1b[0m" : "",
  bold: COLOR ? "\x1b[1m" : "",
  dim: COLOR ? "\x1b[2m" : "",
  green: COLOR ? "\x1b[32m" : "",
  yellow: COLOR ? "\x1b[33m" : "",
  red: COLOR ? "\x1b[31m" : "",
  cyan: COLOR ? "\x1b[36m" : "",
};

function readIfExists(file: string) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function baselinePath(projectDir: string, rel: string) {
  return path.join(projectDir, BASELINE_DIR, rel);
}

function allGenerated() {
  const planned = new Map();
  for (const tool of ALL_TOOLS) {
    for (const file of TOOLS[tool].files())
      if (!planned.has(file.path)) planned.set(file.path, file);
  }
  return [...planned.values()];
}

/**
 * Opt-in tools count only where they were installed. The Claude plugin's
 * `README.md` has the same path as the project's own, so without this guard
 * `update` adopted the project README as the plugin's — and the next run
 * would have merged the plugin README into it.
 */
function toolsPresent(projectDir: string): string[] {
  return ALL_TOOLS.filter(
    (t) => !TOOLS[t].optIn || fs.existsSync(path.join(projectDir, ".claude-plugin", "plugin.json"))
  );
}

export function generatedFiles(projectDir: string) {
  const planned = new Map();
  for (const tool of toolsPresent(projectDir)) {
    for (const file of TOOLS[tool].files()) {
      const entry = planned.get(file.path);
      if (entry) entry.tools.push(tool);
      else planned.set(file.path, { ...file, tools: [tool] });
    }
  }
  // AGENTS.md is kept by its marked block, not merged as a whole (ADR-0031).
  return [...planned.values()].filter(
    (f) => f.path !== "AGENTS.md" && fs.existsSync(path.join(projectDir, f.path))
  );
}

export interface GeneratedFile {
  path: string;
  contents: string;
}

export interface UpdateOptions {
  dryRun?: boolean;
}

export interface UpdateResult {
  path: string;
  outcome: "unchanged" | "written" | "adopted" | "updated" | "conflict" | "renamed";
  note?: string;
  conflicts?: number;
}

export function updateFile(
  projectDir: string,
  file: GeneratedFile,
  opts: UpdateOptions
): UpdateResult {
  const target = path.join(projectDir, file.path);
  const local = readIfExists(target);
  const base = readIfExists(baselinePath(projectDir, file.path));
  const incoming = file.contents;

  if (local === incoming) {
    return { path: file.path, outcome: "unchanged" };
  }

  if (base === null) {
    if (!opts.dryRun) writeBaseline(projectDir, file.path, incoming);
    return {
      path: file.path,
      outcome: local === null ? "written" : "adopted",
      ...(local === null ? {} : { note: "no baseline — kept your version, tracking from now on" }),
    };
  }

  if (base === incoming) {
    return { path: file.path, outcome: "unchanged" };
  }

  const { merged, conflict, conflicts } = threeWayMerge(base, local ?? "", incoming, {
    local: "local (your edits)",
    base: "base (last update)",
    incoming: "incoming (new CLI version)",
  });

  if (!opts.dryRun) {
    fs.writeFileSync(target, merged, "utf8");
    writeBaseline(projectDir, file.path, incoming);
  }

  return {
    path: file.path,
    outcome: conflict ? "conflict" : "updated",
    ...(conflict ? { conflicts } : {}),
  };
}

/**
 * Move files generated under the old `csda` name to their `specgate` path,
 * with their baseline, before anything is merged.
 *
 * Without this, `generatedFiles` looks only at the new paths, finds nothing,
 * and the team's edited `.claude/commands/csda/apply.md` is stranded: never
 * updated again, and shadowed by a fresh copy if `agents init` runs. Moving
 * the baseline with it means the three-way merge that follows still knows
 * which lines are the team's.
 *
 * When both exist the old one is left alone and reported: two files that may
 * both carry edits are a decision for a person, not for this command.
 */
export function migrateRenamedFiles(projectDir: string, opts: UpdateOptions): UpdateResult[] {
  const results: UpdateResult[] = [];
  for (const [oldRel, newRel] of renamedPaths()) {
    const oldAbs = path.join(projectDir, oldRel);
    if (!fs.existsSync(oldAbs)) continue;
    const newAbs = path.join(projectDir, newRel);
    if (fs.existsSync(newAbs)) {
      results.push({
        path: oldRel,
        outcome: "conflict",
        conflicts: 0,
        note: `both ${oldRel} and ${newRel} exist — keep one and delete the other`,
      });
      continue;
    }
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(newAbs), { recursive: true });
      fs.renameSync(oldAbs, newAbs);
      const oldBase = baselinePath(projectDir, oldRel);
      if (fs.existsSync(oldBase)) {
        const newBase = baselinePath(projectDir, newRel);
        fs.mkdirSync(path.dirname(newBase), { recursive: true });
        fs.renameSync(oldBase, newBase);
      } else {
        // `agents init` before 0.10 wrote no baseline, so there is nothing to
        // tell the team's lines from the generated ones — and adopting the
        // file as-is would keep every `/csda:` in it. What that version
        // generated is today's file under the old name: close enough to be a
        // base, and where it is not, the merge reports a conflict rather than
        // choosing.
        const current = allGenerated().find((g) => g.path === newRel);
        if (current) writeBaseline(projectDir, newRel, asOldNamespace(current.contents));
      }
      removeIfEmpty(path.dirname(oldAbs), projectDir);
    }
    results.push({ path: newRel, outcome: "renamed", note: `was ${oldRel}` });
  }
  return results;
}

function asOldNamespace(contents: string): string {
  return contents
    .split(`/${AGENT_NAMESPACE}:`)
    .join("/csda:")
    .split(`# ${AGENT_NAMESPACE} — `)
    .join("# csda — ");
}

function removeIfEmpty(dir: string, stopAt: string) {
  try {
    if (path.resolve(dir) !== path.resolve(stopAt) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    /* best effort: an empty directory left behind is harmless */
  }
}

function writeBaseline(projectDir: string, rel: string, contents: string) {
  const file = baselinePath(projectDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🔄 update${c.reset}  ${c.dim}— refresh generated files, keeping your edits${c.reset}\n\n` +
      "  USAGE\n    specgate update [--project-dir <path>] [--dry-run] [--json]\n\n" +
      "  Three-way merges the files `agents init` generates against the baseline\n" +
      "  recorded in .csda/baseline/. Local edits win; upstream changes land;\n" +
      "  conflicts are marked in the file and reported, never resolved silently.\n\n" +
      "  Only files the project already has are touched. Adding a tool is\n" +
      "  `specgate agents init --tool <name>`.\n\n"
  );
}

const MARK = {
  unchanged: `${c.dim}·${c.reset}`,
  updated: `${c.green}~${c.reset}`,
  written: `${c.green}+${c.reset}`,
  adopted: `${c.yellow}=${c.reset}`,
  conflict: `${c.red}!${c.reset}`,
  renamed: `${c.cyan}→${c.reset}`,
};

function renderHuman(results: UpdateResult[], dryRun?: boolean) {
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] || 0) + 1;
    return acc;
  }, {});

  process.stdout.write(
    `\n  ${c.bold}update${c.reset}${dryRun ? ` ${c.dim}(dry run — nothing written)${c.reset}` : ""}\n\n`
  );
  for (const r of results) {
    const note = r.note ? ` ${c.dim}— ${r.note}${c.reset}` : "";
    const conflicts = r.conflicts ? ` ${c.red}(${r.conflicts} conflict(s))${c.reset}` : "";
    process.stdout.write(`    ${MARK[r.outcome]} ${r.path}${conflicts}${note}\n`);
  }

  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ");
  process.stdout.write(`\n  ${summary}\n`);

  if (counts.conflict) {
    process.stdout.write(
      `\n  ${c.red}Resolve the <<<<<<< markers before committing.${c.reset}\n` +
        `  ${c.dim}Your version is the first block in each conflict.${c.reset}\n`
    );
  }
  process.stdout.write("\n");
}

export class UpdateCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    const io = agentIo(wantsJson(argv));
    const NULL_SHAPE = { update: null };

    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(EXIT.OK);
    }

    const dryRun = argv.includes("--dry-run");
    const dirFlag = argv.indexOf("--project-dir");

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirFlag !== -1 ? argv[dirFlag + 1] : ".");
    } catch (err) {
      io.usage(NULL_SHAPE, [
        error("project_not_found", errorMessage(err), {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }

    // ADR-0031: AI_RULES.md folds into AGENTS.md.
    const agentsMigration = migrateAiRules(projectDir, { dryRun });
    const renamed: UpdateResult[] = [
      ...(agentsMigration.moved
        ? [
            {
              path: "AGENTS.md",
              outcome: "renamed" as const,
              note: "AI_RULES.md moved below the specgate block, verbatim",
            },
          ]
        : []),
      ...migrateRenamedFiles(projectDir, { dryRun }),
    ];
    // In a dry run nothing moved, so plan the merge against where the files
    // will be — otherwise the preview would show a renamed file as missing.
    const files = generatedFiles(projectDir).concat(
      dryRun
        ? renamed
            .filter((r) => r.outcome === "renamed" && r.path !== "AGENTS.md")
            .map((r) => allGenerated().find((g) => g.path === r.path))
            .filter(Boolean)
        : []
    );
    if (files.length === 0 && renamed.length === 0) {
      io.emit(
        {
          update: { projectDir, dryRun, files: [] },
          status: [
            info("nothing_generated", "This project has no generated agent files yet.", {
              fix: "specgate agents init",
            }),
          ],
        },
        () =>
          process.stdout.write(
            `\n  ${c.dim}Nothing to update — this project has no generated agent files.${c.reset}\n` +
              `  ${c.green}specgate agents init${c.reset}${c.dim} writes them.${c.reset}\n\n`
          )
      );
      return;
    }

    const results: UpdateResult[] = [
      ...renamed,
      ...files.map((f) =>
        dryRun && renamed.some((r) => r.path === f.path)
          ? { path: f.path, outcome: "updated" as const, note: "after the rename" }
          : updateFile(projectDir, f, { dryRun })
      ),
    ];
    const conflicted = results.filter((r) => r.outcome === "conflict");
    const diagnostics = conflicted.map((r) =>
      r.note
        ? warning("rename_conflict", `${r.path}: ${r.note}.`, {
            file: r.path,
            fix: "Move any edits you want to keep into the specgate file, then delete the csda one.",
          })
        : warning(
            "update_conflict",
            `${r.path} has ${r.conflicts} conflict(s) to resolve by hand.`,
            {
              file: r.path,
              fix: "Open it and resolve the <<<<<<< markers. Your version is the first block.",
            }
          )
    );

    io.emit({ update: { projectDir, dryRun, files: results }, status: diagnostics }, () =>
      renderHuman(results, dryRun)
    );
    process.exit(EXIT.OK);
  }
}
