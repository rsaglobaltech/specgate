/**
 * `specgate compat run|report` (harness-compat REQ-711…REQ-716, compat-evidence
 * REQ-717…REQ-725): the exam's tasks handed to Claude Code, Codex and OpenCode
 * at each level of integration, with and without Specgate; each run judged by
 * its task's verdicts and kept with what the tool did and what Specgate's
 * server and plugin saw; the internal report made from the runs.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo } from "../../../lib/agent";
import { c } from "../../../lib/ui";
import { runWithDeadline } from "../../../lib/run-with-deadline";
import {
  CHEAPEST_MODEL,
  COMPAT_LEVELS,
  COMPAT_TOOLS,
  DEFAULT_LEVELS,
  MODEL_LADDER,
  PROVIDER_KEYS,
  cheapestOf,
  deliveredWithoutUse,
  integrationOf,
  matrixMarkdown,
  matrixOf,
  nextModel,
  runPassed,
  tablesOf,
  taskOf,
  verdictOf,
  type CompatLevel,
  type CompatRun,
  type CompatTool,
  type Verdict,
} from "../../../../packages/core/src/domain/Compat";
import { sessionOf, testFirst } from "../../../../packages/core/src/domain/CompatSession";

/** This checkout's root: its CLI, and the exam it ships under compat/. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CLI = path.join(ROOT, "bin", "specgate.js");
const TASKS = path.join(ROOT, "compat", "tasks");
/** What the specification is, for the verdict that it was left as it was. */
const SPEC_PATHS = ["spec.md", "features", "docs/specs"];

interface Task {
  id: string;
  dir: string;
  requirement: string | null;
  verdicts: Verdict[];
  hidden?: string;
}

function tasks(): Task[] {
  if (!fs.existsSync(TASKS)) return [];
  return fs
    .readdirSync(TASKS)
    .filter((id) => fs.existsSync(path.join(TASKS, id, "task.json")))
    .sort()
    .map((id) => {
      const doc = JSON.parse(fs.readFileSync(path.join(TASKS, id, "task.json"), "utf8")) as Omit<Task, "id" | "dir">;
      return { id, dir: path.join(TASKS, id), ...doc };
    });
}

function usage(): void {
  process.stdout.write(
    `
  🧩 ${c.bold}specgate compat run${c.reset} [--tool claude,codex,opencode] [--level B,L0,L1,L2,L3,M] [--task <ids>] [--runs <n>]
                       [--ladder] [--agent-<tool> "<cmd>"] [--model-<tool> <m>] [--keep-env <VAR>] [--timeout <s>]
     ${c.bold}specgate compat report${c.reset} [--json]

  The compatibility exam: a small project and a task, handed to each tool at
  each level — B no Specgate at all, L0 the rules (AGENTS.md), L1 + skills or
  commands, L2 + Specgate's MCP server, L3 + the plugin (Claude Code, OpenCode),
  M the rules and the server with no shell: the server as the only way to Specgate.
  A run passes by its task's verdicts: \`specgate check\`, a hidden check it never
  saw, the specification left as it was.

  Tasks: ${tasks().map((t) => t.id).join(", ")} (default: deliver). Levels default to L0–L3.
  Each run keeps the tool's session, and what Specgate's server and plugin saw.
  --ladder runs each tool's cheapest model first and the next only where a cell
  is not green: ${COMPAT_TOOLS.map((t) => `${t} ${MODEL_LADDER[t].join(" → ")}`).join("; ")}.

  Runs go to .specgate/compat/runs.jsonl; report writes .specgate/compat/matrix.md
  (internal). The agent never sees ${PROVIDER_KEYS.join(", ")} unless --keep-env names one.
`
  );
}

const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** The command that runs `tool`, its session as JSON lines, before {prompt_file} and {extra} are filled. */
function defaultCommand(tool: CompatTool, model: string): string {
  switch (tool) {
    case "claude":
      // The Developer's own settings — plugins, hooks, servers — stay out of the exam.
      return (
        `claude -p --model ${q(model)} --setting-sources project,local --strict-mcp-config ` +
        `--permission-mode acceptEdits --output-format stream-json --verbose ` +
        `--allowedTools "Bash(npm *)" "Bash(node *)" "Bash(npx *)" "Bash(specgate *)" "Bash(git *)" "mcp__specgate" ` +
        `{extra} < {prompt_file}`
      );
    case "codex":
      return `codex exec -m ${q(model)} -s workspace-write --skip-git-repo-check --json {extra} - < {prompt_file}`;
    case "opencode":
      return `opencode run --auto -m ${q(model)} --format json -f {prompt_file} {extra} "Follow the attached instructions exactly."`;
  }
}

function versionOf(tool: CompatTool): string {
  const r = spawnSync(tool, ["--version"], { encoding: "utf8", timeout: 30_000 });
  const line = `${r.stdout || ""}`.trim().split("\n")[0] || "";
  return r.status === 0 && line ? line : "unknown";
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", ["-c", "user.email=compat@specgate", "-c", "user.name=specgate compat", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

/** The environment of a check: never a test runner's own, which makes a child `node --test` report to it and exit 0. */
function checkEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: checkEnv(),
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Files under `dir` the agent wrote that name the requirement: a test that links it. */
function testNamesReq(dir: string, req: string | null, hidden: string | undefined): boolean {
  if (!req) return false;
  const skip = new Set(["node_modules", ".git", "docs", "features", ".specgate", ".claude", ".agents", ".opencode"]);
  const walk = (d: string): boolean => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (walk(p)) return true;
      } else if (/\.test\.[cm]?[jt]s$/.test(e.name) && e.name !== hidden) {
        if (fs.readFileSync(p, "utf8").includes(req)) return true;
      }
    }
    return false;
  };
  return walk(dir);
}

/** Paths changed since `base`, tracked or new, under `prefixes`. */
function changedSince(dir: string, base: string, prefixes: string[]): string[] {
  const tracked = (git(dir, "diff", "--name-only", base, "--", ...prefixes).stdout || "").split("\n");
  const fresh = (git(dir, "ls-files", "--others", "--exclude-standard", "--", ...prefixes).stdout || "").split("\n");
  return [...new Set([...tracked, ...fresh].map((l) => l.trim()).filter(Boolean))].sort();
}

/** What a specification file says, without what `specgate apply` and ticking a task write. */
function meaning(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*<!--\s*specgate:trace\b.*-->\s*$/.test(l))
    .map((l) => l.replace(/^(\s*- )\[[ xX]\]/, "$1[ ]").trimEnd())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Specification files whose meaning changed since `base` (REQ-721): the derived matrix is not one. */
function specChanged(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const rel of changedSince(dir, base, SPEC_PATHS)) {
    if (rel === "docs/specs/traceability.md") continue;
    const before = git(dir, "show", `${base}:${rel}`);
    const file = path.join(dir, rel);
    const after = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (before.status !== 0 || after === null) {
      out.push(rel);
      continue;
    }
    if (meaning(before.stdout) !== meaning(after)) out.push(rel);
  }
  return out;
}

/** Requirement ids the specification states now and did not at `base` (REQ-723). */
function newRequirements(dir: string, base: string): string[] {
  const ids = (text: string) => new Set([...text.matchAll(/^#{2,4} Requirement: (REQ-\d+)/gm)].map((m) => m[1]!));
  const before = new Set<string>();
  const listed = (git(dir, "ls-tree", "-r", "--name-only", base, "--", ...SPEC_PATHS).stdout || "").split("\n");
  for (const rel of listed.filter((f) => f.endsWith(".md")))
    for (const id of ids(git(dir, "show", `${base}:${rel}`).stdout || "")) before.add(id);
  const now = new Set<string>();
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    const st = fs.statSync(d);
    if (st.isFile()) {
      if (d.endsWith(".md")) for (const id of ids(fs.readFileSync(d, "utf8"))) now.add(id);
      return;
    }
    for (const e of fs.readdirSync(d)) walk(path.join(d, e));
  };
  for (const p of SPEC_PATHS) walk(path.join(dir, p));
  return [...now].filter((id) => !before.has(id)).sort();
}

interface Wiring {
  extra: string;
  mcpLog: string;
  hookLog: string;
}

/** The copy, given the level's integration (REQ-712, REQ-719); the command line's extra flags. */
function integrate(dir: string, tool: CompatTool, level: CompatLevel, scratch: string): Wiring {
  const it = integrationOf(tool, level)!;
  const mcpLog = path.join(scratch, "mcp.log");
  const hookLog = path.join(scratch, "hooks.log");
  if (!it.rules) {
    // REQ-719: nothing of Specgate's to read while the agent works; put back to judge.
    fs.renameSync(path.join(dir, "AGENTS.md"), path.join(scratch, "AGENTS.md"));
    return { extra: "", mcpLog, hookLog };
  }
  // Claude Code's rules file: it reads CLAUDE.md, which points at AGENTS.md.
  if (tool === "claude") fs.writeFileSync(path.join(dir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
  for (const t of it.agentsInit) cli(dir, "agents", "init", "--tool", t, "--force");
  if (it.skillsFor) cli(dir, "agents", "init", "--format", "skills", "--tool", it.skillsFor, "--force");
  // REQ-717: the server says what it was asked in the run's own file.
  const serve = { command: process.execPath, args: [CLI, "mcp", "serve", "--log", mcpLog] };
  const extra: string[] = [];
  // REQ-726: no shell — the server is the only way to Specgate.
  if (!it.shell) {
    if (tool === "claude") extra.push("--disallowedTools Bash");
    if (tool === "codex") extra.push("-c features.shell_tool=false");
  }
  if (it.mcp) {
    if (tool === "claude") {
      const file = path.join(dir, ".mcp.json");
      fs.writeFileSync(file, `${JSON.stringify({ mcpServers: { specgate: serve } }, null, 2)}\n`);
      extra.push(`--mcp-config ${q(file)}`);
    } else if (tool === "opencode") {
      const file = path.join(dir, "opencode.json");
      fs.writeFileSync(
        file,
        `${JSON.stringify(
          {
            mcp: { specgate: { type: "local", command: [serve.command, ...serve.args], enabled: true } },
            ...(it.shell ? {} : { permission: { bash: "deny" } }),
          },
          null,
          2
        )}\n`
      );
    } else {
      // REQ-713: for this run only, on its command line — ~/.codex is never written.
      extra.push(
        `-c ${q(`mcp_servers.specgate.command=${JSON.stringify(serve.command)}`)}`,
        `-c ${q(`mcp_servers.specgate.args=${JSON.stringify(serve.args)}`)}`,
        // Without a person, `codex exec` refuses every MCP call unless the server's tools are approved (measured, 0.154).
        `-c ${q('mcp_servers.specgate.default_tools_approval_mode="approve"')}`
      );
    }
  }
  if (it.plugin) {
    if (tool === "claude") {
      const plugin = path.join(scratch, "claude-plugin");
      fs.mkdirSync(plugin, { recursive: true });
      cli(plugin, "agents", "init", "--tool", "claude-plugin", "--force");
      extra.push(`--plugin-dir ${q(plugin)}`);
    } else {
      cli(dir, "agents", "init", "--tool", "opencode-plugin", "--force");
    }
  }
  return { extra: extra.join(" "), mcpLog, hookLog };
}

/**
 * Codex writes each project it runs in into its home. The exam gives it a home
 * of its own with the Developer's login, so theirs is left as it was; a login
 * Codex renewed meanwhile is the one thing taken back.
 */
function codexHome(scratch: string): { env: Record<string, string>; done: () => void } {
  const own = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const auth = path.join(own, "auth.json");
  const home = path.join(scratch, "codex-home");
  fs.mkdirSync(home, { recursive: true });
  const had = fs.existsSync(auth) ? fs.readFileSync(auth, "utf8") : null;
  if (had !== null) fs.writeFileSync(path.join(home, "auth.json"), had, { mode: 0o600 });
  return {
    env: { CODEX_HOME: home },
    done: () => {
      try {
        const now = fs.readFileSync(path.join(home, "auth.json"), "utf8");
        if (had !== null && now !== had) fs.writeFileSync(auth, now, { mode: 0o600 });
      } catch {
        /* no login to take back */
      }
    },
  };
}

const linesOf = (file: string): Array<Record<string, unknown>> => {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

interface RunOptions {
  agents: Partial<Record<CompatTool, string>>;
  keep: string[];
  timeoutMs: number;
  outDir: string;
}

function oneRun(
  tool: CompatTool, level: CompatLevel, task: Task, n: number, version: string, model: string, o: RunOptions
): CompatRun {
  const base: CompatRun = {
    tool, level, version, model, task: task.id, ran: false, check: false, hidden: false,
    testNamesReq: false, seconds: 0, exit: null, at: new Date().toISOString(),
  };
  if (!integrationOf(tool, level)) return base;

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `specgate-compat-${tool}-${level}-`));
  const dir = path.join(scratch, "project");
  const logDir = path.join(o.outDir, "runs", `${base.at.replace(/[:.]/g, "-")}-${tool}-${level}-${task.id}-${n}`);
  fs.mkdirSync(logDir, { recursive: true });
  try {
    fs.cpSync(path.join(task.dir, "fixture"), dir, { recursive: true });
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "the exam as given");
    const given = (git(dir, "rev-parse", "HEAD").stdout || "").trim();
    const wiring = integrate(dir, tool, level, scratch);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", `${level} for ${tool}`, "--allow-empty");

    // With Specgate, the agent's `specgate` is this checkout's, first on its PATH.
    const bin = path.join(scratch, "bin");
    fs.mkdirSync(bin);
    if (level === "M")
      // Should a shell be reached all the same, the CLI is not there to answer it.
      fs.writeFileSync(
        path.join(bin, "specgate"),
        '#!/bin/sh\necho "specgate: the CLI is not available here — use the tools of the specgate MCP server" >&2\nexit 127\n',
        { mode: 0o755 }
      );
    else if (level !== "B")
      fs.writeFileSync(path.join(bin, "specgate"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
    const promptFile = path.join(scratch, "prompt.md");
    fs.copyFileSync(path.join(task.dir, "prompt.md"), promptFile);
    fs.copyFileSync(promptFile, path.join(logDir, "prompt.md"));

    const template = o.agents[tool] || defaultCommand(tool, model);
    const command = template.split("{extra}").join(wiring.extra).split("{prompt_file}").join(q(promptFile));
    fs.writeFileSync(path.join(logDir, "command.txt"), `${command}\n`);

    // REQ-714: the provider keys stay out unless named.
    const saved: Record<string, string> = {};
    for (const k of PROVIDER_KEYS) {
      if (o.keep.includes(k) || process.env[k] === undefined) continue;
      saved[k] = process.env[k]!;
      delete process.env[k];
    }
    const home = tool === "codex" ? codexHome(scratch) : null;
    const t0 = Date.now();
    let r;
    try {
      r = runWithDeadline(command, {
        cwd: dir,
        timeoutMs: o.timeoutMs,
        maxBuffer: 256 * 1024 * 1024,
        env: {
          PATH: `${bin}${path.delimiter}${process.env.PATH || ""}`,
          SPECGATE_HOOK_LOG: wiring.hookLog,
          ...(home ? home.env : {}),
        },
      });
    } finally {
      Object.assign(process.env, saved);
      home?.done();
    }
    base.ran = true;
    base.seconds = Math.round((Date.now() - t0) / 100) / 10;
    base.exit = r.status;
    fs.writeFileSync(path.join(logDir, "session.jsonl"), r.stdout || "");
    fs.writeFileSync(path.join(logDir, "stderr.log"), r.stderr || "");

    // REQ-718: what the tool says it did.
    const session = sessionOf(tool, r.stdout || "");
    base.toolCalls = session.calls.length;
    base.testFirst = testFirst(session, fs.realpathSync(dir));
    base.tokensIn = session.tokensIn;
    base.tokensOut = session.tokensOut;
    base.cost = session.cost;
    // REQ-717: what Specgate's own side saw.
    const hooks = linesOf(wiring.hookLog);
    base.mcpCalls = linesOf(wiring.mcpLog).length;
    base.refusals = hooks.filter((h) => h.hook === "guard" && h.decision === "refused").length;
    base.gateHooks = hooks.filter((h) => h.hook === "gate").length;
    for (const f of [wiring.mcpLog, wiring.hookLog])
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(logDir, path.basename(f)));

    // The gate's own file, put back to judge a run that worked without it (REQ-719).
    const kept = path.join(scratch, "AGENTS.md");
    if (fs.existsSync(kept)) fs.copyFileSync(kept, path.join(dir, "AGENTS.md"));

    base.testNamesReq = testNamesReq(dir, task.requirement, task.hidden);
    const changed = task.verdicts.includes("specUnchanged") ? specChanged(dir, given) : [];
    const fresh = task.verdicts.includes("proposed") ? newRequirements(dir, given) : [];
    const source = task.verdicts.includes("proposed") ? changedSince(dir, given, ["src"]) : [];
    if (task.verdicts.includes("gate")) {
      const check = cli(dir, "check", dir, "--json");
      base.check = check.status === 0;
      fs.writeFileSync(path.join(logDir, "check.json"), check.stdout || "");
    }
    if (task.verdicts.includes("hidden") && task.hidden) {
      fs.copyFileSync(path.join(task.dir, "hidden", task.hidden), path.join(dir, task.hidden));
      const hidden = spawnSync(process.execPath, ["--test", task.hidden], { cwd: dir, encoding: "utf8", timeout: 120_000, env: checkEnv() });
      base.hidden = hidden.status === 0;
      fs.writeFileSync(path.join(logDir, "hidden.log"), `${hidden.stdout || ""}${hidden.stderr || ""}`);
    }
    const verdict = verdictOf(task.verdicts, {
      gate: base.check, hidden: base.hidden, specChanged: changed, newRequirements: fresh, sourceChanged: source,
    });
    base.passed = verdict.passed;
    base.reason = verdict.reason;
    return base;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function listOf<T extends string>(value: string | undefined, all: readonly T[], fallback: readonly T[], what: string): T[] {
  if (!value) return [...fallback];
  const out = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (const v of out)
    if (!(all as readonly string[]).includes(v)) throw new Error(`unknown ${what}: ${v} — there is ${all.join(", ")}`);
  return out as T[];
}

const readRuns = (file: string): CompatRun[] =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as CompatRun)
    : [];

export class CompatCommand extends BaseCommand {
  public execute(): void {
    const args = this.args;
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      usage();
      return;
    }
    const json = args.includes("--json");
    const io = agentIo(json);
    const flag = (name: string) => {
      const i = args.indexOf(name);
      return i >= 0 ? args[i + 1] : undefined;
    };
    const projectDir = path.resolve(flag("--project-dir") || process.cwd());
    const outDir = path.join(projectDir, ".specgate", "compat");
    const runsFile = path.join(outDir, "runs.jsonl");
    const sub = args[0];

    if (sub === "report") {
      const runs = readRuns(runsFile);
      const tables = tablesOf(runs);
      const cheapest = cheapestOf(runs);
      const date = new Date().toISOString().slice(0, 10);
      fs.mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, "matrix.md");
      const md = matrixMarkdown(tables, date, cheapest);
      fs.writeFileSync(file, md);
      io.emit(
        { compat: { date, file, rows: matrixOf(runs), tables, cheapest, deliveredWithoutUse: deliveredWithoutUse(tables) } },
        () => {
          process.stdout.write(`${md}\n  ✔  ${path.relative(projectDir, file)}\n`);
        }
      );
      return;
    }

    if (sub !== "run") {
      io.fail({ compat: null }, [
        { code: "unknown_compat_command", message: `Unknown: compat ${sub}`, severity: "error", fix: "specgate compat run | report" },
      ]);
      process.exitCode = 2;
      return;
    }

    const all = tasks();
    let tools: CompatTool[];
    let levels: CompatLevel[];
    let chosen: Task[];
    try {
      tools = listOf(flag("--tool"), COMPAT_TOOLS, COMPAT_TOOLS, "tool");
      levels = listOf(flag("--level"), COMPAT_LEVELS, DEFAULT_LEVELS, "level");
      const ids = listOf(flag("--task"), all.map((t) => t.id), ["deliver"], "task");
      chosen = ids.map((id) => all.find((t) => t.id === id)!);
    } catch (e) {
      io.fail({ compat: null }, [
        {
          code: "compat_bad_flag",
          message: (e as Error).message,
          severity: "error",
          fix: `--tool ${COMPAT_TOOLS.join(",")} --level ${COMPAT_LEVELS.join(",")} --task ${all.map((t) => t.id).join(",")}`,
        },
      ]);
      process.exitCode = 2;
      return;
    }
    const runs = Math.max(1, Number(flag("--runs") || 3));
    const ladder = args.includes("--ladder");
    const keep: string[] = [];
    args.forEach((a, i) => {
      if (a === "--keep-env" && args[i + 1]) keep.push(args[i + 1]!);
    });
    const agents: RunOptions["agents"] = {};
    const models: Partial<Record<CompatTool, string>> = {};
    for (const t of COMPAT_TOOLS) {
      const a = flag(`--agent-${t}`);
      const m = flag(`--model-${t}`);
      if (a) agents[t] = a;
      if (m) models[t] = m;
    }
    const o: RunOptions = { agents, keep, timeoutMs: Number(flag("--timeout") || 900) * 1000, outDir };
    fs.mkdirSync(outDir, { recursive: true });

    const done: CompatRun[] = [];
    const say = (r: CompatRun, n: number, count: number) => {
      if (json) return;
      const verdict = !r.ran ? "n/a" : runPassed(r) ? "pass" : "fail";
      const use = r.ran ? `  mcp ${r.mcpCalls ?? 0} refused ${r.refusals ?? 0}` : "";
      process.stdout.write(
        `  ${verdict === "pass" ? "✔" : verdict === "n/a" ? "·" : "✖"}  ${r.tool} ${r.model} ${r.level} ${taskOf(r)} ${r.ran ? `${n}/${count}` : ""}  ${verdict}` +
          (r.ran ? `  ${r.seconds} s${use}${r.reason ? `  — ${r.reason}` : ""}` : "") +
          "\n"
      );
    };
    for (const tool of tools) {
      const version = versionOf(tool);
      for (const task of chosen) {
        for (const level of levels) {
          if (!integrationOf(tool, level)) {
            // The same model as the tool's other runs: a level it has no form for is a cell of its row, not a row of its own.
            const r = oneRun(tool, level, task, 1, version, models[tool] || (agents[tool] ? "custom" : CHEAPEST_MODEL[tool]), o);
            fs.appendFileSync(runsFile, `${JSON.stringify(r)}\n`);
            done.push(r);
            say(r, 1, 1);
            continue;
          }
          const batch = (model: string) => {
            for (let n = 1; n <= runs; n++) {
              const r = oneRun(tool, level, task, n, version, model, o);
              fs.appendFileSync(runsFile, `${JSON.stringify(r)}\n`);
              done.push(r);
              say(r, n, runs);
            }
          };
          if (!ladder || models[tool] || agents[tool]) {
            batch(models[tool] || (agents[tool] ? "custom" : CHEAPEST_MODEL[tool]));
            continue;
          }
          // REQ-725: the next model only while this cell is not green.
          for (;;) {
            const cell = readRuns(runsFile).filter(
              (r) => r.tool === tool && r.version === version && r.level === level && taskOf(r) === task.id
            );
            const model = nextModel(tool, cell);
            if (!model) break;
            batch(model);
          }
        }
      }
    }
    io.emit({ compat: { runs: done, file: runsFile } }, () => {
      process.stdout.write(`\n  ➜  specgate compat report   the matrix from .specgate/compat/runs.jsonl\n`);
    });
  }
}
