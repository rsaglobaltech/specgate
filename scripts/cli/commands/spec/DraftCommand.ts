/**
 * `specgate draft` — from a plan or brief to a reviewed specification, one
 * module at a time. (ADR-0029, docs/specs/draft-from-brief.md)
 *
 *   specgate draft                  the brief's modules, where each stands, what next
 *   specgate draft <module>         open the module's draft, or check it
 *   specgate draft <module> --agent "claude -p"   have an agent write it, then check it
 *   specgate draft --check <id>     the checklist on any change, as before
 *
 * Most projects start from a plan, and the path from that plan to a draft
 * used to take four commands, a hand edit of `change.yaml` and a prompt the
 * user had to write (#93, #94). `draft <module>` is the one command a person
 * repeats: the first run opens the draft and leaves `DRAFTING.md` for
 * whoever writes it; every run after that checks it and says what is next.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error, info } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import {
  actorSurfaces,
  briefModules,
  checkDraft,
  requirementTitles,
} from "../../../../packages/core/src/domain/DraftChecklist";
import {
  CHANGE_ID_RE,
  listArchivedIds,
  renderConfig,
  reserveReqRange,
  DEFAULT_CONFIG,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { templateDelta } from "../../../../packages/core/src/domain/ChangeTemplates";
import { phrases } from "../../../../packages/core/src/infrastructure/DiskLanguageRepository";
import { draftingGuide, draftingPrompt } from "../../../draft/drafting-guide";
import {
  NO_WRITE_HINT,
  runConfinedAgent,
  withWritePermission,
} from "../../../draft/confined-agent";
import {
  BRIEF_SETUP_FILE,
  BRIEF_SETUP_PASTE,
  BRIEF_TEMPLATE,
  briefBody,
  briefSetupGuide,
  briefSetupPrompt,
  checkFrontMatter,
  frontMatter,
  frontMatterExplanation,
  noBriefExplanation,
} from "../../../draft/brief-setup";
import { specgateTagsByScenario } from "../../../../packages/core/src/domain/GherkinTags";
import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";

const CHANGES = path.join("docs", "specs", "changes");

export interface DraftOptions {
  check: string;
  /** `draft <module>`: the module to open or check. */
  module: string;
  brief: string;
  maxRequirements: number;
  /** Requirement ids a new draft reserves. */
  reserve: number;
  agent: string;
  /** `--new-brief`: write docs/brief.md from the template. */
  newBrief: boolean;
  projectDir: string;
  json: boolean;
}

/** Where `specgate draft` looks for the plan when `--brief` is not given. */
export const DEFAULT_BRIEF = "docs/brief.md";
const DEFAULT_RESERVE = 10;

/** `draft-bookings` → `bookings`; any other change id → `--check <id>`. */
export function draftModuleOf(changeId: string): string {
  return changeId.startsWith("draft-") ? changeId.slice("draft-".length) : `--check ${changeId}`;
}

function usage(): string {
  return (
    "Usage:\n" +
    "  specgate draft                       your brief's modules, and the one to do next\n" +
    "  specgate draft <module>              open that module's draft — or check it, once it exists\n" +
    '  specgate draft <module> --agent "claude -p"\n' +
    "                                       have your agent write it, then check it\n" +
    "  specgate draft --check <change-id>   the checklist on any change\n" +
    "  specgate draft --new-brief           write docs/brief.md to fill in, when you have none\n" +
    '  specgate draft --agent "claude -p"   have your agent propose the brief\'s front matter\n\n' +
    "  --brief <file>   Your plan or brief (default: docs/brief.md). Any markdown; a front\n" +
    "                   matter with modules, actors and surfaces lets the checklist do more.\n" +
    "  --reserve <n>    Requirement ids a new draft reserves (default 10, at most the --max-requirements).\n" +
    "  --agent <cmd>    Your agent's command. It gets the drafting guide on standard input,\n" +
    "                   or in a file if the command contains {prompt_file}. Whatever it writes\n" +
    "                   outside the draft is undone.\n" +
    "  [--max-requirements <n>] [--project-dir <dir>] [--json]\n\n" +
    "The checklist (ADR-0029):\n" +
    "  D1 every requirement has a scenario          D5 a cited law or standard names its source\n" +
    "  D2 every requirement has a kind              D6 a stated value is in the brief or an assumption\n" +
    "  D3 a scenario per surface each actor uses    D7 an open question names what it blocks\n" +
    "  D4 a non-functional requirement is measured  D8 the draft is small enough to review\n" +
    "                                                D9 every scenario passes the harness gate's rules\n" +
    "                                                D10 no id the project already uses\n" +
    "                                                D12 an actor can get the ids it acts on\n\n" +
    "Without a brief, D3 and D6 cannot run, and the report says so.\n"
  );
}

export function parseArgs(argv: string[]): DraftOptions {
  const o: DraftOptions = {
    check: "",
    module: "",
    brief: "",
    maxRequirements: 25,
    reserve: DEFAULT_RESERVE,
    agent: "",
    newBrief: false,
    projectDir: ".",
    json: wantsJson(argv),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--check") o.check = value();
    else if (a === "--brief") o.brief = value();
    else if (a === "--max-requirements") o.maxRequirements = Number(value());
    else if (a === "--reserve") o.reserve = Number(value());
    else if (a === "--agent") o.agent = value();
    else if (a === "--new-brief") o.newBrief = true;
    else if (a === "--project-dir") o.projectDir = value();
    else if (a === "--json") o.json = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    } else if (!a.startsWith("-") && !o.module) o.module = a;
    else throw new Error(`unknown argument ${a}`);
  }
  if (o.check && o.module) {
    throw new Error("give a module or --check <change-id>, not both");
  }
  if (o.module && !CHANGE_ID_RE.test(o.module)) {
    throw new Error(
      `"${o.module}" is not a module name: use lowercase words and dashes, e.g. bookings`
    );
  }
  if (!Number.isInteger(o.maxRequirements) || o.maxRequirements < 1) {
    throw new Error("--max-requirements needs a positive integer");
  }
  if (!Number.isInteger(o.reserve) || o.reserve < 1 || o.reserve > o.maxRequirements) {
    throw new Error(`--reserve needs a whole number from 1 to ${o.maxRequirements}`);
  }
  if (o.newBrief && (o.module || o.check || o.agent)) {
    throw new Error("--new-brief only writes the brief: run it on its own");
  }
  if (o.agent && o.check) {
    throw new Error("--agent drafts a module, or proposes the brief's front matter — not --check");
  }
  return o;
}

function specFiles(dir: string, rel = ""): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...specFiles(dir, child));
    else if (e.name === "spec.md") out.push(child);
  }
  return out;
}

/** `spec.md` and the capability specs: values already reviewed in this project (#52). */
function projectSpecText(projectDir: string): string {
  try {
    const sources = readDerivationSources(projectDir);
    return [sources.spec || "", ...(sources.capabilities || []).map((c: any) => c.source)].join(
      "\n"
    );
  } catch {
    return "";
  }
}

/** The project's specification files, for D12's "where does this actor get the id". */
function projectSpecs(projectDir: string): Array<{ source: string }> {
  try {
    const sources = readDerivationSources(projectDir);
    return [sources.spec || "", ...(sources.capabilities || []).map((c: any) => c.source)].map(
      (source) => ({ source })
    );
  } catch {
    return [];
  }
}

/** REQ and SCN ids the project already uses, each with the requirement that owns it (#55). */
function projectIds(projectDir: string): Map<string, string> {
  const owners = new Map<string, string>();
  try {
    const sources = readDerivationSources(projectDir);
    const specs = [sources.spec || "", ...(sources.capabilities || []).map((c: any) => c.source)];
    for (const id of requirementTitles(specs.map((source) => ({ source }))).keys()) {
      owners.set(id, id);
    }
    for (const f of sources.features || []) {
      for (const tags of Object.values(specgateTagsByScenario(f.source))) {
        const req = tags.find((t) => /^@REQ-/.test(t));
        for (const t of tags.filter((x) => /^@SCN-/.test(x))) {
          if (req) owners.set(t.slice(1), req.slice(1));
        }
      }
    }
  } catch {
    /* no project specification yet: nothing can collide */
  }
  return owners;
}

const readIf = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined);

/** `assumptions.md` of every archived change, for MODIFIED requirements (#81). */
export function archivedAssumptions(projectDir: string): string {
  const archive = path.join(projectDir, CHANGES, "archive");
  let dirs: string[] = [];
  try {
    dirs = fs.readdirSync(archive).sort();
  } catch {
    return "";
  }
  return dirs
    .map((d) => readIf(path.join(archive, d, "assumptions.md")) || "")
    .filter(Boolean)
    .join("\n");
}

/** Whether a change was opened from a brief (`brief:` in change.yaml): a draft. */
export function briefOf(projectDir: string, changeId: string): string | undefined {
  const yaml = readIf(path.join(projectDir, CHANGES, changeId, "change.yaml")) || "";
  const m = /^brief:\s*["']?([^"'\n]+)["']?\s*$/m.exec(yaml);
  return m ? m[1].trim() : undefined;
}

/**
 * The checklist on one change, as `draft --check` runs it. Shared with
 * `change archive`, which refuses a draft that does not pass it (#57).
 */
export function draftReport(
  projectDir: string,
  changeId: string,
  briefOption = "",
  maxRequirements = 25
): { report: ReturnType<typeof checkDraft> } | { failure: ReturnType<typeof error> } {
  const changeDir = path.join(projectDir, CHANGES, changeId);
  if (!fs.existsSync(changeDir)) {
    return {
      failure: error("draft_no_change", `No change '${changeId}' under ${CHANGES}/.`, {
        fix: "specgate change list — or open one with `specgate change new <id>`.",
      }),
    };
  }
  const specs = path.join(changeDir, "specs");
  const deltas = specFiles(specs).map((rel) => ({
    path: path.join(CHANGES, changeId, "specs", rel).split(path.sep).join("/"),
    source: fs.readFileSync(path.join(specs, rel), "utf8"),
  }));
  if (deltas.length === 0) {
    return {
      failure: error(
        "draft_no_specs",
        `Change '${changeId}' has no specs/<capability>/spec.md to check.`
      ),
    };
  }
  // The brief: --brief, else `brief: <path>` in change.yaml.
  const briefPath = briefOption || briefOf(projectDir, changeId);
  let brief: string | undefined;
  if (briefPath) {
    brief = readIf(path.resolve(projectDir, briefPath));
    if (brief === undefined) {
      return { failure: error("draft_no_brief", `The brief ${briefPath} does not exist.`) };
    }
  }
  return {
    report: checkDraft({
      deltas,
      brief,
      assumptions: readIf(path.join(changeDir, "assumptions.md")),
      archivedAssumptions: archivedAssumptions(projectDir),
      specText: projectSpecText(projectDir),
      idsInUse: projectIds(projectDir),
      specs: projectSpecs(projectDir),
      questions: readIf(path.join(changeDir, "questions.md")),
      maxRequirements,
    }),
  };
}

// ── draft <module> and draft: the brief-first path ─────────────────────────────

/** Where a module of the brief stands. */
export type ModuleState = "not started" | "not written" | "drafting" | "ready" | "archived";

export interface ModuleStatus {
  module: string;
  change: string;
  state: ModuleState;
  /** Open checklist findings, while drafting. */
  findings: number;
  /** The archive directory's name, once archived. */
  archivedAs?: string;
}

/** The placeholder `templateDelta` writes: a draft nobody has written yet. */
const PLACEHOLDER = "feature=features/<area>/<name>.feature";

function deltaSources(projectDir: string, changeId: string): string[] {
  const specs = path.join(projectDir, CHANGES, changeId, "specs");
  return specFiles(specs).map((rel) => fs.readFileSync(path.join(specs, rel), "utf8"));
}

export function moduleStatus(projectDir: string, module: string, brief = ""): ModuleStatus {
  const change = `draft-${module}`;
  const archived = listArchivedIds(projectDir).find(
    (id) => id === change || id.endsWith(`-${change}`)
  );
  const base = { module, change, findings: 0 };
  if (!fs.existsSync(path.join(projectDir, CHANGES, change))) {
    return archived
      ? { ...base, state: "archived", archivedAs: archived }
      : { ...base, state: "not started" };
  }
  const deltas = deltaSources(projectDir, change);
  if (deltas.length === 0 || deltas.every((d) => d.includes(PLACEHOLDER))) {
    return { ...base, state: "not written" };
  }
  const result = draftReport(projectDir, change, brief);
  if ("failure" in result) return { ...base, state: "drafting", findings: 1 };
  const findings = result.report.status.length;
  return { ...base, state: findings === 0 ? "ready" : "drafting", findings };
}

/**
 * Where the brief stands, for `status`: its modules, and the first one not
 * yet archived. Null when there is no brief, or it lists no modules.
 */
export function briefProgress(
  projectDir: string
): { brief: string; modules: ModuleStatus[]; next?: ModuleStatus } | null {
  const text = readIf(path.join(projectDir, DEFAULT_BRIEF));
  if (text === undefined) return null;
  const modules = briefModules(text).map((m) => moduleStatus(projectDir, m));
  if (modules.length === 0) return null;
  return { brief: DEFAULT_BRIEF, modules, next: modules.find((m) => m.state !== "archived") };
}

/** What to run for this module, given where it stands. */
export function draftNextCommand(s: ModuleStatus): string {
  return s.state === "ready" ? `specgate change archive ${s.change}` : `specgate draft ${s.module}`;
}

/** Each module of the brief and where it stands, on one line: `auth ✔ ready · catalog ○ not started`. */
function briefLine(projectDir: string, brief: string): string | null {
  const text = readIf(path.resolve(projectDir, brief));
  const modules = text === undefined ? [] : briefModules(text);
  if (modules.length < 2) return null;
  const mark: Record<ModuleState, string> = {
    archived: "✔ archived",
    ready: "● ready",
    drafting: "◐ drafting",
    "not written": "○ opened",
    "not started": "○ not started",
  };
  const states = modules.map((m) => moduleStatus(projectDir, m, brief));
  const done = states.filter((s) => s.state === "archived").length;
  return (
    states.map((s) => `${s.module} ${mark[s.state]}`).join(" · ") +
    `   (${done} of ${modules.length} archived)`
  );
}

/** The first module of the brief, other than this one, not yet archived. */
function nextModuleAfter(projectDir: string, brief: string, current: string): string | null {
  const text = readIf(path.resolve(projectDir, brief));
  if (text === undefined) return null;
  return (
    briefModules(text).find(
      (m) => m !== current && moduleStatus(projectDir, m, brief).state !== "archived"
    ) || null
  );
}

/** `docs/specs/BRIEF-SETUP.md`: the guide an agent follows to propose the front matter. */
function writeSetupGuide(projectDir: string, brief: string): void {
  const file = path.join(projectDir, BRIEF_SETUP_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, briefSetupGuide(brief), "utf8");
}

/** The next free SCN number, past every scenario the project or a change uses. */
function nextScenario(projectDir: string): string {
  let max = 0;
  for (const id of projectIds(projectDir).keys()) {
    const m = /^SCN-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md") || e.name.endsWith(".feature")) {
        for (const m of fs.readFileSync(full, "utf8").matchAll(/\bSCN-(\d+)\b/g)) {
          max = Math.max(max, Number(m[1]));
        }
      }
    }
  };
  walk(path.join(projectDir, "docs", "specs"));
  walk(path.join(projectDir, "features"));
  for (const m of (readIf(path.join(projectDir, "spec.md")) || "").matchAll(/\bSCN-(\d+)\b/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return `SCN-${String(max + 1).padStart(3, "0")}`;
}

/** The one line to paste into any agent. */
export function pasteLine(module: string): string {
  return `Draft the ${module} module: follow ${CHANGES.split(path.sep).join("/")}/draft-${module}/DRAFTING.md`;
}

function proposalFor(module: string, changeId: string, brief: string): string {
  return [
    `# Proposal: ${changeId}`,
    "",
    "## Intent",
    "",
    `The ${module} module of the brief (\`${brief}\`), written down as requirements and`,
    "scenarios a person can review before anything is built.",
    "",
    "## Scope",
    "",
    `In scope: what the brief says about ${module}.`,
    "",
    "Out of scope: every other module of the brief.",
    "",
  ].join("\n");
}

/** Open `draft-<module>`: the change, linked to the brief, with its guide. */
function openDraft(projectDir: string, module: string, brief: string, o: DraftOptions) {
  const changeId = `draft-${module}`;
  const dir = path.join(projectDir, CHANGES, changeId);
  const reqRange = reserveReqRange(projectDir, o.reserve) as [string, string];
  const config = {
    ...DEFAULT_CONFIG,
    created: new Date().toISOString().slice(0, 10),
    rigor: "lite",
    req_range: reqRange,
  };
  const briefText = fs.readFileSync(path.resolve(projectDir, brief), "utf8");
  const created: string[] = [];
  const write = (rel: string, contents: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, "utf8");
    created.push(path.join(CHANGES, changeId, rel).split(path.sep).join("/"));
  };
  write(
    "DRAFTING.md",
    draftingGuide({
      module,
      changeId,
      brief,
      reqRange,
      firstScenario: nextScenario(projectDir),
      maxRequirements: o.maxRequirements,
      actors: actorSurfaces(briefText),
    })
  );
  write(
    path.join("specs", module, "spec.md"),
    templateDelta(module, reqRange[0], phrases(projectDir))
  );
  write("change.yaml", `${renderConfig(config).trimEnd()}\nbrief: ${brief}\n`);
  write("proposal.md", proposalFor(module, changeId, brief));
  return { changeId, reqRange, created };
}

const ICON: Record<ModuleState, string> = {
  "not started": "○",
  "not written": "○",
  drafting: "✎",
  ready: "✔",
  archived: "✔",
};

function describe(s: ModuleStatus): string {
  if (s.state === "drafting") return `drafting — ${s.findings} finding(s) to fix`;
  if (s.state === "ready") return "ready to review";
  if (s.state === "archived") return `archived (${s.archivedAs})`;
  if (s.state === "not written") return "opened, not written yet";
  return "not started";
}

/** What to run after this module, given where it stands. */
function nextFor(s: ModuleStatus | undefined): string {
  return s ? draftNextCommand(s) : "specgate status";
}

export class DraftCommand extends BaseCommand {
  public execute(): void {
    const io0 = agentIo(wantsJson(this.args));
    let o: DraftOptions;
    try {
      o = parseArgs(this.args);
    } catch (err: any) {
      io0.usage({ draft: null }, [
        error("draft_usage", err.message, { fix: "specgate draft --help" }),
      ]);
    }
    const opts = o!;
    if (opts.check) return this.check(opts);
    if (opts.module) return this.module(opts);
    return this.overview(opts);
  }

  /** The brief's path and text, or the failure that says where to put it. */
  private brief(projectDir: string, opts: DraftOptions, linked?: string) {
    const rel = opts.brief || linked || DEFAULT_BRIEF;
    const text = readIf(path.resolve(projectDir, rel));
    if (text !== undefined) return { rel, text };
    const io = agentIo(opts.json);
    io.fail({ draft: null }, [
      error("draft_no_brief", `No plan or brief at ${rel}.`, {
        fix:
          `Save your plan or brief as ${DEFAULT_BRIEF} — any markdown — then run \`specgate draft\`. ` +
          "Somewhere else: --brief <file>.",
      }),
    ]);
  }

  // ── specgate draft ──────────────────────────────────────────────────────────

  private overview(opts: DraftOptions): void {
    const io = agentIo(opts.json);
    const projectDir = resolveProjectDir(opts.projectDir);
    const rel = opts.brief || DEFAULT_BRIEF;
    const file = path.resolve(projectDir, rel);
    if (opts.newBrief) return this.newBrief(opts, file, rel);

    const text = readIf(file);
    // (a) No brief: what one is, and how to get one.
    if (text === undefined) {
      if (!opts.json) {
        process.stdout.write(`\n${noBriefExplanation(rel)}\n`);
        process.exitCode = 1;
        return;
      }
      io.fail({ draft: null }, [
        error("draft_no_brief", `No plan or brief at ${rel}.`, {
          fix:
            `Save your plan or brief as ${rel} — any markdown — then run \`specgate draft\`. ` +
            "No plan yet: `specgate draft --new-brief` writes one to fill in. Somewhere else: --brief <file>.",
        }),
      ]);
    }
    const brief = { rel, text: text! };
    if (opts.agent) return this.frontMatterWithAgent(opts, projectDir, brief);

    // (b) No front matter: every field, explained, and the agent to propose it.
    if (frontMatter(brief.text) === null) {
      writeSetupGuide(projectDir, rel);
      io.emit(
        {
          draft: {
            brief: rel,
            frontMatter: null,
            guide: BRIEF_SETUP_FILE,
            prompt: BRIEF_SETUP_PASTE,
            next: 'specgate draft --agent "claude -p"',
          },
        },
        () =>
          process.stdout.write(
            `\n  specgate draft  ·  ${rel}\n\n` +
              frontMatterExplanation(rel) +
              "\n  Or let your agent propose it from your brief. Paste this into Claude Code,\n" +
              "  Cursor, Codex…:\n\n" +
              `    ${BRIEF_SETUP_PASTE}\n\n` +
              '  or let Specgate call it:  specgate draft --agent "claude -p"\n\n' +
              "  Either way, review the four fields, then run  specgate draft  again.\n\n"
          )
      );
      return;
    }

    // (c) A front matter with problems: each in plain words, with its fix.
    const problems = checkFrontMatter(brief.text);
    if (problems.length > 0) {
      io.emit(
        {
          draft: { brief: rel, frontMatter: "invalid", next: `edit ${rel}, then specgate draft` },
          status: problems.map((p) => error(p.code, p.message, { fix: p.fix })),
        },
        () => {
          const out = process.stdout;
          out.write(`\n  specgate draft  ·  ${rel}\n\n`);
          out.write(
            `  The front matter at the top of ${rel} needs ${problems.length} fix(es):\n\n`
          );
          for (const p of problems) out.write(`  ✖  ${p.message}\n     ${p.fix}\n`);
          out.write(`\n  Next  fix them in ${rel}, then  specgate draft\n\n`);
        }
      );
      process.exitCode = 1;
      return;
    }

    // (d) Ready: the modules, where each stands, what is next.
    const modules = briefModules(brief.text);
    const states = modules.map((m) => moduleStatus(projectDir, m, rel));
    const pending = states.find((s) => s.state !== "archived");
    const next = nextFor(pending);
    const product = /^product:\s*(.+)$/m.exec(frontMatter(brief.text) || "");

    io.emit({ draft: { brief: rel, modules: states, next } }, () => {
      const out = process.stdout;
      out.write(`\n  specgate draft  ·  ${rel}\n\n`);
      if (product) out.write(`  Product  ${product[1].trim()}\n\n`);
      const width = Math.max(...modules.map((m) => m.length));
      out.write("  Modules\n");
      for (const s of states) {
        out.write(`    ${ICON[s.state]} ${s.module.padEnd(width)}  ${describe(s)}\n`);
      }
      out.write(
        pending
          ? `\n  Next  ${next}\n\n`
          : `\n  Every module is drafted and archived.\n  Next  ${next}  — what to build first\n\n`
      );
    });
  }

  /** `--new-brief`: the template, never over a brief that exists. */
  private newBrief(opts: DraftOptions, file: string, rel: string): void {
    const io = agentIo(opts.json);
    if (fs.existsSync(file)) {
      io.fail({ draft: null }, [
        error("draft_brief_exists", `${rel} already exists — nothing was written.`, {
          fix: "Edit it, then run `specgate draft`; it says what the top of the brief still needs.",
        }),
      ]);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, BRIEF_TEMPLATE, "utf8");
    io.emit({ draft: { brief: rel, written: true, next: "specgate draft" } }, () =>
      process.stdout.write(
        `\n  ✔ Wrote ${rel} — a brief to fill in.\n\n` +
          "  Fill it in, in your own words:\n" +
          "    1. The four fields at the top — product, surfaces, actors, modules.\n" +
          "       Each has an example in the comment above it.\n" +
          "    2. The sections below — what the product is, who uses it and how, what\n" +
          "       each one must be able to do, the rules and numbers you already know,\n" +
          "       what you don't know yet, and what is out of scope.\n\n" +
          "  Have a plan or an email already? Paste it under the four fields instead\n" +
          "  of the sections — Specgate reads it as it is.\n\n" +
          "  Next  specgate draft  — it checks the four fields and says what is next\n\n"
      )
    );
  }

  /**
   * `draft --agent` without a module: the agent proposes the front matter.
   * It may write only the brief, and the brief below the front matter must
   * come back byte for byte — it is the client's words, and every draft is
   * checked against them.
   */
  private frontMatterWithAgent(
    opts: DraftOptions,
    projectDir: string,
    brief: { rel: string; text: string }
  ): void {
    const io = agentIo(opts.json);
    if (frontMatter(brief.text) !== null && checkFrontMatter(brief.text).length === 0) {
      const first = briefModules(brief.text)[0];
      io.emit(
        { draft: { brief: brief.rel, frontMatter: "ok", next: `specgate draft ${first}` } },
        () =>
          process.stdout.write(
            `\n  The front matter of ${brief.rel} is already there and complete — nothing for the agent to do.\n` +
              `  Next  specgate draft ${first}\n\n`
          )
      );
      return;
    }
    writeSetupGuide(projectDir, brief.rel);
    const own = path
      .relative(projectDir, path.resolve(projectDir, brief.rel))
      .split(path.sep)
      .join("/");
    const agent = withWritePermission(opts.agent);
    if (!opts.json) {
      process.stdout.write(
        `\n  → ${agent.command}  is proposing the front matter of ${brief.rel}…\n` +
          (agent.added
            ? `    (edit permission added: claude -p cannot write the file otherwise)\n`
            : "") +
          "\n"
      );
    }
    const run = runConfinedAgent({
      projectDir,
      changeId: "brief",
      allowed: (rel) => rel === own,
      command: agent.command,
      prompt: briefSetupPrompt(briefSetupGuide(brief.rel)),
      showOutput: !opts.json,
    });
    if (run.problem === "no_git") {
      io.fail({ draft: null }, [
        error("draft_agent_needs_git", "--agent needs a git repository.", {
          fix:
            "Git is how Specgate finds what the agent wrote and undoes anything else. Run `git init`, " +
            `then try again — or paste this into your agent yourself: ${BRIEF_SETUP_PASTE}`,
        }),
      ]);
    }
    if (run.reverted.length > 0 && !opts.json) {
      process.stdout.write(
        `\n  ↺ Undone — the agent wrote outside the brief: ${run.reverted.join(", ")}\n`
      );
    }
    const after = readIf(path.resolve(projectDir, brief.rel)) ?? "";
    if (briefBody(after) !== briefBody(brief.text)) {
      fs.writeFileSync(path.resolve(projectDir, brief.rel), brief.text, "utf8");
      io.fail({ draft: null }, [
        error(
          "draft_brief_body_changed",
          "The agent changed the brief itself, not only its front matter — undone.",
          {
            fix: `${brief.rel} is back as it was. Try again, or write the four fields yourself (\`specgate draft\` shows them).`,
          }
        ),
      ]);
    }
    if (!run.ok) {
      io.fail({ draft: null }, [
        error("draft_agent_failed", `The agent ${run.detail}.`, {
          fix: `Check the command runs on its own, or paste this into your agent: ${BRIEF_SETUP_PASTE}`,
        }),
      ]);
    }
    const proposed = frontMatter(after);
    if (proposed === null) {
      io.fail({ draft: null }, [
        error("draft_no_front_matter", "The agent wrote no front matter.", {
          fix: `${NO_WRITE_HINT} Or run \`specgate draft\` to see the four fields, and write them yourself.`,
        }),
      ]);
    }
    const problems = checkFrontMatter(after);
    io.emit(
      {
        draft: { brief: brief.rel, frontMatter: proposed, next: "specgate draft" },
        status: problems.map((p) => error(p.code, p.message, { fix: p.fix })),
      },
      () => {
        const out = process.stdout;
        out.write(`\n  The agent proposed this, at the top of ${brief.rel}:\n\n`);
        for (const l of ["---", ...proposed!.split("\n"), "---"]) out.write(`    ${l}\n`);
        out.write("\n  Your brief below it is unchanged.\n");
        if (problems.length > 0) {
          out.write(`\n  It still needs ${problems.length} fix(es):\n`);
          for (const p of problems) out.write(`  ✖  ${p.message}\n     ${p.fix}\n`);
        }
        out.write("\n  Review it — change anything — then  specgate draft\n\n");
      }
    );
  }

  // ── specgate draft <module> ─────────────────────────────────────────────────

  private module(opts: DraftOptions): void {
    const io = agentIo(opts.json);
    const projectDir = resolveProjectDir(opts.projectDir);
    const changeId = `draft-${opts.module}`;
    const status = moduleStatus(projectDir, opts.module);

    if (status.state === "archived") {
      io.emit(
        {
          draft: {
            module: opts.module,
            change: changeId,
            state: "archived",
            next: "specgate draft",
          },
        },
        () =>
          process.stdout.write(
            `\n  ✔ ${opts.module} is already drafted and archived (${status.archivedAs}).\n\n` +
              "  Next  specgate draft  — the next module of the brief, or what to build first\n\n"
          )
      );
      return;
    }

    if (status.state === "not started") {
      if (!fs.existsSync(path.join(projectDir, "spec.md"))) {
        io.fail({ draft: null }, [
          error("draft_no_project", "This folder is not a Specgate project yet.", {
            fix: "Run `specgate init` first, then `specgate draft " + opts.module + "`.",
          }),
        ]);
      }
      const brief = this.brief(projectDir, opts)!;
      const listed = briefModules(brief.text);
      const opened = openDraft(projectDir, opts.module, brief.rel, opts);
      const notes =
        listed.length > 0 && !listed.includes(opts.module)
          ? [
              info(
                "draft_module_not_in_brief",
                `${opts.module} is not among the brief's modules (${listed.join(", ")}).`,
                {
                  fix: "Add it to `modules:` in the brief's front matter, so `specgate draft` lists it.",
                }
              ),
            ]
          : [];
      if (opts.agent) return this.withAgent(opts, projectDir, brief.rel, opened.created);
      io.emit(
        {
          draft: {
            module: opts.module,
            change: opened.changeId,
            state: "not written",
            brief: brief.rel,
            reserved: opened.reqRange,
            created: opened.created,
            prompt: pasteLine(opts.module),
            next: `specgate draft ${opts.module}`,
          },
          status: notes,
        },
        () => {
          const out = process.stdout;
          const dir = `${CHANGES.split(path.sep).join("/")}/${opened.changeId}`;
          out.write(
            `\n  ✔ Draft ${opened.changeId} opened, linked to ${brief.rel} ` +
              `(REQ ids ${opened.reqRange[0]}…${opened.reqRange[1]} reserved)\n\n` +
              [
                [`${dir}/DRAFTING.md`, "how to write it"],
                [`${dir}/specs/${opts.module}/spec.md`, "the requirements go here"],
                [`${dir}/change.yaml, proposal.md`, ""],
              ]
                .map(([f, why], _i, all) => {
                  const w = Math.max(...all.map((r) => r[0].length));
                  return `    + ${why ? f.padEnd(w) + "   " + why : f}\n`;
                })
                .join("") +
              "\n" +
              "  Have your agent write it. Paste this into Claude Code, Cursor, Codex…:\n\n" +
              `    ${pasteLine(opts.module)}\n\n` +
              `  or let Specgate call it:  specgate draft ${opts.module} --agent "claude -p"\n\n` +
              `  Then run  specgate draft ${opts.module}  until it says Ready to review.\n\n`
          );
          for (const n of notes) out.write(`  ℹ  ${n.message}\n     ${n.fix}\n\n`);
        }
      );
      return;
    }

    const brief = this.brief(projectDir, opts, briefOf(projectDir, changeId))!;
    if (opts.agent) return this.withAgent(opts, projectDir, brief.rel, []);
    this.report(opts, projectDir, brief.rel);
  }

  /** Hand the guide to the agent, undo what it writes elsewhere, then check. */
  private withAgent(
    opts: DraftOptions,
    projectDir: string,
    brief: string,
    created: string[]
  ): void {
    const io = agentIo(opts.json);
    const changeId = `draft-${opts.module}`;
    const guide = readIf(path.join(projectDir, CHANGES, changeId, "DRAFTING.md")) || "";
    const agent = withWritePermission(opts.agent);
    if (!opts.json) {
      process.stdout.write(
        `\n  ${created.length ? `✔ Draft ${changeId} opened, linked to ${brief}.\n  ` : ""}` +
          `→ ${agent.command}  is drafting ${opts.module}…\n` +
          (agent.added
            ? `    (edit permission added: claude -p cannot write the draft otherwise)\n`
            : "") +
          "\n"
      );
    }
    const run = runConfinedAgent({
      projectDir,
      changeId,
      command: agent.command,
      prompt: draftingPrompt(opts.module, changeId, guide),
      showOutput: !opts.json,
    });
    if (run.problem === "no_git") {
      io.fail({ draft: null }, [
        error("draft_agent_needs_git", "--agent needs a git repository.", {
          fix:
            "Git is how Specgate finds what the agent wrote and undoes anything outside the draft. " +
            "Run `git init`, then `specgate draft " +
            opts.module +
            ' --agent "…"` again — or paste the prompt into your agent yourself.',
        }),
      ]);
    }
    if (run.reverted.length > 0 && !opts.json) {
      process.stdout.write(
        `\n  ↺ Undone — the agent wrote outside the draft: ${run.reverted.join(", ")}\n`
      );
    }
    if (!run.ok) {
      io.fail({ draft: null }, [
        error("draft_agent_failed", `The agent ${run.detail}.`, {
          fix: `Check the command runs on its own, or paste this into your agent: ${pasteLine(opts.module)}`,
        }),
      ]);
    }
    this.report(opts, projectDir, brief, run.reverted, true);
  }

  /** The checklist on `draft-<module>`, and what comes next. */
  private report(
    opts: DraftOptions,
    projectDir: string,
    brief: string,
    reverted: string[] = [],
    afterAgent = false
  ): void {
    const io = agentIo(opts.json);
    const changeId = `draft-${opts.module}`;
    const status = moduleStatus(projectDir, opts.module, brief);
    // The agent's own output is long and ends just above this: a rule marks
    // where Specgate takes over again, so the next step is not lost in it (#96).
    if (afterAgent && !opts.json) process.stdout.write(`\n  ${"─".repeat(64)}\n`);
    if (status.state === "not written") {
      io.emit(
        {
          draft: {
            module: opts.module,
            change: changeId,
            state: status.state,
            brief,
            prompt: pasteLine(opts.module),
            next: `specgate draft ${opts.module}`,
          },
        },
        () =>
          process.stdout.write(
            `\n  specgate draft ${opts.module}  ·  ${brief}\n\n` +
              (afterAgent
                ? `  ✖  The agent ran, but the draft is still the placeholder.\n     ${NO_WRITE_HINT}\n\n`
                : "  The draft is still the placeholder. Have your agent write it:\n\n" +
                  `    ${pasteLine(opts.module)}\n\n` +
                  `  or:  specgate draft ${opts.module} --agent "claude -p"\n\n`)
          )
      );
      process.exitCode = 1;
      return;
    }
    const result = draftReport(projectDir, changeId, brief, opts.maxRequirements);
    if ("failure" in result) {
      io.fail({ draft: null }, [result.failure]);
      return;
    }
    const report = result.report;
    const diags = [...report.status, ...skippedNotes(report)];
    const errors = report.status.length;
    const next =
      errors === 0 ? `specgate change archive ${changeId}` : `specgate draft ${opts.module}`;
    io.emit(
      {
        draft: {
          module: opts.module,
          change: changeId,
          state: errors === 0 ? "ready" : "drafting",
          brief,
          requirements: report.requirements,
          scenarios: report.scenarios,
          skipped: report.skipped,
          reverted,
          next,
        },
        status: diags,
      },
      () => {
        const out = process.stdout;
        out.write(`\n  specgate draft ${opts.module}  ·  ${brief}\n\n`);
        writeFindings(report, diags);
        const dir = `${CHANGES.split(path.sep).join("/")}/${changeId}`;
        const steps: string[] = [];
        if (errors === 0) {
          out.write(`${diags.length ? "\n" : ""}  ✔  Ready to review.\n`);
          steps.push(
            `Read ${dir}/specs/ with whoever knows the business`,
            fs.existsSync(path.join(projectDir, CHANGES, changeId, "questions.md"))
              ? `Answer what you can in ${dir}/questions.md`
              : `Check ${dir}/assumptions.md, if the agent wrote one`,
            next
          );
          const after = nextModuleAfter(projectDir, brief, opts.module);
          steps.push(
            after
              ? `specgate draft ${after}   — the next module of the brief`
              : "specgate status   — every module drafted: what to build first"
          );
        } else {
          out.write(
            `\n  ✖  ${errors} finding(s) to fix. Each says how; DRAFTING.md has the formats.\n`
          );
          steps.push(
            `Fix them, or ask your agent:  specgate draft ${opts.module} --agent "claude -p"`,
            `${next}   — again, until it says Ready to review`
          );
        }
        const progress = briefLine(projectDir, brief);
        if (progress) out.write(`\n  Brief  ${progress}\n`);
        out.write("\n  What now\n");
        steps.forEach((s, i) => out.write(`    ${i + 1}. ${s}\n`));
        out.write("\n");
      }
    );
    process.exitCode = errors === 0 ? 0 : 1;
  }

  // ── specgate draft --check <id> ─────────────────────────────────────────────

  private check(opts: DraftOptions): void {
    const io = agentIo(opts.json);
    const projectDir = resolveProjectDir(opts.projectDir);
    const result = draftReport(projectDir, opts.check, opts.brief, opts.maxRequirements);
    if ("failure" in result) {
      io.fail({ draft: null }, [result.failure]);
      return;
    }
    const report = result.report;
    const status = [...report.status, ...skippedNotes(report)];
    const errors = report.status.length;

    io.emit(
      {
        draft: {
          change: opts.check,
          requirements: report.requirements,
          scenarios: report.scenarios,
          skipped: report.skipped,
        },
        status,
      },
      () => {
        const out = process.stdout;
        out.write(`\n  specgate draft --check ${opts.check}\n\n`);
        writeFindings(report, status);
        const skipped = report.skipped.length;
        out.write(
          errors === 0
            ? `\n  ✔  Ready to review${skipped ? ` (${skipped} rule(s) did not run — see above)` : ""}.\n`
            : `\n  ✖  ${errors} finding(s) to fix before review.\n`
        );
      }
    );
    process.exitCode = errors === 0 ? 0 : 1;
  }
}

function skippedNotes(report: ReturnType<typeof checkDraft>) {
  return report.skipped.map((s) =>
    info("draft_rule_skipped", `${s.rule} did not run: ${s.why}.`, {
      fix: "Pass --brief <file>, with actors and their surfaces in its front matter for D3.",
    })
  );
}

function writeFindings(report: ReturnType<typeof checkDraft>, status: any[]): void {
  const out = process.stdout;
  out.write(`  ${report.requirements} requirement(s), ${report.scenarios} scenario(s)\n\n`);
  for (const d of status) {
    out.write(`  ${d.severity === "error" ? "✖" : "ℹ"}  ${d.code}  ${d.message}\n`);
    if (d.fix && d.severity === "error") out.write(`     fix: ${d.fix}\n`);
  }
}
