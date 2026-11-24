/**
 * `specgate compat run|report` (harness-compat REQ-711…REQ-716): the same
 * small project with one pending requirement, handed to Claude Code, Codex and
 * OpenCode at each level of integration; the gate and a hidden check judge each
 * run; the internal matrix is made from the runs.
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
  PROVIDER_KEYS,
  integrationOf,
  matrixMarkdown,
  matrixOf,
  runPassed,
  type CompatLevel,
  type CompatRun,
  type CompatTool,
} from "../../../../packages/core/src/domain/Compat";

/** This checkout's root: its CLI, and the exam it ships under compat/. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CLI = path.join(ROOT, "bin", "specgate.js");
const EXAM = path.join(ROOT, "compat");
const HIDDEN = "fees.hidden.test.js";
const REQ = "REQ-002";

function usage(): void {
  process.stdout.write(
    `
  🧩 ${c.bold}specgate compat run${c.reset} [--tool claude,codex,opencode] [--level L0,L1,L2,L3] [--runs <n>]
                       [--agent-<tool> "<cmd>"] [--model-<tool> <m>] [--keep-env <VAR>] [--timeout <s>]
     ${c.bold}specgate compat report${c.reset} [--json]

  The compatibility exam: one small project with ${REQ} pending, handed to each
  tool at each level — L0 the rules (AGENTS.md), L1 + skills or commands, L2 +
  Specgate's MCP server, L3 + the plugin (Claude Code, OpenCode). A run passes
  when \`specgate check\` and a hidden check it never saw both pass.

  Runs go to .specgate/compat/runs.jsonl; report writes .specgate/compat/matrix.md
  (internal). Models default to the cheapest: ${COMPAT_TOOLS.map((t) => `${t} ${CHEAPEST_MODEL[t]}`).join(", ")}.
  The agent never sees ${PROVIDER_KEYS.join(", ")} unless --keep-env names one.
`
  );
}

const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** The command that runs `tool` at a level, before {prompt_file} is filled. */
function defaultCommand(tool: CompatTool, model: string, extra: string): string {
  switch (tool) {
    case "claude":
      return (
        `claude -p --model ${q(model)} --permission-mode acceptEdits ` +
        `--allowedTools "Bash(npm *)" "Bash(node *)" "Bash(npx *)" "Bash(specgate *)" "Bash(git *)" "mcp__specgate" ` +
        `${extra} < {prompt_file}`
      );
    case "codex":
      return `codex exec -m ${q(model)} -s workspace-write --skip-git-repo-check ${extra} - < {prompt_file}`;
    case "opencode":
      return `opencode run --auto -m ${q(model)} -f {prompt_file} ${extra} "Follow the attached instructions exactly."`;
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
function testNamesReq(dir: string): boolean {
  const skip = new Set(["node_modules", ".git", "docs", "features", ".specgate", ".claude", ".agents", ".opencode"]);
  const walk = (d: string): boolean => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (walk(p)) return true;
      } else if (/\.test\.[cm]?[jt]s$/.test(e.name) && e.name !== HIDDEN) {
        if (fs.readFileSync(p, "utf8").includes(REQ)) return true;
      }
    }
    return false;
  };
  return walk(dir);
}

/** The copy, given the level's integration (REQ-712); the command line's extra flags. */
function integrate(dir: string, tool: CompatTool, level: CompatLevel, scratch: string): string {
  const it = integrationOf(tool, level)!;
  // Claude Code's rules file: it reads CLAUDE.md, which points at AGENTS.md.
  if (tool === "claude") fs.writeFileSync(path.join(dir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
  for (const t of it.agentsInit) cli(dir, "agents", "init", "--tool", t, "--force");
  if (it.skillsFor) cli(dir, "agents", "init", "--format", "skills", "--tool", it.skillsFor, "--force");
  const serve = { command: process.execPath, args: [CLI, "mcp", "serve"] };
  const extra: string[] = [];
  if (it.mcp) {
    if (tool === "claude") {
      const file = path.join(dir, ".mcp.json");
      fs.writeFileSync(file, `${JSON.stringify({ mcpServers: { specgate: serve } }, null, 2)}\n`);
      extra.push(`--mcp-config ${q(file)}`);
    } else if (tool === "opencode") {
      const file = path.join(dir, "opencode.json");
      fs.writeFileSync(
        file,
        `${JSON.stringify({ mcp: { specgate: { type: "local", command: [serve.command, ...serve.args], enabled: true } } }, null, 2)}\n`
      );
    } else {
      // REQ-713: for this run only, on its command line — ~/.codex is never written.
      extra.push(
        `-c ${q(`mcp_servers.specgate.command=${JSON.stringify(serve.command)}`)}`,
        `-c ${q(`mcp_servers.specgate.args=${JSON.stringify(serve.args)}`)}`
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
  return extra.join(" ");
}

interface RunOptions {
  agents: Partial<Record<CompatTool, string>>;
  models: Partial<Record<CompatTool, string>>;
  keep: string[];
  timeoutMs: number;
  outDir: string;
}

function oneRun(tool: CompatTool, level: CompatLevel, n: number, version: string, o: RunOptions): CompatRun {
  const model = o.models[tool] || (o.agents[tool] ? "custom" : CHEAPEST_MODEL[tool]);
  const base: CompatRun = {
    tool, level, version, model, ran: false, check: false, hidden: false,
    testNamesReq: false, seconds: 0, exit: null, at: new Date().toISOString(),
  };
  if (!integrationOf(tool, level)) return base;

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `specgate-compat-${tool}-${level}-`));
  const dir = path.join(scratch, "project");
  const logDir = path.join(o.outDir, "runs", `${base.at.replace(/[:.]/g, "-")}-${tool}-${level}-${n}`);
  fs.mkdirSync(logDir, { recursive: true });
  try {
    fs.cpSync(path.join(EXAM, "fixture"), dir, { recursive: true });
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "the exam as given");
    const extra = integrate(dir, tool, level, scratch);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", `${level} for ${tool}`, "--allow-empty");

    // The agent's `specgate` is this checkout's, first on its PATH.
    const bin = path.join(scratch, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "specgate"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
    const promptFile = path.join(scratch, "prompt.md");
    fs.copyFileSync(path.join(EXAM, "prompt.md"), promptFile);
    fs.copyFileSync(promptFile, path.join(logDir, "prompt.md"));

    const template = o.agents[tool] || defaultCommand(tool, model, "{extra}");
    const command = template.split("{extra}").join(extra).split("{prompt_file}").join(q(promptFile));
    fs.writeFileSync(path.join(logDir, "command.txt"), `${command}\n`);

    // REQ-714: the provider keys stay out unless named.
    const saved: Record<string, string> = {};
    for (const k of PROVIDER_KEYS) {
      if (o.keep.includes(k) || process.env[k] === undefined) continue;
      saved[k] = process.env[k]!;
      delete process.env[k];
    }
    const t0 = Date.now();
    let r;
    try {
      r = runWithDeadline(command, {
        cwd: dir,
        timeoutMs: o.timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        env: { PATH: `${bin}${path.delimiter}${process.env.PATH || ""}` },
      });
    } finally {
      Object.assign(process.env, saved);
    }
    base.ran = true;
    base.seconds = Math.round((Date.now() - t0) / 100) / 10;
    base.exit = r.status;
    fs.writeFileSync(path.join(logDir, "output.log"), `${r.stdout || ""}${r.stderr || ""}`);

    base.testNamesReq = testNamesReq(dir);
    const check = cli(dir, "check", dir, "--json");
    base.check = check.status === 0;
    fs.writeFileSync(path.join(logDir, "check.json"), check.stdout || "");
    fs.copyFileSync(path.join(EXAM, "hidden", HIDDEN), path.join(dir, HIDDEN));
    const hidden = spawnSync(process.execPath, ["--test", HIDDEN], { cwd: dir, encoding: "utf8", timeout: 120_000, env: checkEnv() });
    base.hidden = hidden.status === 0;
    fs.writeFileSync(path.join(logDir, "hidden.log"), `${hidden.stdout || ""}${hidden.stderr || ""}`);
    return base;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function listOf<T extends string>(value: string | undefined, all: readonly T[], what: string): T[] {
  if (!value) return [...all];
  const out = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (const v of out) if (!(all as readonly string[]).includes(v)) throw new Error(`unknown ${what}: ${v}`);
  return out as T[];
}

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
      const runs: CompatRun[] = fs.existsSync(runsFile)
        ? fs.readFileSync(runsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as CompatRun)
        : [];
      const rows = matrixOf(runs);
      const date = new Date().toISOString().slice(0, 10);
      fs.mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, "matrix.md");
      fs.writeFileSync(file, matrixMarkdown(rows, date));
      io.emit({ compat: { date, file, rows } }, () => {
        process.stdout.write(`${matrixMarkdown(rows, date)}\n  ✔  ${path.relative(projectDir, file)}\n`);
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

    let tools: CompatTool[];
    let levels: CompatLevel[];
    try {
      tools = listOf(flag("--tool"), COMPAT_TOOLS, "tool");
      levels = listOf(flag("--level"), COMPAT_LEVELS, "level");
    } catch (e) {
      io.fail({ compat: null }, [
        { code: "compat_bad_flag", message: (e as Error).message, severity: "error", fix: "--tool claude,codex,opencode --level L0,L1,L2,L3" },
      ]);
      process.exitCode = 2;
      return;
    }
    const runs = Math.max(1, Number(flag("--runs") || 3));
    const keep: string[] = [];
    args.forEach((a, i) => {
      if (a === "--keep-env" && args[i + 1]) keep.push(args[i + 1]!);
    });
    const agents: RunOptions["agents"] = {};
    const models: RunOptions["models"] = {};
    for (const t of COMPAT_TOOLS) {
      const a = flag(`--agent-${t}`);
      const m = flag(`--model-${t}`);
      if (a) agents[t] = a;
      if (m) models[t] = m;
    }
    const o: RunOptions = { agents, models, keep, timeoutMs: Number(flag("--timeout") || 900) * 1000, outDir };
    fs.mkdirSync(outDir, { recursive: true });

    const done: CompatRun[] = [];
    for (const tool of tools) {
      const version = versionOf(tool);
      for (const level of levels) {
        const count = integrationOf(tool, level) ? runs : 1;
        for (let n = 1; n <= count; n++) {
          const r = oneRun(tool, level, n, version, o);
          fs.appendFileSync(runsFile, `${JSON.stringify(r)}\n`);
          done.push(r);
          if (!json) {
            const verdict = !r.ran ? "n/a" : runPassed(r) ? "pass" : "fail";
            process.stdout.write(
              `  ${verdict === "pass" ? "✔" : verdict === "n/a" ? "·" : "✖"}  ${tool} ${level} ${r.ran ? `${n}/${count}` : ""}  ${verdict}` +
                (r.ran ? `  check ${r.check ? "✔" : "✖"} hidden ${r.hidden ? "✔" : "✖"} test ${r.testNamesReq ? "✔" : "✖"}  ${r.seconds} s` : "") +
                "\n"
            );
          }
        }
      }
    }
    io.emit({ compat: { runs: done, file: runsFile } }, () => {
      process.stdout.write(`\n  ➜  specgate compat report   the matrix from .specgate/compat/runs.jsonl\n`);
    });
  }
}
