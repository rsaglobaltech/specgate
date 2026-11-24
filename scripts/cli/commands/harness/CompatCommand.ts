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
  releaseGaps,
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
import { makeSandbox, removeSandbox, sandboxLine, type ExamSandbox } from "../../../lib/compat-sandbox";

/** Tools whose default command approves its own actions: not run outside a sandbox unless the Developer says so (REQ-738). */
const SELF_APPROVING: readonly CompatTool[] = ["opencode"];

/** This checkout's root: its CLI, and the exam it ships under compat/. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CLI = path.join(ROOT, "bin", "specgate.js");
/** The exam's tasks; SPECGATE_COMPAT_TASKS names another folder of them, as the tests do. */
const TASKS = process.env.SPECGATE_COMPAT_TASKS || path.join(ROOT, "compat", "tasks");
/** What the specification is, for the verdict that it was left as it was. */
const SPEC_PATHS = ["spec.md", "features", "docs/specs"];

interface Task {
  id: string;
  dir: string;
  requirement: string | null;
  verdicts: Verdict[];
  hidden?: string;
  /** For `trap`: the code the task asks for, and the test that contradicts the scenario. */
  code?: string;
  test?: string;
  /** compat-honest REQ-731: the gate also runs the requirement's scenarios. */
  scenarios?: boolean;
}

/** This Specgate's version: each run says which one examined it (REQ-732). */
const VERSION: string = (() => {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  } catch {
    return "unknown";
  }
})();

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
                       [--sandbox sbx | --no-sandbox] [--auth-<tool>]
                       [--ladder] [--agent-<tool> "<cmd>"] [--model-<tool> <m>] [--keep-env <VAR>] [--timeout <s>]
     ${c.bold}specgate compat report${c.reset} [--json]
     ${c.bold}specgate compat check-release${c.reset}   was this Specgate examined with the real tools?

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

  --sandbox sbx runs each agent in a Docker sandbox that holds its run and
  nothing else of this machine, its network the tool's provider and the package
  registry; --auth-<tool> puts your own stored session of the tool inside, for a
  model that needs an account. OpenCode approves its own commands: it runs only
  in a sandbox, or with --no-sandbox at your word.

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
      // A server of the run's own: the background service has the Developer's configuration and none of the run's environment (REQ-729).
      return `opencode run --standalone --auto -m ${q(model)} --format json -f {prompt_file} {extra} "Follow the attached instructions exactly."`;
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
    // What a change's tasks list says is the work's own record, and what sits beside the feature files —
    // the steps that run them — is code the agent is asked to write: neither is the specification.
    if (/^docs\/specs\/changes\/[^/]+\/tasks\.md$/.test(rel)) continue;
    if (rel.startsWith("features/") && !rel.endsWith(".feature")) continue;
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
  /** At B: where the copy's AGENTS.md waits, outside every folder above the copy (REQ-719). */
  kept: string | null;
}

/** The copy, given the level's integration (REQ-712, REQ-719); the command line's extra flags. */
function integrate(dir: string, tool: CompatTool, level: CompatLevel, scratch: string, logDir: string, box: ExamSandbox | null): Wiring {
  const it = integrationOf(tool, level)!;
  // In the run's folder from the start: what Specgate's side sees can be read while the agent works.
  // In a sandbox they are written inside it, where the run's folder on the host does not exist.
  // A tool that approves its own commands reads its environment too: on the machine, what points at the
  // exam's results is kept out of it — an agent found the earlier runs that way (2026-11-24).
  const away = Boolean(box) || SELF_APPROVING.includes(tool);
  const mcpLog = path.join(away ? scratch : logDir, "mcp.log");
  const hookLog = path.join(away ? scratch : logDir, "hooks.log");
  if (!it.rules) {
    // REQ-719: nothing of Specgate's to read while the agent works; put back to judge.
    // Not in the run's own folder: tools look for AGENTS.md in every folder above the project.
    const kept = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-compat-kept-"));
    fs.copyFileSync(path.join(dir, "AGENTS.md"), path.join(kept, "AGENTS.md"));
    fs.rmSync(path.join(dir, "AGENTS.md"));
    return { extra: "", mcpLog, hookLog, kept };
  }
  // Claude Code's rules file: it reads CLAUDE.md, which points at AGENTS.md.
  if (tool === "claude") fs.writeFileSync(path.join(dir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
  for (const t of it.agentsInit) cli(dir, "agents", "init", "--tool", t, "--force");
  if (it.skillsFor) cli(dir, "agents", "init", "--format", "skills", "--tool", it.skillsFor, "--force");
  // REQ-717: the server says what it was asked in the run's own file.
  const serve = box
    ? { command: `${box.home}/.local/bin/specgate`, args: ["mcp", "serve", "--log", mcpLog] }
    : { command: process.execPath, args: [CLI, "mcp", "serve", "--log", mcpLog] };
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
  return { extra: extra.join(" "), mcpLog, hookLog, kept: null };
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

/** A configuration folder of the run's own for OpenCode (REQ-729). */
function opencodeConfig(scratch: string): string {
  const dir = path.join(scratch, "xdg-config");
  fs.mkdirSync(path.join(dir, "opencode"), { recursive: true });
  // What OpenCode can be told: no folder outside the project. Its shell is not held by this — a sandbox is.
  fs.writeFileSync(path.join(dir, "opencode", "opencode.json"), `${JSON.stringify({ permission: { external_directory: "deny" } }, null, 2)}\n`);
  return dir;
}

const linesOf = (file: string): Array<Record<string, unknown>> => {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

interface RunOptions {
  /** compat-sandboxed REQ-736: the sandbox a tool's run at a level goes in; absent on the machine. */
  boxFor?: (tool: CompatTool, level: CompatLevel) => ExamSandbox;
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
    testNamesReq: false, seconds: 0, exit: null, at: new Date().toISOString(), specgate: VERSION,
  };
  if (!integrationOf(tool, level)) return base;
  // REQ-730: a tool that is not there never worked.
  if (version === "unknown" && !o.agents[tool]) return { ...base, ran: true, invalid: `${tool} is not installed`, passed: false };

  // REQ-736: in a sandbox the run is a folder of the batch's own, the only one the sandbox has.
  let box: ExamSandbox | null = null;
  try {
    box = o.boxFor ? o.boxFor(tool, level) : null;
  } catch (e) {
    // No sandbox, no run: the agent is never started on the machine instead.
    return { ...base, ran: true, invalid: `no sandbox: ${(e as Error).message}`, passed: false };
  }
  if (box) {
    base.sandbox = "sbx";
    base.network = box.open;
  }
  const scratch = fs.mkdtempSync(path.join(box ? box.workspace : os.tmpdir(), `specgate-compat-${tool}-${level}-`));
  const dir = path.join(scratch, "project");
  const logDir = path.join(o.outDir, "runs", `${base.at.replace(/[:.]/g, "-")}-${tool}-${level}-${task.id}-${n}`);
  fs.mkdirSync(logDir, { recursive: true });
  let keptDir: string | null = null;
  try {
    fs.cpSync(path.join(task.dir, "fixture"), dir, { recursive: true });
    // REQ-731: a task's project with dependencies has them before the agent starts.
    if (fs.existsSync(path.join(dir, "package-lock.json"))) {
      const ci = spawnSync("npm", ["ci", "--silent", "--no-audit", "--no-fund"], { cwd: dir, encoding: "utf8", timeout: 300_000, shell: process.platform === "win32" });
      if (ci.status !== 0) return { ...base, ran: true, invalid: `npm ci failed in the task's project: ${(ci.stderr || ci.stdout || "").trim().split("\n").slice(-1)[0]}`, passed: false };
    }
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "the exam as given");
    const given = (git(dir, "rev-parse", "HEAD").stdout || "").trim();
    const wiring = integrate(dir, tool, level, scratch, logDir, box);
    keptDir = wiring.kept;
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", `${level} for ${tool}`, "--allow-empty");

    // With Specgate, the agent's `specgate` is this checkout's, first on its PATH.
    const bin = path.join(scratch, "bin");
    fs.mkdirSync(bin);
    if (box) {
      // In a sandbox Specgate is installed inside at the levels that have it, and is not there at B: nothing to shadow.
    } else if (level === "M")
      // Should a shell be reached all the same, the CLI is not there to answer it.
      fs.writeFileSync(
        path.join(bin, "specgate"),
        '#!/bin/sh\necho "specgate: the CLI is not available here — use the tools of the specgate MCP server" >&2\nexit 127\n',
        { mode: 0o755 }
      );
    else if (level === "B")
      // REQ-719: a Specgate installed for every project on this machine does not answer here.
      fs.writeFileSync(path.join(bin, "specgate"), '#!/bin/sh\necho "specgate: command not found" >&2\nexit 127\n', { mode: 0o755 });
    else
      fs.writeFileSync(path.join(bin, "specgate"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
    const promptFile = path.join(scratch, "prompt.md");
    fs.copyFileSync(path.join(task.dir, "prompt.md"), promptFile);
    fs.copyFileSync(promptFile, path.join(logDir, "prompt.md"));

    const template = o.agents[tool] || defaultCommand(tool, model);
    const agent = template.split("{extra}").join(wiring.extra).split("{prompt_file}").join(q(promptFile));
    fs.writeFileSync(path.join(logDir, "command.txt"), `${agent}\n`);
    // REQ-718: the session is kept as it happens, not when the tool ends.
    const sessionFile = path.join(logDir, "session.jsonl");
    const stderrFile = path.join(logDir, "stderr.log");
    // In the sandbox too, the tool's configuration is a folder of the run: the kit's own AGENTS.md, skills and servers stay out.
    const inside = box
      ? sandboxLine(box, dir, agent, { SPECGATE_HOOK_LOG: wiring.hookLog, XDG_CONFIG_HOME: opencodeConfig(scratch) })
      : agent;
    const command = `( ${inside} ) > ${q(sessionFile)} 2> ${q(stderrFile)}`;

    // REQ-714: the provider keys stay out unless named.
    const saved: Record<string, string> = {};
    for (const k of PROVIDER_KEYS) {
      if (o.keep.includes(k) || process.env[k] === undefined) continue;
      saved[k] = process.env[k]!;
      delete process.env[k];
    }
    const home = tool === "codex" && !box ? codexHome(scratch) : null;
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
          // REQ-729: OpenCode with a configuration of its own — the Developer's servers, keys and plugins stay out.
          ...(tool === "opencode" ? { XDG_CONFIG_HOME: opencodeConfig(scratch) } : {}),
        },
      });
    } finally {
      Object.assign(process.env, saved);
      home?.done();
    }
    base.ran = true;
    base.seconds = Math.round((Date.now() - t0) / 100) / 10;
    base.exit = r.status;
    const said = fs.existsSync(sessionFile) ? fs.readFileSync(sessionFile, "utf8") : "";
    // What Specgate's side recorded inside the sandbox, kept with the run.
    const away = path.dirname(wiring.mcpLog) !== logDir;
    if (away)
      for (const f of [wiring.mcpLog, wiring.hookLog])
        if (fs.existsSync(f)) fs.copyFileSync(f, path.join(logDir, path.basename(f)));
    const kept = (f: string) => (away ? path.join(logDir, path.basename(f)) : f);

    // REQ-718: what the tool says it did.
    const session = sessionOf(tool, said);
    base.toolCalls = session.calls.length;
    base.testFirst = testFirst(session, fs.realpathSync(dir));
    base.tokensIn = session.tokensIn;
    base.tokensOut = session.tokensOut;
    base.cost = session.cost;
    // REQ-730: the provider refused and the tool did nothing — the run says nothing about the agent.
    if (session.providerError && session.calls.length === 0) {
      base.invalid = session.providerError;
      base.passed = false;
      base.reason = null;
      return base;
    }
    // REQ-717: what Specgate's own side saw.
    const hooks = linesOf(kept(wiring.hookLog));
    base.mcpCalls = linesOf(kept(wiring.mcpLog)).length;
    base.refusals = hooks.filter((h) => h.hook === "guard" && h.decision === "refused").length;
    base.gateHooks = hooks.filter((h) => h.hook === "gate").length;

    // The gate's own file, put back to judge a run that worked without it (REQ-719).
    if (wiring.kept) fs.copyFileSync(path.join(wiring.kept, "AGENTS.md"), path.join(dir, "AGENTS.md"));

    base.testNamesReq = testNamesReq(dir, task.requirement, task.hidden);
    const trap = task.verdicts.includes("trap");
    const changed = task.verdicts.includes("specUnchanged") || trap ? specChanged(dir, given) : [];
    const fresh = task.verdicts.includes("proposed") ? newRequirements(dir, given) : [];
    const source = task.verdicts.includes("proposed") ? changedSince(dir, given, ["src"]) : [];
    if (task.verdicts.includes("gate") || trap) {
      const check = cli(dir, "check", dir, "--json");
      base.check = check.status === 0;
      fs.writeFileSync(path.join(logDir, "check.json"), check.stdout || "");
      // REQ-731: the gate that runs the scenarios — `check` and the requirement's scenarios through bdd_cmd.
      if (task.scenarios && task.requirement) {
        const sc = cli(dir, "scenarios", task.requirement, "--json");
        fs.writeFileSync(path.join(logDir, "scenarios.json"), sc.stdout || "");
        base.check = base.check && sc.status === 0;
      }
    }
    if ((task.verdicts.includes("hidden") || trap) && task.hidden) {
      fs.copyFileSync(path.join(task.dir, "hidden", task.hidden), path.join(dir, task.hidden));
      const hidden = spawnSync(process.execPath, ["--test", task.hidden], { cwd: dir, encoding: "utf8", timeout: 120_000, env: checkEnv() });
      base.hidden = hidden.status === 0;
      fs.writeFileSync(path.join(logDir, "hidden.log"), `${hidden.stdout || ""}${hidden.stderr || ""}`);
    }
    const verdict = verdictOf(task.verdicts, {
      gate: base.check, hidden: base.hidden, specChanged: changed, newRequirements: fresh, sourceChanged: source,
      codeThere: Boolean(task.code) && fs.existsSync(path.join(dir, task.code!)),
      testAsGiven:
        Boolean(task.test) &&
        fs.existsSync(path.join(dir, task.test!)) &&
        fs.readFileSync(path.join(dir, task.test!), "utf8") === (git(dir, "show", `${given}:${task.test}`).stdout || ""),
    });
    base.passed = verdict.passed;
    base.reason = verdict.reason;
    base.outcome = verdict.outcome ?? null;
    return base;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    if (keptDir) fs.rmSync(keptDir, { recursive: true, force: true });
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

    if (sub === "check-release") {
      // REQ-732: was this Specgate examined with the real tools?
      const gaps = releaseGaps(readRuns(runsFile), VERSION);
      if (gaps.length > 0) {
        io.fail(
          { compat: { version: VERSION, gaps } },
          gaps.map((g) => ({
            code: "compat_not_examined",
            message: g,
            severity: "error" as const,
            fix: "specgate compat run --level L0 --task deliver",
          }))
        );
        process.exitCode = 1;
        return;
      }
      io.emit({ compat: { version: VERSION, gaps } }, () => {
        process.stdout.write(`  ✔  Specgate ${VERSION} was examined with ${COMPAT_TOOLS.join(", ")}: L0 on deliver is green\n`);
      });
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

    // compat-sandboxed REQ-738: a tool that approves its own actions reads what the Developer can.
    const sandbox = flag("--sandbox");
    const noSandbox = args.includes("--no-sandbox");
    if (sandbox && sandbox !== "sbx") {
      io.fail({ compat: null }, [
        { code: "compat_bad_flag", message: `unknown sandbox: ${sandbox}`, severity: "error", fix: "--sandbox sbx" },
      ]);
      process.exitCode = 2;
      return;
    }
    const exposed = tools.filter((t) => SELF_APPROVING.includes(t));
    if (!sandbox && !noSandbox && exposed.length > 0) {
      io.fail({ compat: null }, [
        {
          code: "compat_needs_sandbox",
          message: `${exposed.join(", ")} approves its own commands: outside a sandbox its agent reads whatever you can read.`,
          severity: "error",
          fix: "--sandbox sbx runs it in a Docker sandbox that holds its run and nothing else; --no-sandbox runs it on this machine at your word",
        },
      ]);
      process.exitCode = 2;
      return;
    }
    if (!sandbox && noSandbox && exposed.length > 0 && !json)
      process.stdout.write(`  ▲  --no-sandbox: the agent of ${exposed.join(", ")} can read what you can read on this machine.\n`);

    // REQ-736: one sandbox per tool and kind for the batch, made when first needed, removed when it ends.
    const boxes = new Map<string, ExamSandbox>();
    let tarball: string | null = null;
    const packed = (): string => {
      if (tarball) return tarball;
      if (process.env.SPECGATE_COMPAT_TARBALL) return (tarball = process.env.SPECGATE_COMPAT_TARBALL);
      const dest = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-compat-pack-"));
      const r = spawnSync("npm", ["pack", "--silent", "--ignore-scripts", "--pack-destination", dest], { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
      const name = `${r.stdout || ""}`.trim().split("\n").pop() || "";
      if (r.status !== 0 || !name) throw new Error(`npm pack failed: ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`);
      return (tarball = path.join(dest, name));
    };
    const removeBoxes = () => {
      for (const b of boxes.values()) removeSandbox(b);
      boxes.clear();
      if (tarball && !process.env.SPECGATE_COMPAT_TARBALL) fs.rmSync(path.dirname(tarball), { recursive: true, force: true });
    };
    if (sandbox) {
      o.boxFor = (tool, level) => {
        const kind = level === "B" ? "bare" : "specgate";
        const key = `${tool}:${kind}`;
        let b = boxes.get(key);
        if (!b) {
          if (!json) process.stdout.write(`  ·  making the sandbox for ${tool} (${kind === "bare" ? "no Specgate" : "with Specgate"})…\n`);
          b = makeSandbox(tool, kind, {
            tarball: kind === "specgate" ? packed() : null,
            auth: args.includes(`--auth-${tool}`),
            provider: (models[tool] || CHEAPEST_MODEL[tool]).split("/")[0],
          });
          boxes.set(key, b);
          if (!json) process.stdout.write(`  ·  ${b.name}: sees ${b.workspace} only; network ${b.open.join(", ")}\n`);
        }
        return b;
      };
      // Whatever ends the batch — its end, an error, an interruption — no sandbox outlives it.
      process.once("exit", removeBoxes);
      for (const sig of ["SIGINT", "SIGTERM"] as const)
        process.once(sig, () => {
          removeBoxes();
          process.exit(130);
        });
    }

    const done: CompatRun[] = [];
    const say = (r: CompatRun, n: number, count: number) => {
      if (json) return;
      const verdict = !r.ran ? "n/a" : r.invalid ? "invalid" : runPassed(r) ? "pass" : "fail";
      const use = r.ran ? `  mcp ${r.mcpCalls ?? 0} refused ${r.refusals ?? 0}` : "";
      process.stdout.write(
        `  ${verdict === "pass" ? "✔" : verdict === "n/a" ? "·" : "✖"}  ${r.tool} ${r.model} ${r.level} ${taskOf(r)} ${r.ran ? `${n}/${count}` : ""}  ${verdict}` +
          (r.ran ? `  ${r.seconds} s${use}${r.outcome ? `  (${r.outcome})` : ""}${r.reason ? `  — ${r.reason}` : ""}${r.invalid ? `  — ${r.invalid}` : ""}` : "") +
          "\n"
      );
    };
    for (const tool of tools) {
      const version = versionOf(tool);
      // REQ-730: two invalid runs in a row and the tool is not asked again in this batch.
      const refused = () => {
        const mine = done.filter((r) => r.tool === tool && r.ran);
        return mine.length >= 2 && mine.slice(-2).every((r) => r.invalid);
      };
      toolRuns: for (const task of chosen) {
        for (const level of levels) {
          if (refused()) {
            if (!json) process.stdout.write(`  ·  ${tool} was stopped after two invalid runs: ${done.filter((r) => r.tool === tool).slice(-1)[0]!.invalid}\n`);
            break toolRuns;
          }
          if (!integrationOf(tool, level)) {
            // The same model as the tool's other runs: a level it has no form for is a cell of its row, not a row of its own.
            const r = oneRun(tool, level, task, 1, version, models[tool] || (agents[tool] ? "custom" : CHEAPEST_MODEL[tool]), o);
            fs.appendFileSync(runsFile, `${JSON.stringify(r)}\n`);
            done.push(r);
            say(r, 1, 1);
            continue;
          }
          const batch = (model: string) => {
            for (let n = 1; n <= runs && !refused(); n++) {
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
            if (!model || refused()) break;
            batch(model);
          }
        }
      }
    }
    removeBoxes();
    io.emit({ compat: { runs: done, file: runsFile } }, () => {
      process.stdout.write(`\n  ➜  specgate compat report   the matrix from .specgate/compat/runs.jsonl\n`);
    });
  }
}
