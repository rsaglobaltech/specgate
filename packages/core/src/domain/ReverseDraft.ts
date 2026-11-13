/**
 * What `specgate reverse` turns an agent's reading of existing code into
 * (REQ-529, REQ-530).
 *
 * The agent does not write the delta. It answers a small JSON document —
 * requirements with their scenarios and the lines they were read from — and
 * Specgate writes the delta from it. That is what makes REQ-530 a property of
 * the tool rather than a request in a prompt: every requirement carries its
 * `source=`, every one is `Draft`, and behaviour the agent marks as suspect
 * is written as a question, never as a requirement, whatever the agent hoped.
 *
 * Code describes what a system does, including its defects. A reversed
 * requirement that enshrines a bug turns the bug into the contract; asking is
 * the only safe answer.
 */

/** The file the agent writes, inside the change's folder. */
export const REVERSE_ANSWER_FILE = "reverse.json";

export interface ReversedScenario {
  readonly title: string;
  /** `GIVEN …`, `WHEN …`, `THEN …` (and `AND …`) lines, in order. */
  readonly steps: readonly string[];
}

export interface ReversedRequirement {
  readonly title: string;
  /** The requirement's text: "The system SHALL …". */
  readonly text: string;
  /** Where it was read from: `path` or `path:line`. At least one. */
  readonly source: readonly string[];
  readonly scenarios: readonly ReversedScenario[];
  /** Set when the agent judges the behaviour a defect, not a rule: why. */
  readonly suspect?: string;
}

export interface ReverseAnswer {
  readonly requirements: readonly ReversedRequirement[];
}

export type ParsedAnswer =
  | { readonly ok: true; readonly answer: ReverseAnswer }
  | { readonly ok: false; readonly problems: readonly string[] };

const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const STEP_RE = /^(GIVEN|WHEN|THEN|AND|BUT)\s+\S/;

/**
 * Read the agent's answer. Every problem is named, with the requirement it is
 * in: a person fixes an agent's answer by re-running it, and needs to know why.
 */
export function parseReverseAnswer(text: string): ParsedAnswer {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, problems: [`not JSON: ${(e as Error).message}`] };
  }
  const list = (data as { requirements?: unknown } | null)?.requirements;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, problems: ["needs a non-empty `requirements` list"] };
  }
  const problems: string[] = [];
  const requirements: ReversedRequirement[] = [];
  list.forEach((raw, i) => {
    const r = (raw || {}) as Record<string, unknown>;
    const where = `requirement ${i + 1}${isText(r.title) ? ` (${r.title})` : ""}`;
    const source = Array.isArray(r.source) ? r.source.filter(isText) : [];
    const suspect = isText(r.suspect) ? r.suspect.trim() : undefined;
    if (!isText(r.title)) problems.push(`${where}: needs a title`);
    if (!isText(r.text)) problems.push(`${where}: needs a text`);
    if (source.length === 0) problems.push(`${where}: needs a source — the file it was read from`);
    if (source.some((s) => /[\s,"']/.test(s))) {
      problems.push(`${where}: a source is a path or path:line, without spaces or commas`);
    }
    const scenarios: ReversedScenario[] = [];
    const rawScenarios = Array.isArray(r.scenarios) ? r.scenarios : [];
    if (!suspect && rawScenarios.length === 0) problems.push(`${where}: needs a scenario`);
    rawScenarios.forEach((s, j) => {
      const sc = (s || {}) as Record<string, unknown>;
      const steps = Array.isArray(sc.steps) ? sc.steps.filter(isText).map((x) => x.trim()) : [];
      if (!isText(sc.title)) problems.push(`${where}, scenario ${j + 1}: needs a title`);
      if (steps.length === 0 || steps.some((x) => !STEP_RE.test(x))) {
        problems.push(`${where}, scenario ${j + 1}: steps start with GIVEN, WHEN, THEN or AND`);
      }
      scenarios.push({ title: String(sc.title || "").trim(), steps });
    });
    requirements.push({
      title: String(r.title || "").trim(),
      text: String(r.text || "").trim(),
      source,
      scenarios,
      ...(suspect ? { suspect } : {}),
    });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, answer: { requirements } };
}

/** The suspect behaviours, which become questions, and the rules, which become requirements. */
export function splitSuspects(answer: ReverseAnswer): {
  rules: ReversedRequirement[];
  suspects: ReversedRequirement[];
} {
  return {
    rules: answer.requirements.filter((r) => !r.suspect),
    suspects: answer.requirements.filter((r) => !!r.suspect),
  };
}

/** The question a suspect behaviour is written as. */
export function suspectQuestion(r: ReversedRequirement): string {
  return `The code does this: ${r.text} (${r.source.join(", ")}). Is it a rule to keep, or a defect? ${r.suspect}`;
}

/**
 * The delta for the rules, numbered from `firstId`, every one `Draft` and
 * citing its sources. Scenario ids follow the requirement: SCN-NNNa, b, …
 */
export function renderReverseDelta(
  capability: string,
  rules: readonly ReversedRequirement[],
  firstId: number
): string {
  const out = [`# Delta — ${capability}`, "", "## ADDED Requirements", ""];
  rules.forEach((r, i) => {
    const n = String(firstId + i).padStart(3, "0");
    out.push(`### Requirement: REQ-${n} — ${r.title}`, "", r.text, "");
    r.scenarios.forEach((s, j) => {
      out.push(`#### Scenario: SCN-${n}${String.fromCharCode(97 + (j % 26))} — ${s.title}`, "");
      for (const step of s.steps) out.push(`- ${step}`);
      out.push("");
    });
    out.push(
      `<!-- specgate:trace status=Draft actor=Developer kind=functional source=${r.source.join(",")} -->`,
      ""
    );
  });
  return out.join("\n");
}

// ── REQ-530: the evidence a requirement cites ───────────────────────────────

export interface CitedSource {
  /** The requirement whose trace cites it, or "" when no heading precedes it. */
  readonly requirement: string;
  /** As written: `path` or `path:line`. */
  readonly source: string;
  /** The file part. */
  readonly file: string;
}

/** The file a `path:line` cites. */
export function sourceFile(source: string): string {
  return source.replace(/:\d+(?:-\d+)?$/, "");
}

const SOURCE_ATTR = /\bsource=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/;

/** Every `source=` a spec's trace comments cite, with the requirement each belongs to. */
export function citedSources(spec: string): CitedSource[] {
  const out: CitedSource[] = [];
  let requirement = "";
  for (const line of spec.split("\n")) {
    const heading = /^###\s+Requirement:\s+(REQ-\d+)/.exec(line);
    if (heading) {
      requirement = heading[1];
      continue;
    }
    const t = line.trim();
    if (!t.startsWith("<!--") || !t.includes("specgate:trace")) continue;
    const m = SOURCE_ATTR.exec(t);
    if (!m) continue;
    const value = (m[1] ?? m[2] ?? m[3] ?? "").replace(/-->$/, "");
    for (const s of value.split(",").map((x) => x.trim())) {
      if (s) out.push({ requirement, source: s, file: sourceFile(s) });
    }
  }
  return out;
}
