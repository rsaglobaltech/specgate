/**
 * The stages of `specgate check`, as every `--json` answer lists them (REQ-503).
 *
 * A failed gate used to answer with the failing stage's code alone: not the
 * stages that passed before it, not validate's own findings. specgate-studio's
 * Report view shows the whole gate, so each stage is planned up front — `not
 * run` — and set as the gate reaches it.
 */

import type { Diagnostic } from "./diagnostics";
import { progress } from "./progress";

export type StageName =
  | "ids"
  | "changes"
  | "validate"
  | "architecture"
  | "tests"
  | "scenarios"
  | "acceptance"
  | "quality";
export type StageResult = "passed" | "failed" | "skipped" | "not run";

export interface GateStage {
  stage: StageName;
  /** The quality check's name, for a `quality` stage. */
  name?: string;
  /** Whether a failed quality check fails the gate. */
  gate?: boolean;
  command: string | null;
  result: StageResult;
  /** How long it took, in milliseconds; null for a stage that did not run (REQ-519). */
  ms: number | null;
  findings: Diagnostic[];
}

/** The gate's stages in the order it runs them, each `not run` until it is. */
export class GateStages {
  private readonly stages: GateStage[];

  constructor(plan: {
    archCmd: string | null;
    testCmd: string | null;
    checks: ReadonlyArray<{ name: string; run: string; gate: boolean }>;
    /** gate-runs-scenarios REQ-734: the command that runs the feature files, in a project whose gate requires them. */
    scenariosCmd?: string | null;
    /** sealed-acceptance REQ-759: an open change sealed its acceptance tests. */
    acceptance?: boolean;
  }) {
    const stage = (s: StageName, command: string | null, extra: Partial<GateStage> = {}) => ({
      stage: s,
      ...extra,
      command,
      result: "not run" as StageResult,
      ms: null as number | null,
      findings: [] as Diagnostic[],
    });
    this.stages = [
      stage("ids", null),
      stage("changes", null),
      stage("validate", "specgate validate --strict"),
      stage("architecture", plan.archCmd),
      stage("tests", plan.testCmd),
      ...(plan.scenariosCmd ? [stage("scenarios", plan.scenariosCmd)] : []),
      // sealed-acceptance REQ-759: only where an open change sealed its acceptance tests.
      ...(plan.acceptance ? [stage("acceptance", null)] : []),
      ...plan.checks.map((c) => stage("quality", c.run, { name: c.name, gate: c.gate })),
    ];
  }

  /** Set how a stage ended, and what it found. */
  set(
    stage: StageName,
    result: StageResult,
    findings: Diagnostic[] = [],
    extra: { name?: string; command?: string | null; ms?: number | null } = {}
  ): void {
    const s = this.stages.find(
      (x) => x.stage === stage && (extra.name === undefined || x.name === extra.name)
    );
    if (!s) return;
    // REQ-654: how a stage ended, for a studio following the gate.
    if (result !== "not run")
      progress({
        stage: s.stage,
        ...(s.name ? { name: s.name } : {}),
        state: result === "skipped" ? "skipped" : result,
      });
    s.result = result;
    s.findings = findings;
    if (extra.command !== undefined) s.command = extra.command;
    if (extra.ms !== undefined) s.ms = extra.ms === null ? null : Math.round(extra.ms);
  }

  /** Every stage, as `--json` prints it. */
  list(): GateStage[] {
    return this.stages.map((s) => ({ ...s, findings: [...s.findings] }));
  }
}

/**
 * The findings `specgate validate --json` printed, or none when its output is
 * not that document.
 */
export function validateFindings(stdout: string): Diagnostic[] {
  const at = String(stdout || "").indexOf("{");
  if (at < 0) return [];
  try {
    const doc = JSON.parse(stdout.slice(at)) as { status?: unknown };
    return Array.isArray(doc.status) ? (doc.status as Diagnostic[]) : [];
  } catch {
    return [];
  }
}
