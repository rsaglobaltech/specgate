/**
 * A specification Specgate did not write, read into the one shape the
 * verification rules understand (ADR-0030).
 *
 * Each tool says three things in its own words: what must hold (a
 * requirement), how you would know (an acceptance criterion — a scenario), and
 * that it is done (a ticked task, an archived change). A reader turns those
 * words into `ForeignRequirement`, `ForeignCriterion` and `ForeignClaim`; the
 * rules in `VerifyClaims` never see a format.
 *
 * Pure: readers receive file contents, never paths to open.
 */

export type ForeignFormat = "openspec" | "spec-kit";

export interface ForeignCriterion {
  /** Stable id a test names to prove it, e.g. `openspec:auth/login/wrong-password`. */
  readonly id: string;
  /** The requirement it belongs to. */
  readonly requirementId: string;
  /** Its title as written. */
  readonly title: string;
  /** Its full text (title and steps), the thing a change to it is detected on. */
  readonly text: string;
  readonly file: string;
  readonly line: number;
}

export interface ForeignRequirement {
  readonly id: string;
  readonly title: string;
  readonly file: string;
  readonly line: number;
  readonly criteria: readonly ForeignCriterion[];
}

export interface ForeignClaim {
  /** What makes the claim, for a person: `change 2026-08-15-add-dsh-support`. */
  readonly label: string;
  readonly file: string;
  readonly line: number;
  /**
   * Whether the tool considers the work finished. Only a finished claim is
   * gated; an unfinished one (an active change with every task ticked) is
   * reported, because the tool itself has not called it done yet.
   */
  readonly finished: boolean;
  /** The criteria the claim covers, by id. */
  readonly criteria: readonly string[];
  /**
   * References that resolve to nothing in the current specification. Error or
   * report is the rule's decision, not the reader's (see `V4`).
   */
  readonly unresolved: ReadonlyArray<{ readonly ref: string; readonly why: string }>;
  /** A path whose first appearance in history dates the claim, for `--since`. */
  readonly datedBy: string;
}

/** A file the reader could not make sense of. Never silently zero criteria. */
export interface ReadProblem {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface ForeignSpec {
  readonly format: ForeignFormat;
  readonly requirements: readonly ForeignRequirement[];
  readonly claims: readonly ForeignClaim[];
  readonly problems: readonly ReadProblem[];
}

export interface SourceText {
  readonly path: string;
  readonly source: string;
}

/** `Path configuration for supported tools` → `path-configuration-for-supported-tools`. */
export function slug(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Does `source` name `id` as a whole token — not as a prefix of a longer id? */
export function namesId(source: string, id: string): boolean {
  let from = 0;
  for (;;) {
    const at = source.indexOf(id, from);
    if (at === -1) return false;
    const after = source.charAt(at + id.length);
    const next = source.charAt(at + id.length + 1);
    const before = at > 0 ? source.charAt(at - 1) : "";
    // An id ends at anything that cannot continue it: `/a-b` must not match
    // inside `/a-bc` or `/a-b/c`, nor `US1.2` inside `US1.25` or `US1` inside
    // `US1.2`. A full stop ends a sentence; followed by a digit it continues.
    const continues = /[a-z0-9/-]/i.test(after) || (after === "." && /[0-9]/.test(next));
    if (!continues && !/[a-z0-9:/-]/i.test(before)) return true;
    from = at + 1;
  }
}

/** Every `openspec:…` / `speckit:…` id a source mentions, for orphan detection. */
export function idsNamedIn(source: string): string[] {
  const out = new Set<string>();
  const re = /\b(openspec|speckit):[a-z0-9][a-z0-9/._-]*[a-z0-9]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.add(m[0]);
  return [...out];
}
