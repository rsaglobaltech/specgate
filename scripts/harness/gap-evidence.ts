/**
 * What in a project says a requirement changed after review (REQ-301).
 *
 * The suggestion `harness report` makes for intent → spec reads three things a
 * person leaves when the spec missed part of the use case: an answered
 * question that blocked the requirement, a review note naming it
 * (`change note`, REQ-207), and a change that modifies it. Read-only.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { answeredQuestions } from "../../packages/core/src/domain/DraftChecklist";
import type { GapMark, IntentEvidence } from "../../packages/core/src/domain/HarnessGaps";
import { parseGapMarks } from "../../packages/core/src/domain/HarnessGaps";

/** Where a person's classifications are kept, beside the false-failure marks. */
export const GAPS_FILE = ".harness/gaps.jsonl";

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function dirs(parent: string): string[] {
  try {
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function specFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of (() => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  })()) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...specFiles(full));
    else if (e.name === "spec.md") out.push(full);
  }
  return out;
}

/** The requirements a delta's `## MODIFIED Requirements` section names. */
export function modifiedRequirements(md: string): string[] {
  const out: string[] = [];
  let inModified = false;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (/^##\s+/.test(line)) inModified = /^##\s+MODIFIED\b/i.test(line);
    const req = inModified && /^###\s+Requirement:\s*(REQ-\d+)/.exec(line);
    if (req) out.push(req[1]);
  }
  return out;
}

/** Every change folder, open and archived, with the name to cite it by. */
function changeFolders(projectDir: string): Array<{ id: string; dir: string }> {
  const changes = path.join(projectDir, "docs", "specs", "changes");
  const archive = path.join(changes, "archive");
  return [
    ...dirs(changes)
      .filter((d) => d !== "archive")
      .map((id) => ({ id, dir: path.join(changes, id) })),
    ...dirs(archive).map((id) => ({ id, dir: path.join(archive, id) })),
  ];
}

export function intentEvidence(projectDir: string): IntentEvidence[] {
  const out: IntentEvidence[] = [];
  const folders = [
    ...changeFolders(projectDir),
    { id: "the project", dir: path.join(projectDir, "docs", "specs") },
  ];
  for (const { id, dir } of folders) {
    for (const q of answeredQuestions(read(path.join(dir, "questions.md")))) {
      for (const requirement of q.blocks)
        out.push({ requirement, why: `${q.row} answered in ${id}` });
    }
    for (const m of read(path.join(dir, "review.md")).matchAll(
      /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(REQ-\d+)\s*\|/gm
    )) {
      out.push({ requirement: m[2], why: `review note in ${id}`, at: m[1] });
    }
    if (id === "the project") continue;
    for (const file of specFiles(path.join(dir, "specs"))) {
      for (const requirement of modifiedRequirements(read(file))) {
        out.push({ requirement, why: `modified by ${id}` });
      }
    }
  }
  return out;
}

export function readGapMarks(projectDir: string): GapMark[] {
  return parseGapMarks(read(path.join(projectDir, ...GAPS_FILE.split("/"))));
}

/** Append one classification; append-only, as the false-failure marks are. */
export function appendGapMark(projectDir: string, mark: GapMark): void {
  const file = path.join(projectDir, ...GAPS_FILE.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(mark)}\n`, "utf8");
}
