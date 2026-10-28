#!/usr/bin/env node

/**
 * `specgate harness report` — what the harness has actually cost.
 *
 * Two numbers decide whether agent roles, retries and parallelism are worth
 * paying for, and neither was measurable before the run ledger existed:
 *
 *   **cost per delivered requirement** — wall-clock, because an agent is any
 *   shell command and only the agent knows what it spent in tokens; and
 *   **first-attempt success rate** — the one that says whether a retry ladder
 *   is buying anything or just spending three times as much on the same
 *   mistake.
 *
 * Reads `.harness/runs/*.json`, which `harness run` writes. No network, no
 * git, no agent: this command only ever reads.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { error } from "../lib/diagnostics";
import { RUNS_DIR } from "./run";
import { readCostHints } from "../../packages/core/src/infrastructure/HarnessConfigFile";
import {
  FalseFailureMark,
  HarnessReportSummary,
  RunFile,
  STAGE_LABELS,
  parseFalseFailures,
  sparkline,
  summariseRuns,
} from "../../packages/core/src/domain/HarnessReport";

export { HarnessReportSummary } from "../../packages/core/src/domain/HarnessReport";

/**
 * Where a person's "the gate was wrong about this one" is kept.
 *
 * Append-only, one JSON object per line, because that is what survives a
 * process dying mid-write — the same reason the run ledger is one file per run.
 */
export const FALSE_FAILURES_FILE = ".harness/false-failures.jsonl";

import { c } from "../lib/ui";
import * as ui from "../lib/ui";

/** Parsed command-line options for this command. */
export interface HarnessReportOptions {
  projectDir: string;
  json: boolean;
  last: number | null;
  /** `--mark-false-failure REQ-NNN`: record that the gate was wrong about it. */
  markFalseFailure: string | null;
  reason: string;
}

function usage(): void {
  process.stdout.write(
    `\n  ${c.bold}📈 harness report${c.reset}  ${c.dim}— what the harness has cost${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    specgate harness report [--project-dir <path>] [--last <n>] [--json]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    --last <n>            Only the n most recent runs.\n` +
      `    --json                Machine-readable summary.\n` +
      `    --mark-false-failure <REQ-NNN> --reason "..."\n` +
      `                          Record that the gate rejected good work. Nothing the\n` +
      `                          harness stores can tell a real failure from a false\n` +
      `                          one — only a person can, so the ratio stays unknown\n` +
      `                          until somebody marks one.\n\n`
  );
}

export function parseArgs(argv: string[]): HarnessReportOptions {
  const opts: HarnessReportOptions = {
    projectDir: ".",
    json: wantsJson(argv),
    last: null,
    markFalseFailure: null,
    reason: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--last" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--last must be a positive integer");
      opts.last = n;
    } else if (a === "--mark-false-failure" && argv[i + 1]) {
      const req = argv[++i];
      if (!/^REQ-\d+$/.test(req)) {
        throw new Error(`--mark-false-failure expects REQ-NNN, got: ${req}`);
      }
      opts.markFalseFailure = req;
    } else if (a === "--reason" && argv[i + 1]) {
      opts.reason = argv[++i];
    } else if (a === "--json" || a === "--format") {
      if (a === "--format") i += 1;
    } else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  // A mark without a reason is a number nobody can audit later. The whole point
  // of this metric is that a person looked; the reason is what they saw.
  if (opts.markFalseFailure && !opts.reason.trim()) {
    throw new Error('--mark-false-failure needs --reason "why the gate was wrong"');
  }
  return opts;
}

/** Read the ledger, newest first, skipping anything that is not a run record. */
export function readRuns(projectDir: string, last: number | null): RunFile[] {
  const dir = path.join(projectDir, RUNS_DIR);
  if (!fs.existsSync(dir)) return [];

  const runs: RunFile[] = [];
  for (const name of fs.readdirSync(dir).sort().reverse()) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (parsed && Array.isArray(parsed.results)) runs.push(parsed);
    } catch {
      // A half-written record is not worth failing a read-only report over.
    }
    if (last !== null && runs.length >= last) break;
  }
  return runs;
}

/**
 * The aggregation itself lives in `core/domain/HarnessReport`: it is arithmetic
 * over records, and keeping it out of here is what lets it be tested without
 * writing a ledger to disk. This wrapper is kept because the run tests import
 * it by name.
 */
/** The marks a person has left, or none. */
export function readFalseFailures(projectDir: string): FalseFailureMark[] {
  const file = path.join(projectDir, ...FALSE_FAILURES_FILE.split("/"));
  if (!fs.existsSync(file)) return [];
  try {
    return parseFalseFailures(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

/** Append one mark. Append-only, so a killed process loses at most its own line. */
export function appendFalseFailure(projectDir: string, mark: FalseFailureMark): void {
  const file = path.join(projectDir, ...FALSE_FAILURES_FILE.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(mark)}\n`, "utf8");
}

export function summarise(
  runs: RunFile[],
  falseFailures: FalseFailureMark[] = [],
  costPerRunHint: Record<string, number> = {}
): HarnessReportSummary {
  return summariseRuns(runs, falseFailures, costPerRunHint);
}

function human(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function render(summary: HarnessReportSummary): void {
  const label = (text: string) => text.padEnd(26);
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  process.stdout.write(
    ui.header("harness report", `${summary.runs} run(s)`) +
      `  ${ui.progress(summary.passed, summary.requirementsAttempted, "requirements passed")}\n\n` +
      `    ${label("requirements attempted")}${summary.requirementsAttempted}\n` +
      `    ${c.ok}${label("passed")}${c.reset}${summary.passed}\n` +
      `    ${c.bad}${label("failed")}${c.reset}${summary.failed}\n` +
      `    ${c.warn}${label("blocked")}${c.reset}${summary.blocked}\n\n` +
      `    ${c.bold}${label("first attempt worked")}${c.reset}${pct(summary.firstAttemptRate)}` +
      `  ${c.dim}(${summary.firstAttemptPasses} of ${summary.passed} passes)${c.reset}\n` +
      `    ${c.bold}${label("cost per delivered REQ")}${c.reset}` +
      `${summary.msPerDelivered === null ? "—" : human(summary.msPerDelivered)}` +
      `  ${c.dim}wall-clock, failed attempts included${c.reset}\n`
  );

  if (summary.estimatedCost) {
    const { total, covered, uncovered } = summary.estimatedCost;
    process.stdout.write(
      `    ${label("estimated spend")}${total.toFixed(2)}` +
        `  ${c.dim}declared by profile, not measured` +
        (uncovered > 0 ? ` — ${uncovered} of ${covered + uncovered} attempts have no hint` : "") +
        `${c.reset}\n`
    );
  }

  if (summary.stages.length > 0) {
    // Where the gate rejects, which is the question C2 exists to answer. Read
    // from every attempt, not from each requirement's final result: one that
    // passed on attempt 3 still failed twice, and those two are the interesting
    // ones.
    process.stdout.write("\n" + ui.section("Where attempts ended"));
    for (const s of summary.stages) {
      const label = STAGE_LABELS[s.stage] || s.stage;
      const mark = s.stage === "pass" ? c.ok : c.warn;
      process.stdout.write(
        `    ${mark}${String(s.count).padStart(4)}${c.reset}  ${label} ${c.dim}[${s.stage}]${c.reset}\n`
      );
    }
  }

  if (summary.exhausted.length > 0) {
    process.stdout.write("\n" + ui.section("Spent every attempt, delivered nothing"));
    for (const r of summary.exhausted.slice(0, 5)) {
      process.stdout.write(
        `    ${c.yellow}${r.requirement.padEnd(10)}${c.reset} ${human(r.durationMs).padStart(8)}` +
          `  ${c.dim}${r.attempts} attempt(s)${c.reset}\n`
      );
    }
  }

  if (summary.timeline.length > 1) {
    const first = summary.timeline[0].startedAt.slice(0, 10);
    const last = summary.timeline[summary.timeline.length - 1].startedAt.slice(0, 10);
    process.stdout.write(
      "\n" +
        ui.section("Runs over time") +
        `    ${c.brand}${sparkline(summary.timeline)}${c.reset}` +
        `  ${c.dim}${first} → ${last}${c.reset}\n`
    );
  }

  if (summary.failed > 0) {
    process.stdout.write(
      `\n  ${c.bold}${label("failures that were real")}${c.reset}` +
        `${pct(summary.realFailureRate)}` +
        (summary.realFailureRate === null
          ? `  ${c.dim}nothing recorded can tell a real failure from a gate that was\n` +
            `${" ".repeat(30)}wrong — mark one: specgate harness report\n` +
            `${" ".repeat(30)}--mark-false-failure REQ-NNN --reason "..."${c.reset}\n`
          : `  ${c.dim}${summary.falseFailures} marked as the gate's fault${c.reset}\n`)
    );
  }

  // REQ-229: what the quality checks said about what was delivered.
  if (summary.quality.measured > 0) {
    const q = summary.quality;
    const pctOf = (v: number | null) => (v === null ? "—" : `${v}%`);
    process.stdout.write(
      "\n" +
        ui.section("Quality of what was delivered") +
        `    ${label("requirements measured")}${q.measured}\n` +
        `    ${label("diff coverage, mean")}${pctOf(q.coverage)}\n` +
        `    ${label("mutation score, mean")}${pctOf(q.mutation)}\n` +
        q.checks
          .map(
            (k) =>
              `    ${k.name.padEnd(26)}${k.ran} ran${k.skipped ? `  ${c.dim}${k.skipped} skipped${c.reset}` : ""}\n`
          )
          .join("")
    );
  }

  if (summary.worst.length > 0) {
    process.stdout.write("\n" + ui.section("Slowest"));
    for (const r of summary.worst) {
      const mark = r.result === "pass" ? c.ok : c.warn;
      process.stdout.write(
        `    ${mark}${r.requirement.padEnd(10)}${c.reset} ${human(r.durationMs).padStart(8)}` +
          `  ${c.dim}${r.attempts} attempt(s), ${r.result}${c.reset}\n`
      );
    }
  }
  process.stdout.write("\n");
}

export function main(argv: string[]): void {
  let opts: HarnessReportOptions;
  const io = agentIo(wantsJson(argv));
  try {
    opts = parseArgs(argv);
  } catch (err) {
    io.usage({ report: null }, [
      error("usage", err instanceof Error ? err.message : String(err), {
        fix: "See `specgate harness report --help`.",
      }),
    ]);
    return;
  }

  let projectDir: string;
  try {
    projectDir = resolveProjectDir(opts.projectDir, { requireSentinel: true });
  } catch (err) {
    io.fail({ report: null }, [
      error("no_project", err instanceof Error ? err.message : String(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
    return;
  }

  if (opts.markFalseFailure) {
    appendFalseFailure(projectDir, {
      requirement: opts.markFalseFailure,
      reason: opts.reason.trim(),
      markedAt: new Date().toISOString(),
    });
    process.stdout.write(
      `\n  ${c.green}✔${c.reset}  ${opts.markFalseFailure} marked as a false failure.\n` +
        `     ${c.dim}${opts.reason.trim()}${c.reset}\n\n`
    );
  }

  const runs = readRuns(projectDir, opts.last);
  if (runs.length === 0) {
    io.emit({ report: summarise([], []), status: [] }, () => {
      process.stdout.write(
        ui.header("harness report") +
          ui.info("No runs recorded yet — each harness run writes one.") +
          ui.next("specgate harness run --dry-run", "see what it would do first")
      );
    });
    process.exit(EXIT.OK);
  }

  // C1: what each profile declares a run of it costs. Read from the project's
  // own profiles, and absent unless somebody wrote one.
  // Read from `.harness/profiles.yaml` directly, not through the config
  // reader: a project may declare profiles and never write a
  // `harness.config.yaml`, and going via the config made the estimate silently
  // absent there.
  let costHints: Record<string, number> = {};
  try {
    costHints = readCostHints(projectDir);
  } catch {
    /* a broken profiles file is `harness run`'s problem, not this read-only command's */
  }

  const summary = summarise(runs, readFalseFailures(projectDir), costHints);
  io.emit({ report: summary, status: [] }, () => render(summary));
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
