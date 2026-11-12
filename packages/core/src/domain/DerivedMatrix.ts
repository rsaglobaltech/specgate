/**
 * The traceability matrix as a projection, not a document — the step of
 * simplifying the tool that took the matrix off the list of things people edit.
 *
 * ## Why
 *
 * The team found the tool hard to absorb, and the matrix was the heaviest part
 * of it: ten columns kept in step by `req add`, `req link`, `done` and a
 * custom merge driver, so that every behaviour change was also a table edit.
 * Everything in a row is already said somewhere else — the requirement in
 * `spec.md`, its scenario by an `@REQ-NNN @SCN-NNN` tag, its test by naming the
 * requirement. This module computes the rows from those sources.
 *
 * ## Where each column comes from
 *
 * | Column | Source |
 * |---|---|
 * | Requirement, Use Case | the `## REQ-NNN — title` section in `spec.md` |
 * | Scenario ID, Feature file | scenarios tagged `@REQ-NNN` (their `@SCN-…`), one row each |
 * | Test artifact | test files that mention `REQ-NNN` |
 * | Technical artifact | other source files that mention `REQ-NNN` |
 * | Status | `status=` in the section's `specgate:trace` comment — the one owner |
 * | anything | an explicit key in that comment wins over what is derived |
 *
 * The comment is the grammar capability specs already use
 * (`<!-- specgate:trace status=Implemented test=test/totals.test.js -->`), so
 * `TraceabilityMatrix.traceRow` turns it into a row exactly as it does there.
 *
 * ## Why the file is still written
 *
 * Twenty readers open `docs/specs/traceability.md` directly. Keeping it on disk
 * as generated output leaves every one of them working, and keeps the table a
 * reviewer reads in a pull request. What changes is ownership: nobody edits it,
 * and `validate` fails when it no longer matches its sources.
 */

import { TraceRow, TraceabilityMatrix } from "./TraceabilityMatrix";
import { MatrixRow, buildTraceabilityMarkdown, parseTraceabilityRows } from "./TraceabilityFormat";
import { SpecNode, parseSpec, parseTraceComment } from "./SpecParser";
import { specgateTagsByScenario } from "./GherkinTags";

/** First line of a derived matrix. Its presence is what makes a project derived. */
export const DERIVED_MARKER =
  "<!-- specgate:derived — generated from spec.md, features/ and tests. " +
  "Do not edit by hand: run `specgate matrix`. -->";

export function isDerivedMatrix(content: string | null | undefined): boolean {
  return String(content || "").includes("<!-- specgate:derived");
}

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export interface DerivationSources {
  readonly spec: string;
  readonly features: ReadonlyArray<SourceFile>;
  readonly tests: ReadonlyArray<SourceFile>;
  /**
   * `docs/specs/capabilities/<cap>/spec.md`, where `change archive` writes
   * requirements. Their `specgate:trace` already maps to a row (`traceRow`); a
   * derived matrix that ignored them would drop every archived change.
   */
  readonly capabilities?: ReadonlyArray<SourceFile>;
  /**
   * Source files that are not tests. One that mentions `REQ-NNN` — a comment
   * is enough — is where that requirement is implemented, the same rule tests
   * follow, so the code column needs no `req link` either.
   */
  readonly code?: ReadonlyArray<SourceFile>;
}

export interface DerivedRequirement {
  readonly id: string;
  readonly title: string;
  readonly trace: Record<string, string>;
}

// `## REQ-002 — title` in spec.md, or `### Requirement: REQ-002 — title` in a
// capability spec, where `change archive` writes.
const SECTION_HEADING = /^(#{2,4})\s+(?:Requirement:\s*)?(REQ-[A-Za-z0-9.]+)\b\s*[—–:-]?\s*(.*)$/;
const TRACE_LINE = /^\s*<!--\s*specgate:trace\b/;

/**
 * `specgate:trace` lines no requirement section owns: above the first requirement,
 * or under a heading that is not one. Nothing reads them, so a status written
 * there is silently ignored (#79). Line numbers are 1-based.
 */
export function unreadTraceLines(spec: string): number[] {
  const lines = String(spec || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const out: number[] = [];
  let inside = 0; // the heading level of the requirement section we are in, or 0
  let fenced = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(```|~~~)/.test(lines[i])) fenced = !fenced;
    if (fenced) continue;
    const heading = /^(#{1,6})\s+\S/.exec(lines[i]);
    if (heading) {
      const m = SECTION_HEADING.exec(lines[i].trim());
      if (m) inside = m[1].length;
      else if (inside && heading[1].length <= inside) inside = 0;
      continue;
    }
    if (TRACE_LINE.test(lines[i]) && !inside) out.push(i + 1);
  }
  return out;
}

/** Every `## REQ-NNN — title` section in `spec.md`, in document order. */
export function requirementsIn(spec: string): DerivedRequirement[] {
  const lines = String(spec || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const found: DerivedRequirement[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i += 1) {
    const m = SECTION_HEADING.exec(lines[i].trim());
    if (!m || seen.has(m[2])) continue;
    seen.add(m[2]);
    const level = m[1].length;
    let trace: Record<string, string> = {};
    for (let j = i + 1; j < lines.length; j += 1) {
      if (new RegExp(`^#{1,${level}}\\s+\\S`).test(lines[j])) break;
      if (TRACE_LINE.test(lines[j])) {
        trace = parseTraceComment(lines[j]) as Record<string, string>;
        break;
      }
    }
    found.push({ id: m[2], title: m[3].trim(), trace });
  }
  return found;
}

/** `REQ-002` as a whole token: not `REQ-0021`, not `XREQ-002`. */
function mentions(source: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(source);
}

const ALNUM = /[A-Za-z0-9]/;
const INDEXED_PREFIXES = ["REQ-", "SCN-"];

/**
 * `REQ-12.3` → `REQ-12`: the prefix and the letters and digits after it. A
 * mention of an id starts a run whose key is the id's own key, so the files
 * that can mention it are found by key and confirmed with `mentions`.
 */
function mentionKey(text: string, at: number): string {
  let end = at + 4;
  while (end < text.length && ALNUM.test(text[end])) end++;
  return text.slice(at, end);
}

/**
 * Which files can mention which id, read once (REQ-517).
 *
 * Linking by mention ran one regular expression per requirement over every
 * test and source file: 2,000 requirements and 4,000 files were eight million
 * scans, and `validate` on such a project took most of a minute. Each file is
 * read once for the places an id starts; a requirement then tests only the
 * files that hold its key, with the same `mentions` as before.
 */
class MentionIndex {
  private readonly byKey = new Map<string, number[]>();

  constructor(private readonly files: ReadonlyArray<SourceFile>) {
    files.forEach((f, i) => {
      const seen = new Set<string>();
      for (const prefix of INDEXED_PREFIXES) {
        for (let at = f.source.indexOf(prefix); at >= 0; at = f.source.indexOf(prefix, at + 1)) {
          if (at > 0 && ALNUM.test(f.source[at - 1])) continue;
          const key = mentionKey(f.source, at);
          if (seen.has(key)) continue;
          seen.add(key);
          const list = this.byKey.get(key);
          if (list) list.push(i);
          else this.byKey.set(key, [i]);
        }
      }
    });
  }

  /** The paths of the files that name `id`, sorted. */
  naming(id: string): string[] {
    const candidates = INDEXED_PREFIXES.some((p) => id.startsWith(p))
      ? (this.byKey.get(mentionKey(id, 0)) || []).map((i) => this.files[i])
      : this.files;
    return candidates
      .filter((f) => mentions(f.source, id))
      .map((f) => f.path)
      .sort();
  }
}

/** The features' tagged scenarios, parsed once and kept by tag (REQ-517). */
class TagIndex {
  private readonly byTag = new Map<string, Array<{ scn: string; feature: string }>>();

  constructor(features: ReadonlyArray<SourceFile>) {
    for (const f of [...features].sort((a, b) => a.path.localeCompare(b.path))) {
      for (const tags of Object.values(specgateTagsByScenario(f.source))) {
        const scn = tags.find((t) => t.startsWith("@SCN-"));
        const entry = { scn: scn ? scn.slice(1) : "-", feature: f.path };
        for (const tag of new Set(tags)) {
          const list = this.byTag.get(tag);
          if (list) list.push(entry);
          else this.byTag.set(tag, [entry]);
        }
      }
    }
  }

  /** The scenarios tagged with a requirement: `[{ scn, feature }]`, in file order. */
  tagged(id: string): Array<{ scn: string; feature: string }> {
    return (this.byTag.get(`@${id}`) || []).map((e) => ({ ...e }));
  }
}

/** What deriving the rows reads many times, indexed once per derivation. */
interface DerivationIndex {
  tests: MentionIndex;
  code: MentionIndex;
  tags: TagIndex;
}

function indexSources(sources: DerivationSources): DerivationIndex {
  return {
    tests: new MentionIndex(sources.tests),
    code: new MentionIndex(sources.code || []),
    tags: new TagIndex(sources.features),
  };
}

/** A test or source file that names the requirement is its link. */
function linkByMention(trace: Record<string, string>, id: string, index: DerivationIndex) {
  if (!trace.test) {
    const tests = index.tests.naming(id);
    if (tests.length > 0) trace.test = tests.join(", ");
  }
  if (!trace.artifact) {
    const code = index.code.naming(id);
    if (code.length > 0) trace.artifact = code.join(", ");
  }
}

/**
 * One row per tagged scenario, each with the tests that prove *it*.
 *
 * A requirement linked by mention gave every one of its rows the tests that
 * name the requirement, so a scenario added after delivery inherited the old
 * tests and the gate stayed green. Found when a pack gave 30 delivered
 * requirements API and screen scenarios: `status` said 99/99 done with 52 of
 * them untested (golden_app finding #32).
 *
 * Once any test names one of the requirement's scenario ids, the project
 * links by scenario for that requirement, and each row gets the tests that
 * name its scenario — none, if none do. Calibrated per requirement, not per
 * project or file: a requirement whose tests name only the requirement keeps
 * linking that way, and a `test=` written in the trace is never overridden.
 *
 * Such a row is `Draft`, whatever the requirement's status: the scenario has
 * not been started. The requirement keeps its status — what was delivered
 * stays delivered — and the project stays valid, so the work can be done in
 * PRs against a green branch. Nothing is let off: delivering the requirement
 * again (`done`, the harness) judges its Draft rows as Implemented, and an
 * untested scenario fails that gate.
 */
function scenarioVariants(
  trace: Record<string, string>,
  scenarios: ReadonlyArray<{ scn: string; feature: string }>,
  index: DerivationIndex,
  explicitTest: boolean
): Array<Record<string, string>> {
  if (scenarios.length === 0) return [trace];
  const naming = scenarios.map((s) => (s.scn === "-" ? [] : index.tests.naming(s.scn)));
  const byScenario = !explicitTest && naming.some((n) => n.length > 0);
  return scenarios.map((s, i) => {
    const row: Record<string, string> = { ...trace, scn: s.scn, feature: s.feature };
    if (byScenario) {
      if (naming[i].length > 0) row.test = naming[i].join(", ");
      else {
        delete row.test;
        if (row.status && row.status !== "Deprecated") row.status = "Draft";
      }
    }
    return row;
  });
}

/** The matrix rows the sources imply. */
export function deriveRows(sources: DerivationSources): TraceRow[] {
  const rows: TraceRow[] = [];
  const index = indexSources(sources);
  for (const req of requirementsIn(sources.spec)) {
    const trace: Record<string, string> = { ...req.trace };
    const explicitTest = Boolean(trace.test);
    if (!trace.uc && req.title) trace.uc = req.title;
    linkByMention(trace, req.id, index);

    const scenarios = trace.scn || trace.feature ? [] : index.tags.tagged(req.id);
    const variants = scenarioVariants(trace, scenarios, index, explicitTest);

    for (const t of variants) {
      const row = TraceabilityMatrix.traceRow({ id: req.id, trace: t });
      if (t.depends) row.dependsOn = String(t.depends).split(",").filter(Boolean);
      if (t.context) row.context = t.context;
      rows.push(row);
    }
  }

  const fromSpec = new Set(rows.map((r) => r.requirement));
  for (const cap of [...(sources.capabilities || [])].sort((a, b) =>
    a.path.localeCompare(b.path)
  )) {
    let parsed: SpecNode;
    try {
      parsed = parseSpec(cap.source);
    } catch {
      continue;
    }
    for (const req of parsed.requirements || []) {
      if (!req.id || fromSpec.has(req.id)) continue;
      const trace: Record<string, string> = { ...(req.trace || {}) };
      const explicitTest = Boolean(trace.test);
      // Archived requirements link the same way: by being named.
      linkByMention(trace, req.id, index);
      // And by their tagged scenarios, one row each, as spec.md requirements
      // do. Capability requirements got a single scenario-less row, so a
      // requirement installed from a pack — or archived from a change — never
      // showed the scenarios that demonstrate it.
      const scenarios = trace.scn || trace.feature ? [] : index.tags.tagged(req.id);
      const variants = scenarioVariants(trace, scenarios, index, explicitTest);
      for (const t of variants) {
        const row = TraceabilityMatrix.traceRow({ ...req, trace: t });
        if (t.depends) row.dependsOn = String(t.depends).split(",").filter(Boolean);
        if (t.context) row.context = t.context;
        rows.push(row);
      }
    }
  }
  return rows;
}

/** The generated `traceability.md`. */
export function renderDerivedMatrix(rows: readonly MatrixRow[], projectName?: string): string {
  const body = buildTraceabilityMarkdown(rows, "rich").replace(
    "# Traceability Matrix",
    `# Traceability Matrix${projectName ? ` — ${projectName}` : ""}`
  );
  return `${DERIVED_MARKER}\n${body}`;
}

// ── Writing the one owner ────────────────────────────────────────────────────

/**
 * `spec.md` with `fields` set in `reqId`'s `specgate:trace` comment.
 *
 * The comment is created right under the heading when the section has none.
 * A value of `""` removes the key. Returns `null` when the section is absent.
 */
export function setTraceFields(
  spec: string,
  reqId: string,
  fields: Record<string, string>
): string | null {
  const lines = String(spec || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let heading = -1;
  let level = 2;
  for (let i = 0; i < lines.length; i += 1) {
    const m = SECTION_HEADING.exec(lines[i].trim());
    if (m && m[2] === reqId) {
      heading = i;
      level = m[1].length;
      break;
    }
  }
  if (heading === -1) return null;

  let at = -1;
  for (let j = heading + 1; j < lines.length; j += 1) {
    if (new RegExp(`^#{1,${level}}\\s+\\S`).test(lines[j])) break;
    if (TRACE_LINE.test(lines[j])) {
      at = j;
      break;
    }
  }
  const current = at === -1 ? {} : (parseTraceComment(lines[at]) as Record<string, string>);
  const merged: Record<string, string> = { ...current };
  for (const [k, v] of Object.entries(fields)) {
    if (v === "") delete merged[k];
    else merged[k] = v;
  }
  const rendered = renderTraceComment(merged);

  if (at !== -1) {
    if (rendered === null) lines.splice(at, 1);
    else lines[at] = rendered;
  } else if (rendered !== null) {
    lines.splice(heading + 1, 0, "", rendered);
  }
  return lines.join("\n");
}

/** Keys in a stable order, so a status change is a one-line diff. */
const KEY_ORDER = [
  "status",
  "scn",
  "feature",
  "test",
  "artifact",
  "uc",
  "cmd",
  "qry",
  "agg",
  "evt",
];

export function renderTraceComment(trace: Record<string, string>): string | null {
  const keys = Object.keys(trace).sort((a, b) => {
    const ia = KEY_ORDER.indexOf(a);
    const ib = KEY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  if (keys.length === 0) return null;
  const parts = keys.map((k) => {
    // The grammar has quotes and no escapes: a value with spaces is wrapped in
    // whichever quote it does not contain. One with both cannot be written,
    // and `traceValueWritable` keeps migration from trying.
    const v = String(trace[k]);
    if (!/[\s"']/.test(v)) return `${k}=${v}`;
    return v.includes("'") ? `${k}="${v}"` : `${k}='${v}'`;
  });
  return `<!-- specgate:trace ${parts.join(" ")} -->`;
}

// ── Comparing, for --check and for migration ─────────────────────────────────

const COLUMNS: Array<keyof MatrixRow> = [
  "requirement",
  "scenarioId",
  "featureFile",
  "useCase",
  "commandOrQuery",
  "aggregate",
  "event",
  "technicalArtifact",
  "testArtifact",
  "status",
];

function norm(v: unknown): string {
  const s =
    String(v ?? "-")
      .replace(/`/g, "")
      .replace(/\s*,\s*/g, ", ")
      .trim() || "-";
  // `-` and `TBD` both mean "no test declared"; the gate reads them alike.
  return s.toUpperCase() === "TBD" ? "-" : s;
}

/** A row as a comparable key, backticks and spacing ignored. */
export function rowKey(row: MatrixRow): string {
  return COLUMNS.map((c) => norm(row[c])).join(" | ");
}

/** Rows present on one side and not the other. Empty both ways means equal. */
export function diffRows(
  expected: readonly MatrixRow[],
  actual: readonly MatrixRow[]
): { missing: string[]; extra: string[] } {
  const a = expected.map(rowKey);
  const b = actual.map(rowKey);
  const missing = a.filter((k) => !b.includes(k));
  const extra = b.filter((k) => !a.includes(k));
  return { missing, extra };
}

/** The rows a matrix file holds, in the shape `deriveRows` returns. */
export function rowsOf(matrixContent: string): MatrixRow[] {
  const parsed = parseTraceabilityRows(matrixContent);
  return parsed.mode === "rich" ? parsed.rows : [];
}

/**
 * The `specgate:trace` fields a requirement needs so that derivation reproduces
 * `rows` — or the reason it cannot.
 *
 * Only what derivation would get wrong is written: a matrix whose tags and
 * test names already carry the links migrates to nothing but status lines.
 */
/** Can this value be stored in a `specgate:trace` comment and read back intact? */
export function traceValueWritable(v: string): boolean {
  return !(v.includes("'") && v.includes('"')) && !v.includes("-->");
}

export function fieldsToReproduce(
  req: DerivedRequirement,
  rows: readonly MatrixRow[],
  sources: DerivationSources
): { fields: Record<string, string> } | { reason: string } {
  const derived = deriveRows({
    ...sources,
    spec: `## ${req.id} — ${req.title}\n`,
  });
  if (rows.length > 1) {
    // Several rows for one requirement: only tags can say which scenario is
    // which, and every other column has to agree across them.
    const shared = COLUMNS.filter((c) => !["scenarioId", "featureFile"].includes(c));
    const disagree = shared.filter((c) => new Set(rows.map((r) => norm(r[c]))).size > 1);
    if (disagree.length > 0) {
      return {
        reason: `${rows.length} rows that differ in ${disagree.join(", ")} — one requirement, one value per column`,
      };
    }
    const wanted = rows.map((r) => `${norm(r.scenarioId)}@${norm(r.featureFile)}`).sort();
    const got = derived.map((r) => `${norm(r.scenarioId)}@${norm(r.featureFile)}`).sort();
    if (wanted.join() !== got.join()) {
      return {
        reason: `${rows.length} scenarios that are not tagged @${req.id} @SCN-… in their feature files`,
      };
    }
  }

  const row = rows[0];
  const first: MatrixRow = derived[0] || {};
  const fields: Record<string, string> = {};
  const set = (key: string, column: keyof MatrixRow, value?: string) => {
    if (norm(row[column]) !== norm(first[column])) fields[key] = value ?? norm(row[column]);
  };
  if (rows.length === 1) {
    set("scn", "scenarioId");
    set("feature", "featureFile");
  }
  set("uc", "useCase");
  set("cmd", "commandOrQuery");
  set("agg", "aggregate");
  set("evt", "event");
  set("artifact", "technicalArtifact");
  set("test", "testArtifact");
  if (norm(row.status) !== "Draft") fields.status = norm(row.status);
  const unwritable = Object.entries(fields).find(([, v]) => !traceValueWritable(v));
  if (unwritable) {
    return { reason: `its ${unwritable[0]} cell mixes both quote characters: ${unwritable[1]}` };
  }
  return { fields };
}
