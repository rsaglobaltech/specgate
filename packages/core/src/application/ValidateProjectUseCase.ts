import { ValidationReport } from "../domain/ValidationReport";
import { ITraceabilityRepository } from "./ports/ITraceabilityRepository";
import { requirementSections } from "../domain/SpecSections";
import { isDerivedMatrix } from "../domain/DerivedMatrix";
import {
  ALLOWED_STATUS,
  LEGACY_HEADER,
  POST_DRAFT_STATUS,
  RICH_HEADER,
  TraceabilityMode,
  detectTraceabilityMode,
  parseMatrixRows,
  readRowFields,
} from "../domain/TraceabilityFormat";

export interface ValidateProjectOptions {
  strictTdd?: boolean;
  /** `spec.md`, needed only by the strict-TDD check that every REQ it names has a row. */
  specContent?: string | null;
  /**
   * The requirement `done` is about to close (`validate --delivering`). Its row
   * still says Draft while the gate runs, so without this the TDD rules let
   * `done` approve what the next `check` refused.
   */
  delivering?: string;
}

export interface ValidateMatrixResult {
  report: ValidationReport;
  /** The matrix shape that was found, so callers can branch on it as before. */
  mode: TraceabilityMode | null;
  /** Every requirement id the matrix carries a row for. */
  requirements: Set<string>;
}

/**
 * Everything `validate` checks about the traceability matrix itself.
 *
 * The file checks around it — required files, unresolved placeholders, feature
 * files, the monorepo fan-out — stay with the command, because they are about
 * a project's layout on disk rather than about the matrix. What lives here is
 * the part that is pure judgement over the matrix's contents, and it is the
 * only copy: the command renders these findings rather than repeating them.
 *
 * Findings come back in the order the checks run, so a caller that stops at the
 * first error reports the same one the old inline loop did.
 */
export class ValidateProjectUseCase {
  constructor(private traceRepo: ITraceabilityRepository) {}

  public execute(projectDir: string, opts: ValidateProjectOptions = {}): ValidateMatrixResult {
    const traceContent = this.traceRepo.readTraceability(projectDir);
    const report = new ValidationReport();

    if (traceContent === null) {
      report.addError(
        "traceability_missing",
        `docs/specs/traceability.md not found in ${projectDir}`,
        {
          file: "docs/specs/traceability.md",
          fixLines: ["Run `specgate init` to scaffold the project structure."],
        }
      );
      return { report, mode: null, requirements: new Set() };
    }

    return this.checkMatrix(traceContent, opts);
  }

  /** The same checks against content the caller already has in hand. */
  public checkMatrix(
    traceContent: string,
    opts: ValidateProjectOptions = {}
  ): ValidateMatrixResult {
    const report = new ValidationReport();
    const requirements = new Set<string>();
    const mode = detectTraceabilityMode(traceContent);

    if (mode === null) {
      report.addError(
        "traceability_header_missing",
        "traceability.md is missing the expected legacy or rich matrix header",
        {
          file: "docs/specs/traceability.md",
          fixLines: [
            "Add the rich matrix header (recommended) to docs/specs/traceability.md:",
            `  ${RICH_HEADER}`,
          ],
        }
      );
      return { report, mode, requirements };
    }

    const strictTdd = opts.strictTdd === true;
    const seenScenarios = new Set<string>();
    const derived = isDerivedMatrix(traceContent);
    // Requirement id → whether one of its rows had no scenario id.
    const seenRequirements = new Map<string, boolean>();

    for (const cells of parseMatrixRows(traceContent)) {
      const { requirementId, scenarioId, testArtifact, status } = readRowFields(cells, mode);

      // A requirement id is the primary key of this table: `done`, `req link`
      // and `plan` all address a row by it, and every writer allocates a fresh
      // one. Two rows under one id is not a broken link, it is a broken table —
      // `req link REQ-003` then writes *both*, so one requirement's test
      // artifact silently becomes another's, and the matrix asserts a proof
      // that was never run. Three cold adoptions reached that state through the
      // tool's own commands while every gate stayed green.
      //
      // On a generated matrix the rows come from spec.md, so a requirement
      // with several scenarios legitimately has a row per scenario, each
      // addressable by its unique scenario id. Refusing every repeat there made
      // any requirement with two scenarios fail the gate. A hand-kept matrix
      // keeps the strict rule: there, two rows under one id cannot be told
      // apart from two requirements that collided.
      const hasScenario = derived && Boolean(scenarioId && scenarioId !== "-");
      if (requirementId && requirementId !== "-") {
        if (
          seenRequirements.has(requirementId) &&
          (!hasScenario || seenRequirements.get(requirementId))
        ) {
          report.addError(
            "duplicate_requirement_id",
            `Duplicate Requirement ID in traceability.md: ${requirementId}`,
            {
              target: requirementId,
              fixLines: [
                "A requirement id addresses exactly one row — `req link` and `done` write every",
                `row that matches, so two ${requirementId} rows corrupt each other.`,
                "Renumber the later row to the next free id, or delete it if it is a leftover",
                "proposal from `adopt` that you have since replaced.",
              ],
            }
          );
        }
        seenRequirements.set(
          requirementId,
          Boolean(seenRequirements.get(requirementId)) || !hasScenario
        );
      }

      if (requirementId) requirements.add(requirementId);

      if (scenarioId && scenarioId !== "-") {
        if (seenScenarios.has(scenarioId)) {
          report.addError(
            "duplicate_scenario_id",
            `Duplicate Scenario ID in traceability.md: ${scenarioId}`,
            {
              target: scenarioId,
              fixLines: [
                "Every Scenario ID must be unique across the matrix — renumber one of the rows",
                `(e.g. keep ${scenarioId} on the first row and give the second a new ID).`,
              ],
            }
          );
        }
        seenScenarios.add(scenarioId);
      }

      if (status && !ALLOWED_STATUS.has(status)) {
        report.addError("invalid_status", `Invalid status in traceability.md: ${status}`, {
          target: status,
          fixLines: [
            `Allowed statuses: ${[...ALLOWED_STATUS].join(" · ")}`,
            "Use `specgate done <REQ-id>` to flip a row to Implemented safely.",
          ],
        });
      }

      if (!strictTdd) continue;

      // `Deprecated` owes nothing: its files may be gone on purpose, and
      // `req rm` past Draft points at Deprecated — a TDD-1 here made the
      // advice a loop. `Needs Clarification` owes nothing yet either: it is
      // waiting on a question, and the harness refuses it until it is
      // answered. Demanding its test turned a draft that asked instead of
      // guessing into a red gate (credito-tienda, #59).
      const judged =
        opts.delivering && requirementId === opts.delivering && status === "Draft"
          ? "Implemented"
          : status;
      const owesTdd =
        judged &&
        POST_DRAFT_STATUS.has(judged) &&
        judged !== "Deprecated" &&
        judged !== "Needs Clarification";
      if (testArtifact.toUpperCase() === "TBD" && owesTdd) {
        report.addError(
          "strict_tdd_violation",
          `[TDD-1] Test artifact is TBD but status is '${judged}' (scenario: ${scenarioId || "(no id)"})`,
          { target: "TDD-1" }
        );
      }

      if (mode === "rich" && !scenarioId && owesTdd) {
        report.addError(
          "strict_tdd_violation",
          `[TDD-2] Traceability row missing Scenario ID with status '${judged}' (requirement: ${requirementId || "(none)"})`,
          { target: "TDD-2" }
        );
      }
    }

    if (strictTdd && mode === "rich" && typeof opts.specContent === "string") {
      for (const reqId of new Set(opts.specContent.match(/\bREQ-\d+\b/g) || [])) {
        if (!requirements.has(reqId)) {
          report.addError(
            "strict_tdd_violation",
            `[TDD-3] Requirement ${reqId} found in spec.md but has no row in traceability.md`,
            { target: "TDD-3" }
          );
        }
      }

      // The other direction. `req add` used to write a matrix row and no
      // prose, so a requirement could exist as a table entry with no text
      // anywhere — and the harness prompt then asked an agent to implement
      // something the prompt could not describe.
      //
      // A mention in prose is not a section: TDD-3 above matches `REQ-014`
      // wherever it appears, which is right for "is this row missing", and
      // wrong here. This asks for a `## REQ-014` heading.
      const declared = new Set(requirementSections(opts.specContent));
      for (const reqId of requirements) {
        // Same scope as TDD-3 above: `REQ-` ids only. A matrix may also carry
        // `NFR-` rows, which live in their own section of spec.md and are not
        // what the harness prompt asks an agent to implement.
        if (!/^REQ-\d+/.test(reqId)) continue;
        if (declared.has(reqId)) continue;
        // A warning, not an error, and deliberately so. ADR-0026 commits to the
        // 0.9 line warning about checks that become mandatory in 1.0, because a
        // green-to-red flip in a minor release is how a tool gets removed from
        // a pipeline. Every project whose matrix predates `req add` writing
        // prose would go red on upgrade over text nobody asked them for.
        report.addWarning(
          "requirement_without_prose",
          `${reqId} has a row in traceability.md but no requirement text in spec.md. ` +
            `This becomes an error in 1.0 (ADR-0026).`,
          {
            target: reqId,
            file: "spec.md",
            fix:
              `Write its prose — \`specgate new\` does it for a new one, and \`## ${reqId} — ` +
              `<title>\` by hand works too. Until then the harness prompt cannot tell an ` +
              `agent what ${reqId} requires.`,
          }
        );
      }
    }

    return { report, mode, requirements };
  }
}

export { LEGACY_HEADER, RICH_HEADER, ALLOWED_STATUS, POST_DRAFT_STATUS };
