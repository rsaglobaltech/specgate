/**
 * @rsaglobaltech/specgate/api — specgate read in-process (change specgate-api).
 *
 * Each function answers what the command prints with `--json`: its data, and
 * its findings under `status`. They only read — no file of the project is
 * written and no process is started — but `writeBriefForm`, which writes
 * docs/brief.md and nothing else. API_VERSION's major number changes only when
 * an answer's shape breaks; functions are added without changing it.
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
  code: "not_a_project" | "change_not_found" | "brief_form_invalid";
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
/** `specgate change show <id> --json`, review notes included (REQ-484). */
export declare function change(dir: string, id: string): Promise<ChangeAnswer>;
/** `specgate propose --from-brief --form --json`: docs/brief.md as a form (REQ-486). */
export declare function briefForm(dir: string): Promise<BriefFormAnswer>;
/** Writes the form into docs/brief.md, only what changed (REQ-487); answers the form read back. */
export declare function writeBriefForm(dir: string, form: BriefFormInput): Promise<BriefFormAnswer>;
