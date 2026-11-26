/**
 * outside-judge REQ-747: what the controls are at one moment, and what a
 * session changed in them. Pure — the reading is `scripts/lib/controls.ts`;
 * the one who compares keeps the first reading where the agent does not write.
 */

export interface ControlRecord {
  /** The guard's switch. */
  guard: "on" | "off";
  /** The gate's policy file, hashed; "" when the project has none. */
  policy: string;
  /** Each open change's approvals, hashed; "" when nobody approved it. */
  approvals: Record<string, string>;
  /** The requirements whose evidence is kept. */
  evidence: string[];
  /** The requirements whose steps the evidence says a person reviewed. */
  stepsReviewed: string[];
  /** sealed-acceptance REQ-760: each sealed acceptance test of the open changes, hashed as it is; "" when gone. */
  acceptance?: Record<string, string>;
}

/** The steps of a requirement as the guard wrote them to the hook log when its code began. */
export interface StepLogEntry {
  requirement: string;
  files: Record<string, string>;
}

export interface StepsNow {
  /** The step files as they are, hashed. */
  files: Record<string, string>;
  /** The requirements whose record is still in the project. */
  recorded: string[];
}

/** The `steps` lines of a hook log: the first of each requirement — the one of when its code began. */
export function stepLog(lines: string): StepLogEntry[] {
  const first = new Map<string, StepLogEntry>();
  for (const line of lines.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && e.hook === "steps" && typeof e.requirement === "string" && e.files && typeof e.files === "object") {
        if (!first.has(e.requirement)) first.set(e.requirement, { requirement: e.requirement, files: e.files });
      }
    } catch {
      /* a line that is not a record is not one */
    }
  }
  return [...first.values()];
}

/** What the session changed in the controls, each in words a person reads; empty when it kept to them. */
export function controlsChanged(
  before: ControlRecord,
  after: ControlRecord,
  steps?: { log: StepLogEntry[]; now: StepsNow }
): string[] {
  const out: string[] = [];
  if (before.guard === "on" && after.guard === "off") out.push("the guard was switched off");
  if (before.policy !== after.policy) out.push("the gate's policy (.specgate/gate.yaml) changed");
  for (const id of Object.keys(after.approvals).sort()) {
    if ((before.approvals[id] ?? "") !== after.approvals[id]) out.push(`the approval of ${id} changed`);
  }
  for (const id of Object.keys(before.approvals).sort()) {
    if (!(id in after.approvals) && before.approvals[id]) out.push(`the approval of ${id} is gone`);
  }
  for (const req of before.evidence) {
    if (!after.evidence.includes(req)) out.push(`the evidence of ${req} was removed`);
  }
  for (const req of after.stepsReviewed) {
    if (!before.stepsReviewed.includes(req)) out.push(`the steps of ${req} were said to be reviewed`);
  }
  // sealed-acceptance REQ-760: a sealed test is the contract — changed by any road, it is named.
  const tests = before.acceptance ?? {};
  for (const file of Object.keys(tests).sort()) {
    const now = after.acceptance?.[file];
    if (now === undefined || now === tests[file]) continue;
    out.push(now ? `the acceptance test ${file} changed` : `the acceptance test ${file} is gone`);
  }
  for (const entry of steps?.log ?? []) {
    const now = steps!.now;
    if (now.recorded.includes(entry.requirement)) continue;
    const changed = Object.keys(now.files).filter((f) => entry.files[f] !== now.files[f]).sort();
    if (changed.length)
      out.push(
        `the steps of ${entry.requirement} changed after its code began and their record was removed (${changed.join(", ")})`
      );
  }
  return out;
}

export const CONTROLS_CODE = "controls_changed_by_session";

/** The finding's sentence. */
export function controlsFinding(changed: string[]): string {
  return `The session changed Specgate's controls: ${changed.join("; ")}. A run is judged by the controls as they were when it began.`;
}
