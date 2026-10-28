import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { readBriefBody, moduleKey } from "../../packages/core/src/domain/BriefCards";
import { briefModules } from "../../packages/core/src/domain/DraftChecklist";
import {
  HARNESS_CONFIG_FILE,
  readHarnessConfig,
} from "../../packages/core/src/infrastructure/HarnessConfigFile";
import type { QualityConfig } from "../../packages/core/src/domain/QualityChecks";
import {
  summariseQuality,
  type QualitySummary,
} from "../../packages/core/src/domain/QualitySummary";
import { presetYaml, withPreset } from "./quality-presets";
import { dockerAvailable, resolveRunner } from "./quality-run";
import {
  listChangeIds,
  listArchivedIds,
} from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { checkBrief, briefReady } from "../draft/brief-check";
import { frontMatter } from "../draft/brief-setup";
import { DEFAULT_BRIEF, draftReport, moduleStatus } from "../cli/commands/spec/DraftCommand";
import { allQuestions, waiting } from "./clarification";
import { liveMatrix } from "./live-detail";
import { readLive } from "./live-model";
import { approvedOn } from "./change-review";
import { buildView, drafts, gate } from "./studio-app";
import { findCliRoot } from "./project-root";

/**
 * The studio's route from an empty folder to the report (REQ-211..217). As in
 * studio-app.ts, every read is what a specgate command reads and every write
 * runs the command that makes it.
 */

const DELIVERED = new Set(["Implemented", "Verified", "Released"]);
const cli = () => path.join(findCliRoot(__dirname), "bin", "specgate.js");
const PROFILES = path.join(".harness", "profiles.yaml");
const JOB = path.join(".harness", "events", "studio-job.json");

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; code: string; message: string };

// ── Profiles (REQ-211) ──────────────────────────────────────────────────────

export interface ProfileView {
  name: string;
  agent: string;
  default: boolean;
  costHint: number | null;
  /** Its agent pipes Claude Code's stream into `harness events`: tokens and cost show live. */
  streams: boolean;
}

/** The profile harness.config.yaml names with `agent_profile:`, if any. */
function defaultProfile(projectDir: string): string {
  const cfg = read(path.join(projectDir, HARNESS_CONFIG_FILE)) || "";
  const m = /^agent_profile:\s*["']?([^"'\s#]+)/m.exec(cfg);
  return m ? m[1] : "";
}

/** The profiles a person may pick, the default first marked (REQ-211). */
export function profilesView(projectDir: string): ProfileView[] {
  const text = read(path.join(projectDir, PROFILES));
  const out: ProfileView[] = [];
  if (text) {
    let doc: Record<string, unknown> = {};
    try {
      doc = (parseYamlLite(text) || {}) as Record<string, unknown>;
    } catch {
      doc = {};
    }
    const profiles = (doc.profiles || {}) as Record<string, Record<string, unknown> | null>;
    const chosen = defaultProfile(projectDir);
    for (const [name, p] of Object.entries(profiles)) {
      if (!p || !p.agent || p.advisory === true) continue;
      const agent = String(p.agent);
      const hint = Number(p.cost_per_run_hint);
      out.push({
        name,
        agent,
        default: name === chosen,
        costHint: p.cost_per_run_hint !== undefined && Number.isFinite(hint) ? hint : null,
        streams: /harness\s+events\s+--from\s+claude/.test(agent),
      });
    }
    if (out.length && !out.some((p) => p.default)) out[0].default = true;
  }
  return out;
}

/** The arguments that run an agent: the profile picked, else the configured one. */
function agentArgs(projectDir: string, profile: string): string[] | null {
  if (profile) {
    return profilesView(projectDir).some((p) => p.name === profile) ? ["--profile", profile] : null;
  }
  const chosen = profilesView(projectDir).find((p) => p.default);
  if (chosen) return ["--profile", chosen.name];
  const cfg = read(path.join(projectDir, HARNESS_CONFIG_FILE)) || "";
  const m = /^agent:\s*(.+)$/m.exec(cfg);
  if (!m) return null;
  const raw = m[1].trim();
  let agent = raw;
  if (raw.startsWith('"')) {
    try {
      agent = JSON.parse(raw);
    } catch {
      agent = raw.slice(1, -1);
    }
  } else if (raw.startsWith("'")) agent = raw.slice(1, -1).replace(/''/g, "'");
  return agent ? ["--agent", agent] : null;
}

// ── Background jobs: the brief and the drafts (REQ-215, REQ-216) ─────────────

export interface Job {
  kind: "brief" | "draft";
  module: string;
  profile: string;
  pid: number;
  started: number;
  log: string;
}

/** The brief or draft job in progress, if its process is still alive. */
export function currentJob(projectDir: string): Job | null {
  try {
    const job = JSON.parse(fs.readFileSync(path.join(projectDir, JOB), "utf8")) as Job;
    return Number.isInteger(job.pid) && job.pid > 0 && alive(job.pid) ? job : null;
  } catch {
    return null;
  }
}

/** The last job, alive or not: how it ended is in its log. */
function lastJob(projectDir: string): Job | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, JOB), "utf8")) as Job;
  } catch {
    return null;
  }
}

function startJob(
  projectDir: string,
  kind: Job["kind"],
  module: string,
  profile: string,
  args: string[]
): Outcome<{ job: Job }> {
  const running = currentJob(projectDir);
  if (running) {
    return {
      ok: false,
      code: "job_running",
      message:
        running.kind === "draft"
          ? `The module ${running.module} is being drafted. Wait for it, or stop it.`
          : "The agent is working on the brief. Wait for it, or stop it.",
    };
  }
  const dir = path.join(projectDir, ".harness", "events");
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  const log = path.join(dir, `studio-${kind}.log`);
  fs.writeFileSync(log, "", "utf8");
  const out = fs.openSync(log, "a");
  const child = spawn(process.execPath, [cli(), ...args, "--project-dir", projectDir], {
    cwd: projectDir,
    detached: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      NO_COLOR: "1",
      // A streaming agent reports what it does; the page shows its last step.
      AGENT_EVENTS_FILE: path.join(dir, `studio-${kind}.jsonl`),
    },
  });
  child.unref();
  fs.closeSync(out);
  const job: Job = {
    kind,
    module,
    profile,
    pid: child.pid || 0,
    started: Math.floor(Date.now() / 1000),
    log: path.relative(projectDir, log).split(path.sep).join("/"),
  };
  fs.writeFileSync(path.join(projectDir, JOB), JSON.stringify(job), "utf8");
  return { ok: true, job };
}

/** Stop the brief or draft job in progress, with the processes it started. */
export function stopJob(projectDir: string): Outcome {
  const job = currentJob(projectDir);
  if (!job) return { ok: false, code: "job_not_running", message: "Nothing is being drafted." };
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(job.pid), "/T", "/F"]);
  } else {
    try {
      process.kill(-job.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  return { ok: true };
}

/** What the job's agent said last, from its events, for the page. */
function lastStep(projectDir: string, kind: Job["kind"]): string {
  const text = read(path.join(projectDir, ".harness", "events", `studio-${kind}.jsonl`)) || "";
  const lines = text.trim().split("\n").reverse();
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (e.type === "tool" && e.summary) return String(e.summary);
      if (e.type === "message" && e.text) return String(e.text);
    } catch {
      /* a line being written */
    }
  }
  return "";
}

// ── The route (REQ-212) ─────────────────────────────────────────────────────

export type StepState = "done" | "current" | "open" | "locked";
export type StepKey = "project" | "brief" | "drafts" | "questions" | "review" | "build" | "report";

export interface RouteStep {
  key: StepKey;
  state: StepState;
  /** What the summary counts, for the page to word in the viewer's language. */
  counts: Record<string, number | string>;
}

export interface RouteView {
  project: string;
  isProject: boolean;
  empty: boolean;
  steps: RouteStep[];
  next: StepKey | null;
}

export function isProject(projectDir: string): boolean {
  return fs.existsSync(path.join(projectDir, "spec.md"));
}

/** A folder with nothing in it but, at most, a git repository. */
export function isEmptyFolder(dir: string): boolean {
  try {
    return fs.readdirSync(dir).filter((f) => f !== ".git").length === 0;
  } catch {
    return false;
  }
}

/** Requirements by id with their status and module, REQ-001 left out as Home does. */
function requirements(projectDir: string): Map<string, { status: string; group: string }> {
  const reqs = new Map<string, { status: string; group: string }>();
  for (const r of liveMatrix(projectDir))
    if (!reqs.has(r.requirement)) reqs.set(r.requirement, { status: r.status, group: r.group });
  reqs.delete("REQ-001");
  return reqs;
}

/** Where the project is on its seven steps, and the next one (REQ-212). */
export function route(projectDir: string): RouteView {
  const project = path.basename(projectDir);
  const keys: StepKey[] = ["project", "brief", "drafts", "questions", "review", "build", "report"];
  if (!isProject(projectDir)) {
    return {
      project,
      isProject: false,
      empty: isEmptyFolder(projectDir),
      steps: keys.map((key) => ({
        key,
        state: key === "project" ? "current" : "locked",
        counts: {},
      })),
      next: "project",
    };
  }
  const states: Record<StepKey, { state: StepState; counts: Record<string, number | string> }> =
    {} as never;
  states.project = { state: "done", counts: {} };

  const briefText = read(path.join(projectDir, DEFAULT_BRIEF));
  const modules = briefText ? briefModules(briefText) : [];
  const briefOk =
    Boolean(briefText) && modules.length > 0 && briefReady(checkBrief(briefText!, DEFAULT_BRIEF));
  states.brief = { state: briefOk ? "done" : "open", counts: { modules: modules.length } };

  const statuses = modules.map((m) => moduleStatus(projectDir, m, briefText || ""));
  const drafted = statuses.filter((s) => s.state === "ready" || s.state === "archived").length;
  const anyDraft =
    statuses.some((s) => s.state !== "not started") || listChangeIds(projectDir).length > 0;
  states.drafts = {
    state: !briefOk ? "locked" : drafted === modules.length ? "done" : "open",
    counts: { done: drafted, total: modules.length },
  };

  const questions = waiting(projectDir).questions.length;
  const reqs = requirements(projectDir);
  const built = [...reqs.values()].filter((r) => DELIVERED.has(r.status)).length;
  const started = anyDraft || reqs.size > 0;
  states.questions = {
    state: !started ? "locked" : questions ? "open" : "done",
    counts: { open: questions },
  };
  const toReview = drafts(projectDir).length;
  states.review = {
    state: !started ? "locked" : toReview ? "open" : "done",
    counts: { open: toReview },
  };

  const ready = reqs.size ? buildView(projectDir).ready.length : 0;
  states.build = {
    state: reqs.size === 0 ? "locked" : ready ? "open" : built ? "done" : "locked",
    counts: { ready, built, total: reqs.size },
  };
  states.report = { state: built ? "open" : "locked", counts: { built, total: reqs.size } };

  const next = keys.find((k) => states[k].state === "open") || null;
  return {
    project,
    isProject: true,
    empty: false,
    steps: keys.map((key) => ({
      key,
      state: key === next ? "current" : states[key].state,
      counts: states[key].counts,
    })),
    next,
  };
}

// ── Quality on the project page (REQ-229) ──────────────────────────────────

export interface QualityView {
  level: string;
  diffCoverage: number | null;
  mutationScore: number | null;
  docker: boolean;
  checks: Array<{ name: string; when: string; gate: boolean; runner: string; unavailable: string }>;
}

/** The checks configured, and how each would run on this machine. */
export function qualityView(projectDir: string): QualityView {
  let q: QualityConfig | undefined;
  try {
    q = (readHarnessConfig(projectDir) || {}).quality;
  } catch {
    q = undefined;
  }
  const checks = (q ? q.checks : []).map((c) => {
    const how = resolveRunner(c);
    return {
      name: c.name,
      when: c.when,
      gate: c.gate,
      runner: "runner" in how ? how.runner : "",
      unavailable: "skip" in how ? how.skip : "",
    };
  });
  return {
    level: q ? q.level : "",
    diffCoverage: q ? q.diffCoverage : null,
    mutationScore: q ? q.mutationScore : null,
    docker: dockerAvailable(),
    checks,
  };
}

/** Write the checks of a level for this project's stack (REQ-225), replacing any. */
export function initQuality(projectDir: string, level: string): Outcome<{ view: QualityView }> {
  if (level !== "basic" && level !== "strict") {
    return { ok: false, code: "quality_level", message: "The level is basic or strict." };
  }
  const cfg = path.join(projectDir, HARNESS_CONFIG_FILE);
  const current = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "harness_version: 1\n";
  fs.writeFileSync(cfg, withPreset(current, presetYaml(projectDir, level)), "utf8");
  return { ok: true, view: qualityView(projectDir) };
}

// ── A new project (REQ-213) ─────────────────────────────────────────────────

export interface NewProject {
  name: string;
  kind: "web" | "api" | "mobile";
  stack: "node-react" | "java-spring" | "python-fastapi" | "custom";
  customStack?: string;
  customTesting?: string;
  agent: "claude" | "codex" | "none";
  /** The quality checks to write, all in Docker (REQ-225); none by default. */
  quality?: "none" | "basic" | "strict";
}

const STACKS: Record<string, { stack: string; testing: string }> = {
  "node-react": { stack: "Node.js, React", testing: "npm test" },
  "java-spring": {
    stack: "Java 21, Spring Boot 3.x, PostgreSQL",
    testing: "JUnit 5, Testcontainers, Cucumber",
  },
  "python-fastapi": { stack: "Python 3.12, FastAPI, PostgreSQL", testing: "pytest" },
};

const CLAUDE = (model: string) =>
  `claude -p --model ${model} --output-format stream-json --verbose --permission-mode acceptEdits < {prompt_file} | specgate harness events --from claude`;

/** The profiles a preset writes, the first of them the default. */
export function presetProfiles(agent: NewProject["agent"]): Array<{ name: string; agent: string }> {
  if (agent === "claude") {
    return [
      { name: "claude-sonnet", agent: CLAUDE("sonnet") },
      { name: "claude-opus", agent: CLAUDE("opus") },
    ];
  }
  if (agent === "codex")
    return [{ name: "codex", agent: "codex exec --full-auto - < {prompt_file}" }];
  return [];
}

/** Which agent CLIs this machine has on its PATH. */
export function agentsInstalled(): { claude: boolean; codex: boolean } {
  const has = (cmd: string) =>
    spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" })
      .status === 0;
  return { claude: has("claude"), codex: has("codex") };
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "project";

const yamlValue = (v: string) => JSON.stringify(v);

/** Write the profiles and point harness.config.yaml at the first. */
export function writeProfiles(
  projectDir: string,
  profiles: Array<{ name: string; agent: string }>
): void {
  if (profiles.length === 0) return;
  const file = path.join(projectDir, PROFILES);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = ["profiles_version: 1", "profiles:"];
  for (const p of profiles) lines.push(`  ${p.name}:`, `    agent: ${yamlValue(p.agent)}`);
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
  const cfgFile = path.join(projectDir, HARNESS_CONFIG_FILE);
  const cfg = read(cfgFile) || "harness_version: 1\n";
  const line = `agent_profile: ${profiles[0].name}`;
  const next = /^#?\s*agent_profile:.*$/m.test(cfg)
    ? cfg.replace(/^#?\s*agent_profile:.*$/m, line)
    : `${cfg.trimEnd()}\n${line}\n`;
  fs.writeFileSync(cfgFile, next, "utf8");
}

/** Create the project in an empty folder: init, harness, profiles, a brief to fill (REQ-213). */
export function createProject(dir: string, p: NewProject): Outcome<{ dir: string }> {
  if (isProject(dir)) {
    return {
      ok: false,
      code: "project_exists",
      message: "This folder already holds a specgate project.",
    };
  }
  if (!isEmptyFolder(dir)) {
    return {
      ok: false,
      code: "project_folder_not_empty",
      message:
        "This folder already holds files. Adopt it from a terminal with `specgate init`, which keeps them.",
    };
  }
  const name = String(p.name || "").trim();
  if (!name) return { ok: false, code: "project_no_name", message: "Give the project a name." };
  const preset =
    p.stack === "custom"
      ? { stack: String(p.customStack || "").trim(), testing: String(p.customTesting || "").trim() }
      : STACKS[p.stack];
  if (!preset || !preset.stack) {
    return { ok: false, code: "project_no_stack", message: "Choose a stack, or write yours." };
  }
  const slug = slugOf(name);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-new-"));
  try {
    const config = path.join(tmp, "project.yaml");
    fs.writeFileSync(
      config,
      [
        `PROJECT_NAME: ${yamlValue(name)}`,
        `PROJECT_SLUG: ${slug}`,
        `PROJECT_TYPE: ${p.kind === "api" ? "backend" : p.kind === "mobile" ? "mobile" : "frontend"}`,
        "DOMAIN: general",
        `STACK: ${yamlValue(preset.stack)}`,
        "API_STYLE: REST with DTO boundaries",
        `TESTING: ${yamlValue(preset.testing || "npm test")}`,
      ].join("\n") + "\n",
      "utf8"
    );
    const init = spawnSync(
      process.execPath,
      [cli(), "init", "--config", config, "--out", tmp, "--new", "--no-git"],
      { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
    );
    const made = path.join(tmp, slug);
    if (init.status !== 0 || !fs.existsSync(path.join(made, "spec.md"))) {
      return {
        ok: false,
        code: "project_init_failed",
        message: `specgate init failed: ${(init.stderr || init.stdout || "").trim().split("\n").slice(-3).join(" ")}`,
      };
    }
    fs.cpSync(made, dir, { recursive: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
  const run = (args: string[]) =>
    spawnSync(process.execPath, [cli(), ...args, "--project-dir", dir], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  run(["harness", "init"]);
  writeProfiles(dir, presetProfiles(p.agent));
  if (p.quality === "basic" || p.quality === "strict") {
    const cfg = path.join(dir, HARNESS_CONFIG_FILE);
    const current = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "harness_version: 1\n";
    fs.writeFileSync(cfg, withPreset(current, presetYaml(dir, p.quality)), "utf8");
  }
  // A brief with nothing to delete: the studio's form fills it, so the
  // template's examples and blanks would only be in the way.
  const brief = path.join(dir, DEFAULT_BRIEF);
  if (!fs.existsSync(brief)) {
    const surface = p.kind === "api" ? "api" : p.kind === "mobile" ? "mobile" : "web";
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.writeFileSync(
      brief,
      `---\nproduct: ${name}\nsurfaces: [${surface}]\nactors:\nmodules: []\n---\n\n# ${name}\n`,
      "utf8"
    );
  }
  // The harness needs a clean tree and a first commit to branch from.
  if (!fs.existsSync(path.join(dir, ".git"))) spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync("git", ["commit", "-q", "-m", "chore: start the project with specgate"], { cwd: dir });
  return { ok: true, dir };
}

// ── The brief as a form (REQ-214) ───────────────────────────────────────────

export interface BriefModuleForm {
  key: string;
  name: string;
  prose: string;
  rules: string[];
  examples: string[];
  questions: string[];
}

export interface BriefForm {
  exists: boolean;
  product: string;
  actors: Array<{ name: string; surfaces: string[] }>;
  modules: BriefModuleForm[];
  markdown: string;
  findings: Array<{ severity: string; code: string; message: string; fix: string }>;
}

function findingsOf(text: string) {
  return checkBrief(text, DEFAULT_BRIEF).map((d) => ({
    severity: d.severity,
    code: d.code,
    message: d.message,
    fix: d.fix || "",
  }));
}

/** docs/brief.md read as the form the studio edits (REQ-214). */
export function briefForm(projectDir: string): BriefForm {
  const text = read(path.join(projectDir, DEFAULT_BRIEF));
  if (text === undefined) {
    return { exists: false, product: "", actors: [], modules: [], markdown: "", findings: [] };
  }
  const fm = frontMatter(text) || "";
  const product = (/^product:[ \t]*(.*)$/m.exec(fm) || ["", ""])[1]
    .trim()
    .replace(/^["']|["']$/g, "");
  // As written: actorSurfaces lowercases the names it compares.
  const actors = [...fm.matchAll(/\{\s*name:\s*([^,}]+?)\s*,\s*surfaces:\s*\[([^\]]*)\]/g)]
    .map((m) => ({
      name: m[1].replace(/^["']|["']$/g, ""),
      surfaces: m[2]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((a) => !a.name.includes("<"));
  // A template's `## Module: <first-module>` is a blank, not a module.
  const sections = new Map(
    readBriefBody(text)
      .modules.filter((m) => !m.name.startsWith("<"))
      .map((m) => [moduleKey(m.name), m])
  );
  const keys = briefModules(text);
  for (const k of sections.keys()) if (!keys.includes(k)) keys.push(k);
  const modules = keys.map((key) => {
    const s = sections.get(key);
    return {
      key,
      name: s ? s.name : key,
      prose: s ? s.prose : "",
      rules: s ? s.rules.map((c) => c.text) : [],
      examples: s ? s.examples.map((c) => c.text) : [],
      questions: s ? s.questions.map((c) => c.text) : [],
    };
  });
  return { exists: true, product, actors, modules, markdown: text, findings: findingsOf(text) };
}

/** Replace a top-level front matter field and its indented lines, or add it. */
function setField(fm: string, name: string, block: string): string {
  const lines = fm.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^${name}:`).test(l));
  if (at < 0) return `${fm.trimEnd()}\n${block}`;
  let end = at + 1;
  while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end += 1;
  // Comments indented under the field are the author's notes on it: kept.
  const notes = lines.slice(at + 1, end).filter((l) => /^[ \t]+#/.test(l));
  const [head, ...rest] = block.split("\n");
  return [...lines.slice(0, at), head, ...notes, ...rest, ...lines.slice(end)].join("\n");
}

function moduleSectionText(
  form: BriefModuleForm,
  cards: { rules: string; examples: string; questions: string }
): string {
  const list = (items: string[]) => items.map((t) => `- ${t.trim()}`).join("\n");
  // A card the form left empty is not a card.
  const filled = (items: string[]) => (items || []).filter((t) => String(t).trim());
  const m = {
    ...form,
    prose: form.prose || "",
    rules: filled(form.rules),
    examples: filled(form.examples),
    questions: filled(form.questions),
  };
  const parts = [`## Module: ${m.name.trim() || m.key}`];
  if (m.prose.trim()) parts.push(m.prose.trim());
  if (m.rules.length) parts.push(`${cards.rules}\n\n${list(m.rules)}`);
  if (m.examples.length) parts.push(`${cards.examples}\n\n${list(m.examples)}`);
  if (m.questions.length) parts.push(`${cards.questions}\n\n${list(m.questions)}`);
  return parts.join("\n\n");
}

/** The form written back into docs/brief.md, keeping every other line (REQ-214). */
export function saveBriefForm(
  projectDir: string,
  form: Pick<BriefForm, "product" | "actors" | "modules">
): BriefForm {
  const file = path.join(projectDir, DEFAULT_BRIEF);
  const text = (read(file) || "").replace(/\r\n/g, "\n");
  const fmMatch = /^---\n([\s\S]*?)\n---[ \t]*\n?/.exec(text);
  let fm = fmMatch ? fmMatch[1] : "";
  let body = fmMatch ? text.slice(fmMatch[0].length) : text;

  const modules = form.modules.filter((m) => (m.name || m.key).trim());
  const keys = modules.map((m) => moduleKey(m.key || m.name));
  const actors = form.actors.filter((a) => a.name.trim());
  const surfaces = [...new Set(actors.flatMap((a) => a.surfaces))].filter((s) => !s.includes("<"));
  fm = setField(fm, "product", `product: ${form.product.trim()}`);
  fm = setField(fm, "surfaces", `surfaces: [${surfaces.join(", ")}]`);
  fm = setField(
    fm,
    "actors",
    [
      "actors:",
      ...actors.map((a) => `  - { name: ${a.name.trim()}, surfaces: [${a.surfaces.join(", ")}] }`),
    ].join("\n")
  );
  fm = setField(fm, "modules", `modules: [${keys.join(", ")}]`);

  const sections = readBriefBody(text).modules;
  const spanish = sections.some((s) => /^\s*\**reglas/im.test(s.source));
  const cards = spanish
    ? { rules: "Reglas", examples: "Ejemplos", questions: "Preguntas" }
    : { rules: "Rules", examples: "Examples", questions: "Questions" };
  const byKey = new Map(sections.map((s) => [moduleKey(s.name), s]));
  for (const s of sections) {
    if (!keys.includes(moduleKey(s.name)))
      body = body.replace(s.source, "").replace(/\n{3,}/g, "\n\n");
  }
  for (const m of modules) {
    const key = moduleKey(m.key || m.name);
    const existing = byKey.get(key);
    const hasCards = m.rules.length || m.examples.length || m.questions.length || m.prose.trim();
    if (existing) body = body.replace(existing.source, moduleSectionText(m, cards));
    else if (hasCards) body = `${body.trimEnd()}\n\n${moduleSectionText(m, cards)}\n`;
  }
  const out = `---\n${fm.replace(/^\n+/, "")}\n---\n${body.startsWith("\n") ? "" : "\n"}${body.trimEnd()}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, "utf8");
  return briefForm(projectDir);
}

/** The brief saved as markdown, as written (REQ-214). */
export function saveBriefMarkdown(projectDir: string, markdown: string): BriefForm {
  const file = path.join(projectDir, DEFAULT_BRIEF);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(markdown).replace(/\r\n/g, "\n"), "utf8");
  return briefForm(projectDir);
}

/** A client's text saved as the brief, and the agent asked to structure it (REQ-215). */
export function fillBrief(
  projectDir: string,
  text: string,
  profile: string,
  replace = false
): Outcome<{ job: Job }> {
  const file = path.join(projectDir, DEFAULT_BRIEF);
  if (fs.existsSync(file) && !replace) {
    return {
      ok: false,
      code: "brief_exists",
      message: "There is a brief already. Replace it, or edit it in the form.",
    };
  }
  if (!String(text || "").trim()) {
    return { ok: false, code: "brief_empty", message: "Paste the client's text first." };
  }
  const agent = agentArgs(projectDir, profile);
  if (!agent) {
    return {
      ok: false,
      code: "brief_no_agent",
      message: "No agent is configured to read the text.",
    };
  }
  if (currentJob(projectDir)) {
    return {
      ok: false,
      code: "job_running",
      message: "The agent is busy. Wait for it, or stop it.",
    };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(text).replace(/\r\n/g, "\n"), "utf8");
  return startJob(projectDir, "brief", "", agent[1], ["propose", "--from-brief", ...agent]);
}

// ── Drafts per module (REQ-216) ─────────────────────────────────────────────

export type ModuleStage = "todo" | "drafting" | "review" | "approved" | "archived" | "stopped";

export interface ModuleView {
  key: string;
  stage: ModuleStage;
  requirements: number;
  scenarios: number;
  questions: number;
  findings: Array<{ severity: string; code: string; message: string }>;
  progress: null | {
    seconds: number;
    requirements: number;
    scenarios: number;
    notes: boolean;
    lastStep: string;
  };
}

export interface DraftsRoute {
  brief: boolean;
  modules: ModuleView[];
  job: Job | null;
  /** What the job's agent did last, when it streams its work. */
  step: string;
  lastJob: { kind: string; module: string; log: string; tail: string } | null;
}

function deltaCounts(
  projectDir: string,
  change: string
): { requirements: number; scenarios: number } {
  const dir = path.join(projectDir, "docs", "specs", "changes", change, "specs");
  let requirements = 0;
  let scenarios = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        const t = read(full) || "";
        requirements += (t.match(/^###\s+Requirement:\s*REQ-\d+/gm) || []).length;
        scenarios += (t.match(/^####\s+Scenario:\s*SCN-/gm) || []).length;
      }
    }
  };
  walk(dir);
  return { requirements, scenarios };
}

/** Each module of the brief with where it stands, and the job drafting one (REQ-216). */
export function draftsRoute(projectDir: string): DraftsRoute {
  const briefText = read(path.join(projectDir, DEFAULT_BRIEF));
  const job = currentJob(projectDir);
  const ended = job ? null : lastJob(projectDir);
  const step = job ? lastStep(projectDir, job.kind) : "";
  if (!briefText) return { brief: false, modules: [], job, step, lastJob: null };
  const open = waiting(projectDir).questions;
  // An archived draft's requirements live in the specification now, by module.
  const delivered = new Map<string, { requirements: Set<string>; scenarios: number }>();
  for (const r of liveMatrix(projectDir)) {
    if (r.source !== "spec") continue;
    const g = delivered.get(r.group) || { requirements: new Set<string>(), scenarios: 0 };
    g.requirements.add(r.requirement);
    g.scenarios += r.scenario ? 1 : 0;
    delivered.set(r.group, g);
  }
  const modules = briefModules(briefText).map((key): ModuleView => {
    const s = moduleStatus(projectDir, key, briefText);
    const inSpec = delivered.get(key);
    const counts =
      s.state === "archived" && inSpec
        ? { requirements: inSpec.requirements.size, scenarios: inSpec.scenarios }
        : deltaCounts(projectDir, s.change);
    const questions = open.filter((q) => q.change === s.change).length;
    const drafting = job && job.kind === "draft" && job.module === key;
    let findings: ModuleView["findings"] = [];
    if (s.state === "drafting" || s.state === "ready") {
      const r = draftReport(projectDir, s.change, briefText);
      if (!("failure" in r)) {
        findings = r.report.status.map((d) => ({
          severity: d.severity,
          code: d.code,
          message: d.message,
        }));
      }
    }
    const stage: ModuleStage = drafting
      ? "drafting"
      : s.state === "archived"
        ? "archived"
        : s.state === "not started" || (s.state === "not written" && counts.requirements === 0)
          ? s.state === "not written" && ended && ended.kind === "draft" && ended.module === key
            ? "stopped"
            : "todo"
          : approvedOn(projectDir, s.change)
            ? "approved"
            : "review";
    return {
      key,
      stage,
      ...counts,
      questions,
      findings,
      progress: drafting
        ? {
            seconds: Math.floor(Date.now() / 1000) - job!.started,
            ...counts,
            notes:
              fs.existsSync(
                path.join(projectDir, "docs", "specs", "changes", s.change, "questions.md")
              ) ||
              fs.existsSync(
                path.join(projectDir, "docs", "specs", "changes", s.change, "assumptions.md")
              ),
            lastStep: lastStep(projectDir, "draft"),
          }
        : null,
    };
  });
  const tail = ended
    ? (read(path.join(projectDir, ended.log)) || "").trim().split("\n").slice(-4).join("\n")
    : "";
  return {
    brief: true,
    modules,
    job,
    step,
    lastJob: ended ? { kind: ended.kind, module: ended.module, log: ended.log, tail } : null,
  };
}

/** Draft a module with the agent picked, in the background (REQ-216). */
export function startDraft(
  projectDir: string,
  module: string,
  profile: string
): Outcome<{ job: Job }> {
  const briefText = read(path.join(projectDir, DEFAULT_BRIEF));
  if (!briefText || !briefModules(briefText).includes(module)) {
    return {
      ok: false,
      code: "draft_unknown_module",
      message: `The brief has no module ${module}.`,
    };
  }
  const agent = agentArgs(projectDir, profile);
  if (!agent) {
    return {
      ok: false,
      code: "draft_no_agent",
      message: profile
        ? `No profile ${profile} in .harness/profiles.yaml.`
        : "No agent is configured.",
    };
  }
  return startJob(projectDir, "draft", module, agent[0] === "--profile" ? agent[1] : "", [
    "propose",
    "--from-brief",
    module,
    ...agent,
  ]);
}

// ── The report (REQ-217) ────────────────────────────────────────────────────

export interface ReportView {
  project: string;
  date: string;
  built: number;
  total: number;
  scenarios: number;
  gate: { ok: boolean; findings: string[] };
  cost: number | null;
  minutes: number;
  modules: Array<{
    name: string;
    built: number;
    total: number;
    waiting: number;
    scenarios: number;
  }>;
  delivered: Array<{
    id: string;
    title: string;
    module: string;
    scenarios: Array<{ id: string; title: string }>;
    /** What the quality checks measured on its passing attempt, when they ran. */
    quality: { coverage: number | null; mutation: number | null } | null;
  }>;
  /** The quality checks across what was delivered (REQ-229). */
  quality: QualitySummary;
  missing: Array<{
    id: string;
    title: string;
    module: string;
    why: "waiting" | "not built";
    question: string;
  }>;
  answered: number;
  assumptions: number;
}

/** Every scenario's title, by id, from the specification's files. */
function scenarioTitles(projectDir: string): Map<string, string> {
  const titles = new Map<string, string>();
  const files = [path.join(projectDir, "spec.md")];
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) files.push(full);
    }
  };
  walk(path.join(projectDir, "docs", "specs"));
  for (const f of files) {
    for (const m of (read(f) || "").matchAll(
      /^#{3,5}\s+Scenario:\s*(SCN-[\w.]+)\s*[—–-]+\s*(.+)$/gm
    )) {
      if (!titles.has(m[1])) titles.set(m[1], m[2].trim());
    }
  }
  return titles;
}

/** What was built, how it was proven, and what is missing (REQ-217). */
export function report(projectDir: string, withGate = true): ReportView {
  const matrix = liveMatrix(projectDir).filter((r) => r.requirement !== "REQ-001");
  const titles = scenarioTitles(projectDir);
  const byReq = new Map<
    string,
    { title: string; group: string; status: string; scenarios: string[] }
  >();
  for (const r of matrix) {
    const e = byReq.get(r.requirement) || {
      title: r.title,
      group: r.group,
      status: r.status,
      scenarios: [],
    };
    if (r.scenario && !e.scenarios.includes(r.scenario)) e.scenarios.push(r.scenario);
    byReq.set(r.requirement, e);
  }
  const questions = allQuestions(projectDir);
  const holding = new Map<string, string>();
  for (const q of questions.filter((q) => !q.answered))
    for (const b of q.blocks) holding.set(b, q.text);

  const delivered: ReportView["delivered"] = [];
  const missing: ReportView["missing"] = [];
  const modules = new Map<string, ReportView["modules"][number]>();
  for (const [id, r] of byReq) {
    const name = r.group || "spec";
    const m = modules.get(name) || { name, built: 0, total: 0, waiting: 0, scenarios: 0 };
    m.total += 1;
    if (DELIVERED.has(r.status)) {
      m.built += 1;
      m.scenarios += r.scenarios.length;
      delivered.push({
        quality: null,
        id,
        title: r.title,
        module: name,
        scenarios: r.scenarios.map((s) => ({ id: s, title: titles.get(s) || "" })),
      });
    } else {
      const waitingFor = r.status === "Needs Clarification" || holding.has(id);
      if (waitingFor) m.waiting += 1;
      missing.push({
        id,
        title: r.title,
        module: name,
        why: waitingFor ? "waiting" : "not built",
        question: holding.get(id) || "",
      });
    }
    modules.set(name, m);
  }

  let minutes = 0;
  const runs = path.join(projectDir, ".harness", "runs");
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(runs)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    /* no runs */
  }
  const records: Array<{ results?: Array<{ requirement: string; result: string }> }> = [];
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(runs, f), "utf8"));
      records.push(doc);
      for (const r of doc.results || [])
        minutes += Number(r.durationMs) > 0 ? Number(r.durationMs) / 60000 : 0;
    } catch {
      /* a record being written */
    }
  }
  const costs = readLive(projectDir)
    .requirements.map((r) => (r.usage && r.usage.cost !== null ? r.usage.cost : null))
    .filter((c): c is number => c !== null);
  let assumptions = 0;
  const countRows = (file: string) => ((read(file) || "").match(/^\|\s*A\d+\s*\|/gm) || []).length;
  assumptions += countRows(path.join(projectDir, "docs", "specs", "assumptions.md"));
  for (const id of listArchivedIds(projectDir)) {
    assumptions += countRows(
      path.join(projectDir, "docs", "specs", "changes", "archive", id, "assumptions.md")
    );
  }
  const qualitySummary = summariseQuality(records as Parameters<typeof summariseQuality>[0]);
  const qualityByReq = new Map(qualitySummary.requirements.map((q) => [q.requirement, q]));
  for (const d of delivered) {
    const q = qualityByReq.get(d.id);
    d.quality = q ? { coverage: q.coverage, mutation: q.mutation } : null;
  }
  return {
    project: path.basename(projectDir),
    date: new Date().toISOString().slice(0, 10),
    built: delivered.length,
    total: byReq.size,
    scenarios: delivered.reduce((n, d) => n + d.scenarios.length, 0),
    gate: withGate ? gate(projectDir) : { ok: true, findings: [] },
    cost: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    minutes: Math.round(minutes),
    modules: [...modules.values()].sort((a, b) => a.name.localeCompare(b.name)),
    delivered,
    missing,
    answered: questions.filter((q) => q.answered).length,
    assumptions,
    quality: qualitySummary,
  };
}

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

/** The report as one HTML page that opens on its own (REQ-217). */
export function reportHtml(r: ReportView): string {
  const rows = r.modules
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}</td><td>${m.built} / ${m.total}</td><td>${m.scenarios}</td><td>${m.waiting ? `${m.waiting} waiting` : m.built === m.total ? "complete" : ""}</td></tr>`
    )
    .join("");
  const delivered = r.delivered
    .map(
      (d) =>
        `<li><strong>${esc(d.id)} — ${esc(d.title)}</strong> <span class="m">${esc(d.module)}</span><ul>${d.scenarios
          .map((s) => `<li>${esc(s.id)} ${esc(s.title)}</li>`)
          .join("")}</ul></li>`
    )
    .join("");
  const missing = r.missing
    .map(
      (m) =>
        `<li>${esc(m.id)} — ${esc(m.title)} <span class="m">${esc(m.module)} · ${m.why === "waiting" ? `waiting: ${esc(m.question)}` : "not built"}</span></li>`
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.project)} — report</title>
<style>
body{margin:0;background:#f6f8fa;color:#1f2328;font:14px/1.5 -apple-system,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}
main{max-width:960px;margin:0 auto;padding:28px 16px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:0 0 10px}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}
.c,section{background:#fff;border:1px solid #d1d9e0;border-radius:8px;padding:16px 18px;margin-bottom:16px}
.c b{display:block;font-size:24px}.m{color:#59636e;font-size:13px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-top:1px solid #d1d9e0}
ul{padding-left:18px}
</style></head><body><main>
<p class="m">${esc(r.date)}</p>
<h1>${esc(r.project)}</h1>
<p class="m">Built from the specification and its tests with specgate.</p>
<div class="k">
<div class="c">Built<b>${r.built} / ${r.total}</b></div>
<div class="c">Examples proven<b>${r.scenarios}</b></div>
<div class="c">Gate<b>${r.gate.ok ? "passes" : "fails"}</b></div>
<div class="c">Agent<b>${r.cost === null ? "—" : `$${r.cost.toFixed(2)}`}</b><span class="m">${r.minutes} min</span></div>
</div>
<section><h2>By module</h2><table><tr><th>Module</th><th>Built</th><th>Examples</th><th></th></tr>${rows}</table></section>
<section><h2>What the app does</h2><ul>${delivered || "<li>Nothing built yet.</li>"}</ul></section>
<section><h2>What is missing</h2><ul>${missing || "<li>Nothing.</li>"}</ul></section>
${
  r.quality.measured
    ? `<section><h2>Quality of the code</h2><p>Diff coverage ${r.quality.coverage ?? "—"}% · mutation score ${r.quality.mutation ?? "—"}% (means over ${r.quality.measured} requirement(s) the checks measured).</p><p class="m">${r.quality.checks.map((c) => `${esc(c.name)}: ${c.ran} ran${c.skipped ? `, ${c.skipped} skipped` : ""}`).join(" · ")}</p></section>`
    : ""
}
<section><h2>Decisions</h2><p>${r.answered} questions answered · ${r.assumptions} assumptions recorded.</p></section>
</main></body></html>
`;
}
