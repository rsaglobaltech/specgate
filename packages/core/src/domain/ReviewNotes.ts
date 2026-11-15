/**
 * A draft's review notes (REQ-484, REQ-485): the changes the person reviewing
 * it asked for, in the change's `review.md`, each open or addressed — and,
 * once a redraft addressed it, what changed.
 *
 *   | Date | Requirement | Request | Status |
 *   |---|---|---|---|
 *   | 2026-11-11 | REQ-001 | Cancel up to 24 h before shipping | addressed 2026-11-12 |
 *   | 2026-11-11 | — | Prices in euros | open |
 *
 *   ## N1 — addressed 2026-11-12
 *
 *   ### Changed: REQ-001 in docs/specs/changes/draft-orders/specs/orders/spec.md:7
 *
 *   Before:
 *
 *   > ### Requirement: REQ-001 — …
 *
 *   After:
 *
 *   > ### Requirement: REQ-001 — …
 *
 * A note's id is its row's place in the table: N1, N2… — rows are only ever
 * added. A table without the Status column (written before it) is read as
 * every note open. The texts are quoted (`> `), so a requirement heading in
 * them is never read as one. Pure: the caller reads and writes the file.
 */

export interface ReviewChange {
  /** The requirement that changed, or null for a change to the draft outside any requirement. */
  requirement: string | null;
  /** The delta's path, relative to the project, with `/`. */
  file: string;
  /** 1-based, after the redraft (before it, when the requirement was removed). */
  line: number | null;
  /** The text before the redraft; "" when it did not exist. */
  before: string;
  /** The text after it; "" when it was removed. */
  after: string;
}

export interface ReviewNote {
  /** `N1`, `N2`… in the table's order. */
  id: string;
  date: string;
  /** The requirement it is about, or null. */
  requirement: string | null;
  text: string;
  state: "open" | "addressed";
  /** When it was addressed and what changed; null while open. */
  addressed: { date: string; changes: ReviewChange[] } | null;
  /** The row's line in review.md, 1-based. */
  line: number;
}

const ROW = /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/;
const HEADER = "| Date | Requirement | Request | Status |";
const SEPARATOR = "|---|---|---|---|";

const cells = (row: string) =>
  row
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((x) => x.trim());
const unescape = (cell: string) => cell.replace(/\\([\\|])/g, "$1");
const escapeCell = (text: string) =>
  String(text).replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

/** A text quoted line by line, so nothing in it reads as markdown structure. */
const quote = (text: string) =>
  text === ""
    ? " none."
    : `\n\n${text
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n")}`;

/** Each note of a review.md, in its order. */
export function parseReviewNotes(md: string): ReviewNote[] {
  const lines = String(md || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const notes: ReviewNote[] = [];
  lines.forEach((l, i) => {
    if (!ROW.test(l)) return;
    const c = cells(l);
    const status = c[3] || "open";
    const done = /^addressed\s+(\d{4}-\d{2}-\d{2})/.exec(status);
    notes.push({
      id: `N${notes.length + 1}`,
      date: c[0],
      requirement: !c[1] || c[1] === "—" || c[1] === "-" ? null : c[1],
      text: unescape(c[2] || ""),
      state: done ? "addressed" : "open",
      addressed: done ? { date: done[1], changes: [] } : null,
      line: i + 1,
    });
  });
  // What changed, under `## N1 — addressed <date>`.
  const byId = new Map(notes.map((n) => [n.id, n]));
  let note: ReviewNote | undefined;
  let change: ReviewChange | null = null;
  let side: "before" | "after" | null = null;
  const quoted: Record<"before" | "after", string[] | null> = { before: null, after: null };
  const close = () => {
    if (change) {
      change.before = (quoted.before || []).join("\n");
      change.after = (quoted.after || []).join("\n");
    }
    quoted.before = null;
    quoted.after = null;
    side = null;
  };
  for (const l of lines) {
    const head = /^## (N\d+) — addressed/.exec(l);
    if (head) {
      close();
      change = null;
      note = byId.get(head[1]);
      continue;
    }
    if (/^## /.test(l)) {
      close();
      change = null;
      note = undefined;
      continue;
    }
    if (!note || !note.addressed) continue;
    const ch = /^### Changed: (?:(REQ-[\w.]+) in )?(.+?)(?::(\d+))?$/.exec(l);
    if (ch) {
      close();
      change = {
        requirement: ch[1] || null,
        file: ch[2],
        line: ch[3] ? Number(ch[3]) : null,
        before: "",
        after: "",
      };
      note.addressed.changes.push(change);
      continue;
    }
    const label = /^(Before|After):\s*(none\.)?$/.exec(l);
    if (label && change) {
      side = label[1] === "Before" ? "before" : "after";
      quoted[side] = [];
      continue;
    }
    if (side && /^>( |$)/.test(l)) quoted[side]!.push(l.replace(/^> ?/, ""));
  }
  close();
  return notes;
}

/** review.md with one more note, its row after the last one; a new file when there is none. */
export function withNoteAdded(
  md: string | undefined,
  changeId: string,
  note: { date: string; requirement: string; text: string }
): string {
  const crlf = /\r\n/.test(md || "");
  const lines = (
    md ||
    `# Review — ${changeId}\n\nWhat the person reviewing this draft asked to change.\n\n${HEADER}\n${SEPARATOR}\n`
  )
    .replace(/\r\n/g, "\n")
    .split("\n");
  const upgraded = withStatusColumn(lines);
  const row = `| ${note.date} | ${note.requirement || "—"} | ${escapeCell(note.text)} | open |`;
  let last = -1;
  upgraded.forEach((l, i) => {
    if (ROW.test(l) || /^\|\s*Date\s*\|/.test(l) || /^\|[-:| ]+\|$/.test(l)) last = i;
  });
  if (last < 0) {
    const tail = upgraded.join("\n").replace(/\n*$/, "\n");
    const out = `${tail}\n${HEADER}\n${SEPARATOR}\n${row}\n`;
    return crlf ? out.replace(/\n/g, "\r\n") : out;
  }
  upgraded.splice(last + 1, 0, row);
  const out = upgraded.join("\n");
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

/** The table with its Status column: rows written before it are open. */
function withStatusColumn(lines: string[]): string[] {
  return lines.map((l) => {
    if (/^\|\s*Date\s*\|\s*Requirement\s*\|\s*Request\s*\|\s*$/.test(l)) return HEADER;
    if (/^\|---\|---\|---\|\s*$/.test(l)) return SEPARATOR;
    if (ROW.test(l) && cells(l).length === 3) return `${l.trimEnd()} open |`;
    return l;
  });
}

/** review.md with these notes marked addressed on `date`, each with what changed. */
export function withNotesAddressed(
  md: string,
  addressed: Array<{ id: string; changes: ReviewChange[] }>,
  date: string
): string {
  if (addressed.length === 0) return md;
  const crlf = /\r\n/.test(md);
  const lines = withStatusColumn(md.replace(/\r\n/g, "\n").split("\n"));
  const ids = new Set(addressed.map((a) => a.id));
  let n = 0;
  const out = lines.map((l) => {
    if (!ROW.test(l)) return l;
    n += 1;
    if (!ids.has(`N${n}`)) return l;
    const c = l.split(/(?<!\\)\|/);
    // ["", date, req, text, status, ""]
    c[4] = ` addressed ${date} `;
    return c.join("|");
  });
  const sections = addressed.map(({ id, changes }) =>
    [
      `## ${id} — addressed ${date}`,
      ...changes.map(
        (ch) =>
          `\n### Changed: ${ch.requirement ? `${ch.requirement} in ` : ""}${ch.file}${ch.line ? `:${ch.line}` : ""}\n\n` +
          `Before:${quote(ch.before)}\n\nAfter:${quote(ch.after)}`
      ),
    ].join("\n")
  );
  const text = `${out.join("\n").replace(/\n*$/, "\n")}\n${sections.join("\n\n")}\n`;
  return crlf ? text.replace(/\n/g, "\r\n") : text;
}

// ── What a redraft changed ──────────────────────────────────────────────────

export interface RequirementBlock {
  file: string;
  line: number;
  text: string;
}

/** Each requirement of a delta, by id: its line and its text up to the next requirement or section. */
export function requirementBlocks(file: string, source: string): Map<string, RequirementBlock> {
  const lines = String(source || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const out = new Map<string, RequirementBlock>();
  for (let i = 0; i < lines.length; i += 1) {
    const h = /^###\s+Requirement:\s+(REQ-[\w.]+)/.exec(lines[i]);
    if (!h) continue;
    let end = i + 1;
    while (end < lines.length && !/^###?\s/.test(lines[end])) end += 1;
    out.set(h[1], { file, line: i + 1, text: lines.slice(i, end).join("\n").trimEnd() });
  }
  return out;
}

/**
 * What changed for a note between the draft before and after a redraft: its
 * requirement's text, or — for a note on no requirement — every requirement
 * whose text changed. Empty when nothing it is about changed.
 */
export function changesFor(
  requirement: string | null,
  before: Array<{ file: string; source: string }>,
  after: Array<{ file: string; source: string }>
): ReviewChange[] {
  const all = (deltas: Array<{ file: string; source: string }>) => {
    const m = new Map<string, RequirementBlock>();
    for (const d of deltas) for (const [id, b] of requirementBlocks(d.file, d.source)) m.set(id, b);
    return m;
  };
  const b = all(before);
  const a = all(after);
  const diff = (id: string): ReviewChange | null => {
    const was = b.get(id);
    const now = a.get(id);
    if ((was?.text || "") === (now?.text || "")) return null;
    const where = now || was!;
    return {
      requirement: id,
      file: where.file,
      line: where.line,
      before: was?.text || "",
      after: now?.text || "",
    };
  };
  if (requirement) {
    const d = diff(requirement);
    return d ? [d] : [];
  }
  const ids = [...new Set([...b.keys(), ...a.keys()])];
  const changed = ids.map(diff).filter((d): d is ReviewChange => d !== null);
  if (changed.length) return changed;
  // The draft changed outside every requirement: the delta, whole.
  return after
    .map((d): ReviewChange | null => {
      const was = before.find((x) => x.file === d.file)?.source || "";
      return was === d.source
        ? null
        : {
            requirement: null,
            file: d.file,
            line: 1,
            before: was.trimEnd(),
            after: d.source.trimEnd(),
          };
    })
    .filter((d): d is ReviewChange => d !== null);
}
