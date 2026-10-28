import * as fs from "node:fs";
import * as path from "node:path";
import {
  addAssumption,
  addQuestion,
  answerQuestion,
  questionTable,
  reviewAssumptions,
  type QuestionRow,
} from "../../packages/core/src/domain/Clarification";
import { listChangeIds } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { liveMatrix } from "./live-detail";
import { refreshDerivedMatrix } from "../cli/commands/spec/MatrixCommand";

/**
 * Questions and answers on disk (REQ-187..189): each open change's
 * `questions.md` and `assumptions.md`, and the project's own
 * `docs/specs/questions.md` for requirements a capability already defines.
 */

/** The change a project-level question belongs to, as `questions` prints it. */
export const PROJECT = "project";
const PROJECT_QUESTIONS = path.join("docs", "specs", "questions.md");
const PROJECT_ASSUMPTIONS = path.join("docs", "specs", "assumptions.md");

function changeDir(projectDir: string, change: string): string {
  return path.join(projectDir, "docs", "specs", "changes", change);
}

function questionsFile(projectDir: string, change: string): string {
  return change === PROJECT
    ? path.join(projectDir, PROJECT_QUESTIONS)
    : path.join(changeDir(projectDir, change), "questions.md");
}

function assumptionsFile(projectDir: string, change: string): string {
  return change === PROJECT
    ? path.join(projectDir, PROJECT_ASSUMPTIONS)
    : path.join(changeDir(projectDir, change), "assumptions.md");
}

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

export interface OpenQuestion extends QuestionRow {
  change: string;
  file: string;
}

/** Every question of every open change, and of the project. */
export function allQuestions(projectDir: string): OpenQuestion[] {
  const out: OpenQuestion[] = [];
  for (const change of [...listChangeIds(projectDir), PROJECT]) {
    const file = questionsFile(projectDir, change);
    const md = read(file);
    if (!md) continue;
    for (const q of questionTable(md)) {
      out.push({ ...q, change, file: path.relative(projectDir, file).split(path.sep).join("/") });
    }
  }
  return out;
}

/** What waits for an answer: open questions, and requirements in Needs Clarification no open question names. */
export function waiting(projectDir: string): {
  questions: OpenQuestion[];
  requirements: Array<{ requirement: string; title: string }>;
} {
  const questions = allQuestions(projectDir).filter((q) => !q.answered);
  const named = new Set(questions.flatMap((q) => q.blocks));
  const seen = new Set<string>();
  const requirements: Array<{ requirement: string; title: string }> = [];
  for (const row of liveMatrix(projectDir)) {
    if (row.status !== "Needs Clarification" || named.has(row.requirement)) continue;
    if (seen.has(row.requirement)) continue;
    seen.add(row.requirement);
    requirements.push({ requirement: row.requirement, title: row.title });
  }
  return { questions, requirements };
}

export type AnswerOutcome =
  | {
      ok: true;
      change: string;
      question: string;
      assumption: string;
      revise: string[];
    }
  | { ok: false; code: string; message: string; changes?: string[] };

/** The changes that have a question with this id. */
function changesWith(projectDir: string, id: string): string[] {
  return [
    ...new Set(
      allQuestions(projectDir)
        .filter((q) => q.id === id)
        .map((q) => q.change)
    ),
  ];
}

function pickChange(projectDir: string, id: string, change?: string): AnswerOutcome | string {
  const found = changesWith(projectDir, id);
  if (change) {
    if (!found.includes(change)) {
      return {
        ok: false,
        code: "question_not_found",
        message: `${change} has no question ${id}.`,
        changes: found,
      };
    }
    return change;
  }
  if (found.length === 0) {
    return {
      ok: false,
      code: "question_not_found",
      message: `No open change has a question ${id}.`,
    };
  }
  if (found.length > 1) {
    return {
      ok: false,
      code: "question_ambiguous",
      message: `${found.length} changes have a question ${id}: ${found.join(", ")}. Say which with --change.`,
      changes: found,
    };
  }
  return found[0];
}

/** Write the answer, add its assumption to review, and say which requirements to revise (REQ-188). */
export function answer(
  projectDir: string,
  id: string,
  text: string,
  change?: string
): AnswerOutcome {
  const picked = pickChange(projectDir, id, change);
  if (typeof picked !== "string") return picked;
  const qFile = questionsFile(projectDir, picked);
  const written = answerQuestion(read(qFile) || "", id, text);
  if (!written.ok) {
    return {
      ok: false,
      code: written.code,
      message:
        written.code === "answer_deferred"
          ? `"${text}" puts the decision off; an answer decides. Answer when it is decided.`
          : `${picked} has no question ${id}.`,
    };
  }
  const aFile = assumptionsFile(projectDir, picked);
  const added = addAssumption(read(aFile), picked, {
    text,
    usedIn: written.blocks,
    why: id,
  });
  write(qFile, written.md);
  write(aFile, added.md);
  return { ok: true, change: picked, question: id, assumption: added.id, revise: written.blocks };
}

/** Mark the question's assumptions reviewed: the spec reflects the answer (REQ-188). */
export function reviewed(
  projectDir: string,
  id: string,
  change?: string
): { ok: true; change: string; ids: string[] } | { ok: false; code: string; message: string } {
  const picked = pickChange(projectDir, id, change);
  if (typeof picked !== "string") return picked as { ok: false; code: string; message: string };
  const aFile = assumptionsFile(projectDir, picked);
  const r = reviewAssumptions(read(aFile) || "", id);
  if (r.ids.length === 0) {
    return {
      ok: false,
      code: "nothing_to_review",
      message: `No assumption from ${id} is waiting for review in ${picked}.`,
    };
  }
  write(aFile, r.md);
  // The decision is in the spec: what waited only for this question can be
  // built again (REQ-210). Another open question still holds its own.
  const all = allQuestions(projectDir);
  const blocks = (all.find((q) => q.id === id && q.change === picked) || { blocks: [] }).blocks;
  const stillHeld = new Set(all.filter((q) => !q.answered).flatMap((q) => q.blocks));
  const status = new Map(liveMatrix(projectDir).map((m) => [m.requirement, m.status]));
  for (const req of blocks) {
    if (stillHeld.has(req) || status.get(req) !== "Needs Clarification") continue;
    const where = definedIn(projectDir, req);
    if (where) setStatusIn(where.file, projectDir, req, "Draft");
  }
  return { ok: true, change: picked, ids: r.ids };
}

/** Where a requirement is defined: the open change that adds or modifies it, or the capability spec. */
export function definedIn(
  projectDir: string,
  req: string
): { change: string; file: string } | null {
  const heading = new RegExp(`^###\\s+Requirement:\\s+${req}\\b`, "m");
  for (const change of listChangeIds(projectDir)) {
    const specs = path.join(changeDir(projectDir, change), "specs");
    for (const cap of safeDirs(specs)) {
      const file = path.join(specs, cap, "spec.md");
      if (heading.test(read(file) || "")) return { change, file };
    }
  }
  const caps = path.join(projectDir, "docs", "specs", "capabilities");
  for (const cap of safeDirs(caps)) {
    const file = path.join(caps, cap, "spec.md");
    if (heading.test(read(file) || "")) return { change: PROJECT, file };
  }
  const spec = path.join(projectDir, "spec.md");
  if (new RegExp(`^#{2,3}\\s+${req}\\b`, "m").test(read(spec) || ""))
    return { change: PROJECT, file: spec };
  return null;
}

/**
 * A requirement of `spec.md` keeps its status in tables — the summary in
 * `spec.md` and the matrix — whose last cell is the status: set both.
 */
function setStatusInTables(projectDir: string, req: string, status: string): boolean {
  let done = false;
  for (const rel of ["spec.md", path.join("docs", "specs", "traceability.md")]) {
    const file = path.join(projectDir, rel);
    const text = read(file);
    if (!text) continue;
    const row = new RegExp(`^(\\|\\s*${req}\\s*\\|.*\\|)\\s*[^|]+?\\s*\\|\\s*$`, "gm");
    const next = text.replace(row, (_m, head: string) => `${head} ${status} |`);
    if (next !== text) {
      write(file, next);
      done = true;
    }
  }
  return done;
}

function safeDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * The requirement's trace status set to Needs Clarification in the file that
 * defines it, and the derived matrix refreshed. `apply` writes only the
 * statuses a delivery moves through, and this one is not.
 */
export function setWaiting(file: string, projectDir: string, req: string): boolean {
  return setStatusIn(file, projectDir, req, "Needs Clarification");
}

/** The requirement's trace status set in the file that defines it, the matrix refreshed. */
export function setStatusIn(
  file: string,
  projectDir: string,
  req: string,
  status: string
): boolean {
  const value = /\s/.test(status) ? `"${status}"` : status;
  if (path.basename(file) === "spec.md" && path.dirname(file) === projectDir) {
    return setStatusInTables(projectDir, req, status);
  }
  const lines = (read(file) || "").split("\n");
  const head = new RegExp(`^(?:###\\s+Requirement:|##)\\s+${req}\\b`);
  const start = lines.findIndex((l) => head.test(l));
  if (start === -1) return false;
  for (let i = start + 1; i < lines.length && !/^#{2,3}\s(?!#)/.test(lines[i]); i += 1) {
    if (!/<!--\s*specgate:trace\b/.test(lines[i])) continue;
    lines[i] = /\bstatus=/.test(lines[i])
      ? lines[i].replace(/\bstatus=(?:"[^"]*"|[^\s"]+?)(?=\s|-->)/, `status=${value}`)
      : lines[i].replace(/<!--\s*specgate:trace/, `<!-- specgate:trace status=${value}`);
    write(file, lines.join("\n"));
    try {
      refreshDerivedMatrix(projectDir);
    } catch {
      /* the next validate refreshes it */
    }
    return true;
  }
  return false;
}

/** Add the question to where the requirement is defined, and set it waiting (REQ-189). */
export function ask(
  projectDir: string,
  req: string,
  text: string
):
  | { ok: true; change: string; question: string; file: string }
  | { ok: false; code: string; message: string } {
  const where = definedIn(projectDir, req);
  if (!where) {
    return {
      ok: false,
      code: "requirement_not_found",
      message: `${req} is not defined by an open change or a capability spec.`,
    };
  }
  const qFile = questionsFile(projectDir, where.change);
  const added = addQuestion(read(qFile), where.change, text, [req]);
  write(qFile, added.md);
  setWaiting(where.file, projectDir, req);
  return {
    ok: true,
    change: where.change,
    question: added.id,
    file: path.relative(projectDir, qFile).split(path.sep).join("/"),
  };
}
