/**
 * A requirement drawn, before and after (ADR-0047, REQ-806): Mermaid text
 * that GitHub renders, computed from the spec and the code alone, so the same
 * input gives the same text — evidence that a gate keeps must not change from
 * one run to the next. Approximate by design: a scenario's calls are the
 * `METHOD /path` its steps name, a class is what a pattern reads of it.
 */

import { withoutCodeComments } from "./CodeComments";

export interface ScenarioSteps {
  readonly title: string;
  readonly steps: ReadonlyArray<string>;
}

export interface ClassShape {
  readonly name: string;
  readonly parents: ReadonlyArray<{ name: string; kind: "extends" | "implements" }>;
  readonly members: ReadonlyArray<string>;
}

/** Mermaid ends a statement at `;` and reads `#` as an entity: both written as entities. */
const escape = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[#;]/g, (ch) => (ch === "#" ? "#35;" : "#59;"));

const KEYWORD = /^(given|when|then|and|but)\b\s*/i;
const CALL = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s;,)"'`]*)/g;

/** A scenario as a sequence: GIVEN a note, each call a WHEN names a message, THEN a reply. */
export function sequenceDiagram(scenario: ScenarioSteps, actor: string): string {
  const out = [
    "sequenceDiagram",
    `  title ${escape(scenario.title)}`,
    `  actor A as ${escape(actor || "User")}`,
    "  participant S as System",
  ];
  const given: string[] = [];
  let kind = "given";
  const flushGiven = () => {
    if (given.length) out.push(`  Note over A,S: ${escape(given.join("; "))}`);
    given.length = 0;
  };
  for (const raw of scenario.steps) {
    const m = KEYWORD.exec(raw.trim());
    const word = m ? m[1].toLowerCase() : "";
    if (word === "given" || word === "when" || word === "then") kind = word;
    const text = raw.trim().slice(m ? m[0].length : 0);
    if (!text) continue;
    if (kind === "given") {
      given.push(text);
      continue;
    }
    flushGiven();
    if (kind === "when") {
      const calls = [...text.matchAll(CALL)].map((c) => `${c[1]} ${c[2]}`);
      for (const call of calls.length ? calls : [text]) out.push(`  A->>S: ${escape(call)}`);
    } else {
      out.push(`  S-->>A: ${escape(text)}`);
    }
  }
  flushGiven();
  return out.join("\n") + "\n";
}

// ── Classes ──────────────────────────────────────────────────────────────────

type Family = "ts" | "java" | "cs" | "kotlin" | "python";

function familyOf(file: string): Family | null {
  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(file)) return "ts";
  if (/\.java$/i.test(file)) return "java";
  if (/\.cs$/i.test(file)) return "cs";
  if (/\.(kt|kts)$/i.test(file)) return "kotlin";
  if (/\.py$/i.test(file)) return "python";
  return null;
}

/** The index just past the brace that closes the one at `open`. */
function closing(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return i + 1;
  }
  return source.length;
}

/** A class body's own statements: what sits at its top level, split where a statement ends. */
function statements(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let parens = 0;
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const ch of body) {
    if (ch === "{") {
      if (depth === 0) flush();
      depth += 1;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      if (ch === "(") parens += 1;
      if (ch === ")") parens = Math.max(0, parens - 1);
      if ((ch === ";" || ch === "\n") && parens === 0) flush();
      else buf += ch;
    }
  }
  flush();
  return out;
}

const TS_HIDDEN = /^(?:private|protected)\b|^#|\b(?:private|protected)\s/;
const TS_METHOD =
  /^(?:(?:public|static|async|override|readonly|abstract|get|set)\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*[?!]?\s*(?:<[^>]*>)?\s*\(/;
const TS_FIELD =
  /^(?:(?:public|static|readonly|declare|override|abstract)\s+)*([A-Za-z_$][\w$]*)\s*[?!]?\s*[:=]/;
const PUBLIC_METHOD = /\bpublic\b[^=(]*?\b(\w+)\s*(?:<[^>]*>)?\s*\(/;
const PUBLIC_FIELD = /\bpublic\b[^=(;]*?\b(\w+)\s*(?:=|$)/;

function membersOf(family: Family, body: string): string[] {
  const out: string[] = [];
  for (const s of statements(body)) {
    if (s.startsWith("@") || s.startsWith("[")) continue;
    let name = "";
    if (family === "ts") {
      // The modifiers before the parameters: `constructor(private repo)` is public.
      if (TS_HIDDEN.test(s.split("(")[0])) continue;
      const m = TS_METHOD.exec(s);
      const f = m ? null : TS_FIELD.exec(s);
      if (m) name = `${m[1]}()`;
      else if (f) name = f[1];
    } else if (family === "kotlin") {
      if (/\b(?:private|protected|internal)\s/.test(s.split("(")[0])) continue;
      const m = /\bfun\s+(?:<[^>]*>\s*)?(?:\w+\.)?(\w+)\s*\(/.exec(s);
      const f = m ? null : /\b(?:val|var)\s+(\w+)/.exec(s);
      if (m) name = `${m[1]}()`;
      else if (f) name = f[1];
    } else {
      const m = PUBLIC_METHOD.exec(s);
      const f = m ? null : PUBLIC_FIELD.exec(s);
      if (m) name = `${m[1]}()`;
      else if (f) name = f[1];
    }
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const C_HEADER =
  /\b(class|interface|record|enum|object)\s+([A-Za-z_$][\w$]*)[ \t]*(?:<[^>{\n]*>)?[ \t]*(\([^)]*\))?([^{;\n]*)/g;

function parentsOf(
  family: Family,
  kind: string,
  tail: string
): Array<{ name: string; kind: "extends" | "implements" }> {
  const names = (s: string) =>
    s
      .split(",")
      .map((p) => p.replace(/<.*$|\(.*$/s, "").trim())
      .filter((p) => /^[A-Za-z_$][\w$.]*$/.test(p));
  const out: Array<{ name: string; kind: "extends" | "implements" }> = [];
  if (family === "ts" || family === "java") {
    const ext = /\bextends\s+(.+?)(?=\bimplements\b|$)/s.exec(tail);
    const imp = /\bimplements\s+(.+)$/s.exec(tail);
    for (const n of ext ? names(ext[1]) : []) out.push({ name: n, kind: "extends" });
    for (const n of imp ? names(imp[1]) : []) out.push({ name: n, kind: "implements" });
    return out;
  }
  const colon = /^\s*:\s*(.+)$/s.exec(tail);
  if (!colon) return out;
  const raw = colon[1].split(",").map((p) => p.trim());
  raw.forEach((p, i) => {
    const [n] = names(p);
    if (!n) return;
    const isClass =
      family === "kotlin" ? /\(/.test(p) : i === 0 && kind === "class" && !/^I[A-Z]/.test(n);
    out.push({ name: n, kind: isClass ? "extends" : "implements" });
  });
  return out;
}

function pythonClasses(source: string): ClassShape[] {
  const lines = source.split(/\r?\n/);
  const out: ClassShape[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const parents = (m[3] || "")
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !p.includes("=") && p !== "object")
      .map((name) => ({ name, kind: "extends" as const }));
    const members: string[] = [];
    let memberIndent = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (!line.trim()) continue;
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      if (memberIndent < 0) memberIndent = lead;
      if (lead !== memberIndent) continue;
      const d = /^(?:async\s+)?def\s+(\w+)\s*\(/.exec(line.trim());
      const name = d ? d[1] : (/^(\w+)\s*(?::[^=]*)?=/.exec(line.trim()) || [])[1];
      if (!name || /^_(?!_)/.test(name)) continue;
      const shown = d ? `${name}()` : name;
      if (!members.includes(shown)) members.push(shown);
    }
    out.push({ name: m[2], parents, members });
  }
  return out;
}

/** The classes and interfaces of a file, with their public members and parents, in file order. */
export function classesOf(file: string, source: string): ClassShape[] {
  const family = familyOf(file);
  if (!family) return [];
  const text = withoutCodeComments(file, source);
  if (family === "python") return pythonClasses(text);
  const out: ClassShape[] = [];
  C_HEADER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = C_HEADER.exec(text)) !== null) {
    const [, kind, name, , tail] = m;
    if (kind === "object" && family !== "kotlin") continue;
    const after = m.index + m[0].length;
    const open = text.indexOf("{", after - 1);
    const hasBody = open >= 0 && text.slice(after, open).trim() === "";
    const body = hasBody ? text.slice(open + 1, closing(text, open) - 1) : "";
    out.push({ name, parents: parentsOf(family, kind, tail), members: membersOf(family, body) });
    if (hasBody) C_HEADER.lastIndex = closing(text, open);
  }
  return out;
}

/** The classes now, their parents, and in a note what changed since the base (null: no base). */
export function classDiagram(file: string, before: string | null, after: string): string {
  const now = classesOf(file, after);
  const then = before === null ? null : classesOf(file, before);
  const out = ["classDiagram"];
  for (const c of now) {
    if (c.members.length === 0) out.push(`  class ${c.name}`);
    else out.push(`  class ${c.name} {`, ...c.members.map((x) => `    +${x}`), "  }");
  }
  for (const c of now) {
    for (const p of c.parents) {
      out.push(`  ${p.name} ${p.kind === "extends" ? "<|--" : "<|.."} ${c.name}`);
    }
  }
  for (const c of now) {
    const was = then?.find((x) => x.name === c.name);
    if (!was) {
      out.push(`  note for ${c.name} "new"`);
      continue;
    }
    const added = c.members.filter((x) => !was.members.includes(x));
    const removed = was.members.filter((x) => !c.members.includes(x));
    const lines = [
      ...(added.length ? [`added: ${added.join(", ")}`] : []),
      ...(removed.length ? [`removed: ${removed.join(", ")}`] : []),
    ];
    if (lines.length) out.push(`  note for ${c.name} "${lines.join("\\n")}"`);
  }
  for (const c of then || []) {
    if (!now.some((x) => x.name === c.name)) out.push(`  %% removed since the base: ${c.name}`);
  }
  return out.join("\n") + "\n";
}
