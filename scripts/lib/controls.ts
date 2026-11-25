import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import {
  controlsChanged,
  stepLog,
  type ControlRecord,
} from "../../packages/core/src/domain/ControlRecord";
import { guardOff, stepHashes, stepRecordFile } from "../plugin/project-state";

/**
 * outside-judge REQ-747: the controls as they are in a project. Read before the
 * agent starts and when it stops, by the one who judges the run — and kept by
 * them, never written into the project.
 */

const hash = (text: string) => (text ? `sha256:${createHash("sha256").update(text).digest("hex")}` : "");

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function dirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function controlsOf(projectDir: string): ControlRecord {
  const changes = path.join(projectDir, "docs", "specs", "changes");
  const approvals: Record<string, string> = {};
  for (const id of dirs(changes)) {
    if (id === "archive") continue;
    const line = (/^approved:.*$/m.exec(read(path.join(changes, id, "change.yaml"))) || [""])[0];
    approvals[id] = hash(`${read(path.join(changes, id, "approvals.json"))}${line}`);
  }
  const evidenceDir = path.join(projectDir, ".specgate", "evidence");
  const evidence: string[] = [];
  const stepsReviewed: string[] = [];
  for (const req of dirs(evidenceDir)) {
    const text = read(path.join(evidenceDir, req, "evidence.json"));
    if (!text) continue;
    evidence.push(req);
    try {
      if (JSON.parse(text)?.steps?.reviewed) stepsReviewed.push(req);
    } catch {
      /* evidence that cannot be read says nothing of a review */
    }
  }
  return {
    // The switch as the project says it: the judge's own environment is not the agent's.
    guard: guardOff(projectDir, {}) ? "off" : "on",
    policy: hash(read(path.join(projectDir, ".specgate", "gate.yaml"))),
    approvals,
    evidence,
    stepsReviewed,
  };
}

/** What the session changed, against the reading of before it; the hook log's steps, when there is one. */
export function sessionChanged(projectDir: string, before: ControlRecord, hookLogFile?: string): string[] {
  const log = hookLogFile ? stepLog(read(hookLogFile)) : [];
  return controlsChanged(before, controlsOf(projectDir), {
    log,
    now: {
      files: stepHashes(projectDir),
      recorded: log.map((e) => e.requirement).filter((r) => fs.existsSync(stepRecordFile(projectDir, r))),
    },
  });
}
