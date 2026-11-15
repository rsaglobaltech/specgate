/**
 * The two gaps a context harness is measured by (REQ-300..REQ-303).
 *
 * The 1.0 line takes them from the InfoQ article on enterprise spec-driven
 * development (docs/specs/enterprise-sdd-gap.md, 6):
 *
 * - **spec → implementation**: the spec was clear and the code diverged. The
 *   fix is stronger validation and constraints — the check that caught it.
 * - **intent → spec**: a detail of the use case was missed while talking. The
 *   fix is better elicitation — the module whose questions came late.
 *
 * A person's classification is the truth. What the harness recorded only
 * suggests one: a rejection the agent fixed on a later attempt reads as the
 * code diverging, and a requirement that changed after review — an answered
 * question, a note, a modified delta — as intent the spec had missed. Pure
 * arithmetic over records, like the rest of the report.
 */

export type Gap = "spec-impl" | "intent-spec";

export const GAPS: readonly Gap[] = Object.freeze(["spec-impl", "intent-spec"] as Gap[]);

/** A person saying which gap a requirement fell into (REQ-300). */
export interface GapMark {
  requirement: string;
  gap: Gap;
  reason: string;
  markedAt: string;
}

/** Something in the project that says a requirement changed after review. */
export interface IntentEvidence {
  requirement: string;
  /** What changed it, in a few words: "Q5 answered", "review note". */
  why: string;
  /** When, if the evidence says (a review note's date). */
  at?: string;
}

/** One attempt, as far as the gaps are concerned. */
export interface GapAttempt {
  endedAt: string;
  /** The gate stage that rejected it: "quality check: pmd". */
  gateStage?: string;
}

export interface GapInput {
  marks?: readonly GapMark[];
  evidence?: readonly IntentEvidence[];
  /** Each requirement's module; one missing reads as "spec". */
  moduleOf?: Readonly<Record<string, string>>;
}

export interface GapRow {
  requirement: string;
  gap: Gap;
  source: "person" | "suggested";
  why: string;
  /** For spec → implementation: the gate stage that caught it. */
  check?: string;
  module: string;
}

export interface GapSummary {
  /** Requirements the ledger records: the denominator of both rates. */
  requirements: number;
  specImpl: { count: number; rate: number | null };
  intentSpec: { count: number; rate: number | null };
  byModule: Array<{ module: string; requirements: number; specImpl: number; intentSpec: number }>;
  strengthen: { specImpl: string | null; intentSpec: string | null };
  /** Classifications a person made, and how many were suggested. */
  marked: number;
  suggested: number;
  rows: GapRow[];
}

/** "quality check: pmd" → "pmd"; "test command: npm test" → "test command". */
export function checkName(stage: string): string {
  const s = (stage || "").trim();
  const quality = /^quality check:\s*(\S+)/.exec(s);
  if (quality) return quality[1];
  const colon = s.indexOf(":");
  return colon > 0 ? s.slice(0, colon).trim() : s || "gate";
}

/**
 * Every requirement's gap, if it has one, and the rates.
 *
 * `attemptsOf` holds each requirement's attempts across every run, oldest
 * first; `requirements` the ones the ledger records, in any order.
 */
export function summariseGaps(
  requirements: readonly string[],
  attemptsOf: ReadonlyMap<string, readonly GapAttempt[]>,
  input: GapInput = {}
): GapSummary {
  const moduleOf = (id: string) => (input.moduleOf && input.moduleOf[id]) || "spec";
  const marks = new Map<string, GapMark>();
  for (const m of input.marks ?? []) marks.set(m.requirement, m); // the latest wins
  const evidence = new Map<string, IntentEvidence>();
  for (const e of input.evidence ?? [])
    if (!evidence.has(e.requirement)) evidence.set(e.requirement, e);

  const ids = [...new Set([...requirements, ...marks.keys()])].sort();
  const rows: GapRow[] = [];
  const when = new Map<string, string>();
  for (const id of ids) {
    const mark = marks.get(id);
    if (mark) {
      rows.push({
        requirement: id,
        gap: mark.gap,
        source: "person",
        why: mark.reason,
        module: moduleOf(id),
      });
      when.set(id, mark.markedAt);
      continue;
    }
    const log = attemptsOf.get(id) ?? [];
    const onSpec = log.some((a) => a.endedAt === "spec");
    const said = evidence.get(id);
    if (said || onSpec) {
      rows.push({
        requirement: id,
        gap: "intent-spec",
        source: "suggested",
        why: said ? said.why : "the gate failed on the specification",
        module: moduleOf(id),
      });
      if (said && said.at) when.set(id, said.at);
      continue;
    }
    // A rejection followed by a pass: the agent got there, the code had diverged.
    const fixed = log.findIndex(
      (a, i) => a.endedAt === "gate" && log.slice(i + 1).some((b) => b.endedAt === "pass")
    );
    if (fixed >= 0) {
      const check = checkName(log[fixed].gateStage || "");
      rows.push({
        requirement: id,
        gap: "spec-impl",
        source: "suggested",
        why: `rejected at ${log[fixed].gateStage || "the gate"}, then passed`,
        check,
        module: moduleOf(id),
      });
    }
  }

  const total = requirements.length;
  const count = (g: Gap) => rows.filter((r) => r.gap === g).length;
  const rate = (n: number) => (total > 0 ? n / total : null);

  const modules = new Map<string, GapSummary["byModule"][number]>();
  for (const id of requirements) {
    const name = moduleOf(id);
    const m = modules.get(name) || { module: name, requirements: 0, specImpl: 0, intentSpec: 0 };
    m.requirements += 1;
    modules.set(name, m);
  }
  for (const r of rows) {
    const m = modules.get(r.module) || {
      module: r.module,
      requirements: 0,
      specImpl: 0,
      intentSpec: 0,
    };
    if (r.gap === "spec-impl") m.specImpl += 1;
    else m.intentSpec += 1;
    modules.set(r.module, m);
  }

  return {
    requirements: total,
    specImpl: { count: count("spec-impl"), rate: rate(count("spec-impl")) },
    intentSpec: { count: count("intent-spec"), rate: rate(count("intent-spec")) },
    byModule: [...modules.values()].sort((a, b) => a.module.localeCompare(b.module)),
    strengthen: {
      specImpl: commonest(
        rows.filter((r) => r.gap === "spec-impl" && r.check).map((r) => r.check!)
      ),
      intentSpec: newestOfCommonest(
        rows.filter((r) => r.gap === "intent-spec").map((r) => r.module),
        rows
          .filter((r) => r.gap === "intent-spec")
          .map((r) => [r.module, when.get(r.requirement) || ""])
      ),
    },
    marked: rows.filter((r) => r.source === "person").length,
    suggested: rows.filter((r) => r.source === "suggested").length,
    rows,
  };
}

function tally(names: readonly string[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const name of names) n.set(name, (n.get(name) ?? 0) + 1);
  return n;
}

/** The commonest name; a tie goes to the first alphabetically. */
function commonest(names: readonly string[]): string | null {
  const best = [...tally(names).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return best.length ? best[0][0] : null;
}

/** The commonest name; a tie goes to the one seen most recently. */
function newestOfCommonest(
  names: readonly string[],
  dated: ReadonlyArray<readonly [string, string]>
): string | null {
  const counts = tally(names);
  if (counts.size === 0) return null;
  const top = Math.max(...counts.values());
  const latest = new Map<string, string>();
  for (const [name, at] of dated) if (at > (latest.get(name) ?? "")) latest.set(name, at);
  return [...counts.entries()]
    .filter(([, n]) => n === top)
    .map(([name]) => name)
    .sort(
      (a, b) => (latest.get(b) ?? "").localeCompare(latest.get(a) ?? "") || a.localeCompare(b)
    )[0];
}

/** The ledger of classifications, one JSON object per line (REQ-300). */
export function parseGapMarks(jsonl: string): GapMark[] {
  const marks: GapMark[] = [];
  for (const line of (jsonl || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const p = JSON.parse(line);
      if (p && typeof p.requirement === "string" && GAPS.includes(p.gap)) {
        marks.push({
          requirement: p.requirement,
          gap: p.gap,
          reason: String(p.reason ?? ""),
          markedAt: String(p.markedAt ?? ""),
        });
      }
    } catch {
      // A half-written line is what a killed process leaves; skip it.
    }
  }
  return marks;
}
