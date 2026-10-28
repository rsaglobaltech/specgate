import * as fs from "node:fs";
import * as path from "node:path";
import { EMPTY_BASELINE, type Baseline } from "../domain/Sarif";

/** Committed with the project: the findings accepted as existing debt (ADR-0040). */
export const QUALITY_BASELINE_FILE = path.join(".specgate", "quality-baseline.json");

export function readBaseline(projectDir: string): Baseline {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(projectDir, QUALITY_BASELINE_FILE), "utf8"));
    if (doc && doc.version === 1 && doc.checks && typeof doc.checks === "object") return doc;
  } catch {
    /* none yet, or unreadable: nothing is accepted */
  }
  return EMPTY_BASELINE;
}

export function writeBaseline(projectDir: string, baseline: Baseline): string {
  const file = path.join(projectDir, QUALITY_BASELINE_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sorted: Baseline = {
    version: 1,
    checks: Object.fromEntries(
      Object.keys(baseline.checks)
        .sort()
        .map((k) => [k, [...baseline.checks[k]].sort()])
    ),
  };
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  return file;
}
