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
import { briefProgress, draftNextCommand, ModuleStatus, DEFAULT_BRIEF } from "./DraftCommand";
import { briefModules } from "../../../../packages/core/src/domain/DraftChecklist";
import { rootBrief } from "../../../draft/brief-setup";
import { isDerivedProject } from "../../../lib/derived-writes";
import { findForjaProject } from "../project/Forja";
import { inFlightView, InFlightView, unwrittenNotes } from "../../../lib/in-flight";

import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";

import { c, sym } from "../../../lib/ui";
import * as ui from "../../../lib/ui";
import { miniPet, petEnabled } from "../../../pet/pet";
import { petFor } from "./PetCommand";

/**
 * The lockfile, as far as `status` reads it. `readLock` returns the lock's
 * JSON untyped; this names the fields used here.
 */
interface Lockfile {
  packs?: Array<{ pack_id?: string; version?: string }>;
}

/**
 * One requirement in the queue `status` shows: the plan's item, with what the
 * queue adds to it. Both spellings of the feature path are declared because
 * both arrive — the plan's snake_case and a caller's camelCase.
 */
export interface QueueItem {
  requirement: string;
  /** A plan category, or `WAITING_FOR_ANSWER`, which only the queue knows. */
  category: string;
  status?: string;
  title?: string;
  feature_file?: string;
  featureFile?: string;
  /** The open question that blocks it, as `Q3 (docs/specs/…/questions.md)`. */
  question?: string | null;
  /** The open change it belongs to, while that change is in flight (ADR-0035). */
  change?: string;
  [key: string]: unknown;
}

/** The brief's progress, as `briefProgress` reports it. */
type BriefProgress = NonNullable<ReturnType<typeof briefProgress>>;

/** What `status`, `explore`, `pet` and `done` read about the queue. */
export interface QueueSummary {
  items: QueueItem[];
  counts: Record<string, number>;
  pending: number;
  orphans: string[];
  derived: boolean;
  forja: boolean;
  /** `alm.config.yaml` names Jira: the work arrives as tickets (REQ-158). */
  tickets?: boolean;
  /** Added by `status` itself; null when the brief cannot be read. */
  brief?: BriefProgress | null;
  /** The brief, when it exists and its front matter lists no module yet (REQ-243). */
  briefToFill?: string;
  /** A brief at the root that `briefToFill` does not hold yet (REQ-251). */
  rootBrief?: string;
}

/** What `nextCommandPlain` and `nextReason` read from a summary. */
type NextInput = Pick<
  QueueSummary,
  | "items"
  | "counts"
  | "orphans"
  | "derived"
  | "forja"
  | "brief"
  | "tickets"
  | "briefToFill"
  | "rootBrief"
>;

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

/**
 * `questionsFrom` is where the questions files are read: the project itself
 * when `projectDir` is the in-flight view, whose copy has every open change
 * moved under `changes/archive/` — a path that does not exist in the project.
 */
export function summarise(
  projectDir: string,
  traceContent: string,
  questionsFrom: string = projectDir
): QueueSummary {
  const rows = parseTraceability(traceContent);
  const items: QueueItem[] = rows.map((r) => classify(r, projectDir)).filter((x) => x !== null);
  // A requirement waiting for an answer is not work anyone can start: listing
  // it as "a test and code" under To do invited exactly that (FinCore, #73).
  const questions = questionsByRequirement(questionsFrom);
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
    tickets: readsTickets(projectDir),
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
  read: (summary: QueueSummary, dir: string, view: InFlightView | null) => T,
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
    const summary = summarise(dir, trace, projectDir);
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
export function nextRequirement(items: QueueItem[], except: string[] = []): QueueItem | null {
  const open = (items || []).filter((it) => !except.includes(it.requirement));
  return (
    open.find((it) => it.category === "NEEDS_STATUS_UPDATE") ||
    open.find((it) => TODO_CATEGORIES.includes(it.category) && !isBaseline(it)) ||
    null
  );
}

/** How many queue lines `status` prints before pointing at `plan` for the rest. */
const QUEUE_LIMIT = 12;

const TODO_CATEGORIES = ["NEEDS_FEATURE", "NEEDS_EVERYTHING", "NEEDS_TEST", "NEEDS_IMPLEMENTATION"];

/** What one requirement still needs, in words a person reads at a glance. */
export function needsOf(item: Pick<QueueItem, "category" | "question">): string {
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
function readsTickets(projectDir: string): boolean {
  try {
    return /^provider:\s*["']?jira["']?\s*$/m.test(
      fs.readFileSync(path.join(projectDir, "alm.config.yaml"), "utf8")
    );
  } catch {
    return false;
  }
}

const FROM_TICKET = "specgate propose --from-ticket <KEY> --check";

function onlyBaseline(items: QueueItem[]): boolean {
  const todo = (items || []).filter((it) => TODO_CATEGORIES.includes(it.category));
  return (
    todo.length === 1 &&
    String(todo[0].feature_file || todo[0].featureFile || "").includes("features/adoption/baseline")
  );
}

const isBaseline = (it: QueueItem) =>
  String(it.feature_file || it.featureFile || "").includes("features/adoption/baseline");

/** The first pending requirement that is not the adoption baseline. */
function firstReal(items: QueueItem[]): QueueItem | undefined {
  return (items || []).find((it) => TODO_CATEGORIES.includes(it.category) && !isBaseline(it));
}

/**
 * The brief's next module, when nothing real is waiting to be built: a
 * project that starts from a plan has nothing to build until it is drafted,
 * and "add a requirement" is the wrong advice for it (#94).
 */
function briefFirst({ items, brief }: Pick<NextInput, "items" | "brief">): ModuleStatus | null {
  return brief && brief.next && !firstReal(items) ? brief.next : null;
}

/**
 * In a forja project the next requirement's code has a place to go: `add
 * usecase` writes the use case there and the test that names the requirement
 * (ADR-0033). The name comes from the scenario's file; the module is the
 * user's to choose.
 */
export function forjaAddCommand(todo: QueueItem): string {
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
  // The module from the open change (draft-diario → diario) or the feature's
  // folder (features/diario/x.feature); "<module>" only when neither says (REQ-193).
  const folder = (/features[/\\]([^/\\]+)[/\\][^/\\]+\.feature/.exec(
    String(todo.featureFile || todo.feature_file || "")
  ) || [])[1];
  const module = todo.change ? todo.change.replace(/^draft-/, "") : folder || "<module>";
  return `specgate add usecase ${module}/${name} --req ${todo.requirement}`;
}

const needsCode = (todo: QueueItem) =>
  ["NEEDS_EVERYTHING", "NEEDS_TEST", "NEEDS_IMPLEMENTATION"].includes(todo.category);

export function nextCommandPlain({
  items,
  tickets,
  counts,
  orphans,
  derived,
  brief,
  forja,
  briefToFill,
}: NextInput): string {
  const first = (cats: string[]) => (items || []).find((it) => cats.includes(it.category));
  if (orphans.length > 0) return "specgate fix";
  const ready = first(["NEEDS_STATUS_UPDATE"]);
  if (ready) return `specgate apply ${ready.requirement}`;
  const module = briefFirst({ items, brief });
  if (module) return draftNextCommand(module);
  const todo = firstReal(items) || first(TODO_CATEGORIES);
  if (todo) {
    if (todo.category === "NEEDS_FEATURE") return `specgate plan`;
    // A project generated from a brief: the brief comes first (REQ-243).
    if (onlyBaseline(items) && briefToFill) return "specgate draft";
    if (onlyBaseline(items))
      return tickets ? FROM_TICKET : 'specgate new "<a behaviour you rely on>"';
    if (forja && needsCode(todo)) return forjaAddCommand(todo);
    // On a generated matrix a test that names its requirement is the link;
    // `apply` is what you run once it exists, and it checks first.
    if (derived) return `specgate apply ${todo.requirement}`;
    return `specgate req link ${todo.requirement} --test <path>`;
  }
  if (counts.total === 0 && briefToFill) return "specgate draft";
  if (counts.total === 0) return tickets ? FROM_TICKET : 'specgate new "<what it does>"';
  return "specgate check";
}

export function nextReason({
  items,
  counts,
  orphans,
  derived,
  brief,
  forja,
  tickets,
  briefToFill,
  rootBrief,
}: NextInput): string {
  if (orphans.length > 0) return `${orphans.length} orphan feature file(s) not in the matrix`;
  if ((items || []).some((it) => it.category === "NEEDS_STATUS_UPDATE"))
    return "its test exists; close it through the gate";
  const module = briefFirst({ items, brief });
  if (module)
    return module.state === "ready"
      ? `the ${module.module} draft is ready — review it, then apply its requirements`
      : // `briefFirst` returns a module only from a brief.
        `turn the ${module.module} module of ${brief!.brief} into requirements`;
  const todo =
    firstReal(items) || (items || []).find((it) => TODO_CATEGORIES.includes(it.category));
  if (todo && todo.category === "NEEDS_FEATURE")
    return `${todo.requirement}'s feature file is missing — plan shows which`;
  if ((todo && onlyBaseline(items)) || (!todo && counts.total === 0)) {
    if (briefToFill && rootBrief)
      return `${rootBrief} at the root looks like the brief: put its text below the front matter of ${briefToFill}, then draft`;
    if (briefToFill)
      return `fill in the front matter of ${briefToFill} — product, surfaces, actors, modules — then draft`;
  }
  if (todo && onlyBaseline(items))
    return tickets
      ? "the work comes from Jira — check a ticket is ready, then open its change"
      : "only the adoption baseline is specified — add one requirement your code already meets";
  if (todo && forja && needsCode(todo))
    return `${todo.requirement}'s use case and the test that names it, where the architecture expects them`;
  if (todo && derived)
    return `once a test mentions ${todo.requirement} — that mention is the link; apply checks first`;
  if (todo) return `write the test first, then record where it is`;
  if (counts.total === 0)
    return tickets ? "no requirements yet — start from a ticket" : "no requirements yet";
  if (counts.WAITING_FOR_ANSWER > 0)
    return `${counts.WAITING_FOR_ANSWER} wait for an answer; everything else is implemented — run the gate`;
  return "everything is implemented; run the gate";
}

function titleOf(item: Pick<QueueItem, "title">): string {
  const t = String(item.title || "")
    .replace(/^UC-\d+\s*/, "")
    .trim();
  return t && t !== "-" ? t : "";
}

function emitText(
  projectDir: string,
  summary: QueueSummary,
  lock: Lockfile | null,
  notes: Diagnostic[] = [],
  unwritten: Diagnostic[] = []
): void {
  const { items, counts, orphans } = summary;
  const out = (t: string) => process.stdout.write(t);
  out(ui.header("status", path.basename(path.resolve(projectDir))));
  out(`  ${c.bold}Requirements${c.reset}  ${ui.progress(counts.DONE, counts.total, "done")}\n`);

  const queue = (title: string, cats: string[], mark: string, color: string) => {
    const group = items.filter((it) => cats.includes(it.category));
    if (group.length === 0) return;
    out("\n" + ui.section(title));
    const rows = group.slice(0, QUEUE_LIMIT).map((it) => {
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
  const waiting = items.filter((it) => it.category === "WAITING_FOR_ANSWER" && it.question);
  if (waiting.length > 0)
    out(
      `    ${ui.muted(`Questions: ${[...new Set(waiting.map((it) => it.question))].join(" · ")}`)}\n`
    );

  if (orphans.length > 0)
    out(
      "\n" + ui.fail(`${orphans.length} orphan feature file(s) ${ui.muted("— not in the matrix")}`)
    );

  // Proposed, not written yet: not judged, and said, so nobody wonders why
  // the change is missing from the queue (ADR-0035).
  if (unwritten.length > 0) out("\n");
  for (const n of unwritten)
    out(`  ${ui.muted(`·  Change ${n.target} — delta not written yet, not judged until it is`)}\n`);

  if (notes.length > 0) {
    out("\n" + ui.section("Spec notes"));
    out(`    ${ui.muted("Not failures — ADR-0029")}\n`);
    for (const n of notes.slice(0, 5))
      out(`    ${c.warn}${sym.warn}${c.reset} ${ui.muted(n.code)}  ${n.message}\n`);
    if (notes.length > 5) out(`    ${ui.muted(`… ${notes.length - 5} more in --json`)}\n`);
  }

  if (summary.brief) {
    const b = summary.brief;
    // Drafted: written and checked. A ready draft is reviewed and applied
    // before it is archived (ADR-0035), so it counts as soon as it is ready.
    const done = b.modules.filter((m) => m.state === "archived" || m.state === "ready").length;
    out(
      `\n  ${c.bold}Brief${c.reset}         ${ui.progress(done, b.modules.length, "module(s) drafted")}` +
        `${b.next ? `   ${ui.muted("next:")} ${b.next.module}` : ""}   ${ui.muted(b.brief)}\n`
    );
  }

  if (lock && lock.packs && lock.packs.length > 0) {
    out("\n" + ui.section("Packs"));
    out(
      ui.table(
        lock.packs.map((p) => [
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

function emitJson(
  projectDir: string,
  summary: QueueSummary,
  lock: Lockfile | null,
  notes: Diagnostic[] = [],
  unwritten: Diagnostic[] = []
): void {
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
        requirements: summary.items.map((it) => ({
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
                modules: summary.brief.modules.map((m) => ({
                  module: m.module,
                  state: m.state,
                })),
              },
            }
          : {}),
        nextCommand: nextCommandPlain(summary),
        status: [...notes, ...unwritten],
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
    } catch (err) {
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

  private report(
    projectDir: string,
    opts: StatusOptions,
    summary: QueueSummary,
    dir: string
  ): void {
    try {
      summary.brief = briefProgress(projectDir);
    } catch {
      summary.brief = null;
    }
    // A brief that lists no module yet — forja's template, the client's text
    // pasted below it — is what to do next, not the adoption path (REQ-243).
    if (!summary.brief) {
      const text = fs.existsSync(path.join(projectDir, DEFAULT_BRIEF))
        ? fs.readFileSync(path.join(projectDir, DEFAULT_BRIEF), "utf8")
        : null;
      if (text !== null && briefModules(text).length === 0) {
        summary.briefToFill = DEFAULT_BRIEF;
        summary.rootBrief = rootBrief(projectDir, text) || undefined;
      }
    }
    let lock: Lockfile | null = null;
    try {
      lock = readLock(projectDir);
    } catch {
      lock = null;
    }

    // D4 and D5 on the project's own specification: notes, never failures.
    let notes: Diagnostic[] = [];
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

    const unwritten = unwrittenNotes(projectDir);
    if (opts.format === "json") emitJson(projectDir, summary, lock, notes, unwritten);
    else emitText(projectDir, summary, lock, notes, unwritten);
  }
}
