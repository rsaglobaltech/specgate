import * as fs from "node:fs";
import * as path from "node:path";
import { questionTable } from "../../packages/core/src/domain/Clarification";
import { draftReport } from "../cli/commands/spec/DraftCommand";

/**
 * A person's review of a draft change (REQ-206, REQ-207): approving it, which
 * Build waits for, and asking for a change in their own words.
 */

const CHANGES = path.join("docs", "specs", "changes");

function changeDir(projectDir: string, id: string): string {
  return path.join(projectDir, CHANGES, id);
}

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/** When a person approved the change, or "" when nobody has. */
export function approvedOn(projectDir: string, id: string): string {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  return (/^approved:\s*(\S+)/m.exec(yaml) || [])[1] || "";
}

/** What clears a blocker: answer a question, confirm the spec says its answer, or open a requirement (REQ-206). */
export interface BlockerAction {
  kind: "answer" | "confirm" | "open";
  question?: string;
  requirement?: string;
}

export interface Blocker {
  code: string;
  message: string;
  action?: BlockerAction;
}

/** Does a message name this question — `Q1`, and not `Q10`? */
const names = (message: string, id: string) =>
  new RegExp(`(^|[^A-Za-z0-9])${id}(?![A-Za-z0-9])`).test(message);

/** What stops a change from being approved: checklist errors and open questions, each with its action. */
export function approvalBlockers(projectDir: string, id: string): Blocker[] {
  const out: Blocker[] = [];
  const questionsMd = read(path.join(changeDir(projectDir, id), "questions.md"));
  const questions = questionsMd ? questionTable(questionsMd) : [];
  const actionFor = (code: string, message: string): BlockerAction | undefined => {
    const q = questions.find((x) => names(message, x.id));
    if (q && code === "D7_answered_still_blocked") return { kind: "confirm", question: q.id };
    if (q && !q.answered) return { kind: "answer", question: q.id };
    const req = (/REQ-[A-Za-z0-9.]+/.exec(message) || [])[0];
    return req ? { kind: "open", requirement: req } : undefined;
  };
  const r = draftReport(projectDir, id);
  if ("failure" in r) {
    out.push({ code: r.failure.code, message: r.failure.message });
  } else {
    for (const d of r.report.status) {
      if (d.severity !== "error") continue;
      out.push({ code: d.code, message: d.message, action: actionFor(d.code, d.message) });
    }
  }
  for (const q of questions) {
    if (!q.answered && !out.some((b) => names(b.message, q.id))) {
      out.push({
        code: "approve_question_open",
        message: `${q.id} is open: ${q.text}`,
        action: { kind: "answer", question: q.id },
      });
    }
  }
  return out;
}

export type ApproveOutcome =
  | { ok: true; change: string; approved: string }
  | { ok: false; code: string; message: string; blockers?: Blocker[] };

/** Record that a person approved the change (REQ-206). */
export function approveChange(projectDir: string, id: string, today: string): ApproveOutcome {
  const file = path.join(changeDir(projectDir, id), "change.yaml");
  if (!fs.existsSync(changeDir(projectDir, id))) {
    return { ok: false, code: "change_not_found", message: `No open change ${id}.` };
  }
  const blockers = approvalBlockers(projectDir, id);
  if (blockers.length) {
    return {
      ok: false,
      code: "approve_blocked",
      message: `${id} cannot be approved yet: ${blockers.map((b) => b.message).join("; ")}`,
      blockers,
    };
  }
  const yaml = read(file) || "";
  const next = /^approved:/m.test(yaml)
    ? yaml.replace(/^approved:.*$/m, `approved: ${today}`)
    : `${yaml.replace(/\n*$/, "\n")}approved: ${today}\n`;
  fs.writeFileSync(file, next, "utf8");
  return { ok: true, change: id, approved: today };
}

export interface ReviewNote {
  date: string;
  requirement: string;
  text: string;
}

const NOTES_HEADER = "| Date | Requirement | Request |";

function cell(text: string): string {
  return String(text).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

/** The change's review notes. */
export function reviewNotes(projectDir: string, id: string): ReviewNote[] {
  const md = read(path.join(changeDir(projectDir, id), "review.md")) || "";
  return md
    .split(/\r?\n/)
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l))
    .map((l) => {
      const c = l
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((x) => x.trim());
      return {
        date: c[0],
        requirement: c[1] === "—" ? "" : c[1],
        text: (c[2] || "").replace(/\\\|/g, "|"),
      };
    });
}

/** Ask the draft for a change in your own words (REQ-207). */
export function noteChange(
  projectDir: string,
  id: string,
  text: string,
  requirement: string,
  today: string
): { ok: true; change: string; notes: number } | { ok: false; code: string; message: string } {
  if (!fs.existsSync(changeDir(projectDir, id))) {
    return { ok: false, code: "change_not_found", message: `No open change ${id}.` };
  }
  if (!text.trim()) return { ok: false, code: "note_empty", message: "The request is empty." };
  const file = path.join(changeDir(projectDir, id), "review.md");
  const md =
    read(file) ||
    `# Review — ${id}\n\nWhat the person reviewing this draft asked to change.\n\n${NOTES_HEADER}\n|---|---|---|\n`;
  const row = `| ${today} | ${requirement || "—"} | ${cell(text)} |`;
  fs.writeFileSync(file, `${md.replace(/\n*$/, "\n")}${row}\n`, "utf8");
  return { ok: true, change: id, notes: reviewNotes(projectDir, id).length };
}
