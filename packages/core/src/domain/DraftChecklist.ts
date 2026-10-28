/**
 * Is a draft complete enough to review? (ADR-0029, docs/specs/draft-from-brief.md §4)
 *
 * The rules a draft change must satisfy before a person reads it. Each one is
 * an omission the Golden State pilot made by hand and nothing caught: sixteen
 * requirements with no scenario, a whole API and screen layer never asked
 * for, values nobody had said. They are mechanical on purpose (ADR-0023): the
 * checklist does not judge whether a requirement is right, only that the
 * draft says what it must say.
 *
 * Pure: the caller reads the change's deltas, the brief, `assumptions.md` and
 * `questions.md` and hands the text in.
 */

import type { Diagnostic } from "./Diagnostic";
import { error, info, warning } from "./Diagnostic";
import { parseDelta } from "./SpecParser";
import { analyseScenario } from "./GherkinQuality";
import { withoutComments } from "./QuotedText";
import { assumptionsToReview, deferredAnswer } from "./Clarification";

export { deferredAnswer };

export const KINDS = new Set(["functional", "non-functional", "business-rule"]);

export interface DraftFiles {
  /** The change's delta specs: `specs/<capability>/spec.md`. */
  readonly deltas: ReadonlyArray<{ readonly path: string; readonly source: string }>;
  /** The brief the draft was written from, as text. Without it, D3 and D6 cannot run. */
  readonly brief?: string;
  readonly assumptions?: string;
  /**
   * `assumptions.md` of the changes already archived. A MODIFIED requirement
   * is checked again, and the row that justified it lives in the change that
   * first wrote it; D12 flagged EventTech's REQ-008 again until the row was
   * copied into the new draft (#81). Only MODIFIED requirements read it.
   */
  readonly archivedAssumptions?: string;
  /**
   * The project's specification as it stands — `spec.md` and the capability
   * specs. A value already there was reviewed in an earlier change; D6
   * flagged "Configuración" and "11:00" in a second draft for not being in the
   * brief (reservas_app, #52).
   */
  readonly specText?: string;
  /**
   * Who owns each id the project already uses: `REQ-007` → `REQ-007`,
   * `SCN-012` → the requirement its feature file tags it with. A draft that
   * reuses one collides with a delivered requirement; `validate` found it only
   * after archiving ("Duplicate Scenario ID", reservas_app #55).
   */
  readonly idsInUse?: ReadonlyMap<string, string>;
  readonly questions?: string;
  readonly maxRequirements?: number;
  /**
   * The project's specification files (`spec.md`, capability specs), so D12
   * can see a list or a create call delivered in an earlier change.
   */
  readonly specs?: ReadonlyArray<{ readonly source: string }>;
}

export interface DraftReport {
  readonly requirements: number;
  readonly scenarios: number;
  /** Rules that could not run, and why — never silently "passed". */
  readonly skipped: ReadonlyArray<{ readonly rule: string; readonly why: string }>;
  readonly status: Diagnostic[];
}

interface Req {
  id: string;
  name: string;
  text: string;
  line: number;
  file: string;
  trace: Record<string, string>;
  scenarios: Array<{ id: string; name: string; steps: string[]; line: number }>;
  /** In `## MODIFIED Requirements`: its own ids already exist, legitimately. */
  modified: boolean;
}

// ── The brief's front matter ──────────────────────────────────────────────────

/**
 * The front matter, without its comments. `specgate draft --new-brief` writes
 * one whose examples are comments (`#   - { name: Teacher, … }`); read as
 * fields, those examples became actors the person never declared (#95).
 */
function frontMatterFields(brief: string): string | null {
  const fm = /^---\n([\s\S]*?)\n---/.exec(brief.replace(/\r\n/g, "\n"));
  if (!fm) return null;
  return fm[1]
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.replace(/\s+#\s.*$/, ""))
    .join("\n");
}

/** `actors: [{ name: Worker, surfaces: [mobile] }]` → Worker → [mobile]. */
export function actorSurfaces(brief: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const fields = frontMatterFields(brief);
  if (fields === null) return out;
  const re = /\{\s*name:\s*([^,}]+?)\s*,\s*surfaces:\s*\[([^\]]*)\]\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fields)) !== null) {
    out.set(
      m[1].trim().toLowerCase(),
      m[2]
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return out;
}

/**
 * `modules: [bookings, coupons]`, or the same as a YAML list, → the modules a
 * brief is drafted in, in its order. `specgate draft` walks them one by one.
 */
export function briefModules(brief: string): string[] {
  const fields = frontMatterFields(brief);
  if (fields === null) return [];
  const inline = /^modules:\s*\[([^\]]*)\]\s*$/m.exec(fields);
  const items = inline
    ? inline[1].split(",")
    : (/^modules:\s*\n((?:[ \t]+-[^\n]*\n?)+)/m.exec(fields)?.[1] || "")
        .split("\n")
        .map((l) => l.replace(/^\s*-\s*/, ""));
  return items.map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

// ── Values a scenario states ──────────────────────────────────────────────────

const ID_TOKEN = /\b(?:REQ|SCN|UC|CMD|AGG|EVT|Q|A)-[A-Za-z0-9.]+\b/g;

/** Numbers and double-quoted strings in a step: what a reader would take as fact. */
export function statedValues(step: string): string[] {
  const text = step.replace(ID_TOKEN, " ").replace(/^\s*(GIVEN|WHEN|THEN|AND|BUT)\b/i, "");
  const out: string[] = [];
  for (const q of text.matchAll(/"([^"]+)"/g)) out.push(q[1]);
  const unquoted = text.replace(/"[^"]*"/g, " ").replace(/`[^`]*`/g, " ");
  for (const n of unquoted.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?![\w])/g)) out.push(n[0]);
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[,\s]+/g, " ")
    .trim();

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function inText(value: string, text: string): boolean {
  if (/^\d/.test(value)) {
    const bare = value.replace(/,/g, "");
    const plain = text.replace(/(\d),(\d)/g, "$1$2");
    return new RegExp(`(?<![\\d.])${escapeRegExp(bare)}(?![\\d])`).test(plain);
  }
  return norm(text).includes(norm(value));
}

/** Number words an assumption may use for a scenario's figure: "three axles" for "3 ejes". */
const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  uno: "1",
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
  diez: "10",
  once: "11",
  doce: "12",
  eins: "1",
  zwei: "2",
  drei: "3",
  vier: "4",
  fünf: "5",
  sechs: "6",
  sieben: "7",
  acht: "8",
  neun: "9",
  zehn: "10",
  elf: "11",
  zwölf: "12",
};
const NUMBER_WORD = new RegExp(
  `(?<![\\p{L}])(${Object.keys(NUMBER_WORDS).join("|")})(?![\\p{L}])`,
  "giu"
);

/**
 * Whether a row of `assumptions.md` that names the scenario holds its value,
 * however the row writes it (REQ-247): the number of "7100 kg" in a list that
 * gives the unit once ("7100, 11500 and 8000 kg"), "3 ejes" as "three axles",
 * the value inside a quoted label ("Dispositivo: TRK-0001").
 */
function inRow(value: string, row: string): boolean {
  if (inText(value, row)) return true;
  const label = /:\s*(\S.*)$/.exec(value);
  if (label && inText(label[1], row)) return true;
  const figure = /^(\d+(?:[.,]\d+)*)(?:\s+\S|$)/.exec(value);
  if (figure) {
    const words = row.replace(NUMBER_WORD, (w) => NUMBER_WORDS[w.toLowerCase()] || w);
    return inText(figure[1], words);
  }
  return false;
}

/** How a scenario joins values into one: a screen path, a list row (REQ-261). */
const PART_JOIN = /\s+[›—·]\s+/;

// ── Assumption rows ───────────────────────────────────────────────────────────

/** `REQ-004..REQ-010`, `SCN-2…SCN-9`, `REQ-004–REQ-010`, `REQ-004 to REQ-010`, `REQ-004 a REQ-010`. */
const ID_RANGE = /\b(REQ|SCN)-(\d+)\s*(?:\.\.\.?|…|–|—|\bto\b|\ba\b|\bal\b)\s*(?:\1-)?(\d+)\b/g;

/**
 * Whether a row of `assumptions.md` names an id, alone or inside a range.
 *
 * A row used by seven requirements said `REQ-004..REQ-010`, the way a person
 * writes it; D6 only matched ids spelled out one by one and reported 25 values
 * as unlisted until the range was expanded by hand (FinCore, #74).
 */
export function rowNamesId(row: string, id: string): boolean {
  if (row.includes(id)) return true;
  const m = /^(REQ|SCN)-(\d+)$/.exec(id);
  if (!m) return false;
  const n = Number(m[2]);
  for (const r of row.matchAll(ID_RANGE)) {
    if (r[1] !== m[1]) continue;
    const from = Number(r[2]);
    const to = Number(r[3]);
    if (n >= Math.min(from, to) && n <= Math.max(from, to)) return true;
  }
  return false;
}

// ── Questions ─────────────────────────────────────────────────────────────────

/**
 * Rows of `questions.md`: `| # | Question | Blocks | … |`.
 *
 * A row is answered when its `Answer` (or `Respuesta`) cell is filled, or when
 * a line below the table starts with `Answer` / `Respuesta` and names the row,
 * as in `Answer (Q1): …`. The spec once said "an `Answer:` line under the
 * row", which a Markdown table cannot hold; D7 then kept an answered question
 * open and demanded its requirement stay `Needs Clarification` (#45).
 */
/** A Blocks cell that says, on purpose, that nothing waits for the question (REQ-176). */
const NONE_BLOCKED = /^(none|nothing|ninguno|ninguna|nada|n\/a|—|–|-)\.?$/i;

function questionRows(md: string): Array<{
  row: string;
  blocks: string[];
  noneBlocked: boolean;
  line: number;
  answered: boolean;
  deferred: boolean;
}> {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex((l) => /^\|.*\bBlocks\b.*\|/i.test(l));
  if (header === -1) return [];
  const cols = lines[header].split("|").map((c) => c.trim().toLowerCase());
  const at = cols.indexOf("blocks");
  const answerCol = cols.findIndex((c) => c === "answer" || c === "respuesta");
  const answerLines = lines.filter((l) => /^\s*(?:[-*]\s*)?\**(answer|respuesta)\b/i.test(l));
  const out: Array<{
    row: string;
    blocks: string[];
    noneBlocked: boolean;
    line: number;
    answered: boolean;
    deferred: boolean;
  }> = [];
  for (let i = header + 2; i < lines.length && /^\|/.test(lines[i]); i += 1) {
    const cells = lines[i].split("|").map((c) => c.trim());
    const row = cells[1] || `row ${i + 1}`;
    const named = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(row)}(?![A-Za-z0-9])`);
    const answers = [
      ...(answerCol > 0 && (cells[answerCol] || "").length > 0 ? [cells[answerCol]] : []),
      ...answerLines.filter((l) => named.test(l)).map((l) => l.replace(/^[^:]*:\s*/, "")),
    ];
    const deferred = answers.length > 0 && answers.every(deferredAnswer);
    out.push({
      row,
      blocks: (cells[at] || "").match(/REQ-[A-Za-z0-9.]+/g) || [],
      noneBlocked: NONE_BLOCKED.test((cells[at] || "").replace(/\*\*/g, "").trim()),
      line: i + 1,
      answered: answers.length > 0 && !deferred,
      deferred,
    });
  }
  return out;
}

/**
 * The open questions of a `questions.md`, with the requirements each blocks.
 * `status` uses it to say what a `Needs Clarification` requirement waits for.
 */
export function openQuestions(md: string): Array<{ row: string; blocks: string[] }> {
  return questionRows(md)
    .filter((q) => !q.answered)
    .map((q) => ({ row: q.row, blocks: q.blocks }));
}

/**
 * The answered questions of a `questions.md`, with the requirements each
 * blocked: `status` says such a requirement needs its spec updated, not an
 * answer (REQ-263).
 */
export function answeredQuestions(md: string): Array<{ row: string; blocks: string[] }> {
  return questionRows(md)
    .filter((q) => q.answered)
    .map((q) => ({ row: q.row, blocks: q.blocks }));
}

// ── What D4 and D5 look for ───────────────────────────────────────────────────

const MEASURE =
  /\d+(?:[.,]\d+)?\s*(ms|s|sec|seconds?|min|minutes?|h|hours?|%|m|km|kb|mb|gb|px|req\/s|rps|users?|days?)\b/i;
const CITES =
  /(\bCode\s*§|§\s*\d|\bACI\b|\bOSHA\b|\bGDPR\b|\bCCPA\b|\bHIPAA\b|\bISO\s*\d|\bCBA\b|\bcontract\b|\bregulation\b|\bLey\b|\bnorma\b)/i;
const SOURCED = /(https?:\/\/|\bSource:|\bFuente:)/i;
/**
 * Words that promise a quantity. A non-functional requirement is unmeasured
 * when it uses one and states no number: "fast", "scalable", "low latency".
 * A qualitative constraint — offline, privacy, which devices — is verifiable
 * without a number; flagging every one of those was 4 false positives out of
 * 4 on the Golden State packs. "Responsive" is not on the list: it names a
 * layout that adapts to the screen, not a response time (reservas_app, #42).
 */
const QUANTITATIVE =
  /\b(fast|faster|quick(ly)?|slow|speed|latency|response time|performan(t|ce)|throughput|concurren(t|cy)|load|scal(able|e|ability)|uptime|availab(le|ility)|capacity|real[- ]time|instant(ly)?|r[aá]pid[oa]?|veloz|escalable|disponibilidad)\b/i;

/** Promises a quantity and states none. */
export function unmeasured(text: string): boolean {
  return QUANTITATIVE.test(text) && !MEASURE.test(text);
}

// ── What D12 looks for ────────────────────────────────────────────────────────

const CALL = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,;)"'`]+)/g;

/** `{id}`, or a concrete id: a segment with a digit that is not a version (`v1`). */
function isIdSegment(segment: string): boolean {
  if (/^\{[^}]+\}$/.test(segment)) return true;
  return /\d/.test(segment) && segment.length >= 3 && !/^v\d+$/i.test(segment);
}

export interface ApiCall {
  readonly method: string;
  /** Without the query string. */
  readonly path: string;
  /** The path before its first id segment; undefined when it has none. */
  readonly collection?: string;
  /** Where in the step the call is written. */
  readonly at: number;
}

/** The HTTP calls a step names: `POST /api/transferencias/{id}/liquidacion`. */
export function apiCalls(step: string): ApiCall[] {
  const out: ApiCall[] = [];
  for (const m of step.matchAll(CALL)) {
    const pathOnly = m[2].split("?")[0].replace(/[.:]+$/, "");
    const segments = pathOnly.split("/");
    const at = segments.findIndex((seg, i) => i > 0 && isIdSegment(seg));
    out.push({
      method: m[1].toUpperCase(),
      path: pathOnly,
      collection: at > 0 ? segments.slice(0, at).join("/") || "/" : undefined,
      at: m.index ?? 0,
    });
  }
  return out;
}

interface ActorScenario {
  readonly actor?: string;
  readonly steps: ReadonlyArray<string>;
}

/** The scenarios of a specification file, each with its requirement's actor. */
function specScenarios(source: string): ActorScenario[] {
  const out: ActorScenario[] = [];
  for (const r of sections(source)) {
    let current: string[] | undefined;
    const flush = () => {
      if (current) out.push({ actor: r.trace.actor?.toLowerCase(), steps: current });
    };
    for (const line of r.text.split("\n")) {
      if (/^#{3,6}\s+Scenario\b/i.test(line.trim())) {
        flush();
        current = [];
      } else if (current && /^\s*[-*]\s+\S/.test(line)) {
        current.push(line.replace(/^\s*[-*]\s+/, ""));
      }
    }
    flush();
  }
  return out;
}

// ── The checklist ─────────────────────────────────────────────────────────────

export function checkDraft(files: DraftFiles): DraftReport {
  const status: Diagnostic[] = [];
  const skipped: Array<{ rule: string; why: string }> = [];
  const reqs: Req[] = [];

  for (const d of files.deltas) {
    const delta: any = parseDelta(d.source);
    const modifiedIds = new Set((delta.modified || []).map((r: any) => r.id || r.name));
    for (const r of [...(delta.added || []), ...(delta.modified || [])]) {
      reqs.push({
        modified: modifiedIds.has(r.id || r.name),
        id: r.id || r.name,
        name: r.name,
        text: r.text || "",
        line: r.line,
        file: d.path,
        trace: r.trace || {},
        scenarios: (r.scenarios || []).map((s: any) => ({
          id: s.id || s.name,
          name: s.name,
          steps: s.steps || [],
          line: s.line,
        })),
      });
    }
  }

  const at = (r: Req) => ({ file: r.file, line: r.line, target: r.id });

  // D1 — a requirement has a scenario.
  for (const r of reqs) {
    if (r.scenarios.length === 0) {
      status.push(
        error("D1_no_scenario", `${r.id} has no scenario: nothing would verify it.`, {
          ...at(r),
          fix: "Add at least one scenario with values a test can assert.",
        })
      );
    }
  }

  // D2 — a requirement has a kind.
  for (const r of reqs) {
    if (!KINDS.has(r.trace.kind || "")) {
      status.push(
        error("D2_no_kind", `${r.id} has no kind (functional, non-functional or business-rule).`, {
          ...at(r),
          fix: `Add <!-- specgate:trace kind=functional --> (or non-functional, business-rule) under its heading.`,
        })
      );
    }
  }

  // D3 — a requirement a person drives has a scenario on each surface its actor uses.
  const surfaces = files.brief ? actorSurfaces(files.brief) : new Map<string, string[]>();
  if (surfaces.size === 0) {
    skipped.push({
      rule: "D3",
      why: files.brief
        ? "the brief declares no actors with surfaces in its front matter"
        : "no brief given",
    });
  } else {
    const API = /\b(GET|POST|PUT|PATCH|DELETE)\s+\/\S*/;
    const SCREEN = /\b(taps?|clicks?|opens?|sees?|toca|abre|pulsa|ve)\b/i;
    for (const r of reqs) {
      const actor = (r.trace.actor || "").toLowerCase();
      // `surfaces=web` on the requirement narrows its actor's surfaces: a menu
      // lives on a screen and has no API, and D3 used to demand one (#51).
      const own = (r.trace.surfaces || "")
        .split(/[,\s]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      const wanted = own.length > 0 && actor ? own : surfaces.get(actor);
      if (!actor || !wanted) continue;
      // A scenario counts for this actor when it names them, or names no other
      // actor of the brief. "Un cliente abre la página" proved the client's
      // screen, and D3 took it as the owner's: the owner then had no screen
      // to enter the data the requirement was about (reservas_app, #61).
      const others = [...surfaces.keys()].filter((a) => a !== actor);
      const theirs = r.scenarios.filter((s) => {
        const text = s.steps.join(" ").toLowerCase();
        return text.includes(actor) || !others.some((o) => text.includes(o));
      });
      const steps = theirs.flatMap((s) => s.steps);
      const has = {
        api: steps.some((s) => API.test(s)),
        screen: steps.some((s) => SCREEN.test(s)),
      };
      for (const surface of wanted) {
        const ok = surface === "api" ? has.api : has.screen;
        if (!ok) {
          status.push(
            error(
              "D3_surface_missing",
              `${r.id} is driven by ${r.trace.actor}, who uses ${surface}, and no scenario exercises it.`,
              {
                ...at(r),
                fix:
                  surface === "api"
                    ? "Add a scenario whose WHEN is the HTTP call (e.g. `POST /api/…`) and whose THEN is the response."
                    : "Add a scenario whose WHEN is what the person does on the screen (taps, opens) and whose THEN is what they see.",
              }
            )
          );
        }
      }
    }
  }

  // D4 — a non-functional requirement states a number with a unit.
  for (const r of reqs) {
    if (r.trace.kind !== "non-functional") continue;
    const all = [r.text, ...r.scenarios.flatMap((s) => s.steps)].join("\n");
    if (unmeasured(all)) {
      status.push(
        error(
          "D4_unmeasured_nfr",
          `${r.id} promises a quantity (speed, load, availability) and states no number with a unit.`,
          {
            ...at(r),
            fix: 'State the measure: "within 2 seconds", "99.5 % of requests", "under 200 MB".',
          }
        )
      );
    }
  }

  // D5 — a business rule that cites a law, standard or contract names its source.
  for (const r of reqs) {
    if (r.trace.kind !== "business-rule") continue;
    if (CITES.test(r.text) && !SOURCED.test(r.text)) {
      status.push(
        error(
          "D5_unsourced_rule",
          `${r.id} cites a law, standard or contract and names no source.`,
          {
            ...at(r),
            fix: 'Add a "Source:" line (a link, or the clause and edition), or mark it as an assumption.',
          }
        )
      );
    }
  }

  const archivedRows = (files.archivedAssumptions || "").split("\n");

  // D6 — a stated value is in the brief or listed as an assumption.
  if (!files.brief) {
    skipped.push({ rule: "D6", why: "no brief given" });
  } else {
    const assumptions = files.assumptions || "";
    // A template's hints are comments, not the brief: "<!-- e.g. 48 hours -->"
    // made 48 look stated (ADR-0038).
    const briefText = withoutComments(files.brief);
    for (const r of reqs) {
      for (const s of r.scenarios) {
        // One finding per value per scenario: a name repeated in three steps is
        // one thing to list, not three (#43).
        const seen = new Set<string>();
        for (const step of s.steps) {
          for (const v of statedValues(step)) {
            if (seen.has(v)) continue;
            seen.add(v);
            const rows = assumptions.split("\n").concat(r.modified ? archivedRows : []);
            const known = (value: string) =>
              inText(value, briefText) ||
              (!!files.specText && inText(value, files.specText)) ||
              // A value the requirement's own obligation states, under a
              // `Source:` line, is the cited norm's: "24 characters" and
              // "modulo 97" of ISO 13616 had to be copied into assumptions.md
              // (FinCore, #75).
              (SOURCED.test(r.text) && inText(value, r.text)) ||
              rows.some(
                (row) => inRow(value, row) && (rowNamesId(row, s.id) || rowNamesId(row, r.id))
              );
            if (known(v)) continue;
            // REQ-261: a screen path or a list row joins listed values —
            // "1234-BCD › Ejes", "Lucía Martín — E000001234567890" — and the
            // whole was never written down as one (truck-flote, S48).
            const parts = v.split(PART_JOIN);
            if (parts.length > 1 && parts.every((part) => known(part.trim()))) continue;
            status.push(
              error(
                "D6_unlisted_value",
                `${s.id} states "${v}", which is not in the brief and not listed as an assumption for ${s.id} or ${r.id}.`,
                {
                  file: r.file,
                  line: s.line,
                  target: s.id,
                  fix: `List it in assumptions.md with ${s.id} (or ${r.id}) in its row, or use the value the brief gives.`,
                }
              )
            );
          }
        }
      }
    }
  }

  // D7 — an open question names what it blocks, and what it blocks waits.
  if (files.questions) {
    const byId = new Map(reqs.map((r) => [r.id, r]));
    for (const q of questionRows(files.questions)) {
      if (q.answered) {
        // REQ-262: an answer in questions.md changes no requirement by itself;
        // the draft said Ready to review with four requirements still blocked
        // by answered questions (truck-flote, S49).
        for (const id of q.blocks) {
          const r = byId.get(id);
          if (!r || r.trace.status !== "Needs Clarification") continue;
          status.push(
            error(
              "D7_answered_still_blocked",
              `Question ${q.row} is answered, and ${id} is still Needs Clarification.`,
              {
                ...at(r),
                fix:
                  `Fold the answer into ${id}'s text and scenarios, then drop status="Needs Clarification" from its specgate:trace — ` +
                  "or run this command again with --agent to have your agent do it.",
              }
            )
          );
        }
        continue;
      }
      if (q.blocks.length === 0) {
        // Said on purpose ("none"): a question for later that nothing in this
        // draft is built around, such as a backup export nobody asked for yet.
        // Kept in questions.md instead of dropped, and nothing waits on it
        // (REQ-176). An empty cell is still a question someone forgot to tie.
        status.push(
          q.noneBlocked
            ? warning(
                "D7_question_blocks_nothing",
                `Question ${q.row} blocks no requirement: nothing in this draft waits for its answer.`,
                {
                  file: "questions.md",
                  line: q.line,
                  fix: "If a requirement depends on it, name it in the Blocks column and set it Needs Clarification.",
                }
              )
            : error("D7_floating_question", `Question ${q.row} blocks no requirement.`, {
                file: "questions.md",
                line: q.line,
                fix:
                  "Name the requirements it blocks in the Blocks column — a question that blocks nothing is answered by guessing. " +
                  'A question nothing here depends on says so: write "none" in its Blocks column.',
              })
        );
        continue;
      }
      for (const id of q.blocks) {
        const r = byId.get(id);
        if (r && r.trace.status !== "Needs Clarification") {
          status.push(
            error(
              "D7_floating_question",
              q.deferred
                ? `Question ${q.row} blocks ${id}; its answer puts the decision off, so it is still open, and ${id} is not Needs Clarification.`
                : `Question ${q.row} blocks ${id}, and ${id} is not Needs Clarification.`,
              {
                ...at(r),
                fix: `Set status="Needs Clarification" in ${id}'s specgate:trace, so it cannot be built around the question.`,
              }
            )
          );
        }
      }
    }
  }

  // D13 — an answer written by `specgate answer` waits until its author says
  // the spec reflects it (REQ-188): the answer alone changes no requirement.
  for (const a of assumptionsToReview(files.assumptions || "")) {
    const q = (/Q\d+/.exec(a.why) || [])[0];
    status.push(
      error(
        "D13_assumption_to_review",
        `Assumption ${a.id} comes from an answer${q ? ` to ${q}` : ""} the specification may not reflect yet.`,
        {
          file: "assumptions.md",
          line: a.line,
          fix: q
            ? `Update the requirements it is used in, then run \`specgate answer ${q} --reviewed\`.`
            : `Update the requirements it is used in, then set its Status to decided.`,
        }
      )
    );
  }

  // D9 — every scenario passes the rules the harness gate will apply to it.
  // The scenario-quality rules run once a requirement leaves Draft, so a draft
  // that passed this checklist could still fail the harness on a title — and
  // the agent may not edit the scenario (reservas_app, #49).
  const KIND: Record<string, string> = {
    given: "given",
    dado: "given",
    dada: "given",
    dados: "given",
    dadas: "given",
    when: "when",
    cuando: "when",
    then: "then",
    entonces: "then",
    and: "and",
    y: "and",
    but: "but",
    pero: "but",
  };
  for (const r of reqs) {
    for (const s of r.scenarios) {
      let previous = "";
      const steps = s.steps.map((raw) => {
        const m = /^\s*(\S+)\s*(.*)$/.exec(raw) || ["", "", raw];
        const kind = KIND[m[1].toLowerCase()] || "";
        // `And` / `Y` inherit the step above, as Gherkin reads them.
        previous = kind === "and" || kind === "but" ? previous : kind;
        return { keyword: previous, text: m[2] };
      });
      for (const d of analyseScenario(
        { name: s.name, steps, outline: false, hasExamples: false, line: s.line },
        s.id
      )) {
        status.push(
          error("D9_scenario_quality", `${s.id}: ${d.message}`, {
            file: r.file,
            line: s.line,
            target: s.id,
            fix: d.fix,
          })
        );
      }
    }
  }

  // D10 — an id the project already uses belongs to someone else.
  if (files.idsInUse && files.idsInUse.size > 0) {
    const used = files.idsInUse;
    for (const r of reqs) {
      if (!r.modified && used.has(r.id)) {
        status.push(
          error("D10_id_in_use", `${r.id} already exists in this project.`, {
            ...at(r),
            fix: "Use an id from the range `specgate propose` reserved, or put the requirement under MODIFIED if this change rewrites it.",
          })
        );
      }
      for (const s of r.scenarios) {
        const owner = used.get(s.id);
        if (owner && owner !== r.id) {
          status.push(
            error("D10_id_in_use", `${s.id} is already a scenario of ${owner}.`, {
              file: r.file,
              line: s.line,
              target: s.id,
              fix: `Number ${r.id}'s scenarios after the highest SCN id in features/.`,
            })
          );
        }
      }
    }
  }

  // D12 — an actor who acts on an id has a way to get it.
  // The operator could settle a SEPA transfer by its id, and no scenario
  // let the operator find which transfers were pending: every scenario was
  // right and the product was unusable (FinCore; reservas_app and
  // credito-tienda had the same gap). A list (GET on the collection) or the
  // create call (POST to it: the creator receives the id) by the same actor,
  // in this draft or the project's specification, closes it; so does a row of
  // assumptions.md that says where the id comes from.
  {
    const actors = [...surfaces.keys()];
    // Who makes a call: the last actor the step names before it, else the
    // requirement's. In EventTech one step had the organizer create a shuttle
    // and the attendee list them; D12 credited both calls to the organizer
    // (#80).
    const callerOf = (declared: string | undefined, step: string, call: ApiCall) => {
      const before = step.slice(0, call.at).toLowerCase();
      let best: { actor: string; at: number } | undefined;
      for (const a of actors) {
        const re = new RegExp(`(?<![\\p{L}])${escapeRegExp(a)}(?:es|s)?(?![\\p{L}])`, "gu");
        for (const m of before.matchAll(re)) {
          if (!best || (m.index ?? 0) > best.at) best = { actor: a, at: m.index ?? 0 };
        }
      }
      return best?.actor || (declared || "").toLowerCase() || undefined;
    };
    const known: ActorScenario[] = [
      ...reqs.flatMap((r) =>
        r.scenarios.map((s) => ({ actor: r.trace.actor?.toLowerCase(), steps: s.steps }))
      ),
      ...(files.specs || []).flatMap((f) => specScenarios(f.source)),
    ];
    // The list may be nested under its parent: the organizer lists
    // `GET /api/eventos/{id}/sesiones` and moves `POST /api/sesiones/{id}/sala`.
    // Same resource name at the end, same thing; D12 asked for an assumption
    // row in three EventTech drafts until it read it that way (#80).
    const lastSegment = (p: string) => p.split("/").filter(Boolean).pop() || "";
    const lists = (path: string, collection: string) =>
      path === collection ||
      (lastSegment(path) === lastSegment(collection) && !isIdSegment(lastSegment(path)));
    const obtains = (actor: string, collection: string) =>
      known.some((s) =>
        s.steps.some((step) => {
          return apiCalls(step).some(
            (c) =>
              callerOf(s.actor, step, c) === actor &&
              lists(c.path, collection) &&
              (c.method === "GET" || c.method === "POST")
          );
        })
      );
    const rows = (files.assumptions || "").split("\n");
    const reported = new Set<string>();
    for (const r of reqs) {
      for (const s of r.scenarios) {
        for (const step of s.steps) {
          for (const c of apiCalls(step)) {
            const actor = callerOf(r.trace.actor, step, c);
            if (!actor || !c.collection) continue;
            const key = `${r.id} ${actor} ${c.collection}`;
            if (reported.has(key) || obtains(actor, c.collection)) continue;
            const own = r.modified ? rows.concat(archivedRows) : rows;
            if (own.some((row) => rowNamesId(row, r.id) && row.includes(c.collection!))) continue;
            reported.add(key);
            const who =
              r.trace.actor && r.trace.actor.toLowerCase() === actor
                ? r.trace.actor
                : actor.charAt(0).toUpperCase() + actor.slice(1);
            status.push(
              error(
                "D12_unreachable_id",
                `${s.id}: ${who} does ${c.method} ${c.path} on an id from ${c.collection}, and no scenario shows ${who} getting that id.`,
                {
                  file: r.file,
                  line: s.line,
                  target: s.id,
                  fix: `Add a scenario where ${who} gets it (GET ${c.collection}, or the POST that creates it), or say in assumptions.md, in a row naming ${r.id} and ${c.collection}, where ${who} gets the id.`,
                }
              )
            );
          }
        }
      }
    }
  }

  // D8 — the draft is reviewable in one sitting.
  const max = files.maxRequirements ?? 25;
  if (reqs.length > max) {
    status.push(
      error(
        "D8_too_large",
        `The draft holds ${reqs.length} requirements; the review limit is ${max}.`,
        {
          fix: "Draft one module per change. A draft nobody can review in one sitting is approved without being read.",
        }
      )
    );
  }

  return {
    requirements: reqs.length,
    scenarios: reqs.reduce((n, r) => n + r.scenarios.length, 0),
    skipped,
    status,
  };
}

// ── The same rules on a hand-written specification ─────────────────────────────

const SECTION = /^(#{2,4})\s+(?:Requirement:\s*)?(REQ-[A-Za-z0-9.]+)\b\s*[—–:-]?\s*(.*)$/;
const TRACE = /<!--\s*specgate:trace\b(.*?)-->/;

/** Each requirement section of `spec.md` or a capability spec: id, line, text, trace. */
function sections(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Array<{ id: string; line: number; text: string; trace: Record<string, string> }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = SECTION.exec(lines[i].trim());
    if (!m) continue;
    const level = m[1].length;
    const body: string[] = [];
    const trace: Record<string, string> = {};
    for (let j = i + 1; j < lines.length; j += 1) {
      if (new RegExp(`^#{1,${level}}\\s+\\S`).test(lines[j])) break;
      const t = TRACE.exec(lines[j]);
      if (t) {
        for (const kv of t[1].matchAll(/([a-z_]+)=("([^"]*)"|'([^']*)'|(\S+))/gi)) {
          trace[kv[1].toLowerCase()] = kv[3] ?? kv[4] ?? kv[5];
        }
        continue;
      }
      body.push(lines[j]);
    }
    out.push({ id: m[2], line: i + 1, text: body.join("\n"), trace });
  }
  return out;
}

/**
 * Each requirement's title, from `spec.md` and the capability specs.
 *
 * The matrix names a use case, not a title; a requirement archived from a
 * change has no use case, so `status` listed eighteen of them with a blank
 * name (reservas_app, #48).
 */
export function requirementTitles(
  specs: ReadonlyArray<{ readonly source: string }>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of specs) {
    for (const line of f.source.replace(/\r\n/g, "\n").split("\n")) {
      const m = SECTION.exec(line.trim());
      if (m && m[3].trim() && !out.has(m[2])) out.set(m[2], m[3].trim());
    }
  }
  return out;
}

/**
 * D4 and D5 as a report on a project's own specification (ADR-0029 decision 6).
 *
 * The checks that need no brief and say something `plan` does not already:
 * D1 is `plan`'s "Needs Feature File"; D2 is not an omission outside a draft,
 * since a requirement with no kind is functional (use-case model, §2). Info
 * severity: adopting a release never turns a project red over its past
 * (ADR-0023).
 */
export function specNotes(
  specs: ReadonlyArray<{ readonly path: string; readonly source: string }>,
  features: ReadonlyArray<{ readonly path: string; readonly source: string }>
): Diagnostic[] {
  const notes: Diagnostic[] = [];
  for (const f of specs) {
    for (const r of sections(f.source)) {
      const where = { file: f.path, line: r.line, target: r.id };
      if (r.trace.kind === "non-functional") {
        const tagged = features.filter((x) => new RegExp(`@${r.id}(?![A-Za-z0-9])`).test(x.source));
        if (unmeasured([r.text, ...tagged.map((x) => x.source)].join("\n"))) {
          notes.push(
            info(
              "D4_unmeasured_nfr",
              `${r.id} promises a quantity (speed, load, availability) and states no number with a unit.`,
              {
                ...where,
                fix: 'State the measure: "within 2 seconds", "99.5 % of requests".',
              }
            )
          );
        }
      }
      if (r.trace.kind === "business-rule" && CITES.test(r.text) && !SOURCED.test(r.text)) {
        notes.push(
          info(
            "D5_unsourced_rule",
            `${r.id} cites a law, standard or contract and names no source.`,
            {
              ...where,
              fix: 'Add a "Source:" line: a link, or the clause and edition.',
            }
          )
        );
      }
    }
  }
  return notes;
}
