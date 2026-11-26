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

import { checkUseCaseDelta, parseUseCaseDelta, readCatalog } from "./UseCaseDelta";
import { checkUseCaseSpec, parseUseCaseSpec } from "./UseCaseSpec";
import {
  applyStateMachineDelta,
  checkStateMachine,
  checkStateMachineDelta,
  parseStateMachine,
  parseStateMachineDelta,
} from "./StateMachine";
import type { Diagnostic } from "./Diagnostic";
import { error, info, warning } from "./Diagnostic";
import { parseDelta } from "./SpecParser";
import { analyseScenario } from "./GherkinQuality";
import { withoutComments } from "./QuotedText";
import {
  answerLines,
  assumptionsToReview,
  deferredAnswer,
  isAnswered,
  questionTable,
} from "./Clarification";

export { deferredAnswer };

export const KINDS = new Set(["functional", "non-functional", "business-rule"]);

export interface DraftFiles {
  /** The project's `language` (`es`, `en`), when set: every scenario's steps in it (REQ-668). */
  readonly language?: string | null;
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
  /**
   * The change's `use-cases.md` (REQ-626): when the draft has one, every
   * requirement names its use case (`uc=`) and D14 checks them. A draft
   * opened before use cases had none, and is left as it was.
   */
  readonly useCases?: string;
  /** `docs/specs/use-cases.md`: the use cases already approved. */
  readonly catalog?: string;
  /** The change's `use-cases/UC-NNN.md`, by id (REQ-632). */
  readonly useCaseSpecs?: Readonly<Record<string, string>>;
  /**
   * The change's `state-machines/<Entity>.md` deltas, each with the machine it
   * changes (`docs/specs/state-machines/<Entity>.md`), null for a new one (REQ-639).
   */
  readonly stateMachines?: ReadonlyArray<{
    readonly file: string;
    readonly delta: string;
    readonly base: string | null;
  }>;
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
/**
 * An actor's name in \`{ name: … }\` (#541): in double or single quotes — where a
 * comma belongs to the name — or bare, up to the first comma or brace.
 */
export const ACTOR_NAME = String.raw`("[^"]*"|'[^']*'|[^,}"']+?)`;

/** The name as written, without the quotes that hold it. */
export function actorName(raw: string): string {
  const t = raw.trim();
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1).trim() : t;
}

/** A name as YAML reads it back: in double quotes when it holds a comma, a colon, a brace or a bracket. */
export function yamlName(name: string): string {
  return /[,:{}[\]#"'\\]/.test(name)
    ? `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : name;
}

export function actorSurfaces(brief: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const fields = frontMatterFields(brief);
  if (fields === null) return out;
  const re = new RegExp(
    String.raw`\{\s*name:\s*${ACTOR_NAME}\s*,\s*surfaces:\s*\[([^\]]*)\]\s*\}`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(fields)) !== null) {
    out.set(
      actorName(m[1]).toLowerCase(),
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
/** `2026-10-29`, `10:00:00`, `07:42`, `2026-10-29 10:00:00`, `2026-10-29T10:00:00Z`. */
const DATE_OR_TIME =
  /(?<![\w.:-])(?:\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?![\w:.-]?\d)/g;

export function statedValues(step: string): string[] {
  const text = step.replace(ID_TOKEN, " ").replace(/^\s*(GIVEN|WHEN|THEN|AND|BUT)\b/i, "");
  const out: string[] = [];
  for (const q of text.matchAll(/"([^"]+)"/g)) out.push(q[1]);
  let unquoted = text.replace(/"[^"]*"/g, " ").replace(/`[^`]*`/g, " ");
  // REQ-277: a date, a time or a date-time is one value. Read as numbers,
  // "at 2026-10-29 10:00:00" gave "29" and "00", which the agent then had to
  // list one by one before the draft could be reviewed (truck-flote, S60).
  // Masked with spaces of the same length, so values keep the order they are written in.
  const found: { at: number; value: string }[] = [];
  unquoted = unquoted.replace(DATE_OR_TIME, (m: string, at: number) => {
    found.push({ at, value: m });
    return " ".repeat(m.length);
  });
  for (const n of unquoted.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?![\w])/g))
    found.push({ at: n.index || 0, value: n[0] });
  for (const f of found.sort((a, b) => a.at - b.at)) out.push(f.value);
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
    // The same reading as the studio's and `specgate questions` (REQ-429).
    const answers = [
      ...(answerCol > 0 && (cells[answerCol] || "").length > 0 ? [cells[answerCol]] : []),
      ...answerLines(md, row),
    ];
    const deferred = answers.length > 0 && answers.every(deferredAnswer);
    out.push({
      row,
      blocks: (cells[at] || "").match(/REQ-[A-Za-z0-9.]+/g) || [],
      noneBlocked: NONE_BLOCKED.test((cells[at] || "").replace(/\*\*/g, "").trim()),
      line: i + 1,
      answered: isAnswered(answers),
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

// The unit ends where no letter follows: `\b` after "%" never matched, so
// "99.5% of each month" read as unmeasured (REQ-601).
const MEASURE =
  /\d+(?:[.,]\d+)?\s*(ms|s|sec|seconds?|min|minutes?|h|hours?|%|m|km|kb|mb|gb|px|req\/s|rps|users?|days?)(?![a-z])/i;
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

/**
 * A threshold named without its value (REQ-480): "above some amount", "from a
 * certain number", "a partir de cierto importe", "ab einem bestimmten Betrag".
 */
const UNNAMED_THRESHOLD =
  /\b(?:some|a certain|certain|a given|a specific)\s+(?:amount|number|sum|limit|threshold|value|price|quantity|percentage|period)\b|\b(?:ciert[oa]|algún|alguna|determinad[oa])\s+(?:importe|monto|cantidad|número|límite|umbral|valor|precio|porcentaje|plazo)\b|\b(?:bestimmte[nmrs]?|gewisse[nmrs]?)\s+(?:Betrag|Menge|Anzahl|Grenze|Schwelle|Wert|Preis|Summe)\b/iu;

/** Promises a quantity and states none, or names a threshold without its value. */
export function unmeasured(text: string): boolean {
  return (QUANTITATIVE.test(text) && !MEASURE.test(text)) || UNNAMED_THRESHOLD.test(text);
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
    // walkthrough-fixes-2 REQ-783: the client's answer to a question is a source,
    // as the brief is — for the requirements the question blocks.
    const answered = questionTable(files.questions || "").filter(
      (q) => q.answered && q.answer.trim()
    );
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
              answered.some(
                (q) => q.blocks.some((b) => b.includes(r.id)) && inText(value, q.answer)
              ) ||
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

  // D16 — a scenario's steps in the project's language, else its title's (REQ-668).
  for (const r of reqs) {
    for (const s of r.scenarios) {
      const steps = textLanguage(s.steps.map((x) => x.replace(/^\s*\S+\s*/, "")).join(" "));
      const want = files.language || textLanguage(s.name || "") || textLanguage(r.name || "");
      if (!steps || !want || steps === want) continue;
      const name = LANGUAGE_NAMES[want] ?? want;
      status.push(
        error(
          "D16_scenario_language",
          `${s.id}'s steps are in ${LANGUAGE_NAMES[steps] ?? steps}, not ${name}: one language in a feature file.`,
          {
            file: r.file,
            line: s.line,
            target: s.id,
            fix: `Write ${s.id}'s steps in ${name}, as its title — GIVEN, WHEN and THEN stay.`,
          }
        )
      );
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

  // D16 — a state machine the draft writes applies, and holds once applied (REQ-639).
  if (files.stateMachines && files.stateMachines.length > 0) {
    const known = new Set<string>(reqs.map((r) => r.id));
    for (const id of files.idsInUse?.keys() ?? []) if (/^REQ-/.test(id)) known.add(id);
    for (const m of files.stateMachines) {
      const delta = parseStateMachineDelta(m.delta);
      const base = m.base === null ? null : parseStateMachine(m.base);
      const push = (fs: ReturnType<typeof checkStateMachine>) => {
        for (const f of fs)
          status.push(
            (f.severity === "error" ? error : warning)(`D16_${f.code}`, f.message, {
              file: m.file,
              ...(f.line ? { line: f.line } : {}),
              ...(f.target ? { target: f.target } : {}),
              fix: f.fix,
            })
          );
      };
      const deltaFindings = checkStateMachineDelta(delta, base, known);
      push(deltaFindings);
      if (deltaFindings.some((f) => f.severity === "error")) continue;
      const after = applyStateMachineDelta(base, delta);
      if (after !== null) push(checkStateMachine(parseStateMachine(after), known));
    }
  }

  // D14 — every requirement names the use case it delivers (REQ-626, #543).
  if (files.useCases !== undefined) {
    const delta = parseUseCaseDelta(files.useCases);
    const catalog = readCatalog(files.catalog ?? null);
    const known = new Set([
      ...catalog.filter((c) => !c.template).map((c) => c.id),
      ...delta.added.map((u) => u.id),
      ...delta.modified.map((u) => u.id),
    ]);
    const ucFile = files.deltas[0]?.path.replace(/\/specs\/.*$/, "/use-cases.md");
    for (const r of reqs) {
      const uc = String(r.trace.uc ?? "").trim();
      if (!uc) {
        status.push(
          error("D14_no_use_case", `${r.id} names no use case.`, {
            ...at(r),
            fix: `Add uc=UC-NNN to its specgate:trace, and the use case to use-cases.md under ## ADDED Use Cases with ${r.id} in its row.`,
          })
        );
      } else if (!known.has(uc)) {
        status.push(
          error(
            "D14_unknown_use_case",
            `${r.id} names ${uc}, which neither use-cases.md of the change nor docs/specs/use-cases.md has.`,
            {
              ...at(r),
              fix: `Add ${uc} under ## ADDED Use Cases in the change's use-cases.md, or name a use case that exists.`,
            }
          )
        );
      }
    }
    const named = new Map(reqs.map((r) => [r.id, String(r.trace.uc ?? "").trim()]));
    for (const f of checkUseCaseDelta(delta, catalog)) {
      status.push(
        error(`D14_${f.code}`, f.message, {
          ...(ucFile ? { file: ucFile } : {}),
          ...(f.target ? { target: f.target } : {}),
          fix: f.fix,
        })
      );
    }
    // D15 — each use case the draft adds or modifies has its specification,
    // whose flows name the scenarios of the requirements that deliver it (REQ-632).
    if (files.useCaseSpecs !== undefined) {
      for (const u of [...delta.added, ...delta.modified]) {
        const source = files.useCaseSpecs[u.id];
        const specFile = ucFile?.replace(/use-cases\.md$/, `use-cases/${u.id}.md`);
        if (source === undefined) {
          status.push(
            error("D15_no_spec", `${u.id} has no specification.`, {
              ...(specFile ? { file: specFile } : {}),
              target: u.id,
              fix: `Write use-cases/${u.id}.md: overview, actors, preconditions, the main flow and alternatives — each naming its scenario — postconditions and business rules.`,
            })
          );
          continue;
        }
        const mine = reqs.filter((r) => String(r.trace.uc ?? "").trim() === u.id);
        const scenarios = new Set(mine.flatMap((r) => r.scenarios.map((s) => s.id)));
        // A modified use case some requirement outside the draft delivers:
        // its scenarios are not all here, so only what the draft has is checked.
        const whole = u.requirements.every((q) => mine.some((r) => r.id === q));
        for (const f of checkUseCaseSpec(parseUseCaseSpec(source), u.id, scenarios)) {
          if (!whole && (f.code === "ucs_unknown_scenario" || f.code === "ucs_scenario_unflowed"))
            continue;
          status.push(
            error(`D15_${f.code}`, f.message, {
              ...(specFile ? { file: specFile } : {}),
              ...(f.line ? { line: f.line } : {}),
              target: u.id,
              fix: f.fix,
            })
          );
        }
      }
    }
    for (const u of [...delta.added, ...delta.modified]) {
      for (const req of u.requirements) {
        const theirs = named.get(req);
        if (theirs !== undefined && theirs !== u.id) {
          status.push(
            error(
              "D14_use_case_mismatch",
              `${u.id} lists ${req}, and ${req} names ${theirs || "no use case"}.`,
              {
                ...(ucFile ? { file: ucFile } : {}),
                target: u.id,
                fix: `Set uc=${u.id} on ${req}, or drop ${req} from ${u.id}'s row.`,
              }
            )
          );
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

/** The languages D16 names. */
const LANGUAGE_NAMES: Record<string, string> = { es: "Spanish", en: "English" };

const ES_WORDS = new Set(
  "el la los las de del que se un una por con para y en es su sus al no está están hay como cuando entonces sin ya lo le".split(
    " "
  )
);
const EN_WORDS = new Set(
  "the a an of and is are to in with for its it not has have on when then as be by at their this".split(
    " "
  )
);

/**
 * A text's language — Spanish or English — by its common words, its quoted
 * strings left out (a Spanish button in an English step); null when it says
 * too little to tell (REQ-668).
 */
export function textLanguage(text: string): "es" | "en" | null {
  const words =
    text
      .replace(/"[^"]*"|«[^»]*»|`[^`]*`/g, " ")
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [];
  // A word with an accent or an ñ says Spanish too: short titles have few common words.
  const es = words.filter((w) => ES_WORDS.has(w) || /[áéíóúñü]/.test(w)).length;
  const en = words.filter((w) => EN_WORDS.has(w)).length;
  if (es + en < 3) return null;
  if (es >= en * 2) return "es";
  if (en >= es * 2) return "en";
  return null;
}
