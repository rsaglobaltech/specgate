/**
 * Is this requirement fit to hand to an agent? (B2)
 *
 * ## The attempt with the worst cost/result ratio in the loop
 *
 * `plan` already classifies `NEEDS_FEATURE` and `NEEDS_EVERYTHING`, and
 * `harness run` never used it as a filter. A requirement whose feature does not
 * exist and whose row declares no artifacts is handed over exactly like any
 * other, and the agent discovers halfway through that it has to invent the
 * acceptance criterion — then spends up to `max_attempts` × the timeout on it.
 *
 * What this buys is not a new rule. It is that "is this ready for an agent?"
 * stops being the intuition of whoever typed the command and becomes something
 * calculated, with a fix attached to each answer.
 *
 * ## Blocking versus warning
 *
 * A blocker means the agent cannot succeed, not that the requirement is untidy:
 *
 * - **no feature file** — there is no acceptance criterion to satisfy;
 * - **a scenario the gate cannot fail** — the reward signal is counterfeit
 *   (H14), so a green run would prove nothing;
 * - **dependencies not green** — the work it builds on is not there;
 * - **`Deprecated`** — nobody wants it built;
 * - **`Needs Clarification`** — its meaning is disputed, and an agent asked to
 *   settle a disagreement will settle it by guessing.
 *
 * Undeclared artifacts only warn. The row being vague about *where* the work
 * goes does not stop the work, and `A2` already reports it against the diff
 * afterwards, which is the moment there is evidence to report.
 *
 * ## Why no I/O here
 *
 * Whether a file exists and what its scenarios say are facts the caller
 * gathers; whether those facts add up to "ready" is a rule. Keeping them apart
 * is what lets every case below be tested without a project on disk.
 */

import type { Diagnostic } from "./Diagnostic";
import { error, warning } from "./Diagnostic";

export const READINESS_CODES = Object.freeze({
  NO_FEATURE: "requirement_has_no_feature",
  UNRUNNABLE_SCENARIO: "requirement_scenario_unrunnable",
  BLOCKED_BY: "requirement_blocked_by_dependency",
  NOT_WANTED: "requirement_not_wanted",
  NEEDS_CLARIFICATION: "requirement_needs_clarification",
  NO_TEST_ARTIFACT: "requirement_declares_no_test_artifact",
  NO_TECHNICAL_ARTIFACT: "requirement_declares_no_technical_artifact",
});

/** Statuses that mean an agent should not be pointed at this row. */
export const UNBUILDABLE_STATUS: Readonly<Record<string, string>> = Object.freeze({
  Deprecated: READINESS_CODES.NOT_WANTED,
  "Needs Clarification": READINESS_CODES.NEEDS_CLARIFICATION,
});

export interface ReadinessInput {
  readonly requirement: string;
  readonly status?: string;
  readonly featureFile?: string;
  readonly featureExists?: boolean;
  /**
   * What the scenario-quality rules said about the feature (A3). Only errors
   * matter here: a thin scenario is weak, an empty one cannot fail.
   */
  readonly scenarioFindings?: readonly Diagnostic[];
  /** Requirements this one needs, that are not green yet (B1). */
  readonly blockedBy?: readonly string[];
  readonly technicalDeclared?: boolean;
  readonly testDeclared?: boolean;
  /**
   * The matrix is generated: a test or a source file that names the
   * requirement *is* the link, wherever it lands, so an undeclared path is
   * not a gap.
   */
  readonly derived?: boolean;
}

export interface Readiness {
  /** No blocker of error severity. Warnings do not make a requirement unready. */
  readonly ready: boolean;
  readonly blockers: Diagnostic[];
}

export function requirementReadiness(input: ReadinessInput): Readiness {
  const target = input.requirement;
  const blockers: Diagnostic[] = [];

  const unbuildable = UNBUILDABLE_STATUS[String(input.status || "")];
  if (unbuildable) {
    blockers.push(
      error(
        unbuildable,
        unbuildable === READINESS_CODES.NOT_WANTED
          ? `status is ${input.status} — nobody wants this built.`
          : `status is ${input.status} — its meaning is still disputed, and an agent ` +
              `asked to settle a disagreement will settle it by guessing.`,
        {
          target,
          fix:
            unbuildable === READINESS_CODES.NOT_WANTED
              ? "Drop it from the run, or move the row out of Deprecated."
              : "Settle the question with the people who raised it, then set the status.",
        }
      )
    );
  }

  if (!input.featureExists) {
    blockers.push(
      error(
        READINESS_CODES.NO_FEATURE,
        input.featureFile
          ? `its feature file ${input.featureFile} does not exist, so there is no ` +
              `acceptance criterion to satisfy.`
          : "the row declares no feature file, so there is no acceptance criterion to satisfy.",
        {
          target,
          fix: `Write the scenario first: \`specgate req link ${target} --feature <path>\`.`,
        }
      )
    );
  }

  // Only errors. A scenario Cucumber sees as empty passes without running
  // anything, so a green gate on it would mean nothing (H14).
  const unrunnable = (input.scenarioFindings || []).filter((f) => f.severity === "error");
  if (unrunnable.length > 0) {
    blockers.push(
      error(
        READINESS_CODES.UNRUNNABLE_SCENARIO,
        `its scenario would pass without testing anything (${unrunnable.length} error(s)), ` +
          `so the gate could not tell success from failure.`,
        {
          target,
          fix: "Run `specgate validate <dir> --strict-scenarios` to see them, and fix them first.",
        }
      )
    );
  }

  const blocked = input.blockedBy || [];
  if (blocked.length > 0) {
    blockers.push(
      error(
        READINESS_CODES.BLOCKED_BY,
        `it depends on ${blocked.join(", ")}, which ${blocked.length === 1 ? "is" : "are"} not done.`,
        {
          target,
          fix: `Run ${blocked.join(", ")} first — \`specgate harness run\` orders them for you.`,
        }
      )
    );
  }

  // Warnings, not blockers: a vague row does not stop the work, and A2 reports
  // the same gap against the actual diff afterwards — the moment there is
  // evidence rather than an expectation.
  //
  // These are not the noise trap A2 had to avoid. `TBD` in the test column is
  // not a false positive; it is an accurate statement about an incomplete row,
  // and TDD says that column is what should be filled in first.
  if (!input.testDeclared && !input.derived) {
    blockers.push(
      warning(
        READINESS_CODES.NO_TEST_ARTIFACT,
        "the row declares no test artifact, so the agent chooses where the test " +
          "goes and the matrix will point somewhere else.",
        { target, fix: `specgate req link ${target} --test <path>` }
      )
    );
  }
  if (!input.technicalDeclared && !input.derived) {
    blockers.push(
      warning(
        READINESS_CODES.NO_TECHNICAL_ARTIFACT,
        "the row declares no production artifact, so the agent chooses where the " +
          "implementation goes and the matrix will point somewhere else.",
        { target, fix: `specgate req link ${target} --code <path>` }
      )
    );
  }

  return { ready: !blockers.some((b) => b.severity === "error"), blockers };
}
