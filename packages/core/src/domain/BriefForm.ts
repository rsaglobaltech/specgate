/**
 * The brief as a form (REQ-486, REQ-487): its front matter's fields and each
 * module's cards, every one with the line it is written on — and the form
 * written back into the brief.
 *
 * Writing splices: only a front matter field whose value changed, and only a
 * module section whose prose or cards changed, is rewritten. Every other byte
 * of the file stays as it was — its line endings, CRLF or mixed, the blank
 * lines and text after the last section, and every section that is not a
 * module's. A form written back unchanged leaves the file identical.
 *
 * Pure: the caller reads the file and writes what this returns. The CLI
 * (`propose --from-brief --form`), the API and the old studio all use it.
 */

import { briefModules } from "./DraftChecklist";
import { isPlaceholder, moduleKey, readBriefBody } from "./BriefCards";
import type { ModuleSection } from "./BriefCards";

export interface BriefFormCard {
  text: string;
  /** 1-based, in the whole brief. */
  line: number;
}

export interface BriefFormActor {
  name: string;
  surfaces: string[];
  line: number;
}

export interface BriefFormModule {
  /** How `modules:` spells it: `live-classes`. */
  key: string;
  /** As its heading writes it; the key when it has no section. */
  name: string;
  /** Named by `modules:` in the front matter. */
  listed: boolean;
  /** `module` for `## Module: <name>`, `plain` for a hand-written `## <name>` (REQ-437), null for none. */
  section: "module" | "plain" | null;
  /** The section's heading, or null when it has none. */
  line: number | null;
  prose: { text: string; line: number | null };
  rules: BriefFormCard[];
  examples: BriefFormCard[];
  questions: BriefFormCard[];
}

export interface BriefFormData {
  /** The file's line endings: `crlf` when any line ends in CRLF. */
  eol: "lf" | "crlf";
  frontMatter: {
    /** Its opening `---`, or null when the brief has none. */
    line: number | null;
    product: { value: string; line: number | null };
    surfaces: { value: string[]; line: number | null };
    actors: { value: BriefFormActor[]; line: number | null };
    /** Read only: writing lists `modules` in the order of the form's modules. */
    modules: { value: string[]; line: number | null };
  };
  modules: BriefFormModule[];
}

type CardInput = string | { text: string };

/** What writing accepts: what reading returns, values changed; `line` and `listed` are ignored. */
export interface BriefFormInput {
  frontMatter: {
    product: { value: string } | string;
    /** Absent: the actors' surfaces. Present: these, and the actors'. */
    surfaces?: { value: string[] } | string[];
    actors:
      | { value: Array<{ name: string; surfaces: string[] }> }
      | Array<{ name: string; surfaces: string[] }>;
  };
  modules: Array<{
    key?: string;
    name: string;
    prose?: { text: string } | string;
    rules?: CardInput[];
    examples?: CardInput[];
    questions?: CardInput[];
  }>;
}

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");
const listOf = (inner: string) =>
  inner
    .split(",")
    .map((s) => unquote(s))
    .filter(Boolean);

/** The brief's lines, each with the line ending it was written with. */
function linesOf(text: string): Array<{ text: string; eol: string }> {
  const out: Array<{ text: string; eol: string }> = [];
  const re = /([^\n]*?)(\r?\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") break;
    out.push({ text: m[1], eol: m[2] });
  }
  return out;
}

/** The front matter's lines, 0-based in the file: the opening `---` and the closing one. */
function frontRange(lines: string[]): { open: number; close: number } | null {
  if (lines[0] !== "---") return null;
  for (let i = 1; i < lines.length; i += 1)
    if (/^---[ \t]*$/.test(lines[i])) return { open: 0, close: i };
  return null;
}

/** A top-level field's line and the indented lines that belong to it, 0-based; null when absent. */
function fieldRange(lines: string[], fm: { open: number; close: number }, name: string) {
  for (let i = fm.open + 1; i < fm.close; i += 1) {
    if (!new RegExp(`^${name}:`).test(lines[i])) continue;
    let end = i + 1;
    while (end < fm.close && /^[ \t]+\S/.test(lines[end])) end += 1;
    return { at: i, end };
  }
  return null;
}

/** A hand-written `## orders` section for a module, 0-based: heading to the line before the next `##`. */
function plainSection(lines: string[], from: number, key: string) {
  for (let i = from; i < lines.length; i += 1) {
    const h = /^##[ \t]+(.+?)[ \t]*$/.exec(lines[i]);
    if (!h || /^module:/i.test(h[1]) || moduleKey(h[1]) !== key) continue;
    let end = i + 1;
    while (end < lines.length && !/^##\s/.test(lines[end])) end += 1;
    const body = lines.slice(i + 1, end);
    const first = body.findIndex((l) => l.trim() !== "");
    let last = end - 1;
    while (last > i && lines[last].trim() === "") last -= 1;
    return {
      at: i,
      // The section's own lines, without the blank ones before the next heading.
      end: last + 1,
      name: h[1].trim(),
      prose: body.join("\n").trim(),
      proseLine: first < 0 ? null : i + 2 + first,
    };
  }
  return null;
}

function cards(list: ModuleSection["rules"]): BriefFormCard[] {
  return list.map((c) => ({ text: c.text, line: c.line }));
}

/** The brief read as a form, each field with its line. */
export function readBriefForm(text: string): BriefFormData {
  const src = String(text || "");
  const eol: "lf" | "crlf" = /\r\n/.test(src) ? "crlf" : "lf";
  const lf = src.replace(/\r\n/g, "\n");
  const lines = lf.split("\n");
  const fm = frontRange(lines);
  const at = (name: string) => {
    const r = fm ? fieldRange(lines, fm, name) : null;
    return r ? r.at : -1;
  };
  const value = (name: string) => {
    const i = at(name);
    return i < 0 ? "" : lines[i].slice(name.length + 1).trim();
  };
  const lineOf = (name: string) => (at(name) < 0 ? null : at(name) + 1);

  const product = unquote(value("product"));
  let surfaces: string[] = [];
  const s = /^\[([^\]]*)\]/.exec(value("surfaces"));
  if (s) surfaces = listOf(s[1]);
  else if (at("surfaces") >= 0) {
    const r = fieldRange(lines, fm!, "surfaces")!;
    surfaces = lines
      .slice(r.at + 1, r.end)
      .map((l) => /^\s*-\s*(.+)$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => unquote(m[1]));
  }
  surfaces = surfaces.filter((x) => !isPlaceholder(x));

  const actors: BriefFormActor[] = [];
  if (fm) {
    for (let i = fm.open + 1; i < fm.close; i += 1) {
      for (const m of lines[i].matchAll(/\{\s*name:\s*([^,}]+?)\s*,\s*surfaces:\s*\[([^\]]*)\]/g)) {
        const name = unquote(m[1]);
        // A template's `<actor>` is a blank, not an actor.
        if (name.includes("<")) continue;
        actors.push({ name, surfaces: listOf(m[2]), line: i + 1 });
      }
    }
  }

  const listed = briefModules(lf);
  const body = readBriefBody(lf);
  // A template's `## Module: <first-module>` is a blank, not a module.
  const sections = new Map(
    body.modules.filter((m) => !m.name.startsWith("<")).map((m) => [moduleKey(m.name), m])
  );
  const keys = [...listed];
  for (const k of sections.keys()) if (!keys.includes(k)) keys.push(k);
  const bodyStart = fm ? fm.close + 1 : 0;
  const modules = keys.map((key): BriefFormModule => {
    const sec = sections.get(key);
    const base = { key, listed: listed.includes(key) };
    if (sec) {
      const first = sec.prose.split("\n")[0];
      let proseLine: number | null = null;
      if (first) {
        const raw = sec.source.split("\n");
        const j = raw.findIndex((l, n) => n > 0 && l.trim() === first.trim());
        proseLine = j < 0 ? null : sec.line + j;
      }
      return {
        ...base,
        name: sec.name,
        section: "module",
        line: sec.line,
        prose: { text: sec.prose, line: proseLine },
        rules: cards(sec.rules),
        examples: cards(sec.examples),
        questions: cards(sec.questions),
      };
    }
    const plain = plainSection(lines, bodyStart, key);
    if (plain) {
      return {
        ...base,
        name: plain.name,
        section: "plain",
        line: plain.at + 1,
        prose: { text: plain.prose, line: plain.proseLine },
        rules: [],
        examples: [],
        questions: [],
      };
    }
    return {
      ...base,
      name: key,
      section: null,
      line: null,
      prose: { text: "", line: null },
      rules: [],
      examples: [],
      questions: [],
    };
  });

  return {
    eol,
    frontMatter: {
      line: fm ? 1 : null,
      product: { value: product, line: lineOf("product") },
      surfaces: { value: surfaces, line: lineOf("surfaces") },
      actors: { value: actors, line: lineOf("actors") },
      modules: { value: listed, line: lineOf("modules") },
    },
    modules,
  };
}

// ── Writing ─────────────────────────────────────────────────────────────────

const textOf = (c: CardInput | undefined | null) =>
  String(typeof c === "string" ? c : c && typeof c === "object" ? c.text : "");
const filled = (list: CardInput[] | undefined) =>
  (Array.isArray(list) ? list : []).map((c) => textOf(c).trim()).filter(Boolean);
const valueOf = <T>(v: { value: T } | T | undefined): T | undefined =>
  v && typeof v === "object" && !Array.isArray(v) && "value" in (v as object)
    ? (v as { value: T }).value
    : (v as T | undefined);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

interface ModuleText {
  name: string;
  prose: string;
  rules: string[];
  examples: string[];
  questions: string[];
}

function sectionLines(m: ModuleText, spanish: boolean): string[] {
  const words = spanish
    ? { rules: "Reglas", examples: "Ejemplos", questions: "Preguntas" }
    : { rules: "Rules", examples: "Examples", questions: "Questions" };
  const parts = [`## Module: ${m.name}`];
  if (m.prose) parts.push(m.prose);
  const list = (items: string[]) => items.map((t) => `- ${t}`).join("\n");
  if (m.rules.length) parts.push(`${words.rules}\n\n${list(m.rules)}`);
  if (m.examples.length) parts.push(`${words.examples}\n\n${list(m.examples)}`);
  if (m.questions.length) parts.push(`${words.questions}\n\n${list(m.questions)}`);
  return parts.join("\n\n").split("\n");
}

const CARD_HEADING =
  /^(?:#{3,6}\s+)?(\**)(rules|examples|questions|reglas|ejemplos|preguntas)\**\s*:?\s*$/i;
const KINDS = ["rules", "examples", "questions"] as const;
type Kind = (typeof KINDS)[number];
const KIND: Record<string, Kind> = {
  rules: "rules",
  reglas: "rules",
  examples: "examples",
  ejemplos: "examples",
  questions: "questions",
  preguntas: "questions",
};

/** Each card list of a section, 0-based: its heading, and its items' lines (start < 0: none). */
function cardBlocks(lines: string[], at: number, count: number) {
  const blocks: Partial<
    Record<Kind, { heading: number; start: number; end: number; bold: boolean }>
  > = {};
  let kind: Kind | null = null;
  let item = false;
  for (let j = at + 1; j < at + count; j += 1) {
    const line = lines[j];
    const h = CARD_HEADING.exec(line.trim());
    if (h) {
      kind = KIND[h[2].toLowerCase()];
      blocks[kind] = { heading: j, start: -1, end: j + 1, bold: h[1] !== "" };
      item = false;
      continue;
    }
    if (!kind) continue;
    const b = blocks[kind]!;
    if (/^\s*[-*]\s+/.test(line)) {
      if (b.start < 0) b.start = j;
      b.end = j + 1;
      item = true;
    } else if (item && /^\s{2,}\S/.test(line)) b.end = j + 1;
    else if (line.trim() === "") item = false;
    else kind = null;
  }
  return blocks;
}

/** The edits that change a section's card lists in place, keeping its prose and headings. */
function cardEdits(
  lines: string[],
  sec: { at: number; count: number },
  before: ModuleText,
  now: ModuleText,
  spanish: boolean
): Edit[] {
  const blocks = cardBlocks(lines, sec.at, sec.count);
  const bold = Object.values(blocks).some((b) => b && b.bold);
  const word = (k: Kind) => {
    const w = spanish
      ? { rules: "Reglas", examples: "Ejemplos", questions: "Preguntas" }[k]
      : { rules: "Rules", examples: "Examples", questions: "Questions" }[k];
    return bold ? `**${w}**` : w;
  };
  // The section's last line that says something: where a new list goes when nothing follows.
  let last = sec.at + sec.count - 1;
  while (last > sec.at && lines[last].trim() === "") last -= 1;
  const edits: Edit[] = [];
  KINDS.forEach((k, i) => {
    if (same(before[k], now[k])) return;
    const items = now[k].map((t) => `- ${t}`);
    const b = blocks[k];
    if (b && b.start >= 0) {
      if (items.length) edits.push({ at: b.start, count: b.end - b.start, lines: items });
      else {
        // The list emptied: its heading goes with it, and one blank line around it.
        const blank =
          lines[b.end] !== undefined &&
          lines[b.end].trim() === "" &&
          lines[b.heading - 1]?.trim() === "";
        edits.push({ at: b.heading, count: b.end - b.heading + (blank ? 1 : 0), lines: [] });
      }
    } else if (b) {
      if (items.length) edits.push({ at: b.heading + 1, count: 0, lines: ["", ...items] });
    } else if (items.length) {
      const prev = KINDS.slice(0, i)
        .reverse()
        .map((x) => blocks[x])
        .find(Boolean);
      const next = KINDS.slice(i + 1)
        .map((x) => blocks[x])
        .find(Boolean);
      if (prev) edits.push({ at: prev.end, count: 0, lines: ["", word(k), "", ...items] });
      else if (next) edits.push({ at: next.heading, count: 0, lines: [word(k), "", ...items, ""] });
      else edits.push({ at: last + 1, count: 0, lines: ["", word(k), "", ...items] });
    }
  });
  return edits;
}

interface Edit {
  /** The order it was made in: insertions at one line keep it. */
  seq?: number;
  /** 0-based line where the replaced lines start. */
  at: number;
  /** How many lines are replaced; 0 inserts. */
  count: number;
  lines: string[];
}

/**
 * The form written back into the brief's text. Only what changed is
 * rewritten; a brief with no front matter gets one.
 */
export function writeBriefForm(text: string, input: BriefFormInput): string {
  const src = String(text || "");
  const current = readBriefForm(src);
  const raw = linesOf(src);
  const lines = raw.map((l) => l.text);
  const eol = current.eol === "crlf" ? "\r\n" : "\n";
  const edits: Edit[] = [];

  // The modules the form holds, in its order.
  const modules = (input.modules || [])
    .map((m) => ({
      key: moduleKey(String(m.key || m.name || "")),
      name: String(m.name || m.key || "").trim(),
      prose: textOf(m.prose).trim(),
      rules: filled(m.rules),
      examples: filled(m.examples),
      questions: filled(m.questions),
    }))
    .filter((m) => m.key);

  // ── The front matter ──
  const fmIn = input.frontMatter || ({} as BriefFormInput["frontMatter"]);
  const product = String(valueOf(fmIn.product) ?? "").trim();
  const actors = (valueOf(fmIn.actors) || [])
    .map((a) => ({
      name: String(a.name || "").trim(),
      surfaces: (a.surfaces || []).map((x) => String(x).trim()).filter(Boolean),
    }))
    .filter((a) => a.name);
  const given = valueOf(fmIn.surfaces);
  const surfaces = [
    ...new Set([
      ...(given || []).map((x) => String(x).trim()),
      ...actors.flatMap((a) => a.surfaces),
    ]),
  ].filter((x) => x && !x.includes("<"));
  const keys = modules.map((m) => m.key);
  const fm = frontRange(lines);
  const blocks: Array<[string, boolean, string[]]> = [
    ["product", product !== current.frontMatter.product.value, [`product: ${product}`]],
    [
      "surfaces",
      !same(surfaces, current.frontMatter.surfaces.value),
      [`surfaces: [${surfaces.join(", ")}]`],
    ],
    [
      "actors",
      !same(
        actors.map((a) => `${a.name}|${a.surfaces.join(",")}`),
        current.frontMatter.actors.value.map((a) => `${a.name}|${a.surfaces.join(",")}`)
      ),
      [
        "actors:",
        ...actors.map((a) => `  - { name: ${a.name}, surfaces: [${a.surfaces.join(", ")}] }`),
      ],
    ],
    ["modules", !same(keys, current.frontMatter.modules.value), [`modules: [${keys.join(", ")}]`]],
  ];
  if (fm) {
    for (const [name, changed, block] of blocks) {
      if (!changed) continue;
      const r = fieldRange(lines, fm, name);
      if (!r) {
        edits.push({ at: fm.close, count: 0, lines: block });
        continue;
      }
      // Comments indented under the field are the author's notes on it: kept.
      const notes = lines.slice(r.at + 1, r.end).filter((l) => /^[ \t]+#/.test(l));
      const [head, ...rest] = block;
      edits.push({ at: r.at, count: r.end - r.at, lines: [head, ...notes, ...rest] });
    }
  } else if (blocks.some(([, changed]) => changed)) {
    edits.push({
      at: 0,
      count: 0,
      lines: [
        "---",
        ...blocks.flatMap(([, , block]) => block),
        "---",
        ...(lines[0] === "" ? [] : [""]),
      ],
    });
  }

  // ── The module sections ──
  const body = readBriefBody(src.replace(/\r\n/g, "\n"));
  const spanish = body.modules.some((s) => /^\s*\**reglas/im.test(s.source));
  const byKey = new Map(current.modules.map((m) => [m.key, m]));
  const sectionOf = new Map(
    body.modules.filter((s) => !s.name.startsWith("<")).map((s) => [moduleKey(s.name), s])
  );
  const span = (s: ModuleSection) => ({ at: s.line - 1, count: s.source.split("\n").length });
  const appended: string[][] = [];
  for (const m of modules) {
    const was = byKey.get(m.key);
    const before: ModuleText | null = was
      ? {
          name: was.name,
          prose: was.prose.text.trim(),
          rules: was.rules.map((c) => c.text),
          examples: was.examples.map((c) => c.text),
          questions: was.questions.map((c) => c.text),
        }
      : null;
    const now: ModuleText = { ...m, name: m.name || m.key };
    const unchanged =
      before &&
      (before.name === now.name || moduleKey(before.name) === moduleKey(now.name)) &&
      before.prose === now.prose &&
      same(before.rules, now.rules) &&
      same(before.examples, now.examples) &&
      same(before.questions, now.questions) &&
      (was!.section !== null ||
        (!now.prose && !now.rules.length && !now.examples.length && !now.questions.length));
    if (unchanged) continue;
    const hasText = now.prose || now.rules.length || now.examples.length || now.questions.length;
    const sec = sectionOf.get(m.key);
    if (
      was &&
      was.section === "module" &&
      sec &&
      before &&
      before.name === now.name &&
      before.prose === now.prose
    ) {
      // Only cards changed: each list is replaced where it is, the rest of the section kept.
      edits.push(...cardEdits(lines, span(sec), before, now, spanish));
    } else if (was && was.section === "module" && sec) {
      edits.push({ ...span(sec), lines: sectionLines(now, spanish) });
    } else if (was && was.section === "plain") {
      // REQ-437: `## orders` written by hand becomes the module's section, its prose in it.
      const p = plainSection(lines, 0, m.key)!;
      edits.push({
        at: p.at,
        count: p.end - p.at,
        lines: sectionLines({ ...now, name: p.name, prose: now.prose || p.prose }, spanish),
      });
    } else if (hasText) {
      appended.push(sectionLines(now, spanish));
    }
  }
  // A module the form no longer holds: its section goes, up to the next heading.
  for (const [key, sec] of sectionOf) {
    if (keys.includes(key)) continue;
    let end = sec.line;
    while (end < lines.length && !/^##\s/.test(lines[end])) end += 1;
    edits.push({ at: sec.line - 1, count: end - (sec.line - 1), lines: [] });
  }

  if (edits.length === 0 && appended.length === 0) return src;

  // Applied bottom up, so each edit's line numbers still hold.
  const out = raw.map((l) => ({ ...l }));
  edits.forEach((e, i) => (e.seq = i));
  // At one line, what replaces goes first and insertions after it, in their order.
  const inserts = (e: Edit) => (e.count > 0 ? 0 : 1);
  for (const e of edits.sort((a, b) => b.at - a.at || inserts(a) - inserts(b) || b.seq! - a.seq!)) {
    out.splice(e.at, e.count, ...e.lines.map((t) => ({ text: t, eol })));
  }
  for (const section of appended) {
    const last = out[out.length - 1];
    if (last && last.eol === "") last.eol = eol;
    if (out.length && out[out.length - 1].text.trim() !== "") out.push({ text: "", eol });
    out.push(...section.map((t) => ({ text: t, eol })));
  }
  return out.map((l) => l.text + l.eol).join("");
}
