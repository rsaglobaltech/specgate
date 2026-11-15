/**
 * A baseline lets a project with history adopt the gate (REQ-531).
 *
 * A team that turns `specgate check` on over a system it already runs finds
 * every old gap at once — Implemented rows with no test, requirements with no
 * row — and a gate that is red on day one is switched off on day two.
 * `specgate check --baseline` writes today's findings down; after that the gate
 * fails only on a finding that is not in the file, says how many it let
 * through, and names every baselined finding that has gone, so the file
 * shrinks as the gaps are closed.
 *
 * A finding is matched by what it is about — its code, its file and its
 * requirement — never by its message: a reworded message must not turn an old
 * finding into a new one.
 *
 * This module holds the rule; reading and writing the file is the caller's.
 */

/** Where the baseline lives, relative to the project. Committed beside the matrix. */
export const BASELINE_FILE = "docs/specs/gate-baseline.json";

export interface BaselineEntry {
  readonly code: string;
  readonly file: string;
  /** The requirement (or, failing one, the scenario or target) the finding is about. */
  readonly requirement: string;
}

export interface GateBaseline {
  readonly version: 1;
  readonly findings: readonly BaselineEntry[];
}

/** The identity of a finding: what it is about, not how it is worded. */
export function fingerprint(e: BaselineEntry): string {
  return `${e.code}|${e.file}|${e.requirement}`;
}

/** A baseline of these findings, deduplicated and sorted so the file diffs cleanly. */
export function baselineOf(entries: readonly BaselineEntry[]): GateBaseline {
  const seen = new Map<string, BaselineEntry>();
  for (const e of entries) {
    const key = fingerprint(e);
    if (!seen.has(key)) seen.set(key, { code: e.code, file: e.file, requirement: e.requirement });
  }
  return {
    version: 1,
    findings: [...seen.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, e]) => e),
  };
}

export interface BaselineSplit<T> {
  /** Not in the baseline: these still fail the gate. */
  readonly fresh: T[];
  /** In the baseline: reported, counted, not failing. */
  readonly baselined: T[];
  /** In the baseline and no longer found: the file can drop them. */
  readonly fixed: BaselineEntry[];
}

/**
 * Split findings into the ones the baseline excuses and the ones it does not.
 *
 * `fixed` is only meaningful when the run looked for every kind of finding the
 * baseline holds; `judged` names the codes this run checked, so a plain
 * `validate` does not call a strict-only finding fixed.
 */
export function applyBaseline<T>(
  findings: readonly T[],
  entryOf: (f: T) => BaselineEntry,
  baseline: GateBaseline | null,
  judged: (code: string) => boolean = () => true
): BaselineSplit<T> {
  if (!baseline) return { fresh: [...findings], baselined: [], fixed: [] };
  const known = new Set(baseline.findings.map(fingerprint));
  const found = new Set<string>();
  const fresh: T[] = [];
  const baselined: T[] = [];
  for (const f of findings) {
    const key = fingerprint(entryOf(f));
    found.add(key);
    (known.has(key) ? baselined : fresh).push(f);
  }
  const fixed = baseline.findings.filter((e) => judged(e.code) && !found.has(fingerprint(e)));
  return { fresh, baselined, fixed };
}

/**
 * Read a baseline from its text. Anything that is not one is an error the
 * caller reports: a corrupt baseline silently read as empty would fail the
 * gate on every old finding, and one read as "everything" would pass it.
 */
export function parseBaseline(text: string): GateBaseline {
  const data: unknown = JSON.parse(text);
  if (
    !data ||
    typeof data !== "object" ||
    (data as { version?: unknown }).version !== 1 ||
    !Array.isArray((data as { findings?: unknown }).findings)
  ) {
    throw new Error("not a gate baseline (expected version 1 and a findings list)");
  }
  const findings = (data as { findings: unknown[] }).findings.map((raw, i) => {
    const e = raw as Partial<Record<keyof BaselineEntry, unknown>>;
    if (
      typeof e?.code !== "string" ||
      typeof e.file !== "string" ||
      typeof e.requirement !== "string"
    ) {
      throw new Error(`finding ${i + 1} needs a code, a file and a requirement`);
    }
    return { code: e.code, file: e.file, requirement: e.requirement };
  });
  return { version: 1, findings };
}
