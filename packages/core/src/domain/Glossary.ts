/**
 * One word for one thing (REQ-538).
 *
 * A specification that calls the same person a customer, a client and a user
 * has three requirements where it meant one, and an agent implements three
 * models. `docs/specs/glossary.md` names the term to use and the words to
 * avoid; `validate` names every avoided word a requirement or a scenario uses,
 * with the line and the term to use instead. Pure: text in, findings out.
 */

export const GLOSSARY_FILE = "docs/specs/glossary.md";

export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
  /** Lower-cased words this term replaces. */
  readonly avoid: readonly string[];
}

/** The empty glossary `init` and `adopt` write. */
export function glossaryTemplate(): string {
  return [
    "# Glossary",
    "",
    "One word for one thing. `specgate validate` reports a word listed under Avoid",
    "wherever a requirement or a scenario uses it, with the term to use instead.",
    "Separate several words with commas.",
    "",
    "| Term | Definition | Avoid |",
    "| --- | --- | --- |",
    "",
  ].join("\n");
}

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** The table's rows. A row without a term, or the header, is skipped. */
export function parseGlossary(md: string): GlossaryTerm[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex(
    (l) => /^\s*\|/.test(l) && /\bterm\b/i.test(l) && /\bavoid\b/i.test(l)
  );
  if (header === -1) return [];
  const cols = cellsOf(lines[header]).map((c) => c.toLowerCase());
  const at = (name: string) => cols.findIndex((c) => c === name);
  const [ti, di, ai] = [at("term"), at("definition"), at("avoid")];
  const out: GlossaryTerm[] = [];
  for (const line of lines.slice(header + 1)) {
    if (!/^\s*\|/.test(line)) break;
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const c = cellsOf(line);
    const term = (c[ti] || "").replace(/`/g, "");
    if (!term) continue;
    const avoid = (c[ai] || "")
      .split(/[,;]/)
      .map((w) => w.replace(/`/g, "").trim().toLowerCase())
      .filter((w) => w && w !== "-");
    out.push({ term, definition: di >= 0 ? c[di] || "" : "", avoid });
  }
  return out;
}

export interface ForbiddenWord {
  /** 1-based. */
  readonly line: number;
  /** As written in the text. */
  readonly word: string;
  readonly term: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every avoided word in a text, as a whole word, ignoring case. Comments,
 * code spans and trace lines are not prose and are skipped.
 */
export function forbiddenWords(text: string, glossary: readonly GlossaryTerm[]): ForbiddenWord[] {
  const rules = glossary.flatMap((g) =>
    g.avoid.map((w) => ({
      term: g.term,
      re: new RegExp(`(^|[^\\p{L}\\p{N}_])(${escape(w)})(?![\\p{L}\\p{N}_])`, "iu"),
    }))
  );
  if (rules.length === 0) return [];
  const out: ForbiddenWord[] = [];
  let fenced = false;
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((raw, i) => {
      if (/^\s*```/.test(raw)) {
        fenced = !fenced;
        return;
      }
      if (fenced || /^\s*<!--/.test(raw)) return;
      const line = raw.replace(/`[^`]*`/g, " ");
      for (const r of rules) {
        const m = r.re.exec(line);
        if (m) out.push({ line: i + 1, word: m[2], term: r.term });
      }
    });
  return out;
}

/** A word the project already uses as a name, and where (REQ-595). */
export interface TermCandidate {
  term: string;
  /** `actor` (the brief or a requirement's actor=) or `entity` (the domain model). */
  from: "actor" | "entity";
}

/**
 * REQ-595: the names the project uses that its glossary does not define yet —
 * each once, ignoring case, in the order found. Suggestions for a person: the
 * definition and the words to avoid are theirs to write.
 */
export function suggestTerms(
  glossary: readonly GlossaryTerm[],
  candidates: readonly TermCandidate[]
): TermCandidate[] {
  const known = new Set(glossary.map((t) => t.term.toLowerCase()));
  const out: TermCandidate[] = [];
  for (const c of candidates) {
    const term = c.term.trim();
    if (!term || /<[^>]+>/.test(term) || known.has(term.toLowerCase())) continue;
    known.add(term.toLowerCase());
    out.push({ term, from: c.from });
  }
  return out;
}

/** The glossary with a row per term added under its table, Definition and Avoid left to fill. */
export function withTerms(md: string, terms: readonly string[]): string {
  if (terms.length === 0) return md;
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex(
    (l) => /^\s*\|/.test(l) && /\bterm\b/i.test(l) && /\bavoid\b/i.test(l)
  );
  const rows = terms.map((t) => `| ${t.replace(/\|/g, "\\|")} |  |  |`);
  if (header === -1) {
    return `${md.trimEnd()}\n\n| Term | Definition | Avoid |\n| --- | --- | --- |\n${rows.join("\n")}\n`;
  }
  let end = header + 1;
  while (end < lines.length && /^\s*\|/.test(lines[end])) end += 1;
  lines.splice(end, 0, ...rows);
  return lines.join("\n");
}
