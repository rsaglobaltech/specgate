/**
 * The traceability matrix as one row per scenario, with the links each row is
 * missing (REQ-498), and the question it waits for.
 *
 * specgate-studio's Traceability view reads this through `matrix --json` and
 * the API: it never parses the Markdown table. Pure — the caller says which
 * files exist.
 */

import type { MatrixRow } from "./TraceabilityFormat";
import { RequirementPlan } from "./RequirementPlan";

export type MatrixGap = "feature" | "test" | "code";

export interface MatrixScenarioRow {
  requirement: string;
  /** Null for a requirement with no scenario. */
  scenario: string | null;
  feature: string | null;
  tests: string[];
  code: string[];
  status: string;
  /** Which link the row does not have to a file that exists. */
  gaps: MatrixGap[];
  /** The open question that blocks its requirement, or null. */
  waiting: { question: string; change: string } | null;
}

/** The values a cell names: `a.ts, b.ts` → both, placeholders and backticks dropped. */
function named(cell: string | undefined): string[] {
  return String(cell || "")
    .split(",")
    .map((p) => p.replace(/`/g, "").trim())
    .filter((p) => RequirementPlan.isMeaningful(p));
}

/** A file path, not a command or a description: no spaces, a `/` or a `.`. */
const isPath = (p: string) => !/\s/.test(p) && /[/.]/.test(p);

/**
 * One row per scenario of each matrix row; a cell with several scenario ids is
 * split. `exists` answers for a project-relative path.
 */
export function scenarioRows(
  rows: readonly MatrixRow[],
  exists: (rel: string) => boolean,
  waiting: ReadonlyMap<string, { question: string; change: string }> = new Map()
): MatrixScenarioRow[] {
  const out: MatrixScenarioRow[] = [];
  for (const row of rows) {
    const requirement = String(row.requirement || "").trim();
    if (!/^REQ-/.test(requirement)) continue;
    const status = String(row.status || "").trim();
    const done = RequirementPlan.DONE_STATUSES.has(status);
    const feature = named(row.featureFile)[0] || null;
    const testValues = named(row.testArtifact);
    const codeValues = named(row.technicalArtifact);
    const tests = testValues.filter(isPath);
    const code = codeValues.filter(isPath);
    // The adoption baseline names `npm test` and "existing codebase": once the
    // requirement is delivered, that is not a missing link (as RequirementPlan).
    const linked = (values: string[], files: string[]) =>
      files.some(exists) || (done && values.length > 0 && files.length === 0);
    const gaps: MatrixGap[] = [];
    if (!feature || !exists(feature)) gaps.push("feature");
    if (!linked(testValues, tests)) gaps.push("test");
    if (!linked(codeValues, code)) gaps.push("code");
    const scenarios = String(row.scenarioId || "")
      .split(",")
      .map((s) => s.replace(/`/g, "").trim())
      .filter((s) => RequirementPlan.isMeaningful(s));
    for (const scenario of scenarios.length > 0 ? scenarios : [null]) {
      out.push({
        requirement,
        scenario,
        feature,
        tests,
        code,
        status,
        gaps: [...gaps],
        waiting: waiting.get(requirement) || null,
      });
    }
  }
  return out;
}
