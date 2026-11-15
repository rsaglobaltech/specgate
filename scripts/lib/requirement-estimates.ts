import * as fs from "node:fs";
import * as path from "node:path";
import { parseGherkin } from "../../packages/core/src/domain/Gherkin";
import type { ResultRow, RunFile } from "../../packages/core/src/domain/HarnessReport";
import {
  estimateRequirements,
  type RequirementEstimate,
} from "../../packages/core/src/domain/RequirementEstimate";
import { readCostHints } from "../../packages/core/src/infrastructure/HarnessConfigFile";

/**
 * The records an estimate rests on (REQ-493): the run ledger `harness run`
 * writes, the scenario steps of each requirement, and the prices profiles
 * declare. Read only; a file that cannot be read is a basis less, never an
 * error in `plan`.
 */

/** Where `harness run` writes one record per run (`RUNS_DIR` in RunCommand). */
const RUNS_DIR = path.join(".harness", "runs");

/** Every result row of every recorded run. */
export function ledgerRows(projectDir: string): ResultRow[] {
  const dir = path.join(projectDir, RUNS_DIR);
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const rows: ResultRow[] = [];
  for (const name of names.sort()) {
    try {
      const run = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as RunFile;
      if (Array.isArray(run.results)) rows.push(...run.results);
    } catch {
      /* a half-written record is a sample less */
    }
  }
  return rows;
}

/** A plan row, as far as steps are concerned. */
interface StepRow {
  requirement: string;
  scenarioId?: string;
  featureFile?: string;
}

/**
 * Each requirement's scenario steps: the scenarios its feature tags with its
 * requirement or scenario id, or every scenario of a feature that tags none
 * with a requirement (one file per requirement).
 */
export function stepsByRequirement(
  projectDir: string,
  rows: readonly StepRow[]
): Map<string, number> {
  const scenarios = new Map<string, Set<string>>();
  const steps = new Map<string, number>();
  const parsed = new Map<string, ReturnType<typeof parseGherkin> | null>();
  for (const row of rows) {
    const rel = String(row.featureFile || "")
      .replace(/`/g, "")
      .split("#")[0]
      .trim();
    if (!rel) continue;
    if (!parsed.has(rel)) {
      try {
        parsed.set(rel, parseGherkin(fs.readFileSync(path.join(projectDir, rel), "utf8")));
      } catch {
        parsed.set(rel, null);
      }
    }
    const doc = parsed.get(rel);
    if (!doc) continue;
    const wanted = new Set([
      `@${row.requirement}`,
      ...(row.scenarioId ? [`@${row.scenarioId}`] : []),
    ]);
    const tagged = doc.scenarios.filter((s) => s.tags.some((t) => wanted.has(t)));
    const untagged = doc.scenarios.every((s) => !s.tags.some((t) => /^@REQ-/.test(t)));
    const counted = scenarios.get(row.requirement) || new Set<string>();
    for (const s of tagged.length > 0 ? tagged : untagged ? doc.scenarios : []) {
      const key = `${rel}:${s.line}`;
      if (counted.has(key)) continue;
      counted.add(key);
      steps.set(row.requirement, (steps.get(row.requirement) || 0) + s.steps.length);
    }
    scenarios.set(row.requirement, counted);
  }
  return steps;
}

/** One estimate per pending requirement, in the plan's order. */
export function planEstimates(
  projectDir: string,
  rows: ReadonlyArray<StepRow & { category: string }>
): RequirementEstimate[] {
  const steps = stepsByRequirement(projectDir, rows);
  const pending: Array<{ requirement: string; steps: number }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.category === "DONE" || seen.has(row.requirement)) continue;
    seen.add(row.requirement);
    pending.push({ requirement: row.requirement, steps: steps.get(row.requirement) || 0 });
  }
  let hints: Record<string, number> = {};
  try {
    hints = readCostHints(projectDir);
  } catch {
    /* a broken profiles file is the run's problem, not the plan's */
  }
  return estimateRequirements(pending, ledgerRows(projectDir), (id) => steps.get(id) || 0, hints);
}
