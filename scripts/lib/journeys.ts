/**
 * The project's journeys, with what their requirements' status and tests say
 * about them (REQ-552). The rules are in `packages/core/src/domain/Journeys.ts`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { readDerivationSources } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import { requirementsIn } from "../../packages/core/src/domain/DerivedMatrix";
import { parseTraceabilityRows } from "../../packages/core/src/domain/TraceabilityFormat";
import {
  journeyFindings,
  journeysIn,
  journeyTests,
  type JourneyFinding,
} from "../../packages/core/src/domain/Journeys";
import { readCapabilityRequirements } from "./capability-specs";
import { error, type Diagnostic } from "./diagnostics";

/** Every requirement the project specifies, with its status. */
function requirementStatus(dir: string, spec: string): Map<string, string> {
  const status = new Map<string, string>();
  for (const r of requirementsIn(spec)) status.set(r.id, r.trace.status || "Draft");
  for (const c of readCapabilityRequirements(dir)) {
    if (c.req.id) status.set(c.req.id, String((c.req.trace || {}).status || "Draft"));
  }
  try {
    const matrix = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    for (const row of parseTraceabilityRows(matrix).rows || []) {
      const r = row as { requirement?: string; status?: string };
      const id = String(r.requirement || "").trim();
      if (/^REQ-\d+$/.test(id) && r.status) {
        // A row's status is the hand-kept matrix's word; a trace's wins where both speak.
        if (!status.has(id) || status.get(id) === "Draft") status.set(id, String(r.status).trim());
      }
    }
  } catch {
    // No readable matrix: the specs decide.
  }
  return status;
}

/** Each journey with its requirements and the tests that name it. */
export function projectJourneys(dir: string) {
  const sources = readDerivationSources(dir);
  const journeys = journeysIn(sources.features);
  return {
    journeys: journeys.map((j) => ({ ...j, tests: journeyTests(j, sources.tests) })),
    findings: (): JourneyFinding[] =>
      journeyFindings(journeys, requirementStatus(dir, sources.spec), sources.tests),
  };
}

/** What `validate --strict` reports about the journeys. */
export function journeyDiagnostics(dir: string): Diagnostic[] {
  return projectJourneys(dir)
    .findings()
    .map((f) =>
      f.code === "journey_untested"
        ? error(
            "journey_untested",
            `${f.journey.id} (${f.journey.title}) crosses ${f.journey.requirements.join(", ")}, all delivered, and no test names it.`,
            {
              file: f.journey.file,
              line: f.journey.line,
              target: f.journey.id,
              fix: `Write a test that walks the journey end to end and names ${f.journey.id}.`,
            }
          )
        : error(
            "journey_requirement_unknown",
            `${f.journey.id} is tagged @${f.requirement}, and no requirement ${f.requirement} exists.`,
            {
              file: f.journey.file,
              line: f.journey.line,
              target: f.requirement,
              fix: `Tag the journey with requirements that exist, or specify ${f.requirement} first.`,
            }
          )
    );
}
