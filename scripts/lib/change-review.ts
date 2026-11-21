import * as fs from "node:fs";
import * as path from "node:path";
import { namedBy, questionTable } from "../../packages/core/src/domain/Clarification";
import { draftReport } from "../cli/commands/spec/DraftCommand";
import type { LayerId } from "../../packages/core/src/domain/ChangeLayers";
import { approveLayers, changeApprovals } from "./approvals";
import type { Identity } from "../../packages/core/src/domain/Approvals";
import { contractCitationWarnings } from "./story-part";
import {
  parseReviewNotes,
  withNoteAdded,
  withNotesAddressed,
  type ReviewChange,
  type ReviewNote,
} from "../../packages/core/src/domain/ReviewNotes";

export type { ReviewChange, ReviewNote };

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

/**
 * When the change was approved, or "" while it is not. A 1.0 change, and any
 * change with recorded approvals, is approved only while every written layer's
 * approvals match its text (REQ-314); a 0.27 change without any reads the
 * `approved:` line it always had.
 */
export function approvedOn(projectDir: string, id: string): string {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  const line = (/^approved:\s*(\S+)/m.exec(yaml) || [])[1] || "";
  const state = changeApprovals(projectDir, id);
  if (state.schema === "layered" || state.recorded) return state.approved ? state.approvedAt : "";
  return line;
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
  /** What to do about it, as the rule that found it says, and where. */
  fix?: string;
  target?: string;
  action?: BlockerAction;
}

/** Does a message name this question — `Q1`, and not `Q10`? */
const names = (message: string, id: string) => namedBy(id).test(message);

/** What stops a change from being approved: checklist errors and open questions, each with its action. */
/** `skip_specs: true` in the change's change.yaml. */
function skipsSpecs(projectDir: string, id: string): boolean {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  return /^skip_specs:\s*true\s*$/m.test(yaml);
}

export function approvalBlockers(projectDir: string, id: string): Blocker[] {
  const out: Blocker[] = [];
  const questionsMd = read(path.join(changeDir(projectDir, id), "questions.md"));
  const questions = questionsMd ? questionTable(questionsMd) : [];
  const actionFor = (message: string): BlockerAction | undefined => {
    // An answered question still holding something — D7, or D13's assumption to review — is confirmed.
    const q = questions.find((x) => names(message, x.id));
    if (q)
      return q.answered ? { kind: "confirm", question: q.id } : { kind: "answer", question: q.id };
    // `REQ-001.` ends a sentence: the id is REQ-001.
    const req = (/REQ-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*/.exec(message) || [])[0];
    return req ? { kind: "open", requirement: req } : undefined;
  };
  const r = draftReport(projectDir, id);
  // A change that alters no behaviour (`skip_specs`), as the use cases of REQ-636: no delta to check.
  const noSpecs =
    "failure" in r && r.failure.code === "draft_no_specs" && skipsSpecs(projectDir, id);
  if ("failure" in r) {
    if (!noSpecs) out.push({ code: r.failure.code, message: r.failure.message });
  } else {
    for (const d of r.report.status) {
      if (d.severity !== "error") continue;
      out.push({
        code: d.code,
        message: d.message,
        action: actionFor(d.message),
        ...(d.fix ? { fix: d.fix } : {}),
        ...(d.target ? { target: d.target } : {}),
      });
    }
  }
  // REQ-415: a part of a story cites the contracts' operations as they are.
  for (const d of contractCitationWarnings(projectDir, id)) {
    if (d.severity !== "error") continue;
    out.push({
      code: d.code,
      message: d.message,
      action: actionFor(d.message),
      ...(d.fix ? { fix: d.fix } : {}),
      ...(d.target ? { target: d.target } : {}),
    });
  }
  for (const q of questions) {
    if (!q.answered && !out.some((b) => names(b.message, q.id))) {
      out.push({
        code: "approve_question_open",
        message: `${q.id} is open: ${q.text}`,
        action: { kind: "answer", question: q.id },
        fix: `Answer ${q.id} in questions.md.`,
      });
    }
  }
  return out;
}

export type ApproveOutcome =
  | { ok: true; change: string; approved: string; layers?: LayerId[]; pending?: LayerId[] }
  | { ok: false; code: string; message: string; blockers?: Blocker[]; fix?: string };

/**
 * Record that a person approved the change (REQ-206): the layers they own, or
 * the one named (REQ-311). `approved` is the date once every layer is in, ""
 * while some still wait.
 */
export function approveChange(
  projectDir: string,
  id: string,
  today: string,
  layer?: LayerId,
  /** REQ-562: who approves — the proxy's user in a team's studio; git's identity otherwise. */
  who?: Identity
): ApproveOutcome {
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
      // REQ-416: each blocker's own fix, not a generic one (truck-flote, MS8-1).
      fix: blockers
        .filter((b) => b.fix)
        .map((b) => (b.target ? `${b.target}: ${b.fix}` : b.fix))
        .join(" "),
    };
  }
  return approveLayers(projectDir, id, layer ? [layer] : null, today, who);
}

export interface ReviewNoteRow {
  date: string;
  requirement: string;
  text: string;
}

/** review.md of a change, relative to the project with `/`. */
export const reviewFile = (id: string) => `${CHANGES.split(path.sep).join("/")}/${id}/review.md`;

/** Every note of the change's review.md, each open or addressed, with what changed (REQ-484). */
export function reviewNoteList(projectDir: string, id: string): ReviewNote[] {
  return parseReviewNotes(read(path.join(changeDir(projectDir, id), "review.md")) || "");
}

/** The change's review notes, as the old studio's Review lists them (REQ-207). */
export function reviewNotes(projectDir: string, id: string): ReviewNoteRow[] {
  return reviewNoteList(projectDir, id).map((n) => ({
    date: n.date,
    requirement: n.requirement || "",
    text: n.text,
  }));
}

/** What `change show --json` gives under `review` (REQ-484). */
export function reviewOf(
  projectDir: string,
  id: string
): { file: string | null; open: number; notes: ReviewNote[] } {
  const exists = fs.existsSync(path.join(changeDir(projectDir, id), "review.md"));
  const notes = reviewNoteList(projectDir, id);
  return {
    file: exists ? reviewFile(id) : null,
    open: notes.filter((n) => n.state === "open").length,
    notes,
  };
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
  fs.writeFileSync(file, withNoteAdded(read(file), id, { date: today, requirement, text }), "utf8");
  return { ok: true, change: id, notes: reviewNoteList(projectDir, id).length };
}

/** Mark notes addressed, each with what changed (REQ-485). */
export function addressNotes(
  projectDir: string,
  id: string,
  addressed: Array<{ id: string; changes: ReviewChange[] }>,
  today: string
): void {
  if (addressed.length === 0) return;
  const file = path.join(changeDir(projectDir, id), "review.md");
  fs.writeFileSync(file, withNotesAddressed(read(file) || "", addressed, today), "utf8");
}
