#!/usr/bin/env node

/**
 * `specgate harness doctor [--json] [--no-probe]` (agent-routing REQ-690):
 * which agent each pending requirement gets — by its requirement, its module,
 * another rule or the default — and whether each of those agents, the
 * drafting one too, is installed and answers. `harness run` asks the same
 * before it starts (REQ-691).
 *
 * Trying specgate end to end (2026-11-23) found an expired key and a free
 * model out of quota only after runs had started; one short call per agent
 * tells a working agent from those.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { error } from "../lib/diagnostics";
import * as ui from "../lib/ui";
import { forShell } from "../lib/shell-command";
import { requirementCapabilities } from "../lib/capabilities";
import { agentInvocation } from "../draft/confined-agent";
import { selectProfile } from "../../packages/core/src/domain/ProfileMatch";
import { featureFilePath } from "../../packages/core/src/domain/HarnessRun";
import type { HarnessRequirement } from "../../packages/core/src/domain/HarnessRun";
import {
  readHarnessConfig,
  readProfileRules,
  resolveProfileAgent,
} from "../../packages/core/src/infrastructure/HarnessConfigFile";

/** What the probe asks: a reply an agent cannot give by accident. */
export const PROBE_PROMPT = "Reply with exactly: OK\n";
const PROBE_TIMEOUT_MS = 120_000;

export interface Route {
  requirement: string;
  module: string | null;
  /** The profile a rule chose, or null for the default agent. */
  profile: string | null;
  agent: string;
}

export interface AgentCheck {
  agent: string;
  /** Who uses it: requirement ids, and `drafting`. */
  usedBy: string[];
  program: string;
  installed: boolean;
  /** Null when not probed: `--no-probe`, or not installed. */
  answered: boolean | null;
  reason: string | null;
  fix: string | null;
}

export interface AgentRouting {
  /** Profile name → agent command, and the rules that pick them. */
  rules: Array<{ name: string; match: Record<string, string> }>;
  agents: Record<string, string>;
  defaultAgent: string;
  draftAgent: string | null;
}

/** The agents a project declares: default, per-profile rules, drafting. */
export function routingOf(projectDir: string, defaultAgent?: string): AgentRouting {
  const config = readHarnessConfig(projectDir) || {};
  const rules = readProfileRules(projectDir);
  const agents: Record<string, string> = {};
  for (const r of rules) {
    try {
      agents[r.name] = resolveProfileAgent(projectDir, r.name);
    } catch {
      /* a rule whose profile has no agent: the default applies */
    }
  }
  let draftAgent: string | null = null;
  if (config.draftProfile) {
    try {
      draftAgent = resolveProfileAgent(projectDir, config.draftProfile);
    } catch {
      draftAgent = null;
    }
  }
  return {
    rules,
    agents,
    defaultAgent: defaultAgent ?? String(config.agent || ""),
    draftAgent,
  };
}

/** Which agent each requirement gets, as the harness picks it (REQ-688). */
export function routesOf(
  projectDir: string,
  reqs: readonly HarnessRequirement[],
  routing: AgentRouting
): Route[] {
  const modules = requirementCapabilities(projectDir);
  return reqs.map((req) => {
    const id = String(req.requirement || "");
    const module = modules.get(id) || null;
    const picked = selectProfile(routing.rules, {
      requirement: id,
      module: module || undefined,
      featureFile: featureFilePath(req),
      category: (req as { category?: string }).category,
    });
    const agent = (picked && routing.agents[picked]) || routing.defaultAgent;
    return { requirement: id, module, profile: picked && routing.agents[picked] ? picked : null, agent };
  });
}

/** Words of a command line, quotes kept together and taken off. */
function words(command: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  for (const m of command.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** The program a command runs: past `env`, its options and `VAR=value`. */
export function programOf(command: string): string {
  const w = words(command);
  let i = 0;
  if (w[i] === "env") {
    i++;
    while (i < w.length) {
      if (w[i] === "-u" || w[i] === "--unset") i += 2;
      else if (w[i].startsWith("-")) i++;
      else if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) i++;
      else break;
    }
  }
  while (i < w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) i++;
  return w[i] || "";
}

function onPath(program: string): boolean {
  if (!program) return false;
  if (program.includes("/") || program.includes("\\")) return fs.existsSync(program);
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of String(process.env.PATH || "").split(path.delimiter)) {
    for (const ext of exts) {
      if (dir && fs.existsSync(path.join(dir, program + ext))) return true;
    }
  }
  return false;
}

/** The last line the agent printed: where an expired key or a spent quota says so. */
function lastLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").trim())
    .filter(Boolean);
  return lines[lines.length - 1] || "";
}

/** Installed, and — unless `probe` is false — answering a one-line prompt. */
export function checkAgent(
  agent: string,
  _cwd: string,
  opts: { probe: boolean; timeoutMs?: number } = { probe: true }
): Omit<AgentCheck, "usedBy"> {
  const program = programOf(agent);
  if (!onPath(program)) {
    return {
      agent,
      program,
      installed: false,
      answered: null,
      reason: `${program || "(no program)"} is not installed: it is not on the PATH.`,
      fix: `Install ${program}, or point the profile at an agent that is.`,
    };
  }
  if (!opts.probe) return { agent, program, installed: true, answered: null, reason: null, fix: null };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-doctor-"));
  const promptFile = path.join(dir, "probe.md");
  fs.writeFileSync(promptFile, PROBE_PROMPT);
  try {
    const run = agentInvocation(agent, promptFile);
    const timeout = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
    // In an empty folder: an agent asked to say OK has nothing of the project to touch.
    const r = spawnSync(forShell(run.command), {
      cwd: dir,
      shell: true,
      encoding: "utf8",
      input: run.stdin ? PROBE_PROMPT : undefined,
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });
    const output = `${r.stdout || ""}\n${r.stderr || ""}`;
    const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
    if (r.status === 0 && /\bOK\b/.test(output)) {
      return { agent, program, installed: true, answered: true, reason: null, fix: null };
    }
    const said = lastLine(output);
    const reason = timedOut
      ? `It did not answer within ${Math.round(timeout / 1000)} s.`
      : r.status === 0
        ? `It answered, but not OK${said ? `: ${said}` : "."}`
        : `It exited ${r.status ?? "on a signal"}${said ? `: ${said}` : "."}`;
    return {
      agent,
      program,
      installed: true,
      answered: false,
      reason,
      fix: /key|auth|login|credential|unauthori[sz]ed|forbidden/i.test(said)
        ? `Renew its key or log in again, then run \`specgate harness doctor\`.`
        : /quota|limit|rate/i.test(said)
          ? "Wait for its quota, or choose another model for these requirements in .harness/profiles.yaml."
          : `Run the agent by hand with a prompt that says "Reply with exactly: OK" and fix what it says.`,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Each distinct agent once, with who uses it. */
export function checkAgents(
  projectDir: string,
  routes: readonly Route[],
  draftAgent: string | null,
  opts: { probe: boolean; timeoutMs?: number },
  defaultAgent = "",
  /** Every profile's agent: checked even when nothing pending goes to it. */
  declared: readonly string[] = []
): AgentCheck[] {
  const usedBy = new Map<string, string[]>();
  // The default agent is checked even with nothing pending: it is the one the next run gets.
  if (defaultAgent) usedBy.set(defaultAgent, []);
  for (const a of declared) if (a && !usedBy.has(a)) usedBy.set(a, []);
  for (const r of routes) {
    if (!r.agent) continue;
    usedBy.set(r.agent, [...(usedBy.get(r.agent) || []), r.requirement]);
  }
  if (draftAgent) usedBy.set(draftAgent, [...(usedBy.get(draftAgent) || []), "drafting"]);
  return [...usedBy.entries()].map(([agent, users]) => ({
    ...checkAgent(agent, projectDir, opts),
    usedBy: users.length ? users : [agent === defaultAgent ? "default" : "no pending requirement"],
  }));
}

export const failed = (c: AgentCheck) => !c.installed || c.answered === false;

/** An agent as a person names it: its program and model — `opencode · big-pickle`. */
export function agentLabel(command: string): string {
  const program = programOf(command).split("/").pop() || command;
  const w = words(command);
  let model = "";
  for (let i = 0; i < w.length; i += 1) {
    if ((w[i] === "-m" || w[i] === "--model") && w[i + 1]) model = w[i + 1];
    else if (w[i].startsWith("--model=")) model = w[i].slice(8);
  }
  if (model.includes("/")) model = model.split("/").pop() || model;
  return model ? `${program} · ${model}` : program;
}

/**
 * agent-routing REQ-691: before `harness run` creates a worktree, every agent
 * it will hand a requirement to is installed and answers; else it refuses,
 * naming the requirements, the agent and why.
 */
export function agentPreflight(
  projectDir: string,
  settings: { agent?: string; profileRules?: Array<{ name: string; match: Record<string, string> }>; profileAgents?: Record<string, string> },
  pending: readonly HarnessRequirement[]
): void {
  const routing: AgentRouting = {
    rules: settings.profileRules || [],
    agents: settings.profileAgents || {},
    defaultAgent: settings.agent || "",
    draftAgent: null,
  };
  const routes = routesOf(projectDir, pending, routing);
  const bad = checkAgents(projectDir, routes, null, { probe: true }).filter(failed);
  if (bad.length === 0) return;
  const lines = bad.map((c) => `${c.usedBy.join(", ")}: ${c.agent} — ${c.reason}\n  fix: ${c.fix}`);
  throw Object.assign(
    new Error(
      `harness_agent_unavailable: an agent this run needs does not answer, so nothing started.\n${lines.join("\n")}\n` +
        "`specgate harness doctor` checks every agent; --skip-doctor starts anyway."
    ),
    { code: "harness_agent_unavailable" }
  );
}

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness doctor [--json] [--no-probe] [--project-dir <path>]\n\n" +
      "Which agent each pending requirement gets — its requirement's rule, its\n" +
      "module's, another rule or the default (.harness/profiles.yaml) — and whether\n" +
      "each agent, the drafting one (draft_profile) too, is installed and answers a\n" +
      'one-line prompt ("Reply with exactly: OK"). Exits 1 when one fails.\n\n' +
      "  --no-probe   Check only that each agent is installed; run none.\n"
  );
}

export function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { doctor: null };
  let projectDir = ".";
  let probe = true;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir") projectDir = argv[++i] || ".";
    else if (a === "--no-probe") probe = false;
    else if (a === "--json") continue;
    else {
      io.usage(shape, [error("doctor_usage", `Unknown argument ${a}.`, { fix: "specgate harness doctor --help" })]);
      return;
    }
  }
  const dir = resolveProjectDir(projectDir, { requireSentinel: true });
  // Pending requirements, as `harness run` takes them.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runQueue } = require("./run/prepare") as typeof import("./run/prepare");
  const { pending } = runQueue(dir, { reqs: [] } as never);
  const routing = routingOf(dir);
  const routes = routesOf(dir, pending, routing);
  const checks = checkAgents(
    dir,
    routes,
    routing.draftAgent,
    { probe },
    routing.defaultAgent,
    Object.values(routing.agents)
  );
  const bad = checks.filter(failed);
  const data = { doctor: { routes, agents: checks, drafting: routing.draftAgent, probed: probe } };
  const findings = bad.map((c) =>
    error("agent_unavailable", `${c.agent}: ${c.reason}`, { fix: c.fix || "" })
  );

  if (io.json) {
    io.emit({ ...data, status: findings });
    process.exit(bad.length ? EXIT.FAILURE : EXIT.OK);
  }
  let text = ui.header("harness doctor", `${routes.length} requirement(s) · ${checks.length} agent(s)`);
  for (const r of routes) {
    text += `  ${r.requirement.padEnd(9)} ${String(r.module || "—").padEnd(16)} ${String(r.profile || "default").padEnd(12)} ${r.agent ? agentLabel(r.agent) : "(no agent)"}\n`;
  }
  text += "\n";
  for (const c of checks) {
    const ok = !failed(c);
    const state = !c.installed ? "not installed" : c.answered === null ? "installed" : c.answered ? "answers" : "does not answer";
    text += `  ${ok ? "✔" : "✖"}  ${agentLabel(c.agent)}  ${state} · ${c.usedBy.join(", ")}\n     ${c.agent}\n`;
    if (!ok) text += `     ${c.reason}\n     fix: ${c.fix}\n`;
  }
  process.stdout.write(text);
  process.exit(bad.length ? EXIT.FAILURE : EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
