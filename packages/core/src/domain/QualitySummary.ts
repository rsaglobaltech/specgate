/**
 * What the quality checks said about the requirements delivered (REQ-229):
 * read from the run records the harness keeps (REQ-228), the latest passing
 * result of each requirement, so `harness report`, the studio's report and
 * its project page say the same thing. Pure.
 */

export interface RecordedCheck {
  name: string;
  when?: string;
  ok: boolean;
  skipped?: string;
  findings?: { freshCount: number; baselined: number; total: number };
  measure?: { kind: "coverage" | "mutation"; value: number | null; threshold: number | null };
}

interface RecordedResult {
  requirement: string;
  result: string;
  checks?: RecordedCheck[];
}

export interface RequirementQuality {
  requirement: string;
  /** % of the changed lines a test ran, when a coverage check measured it. */
  coverage: number | null;
  /** % of the mutants on changed lines the tests killed. */
  mutation: number | null;
  /** Findings the baseline holds back in the checks it ran. */
  baselined: number;
  checks: Array<{ name: string; ok: boolean; skipped: boolean }>;
}

export interface QualitySummary {
  /** Requirements whose passing attempt ran at least one check. */
  measured: number;
  coverage: number | null;
  mutation: number | null;
  /** Per check: in how many of those requirements it ran, and was skipped. */
  checks: Array<{ name: string; ran: number; skipped: number }>;
  requirements: RequirementQuality[];
}

const mean = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

/**
 * The quality of each requirement's latest passing result. `runs` are in
 * the order they ran; a later pass replaces an earlier one.
 */
export function summariseQuality(
  runs: ReadonlyArray<{ results?: RecordedResult[] }>
): QualitySummary {
  const latest = new Map<string, RecordedResult>();
  for (const run of runs) {
    for (const r of run.results || []) {
      if (r.result === "pass" && Array.isArray(r.checks) && r.checks.length)
        latest.set(r.requirement, r);
    }
  }
  const requirements: RequirementQuality[] = [];
  const perCheck = new Map<string, { ran: number; skipped: number }>();
  for (const r of latest.values()) {
    const checks = r.checks || [];
    const measure = (kind: "coverage" | "mutation") => {
      const values = checks
        .map((c) => (c.measure && c.measure.kind === kind ? c.measure.value : null))
        .filter((v): v is number => v !== null);
      return values.length ? Math.min(...values) : null;
    };
    for (const c of checks) {
      const e = perCheck.get(c.name) || { ran: 0, skipped: 0 };
      if (c.skipped) e.skipped += 1;
      else e.ran += 1;
      perCheck.set(c.name, e);
    }
    requirements.push({
      requirement: r.requirement,
      coverage: measure("coverage"),
      mutation: measure("mutation"),
      baselined: checks.reduce((n, c) => n + (c.findings ? c.findings.baselined : 0), 0),
      checks: checks.map((c) => ({ name: c.name, ok: c.ok, skipped: Boolean(c.skipped) })),
    });
  }
  requirements.sort((a, b) =>
    a.requirement.localeCompare(b.requirement, undefined, { numeric: true })
  );
  return {
    measured: requirements.length,
    coverage: mean(requirements.map((r) => r.coverage).filter((v): v is number => v !== null)),
    mutation: mean(requirements.map((r) => r.mutation).filter((v): v is number => v !== null)),
    checks: [...perCheck.entries()].map(([name, v]) => ({ name, ...v })),
    requirements,
  };
}
