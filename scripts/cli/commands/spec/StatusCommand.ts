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

/** How many queue lines `status` prints before pointing at `plan` for the rest. */
const QUEUE_LIMIT = 12;

const TODO_CATEGORIES = ["NEEDS_FEATURE", "NEEDS_EVERYTHING", "NEEDS_TEST", "NEEDS_IMPLEMENTATION"];

/** What one requirement still needs, in words a person reads at a glance. */
export function needsOf(item: any): string {
  switch (item.category) {
    case "NEEDS_FEATURE":
      return "its scenario";
    case "NEEDS_EVERYTHING":
      return "a test and code";
    case "NEEDS_TEST":
      return "its test";
    case "NEEDS_IMPLEMENTATION":
      return "its code";
    case "NEEDS_STATUS_UPDATE":
      return "its test is in place";
    default:
      return "";
  }
}

/**
 * The one command to run next, named for a requirement when there is one.
 *
 * `status` used to answer "specgate plan" — a second command to find out what
 * the first one meant. The team found the tool hard to absorb, and a dashboard
 * that sends you elsewhere is part of why.
 */
export function nextCommandPlain({ items, counts, orphans }: any): string {
  const first = (cats: string[]) => (items || []).find((it: any) => cats.includes(it.category));
  if (orphans.length > 0) return "specgate fix";
  const ready = first(["NEEDS_STATUS_UPDATE"]);
  if (ready) return `specgate done ${ready.requirement} --strict`;
  const todo = first(TODO_CATEGORIES);
  if (todo) {
    if (todo.category === "NEEDS_FEATURE") return `specgate plan`;
    return `specgate req link ${todo.requirement} --test <path>`;
  }
  if (counts.total === 0) return 'specgate new "<what it does>"';
  return "specgate check";
}

function nextReason({ items, counts, orphans }: any): string {
  if (orphans.length > 0) return `${orphans.length} orphan feature file(s) not in the matrix`;
  if ((items || []).some((it: any) => it.category === "NEEDS_STATUS_UPDATE"))
    return "its test exists; close it through the gate";
  const todo = (items || []).find((it: any) => TODO_CATEGORIES.includes(it.category));
  if (todo && todo.category === "NEEDS_FEATURE")
    return `${todo.requirement}'s feature file is missing — plan shows which`;
  if (todo) return `write the test first, then record where it is`;
  if (counts.total === 0) return "no requirements yet";
  return "everything is implemented; run the gate";
}

function titleOf(item: any): string {
  const t = String(item.title || "")
    .replace(/^UC-\d+\s*/, "")
    .trim();
  return t && t !== "-" ? t : "";
}

function emitText(projectDir: string, summary: any, lock: any): void {
  const { items, counts, pending, orphans } = summary;
  process.stdout.write(
    `\n  ${c.bold}📊 Project status${c.reset}  ${c.dim}${path.basename(path.resolve(projectDir))}${c.reset}\n\n`
  );
  process.stdout.write(
    `  ${c.bold}Requirements${c.reset}  ${c.dim}${counts.total} total · ${counts.DONE} done · ${pending} pending${c.reset}\n`
  );

  const queue = (title: string, cats: string[], color: string) => {
    const group = items.filter((it: any) => cats.includes(it.category));
    if (group.length === 0) return;
    process.stdout.write(`\n  ${c.bold}${title}${c.reset}\n`);
    for (const it of group.slice(0, QUEUE_LIMIT)) {
      const name = titleOf(it);
      process.stdout.write(
        `    ${c.cyan}${String(it.requirement).padEnd(9)}${c.reset} ${(name.length > 44 ? name.slice(0, 43) + "…" : name).padEnd(45)} ${color}${needsOf(it)}${c.reset}\n`
      );
    }
    if (group.length > QUEUE_LIMIT)
      process.stdout.write(
        `    ${c.dim}… ${group.length - QUEUE_LIMIT} more — specgate plan lists them all${c.reset}\n`
      );
  };
  queue("Ready to close", ["NEEDS_STATUS_UPDATE"], c.green);
  queue("To do", TODO_CATEGORIES, c.yellow);

  if (orphans.length > 0)
    process.stdout.write(
      `\n  ${c.red}${orphans.length} orphan feature file(s)${c.reset} ${c.dim}— not in the matrix${c.reset}\n`
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
    `\n  ${c.bold}Next${c.reset}  ${c.green}${nextCommandPlain(summary)}${c.reset}  ${c.dim}— ${nextReason(summary)}${c.reset}\n\n`
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
        requirements: summary.items.map((it: any) => ({
          id: it.requirement,
          title: titleOf(it) || null,
          category: it.category,
          needs: needsOf(it) || null,
        })),
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
