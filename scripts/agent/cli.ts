#!/usr/bin/env node

/**
 * `specgate agent ask | apply | discard | plans` (change agent-ask, REQ-520 …
 * REQ-526): the agent proposes, a person reads the diff, then it is written.
 * The work is in `../lib/agent-plan`; this file reads the arguments and prints.
 */

import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import type { AgentIo } from "../lib/agent";
import { error } from "../lib/diagnostics";
import type { Diagnostic } from "../lib/diagnostics";
import {
  agentApply,
  agentAsk,
  agentDiscard,
  agentPlans,
  DEFAULT_TIMEOUT_SECONDS,
  type AskOptions,
  type Outcome,
  type PlanAnswer,
} from "../lib/agent-plan";
import * as ui from "../lib/ui";

const SHAPES: Record<string, Record<string, null>> = {
  ask: { plan: null },
  apply: { applied: null },
  discard: { discarded: null },
  plans: { plans: null },
};

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      '  specgate agent ask "<request>" [--req <REQ>]… [--file <path>]… [--plan] [--json]\n' +
      "  specgate agent apply <plan-id> [--json]\n" +
      "  specgate agent discard <plan-id> [--json]\n" +
      "  specgate agent plans [--json]\n\n" +
      "ask      Runs your agent on a scratch copy of the project and answers a plan: the\n" +
      "         files it would change, each with why and its diff, the checks to run\n" +
      "         after, what it read and the tokens it used. Nothing is written.\n" +
      "         @REQ-NNN and @path in the request are given to the agent as context.\n" +
      "  --agent <cmd>      The agent's command (else --profile, else agent: in harness.config.yaml).\n" +
      "  --profile <name>   The agent of that profile in .harness/profiles.yaml.\n" +
      `  --timeout <s>      How long the agent may take (default ${DEFAULT_TIMEOUT_SECONDS}).\n` +
      "  --mode spec        The only mode: spec.md, docs/specs/** and features/**.\n" +
      "apply    Writes the plan when its files have not changed since, then runs its checks.\n" +
      "         Never stages, commits or pushes.\n" +
      "discard  Removes a plan.\n" +
      "plans    Lists the open plans, and whether a file changed since (stale).\n" +
      "\nCommon: --project-dir <path>, --json.\n"
  );
}

interface Parsed {
  sub: string;
  positional: string[];
  projectDir: string;
  opts: AskOptions;
}

function parse(argv: string[], io: AgentIo): Parsed {
  const sub = argv[0] || "";
  const shape = SHAPES[sub] || { agent: null };
  const out: Parsed = { sub, positional: [], projectDir: ".", opts: {} };
  const bad = (message: string) =>
    io.usage(shape, [error("usage", message, { fix: "specgate agent --help" })]);
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined) bad(`${a} needs a value.`);
      i += 1;
      return v;
    };
    if (a === "--json" || a === "--plan") continue;
    else if (a === "--format") i += 1;
    else if (a === "--project-dir") out.projectDir = value();
    else if (sub === "ask" && a === "--agent") out.opts.agent = value();
    else if (sub === "ask" && a === "--profile") out.opts.profile = value();
    else if (sub === "ask" && a === "--mode") out.opts.mode = value();
    else if (sub === "ask" && a === "--req") out.opts.req = [...(out.opts.req || []), value()];
    else if (sub === "ask" && a === "--file") out.opts.files = [...(out.opts.files || []), value()];
    else if (sub === "ask" && a === "--timeout") {
      const s = Number(value());
      if (!Number.isFinite(s) || s <= 0) bad("--timeout takes a number of seconds.");
      out.opts.timeoutSeconds = s;
    } else if (a.startsWith("--")) bad(`Unknown argument: ${a}`);
    else out.positional.push(a);
  }
  return out;
}

function render(sub: string, doc: Record<string, unknown>): void {
  const w = (s: string) => process.stdout.write(s);
  if (sub === "ask") {
    const plan = doc.plan as PlanAnswer;
    w(ui.header("agent ask", plan.request));
    if (!plan.files.length) {
      w(ui.info("Nothing would change."));
      return;
    }
    w(`\n  ${ui.bold("[ PLAN · nothing written yet ]")}\n\n`);
    const mark = { modify: "M", add: "+", delete: "-" } as const;
    for (const f of plan.files) {
      w(`    ${ui.bold(mark[f.change])} ${f.path}${f.why ? ui.muted(`  — ${f.why}`) : ""}\n`);
    }
    for (const f of plan.files) w(`\n${ui.muted(f.diff.replace(/^/gm, "    "))}`);
    if (plan.then.length) w(`\n  Then: ${plan.then.map(ui.cmd).join(", ")}\n`);
    if (plan.read.length) w(`  Read: ${plan.read.join(", ")}\n`);
    const u = plan.usage;
    if (u.input !== null) {
      w(
        `  Tokens: ${u.input} in · ${u.output} out${u.cost !== undefined ? ` · $${u.cost.toFixed(4)}` : ""}\n`
      );
    }
    w(ui.next(`specgate agent apply ${plan.id}`, `or: specgate agent discard ${plan.id}`));
  } else if (sub === "apply") {
    const a = doc.applied as {
      id: string;
      written: Array<{ path: string; change: string }>;
      then: Array<{ command: string; exit: number; findings: unknown[] }>;
    };
    w(ui.header("agent apply", a.id));
    for (const f of a.written) w(ui.ok(`${f.change} ${f.path}`));
    for (const t of a.then) {
      const line = `${t.command} — exit ${t.exit}, ${t.findings.length} finding(s)`;
      w(t.exit === 0 ? ui.ok(line) : ui.warn(line));
    }
    w(ui.info("Nothing is committed: review the change with git diff, then commit it."));
  } else if (sub === "discard") {
    w(ui.ok(`Discarded ${(doc.discarded as { id: string }).id}.`));
  } else {
    const plans = doc.plans as Array<{
      id: string;
      request: string;
      files: unknown[];
      stale: boolean;
    }>;
    w(ui.header("agent plans", `${plans.length} open`));
    for (const p of plans) {
      w(
        `    ${p.id}  ${p.request}  ${ui.muted(`${p.files.length} file(s)${p.stale ? " · stale" : ""}`)}\n`
      );
    }
  }
}

export async function main(argv: string[]): Promise<void> {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(argv.length ? EXIT.OK : EXIT.USAGE);
  }
  const io = agentIo(wantsJson(argv));
  const p = parse(argv, io);
  const shape = SHAPES[p.sub];
  if (!shape) {
    io.usage({ agent: null }, [
      error("usage", `Unknown agent sub-command: ${p.sub}. Expected: ask, apply, discard, plans.`, {
        fix: "specgate agent --help",
      }),
    ]);
  }
  let dir = "";
  try {
    dir = resolveProjectDir(p.projectDir, { requireSentinel: true });
  } catch (err) {
    io.fail(shape, [
      error("no_project", err instanceof Error ? err.message : String(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }
  const needsId = p.sub === "apply" || p.sub === "discard";
  if ((needsId || p.sub === "ask") && p.positional.length !== 1) {
    io.usage(shape, [
      error(
        "missing_argument",
        p.sub === "ask" ? "Give the request as one argument, in quotes." : "Give the plan's id.",
        { fix: p.sub === "ask" ? 'specgate agent ask "<request>"' : "specgate agent plans" }
      ),
    ]);
  }
  let outcome: Outcome;
  if (p.sub === "ask") {
    if (!io.json) process.stderr.write(ui.info("The agent is working on a copy of the project…"));
    outcome = await agentAsk(dir, p.positional[0], p.opts);
  } else if (p.sub === "apply") outcome = agentApply(dir, p.positional[0]);
  else if (p.sub === "discard") outcome = agentDiscard(dir, p.positional[0]);
  else outcome = agentPlans(dir);

  if (!outcome.ok) {
    if (outcome.usage) io.usage(outcome.document, outcome.status);
    io.fail(outcome.document, outcome.status);
  }
  const document = outcome.document as Record<string, unknown> & { status: Diagnostic[] };
  io.emit(document, () => {
    render(p.sub, document);
    const warnings = document.status.filter((d) => d.severity === "warning");
    for (const d of warnings)
      process.stdout.write(ui.warn(`${d.message}${d.fix ? ` ${ui.muted(d.fix)}` : ""}`));
  });
  process.exit(EXIT.OK);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : err}\n`);
    process.exit(EXIT.FAILURE);
  });
}
