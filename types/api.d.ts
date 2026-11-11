/**
 * @rsaglobaltech/specgate/api — specgate read in-process (change specgate-api).
 *
 * Each function answers what the command prints with `--json`: its data, and
 * its findings under `status`. They only read: no file of the project is
 * written and no process is started. API_VERSION's major number changes only
 * when an answer's shape breaks.
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
  /** `capability_unknown`: `report(dir, { capability })` names one the project does not have. */
  code: "not_a_project" | "capability_unknown";
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
  findings: Finding[];
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
  } | null;
  /** The findings that check answered with. */
  status: Finding[];
}

export declare function status(dir: string): Promise<StatusAnswer>;
export declare function questions(dir: string): Promise<QuestionsAnswer>;
export declare function matrix(dir: string): Promise<MatrixAnswer>;
/** What `specgate report --format json --stdout` prints; `capability` narrows it (REQ-501). */
export declare function report(
  dir: string,
  options?: { capability?: string }
): Promise<ReportAnswer>;
/** The last gate result `specgate check` kept, without running the gate (REQ-504). */
export declare function lastCheck(dir: string): Promise<LastCheckAnswer>;
