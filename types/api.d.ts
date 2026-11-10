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
  code: "not_a_project";
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

export declare function status(dir: string): Promise<StatusAnswer>;
export declare function questions(dir: string): Promise<QuestionsAnswer>;
export declare function matrix(dir: string): Promise<MatrixAnswer>;
