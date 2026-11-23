/**
 * A skill examined (REQ-686, REQ-687): the scores of its runs, per task and
 * overall, and how a version did against the previous one. Pure: the command
 * runs the agent and the gate.
 */

export interface RunResult {
  /** `specgate check` passed in the run's copy. */
  correct: boolean;
  /** The `architecture` and `quality` stages that ran: 1 passed, 0 failed. */
  stages: number[];
  /** The reviewer's score ÷ 10, or null without a reviewer. */
  reviewer: number | null;
}

export interface TaskScore {
  id: string;
  runs: number;
  correct: number;
  /** Mean good score of its runs, or null when nothing measured it. */
  good: number | null;
}

/** A run's good score: the mean of its stages and its reviewer; null when none. */
export function goodOf(run: RunResult): number | null {
  const parts = [...run.stages, ...(run.reviewer === null ? [] : [run.reviewer])];
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);

export function taskScore(id: string, runs: readonly RunResult[]): TaskScore {
  return {
    id,
    runs: runs.length,
    correct: runs.filter((r) => r.correct).length,
    good: round(mean(runs.map(goodOf).filter((g): g is number => g !== null))),
  };
}

/** The exam's correct share and good score, over every run of every task. */
export function examScore(tasks: ReadonlyArray<{ runs: readonly RunResult[] }>): {
  correct: number;
  good: number | null;
} {
  const all = tasks.flatMap((t) => t.runs);
  return {
    correct: round(all.length ? all.filter((r) => r.correct).length / all.length : 0) as number,
    good: round(mean(all.map(goodOf).filter((g): g is number => g !== null))),
  };
}

/** A difference of 5 points or less is the same. */
export const SAME_WITHIN = 0.05;

export type Trend = "better" | "worse" | "same";

export function trend(now: number | null, before: number | null): Trend | null {
  if (now === null || before === null) return null;
  if (now - before > SAME_WITHIN) return "better";
  if (before - now > SAME_WITHIN) return "worse";
  return "same";
}

export interface HistoryEntry {
  at: string;
  version: string;
  runs: number;
  correct: number;
  good: number | null;
  tasks: TaskScore[];
}

/** This exam against the last one of another version of the skill; null when there is none. */
export function compareWith(
  history: readonly HistoryEntry[],
  version: string,
  score: { correct: number; good: number | null }
): { version: string; correct: Trend | null; good: Trend | null; from: number; fromGood: number | null } | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const h = history[i];
    if (h.version === version) continue;
    return {
      version: h.version,
      correct: trend(score.correct, h.correct),
      good: trend(score.good, h.good),
      from: h.correct,
      fromGood: h.good,
    };
  }
  return null;
}
