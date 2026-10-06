import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability, classify, detectOrphans } from "./PlanCommand";
import { readLock } from "../../../specops/lock";
import { errorMessage } from "../../../lib/diagnostics";
import { BaseCommand } from "../../../lib/command";
import { runMonorepoFanout } from "../../../lib/monorepo-fanout";

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

export interface StatusOptions {
  projectDir: string;
  format: string;
}

export function parseArgs(argv: string[]): StatusOptions {
  const opts: StatusOptions = { projectDir: ".", format: "text" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--format" && argv[i + 1]) opts.format = argv[++i];
    else if (a === "--json") opts.format = "json";
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        `\n  ${c.bold}${c.cyan}📊 status${c.reset}  ${c.dim}— project state at a glance + what to do next${c.reset}\n\n` +
          `  ${c.bold}USAGE${c.reset}\n` +
          `    ${c.cyan}specgate status${c.reset} [--project-dir <path>] [--json]\n\n` +
          `  ${c.bold}OPTIONS${c.reset}\n` +
          `    ${c.green}--project-dir <path>${c.reset} ${c.dim}Project root (auto-detected from cwd if omitted).${c.reset}\n` +
          `    ${c.green}--json${c.reset}               ${c.dim}One JSON document on stdout; prose on stderr.${c.reset}\n` +
          `    ${c.green}-h, --help${c.reset}           ${c.dim}Show this help.${c.reset}\n\n`
      );
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  if (!["text", "json"].includes(opts.format)) {
    process.stderr.write(`Invalid --format: ${opts.format}. Expected: text | json.\n`);
    process.exit(2);
  }
  return opts;
}

export function summarise(projectDir: string, traceContent: string) {
  const rows = parseTraceability(traceContent);
  const items = rows.map((r) => classify(r, projectDir)).filter((x) => x !== null);
  const counts: Record<string, number> = {
    total: items.length,
    DONE: 0,
    NEEDS_FEATURE: 0,
    NEEDS_EVERYTHING: 0,
    NEEDS_TEST: 0,
    NEEDS_IMPLEMENTATION: 0,
    NEEDS_STATUS_UPDATE: 0,
  };
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;
  const pending = items.length - counts.DONE;
  const orphans = detectOrphans(projectDir, items);
  return { items, counts, pending, orphans };
}

function nextCommand({ counts, orphans }: any): string {
  if (orphans.length > 0)
    return `specgate fix  ${c.dim}— ${orphans.length} orphan feature file(s) not in the matrix${c.reset}`;
  if (counts.NEEDS_FEATURE > 0)
    return `specgate plan  ${c.dim}— ${counts.NEEDS_FEATURE} requirement(s) missing a .feature${c.reset}`;
  if (counts.NEEDS_EVERYTHING > 0 || counts.NEEDS_TEST > 0 || counts.NEEDS_IMPLEMENTATION > 0)
    return `specgate plan  ${c.dim}— requirements still need a test or code${c.reset}`;
  if (counts.NEEDS_STATUS_UPDATE > 0)
    return `specgate done <REQ>  ${c.dim}— ${counts.NEEDS_STATUS_UPDATE} requirement(s) ready to close${c.reset}`;
  if (counts.total === 0)
    return `specgate req add "<title>"  ${c.dim}— no requirements yet${c.reset}`;
  return `specgate validate --strict  ${c.dim}— everything implemented; gate it${c.reset}`;
}

export function nextCommandPlain({ counts, orphans }: any): string {
  if (orphans.length > 0) return "specgate fix";
  if (counts.NEEDS_FEATURE > 0) return "specgate plan";
  if (counts.NEEDS_EVERYTHING > 0 || counts.NEEDS_TEST > 0 || counts.NEEDS_IMPLEMENTATION > 0)
    return "specgate plan";
  if (counts.NEEDS_STATUS_UPDATE > 0) return "specgate done <REQ>";
  if (counts.total === 0) return 'specgate req add "<title>"';
  return "specgate validate --strict";
}

function emitText(projectDir: string, summary: any, lock: any): void {
  const { counts, pending, orphans } = summary;
  process.stdout.write(
    `\n  ${c.bold}📊 Project status${c.reset}  ${c.dim}${projectDir}${c.reset}\n\n`
  );

  process.stdout.write(
    `  ${c.bold}Requirements${c.reset}  ${c.dim}${counts.total} total · ${pending} pending${c.reset}\n`
  );
  const line = (label: string, n: number, color: string) =>
    n > 0 && process.stdout.write(`    ${color}${String(n).padStart(3)}${c.reset}  ${label}\n`);
  line("✅ done", counts.DONE, c.green);
  line("feature missing", counts.NEEDS_FEATURE, c.red);
  line("no test/code", counts.NEEDS_EVERYTHING, c.red);
  line("test missing", counts.NEEDS_TEST, c.yellow);
  line("code missing", counts.NEEDS_IMPLEMENTATION, c.yellow);
  line("ready to mark done", counts.NEEDS_STATUS_UPDATE, c.yellow);
  if (orphans.length > 0)
    process.stdout.write(
      `    ${c.red}${String(orphans.length).padStart(3)}${c.reset}  orphan feature file(s)\n`
    );

  if (lock && lock.packs && lock.packs.length > 0) {
    process.stdout.write(`\n  ${c.bold}Packs${c.reset}  ${c.dim}(.specops.lock)${c.reset}\n`);
    for (const p of lock.packs) {
      process.stdout.write(
        `    ${c.cyan}${p.pack_id || "?"}${c.reset} ${c.dim}@ ${p.version || "?"}${c.reset}\n`
      );
    }
  }

  process.stdout.write(
    `\n  ${c.bold}Next${c.reset}  ${c.green}${nextCommand(summary)}${c.reset}\n\n`
  );
}

function emitJson(projectDir: string, summary: any, lock: any): void {
  const { counts, pending, orphans } = summary;
  process.stdout.write(
    JSON.stringify(
      {
        schemaVersion: 1,
        projectDir: path.resolve(projectDir),
        total: counts.total,
        pending,
        counts,
        orphanFeatures: orphans,
        packs: lock && lock.packs ? lock.packs : [],
        nextCommand: nextCommandPlain(summary),
        status: [],
      },
      null,
      2
    ) + "\n"
  );
}

export class StatusCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err: any) {
      process.stderr.write(`${errorMessage(err)}\n`);
      process.exit(2);
    }

    const monorepo = runMonorepoFanout(projectDir, "status.js");
    if (monorepo !== null) {
      process.exit(monorepo.failures === 0 ? 0 : 1);
    }

    const tracePath = path.join(projectDir, "docs/specs/traceability.md");
    if (!fs.existsSync(tracePath)) {
      process.stderr.write(
        `${c.red}✖${c.reset}  docs/specs/traceability.md not found in ${projectDir}\n` +
          `   ${c.dim}Not a spec-driven project? Scaffold one with \`specgate init\`.${c.reset}\n`
      );
      process.exit(2);
    }

    const traceContent = fs.readFileSync(tracePath, "utf8");
    const summary = summarise(projectDir, traceContent);
    let lock = null;
    try {
      lock = readLock(projectDir);
    } catch {
      lock = null;
    }

    if (opts.format === "json") emitJson(projectDir, summary, lock);
    else emitText(projectDir, summary, lock);
    process.exit(0);
  }
}
