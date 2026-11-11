/**
 * The project's line coverage for `report --format json` and the API (REQ-499).
 *
 * Read, never measured here: the report the project's coverage tool already
 * wrote — the one a quality check names in `report:`, else the newest of the
 * places c8, nyc, vitest, jest, coverage.py and JaCoCo write by default. No
 * report, or one that measures no line, is `null` with the way to get one:
 * never 0 for something nothing measured.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  totalLineCoverage,
  type CoverageTool,
} from "../../packages/core/src/domain/ChangeMeasures";
import { readHarnessConfig } from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { info } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import { detectStacks } from "./quality-presets";

export interface LineCoverageAnswer {
  percent: number;
  covered: number;
  total: number;
  tool: CoverageTool;
  /** The report it was read from, relative to the project, with forward slashes. */
  file: string;
  /** When that report was written, ISO 8601. */
  measuredAt: string;
}

/** Where each tool writes its report when nobody says otherwise. */
export const STANDARD_REPORTS: ReadonlyArray<{ file: string; tool: CoverageTool }> = [
  { file: "coverage/lcov.info", tool: "lcov" },
  { file: "coverage/coverage-summary.json", tool: "istanbul" },
  { file: "coverage/cobertura-coverage.xml", tool: "cobertura" },
  { file: "coverage.xml", tool: "cobertura" },
  { file: "target/site/jacoco/jacoco.xml", tool: "jacoco" },
  { file: "build/reports/jacoco/test/jacocoTestReport.xml", tool: "jacoco" },
];

/** The coverage reports the quality checks name, in the file's order. */
function configuredReports(projectDir: string): Array<{ file: string; tool: CoverageTool }> {
  try {
    const checks = readHarnessConfig(projectDir)?.quality?.checks || [];
    return checks
      .map((c) => c.report)
      .filter(
        (r): r is NonNullable<typeof r> =>
          !!r && (r.format === "lcov" || r.format === "cobertura" || r.format === "jacoco")
      )
      .map((r) => ({ file: r.path.replace(/\\/g, "/"), tool: r.format as CoverageTool }));
  } catch {
    return [];
  }
}

function read(projectDir: string, candidate: { file: string; tool: CoverageTool }) {
  const abs = path.join(projectDir, ...candidate.file.split("/"));
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return null;
    const measure = totalLineCoverage(candidate.tool, fs.readFileSync(abs, "utf8"));
    if (!measure) return null;
    return { ...measure, ...candidate, measuredAt: stat.mtime.toISOString(), mtime: stat.mtimeMs };
  } catch {
    return null;
  }
}

/** How this project's stack writes a coverage report. */
function howToMeasure(projectDir: string): string {
  const stacks = detectStacks(projectDir);
  if (stacks.includes("maven")) {
    return "Add the jacoco-maven-plugin with its `prepare-agent` and `report` goals; `mvn verify` then writes target/site/jacoco/jacoco.xml.";
  }
  if (stacks.includes("gradle")) {
    return "Apply the `jacoco` plugin and run `gradle test jacocoTestReport` with its XML report on; it writes build/reports/jacoco/test/jacocoTestReport.xml.";
  }
  if (stacks.includes("node")) {
    return "Run the tests under c8 so they write coverage/lcov.info: `npx c8 --reporter=lcov --reporter=text npm test` (nyc, vitest --coverage and jest --coverage write it too).";
  }
  return "Have the test tool write an LCOV, Cobertura or JaCoCo report, and name it in a quality check's `report:` (format:path) in harness.config.yaml.";
}

/** The project's line coverage, or null and the finding that says how to measure it. */
export function projectLineCoverage(projectDir: string): {
  lines: LineCoverageAnswer | null;
  status: Diagnostic[];
} {
  for (const c of configuredReports(projectDir)) {
    const m = read(projectDir, c);
    if (m) return { lines: answer(m), status: [] };
  }
  const found = STANDARD_REPORTS.map((c) => read(projectDir, c))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.mtime - a.mtime);
  if (found.length > 0) return { lines: answer(found[0]), status: [] };
  return {
    lines: null,
    status: [
      info("coverage_not_measured", "No coverage report measures this project's lines.", {
        fix: howToMeasure(projectDir),
      }),
    ],
  };
}

function answer(m: LineCoverageAnswer & { mtime: number }): LineCoverageAnswer {
  const { mtime: _mtime, ...rest } = m;
  return {
    percent: rest.percent,
    covered: rest.covered,
    total: rest.total,
    tool: rest.tool,
    file: rest.file,
    measuredAt: rest.measuredAt,
  };
}
