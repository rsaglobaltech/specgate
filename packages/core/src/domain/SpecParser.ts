#!/usr/bin/env node
/**
 * Shared markdown AST for capability specs and delta specs.
 *
 * One parser, two consumers:
 *   - `parseSpec`  — the source of truth under docs/specs/capabilities/<cap>/spec.md
 *   - `parseDelta` — the ADDED / MODIFIED / REMOVED sections inside a change
 *
 * Both shapes are the same underneath: a list of requirements, each with a
 * body and one or more scenarios. Keeping a single AST is what lets `archive`
 * apply a delta to a spec without a second, subtly different parser.
 *
 * Grammar (a superset of the OpenSpec markdown form — the `REQ-NNN` id and the
 * `specgate:trace` comment are ours, and both are optional):
 *
 *   # <title>
 *   ## Purpose
 *   <free text>
 *   ## Requirements
 *   ### Requirement: REQ-014 — Dynamic peak pricing
 *   El sistema SHALL ...
 *   #### Scenario: SCN-014a — Recargo en hora punta
 *   - GIVEN una sesión iniciada a las 18:00
 *   - WHEN se calcula la tarifa
 *   - THEN el importe incluye un recargo del 20 %
 *   <!-- specgate:trace uc=UC-007 cmd=CMD-011 feature=features/billing/x.feature -->
 */

/**
 * Line-oriented, and written so no two adjacent quantifiers can match the same
 * character.
 *
 * Two things caused `js/polynomial-redos` here. `\s` matches a newline, which
 * makes a line pattern span lines; and `[ \t]+(.*)` is ambiguous, because `.`
 * matches a space too, so the engine can split a run of spaces between the two
 * in every possible way.
 *
 * So each pattern consumes exactly one separator and captures the rest of the
 * line. What the regex no longer trims, the code does — the same meaning, in
 * linear time.
 */
const RE_H1 = /^#[ \t]+([^ \t].*)?$/;
const RE_H2 = /^##[ \t]+([^ \t].*)?$/;
const RE_REQUIREMENT = /^###[ \t]+Requirement:[ \t]*([^ \t].*)?$/;
const RE_SCENARIO = /^####[ \t]+Scenario:[ \t]*([^ \t].*)?$/;
const RE_TRACE_OPEN = /^\s*<!--\s*specgate:trace\b/;
const RE_STEP = /^[ \t]*[-*][ \t]+([^ \t].*)?$/;

// `REQ-014 — Dynamic peak pricing` → ["REQ-014", "Dynamic peak pricing"].
// The separator may be an em dash, en dash, hyphen or colon; any amount of
// surrounding whitespace is tolerated.
//
// The prefix list is closed on purpose. A permissive `[A-Z]{2,4}-\w+` would
// read "TOTP-based two-factor auth" as an id of "TOTP-based", silently
// mangling every requirement whose name starts with an acronym.
const RE_LABEL_ID = /^((?:REQ|SCN|UC|CMD|QRY|AGG|EVT)-[A-Za-z0-9.]+)/;

export const REQ_ID = /^REQ-\d+$/;
export const SCN_ID = /^SCN-[A-Za-z0-9.-]+$/;

/** Stable key for matching a requirement across a delta and a spec. */
export function slug(text: unknown): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitLabel(label: string): { id: string | null; name: string } {
  // The id by pattern, the rest by index. One regex covering both meant a
  // quantifier for the id sitting next to one for the name, which is the
  // ambiguity `js/polynomial-redos` reports — and `REQ-014 — Title` is easier
  // to read as two steps anyway.
  const text = String(label).trim();
  const m = RE_LABEL_ID.exec(text);
  if (!m) return { id: null, name: text };

  const rest = text
    .slice(m[1].length)
    .replace(/^[ \t]+/, "")
    .replace(/^[—–:-][ \t]*/, "");
  return { id: m[1], name: rest.trim() || m[1] };
}

/**
 * The identity of a requirement. Prefer the explicit id; fall back to a slug of
 * the name so pure-markdown specs (no REQ ids) still round-trip.
 */
export function requirementKey(req: Pick<RequirementNode, "id" | "name">): string;
export function requirementKey(req: null | undefined): null;
export function requirementKey(
  req: Pick<RequirementNode, "id" | "name"> | null | undefined
): string | null;
export function requirementKey(
  req: Pick<RequirementNode, "id" | "name"> | null | undefined
): string | null {
  if (!req) return null;
  return req.id ? req.id.toUpperCase() : `name:${slug(req.name)}`;
}

export function parseTraceComment(raw: string): TraceComment {
  // `uc=UC-007 cmd=CMD-011 feature=features/a.feature` → object.
  // Values may be quoted to allow spaces.
  const trace: TraceComment = {};
  // Strip the delimiters by index rather than by pattern. `-->` inside a regex
  // is what CodeQL reads as a hand-rolled HTML tag filter (`js/bad-tag-filter`),
  // and it is right that a regex is the wrong tool for finding the end of a
  // comment. `trim()` then does what the anchored whitespace was for.
  let body = raw.replace(/^[ \t]*<!--[ \t]*specgate:trace\b/, "").trim();
  if (body.endsWith("-->")) body = body.slice(0, -3).trim();
  // `\b` so the scan cannot restart inside a run of letters, `[ \t]*` on both
  // sides of `=`, and an unquoted value that cannot contain a space. Without
  // the first, a long word with no `=` after it is retried from every position;
  // without the others, a run of spaces can be divided between two quantifiers
  // in every possible way.
  const re = /\b([a-z_]+)[ \t]*=[ \t]*("([^"]*)"|'([^']*)'|([^\s"']+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
    trace[m[1].toLowerCase()] = value;
  }
  return trace;
}

/**
 * The AST every spec and delta parses into.
 *
 * One tree for both shapes is what lets `archive` apply a delta to a spec
 * without a second, subtly different parser — so it is worth naming rather
 * than leaving as four `any`s inside the loop that builds it.
 */

/** `uc=UC-007 depends=REQ-001` → `{ uc: "UC-007", depends: "REQ-001" }`. */
export type TraceComment = Record<string, string>;

export interface ScenarioNode {
  id: string | null;
  name: string;
  heading: string;
  line: number;
  steps: string[];
}

export interface RequirementNode {
  id: string | null;
  name: string;
  heading: string;
  line: number;
  /**
   * Lines while `parseMarkdown` is accumulating them, one string once
   * `parseSpec` / `parseDelta` have collapsed the block. Use `blockText` to
   * read it without caring which stage produced the node.
   */
  text: string[] | string;
  scenarios: ScenarioNode[];
  trace: TraceComment;
  /** Set by `parseSpec` / `parseDelta`: the identity two documents match on. */
  key?: string | null;
  /**
   * Set by `parseDelta`: which section of the delta the block came from.
   * `renamed` is recognised as a section but carries no operation `archive`
   * applies.
   */
  op?: DeltaOperation | "renamed";
}

/** The three things a delta can say about a requirement. */
export type DeltaOperation = "added" | "modified" | "removed";

/** A heading the delta grammar does not recognise, kept so it can be reported. */
export interface UnknownSection {
  heading: string | null;
  line: number;
}

export interface SectionNode {
  heading: string | null;
  line: number;
  /** Lines, then one string — see `RequirementNode.text`. */
  body: string[] | string;
  requirements: RequirementNode[];
}

export interface DocumentNode {
  title: string | null;
  sections: SectionNode[];
  /** Lines, then one string — see `RequirementNode.text`. */
  preamble: string[] | string;
}

/** Read a block whichever stage produced it. */
export function blockText(block: string[] | string | null | undefined): string {
  if (Array.isArray(block)) return block.join("\n");
  return block ?? "";
}

/** A delta document: the same tree, sorted into what it does to the spec. */
export interface DeltaNode {
  title: string | null;
  purpose: string | string[];
  added: RequirementNode[];
  modified: RequirementNode[];
  removed: RequirementNode[];
  renamed: unknown[];
  unknownSections: UnknownSection[];
  sections: SectionNode[];
}

/**
 * Low-level parse. Returns every `##` section with the requirements nested
 * under it, preserving source line numbers so diagnostics can point at them.
 */
export function parseMarkdown(source: string): DocumentNode {
  const lines = String(source == null ? "" : source).split(/\r?\n/);
  const doc: DocumentNode = { title: null, sections: [], preamble: [] };

  let section: SectionNode | null = null;
  let requirement: RequirementNode | null = null;
  let scenario: ScenarioNode | null = null;
  let traceBuffer: string[] | null = null;

  /**
   * Blocks are arrays while this function builds them and strings after
   * `trimBlock` collapses them at the end. The cast is confined here rather
   * than repeated at each of the four places a line is appended.
   */
  const appendLine = (block: string[] | string, line: string): void => {
    (block as string[]).push(line);
  };

  const closeScenario = () => {
    scenario = null;
  };
  const closeRequirement = () => {
    closeScenario();
    requirement = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // A multi-line `<!-- specgate:trace ... -->` comment attaches to the requirement
    // it sits under, wherever inside it appears.
    if (traceBuffer !== null) {
      traceBuffer.push(line);
      if (line.includes("-->")) {
        const parsed = parseTraceComment(traceBuffer.join("\n"));
        if (requirement) requirement.trace = { ...requirement.trace, ...parsed };
        traceBuffer = null;
      }
      continue;
    }
    if (RE_TRACE_OPEN.test(line)) {
      if (line.includes("-->")) {
        const parsed = parseTraceComment(line);
        if (requirement) requirement.trace = { ...requirement.trace, ...parsed };
      } else {
        traceBuffer = [line];
      }
      continue;
    }

    let m;

    if ((m = RE_H1.exec(line)) !== null) {
      if (doc.title === null) doc.title = (m[1] || "").trim();
      closeRequirement();
      section = null;
      continue;
    }

    if ((m = RE_H2.exec(line)) !== null) {
      closeRequirement();
      section = {
        heading: (m[1] || "").trim(),
        line: lineNo,
        body: [],
        requirements: [],
      };
      doc.sections.push(section);
      continue;
    }

    if ((m = RE_REQUIREMENT.exec(line)) !== null) {
      closeRequirement();
      const { id, name } = splitLabel((m[1] || "").trim());
      requirement = {
        id,
        name,
        heading: m[1],
        line: lineNo,
        text: [],
        scenarios: [],
        trace: {},
      };
      if (!section) {
        // A requirement before any `##` heading still belongs somewhere.
        section = { heading: null, line: lineNo, body: [], requirements: [] };
        doc.sections.push(section);
      }
      section.requirements.push(requirement);
      continue;
    }

    if ((m = RE_SCENARIO.exec(line)) !== null) {
      const heading = (m[1] || "").trim();
      const { id, name } = splitLabel(heading);
      scenario = { id, name, heading, line: lineNo, steps: [] };
      if (requirement) requirement.scenarios.push(scenario);
      continue;
    }

    if (scenario) {
      const step = RE_STEP.exec(line);
      if (step) {
        scenario.steps.push((step[1] || "").trim());
        continue;
      }
      if (line.trim() === "") continue;
      // Non-list prose after a scenario ends the scenario but stays with the
      // requirement body, so nothing is silently dropped.
      closeScenario();
      if (requirement) appendLine(requirement.text, line);
      continue;
    }

    if (requirement) {
      appendLine(requirement.text, line);
      continue;
    }
    if (section) {
      appendLine(section.body, line);
      continue;
    }
    appendLine(doc.preamble, line);
  }

  // Normalise the collected free text: trim leading/trailing blank lines.
  const trimBlock = (arr: string[] | string): string => {
    if (!Array.isArray(arr)) return arr;
    const out = arr.slice();
    while (out.length && out[0].trim() === "") out.shift();
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    return out.join("\n");
  };

  for (const s of doc.sections) {
    s.body = trimBlock(s.body);
    for (const r of s.requirements) {
      r.text = trimBlock(r.text);
      r.key = requirementKey(r);
    }
  }
  doc.preamble = trimBlock(doc.preamble);

  return doc;
}

export function findSection(doc: Pick<DocumentNode, "sections">, name: string): SectionNode | null {
  const wanted = String(name).toLowerCase();
  return doc.sections.find((s) => s.heading && s.heading.toLowerCase() === wanted) || null;
}

/**
 * A capability spec: a Purpose plus a flat list of requirements. Requirements
 * are collected from every section so a hand-written spec that omits the
 * `## Requirements` heading still parses.
 */
/** A capability spec as `parseSpec` returns it. */
export interface SpecNode {
  title: string | null;
  purpose: string[] | string;
  requirements: RequirementNode[];
  sections: SectionNode[];
}

export function parseSpec(source: string): SpecNode {
  const doc = parseMarkdown(source);
  const purposeSection = findSection(doc, "Purpose");
  const requirements: RequirementNode[] = [];
  for (const s of doc.sections) {
    for (const r of s.requirements) requirements.push(r);
  }
  return {
    title: doc.title,
    purpose: purposeSection ? purposeSection.body : "",
    requirements,
    sections: doc.sections,
  };
}

/** Which delta bucket each recognised `##` heading fills, by lower-cased heading. */
export const DELTA_SECTIONS: Record<string, DeltaOperation | "renamed"> = {
  "added requirements": "added",
  "modified requirements": "modified",
  "removed requirements": "removed",
  "renamed requirements": "renamed",
};

/**
 * A delta spec: what this change adds, modifies or removes, relative to the
 * capability's current spec.
 *
 * `unknownSections` is not an error here — `validateDelta` decides what to do
 * with it, so the parser stays a pure reader.
 */
export function parseDelta(source: string): DeltaNode {
  const doc = parseMarkdown(source);
  const delta: DeltaNode = {
    title: doc.title,
    purpose: "",
    added: [],
    modified: [],
    removed: [],
    renamed: [],
    unknownSections: [],
    sections: doc.sections,
  };

  for (const s of doc.sections) {
    const heading = String(s.heading || "").toLowerCase();
    if (heading === "purpose") {
      delta.purpose = s.body;
      continue;
    }
    const bucket = DELTA_SECTIONS[heading];
    if (!bucket) {
      if (s.requirements.length > 0 || s.heading) {
        delta.unknownSections.push({ heading: s.heading, line: s.line });
      }
      continue;
    }
    for (const r of s.requirements) {
      r.op = bucket;
      delta[bucket].push(r);
    }
  }

  return delta;
}

// ── Serialisation ─────────────────────────────────────────────────────────────
// `archive` rewrites a spec after applying a delta. Rendering goes through the
// same shapes the parser produces, so parse → render → parse is a fixed point.

function renderTrace(trace: TraceComment | null | undefined): string | null {
  const keys = Object.keys(trace || {}).sort();
  if (keys.length === 0) return null;
  const parts = keys.map((k) => {
    // Non-null: `keys` is empty, and we returned above, unless `trace` is set.
    const v = String(trace![k]);
    return /\s/.test(v) ? `${k}="${v}"` : `${k}=${v}`;
  });
  return `<!-- specgate:trace ${parts.join(" ")} -->`;
}

/**
 * A requirement as the renderer reads it. After `parseSpec` / `parseDelta`
 * its text is one string, which is the only stage that is ever rendered.
 */
export interface RenderableRequirement {
  heading?: string;
  name?: string;
  text?: string;
  scenarios?: Array<{ heading?: string; name?: string; steps?: string[] }>;
  trace?: TraceComment;
}

/** A spec as the renderer reads it. */
export interface RenderableSpec {
  title?: string | null;
  purpose?: string;
  requirements?: RenderableRequirement[];
}

export function renderRequirement(req: RenderableRequirement): string {
  const out: string[] = [];
  out.push(`### Requirement: ${req.heading || req.name}`);
  out.push("");
  if (req.text && req.text.trim() !== "") {
    out.push(req.text.trim());
    out.push("");
  }
  for (const sc of req.scenarios || []) {
    out.push(`#### Scenario: ${sc.heading || sc.name}`);
    out.push("");
    for (const step of sc.steps || []) out.push(`- ${step}`);
    out.push("");
  }
  const trace = renderTrace(req.trace);
  if (trace) {
    out.push(trace);
    out.push("");
  }
  // Collapse the trailing blank so the caller controls spacing.
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function renderSpec(spec: RenderableSpec): string {
  const out: string[] = [];
  out.push(`# ${spec.title || "Specification"}`);
  out.push("");
  if (spec.purpose && spec.purpose.trim() !== "") {
    out.push("## Purpose");
    out.push("");
    out.push(spec.purpose.trim());
    out.push("");
  }
  out.push("## Requirements");
  out.push("");
  for (const req of spec.requirements || []) {
    out.push(renderRequirement(req));
    out.push("");
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}
