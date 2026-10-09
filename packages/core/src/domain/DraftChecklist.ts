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
import { error, info } from "./Diagnostic";
import { parseDelta } from "./SpecParser";
import { analyseScenario } from "./GherkinQuality";

export const KINDS = new Set(["functional", "non-functional", "business-rule"]);

export interface DraftFiles {
  /** The change's delta specs: `specs/<capability>/spec.md`. */
  readonly deltas: ReadonlyArray<{ readonly path: string; readonly source: string }>;
  /** The brief the draft was written from, as text. Without it, D3 and D6 cannot run. */
  readonly brief?: string;
  readonly assumptions?: string;
  /**
   * The project's specification as it stands — `spec.md` and the capability
   * specs. A value already there was reviewed in an earlier change; D6
   * flagged "Configuración" and "11:00" in a second draft for not being in the
   * brief (reservas_app, #52).
   */
  readonly specText?: string;
  readonly questions?: string;
  readonly maxRequirements?: number;
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
}

// ── The brief's front matter ──────────────────────────────────────────────────

/** `actors: [{ name: Worker, surfaces: [mobile] }]` → Worker → [mobile]. */
export function actorSurfaces(brief: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const fm = /^---\n([\s\S]*?)\n---/.exec(brief.replace(/\r\n/g, "\n"));
  if (!fm) return out;
  const re = /\{\s*name:\s*([^,}]+?)\s*,\s*surfaces:\s*\[([^\]]*)\]\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fm[1])) !== null) {
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
function questionRows(
  md: string
): Array<{ row: string; blocks: string[]; line: number; answered: boolean }> {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex((l) => /^\|.*\bBlocks\b.*\|/i.test(l));
  if (header === -1) return [];
  const cols = lines[header].split("|").map((c) => c.trim().toLowerCase());
  const at = cols.indexOf("blocks");
  const answerCol = cols.findIndex((c) => c === "answer" || c === "respuesta");
  const answerLines = lines.filter((l) => /^\s*(?:[-*]\s*)?\**(answer|respuesta)\b/i.test(l));
  const out: Array<{ row: string; blocks: string[]; line: number; answered: boolean }> = [];
  for (let i = header + 2; i < lines.length && /^\|/.test(lines[i]); i += 1) {
    const cells = lines[i].split("|").map((c) => c.trim());
    const row = cells[1] || `row ${i + 1}`;
    const named = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(row)}(?![A-Za-z0-9])`);
    out.push({
      row,
      blocks: (cells[at] || "").match(/REQ-[A-Za-z0-9.]+/g) || [],
      line: i + 1,
      answered:
        (answerCol > 0 && (cells[answerCol] || "").length > 0) ||
        answerLines.some((l) => named.test(l)),
    });
  }
  return out;
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

// ── The checklist ─────────────────────────────────────────────────────────────

export function checkDraft(files: DraftFiles): DraftReport {
  const status: Diagnostic[] = [];
  const skipped: Array<{ rule: string; why: string }> = [];
  const reqs: Req[] = [];

  for (const d of files.deltas) {
    const delta: any = parseDelta(d.source);
    for (const r of [...(delta.added || []), ...(delta.modified || [])]) {
      reqs.push({
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
          fix: `Add <!-- csda:trace kind=functional --> (or non-functional, business-rule) under its heading.`,
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
      const steps = r.scenarios.flatMap((s) => s.steps);
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

  // D6 — a stated value is in the brief or listed as an assumption.
  if (!files.brief) {
    skipped.push({ rule: "D6", why: "no brief given" });
  } else {
    const assumptions = files.assumptions || "";
    for (const r of reqs) {
      for (const s of r.scenarios) {
        // One finding per value per scenario: a name repeated in three steps is
        // one thing to list, not three (#43).
        const seen = new Set<string>();
        for (const step of s.steps) {
          for (const v of statedValues(step)) {
            if (seen.has(v)) continue;
            seen.add(v);
            if (inText(v, files.brief)) continue;
            if (files.specText && inText(v, files.specText)) continue;
            const listed = assumptions
              .split("\n")
              .some((row) => inText(v, row) && (row.includes(s.id) || row.includes(r.id)));
            if (listed) continue;
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
      if (q.answered) continue;
      if (q.blocks.length === 0) {
        status.push(
          error("D7_floating_question", `Question ${q.row} blocks no requirement.`, {
            file: "questions.md",
            line: q.line,
            fix: "Name the requirements it blocks in the Blocks column — a question that blocks nothing is answered by guessing.",
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
              `Question ${q.row} blocks ${id}, and ${id} is not Needs Clarification.`,
              {
                ...at(r),
                fix: `Set status="Needs Clarification" in ${id}'s csda:trace, so it cannot be built around the question.`,
              }
            )
          );
        }
      }
    }
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
const TRACE = /<!--\s*csda:trace\b(.*?)-->/;

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
