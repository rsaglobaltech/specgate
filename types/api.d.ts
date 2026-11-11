/**
 * @rsaglobaltech/specgate/api — specgate read in-process (change specgate-api).
 *
 * Each function answers what the command prints with `--json`: its data, and
 * its findings under `status`. They only read — no file of the project is
 * written and no process is started — except `harnessStop`, which writes the
 * stop request a running harness reads, and `writeBriefForm`, which writes
 * docs/brief.md and nothing else. API_VERSION's major number changes only when
 * an answer's shape breaks; functions are added without changing it.
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
  /**
   * `usage`: `harnessStop` called without `{ afterCurrent: true }`;
   * `capability_unknown`: `report(dir, { capability })` names one the project does not have.
   */
  code:
    | "not_a_project"
    | "usage"
    | "change_not_found"
    | "brief_form_invalid"
    | "capability_unknown";
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
    /** The capability that states it; null for one only in spec.md (REQ-500). */
    capability: string | null;
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

/** One row per scenario of the matrix (REQ-498). */
export interface MatrixScenarioRow {
  requirement: string;
  /** Null for a requirement with no scenario. */
  scenario: string | null;
  feature: string | null;
  /** The test files the row names. */
  tests: string[];
  /** The code files the row names. */
  code: string[];
  status: string;
  /** Which links the row does not have to a file that exists. */
  gaps: Array<"feature" | "test" | "code">;
  /** The open question that blocks its requirement, or null. */
  waiting: { question: string; change: string } | null;
}

/** `specgate matrix --json --dry-run`. */
export interface MatrixAnswer {
  matrix: {
    projectDir: string;
    derived: boolean;
    written?: false;
    /** How many rows the derived matrix has. */
    rows?: number;
    /** One row per scenario, the open changes' requirements included (REQ-498). */
    scenarios: MatrixScenarioRow[];
  };
  status: Finding[];
}

/** The project's line coverage, read from its coverage tool's report (REQ-499). */
export interface LineCoverage {
  percent: number;
  covered: number;
  total: number;
  /** The report's format, which names the tool family that wrote it. */
  tool: "lcov" | "istanbul" | "cobertura" | "jacoco";
  /** The report, relative to the project, with forward slashes. */
  file: string;
  /** When the report was written, ISO 8601. */
  measuredAt: string;
}

/** `specgate report --format json --stdout [--capability <name>]`. */
export interface ReportAnswer {
  schemaVersion: 1;
  projectDir: string;
  total: number;
  implemented: number;
  pending: number;
  implementedPct: number;
  byCategory: Record<string, number>;
  needsTest: string[];
  orphanFeatures: string[];
  specops: unknown;
  requirements: Array<Record<string, unknown> & { requirement: string; category: string }>;
  declaredValues: unknown;
  /** Null with the finding `coverage_not_measured` when no report measures it — never 0. */
  coverage: { lines: LineCoverage | null };
  /** Set when the report is narrowed to one capability (REQ-501). */
  capability?: string;
  status: Finding[];
}

/** One stage of `specgate check`, as every `--json` answer lists them (REQ-503). */
export interface GateStage {
  stage: "ids" | "changes" | "validate" | "architecture" | "tests" | "quality";
  /** The quality check's name, for a `quality` stage. */
  name?: string;
  /** Whether a failed quality check fails the gate. */
  gate?: boolean;
  command: string | null;
  result: "passed" | "failed" | "skipped" | "not run";
  /** How long the stage took, in milliseconds; null when it did not run (REQ-519). */
  ms: number | null;
  findings: Finding[];
}

/** Which tests `specgate check` ran, and why (REQ-510 … REQ-516). */
export interface TestSelection {
  /** `affected`: the tests of what changed; `full`: the whole suite. */
  mode: "affected" | "full";
  reason: string;
  /** The ref the change was compared with; null when none was. */
  base: string | null;
  /** The files changed since the base, project-relative. */
  changed: string[];
  /** The requirements the change touches. */
  requirements: string[];
  /** The test files selected; empty when the whole suite runs. */
  tests: string[];
  /** Selected test files not run again: they passed before on the same code. */
  cached: string[];
  /** The command that ran; null when none did. */
  command: string | null;
}

/** `specgate check --last --json` (REQ-504). */
export interface LastCheckAnswer {
  /** Null, with the finding `last_check_none` (fix `specgate check`), when no check has run. */
  lastCheck: {
    schemaVersion: 1;
    /** When the check ended, ISO 8601. */
    ranAt: string;
    /** HEAD when it ran; null outside git. */
    commit: string | null;
    branch: string | null;
    /** Whether the working tree had changes the commit does not hold. */
    dirty: boolean | null;
    passed: boolean;
    ci: boolean;
    stages: GateStage[];
    /** Which tests it ran; absent from a check kept before 0.34.0. */
    selection?: TestSelection;
  } | null;
  /** The findings that check answered with. */
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

/** What changed for a review note once a redraft addressed it (REQ-484). */
export interface ReviewChange {
  /** The requirement that changed; null for a change to the draft outside every requirement. */
  requirement: string | null;
  /** The delta, relative to the project, with `/`. */
  file: string;
  /** 1-based, after the redraft (before it, for a requirement it removed). */
  line: number | null;
  /** The text before the redraft; "" when it did not exist. */
  before: string;
  /** The text after it; "" when it was removed. */
  after: string;
}

/** A change asked for in a draft's review.md (REQ-484). */
export interface ReviewNote {
  /** `N1`, `N2`… in the table's order. */
  id: string;
  date: string;
  requirement: string | null;
  text: string;
  state: "open" | "addressed";
  addressed: { date: string; changes: ReviewChange[] } | null;
  /** Its row in review.md, 1-based. */
  line: number;
}

/** `specgate change show <id> --json`. */
export interface ChangeAnswer {
  change: {
    id: string;
    title: string;
    config: Record<string, unknown>;
    deltaCount: number;
    deltas: Array<{
      capability: string;
      file: string;
      added: string[];
      modified: string[];
      removed: string[];
    }>;
    tasks: { total: number; complete: number };
    review: {
      /** review.md, relative to the project; null when the change has none. */
      file: string | null;
      open: number;
      notes: ReviewNote[];
    };
  };
  status: Finding[];
}

export interface BriefFormCard {
  text: string;
  /** 1-based, in the whole brief. */
  line: number;
}

export interface BriefFormModule {
  /** How `modules:` spells it. */
  key: string;
  /** Named by `modules:` in the front matter. */
  listed: boolean;
  /** As its heading writes it; the key when it has no section. */
  name: string;
  /** `module`: `## Module: <name>`; `plain`: a hand-written `## <name>`; null: no section. */
  section: "module" | "plain" | null;
  /** Its heading, or null. */
  line: number | null;
  prose: { text: string; line: number | null };
  rules: BriefFormCard[];
  examples: BriefFormCard[];
  questions: BriefFormCard[];
}

/** The brief as a form, each field with its line, or null when the file does not hold it (REQ-486). */
export interface BriefForm {
  /** The brief's path as given: relative to the project, or absolute. */
  brief: string;
  exists: boolean;
  eol: "lf" | "crlf";
  frontMatter: {
    /** Its opening `---`, or null when the brief has none. */
    line: number | null;
    product: { value: string; line: number | null };
    surfaces: { value: string[]; line: number | null };
    actors: {
      value: Array<{ name: string; surfaces: string[]; line: number }>;
      line: number | null;
    };
    /** Read only: writing lists `modules:` in the order of `modules` below. */
    modules: { value: string[]; line: number | null };
  };
  modules: BriefFormModule[];
  /** On a write: whether the file changed. */
  written?: boolean;
}

/** `specgate propose --from-brief --form [<file>] --json`. */
export interface BriefFormAnswer {
  form: BriefForm;
  /** The brief's findings (B1–B13), each with its line where it has one. */
  status: Finding[];
}

/**
 * What `writeBriefForm` and `--form <file>` take: a `BriefForm` with its
 * values changed. Lines are ignored; a card may be a string; a module removed
 * from `modules` loses its section; `surfaces` absent means the actors'.
 */
export interface BriefFormInput {
  frontMatter: {
    product: { value: string } | string;
    surfaces?: { value: string[] } | string[];
    actors:
      | { value: Array<{ name: string; surfaces: string[] }> }
      | Array<{ name: string; surfaces: string[] }>;
  };
  modules: Array<{
    key?: string;
    name: string;
    prose?: { text: string } | string;
    rules?: Array<string | { text: string }>;
    examples?: Array<string | { text: string }>;
    questions?: Array<string | { text: string }>;
  }>;
}

export declare function status(dir: string): Promise<StatusAnswer>;
export declare function questions(dir: string): Promise<QuestionsAnswer>;
export declare function matrix(dir: string): Promise<MatrixAnswer>;
/** Asks the harness run working in `dir` to stop after the requirement in progress (REQ-492). */
export declare function harnessStop(
  dir: string,
  options: { afterCurrent: true }
): Promise<HarnessStopAnswer>;
/** `specgate change show <id> --json`, review notes included (REQ-484). */
export declare function change(dir: string, id: string): Promise<ChangeAnswer>;
/** `specgate propose --from-brief --form --json`: docs/brief.md as a form (REQ-486). */
export declare function briefForm(dir: string): Promise<BriefFormAnswer>;
/** Writes the form into docs/brief.md, only what changed (REQ-487); answers the form read back. */
export declare function writeBriefForm(dir: string, form: BriefFormInput): Promise<BriefFormAnswer>;
/** What `specgate report --format json --stdout` prints; `capability` narrows it (REQ-501). */
export declare function report(
  dir: string,
  options?: { capability?: string }
): Promise<ReportAnswer>;
/** The last gate result `specgate check` kept, without running the gate (REQ-504). */
export declare function lastCheck(dir: string): Promise<LastCheckAnswer>;
