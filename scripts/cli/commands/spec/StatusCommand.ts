import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability, classify, detectOrphans } from "./PlanCommand";
import { readLock } from "../../../specops/lock";
import { errorMessage } from "../../../lib/diagnostics";
import { BaseCommand } from "../../../lib/command";
import { runMonorepoFanout } from "../../../lib/monorepo-fanout";
import {
  openQuestions,
  requirementTitles,
  specNotes,
} from "../../../../packages/core/src/domain/DraftChecklist";
import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";
import { derivedMatrixFor, refreshDerivedMatrix } from "./MatrixCommand";
import { briefProgress, draftNextCommand } from "./DraftCommand";
import { isDerivedProject } from "../../../lib/derived-writes";
import { findForjaProject } from "../project/Forja";
import { inFlightView, InFlightView } from "../../../lib/in-flight";

import { c, sym } from "../../../lib/ui";
import * as ui from "../../../lib/ui";
import { miniPet, petEnabled } from "../../../pet/pet";
import { petFor } from "./PetCommand";

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
  // A requirement waiting for an answer is not work anyone can start: listing
  // it as "a test and code" under To do invited exactly that (FinCore, #73).
  const questions = questionsByRequirement(projectDir);
  for (const it of items) {
    if (it.status === "Needs Clarification" && it.category !== "DONE") {
      it.category = "WAITING_FOR_ANSWER";
      it.question = questions.get(it.requirement) || null;
    }
  }
  const counts: Record<string, number> = {
    total: items.length,
    DONE: 0,
    NEEDS_FEATURE: 0,
    NEEDS_EVERYTHING: 0,
    NEEDS_TEST: 0,
    NEEDS_IMPLEMENTATION: 0,
    NEEDS_STATUS_UPDATE: 0,
    WAITING_FOR_ANSWER: 0,
  };
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;
  const pending = items.length - counts.DONE;
  const orphans = detectOrphans(projectDir, items);
  return {
    items,
    counts,
    pending,
    orphans,
    derived: isDerivedProject(projectDir),
    forja: findForjaProject(projectDir) !== null,
  };
}

/**
 * Requirement → the open question that blocks it, as `Q3 (docs/specs/…/questions.md)`,
 * from every `questions.md` under docs/specs/changes (archived ones included:
 * a draft is archived with its questions still open).
 */
function questionsByRequirement(projectDir: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "questions.md") {
        const rel = path.relative(projectDir, full).split(path.sep).join("/");
        for (const q of openQuestions(fs.readFileSync(full, "utf8"))) {
          for (const req of q.blocks) if (!found.has(req)) found.set(req, `${q.row} (${rel})`);
        }
      }
    }
  };
  walk(path.join(projectDir, "docs", "specs", "changes"));
  return found;
}

/**
 * The queue with open changes in it (ADR-0035): read from the project as it
 * will be after archive, each in-flight requirement marked with its change.
 * `read` runs while that view exists; it is removed afterwards.
 */
export function withQueue<T>(
  projectDir: string,
  read: (summary: any, dir: string, view: InFlightView | null) => T,
  opts: { write?: boolean } = {}
): T {
  const view = inFlightView(projectDir);
  try {
    const dir = view ? view.dir : projectDir;
    const onDisk = fs.readFileSync(path.join(dir, TRACE), "utf8");
    // Read-only callers (`explore`) see the matrix as it would be regenerated,
    // without writing it.
    let trace = onDisk;
    if (!view && opts.write === false) {
      if (isDerivedProject(projectDir)) trace = derivedMatrixFor(projectDir, onDisk);
    } else if (!view && refreshDerivedMatrix(projectDir)) {
      trace = fs.readFileSync(path.join(dir, TRACE), "utf8");
    }
    const summary: any = summarise(dir, trace);
    if (view) {
      for (const it of summary.items) {
        const owner = view.requirements.find((r) => r.id === it.requirement);
        if (owner) it.change = owner.change;
      }
    }
    return read(summary, dir, view);
  } finally {
    if (view) view.cleanup();
  }
}

const TRACE = path.join("docs", "specs", "traceability.md");

/**
 * The requirement `apply` takes when none is named: one whose test is in
 * place first, then the first still to do — never the adoption baseline,
 * never one waiting for an answer.
 */
export function nextRequirement(items: any[], except: string[] = []): any {
  const open = (items || []).filter((it: any) => !except.includes(it.requirement));
  return (
    open.find((it: any) => it.category === "NEEDS_STATUS_UPDATE") ||
    open.find((it: any) => TODO_CATEGORIES.includes(it.category) && !isBaseline(it)) ||
    null
  );
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
    case "WAITING_FOR_ANSWER":
      return item.question ? `an answer to ${String(item.question).split(" ")[0]}` : "an answer";
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
/**
 * The adoption baseline (`features/adoption/baseline.feature`) when it is all
 * that is pending: the next step is a real requirement, not that one's test.
 * After `init`, status used to say "specgate check — write REQ-001's test",
 * a command paired with an instruction about something else.
 */
function onlyBaseline(items: any[]): boolean {
  const todo = (items || []).filter((it: any) => TODO_CATEGORIES.includes(it.category));
  return (
    todo.length === 1 &&
    String(todo[0].feature_file || todo[0].featureFile || "").includes("features/adoption/baseline")
  );
}

const isBaseline = (it: any) =>
  String(it.feature_file || it.featureFile || "").includes("features/adoption/baseline");

/** The first pending requirement that is not the adoption baseline. */
function firstReal(items: any[]): any {
  return (items || []).find((it: any) => TODO_CATEGORIES.includes(it.category) && !isBaseline(it));
}

/**
 * The brief's next module, when nothing real is waiting to be built: a
 * project that starts from a plan has nothing to build until it is drafted,
 * and "add a requirement" is the wrong advice for it (#94).
 */
function briefFirst({ items, brief }: any): any {
  return brief && brief.next && !firstReal(items) ? brief.next : null;
}

/**
 * In a forja project the next requirement's code has a place to go: `add
 * usecase` writes the use case there and the test that names the requirement
 * (ADR-0033). The name comes from the scenario's file; the module is the
 * user's to choose.
 */
export function forjaAddCommand(todo: any): string {
  // The matrix may hold the file as a link (`[x](features/x.feature)`): take the name.
  const base =
    (/([^/\\[\]()`]+)\.feature/.exec(String(todo.featureFile || todo.feature_file || "")) ||
      [])[1] || "";
  const name =
    base
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join("") || "<Name>";
  return `specgate add usecase <module>/${name} --req ${todo.requirement}`;
}

const needsCode = (todo: any) =>
  ["NEEDS_EVERYTHING", "NEEDS_TEST", "NEEDS_IMPLEMENTATION"].includes(todo.category);

export function nextCommandPlain({ items, counts, orphans, derived, brief, forja }: any): string {
  const first = (cats: string[]) => (items || []).find((it: any) => cats.includes(it.category));
  if (orphans.length > 0) return "specgate fix";
  const ready = first(["NEEDS_STATUS_UPDATE"]);
  if (ready) return `specgate apply ${ready.requirement}`;
  const module = briefFirst({ items, brief });
  if (module) return draftNextCommand(module);
  const todo = firstReal(items) || first(TODO_CATEGORIES);
  if (todo) {
    if (todo.category === "NEEDS_FEATURE") return `specgate plan`;
    if (onlyBaseline(items)) return 'specgate new "<a behaviour you rely on>"';
    if (forja && needsCode(todo)) return forjaAddCommand(todo);
    // On a generated matrix a test that names its requirement is the link;
    // `apply` is what you run once it exists, and it checks first.
    if (derived) return `specgate apply ${todo.requirement}`;
    return `specgate req link ${todo.requirement} --test <path>`;
  }
  if (counts.total === 0) return 'specgate new "<what it does>"';
  return "specgate check";
}

export function nextReason({ items, counts, orphans, derived, brief, forja }: any): string {
  if (orphans.length > 0) return `${orphans.length} orphan feature file(s) not in the matrix`;
  if ((items || []).some((it: any) => it.category === "NEEDS_STATUS_UPDATE"))
    return "its test exists; close it through the gate";
  const module = briefFirst({ items, brief });
  if (module)
    return module.state === "ready"
      ? `the ${module.module} draft is ready — review it, then apply its requirements`
      : `turn the ${module.module} module of ${brief.brief} into requirements`;
  const todo =
    firstReal(items) || (items || []).find((it: any) => TODO_CATEGORIES.includes(it.category));
  if (todo && todo.category === "NEEDS_FEATURE")
    return `${todo.requirement}'s feature file is missing — plan shows which`;
  if (todo && onlyBaseline(items))
    return "only the adoption baseline is specified — add one requirement your code already meets";
  if (todo && forja && needsCode(todo))
    return `${todo.requirement}'s use case and the test that names it, where the architecture expects them`;
  if (todo && derived)
    return `once a test mentions ${todo.requirement} — that mention is the link; apply checks first`;
  if (todo) return `write the test first, then record where it is`;
  if (counts.total === 0) return "no requirements yet";
  if (counts.WAITING_FOR_ANSWER > 0)
    return `${counts.WAITING_FOR_ANSWER} wait for an answer; everything else is implemented — run the gate`;
  return "everything is implemented; run the gate";
}

function titleOf(item: any): string {
  const t = String(item.title || "")
    .replace(/^UC-\d+\s*/, "")
    .trim();
  return t && t !== "-" ? t : "";
}

function emitText(projectDir: string, summary: any, lock: any, notes: any[] = []): void {
  const { items, counts, orphans } = summary;
  const out = (t: string) => process.stdout.write(t);
  out(ui.header("status", path.basename(path.resolve(projectDir))));
  out(`  ${c.bold}Requirements${c.reset}  ${ui.progress(counts.DONE, counts.total, "done")}\n`);

  const queue = (title: string, cats: string[], mark: string, color: string) => {
    const group = items.filter((it: any) => cats.includes(it.category));
    if (group.length === 0) return;
    out("\n" + ui.section(title));
    const rows = group.slice(0, QUEUE_LIMIT).map((it: any) => {
      const name = titleOf(it);
      return [
        `${mark} ${c.accent}${it.requirement}${c.reset}`,
        name.length > 44 ? name.slice(0, 43) + "…" : name,
        `${color}${needsOf(it)}${c.reset}`,
      ];
    });
    out(ui.table(rows));
    if (group.length > QUEUE_LIMIT)
      out(
        `    ${ui.muted(`… ${group.length - QUEUE_LIMIT} more — specgate plan lists them all`)}\n`
      );
  };
  queue("Ready to close", ["NEEDS_STATUS_UPDATE"], ui.state("ready"), c.ok);
  queue("To do", TODO_CATEGORIES, ui.state("todo"), c.warn);
  queue("Waiting for an answer", ["WAITING_FOR_ANSWER"], ui.state("blocked"), c.muted);
  const waiting = items.filter((it: any) => it.category === "WAITING_FOR_ANSWER" && it.question);
  if (waiting.length > 0)
    out(
      `    ${ui.muted(`Questions: ${[...new Set(waiting.map((it: any) => it.question))].join(" · ")}`)}\n`
    );

  if (orphans.length > 0)
    out(
      "\n" + ui.fail(`${orphans.length} orphan feature file(s) ${ui.muted("— not in the matrix")}`)
    );

  if (notes.length > 0) {
    out("\n" + ui.section("Spec notes"));
    out(`    ${ui.muted("Not failures — ADR-0029")}\n`);
    for (const n of notes.slice(0, 5))
      out(`    ${c.warn}${sym.warn}${c.reset} ${ui.muted(n.code)}  ${n.message}\n`);
    if (notes.length > 5) out(`    ${ui.muted(`… ${notes.length - 5} more in --json`)}\n`);
  }

  if (summary.brief) {
    const b = summary.brief;
    const done = b.modules.filter((m: any) => m.state === "archived").length;
    out(
      `\n  ${c.bold}Brief${c.reset}         ${ui.progress(done, b.modules.length, "module(s) drafted")}` +
        `${b.next ? `   ${ui.muted("next:")} ${b.next.module}` : ""}   ${ui.muted(b.brief)}\n`
    );
  }

  if (lock && lock.packs && lock.packs.length > 0) {
    out("\n" + ui.section("Packs"));
    out(
      ui.table(
        lock.packs.map((p: any) => [
          `${c.accent}${p.pack_id || "?"}${c.reset}`,
          ui.muted(`@ ${p.version || "?"}`),
        ])
      )
    );
  }

  out(ui.next(nextCommandPlain(summary), nextReason(summary)));
  // The cat, at the foot of the dashboard: a terminal only — never in a log, a
  // pipe or CI, where it would be noise — and gone with `config set pet off`.
  const showPet =
    process.env.SPECGATE_PET === "1" ||
    (!!process.stdout.isTTY && !process.env.CI && process.env.SPECGATE_NESTED !== "1");
  if (showPet && petEnabled(projectDir)) {
    const view = petFor(projectDir, summary);
    if (view) out(miniPet(view));
  }
  // A bare `specgate` shows this screen: say where the rest of the tool is.
  if (process.env.SPECGATE_BARE === "1") out(`  ${ui.muted("All commands: specgate --help")}\n\n`);
}

function emitJson(projectDir: string, summary: any, lock: any, notes: any[] = []): void {
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
          ...(it.change ? { change: it.change } : {}),
          ...(it.category === "WAITING_FOR_ANSWER" ? { question: it.question || null } : {}),
        })),
        ...(summary.brief
          ? {
              brief: {
                path: summary.brief.brief,
                modules: summary.brief.modules.map((m: any) => ({
                  module: m.module,
                  state: m.state,
                })),
              },
            }
          : {}),
        nextCommand: nextCommandPlain(summary),
        status: notes,
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

    // A generated matrix is a cache: read it fresh — with the open changes'
    // requirements in it, as they will be after archive (ADR-0035).
    withQueue(projectDir, (summary, dir) => this.report(projectDir, opts, summary, dir));
    process.exit(0);
  }

  private report(projectDir: string, opts: StatusOptions, summary: any, dir: string): void {
    try {
      summary.brief = briefProgress(projectDir);
    } catch {
      summary.brief = null;
    }
    let lock = null;
    try {
      lock = readLock(projectDir);
    } catch {
      lock = null;
    }

    // D4 and D5 on the project's own specification: notes, never failures.
    let notes: any[] = [];
    try {
      const sources = readDerivationSources(dir);
      const specs = [{ path: "spec.md", source: sources.spec }, ...(sources.capabilities || [])];
      notes = specNotes(specs, sources.features);
      // A row with no use case still has a title in its spec section (#48).
      const titles = requirementTitles(specs);
      for (const it of summary.items) {
        if (!titleOf(it) && titles.has(it.requirement)) it.title = titles.get(it.requirement);
      }
    } catch {
      notes = [];
    }

    if (opts.format === "json") emitJson(projectDir, summary, lock, notes);
    else emitText(projectDir, summary, lock, notes);
  }
}
