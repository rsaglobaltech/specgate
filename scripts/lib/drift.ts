/**
 * Behaviour changed without a specification (REQ-333, REQ-334).
 *
 * A commit since the base drifts when it changes production code, its message
 * names no requirement, and no test file it changes names one: a person
 * patched the product and the specification never heard of it. The harness's
 * commits name their requirement, so they never drift.
 */

import { spawnSync } from "node:child_process";
import { error, warning, type Diagnostic } from "./diagnostics";
import { baseOf } from "./quality-run";

export interface DriftCommit {
  sha: string;
  subject: string;
  files: string[];
}

export interface DriftReport {
  /** The commit compared with; "" when there is none to compare with. */
  base: string;
  commits: DriftCommit[];
}

const REQ = /\bREQ-\d+\b/;
const SOURCE =
  /\.(ts|tsx|js|jsx|mjs|cjs|java|kt|scala|groovy|py|go|rs|cs|fs|rb|php|swift|vue|svelte|sql|c|cc|cpp|h|hpp)$/i;
const NOT_PRODUCTION = [
  /(^|\/)(tests?|__tests__|__mocks__|spec|specs|e2e|fixtures|testdata)\//i,
  /(^|\/)src\/(test|it|integrationTest)\//i,
  /\.(test|spec|e2e|stories)\.[^/]+$/i,
  /(Test|Tests|IT|Spec)\.(java|kt|scala|groovy|cs)$/,
  /(^|\/)(docs|features|\.github|\.specgate|\.harness)\//,
  /(^|[/.])(eslint|prettier|vite|vitest|jest|playwright|next|webpack|rollup|tailwind|postcss|babel|tsup)\.config\.[^/]+$/i,
  /(^|\/)build\.gradle(\.kts)?$|(^|\/)settings\.gradle(\.kts)?$/,
];

export function isProductionFile(file: string): boolean {
  const f = file.replace(/\\/g, "/");
  return SOURCE.test(f) && !NOT_PRODUCTION.some((re) => re.test(f));
}

function isTestFile(file: string): boolean {
  const f = file.replace(/\\/g, "/");
  return NOT_PRODUCTION.slice(0, 4).some((re) => re.test(f));
}

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

export function driftSince(projectDir: string, explicitBase = ""): DriftReport {
  const base = baseOf(projectDir, explicitBase);
  if (!base) return { base: "", commits: [] };
  const list = git(projectDir, ["rev-list", "--no-merges", "--reverse", `${base}..HEAD`]);
  if (list.status !== 0) return { base, commits: [] };
  const commits: DriftCommit[] = [];
  for (const sha of (list.stdout || "").split("\n").filter(Boolean)) {
    const message = git(projectDir, ["log", "-1", "--format=%B", sha]).stdout || "";
    if (REQ.test(message)) continue;
    const files = (
      git(projectDir, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha]).stdout ||
      ""
    )
      .split("\n")
      .filter(Boolean);
    const production = files.filter(isProductionFile);
    if (production.length === 0) continue;
    const namedByATest = files.filter(isTestFile).some((f) => {
      const shown = git(projectDir, ["show", `${sha}:${f}`]);
      return shown.status === 0 && REQ.test(shown.stdout || "");
    });
    if (namedByATest) continue;
    commits.push({
      sha: sha.slice(0, 12),
      subject: message.split("\n")[0].trim(),
      files: production,
    });
  }
  return { base, commits };
}

/** One finding per drifting commit; errors when the project gates on drift. */
export function driftFindings(report: DriftReport, gate: boolean): Diagnostic[] {
  const make = gate ? error : warning;
  return report.commits.map((c) =>
    make(
      "spec_drift",
      `${c.sha} "${c.subject}" changes ${c.files.join(", ")} and names no requirement, nor does any test it changes.`,
      {
        target: c.sha,
        fix: 'Name the requirement it serves in the commit and a test, or specify the behaviour first: specgate new "<behaviour>".',
      }
    )
  );
}
