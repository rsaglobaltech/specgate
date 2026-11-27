/**
 * The code of a requirement as UML (REQ-811, REQ-812): types with their
 * typed attributes and operations, visibility and stereotypes, read from the
 * source alone — Java and TypeScript in full, any other language through the
 * names `classesOf` reads. The method bodies are kept, unprinted, so a
 * scenario can be followed from its endpoint through the calls it makes.
 */

import { withoutCodeComments } from "./CodeComments";
import { classesOf } from "./EvidenceDiagrams";

export type Visibility = "+" | "-" | "#" | "~";

export interface UmlParam {
  readonly name: string;
  readonly type: string;
}

export interface UmlMember {
  readonly kind: "field" | "method" | "constructor";
  readonly visibility: Visibility;
  readonly name: string;
  /** A field's type, a method's return type; empty when the source gives none. */
  readonly type: string;
  readonly params: ReadonlyArray<UmlParam>;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  /** The annotations or decorators written before it, as written. */
  readonly annotations: string;
  /** A method's body, comments blanked; empty for a field or an abstract method. */
  readonly body: string;
}

export interface UmlType {
  readonly name: string;
  readonly kind: "class" | "abstract" | "interface" | "record" | "enum";
  readonly pkg: string;
  readonly file: string;
  readonly parents: ReadonlyArray<{ name: string; kind: "extends" | "implements" }>;
  readonly members: ReadonlyArray<UmlMember>;
  readonly literals: ReadonlyArray<string>;
  /** The annotations or decorators on the type, as written. */
  readonly annotations: string;
  /** The type this one is declared inside, or "". */
  readonly outer: string;
}

// ── Scanning ─────────────────────────────────────────────────────────────────

/** Blank string and char literals, keeping their length and quotes, so braces in text do not count. */
function blankStrings(text: string): string {
  let out = "";
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        out += "  ";
        i += 1;
        continue;
      }
      if (text.startsWith(quote, i)) {
        out += quote;
        i += quote.length - 1;
        quote = "";
        continue;
      }
      out += ch === "\n" ? "\n" : " ";
      continue;
    }
    if (text.startsWith('"""', i)) {
      quote = '"""';
      out += quote;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    out += ch;
  }
  return out;
}

/** The index just past the bracket that closes the one at `open`. */
function closingOf(text: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const close = pairs[text[open]];
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === text[open]) depth += 1;
    else if (text[i] === close && --depth === 0) return i + 1;
  }
  return text.length;
}

interface Piece {
  /** What comes before the block or the `;`. */
  head: string;
  /** The block's inside, or null when the piece ended at `;`. */
  block: string | null;
}

/** A body's top-level pieces: each declaration up to its `;` or its block. */
function pieces(clean: string, raw: string): Piece[] {
  const out: Piece[] = [];
  let start = 0;
  let parens = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === "(") parens += 1;
    else if (ch === ")") parens = Math.max(0, parens - 1);
    else if (ch === ";" && parens === 0) {
      out.push({ head: raw.slice(start, i).trim(), block: null });
      start = i + 1;
    } else if (ch === "{" && parens === 0) {
      const end = closingOf(clean, i);
      out.push({ head: raw.slice(start, i).trim(), block: raw.slice(i + 1, end - 1) });
      start = end;
      i = end - 1;
    } else if (ch === "}") {
      start = i + 1;
    }
  }
  const rest = raw.slice(start).trim();
  if (rest) out.push({ head: rest, block: null });
  return out.filter((p) => p.head || p.block !== null);
}

/** Leading annotations (`@X`, `@X(...)`) or decorators, split from what follows. */
function splitAnnotations(head: string): { annotations: string; rest: string } {
  let i = 0;
  const s = head;
  const taken: string[] = [];
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (s[i] !== "@") break;
    const m = /^@[\w.]+/.exec(s.slice(i));
    if (!m) break;
    let end = i + m[0].length;
    let j = end;
    while (j < s.length && /\s/.test(s[j])) j += 1;
    if (s[j] === "(") end = closingOf(blankStrings(s), j);
    taken.push(s.slice(i, end));
    i = end;
  }
  return { annotations: taken.join(" "), rest: s.slice(i).trim() };
}

/** Split on commas at depth zero of `<>`, `()`, `[]`, `{}`. */
function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of text) {
    if ("<([{".includes(ch)) depth += 1;
    else if (">)]}".includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s*([<>,])\s*/g, "$1").replace(/,/g, ", ").trim();

// ── Java ─────────────────────────────────────────────────────────────────────

const JAVA_MODIFIERS = new Set([
  "public", "private", "protected", "static", "final", "abstract", "sealed", "non-sealed",
  "default", "synchronized", "native", "transient", "volatile", "strictfp",
]);
const JAVA_TYPE = /^((?:[\w-]+\s+)*)(class|interface|record|enum|@interface)\s+(\w+)\s*(<[^{]*?>)?\s*(\([^)]*\))?([^{]*)$/s;

function javaVisibility(mods: string[], inInterface: boolean): Visibility {
  if (mods.includes("public") || inInterface) return "+";
  if (mods.includes("private")) return "-";
  if (mods.includes("protected")) return "#";
  return "~";
}

/**
 * `public static <T> Map<String, List<T>> name` → its modifiers, its type
 * and its name: the name is the last word, the modifiers lead, and a method's
 * own type parameters after them are dropped.
 */
function javaDeclaration(text: string): { mods: string[]; type: string; name: string } {
  const decl = text.trim();
  const last = /([\w$]+)\s*$/.exec(decl);
  if (!last) return { mods: [], type: "", name: "" };
  let rest = decl.slice(0, last.index).trim();
  const mods: string[] = [];
  for (;;) {
    const m = /^([\w-]+)(?:\s+|$)/.exec(rest);
    if (!m || !JAVA_MODIFIERS.has(m[1])) break;
    mods.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  if (rest.startsWith("<")) rest = rest.slice(closingAngle(rest)).trim();
  return { mods, type: tidy(rest), name: last[1] };
}

function closingAngle(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "<") depth += 1;
    else if (s[i] === ">" && --depth === 0) return i + 1;
  }
  return s.length;
}

function javaParams(list: string): UmlParam[] {
  return splitTop(list)
    .map((p) => splitAnnotations(p).rest.replace(/^final\s+/, ""))
    .map((p) => {
      const m = /^(.+?)\s+(\w+)$/s.exec(p.trim());
      return m ? { name: m[2], type: tidy(m[1]) } : null;
    })
    .filter((p): p is UmlParam => p !== null);
}

function javaParents(tail: string): UmlType["parents"] {
  const names = (s: string) =>
    splitTop(s)
      .map((p) => p.replace(/<.*$/s, "").trim())
      .filter((p) => /^[\w.]+$/.test(p))
      .map((p) => p.split(".").pop() as string);
  const out: Array<{ name: string; kind: "extends" | "implements" }> = [];
  const ext = /\bextends\s+(.+?)(?=\bimplements\b|\bpermits\b|$)/s.exec(tail);
  const imp = /\bimplements\s+(.+?)(?=\bpermits\b|$)/s.exec(tail);
  for (const n of ext ? names(ext[1]) : []) out.push({ name: n, kind: "extends" });
  for (const n of imp ? names(imp[1]) : []) out.push({ name: n, kind: "implements" });
  return out;
}

function javaTypesIn(
  file: string,
  pkg: string,
  raw: string,
  outer: string,
  out: UmlType[]
): void {
  const clean = blankStrings(raw);
  for (const p of pieces(clean, raw)) {
    if (p.block === null) continue;
    const { annotations, rest } = splitAnnotations(p.head);
    const m = JAVA_TYPE.exec(rest);
    if (!m) continue;
    const mods = m[1].trim().split(/\s+/).filter(Boolean);
    const keyword = m[2];
    if (keyword === "@interface") continue;
    const name = m[3];
    const kind: UmlType["kind"] =
      keyword === "class" && mods.includes("abstract")
        ? "abstract"
        : (keyword as UmlType["kind"]);
    const members: UmlMember[] = [];
    const literals: string[] = [];
    if (keyword === "record" && m[5]) {
      for (const c of javaParams(m[5].slice(1, -1))) {
        members.push({
          kind: "field", visibility: "-", name: c.name, type: c.type, params: [],
          isStatic: false, isAbstract: false, annotations: "", body: "",
        });
      }
    }
    let body = p.block;
    if (keyword === "enum") {
      const cleanBody = blankStrings(body);
      let end = cleanBody.length;
      let depth = 0;
      for (let i = 0; i < cleanBody.length; i += 1) {
        const ch = cleanBody[i];
        if ("({".includes(ch)) depth += 1;
        else if (")}".includes(ch)) depth -= 1;
        else if (ch === ";" && depth === 0) {
          end = i;
          break;
        }
      }
      for (const lit of splitTop(body.slice(0, end))) {
        const id = /^(?:@\w+\s*)*(\w+)/.exec(lit.trim());
        if (id) literals.push(id[1]);
      }
      body = end < body.length ? body.slice(end + 1) : "";
    }
    const inInterface = keyword === "interface";
    for (const q of pieces(blankStrings(body), body)) {
      const a = splitAnnotations(q.head);
      if (JAVA_TYPE.test(a.rest)) continue;
      const head = a.rest;
      const paren = head.indexOf("(");
      if (paren >= 0) {
        const { mods: mmods, type, name: mname } = javaDeclaration(head.slice(0, paren));
        if (!/^\w+$/.test(mname)) continue;
        const close = closingOf(blankStrings(head), paren);
        const isCtor = mname === name && !type;
        members.push({
          kind: isCtor ? "constructor" : "method",
          visibility: javaVisibility(mmods, inInterface && !mmods.includes("private")),
          name: mname,
          type: isCtor ? "" : type,
          params: javaParams(head.slice(paren + 1, close - 1)),
          isStatic: mmods.includes("static"),
          isAbstract: mmods.includes("abstract") || (inInterface && q.block === null && !mmods.includes("static")),
          annotations: a.annotations,
          body: q.block || "",
        });
      } else if (q.block === null && head) {
        const { mods: fmods, type, name: fname } = javaDeclaration(head.split("=")[0]);
        if (!/^\w+$/.test(fname) || !type) continue;
        members.push({
          kind: "field",
          visibility: javaVisibility(fmods, inInterface),
          name: fname,
          type,
          params: [],
          isStatic: fmods.includes("static") || inInterface,
          isAbstract: false,
          annotations: a.annotations,
          body: "",
        });
      }
    }
    out.push({
      name, kind, pkg, file, parents: javaParents(m[6] || ""), members, literals,
      annotations, outer,
    });
    javaTypesIn(file, pkg, body, name, out);
  }
}

function javaTypes(file: string, source: string): UmlType[] {
  const text = withoutCodeComments(file, source);
  const pkg = (/^\s*package\s+([\w.]+)\s*;/m.exec(text) || [])[1] || "";
  const body = text.replace(/^\s*(?:package|import)\b[^;]*;/gm, "");
  const out: UmlType[] = [];
  javaTypesIn(file, pkg, body, "", out);
  return out;
}

// ── TypeScript ───────────────────────────────────────────────────────────────

const TS_TYPE =
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(abstract\s+)?(class|interface|enum)\s+([A-Za-z_$][\w$]*)\s*(<[^{]*?>)?([^{]*)$/s;

function tsParams(list: string): UmlParam[] {
  return splitTop(list)
    .map((p) => splitAnnotations(p).rest.replace(/^(?:(?:public|private|protected|readonly|override)\s+)+/, ""))
    .map((p) => {
      const m = /^(\.\.\.)?([A-Za-z_$][\w$]*)\??\s*(?::\s*([^=]+))?/s.exec(p.trim());
      return m ? { name: m[2], type: m[3] ? tidy(m[3]) : "" } : null;
    })
    .filter((p): p is UmlParam => p !== null);
}

/**
 * A TS body's declarations: its pieces, each split again at a line break
 * outside brackets, since a member may end at the line instead of a ;.
 */
function tsDeclarations(body: string): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces(blankStrings(body), body)) {
    const clean = blankStrings(p.head);
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < clean.length; i += 1) {
      if ("([<{".includes(clean[i])) depth += 1;
      else if (")]>}".includes(clean[i])) depth = Math.max(0, depth - 1);
      else if (clean[i] === "\n" && depth === 0) {
        parts.push(p.head.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(p.head.slice(start));
    const heads = parts.map((x) => x.trim()).filter(Boolean);
    // An annotation or decorator on its own line belongs to the next declaration.
    const merged: string[] = [];
    for (const h of heads) {
      if (merged.length && /^@[\w.]+(\(.*\))?$/s.test(merged[merged.length - 1])) merged[merged.length - 1] += " " + h;
      else merged.push(h);
    }
    merged.forEach((h, i) => out.push({ head: h, block: i === merged.length - 1 ? p.block : null }));
  }
  return out;
}

function tsTypes(file: string, source: string): UmlType[] {
  const raw = withoutCodeComments(file, source);
  const out: UmlType[] = [];
  for (const p of pieces(blankStrings(raw), raw)) {
    if (p.block === null) continue;
    const { annotations, rest } = splitAnnotations(p.head.split("\n").filter((l) => !/^\s*import\b/.test(l)).join("\n"));
    const lastLine = rest.split(/;\s*/).pop() || "";
    const m = TS_TYPE.exec(lastLine.trim());
    if (!m) continue;
    const keyword = m[2];
    const kind: UmlType["kind"] = m[1] ? "abstract" : (keyword as UmlType["kind"]);
    const members: UmlMember[] = [];
    const literals: string[] = [];
    if (keyword === "enum") {
      for (const lit of splitTop(p.block)) {
        const id = /^([A-Za-z_$][\w$]*)/.exec(lit.trim());
        if (id) literals.push(id[1]);
      }
    } else {
      for (const q of tsDeclarations(p.block)) {
        const a = splitAnnotations(q.head);
        let head = a.rest.replace(/[,;]\s*$/, "");
        const mods = (/^((?:(?:public|private|protected|static|readonly|abstract|async|override|declare|get|set)\s+)*)/.exec(head) || ["", ""])[1];
        head = head.slice(mods.length);
        const words = mods.trim().split(/\s+/).filter(Boolean);
        const visibility: Visibility =
          words.includes("private") || head.startsWith("#") ? "-" : words.includes("protected") ? "#" : "+";
        const name = (/^#?([A-Za-z_$][\w$]*)/.exec(head) || [])[1];
        if (!name) continue;
        const afterName = head.slice(head.indexOf(name) + name.length).replace(/^[?!]/, "").trimStart();
        if (afterName.startsWith("(") || afterName.startsWith("<")) {
          const paren = head.indexOf("(");
          const close = closingOf(blankStrings(head), paren);
          const ret = (/^\s*:\s*(.+)$/s.exec(head.slice(close)) || [])[1] || "";
          const params = tsParams(head.slice(paren + 1, close - 1));
          const isCtor = name === "constructor";
          members.push({
            kind: isCtor ? "constructor" : "method", visibility, name: isCtor ? m[3] : name,
            type: tidy(ret), params, isStatic: words.includes("static"),
            isAbstract: words.includes("abstract") || (keyword === "interface"),
            annotations: a.annotations, body: q.block || "",
          });
          if (isCtor) {
            // Parameter properties are fields: `constructor(readonly status: number)`.
            for (const raw of splitTop(head.slice(paren + 1, close - 1))) {
              const pm = /^((?:public|private|protected|readonly)\s+)+([A-Za-z_$][\w$]*)\??\s*(?::\s*([^=]+))?/.exec(raw.trim());
              if (!pm) continue;
              members.push({
                kind: "field", visibility: /private/.test(pm[1]) ? "-" : /protected/.test(pm[1]) ? "#" : "+",
                name: pm[2], type: tidy(pm[3] || ""), params: [], isStatic: false, isAbstract: false,
                annotations: "", body: "",
              });
            }
          }
        } else {
          const type = (/^:\s*([^=]+)/.exec(afterName) || [])[1] || "";
          members.push({
            kind: "field", visibility, name, type: tidy(type), params: [], isStatic: words.includes("static"),
            isAbstract: false, annotations: a.annotations, body: "",
          });
        }
      }
    }
    const tail = m[5] || "";
    const parents: Array<{ name: string; kind: "extends" | "implements" }> = [];
    const ext = /\bextends\s+(.+?)(?=\bimplements\b|$)/s.exec(tail);
    const imp = /\bimplements\s+(.+)$/s.exec(tail);
    const names = (s: string) => splitTop(s).map((x) => x.replace(/<.*$/s, "").trim()).filter((x) => /^[\w$.]+$/.test(x));
    for (const n of ext ? names(ext[1]) : []) parents.push({ name: n, kind: keyword === "interface" ? "extends" : "extends" });
    for (const n of imp ? names(imp[1]) : []) parents.push({ name: n, kind: "implements" });
    out.push({ name: m[3], kind, pkg: "", file, parents, members, literals, annotations, outer: "" });
  }
  return out;
}

// ── Any language ─────────────────────────────────────────────────────────────

/** The types a file declares, in file order, nested ones after their outer type. */
export function umlTypesOf(file: string, source: string): UmlType[] {
  if (/\.java$/i.test(file)) return javaTypes(file, source);
  if (/\.(ts|tsx|mts|cts)$/i.test(file)) return tsTypes(file, source);
  return classesOf(file, source).map((c) => ({
    name: c.name,
    kind: "class" as const,
    pkg: "",
    file,
    parents: c.parents,
    literals: [],
    annotations: "",
    outer: "",
    members: c.members.map((x) => ({
      kind: x.endsWith("()") ? ("method" as const) : ("field" as const),
      visibility: "+" as const,
      name: x.replace(/\(\)$/, ""),
      type: "",
      params: [],
      isStatic: false,
      isAbstract: false,
      annotations: "",
      body: "",
    })),
  }));
}

/** The simple type names a written type mentions: `Mono<List<Order>>` → Mono, List, Order. */
export function typeNames(type: string): string[] {
  return [...new Set((type.match(/[A-Za-z_$][\w$]*/g) || []).map((n) => n))];
}

/** Whether a written type holds many of what it names. */
export function isMany(type: string): boolean {
  return /\[\]|\b(?:List|Set|Collection|Iterable|Flux|Stream|Array|ReadonlyArray|Map)\b/.test(type);
}
