/**
 * `specgate agent ask | apply | discard | plans` (change agent-ask, REQ-520 …
 * REQ-527): an agent's edits to the specification as a plan a person reads
 * before anything is written.
 *
 * `ask` copies the project's files — tracked and untracked, not ignored — into
 * a temporary folder and records them in a git repository kept beside that
 * folder, never inside it: the agent sees an ordinary project and cannot reach
 * the real one. What it changed is read from that repository, kept to the
 * specification (mode `spec`), and stored in the project's git folder under
 * `specgate/plans/<id>/` with the hash each file had and the content it would
 * get. `apply` compares the hashes, writes the stored bytes — no patching, so
 * line endings stay what they were — and runs the plan's specgate checks.
 * Nothing here stages, commits or pushes.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Diagnostic } from "./diagnostics";
import { error, warning, info } from "./diagnostics";
import { gitDirOf } from "./last-check";
import { killTree } from "./kill-tree";
import { forShell } from "./shell-command";
import { findCliRoot } from "./project-root";
import { agentInvocation, withWritePermission } from "../draft/confined-agent";
import {
  readHarnessConfig,
  resolveProfileAgent,
} from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { extractRequirementSection } from "../../packages/core/src/domain/SpecSections";

// ── Shapes ────────────────────────────────────────────────────────────────────

export type PlanChange = "modify" | "add" | "delete";

export interface PlanFile {
  path: string;
  change: PlanChange;
  why: string;
  diff: string;
}

export interface PlanUsage {
  input: number | null;
  output: number | null;
  cost?: number;
}

export interface PlanAnswer {
  id: string | null;
  request: string;
  mode: "spec";
  created: string;
  files: PlanFile[];
  then: string[];
  read: string[];
  usage: PlanUsage;
}

interface StoredPlan extends PlanAnswer {
  schemaVersion: 1;
  id: string;
  base: { commit: string | null; files: Record<string, string | null> };
}

export interface AskOptions {
  agent?: string;
  profile?: string;
  req?: string[];
  files?: string[];
  mode?: string;
  timeoutSeconds?: number;
}

/** A command's answer: the document, or the refusal with the null-shape. */
export type Outcome =
  | { ok: true; document: Record<string, unknown> & { status: Diagnostic[] } }
  | { ok: false; usage: boolean; document: Record<string, unknown>; status: Diagnostic[] };

export const MODES = ["spec"] as const;
export const DEFAULT_TIMEOUT_SECONDS = 900;
/** What the agent may leave at the root of its copy: a reason per file, the checks, what it read. */
export const ANSWER_FILE = ".specgate-ask.json";
const ID = /^\d{8}-\d{6}-[0-9a-f]{4}$/;
const MAX_OUTPUT = 16 * 1024 * 1024;

const posix = (p: string) => p.split(path.sep).join("/");
const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

/** Mode `spec`: the specification, and nothing else. */
export function inSpecScope(rel: string): boolean {
  return rel === "spec.md" || rel.startsWith("docs/specs/") || rel.startsWith("features/");
}

/** A relative path that stays inside the project and out of its git folder. */
function safeRelative(rel: string): boolean {
  if (!rel || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return false;
  const parts = rel.split("/");
  return !parts.includes("..") && parts[0] !== ".git";
}

function hashOf(file: string): string | null {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() ? sha256(fs.readFileSync(file)) : null;
  } catch {
    return null;
  }
}

// ── The plans folder ──────────────────────────────────────────────────────────

/** `<git folder>/specgate/plans`, or null outside git. */
export function plansDir(projectDir: string): string | null {
  const git = gitDirOf(projectDir);
  return git ? path.join(git, "specgate", "plans") : null;
}

function newId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(2).toString("hex")}`;
}

function readPlan(projectDir: string, id: string): StoredPlan | null {
  const dir = plansDir(projectDir);
  if (!dir || !ID.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, id, "plan.json"), "utf8")) as StoredPlan;
  } catch {
    return null;
  }
}

const notFound = (id: string): Diagnostic =>
  error("plan_not_found", `No open plan has the id "${id}".`, {
    target: id,
    fix: "specgate agent plans",
  });

/** The files of a plan that no longer have the hash they had when the agent started. */
function staleFiles(projectDir: string, plan: StoredPlan): string[] {
  return plan.files
    .filter((f) => hashOf(path.join(projectDir, ...f.path.split("/"))) !== plan.base.files[f.path])
    .map((f) => f.path);
}

// ── The agent ─────────────────────────────────────────────────────────────────

/** `--agent`, else `--profile`, else `agent:` / `agent_profile:` in harness.config.yaml. */
function agentCommand(projectDir: string, o: AskOptions): { command: string } | Diagnostic {
  const notSet = (why: string) =>
    error("agent_not_set", why, {
      fix: "specgate agents init --tool claude",
    });
  try {
    if (o.agent) return { command: o.agent };
    if (o.profile) return { command: resolveProfileAgent(projectDir, o.profile) };
    const config = readHarnessConfig(projectDir);
    if (config && config.agent) return { command: config.agent };
  } catch (err) {
    return notSet((err as Error).message);
  }
  return notSet(
    "No agent is configured: pass --agent or --profile, or set `agent:` in harness.config.yaml."
  );
}

interface AgentRun {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Runs the agent in `cwd` with the prompt; its whole tree is ended at the deadline. */
function runAgent(
  command: string,
  cwd: string,
  prompt: string,
  promptFile: string,
  timeoutMs: number
) {
  const call = agentInvocation(withWritePermission(command).command, promptFile);
  const env: NodeJS.ProcessEnv = { ...process.env };
  // A hook's git variables would point the agent's git at the real repository.
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_PREFIX"]) delete env[name];
  return new Promise<AgentRun>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let done = false;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };
    const child = spawn(forShell(call.command), {
      shell: true,
      cwd,
      env,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: [call.stdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString("utf8");
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString("utf8");
    });
    if (call.stdin && child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(prompt);
    }
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
      // A descendant that outlives the kill still holds the pipes: stop waiting.
      setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        finish(null);
      }, 3000).unref();
    }, timeoutMs);
    child.on("error", (err) => {
      stderr += err.message;
      finish(127);
    });
    child.on("close", (code) => finish(code));
  });
}

/** Claude Code's usage, from `--output-format json` or `stream-json`; nulls when not reported. */
export function usageOf(stdout: string): PlanUsage {
  const docs: Record<string, unknown>[] = [];
  const parse = (s: string) => {
    try {
      const v = JSON.parse(s);
      if (v && typeof v === "object") docs.push(...(Array.isArray(v) ? v : [v]));
    } catch {
      /* not JSON */
    }
  };
  const whole = stdout.trim();
  if (whole.startsWith("{") || whole.startsWith("[")) parse(whole);
  if (!docs.length) {
    for (const line of stdout.split(/\r?\n/)) if (line.trim().startsWith("{")) parse(line.trim());
  }
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  for (const d of docs.reverse()) {
    const u = d.usage as Record<string, unknown> | undefined;
    if (!u || typeof u !== "object") continue;
    const usage: PlanUsage = {
      input: n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens),
      output: n(u.output_tokens),
    };
    if (typeof d.total_cost_usd === "number") usage.cost = d.total_cost_usd;
    return usage;
  }
  return { input: null, output: null };
}

/** The files Claude Code's `Read` tool opened, from `stream-json`. */
function readsOf(stdout: string, work: string[]): string[] {
  const out: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes('"tool_use"')) continue;
    try {
      const e = JSON.parse(line);
      const content = e && e.message && Array.isArray(e.message.content) ? e.message.content : [];
      for (const c of content) {
        const file =
          c && c.type === "tool_use" && c.name === "Read" && c.input && c.input.file_path;
        if (typeof file !== "string") continue;
        for (const root of work) {
          const rel = path.relative(root, file);
          if (!rel.startsWith("..") && !path.isAbsolute(rel)) out.push(posix(rel));
        }
      }
    } catch {
      /* not an event */
    }
  }
  return out;
}

// ── Mentions ──────────────────────────────────────────────────────────────────

interface Context {
  requirements: Array<{ id: string; file: string; section: string; feature: string | null }>;
  files: string[];
  status: Diagnostic[];
}

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, keep, out);
    else if (e.isFile() && keep(e.name)) out.push(p);
  }
  return out;
}

/** spec.md, then each capability spec, then each open change's deltas. */
function specFiles(projectDir: string): string[] {
  const specs = path.join(projectDir, "docs", "specs");
  const isSpec = (n: string) => n === "spec.md";
  const changes = walk(path.join(specs, "changes"), isSpec).filter(
    (f) => !posix(path.relative(specs, f)).startsWith("changes/archive/")
  );
  return [
    path.join(projectDir, "spec.md"),
    ...walk(path.join(specs, "capabilities"), isSpec),
    ...changes,
  ].filter((f) => fs.existsSync(f));
}

function findRequirement(projectDir: string, id: string) {
  for (const file of specFiles(projectDir)) {
    const section = extractRequirementSection(fs.readFileSync(file, "utf8"), id);
    if (!section) continue;
    const tag = new RegExp(`@${id.replace(/\./g, "\\.")}(?![\\w.])`);
    const feature =
      walk(path.join(projectDir, "features"), (n) => n.endsWith(".feature")).find((f) =>
        tag.test(fs.readFileSync(f, "utf8"))
      ) || null;
    return {
      id,
      file: posix(path.relative(projectDir, file)),
      section: section.trim(),
      feature: feature ? posix(path.relative(projectDir, feature)) : null,
    };
  }
  return null;
}

/** `@REQ-NNN` and `@path` in the request, with `--req` and `--file`. */
export function resolveContext(
  projectDir: string,
  request: string,
  reqs: string[] = [],
  files: string[] = []
): Context {
  const ctx: Context = { requirements: [], files: [], status: [] };
  const mentions: Array<{ token: string; value: string }> = [];
  for (const m of request.matchAll(/(?:^|\s)@([^\s]+)/g)) {
    const value = m[1].replace(/[.,;:!?)"'\]]+$/, "");
    if (value) mentions.push({ token: `@${value}`, value });
  }
  for (const r of reqs) mentions.push({ token: r, value: r });
  for (const f of files) mentions.push({ token: f, value: f });
  for (const { token, value } of mentions) {
    if (/^REQ-[A-Za-z0-9.]+$/.test(value)) {
      if (ctx.requirements.some((r) => r.id === value)) continue;
      const found = findRequirement(projectDir, value);
      if (found) ctx.requirements.push(found);
      else {
        ctx.status.push(
          warning("mention_unresolved", `${token} names no requirement of this project.`, {
            target: token,
            fix: "specgate status",
          })
        );
      }
      continue;
    }
    const rel = posix(path.normalize(value)).replace(/^\.\//, "");
    const full = path.join(projectDir, ...rel.split("/"));
    if (safeRelative(rel) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      if (!ctx.files.includes(rel)) ctx.files.push(rel);
    } else {
      ctx.status.push(
        warning("mention_unresolved", `${token} names no requirement or file of this project.`, {
          target: token,
          fix: "Mention a requirement as @REQ-NNN or a file by its path from the project's root.",
        })
      );
    }
  }
  return ctx;
}

function contextFiles(ctx: Context): string[] {
  const out: string[] = [];
  for (const r of ctx.requirements) out.push(r.file, ...(r.feature ? [r.feature] : []));
  out.push(...ctx.files);
  return [...new Set(out)];
}

export function promptFor(request: string, ctx: Context): string {
  const lines = [
    "# A request about this project's specification",
    "",
    request,
    "",
    "You are working in a copy of the project. Nothing you write here reaches it:",
    "a person reads your changes as a diff, then applies them or discards them.",
    "",
    "## What you may change",
    "",
    "Only the specification: `spec.md`, `docs/specs/**` and `features/**`.",
    "A change to any other file is dropped. Do not commit, and do not run",
    "`specgate apply` or `specgate archive`. If nothing should change, change nothing.",
  ];
  if (ctx.requirements.length || ctx.files.length) lines.push("", "## Context");
  for (const r of ctx.requirements) {
    lines.push("", `### ${r.id}, from ${r.file}`, "", r.section);
    if (r.feature) lines.push("", `Its feature file: ${r.feature}`);
  }
  if (ctx.files.length) {
    lines.push("", "Read these files first:", ...ctx.files.map((f) => `- ${f}`));
  }
  lines.push(
    "",
    "## When you are done",
    "",
    `Write \`${ANSWER_FILE}\` at the root of this folder:`,
    "",
    "```json",
    '{ "why": { "<path>": "<one line: why this file changes>" },',
    '  "then": ["specgate validate"],',
    '  "read": ["<each file you read>"] }',
    "```",
    "",
    "`then` lists the specgate checks to run once the change is applied:",
    "`specgate validate`, `specgate draft --check <module>`, `specgate change validate <id>`.",
    ""
  );
  return lines.join("\n");
}

// ── then ──────────────────────────────────────────────────────────────────────

/** A `then` command's arguments to specgate, or null when it is not one of its checks. */
export function thenArgs(command: string): string[] | null {
  if (/[;&|<>`$(){}\\\r\n]/.test(command)) return null;
  const words = command.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  if (words[i] === "npx") i += 1;
  if (!["specgate", "@rsaglobaltech/specgate"].includes(words[i] || "")) return null;
  const args = words.slice(i + 1).map((w) => w.replace(/^(["'])(.*)\1$/, "$2"));
  const [sub, sub2] = args;
  const ok =
    ["validate", "status", "matrix", "questions", "check"].includes(sub) ||
    (sub === "draft" && args.includes("--check")) ||
    (sub === "change" && ["validate", "show"].includes(sub2));
  if (!ok) return null;
  if (sub === "matrix" && !args.includes("--dry-run")) args.push("--dry-run");
  // `validate` takes the project's folder; the check runs in it.
  if (sub === "validate" && !args.slice(1).some((a) => !a.startsWith("-"))) args.push(".");
  return args;
}

function thenOf(asked: unknown): { then: string[]; status: Diagnostic[] } {
  const then: string[] = [];
  const status: Diagnostic[] = [];
  for (const c of Array.isArray(asked) ? asked : []) {
    if (typeof c !== "string" || !c.trim()) continue;
    const command = c.trim();
    if (thenArgs(command)) {
      if (!then.includes(command)) then.push(command);
    } else {
      status.push(
        warning("then_refused", `"${command}" is not a specgate check: it will not run.`, {
          target: command,
          fix: "Only specgate's checks run after a plan: validate, status, matrix, questions, check, draft --check, change validate, change show.",
        })
      );
    }
  }
  return { then, status };
}

function runThen(projectDir: string, command: string) {
  const args = thenArgs(command) as string[];
  const bin = path.join(findCliRoot(__dirname), "bin", "specgate.js");
  const r = spawnSync(
    process.execPath,
    [bin, ...args, ...(args.includes("--json") ? [] : ["--json"])],
    {
      cwd: projectDir,
      encoding: "utf8",
      maxBuffer: MAX_OUTPUT,
      timeout: 10 * 60 * 1000,
      windowsHide: true,
    }
  );
  let findings: Diagnostic[] = [];
  const out = String(r.stdout || "");
  const at = out.indexOf("{");
  if (at >= 0) {
    try {
      const doc = JSON.parse(out.slice(at));
      if (Array.isArray(doc.status)) findings = doc.status;
    } catch {
      /* not one document */
    }
  }
  return { command, exit: typeof r.status === "number" ? r.status : 1, findings };
}

// ── The scratch copy ──────────────────────────────────────────────────────────

interface Scratch {
  root: string;
  work: string;
  git: (...args: string[]) => ReturnType<typeof spawnSync>;
  hashes: Map<string, string>;
}

function makeScratch(projectDir: string): Scratch | Diagnostic {
  const listed = spawnSync(
    "git",
    ["-C", projectDir, "ls-files", "-co", "--exclude-standard", "-z"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  );
  if (listed.status !== 0) {
    return error("agent_needs_git", "agent ask needs the project in a git repository.", {
      fix: "git init && git add -A && git commit -m init",
    });
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ask-"));
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  const config = path.join(root, "empty.gitconfig");
  fs.writeFileSync(config, "");
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of ["GIT_INDEX_FILE", "GIT_PREFIX", "GIT_OBJECT_DIRECTORY"]) delete env[name];
  Object.assign(env, {
    GIT_DIR: path.join(root, "base.git"),
    GIT_WORK_TREE: work,
    // Nobody's hooks, filters or diff settings: the bytes as they are.
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "specgate",
    GIT_AUTHOR_EMAIL: "specgate@localhost",
    GIT_COMMITTER_NAME: "specgate",
    GIT_COMMITTER_EMAIL: "specgate@localhost",
  });
  const git = (...args: string[]) =>
    spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], {
      cwd: work,
      env,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    });

  const hashes = new Map<string, string>();
  for (const rel of new Set(String(listed.stdout).split("\0").filter(Boolean))) {
    const src = path.join(projectDir, ...rel.split("/"));
    let bytes: Buffer;
    try {
      if (!fs.lstatSync(src).isFile()) continue;
      bytes = fs.readFileSync(src);
    } catch {
      continue; // deleted in the working tree
    }
    const dest = path.join(work, ...rel.split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    hashes.set(rel, sha256(bytes));
  }
  const list = path.join(root, "files.list");
  fs.writeFileSync(list, [...hashes.keys()].join("\0"));
  git("init", "-q");
  if (hashes.size) git("add", "-f", `--pathspec-from-file=${list}`, "--pathspec-file-nul");
  git("commit", "-q", "--no-verify", "--allow-empty", "-m", "base");
  return { root, work, git, hashes };
}

function removeScratch(root: string): void {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** What the agent changed in its copy: every path, with how. */
function changesIn(s: Scratch): Array<{ path: string; change: PlanChange }> {
  s.git("add", "-A");
  const r = s.git("diff", "--cached", "--name-status", "--no-renames", "-z", "HEAD");
  const parts = String(r.stdout || "")
    .split("\0")
    .filter(Boolean);
  const out: Array<{ path: string; change: PlanChange }> = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const code = parts[i][0];
    const change: PlanChange = code === "A" ? "add" : code === "D" ? "delete" : "modify";
    out.push({ path: parts[i + 1], change });
  }
  return out;
}

function readAnswer(work: string): Record<string, unknown> {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(work, ANSWER_FILE), "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// ── ask ───────────────────────────────────────────────────────────────────────

const askShape = { plan: null };

export async function agentAsk(
  projectDir: string,
  request: string,
  o: AskOptions = {}
): Promise<Outcome> {
  const mode = o.mode || "spec";
  if (!(MODES as readonly string[]).includes(mode)) {
    return {
      ok: false,
      usage: true,
      document: askShape,
      status: [
        error(
          "agent_mode_unknown",
          `Mode "${mode}" does not exist: an agent's plan changes the specification only.`,
          {
            target: mode,
            fix: "Leave out --mode (spec is the only mode); code is built through specgate harness run, behind the gate.",
          }
        ),
      ],
    };
  }
  if (!request.trim()) {
    return {
      ok: false,
      usage: true,
      document: askShape,
      status: [
        error("missing_argument", "Say what to ask the agent.", {
          fix: 'specgate agent ask "<request>"',
        }),
      ],
    };
  }
  const agent = agentCommand(projectDir, o);
  if ("code" in agent) return { ok: false, usage: false, document: askShape, status: [agent] };
  const plans = plansDir(projectDir);
  const scratch = plans ? makeScratch(projectDir) : null;
  if (!plans || !scratch || "code" in scratch) {
    const d =
      scratch && "code" in scratch
        ? scratch
        : error("agent_needs_git", "agent ask needs the project in a git repository.", {
            fix: "git init && git add -A && git commit -m init",
          });
    return { ok: false, usage: false, document: askShape, status: [d] };
  }

  try {
    const ctx = resolveContext(projectDir, request, o.req, o.files);
    const prompt = promptFor(request, ctx);
    const promptFile = path.join(scratch.root, "prompt.md");
    fs.writeFileSync(promptFile, prompt, "utf8");
    const seconds =
      o.timeoutSeconds && o.timeoutSeconds > 0 ? o.timeoutSeconds : DEFAULT_TIMEOUT_SECONDS;
    const run = await runAgent(agent.command, scratch.work, prompt, promptFile, seconds * 1000);
    if (run.timedOut || run.code !== 0) {
      const tail = run.stderr.trim().slice(-800) || run.stdout.trim().slice(-800);
      const how = run.timedOut
        ? `timed out after ${seconds} s`
        : `exited ${run.code ?? "on a signal"}`;
      return {
        ok: false,
        usage: false,
        document: askShape,
        status: [
          error("agent_failed", `The agent ${how}${tail ? `: ${tail}` : "."}`, {
            fix: run.timedOut
              ? "Give it longer with --timeout <seconds>, or ask for less at once."
              : "Run the agent's command on its own to see why it fails, then ask again.",
          }),
        ],
      };
    }

    const status: Diagnostic[] = [...ctx.status];
    const answer = readAnswer(scratch.work);
    const why = (answer.why && typeof answer.why === "object" ? answer.why : {}) as Record<
      string,
      unknown
    >;
    const files: PlanFile[] = [];
    const after = new Map<string, Buffer | null>();
    for (const c of changesIn(scratch)) {
      if (c.path === ANSWER_FILE) continue;
      if (!safeRelative(c.path) || !inSpecScope(c.path)) {
        status.push(
          warning(
            "edit_refused",
            `The agent changed ${c.path}, outside the specification: left out of the plan.`,
            {
              target: c.path,
              fix: "A plan changes spec.md, docs/specs/** and features/** only; build code with specgate harness run.",
            }
          )
        );
        continue;
      }
      const diff = String(
        scratch.git(
          "diff",
          "--cached",
          "--no-color",
          "--no-ext-diff",
          "--text",
          "--no-renames",
          "HEAD",
          "--",
          c.path
        ).stdout || ""
      );
      files.push({
        path: c.path,
        change: c.change,
        why: typeof why[c.path] === "string" ? (why[c.path] as string) : "",
        diff,
      });
      after.set(
        c.path,
        c.change === "delete"
          ? null
          : fs.readFileSync(path.join(scratch.work, ...c.path.split("/")))
      );
    }

    const asked = thenOf(answer.then);
    status.push(...asked.status);
    const then = files.length ? (asked.then.length ? asked.then : ["specgate validate"]) : [];
    const workRoots = [scratch.work];
    try {
      workRoots.push(fs.realpathSync(scratch.work));
    } catch {
      /* as it is */
    }
    const reported = [
      ...(Array.isArray(answer.read)
        ? answer.read.filter((r): r is string => typeof r === "string")
        : []),
      ...readsOf(run.stdout, workRoots),
    ]
      .map((r) => posix(path.normalize(r)).replace(/^\.\//, ""))
      .filter(
        (r) =>
          safeRelative(r) &&
          r !== ANSWER_FILE &&
          fs.existsSync(path.join(projectDir, ...r.split("/")))
      );
    const read = [...new Set([...contextFiles(ctx), ...reported])];

    const plan: PlanAnswer = {
      id: null,
      request,
      mode: "spec",
      created: new Date().toISOString(),
      files,
      then,
      read,
      usage: usageOf(run.stdout),
    };
    if (!files.length) {
      status.unshift(
        info(
          "plan_empty",
          "The agent changed nothing in the specification: nothing would change.",
          {
            fix: "Ask again with more detail, or mention the requirement with @REQ-NNN.",
          }
        )
      );
      return { ok: true, document: { plan, status } };
    }

    const id = newId();
    plan.id = id;
    const head = spawnSync("git", ["-C", projectDir, "rev-parse", "--verify", "-q", "HEAD"], {
      encoding: "utf8",
    });
    const stored: StoredPlan = {
      schemaVersion: 1,
      ...plan,
      id,
      base: {
        commit: head.status === 0 ? String(head.stdout).trim() : null,
        files: Object.fromEntries(files.map((f) => [f.path, scratch.hashes.get(f.path) ?? null])),
      },
    };
    const dir = path.join(plans, id);
    fs.mkdirSync(path.join(dir, "after"), { recursive: true });
    files.forEach((f, i) => {
      const bytes = after.get(f.path);
      if (bytes) fs.writeFileSync(path.join(dir, "after", String(i)), bytes);
    });
    fs.writeFileSync(path.join(dir, "plan.json"), `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    return { ok: true, document: { plan, status } };
  } finally {
    removeScratch(scratch.root);
  }
}

// ── plans, discard, apply ─────────────────────────────────────────────────────

export function agentPlans(projectDir: string): Outcome {
  const dir = plansDir(projectDir);
  const ids =
    dir && fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((n) => ID.test(n))
          .sort()
      : [];
  const plans = ids
    .map((id) => readPlan(projectDir, id))
    .filter((p): p is StoredPlan => p !== null)
    .map((p) => ({
      id: p.id,
      request: p.request,
      created: p.created,
      files: p.files.map((f) => ({ path: f.path, change: f.change })),
      stale: staleFiles(projectDir, p).length > 0,
    }));
  return { ok: true, document: { plans, status: [] } };
}

export function agentDiscard(projectDir: string, id: string): Outcome {
  if (!readPlan(projectDir, id)) {
    return { ok: false, usage: false, document: { discarded: null }, status: [notFound(id)] };
  }
  fs.rmSync(path.join(plansDir(projectDir) as string, id), { recursive: true, force: true });
  return { ok: true, document: { discarded: { id }, status: [] } };
}

export function agentApply(projectDir: string, id: string): Outcome {
  const shape = { applied: null };
  const plan = readPlan(projectDir, id);
  if (!plan) return { ok: false, usage: false, document: shape, status: [notFound(id)] };
  const bad = plan.files.filter((f) => !safeRelative(f.path) || !inSpecScope(f.path));
  if (bad.length) {
    return {
      ok: false,
      usage: false,
      document: shape,
      status: bad.map((f) =>
        error("edit_refused", `The plan names ${f.path}, outside the specification.`, {
          target: f.path,
          fix: `specgate agent discard ${id}`,
        })
      ),
    };
  }
  const stale = staleFiles(projectDir, plan);
  if (stale.length) {
    return {
      ok: false,
      usage: false,
      document: shape,
      status: stale.map((f) =>
        error(
          "plan_stale",
          `${f} changed since the agent proposed this plan: nothing was written.`,
          {
            target: f,
            fix: `specgate agent discard ${id}, then ask again: specgate agent ask ${JSON.stringify(plan.request)}`,
          }
        )
      ),
    };
  }
  const dir = path.join(plansDir(projectDir) as string, id);
  const written: Array<{ path: string; change: PlanChange }> = [];
  plan.files.forEach((f, i) => {
    const target = path.join(projectDir, ...f.path.split("/"));
    if (f.change === "delete") fs.rmSync(target, { force: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, fs.readFileSync(path.join(dir, "after", String(i))));
    }
    written.push({ path: f.path, change: f.change });
  });
  fs.rmSync(dir, { recursive: true, force: true });

  const status: Diagnostic[] = [];
  const then = plan.then.filter((c) => thenArgs(c)).map((c) => runThen(projectDir, c));
  for (const t of then) {
    if (t.exit !== 0) {
      status.push(
        warning("then_failed", `${t.command} exited ${t.exit} after the plan was written.`, {
          target: t.command,
          fix: "Read its findings under applied.then; the files are written, nothing is committed.",
        })
      );
    }
  }
  return { ok: true, document: { applied: { id, written, then }, status } };
}
