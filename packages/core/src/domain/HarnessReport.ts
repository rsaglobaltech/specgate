/**
 * What the harness has actually done, aggregated (C2).
 *
 * ## What was already there, and what C2 adds
 *
 * The proposal opens with "every `harness run` forgets itself". That stopped
 * being true when `E1-04` added the run ledger and the two cost numbers. What
 * was still missing is the part the InfoQ analysis calls *our* metric — the
 * effectiveness of the validation mechanism:
 *
 * - **where the gate rejects.** The ledger records the stage each attempt ended
 *   at; nothing added them up. It matters more now than when C2 was written,
 *   because `A1` and `A2` introduced two new stages — an attempt rejected for
 *   editing the spec is a different problem from one that failed its tests.
 * - **which requirements burn every attempt.** Those are the ones costing
 *   `max_attempts` × the timeout and delivering nothing.
 * - **a series over time**, so a rate can be seen moving rather than guessed at.
 * - **real failures versus false ones.** A gate that rejects good work is a
 *   different failure from a gate catching a genuine defect, and no amount of
 *   recorded data distinguishes them: only a person can say which a given
 *   rejection was. Hence the mark, and hence the ratio being *un*computable
 *   until someone makes one.
 *
 * ## Why the aggregation lives in the domain
 *
 * It is arithmetic over records — no files, no terminal, no colours. Keeping it
 * here is what lets every case below be tested without writing a ledger to
 * disk, and it is the rule `tests/unit/architecture.test.ts` enforces.
 */

import { estimateRunCost } from "./RunBudget";

/** One attempt, as the ledger records it. */
export interface AttemptRow {
  attempt: number;
  endedAt: string;
  agentMs?: number;
  totalMs?: number;
  profiles?: string[];
}

/** One requirement's outcome within a run. */
export interface ResultRow {
  requirement: string;
  result: string;
  attempts: number;
  durationMs?: number;
  attemptLog?: AttemptRow[];
}

export interface RunFile {
  startedAt: string;
  finishedAt?: string;
  concurrency?: number;
  maxAttempts?: number;
  results?: ResultRow[];
}

/**
 * A human saying "the gate was wrong about this one".
 *
 * Not derivable from anything the harness records: a rejection looks identical
 * whether the work was bad or the gate was. Someone has to look.
 */
export interface FalseFailureMark {
  requirement: string;
  reason: string;
  markedAt: string;
}

export interface StageCount {
  stage: string;
  count: number;
}

export interface TimelinePoint {
  startedAt: string;
  passed: number;
  failed: number;
}

export interface HarnessReportSummary {
  runs: number;
  requirementsAttempted: number;
  passed: number;
  failed: number;
  blocked: number;
  firstAttemptPasses: number;
  firstAttemptRate: number | null;
  totalMs: number;
  msPerDelivered: number | null;
  worst: Array<{ requirement: string; durationMs: number; attempts: number; result: string }>;
  /** Where attempts ended, commonest first. The gate's rejection profile. */
  stages: StageCount[];
  /** Requirements that spent every attempt and delivered nothing. */
  exhausted: Array<{ requirement: string; attempts: number; durationMs: number }>;
  /** Oldest run first, so a rate can be seen moving. */
  timeline: TimelinePoint[];
  /** Failures a person has marked as the gate's fault, not the work's. */
  falseFailures: number;
  /**
   * What the run is estimated to have cost, from the per-profile hints, or
   * `null` when no profile declared one. An estimate wearing a label that says
   * so — the harness cannot see an agent's tokens.
   */
  estimatedCost: { total: number; covered: number; uncovered: number } | null;
  /**
   * Of the failures, the share that were genuine. `null` until somebody marks
   * one — an unmarked ledger cannot tell the two apart, and guessing 100% would
   * be the most flattering possible lie about our own gate.
   */
  realFailureRate: number | null;
}

/** How an attempt ending is worth describing to a person. */
export const STAGE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  pass: "passed",
  "agent-timeout": "agent timed out",
  "agent-error": "agent exited non-zero",
  "write-scope": "agent edited protected files",
  "agent-unavailable": "agent out of quota or rate-limited",
  spec: "the specification fails the gate",
  gate: "gate rejected the work",
  artifacts: "diff missed the declared artifacts",
  done: "`specgate done` failed",
  commit: "commit failed",
});

export function summariseRuns(
  runs: readonly RunFile[],
  falseFailures: readonly FalseFailureMark[] = [],
  costPerRunHint: Readonly<Record<string, number>> = {}
): HarnessReportSummary {
  const rows = runs.flatMap((r) => r.results ?? []);
  const passed = rows.filter((r) => r.result === "pass");
  const failed = rows.filter((r) => r.result === "fail");
  const totalMs = rows.reduce((n, r) => n + (r.durationMs ?? 0), 0);
  const firstAttemptPasses = passed.filter((r) => r.attempts === 1).length;

  const worst = [...rows]
    .filter((r) => (r.durationMs ?? 0) > 0)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 5)
    .map((r) => ({
      requirement: r.requirement,
      durationMs: r.durationMs ?? 0,
      attempts: r.attempts,
      result: r.result,
    }));

  // Where attempts ended. Read from attemptLog rather than the row's result,
  // because a requirement that passed on attempt 3 still failed twice, and
  // those two failures are the interesting ones.
  const stageCounts = new Map<string, number>();
  for (const row of rows) {
    for (const attempt of row.attemptLog ?? []) {
      if (!attempt || !attempt.endedAt) continue;
      stageCounts.set(attempt.endedAt, (stageCounts.get(attempt.endedAt) ?? 0) + 1);
    }
  }
  const stages = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));

  // Requirements that spent every attempt the run allowed and delivered
  // nothing. `maxAttempts` is per run, so it is read from the run it belongs to.
  const exhausted: HarnessReportSummary["exhausted"] = [];
  for (const run of runs) {
    const ceiling = run.maxAttempts ?? 0;
    for (const row of run.results ?? []) {
      if (row.result === "fail" && ceiling > 0 && row.attempts >= ceiling) {
        exhausted.push({
          requirement: row.requirement,
          attempts: row.attempts,
          durationMs: row.durationMs ?? 0,
        });
      }
    }
  }

  const attemptProfiles = rows.flatMap((row) =>
    (row.attemptLog ?? []).map((a) => a?.profiles ?? [])
  );

  const timeline = [...runs]
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
    .map((run) => ({
      startedAt: run.startedAt,
      passed: (run.results ?? []).filter((r) => r.result === "pass").length,
      failed: (run.results ?? []).filter((r) => r.result === "fail").length,
    }));

  // Only marks naming a requirement that actually failed count. A mark for
  // something that passed is a typo, and letting it improve the number would
  // make the metric worse than not having it.
  const failedIds = new Set(failed.map((r) => r.requirement));
  const marked = new Set(
    falseFailures.filter((m) => failedIds.has(m.requirement)).map((m) => m.requirement)
  );
  const falseCount = failed.filter((r) => marked.has(r.requirement)).length;

  return {
    runs: runs.length,
    requirementsAttempted: rows.length,
    passed: passed.length,
    failed: failed.length,
    blocked: rows.filter((r) => r.result === "blocked").length,
    firstAttemptPasses,
    firstAttemptRate: passed.length > 0 ? firstAttemptPasses / passed.length : null,
    totalMs,
    msPerDelivered: passed.length > 0 ? Math.round(totalMs / passed.length) : null,
    worst,
    stages,
    exhausted,
    timeline,
    estimatedCost: estimateRunCost(attemptProfiles, costPerRunHint),
    falseFailures: falseCount,
    realFailureRate:
      failed.length > 0 && marked.size > 0 ? (failed.length - falseCount) / failed.length : null,
  };
}

/** The ledger of human marks, one JSON object per line. */
export function parseFalseFailures(jsonl: string): FalseFailureMark[] {
  const marks: FalseFailureMark[] = [];
  for (const line of (jsonl || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.requirement === "string") {
        marks.push({
          requirement: parsed.requirement,
          reason: String(parsed.reason ?? ""),
          markedAt: String(parsed.markedAt ?? ""),
        });
      }
    } catch {
      // One malformed line must not hide the rest — the file is append-only and
      // a half-written line is exactly what a killed process leaves.
    }
  }
  return marks;
}

/** A run-by-run bar, oldest on the left. Empty when there is nothing to show. */
export function sparkline(points: readonly TimelinePoint[]): string {
  if (points.length === 0) return "";
  const blocks = "▁▂▃▄▅▆▇█";
  const totals = points.map((p) => p.passed + p.failed);
  const max = Math.max(...totals, 1);
  return totals
    .map((n) =>
      n === 0
        ? blocks[0]
        : blocks[Math.min(blocks.length - 1, Math.ceil((n / max) * (blocks.length - 1)))]
    )
    .join("");
}
