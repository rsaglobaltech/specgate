import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability, detectOrphans } from "../spec/PlanCommand";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error, info, errorMessage } from "../../../lib/diagnostics";
import { isDerivedMatrix } from "../../../../packages/core/src/domain/DerivedMatrix";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
import { appendRequirement } from "../spec/ReqCommand";
import { BaseCommand } from "../../../lib/command";

const NULL_SHAPE = { projectDir: null, actions: [], applied: false, dryRun: false };

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
};

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🛠  fix${c.reset}  ${c.dim}— auto-repair mechanical traceability violations${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate fix${c.reset} [--yes] [--dry-run] [--json] [--project-dir <path>]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--yes${c.reset}                ${c.dim}Apply without prompting (CI-friendly).${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}            ${c.dim}Preview the changes; never write.${c.reset}\n` +
      `    ${c.green}--json${c.reset}               ${c.dim}Machine-readable output. Needs --yes or --dry-run.${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset} ${c.dim}Project root (auto-detected from cwd if omitted).${c.reset}\n` +
      `    ${c.green}-h, --help${c.reset}           ${c.dim}Show this help.${c.reset}\n\n`
  );
}

export function computeFixes(projectDir: string, traceContent: string, specContent: string) {
  const rows = parseTraceability(traceContent);
  const items = rows.map((r) => ({ feature_file: r.featureFile, requirement: r.requirement }));

  const actions: string[] = [];
  let content = traceContent;

  const orphans = detectOrphans(projectDir, items);
  for (const rel of orphans) {
    const res = appendRequirement(content, {
      featureFile: rel,
      useCase: `TODO: describe ${path.basename(rel, ".feature")}`,
    });
    content = res.content;
    actions.push(`+ row for orphan feature ${rel} → ${res.reqId}`);
  }

  const known = new Set(
    parseTraceability(content)
      .map((r) => r.requirement)
      .filter(Boolean)
  );
  const specReqs = new Set<string>(specContent.match(/\bREQ-\d+\b/g) || []);
  for (const reqId of specReqs) {
    if (known.has(reqId)) continue;
    const res = appendRequirement(content, {
      requirement: reqId,
      useCase: "TODO: describe this requirement",
    });
    content = res.content;
    known.add(reqId);
    actions.push(`+ row for ${reqId} (in spec.md, missing from matrix)`);
  }

  return { content, actions };
}

export interface FixOptions {
  projectDir: string;
  yes: boolean;
  dryRun: boolean;
  json: boolean;
}

export function parseArgs(argv: string[]) {
  const opts: FixOptions = { projectDir: ".", yes: false, dryRun: false, json: wantsJson(argv) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") opts.yes = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--json") continue;
    else if (a === "--format" && argv[i + 1] === "json") i++;
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

export class FixCommand extends BaseCommand {
  public async execute() {
    const opts = parseArgs(this.args);
    const io = agentIo(opts.json);

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err: any) {
      io.usage(NULL_SHAPE, [
        error("no_project", errorMessage(err), {
          fix: "Run from inside a spec-driven project, or pass --project-dir <path>.",
        }),
      ]);
      return;
    }

    const tracePath = path.join(projectDir, "docs/specs/traceability.md");
    if (!fs.existsSync(tracePath)) {
      io.usage(NULL_SHAPE, [
        error("no_traceability_matrix", `docs/specs/traceability.md not found in ${projectDir}`, {
          target: tracePath,
          fix: "Run `specgate adopt` to install the spec skeleton, or `specgate init` for a new project.",
        }),
      ]);
      return;
    }
    const specPath = path.join(projectDir, "spec.md");
    const specContent = fs.existsSync(specPath) ? fs.readFileSync(specPath, "utf8") : "";

    const traceContent = fs.readFileSync(tracePath, "utf8");
    if (isDerivedMatrix(traceContent)) {
      // Every fix here edits the matrix, and a generated matrix has no edits
      // to make: regenerating it is the whole repair.
      const regenerated = !opts.dryRun && refreshDerivedMatrix(projectDir);
      io.emit(
        {
          projectDir,
          actions: [],
          dryRun: Boolean(opts.dryRun),
          applied: regenerated,
          status: [
            info("matrix_generated", "The matrix is generated, so there is nothing to fix in it.", {
              fix: "A feature without a row needs @REQ-NNN on its scenario, or `specgate new`.",
            }),
          ],
        },
        () =>
          process.stdout.write(
            `${regenerated ? "↻ Regenerated docs/specs/traceability.md. " : ""}` +
              "The matrix is generated: tag an orphan scenario @REQ-NNN, or add it with `specgate new`.\n"
          )
      );
      return;
    }
    const { content, actions } = computeFixes(projectDir, traceContent, specContent);

    const base = { projectDir, actions, dryRun: Boolean(opts.dryRun) };

    if (actions.length === 0) {
      io.emit({ ...base, applied: false }, () =>
        process.stdout.write(
          `${c.green}✔${c.reset}  Nothing to fix — the matrix is already consistent.\n`
        )
      );
      process.exit(0);
    }

    if (!io.json) {
      process.stdout.write(
        `\n  ${c.bold}Planned fixes${c.reset} ${c.dim}(${actions.length})${c.reset}\n`
      );
      for (const a of actions) process.stdout.write(`    ${c.green}${a}${c.reset}\n`);
      process.stdout.write("\n");
    }

    if (opts.dryRun) {
      io.emit({ ...base, applied: false }, () =>
        process.stdout.write(`${c.dim}--dry-run: no changes written.${c.reset}\n`)
      );
      process.exit(0);
    }

    if (!opts.yes) {
      if (io.json) {
        io.usage({ ...NULL_SHAPE, projectDir, actions, dryRun: false }, [
          error("confirmation_required", "Refusing to write without confirmation.", {
            fix: "Re-run with --yes to apply unattended, or --dry-run to preview.",
          }),
        ]);
        return;
      }
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        process.stderr.write(
          `${c.red}✖${c.reset}  Refusing to write without confirmation. Re-run with --yes (or --dry-run to preview).\n`
        );
        process.exit(2);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`  Apply these ${actions.length} fix(es)? [y/N] `))
        .trim()
        .toLowerCase();
      rl.close();
      if (answer !== "y" && answer !== "yes") {
        process.stdout.write(`${c.dim}Aborted; no changes written.${c.reset}\n`);
        process.exit(1);
      }
    }

    fs.writeFileSync(tracePath, content, "utf8");
    io.emit({ ...base, applied: true }, () =>
      process.stdout.write(
        `${c.green}✔${c.reset}  Applied ${actions.length} fix(es) to docs/specs/traceability.md\n` +
          `   ${c.dim}Next: replace the TODO cells, then \`specgate validate --strict\`.${c.reset}\n`
      )
    );
    process.exit(0);
  }
}
