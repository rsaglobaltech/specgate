import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { stepHashes, stepRecordFile } from "../plugin/project-state";
import type { Identity } from "../../packages/core/src/domain/Approvals";

/**
 * shortcut-proof REQ-743: a requirement's step definitions against their
 * record of when its code began. The record is the guard's
 * (`scripts/plugin/project-state.ts`); a project with no hook has none.
 */

export interface StepsVerdict {
  /** Whether something recorded the steps when the code began. */
  recorded: boolean;
  /** Recorded: the step files added or changed since. */
  changed: string[];
  /** Not recorded: the step files new or changed in the working tree. */
  fresh: string[];
}

function record(projectDir: string, requirement: string): Record<string, string> | null {
  try {
    const doc = JSON.parse(fs.readFileSync(stepRecordFile(projectDir, requirement), "utf8"));
    return doc && typeof doc.files === "object" && doc.files ? doc.files : null;
  } catch {
    return null;
  }
}

/** The files under `features/` git sees as new or changed that are not feature files. */
function freshSteps(projectDir: string): string[] {
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "-z", "--", "features"], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (r.status !== 0) return [];
  return (r.stdout || "")
    .split("\0")
    .filter((e) => e.length > 3 && !/^(D |.D)/.test(e))
    .map((e) => e.slice(3))
    .filter((f) => !f.endsWith(".feature"))
    .sort();
}

export function stepsVerdict(projectDir: string, requirement: string): StepsVerdict {
  const was = record(projectDir, requirement);
  if (!was) return { recorded: false, changed: [], fresh: freshSteps(projectDir) };
  const now = stepHashes(projectDir);
  return {
    recorded: true,
    changed: Object.keys(now).filter((f) => was[f] !== now[f]).sort(),
    fresh: [],
  };
}

export const STEPS_FINDING = (requirement: string, files: string[]) =>
  `${files.join(", ")} ${files.length > 1 ? "were" : "was"} added or changed after ${requirement}'s code began: steps written to agree with the code prove nothing.`;

export const STEPS_FIX = (requirement: string) =>
  `Have a person read the steps against the scenarios, then run, in a terminal: specgate apply ${requirement} --steps-reviewed — or put the steps back and make the code pass them.`;

/** The delivery is over: its record with it. */
export function endStepRecord(projectDir: string, requirement: string): void {
  fs.rmSync(stepRecordFile(projectDir, requirement), { force: true });
}

/** Write into the requirement's evidence that a person reviewed these steps (SCN-743c). */
export function keepStepsReview(projectDir: string, requirement: string, by: Identity, files: string[]): void {
  const file = path.join(projectDir, ".specgate", "evidence", requirement, "evidence.json");
  let doc: Record<string, unknown> = { requirement, at: new Date().toISOString() };
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    /* no scenario run kept evidence: this is its first line */
  }
  doc.steps = { reviewed: true, by, at: new Date().toISOString(), files };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}
