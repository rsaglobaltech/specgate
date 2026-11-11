/**
 * @rsaglobaltech/specgate/api — specgate read in-process (change specgate-api).
 *
 * Each function answers what the command prints with `--json`: its data, and
 * its findings under `status`. They only read — no file of the project is
 * written and no process is started — except `harnessStop`, which writes the
 * stop request a running harness reads. API_VERSION's major number changes
 * only when an answer's shape breaks.
 *
 * The documents `specgate harness run` prints are declared here too, though no
 * function returns them: `HarnessRunReport` (`--format json`) and
 * `HarnessStreamEvent` (`--format jsonl`, one per line). So is
 * `PlanEstimate`, each entry of `estimates` in `specgate plan --json`.
 */

export declare const API_VERSION: "1.0.0";

/** A finding, as every `--json` answer carries them under `status`. */
export interface Finding {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  target?: string;
  fix?: string;
  file?: string;
  line?: number;
}

/** A call on a folder that is not a specgate project, and the like. */
export interface SpecgateApiError extends Error {
  /** `usage`: `harnessStop` called without `{ afterCurrent: true }`. */
  code: "not_a_project" | "usage";
  fix: string;
}

/** `specgate status --json`. */
export interface StatusAnswer {
  schemaVersion: 1;
  projectDir: string;
  total: number;
  pending: number;
  counts: Record<string, number>;
  orphanFeatures: string[];
  packs: unknown[];
  requirements: Array<{
    id: string;
    title: string | null;
    category: string;
    needs: string | null;
    change?: string;
    question?: string | null;
    answered?: string;
  }>;
  brief?: { path: string; modules: Array<{ module: string; state: string }> };
  nextCommand: string | null;
  status: Finding[];
}

/** `specgate questions --json`. */
export interface QuestionsAnswer {
  questions: {
    open: Array<{
      id: string;
      change: string;
      text: string;
      blocks: string[];
      /** The options its author listed in "Options seen"; empty when none (REQ-479). */
      options: string[];
      /** Where it was asked: the brief, a draft, or the agent while it builds (REQ-481). */
      asked: "brief" | "draft" | "build";
      file: string;
      line: number;
    }>;
    /** Answered, and not yet confirmed with `specgate answer <Q> --reviewed` (REQ-482). */
    answered: Array<{
      id: string;
      change: string;
      text: string;
      blocks: string[];
      answer: string;
      asked: "brief" | "draft" | "build";
      file: string;
      line: number;
    }>;
    waitingWithoutQuestion: Array<{ requirement: string; title: string }>;
  };
  status: Finding[];
}

/** `specgate matrix --json --dry-run`. */
export interface MatrixAnswer {
  matrix: { projectDir: string; derived: boolean; written?: false; rows?: number };
  status: Finding[];
}

/** `specgate harness stop --after-current --json` (REQ-491, REQ-492). */
export interface HarnessStopAnswer {
  stop: {
    /** False when no run was working in the project: nothing was requested. */
    requested: boolean;
    /** The run asked to stop; `startedAt` in epoch seconds. */
    run: { pid: number; requirements: string[]; startedAt: number } | null;
  };
  /** `harness_not_running` (a warning) when there was no run to stop. */
  status: Finding[];
}

/** What an estimate rests on, strongest first; `none`: nothing recorded supports one (REQ-493). */
export type EstimateBasis = "history" | "size" | "average" | "none";

/** One entry of `estimates` in `specgate plan --json`, per pending requirement (REQ-493). */
export interface PlanEstimate {
  requirement: string;
  /** Given/When/Then steps (and their And/But) across its scenarios. */
  steps: number;
  time: {
    /** Milliseconds of wall-clock, failed attempts included; `null` with basis `none`. */
    ms: number | null;
    basis: EstimateBasis;
    /** The runs (`history`) or delivered requirements (`size`, `average`) it rests on. */
    samples: number;
    /** The basis in words. */
    detail: string;
  };
  /** In the unit of `cost_per_run_hint`; `null` when no profile declares one. */
  cost: { amount: number | null; basis: EstimateBasis; samples: number; detail: string } | null;
}

/** How a requirement ended in `harness run`. */
export type HarnessVerdict = "pass" | "fail" | "skipped" | "blocked" | "question";

/** One requirement's result in `harness run --format json`, and in a `result` event. */
export interface HarnessRequirementResult {
  requirement: string;
  result: HarnessVerdict;
  attempts: number;
  branch: string;
  category?: string;
  base?: string;
  durationMs?: number;
  /** Why it did not pass; for `skipped`, `Not attempted: <reason>`. */
  error?: string;
  /** The question's text, when the result is `question`. */
  question?: string;
  /** The question it waits on, once recorded in the project (REQ-495). */
  waitingForAnswer?: {
    id: string;
    text: string;
    change: string;
    file: string;
    /** The command that answers it. */
    answer: string;
  };
  /** Why it was not started: `stop_asked`, or the budget's code. */
  stoppedBy?: string;
  workPreserved?: boolean;
  attemptLog?: Array<{
    attempt: number;
    endedAt: string;
    agentMs: number;
    totalMs: number;
    profiles: string[];
  }>;
  pushed?: boolean;
  prCreated?: boolean;
  prOutput?: string;
  publishError?: string;
  [key: string]: unknown;
}

/** `specgate harness run --format json`, and the `report` of the stream's `run-end`. */
export interface HarnessRunReport {
  schemaVersion: 1;
  total: number;
  /** How many requirements ended each way. */
  summary: Partial<Record<HarnessVerdict, number>>;
  results: HarnessRequirementResult[];
  /** What `--allow-dirty` left out: the uncommitted and untracked paths (REQ-490). */
  dirty: { allowed: boolean; leftOut: string[] };
  /** Why the run started no more requirements, or `null` when it ran them all (REQ-491). */
  stopped: {
    by: "request" | "budget";
    /** `stop_asked`, `run_budget_seconds_exhausted` or `run_max_requirements_reached`. */
    code: string;
    reason: string;
    notAttempted: string[];
  } | null;
}

/**
 * Every line `specgate harness run --format jsonl` writes on stdout is one of
 * these (REQ-496, REQ-497). `t` is in epoch seconds; `req` and `attempt` are
 * there for every event about a requirement. The events the run and the
 * agent's adapter write to `.harness/events/<REQ>.jsonl` come through as they
 * are written there, so a type not listed here may appear: read it or skip it.
 */
export type HarnessStreamEvent =
  | {
      type: "run-start";
      t: number;
      schemaVersion: 1;
      projectDir: string;
      base: string;
      queue: string[];
      concurrency: number;
      maxAttempts: number;
      dirty: { allowed: boolean; leftOut: string[] };
    }
  | { type: "attempt"; t: number; req: string; attempt: number; state: "start" }
  | {
      type: "attempt";
      t: number;
      req: string;
      attempt: number;
      state: "end";
      result: "pass" | "fail" | "question";
      /** Where a failed attempt ended: `gate`, `agent-timeout`, `write-scope`… */
      stage?: string;
    }
  | {
      type: "prompt";
      t: number;
      req: string;
      attempt: number;
      role: string;
      chars: number;
      lines: number;
    }
  | { type: "agent-start"; t: number; req: string; attempt: number; role: string }
  | {
      type: "output";
      t: number;
      req: string;
      attempt: number;
      stream: "stdout" | "stderr";
      /** As the agent wrote it, at most 4000 characters a line; consecutive ones join up. */
      text: string;
    }
  | {
      type: "agent-end";
      t: number;
      req: string;
      attempt: number;
      role: string;
      exit: number | null;
      timedOut: boolean;
      ms: number;
    }
  | {
      type: "gate-start";
      t: number;
      req: string;
      attempt?: number;
      stage: string;
      runner?: string;
      image?: string;
    }
  | {
      type: "gate";
      t: number;
      req: string;
      attempt?: number;
      stage: string;
      result: "pass" | "fail" | "skipped";
      ms?: number;
      pass?: number;
      fail?: number;
    }
  | {
      /** From the agent's adapter: one tool call, when its result arrives. */
      type: "step";
      t: number;
      req: string;
      attempt: number;
      kind: "read" | "search" | "edit" | "write" | "test" | "gate" | "shell" | "other";
      tool: string;
      target: string;
      result: "ok" | "error";
    }
  | { type: "message"; t: number; req: string; attempt: number; text: string }
  | { type: "agent"; t: number; req: string; attempt: number; model: string }
  | {
      /** From the agent's adapter: tokens as it goes, and with `final` the session's totals and cost. */
      type: "usage";
      t: number;
      req: string;
      attempt: number;
      final?: boolean;
      context?: number;
      window?: number;
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: number;
      turns?: number;
    }
  | {
      /** The agent asked (REQ-494): with `id` once it is recorded in the project. */
      type: "question";
      t: number;
      req: string;
      attempt: number;
      text: string;
      id?: string;
      change?: string;
      file?: string;
      committed?: boolean;
    }
  | { type: "merge"; t: number; req: string; attempt?: number; into: string; branch: string }
  | {
      /** A requirement's result; a later one for the same `req` replaces it (`--chain` undoes a merge). */
      type: "result";
      t: number;
      req: string;
      result: HarnessRequirementResult;
    }
  | {
      /** The last line. `report` is null when the run was refused; `status` says why. */
      type: "run-end";
      t: number;
      report: HarnessRunReport | null;
      status: Finding[];
    };

export declare function status(dir: string): Promise<StatusAnswer>;
export declare function questions(dir: string): Promise<QuestionsAnswer>;
export declare function matrix(dir: string): Promise<MatrixAnswer>;
/** Asks the harness run working in `dir` to stop after the requirement in progress (REQ-492). */
export declare function harnessStop(
  dir: string,
  options: { afterCurrent: true }
): Promise<HarnessStopAnswer>;
