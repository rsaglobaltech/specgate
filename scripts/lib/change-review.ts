import * as fs from "node:fs";
import * as path from "node:path";
import { questionTable } from "../../packages/core/src/domain/Clarification";
import { draftReport } from "../cli/commands/spec/DraftCommand";
import type { LayerId } from "../../packages/core/src/domain/ChangeLayers";
import { approveLayers, changeApprovals } from "./approvals";
import { contractCitationWarnings } from "./story-part";

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

export interface Blocker {
  code: string;
  message: string;
  /** What to do about it, as the rule that found it says, and where. */
  fix?: string;
  target?: string;
}

/** What stops a change from being approved: checklist errors and open questions. */
export function approvalBlockers(projectDir: string, id: string): Blocker[] {
  const out: Blocker[] = [];
  const r = draftReport(projectDir, id);
  if ("failure" in r) {
    out.push({ code: r.failure.code, message: r.failure.message });
  } else {
    for (const d of r.report.status) {
      if (d.severity === "error")
        out.push({
          code: d.code,
          message: d.message,
          ...(d.fix ? { fix: d.fix } : {}),
          ...(d.target ? { target: d.target } : {}),
        });
    }
  }
  // REQ-415: a part of a story cites the contracts' operations as they are.
  for (const d of contractCitationWarnings(projectDir, id)) {
    if (d.severity === "error")
      out.push({
        code: d.code,
        message: d.message,
        ...(d.fix ? { fix: d.fix } : {}),
        ...(d.target ? { target: d.target } : {}),
      });
  }
  const questions = read(path.join(changeDir(projectDir, id), "questions.md"));
  for (const q of questions ? questionTable(questions) : []) {
    if (!q.answered && !out.some((b) => b.message.includes(q.id))) {
      out.push({
        code: "approve_question_open",
        message: `${q.id} is open: ${q.text}`,
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
  layer?: LayerId
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
  return approveLayers(projectDir, id, layer ? [layer] : null, today);
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
