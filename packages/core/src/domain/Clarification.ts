/**
 * Questions and their answers as rows of `questions.md` and `assumptions.md`
 * (REQ-187..189). The tables keep the format people already write by hand;
 * these functions read and write one row at a time, so `answer` and `ask` do
 * what an author did by editing cells.
 *
 * Pure: text in, text out. The commands do the reading and writing.
 */

/**
 * An answer that puts the decision off is not an answer. "Se decidirá con el
 * cliente antes de implementarlo" filled the Answer cell, D7 took the question
 * as answered and its requirement stopped waiting, though nobody had decided
 * anything (HealthTech, #82). A proposal ("propuesta, a validar") is an answer;
 * "pending", "TBD" or "will be decided" is not.
 */
const DEFERRED =
  /(?<![\p{L}])(se decidir[aá]n?|por decidir|a decidir|sin decidir|pendiente de (?:decidir|decisi[oó]n|respuesta|confirmar)|to be decided|will be decided|decide later|tbd)(?![\p{L}])/iu;
const DEFERRED_ALONE = /^(pendiente|pending|later|tbd|todo|\?+|-+)\.?$/i;

export function deferredAnswer(answer: string): boolean {
  const text = answer.replace(/\*\*/g, "").trim();
  return DEFERRED.test(text) || DEFERRED_ALONE.test(text);
}

export interface QuestionRow {
  id: string;
  text: string;
  blocks: string[];
  answered: boolean;
  line: number;
}

export interface AssumptionRow {
  id: string;
  why: string;
  status: string;
  line: number;
}

const QUESTION_HEADER = "| # | Question | Blocks | Options seen | Answer | Status |";
const ASSUMPTION_HEADER = "| # | Assumption | Used in | Why | Status |";
const TO_REVIEW = "to review";

/** A cell's value as written into a Markdown table: one line, its pipes escaped. */
function cell(text: string): string {
  return String(text).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

/** The cells of a table line, split on pipes that are not escaped. */
function cells(line: string): string[] {
  return line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => c.trim());
}

interface Table {
  lines: string[];
  header: number;
  cols: string[];
  rows: number[];
}

function table(md: string, must: RegExp): Table | null {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex((l) => /^\|/.test(l) && must.test(l));
  if (header === -1) return null;
  const cols = cells(lines[header]).map((c) => c.toLowerCase());
  const rows: number[] = [];
  for (let i = header + 2; i < lines.length && /^\|/.test(lines[i]); i += 1) rows.push(i);
  return { lines, header, cols, rows };
}

function col(t: Table, ...names: string[]): number {
  return t.cols.findIndex((c) => names.includes(c));
}

/** The rows of a `questions.md` table: id, text, what each blocks, and whether it is answered. */
export function questionTable(md: string): QuestionRow[] {
  const t = table(md, /\bBlocks\b/i);
  if (!t) return [];
  const textAt = col(t, "question", "pregunta");
  const blocksAt = col(t, "blocks");
  const answerAt = col(t, "answer", "respuesta");
  return t.rows.map((i) => {
    const c = cells(t.lines[i]);
    const answer = answerAt >= 0 ? c[answerAt] || "" : "";
    return {
      id: c[0] || "",
      text: textAt >= 0 ? c[textAt] || "" : "",
      blocks: (blocksAt >= 0 ? c[blocksAt] || "" : "").match(/REQ-[A-Za-z0-9.]+/g) || [],
      answered: answer.length > 0 && !deferredAnswer(answer),
      line: i + 1,
    };
  });
}

export type AnswerResult =
  | { ok: true; md: string; blocks: string[] }
  | { ok: false; code: "question_not_found" | "answer_deferred" };

/** `questions.md` with the answer in the row's Answer cell and its Status set to answered. */
export function answerQuestion(md: string, id: string, answer: string): AnswerResult {
  if (deferredAnswer(answer)) return { ok: false, code: "answer_deferred" };
  const t = table(md, /\bBlocks\b/i);
  const at = t ? t.rows.find((i) => cells(t.lines[i])[0] === id) : undefined;
  if (!t || at === undefined) return { ok: false, code: "question_not_found" };
  const c = cells(t.lines[at]);
  while (c.length < t.cols.length) c.push("");
  const answerAt = col(t, "answer", "respuesta");
  const statusAt = col(t, "status", "estado");
  if (answerAt >= 0) c[answerAt] = cell(answer);
  if (statusAt >= 0) c[statusAt] = "answered";
  t.lines[at] = `| ${c.join(" | ")} |`;
  const blocksAt = col(t, "blocks");
  return {
    ok: true,
    md: t.lines.join("\n"),
    blocks: (blocksAt >= 0 ? c[blocksAt] : "").match(/REQ-[A-Za-z0-9.]+/g) || [],
  };
}

function nextId(ids: string[], prefix: string): string {
  const n = ids
    .map((id) => Number((new RegExp(`^${prefix}(\\d+)$`).exec(id) || [])[1]))
    .filter((x) => Number.isFinite(x));
  return `${prefix}${(n.length ? Math.max(...n) : 0) + 1}`;
}

function appendRow(
  md: string | undefined,
  title: string,
  header: string,
  must: RegExp,
  row: (id: string) => string,
  prefix: string
) {
  let text =
    md && md.trim()
      ? md.replace(/\r\n/g, "\n")
      : `${title}\n\n${header}\n${header.replace(/[^|]+/g, "---")}\n`;
  let t = table(text, must);
  if (!t) {
    text = `${text.replace(/\n*$/, "\n")}\n${header}\n${header.replace(/[^|]+/g, "---")}\n`;
    t = table(text, must)!;
  }
  const id = nextId(
    t.rows.map((i) => cells(t!.lines[i])[0]),
    prefix
  );
  const last = t.rows.length ? t.rows[t.rows.length - 1] : t.header + 1;
  t.lines.splice(last + 1, 0, row(id));
  return { md: t.lines.join("\n"), id };
}

/** `questions.md` with a new open question that blocks the given requirements. */
export function addQuestion(
  md: string | undefined,
  change: string,
  text: string,
  blocks: string[]
): { md: string; id: string } {
  return appendRow(
    md,
    `# Questions — ${change}`,
    QUESTION_HEADER,
    /\bBlocks\b/i,
    (id) => `| ${id} | ${cell(text)} | ${blocks.join(", ")} |  |  | open |`,
    "Q"
  );
}

/** `assumptions.md` with a new assumption from an answer, to review until the spec reflects it. */
export function addAssumption(
  md: string | undefined,
  change: string,
  a: { text: string; usedIn: string[]; why: string }
): { md: string; id: string } {
  return appendRow(
    md,
    `# Assumptions — ${change}`,
    ASSUMPTION_HEADER,
    /\bUsed in\b/i,
    (id) => `| ${id} | ${cell(a.text)} | ${a.usedIn.join(", ")} | ${cell(a.why)} | ${TO_REVIEW} |`,
    "A"
  );
}

function assumptionRows(md: string): { t: Table | null; rows: AssumptionRow[] } {
  const t = table(md, /\bUsed in\b/i);
  if (!t) return { t, rows: [] };
  const whyAt = col(t, "why", "por qué", "porque");
  const statusAt = col(t, "status", "estado");
  return {
    t,
    rows: t.rows.map((i) => {
      const c = cells(t.lines[i]);
      return {
        id: c[0] || "",
        why: whyAt >= 0 ? c[whyAt] || "" : "",
        status: statusAt >= 0 ? (c[statusAt] || "").toLowerCase() : "",
        line: i + 1,
      };
    }),
  };
}

/** The assumptions written from an answer whose spec nobody has confirmed yet. */
export function assumptionsToReview(md: string): AssumptionRow[] {
  return assumptionRows(md).rows.filter((a) => a.status === TO_REVIEW);
}

/** `assumptions.md` with the question's assumptions to review set to decided. */
export function reviewAssumptions(md: string, question: string): { md: string; ids: string[] } {
  const { t, rows } = assumptionRows(md);
  if (!t) return { md, ids: [] };
  const statusAt = col(t, "status", "estado");
  const named = new RegExp(`(^|[^A-Za-z0-9])${question}(?![A-Za-z0-9])`);
  const ids: string[] = [];
  for (const a of rows) {
    if (a.status !== TO_REVIEW || !named.test(a.why)) continue;
    const c = cells(t.lines[a.line - 1]);
    c[statusAt] = "decided";
    t.lines[a.line - 1] = `| ${c.join(" | ")} |`;
    ids.push(a.id);
  }
  return { md: t.lines.join("\n"), ids };
}
