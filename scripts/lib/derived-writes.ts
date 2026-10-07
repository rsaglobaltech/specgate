import * as fs from "node:fs";
import * as path from "node:path";
import {
  deriveRows,
  isDerivedMatrix,
  setTraceFields,
} from "../../packages/core/src/domain/DerivedMatrix";
import { readDerivationSources } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import { refreshDerivedMatrix } from "../cli/commands/spec/MatrixCommand";

/**
 * Writing a derived project's sources instead of its matrix (phase 3B).
 *
 * On a project whose matrix is generated, a command that edited a row would
 * see its edit overwritten by the next regeneration. Status and explicit links
 * go into the requirement's `csda:trace` comment in `spec.md` — their one
 * owner — and the matrix is regenerated from there.
 */

const MATRIX = path.join("docs", "specs", "traceability.md");

export function isDerivedProject(projectDir: string): boolean {
  const file = path.join(projectDir, MATRIX);
  return fs.existsSync(file) && isDerivedMatrix(fs.readFileSync(file, "utf8"));
}

/** Matrix field name (as `req link` and the use cases spell it) → trace key. */
const TRACE_KEY: Record<string, string> = {
  featureFile: "feature",
  scenarioId: "scn",
  useCase: "uc",
  command: "cmd",
  commandOrQuery: "cmd",
  aggregate: "agg",
  event: "evt",
  technicalArtifact: "artifact",
  testArtifact: "test",
  status: "status",
};

/**
 * Set fields on a requirement in `spec.md` and regenerate the matrix.
 * Returns the number of matrix rows the requirement now has, or `null` when
 * `spec.md` has no section for it.
 */
export function writeRequirementFields(
  projectDir: string,
  reqId: string,
  fields: Record<string, string>
): number | null {
  const trace: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = TRACE_KEY[k] || k;
    trace[key] = String(v).replace(/`/g, "").trim();
  }
  // spec.md first; then the capability specs `change archive` writes into,
  // where an archived requirement lives — `done` refused those with "no
  // section in spec.md" and pointed at `req add`.
  const candidates = [path.join(projectDir, "spec.md")];
  const capDir = path.join(projectDir, "docs", "specs", "capabilities");
  if (fs.existsSync(capDir)) {
    for (const d of fs.readdirSync(capDir).sort()) candidates.push(path.join(capDir, d, "spec.md"));
  }
  let written = false;
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const next = setTraceFields(fs.readFileSync(file, "utf8"), reqId, trace);
    if (next === null) continue;
    fs.writeFileSync(file, next, "utf8");
    written = true;
    break;
  }
  if (!written) return null;
  refreshDerivedMatrix(projectDir);
  return deriveRows(readDerivationSources(projectDir)).filter((r) => r.requirement === reqId)
    .length;
}
