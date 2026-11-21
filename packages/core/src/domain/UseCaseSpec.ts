/**
 * A use case's specification (REQ-631, #544): one file per use case,
 * `docs/specs/use-cases/UC-NNN.md`, that travels in a change like its
 * requirements and is merged at archive.
 *
 *   # UC-004 — Create a child profile
 *
 *   ## Overview
 *   The tutor gives a child a profile of their own.
 *
 *   ## Actors
 *   - Tutor
 *
 *   ## Preconditions
 *   - The tutor is signed in.
 *
 *   ## Main flow (SCN-012)
 *   1. The tutor opens Profiles and presses "New profile".
 *   2. The tutor writes a nickname and picks an avatar.
 *   3. The system saves the profile and shows it in the list.
 *
 *   ## Alternative flows
 *   ### A1 — The nickname is taken (at step 3) (SCN-013)
 *   1. The system says the nickname is taken and keeps the form.
 *
 *   ## Postconditions
 *   - The child's profile exists, with no legal name.
 *
 *   ## Business rules
 *   - REQ-014: a profile asks for no legal name.
 *
 * Every flow names the scenario that proves it, so a flow nothing tests
 * shows. Pure: strings in, findings out.
 */

export interface UseCaseFlow {
  /** `main`, or the alternative's label: `A1`. */
  id: string;
  title: string;
  /** The main flow's step an alternative starts at; null for the main flow. */
  atStep: number | null;
  scenarios: string[];
  steps: string[];
  /**
   * Who does each step (REQ-640): its `[Actor]` tag, else the use case's first
   * actor; "" when it lists none. As long as `steps`.
   */
  lanes: string[];
  line: number;
}

export interface UseCaseSpec {
  id: string;
  name: string;
  overview: string;
  actors: string[];
  preconditions: string[];
  flows: UseCaseFlow[];
  postconditions: string[];
  /** The requirements its business rules name. */
  rules: Array<{ requirement: string | null; text: string }>;
}

export interface SpecFinding {
  code: string;
  message: string;
  fix: string;
  line?: number;
  target?: string;
}

const SCN = /\bSCN-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*\b/g;
const bullets = (lines: string[]) =>
  lines.map((l) => /^\s*[-*]\s+(.+?)\s*$/.exec(l)?.[1]).filter((x): x is string => !!x);

/** An alternative flow's heading: `A1 — The nickname is taken (at step 3) (SCN-013)`. */
function alternative(head: string, n: number, line: number): UseCaseFlow {
  const at = /\bat step (\d+)\b/i.exec(head);
  return {
    id: /^(A\d+)\b/.exec(head)?.[1] ?? `A${n}`,
    title: head
      .replace(/^A\d+\s*[—–-]\s*/, "")
      .replace(/\s*\((?:at step \d+|SCN-[^)]*)\)/gi, "")
      .trim(),
    atStep: at ? Number(at[1]) : null,
    scenarios: [...head.matchAll(SCN)].map((m) => m[0]),
    steps: [],
    lanes: [],
    line,
  };
}

export function parseUseCaseSpec(text: string): UseCaseSpec {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const title = /^#\s+(UC-\d+)\s*[—–-]\s*(.+?)\s*$/.exec(lines.find((l) => /^#\s/.test(l)) ?? "");
  const bodies = new Map<string, string[]>();
  const flows: UseCaseFlow[] = [];
  let section = "";
  let flow: UseCaseFlow | null = null;
  lines.forEach((l, i) => {
    const h2 = /^##\s+(.+?)\s*$/.exec(l);
    if (h2) {
      section = h2[1].toLowerCase().replace(/\s*\(.*$/, "");
      flow = null;
      if (section === "main flow") {
        flow = {
          id: "main",
          title: "Main flow",
          atStep: null,
          scenarios: [...h2[1].matchAll(SCN)].map((m) => m[0]),
          steps: [],
          lanes: [],
          line: i + 1,
        };
        flows.push(flow);
      } else if (!bodies.has(section)) bodies.set(section, []);
      return;
    }
    const h3 = /^###\s+(.+?)\s*$/.exec(l);
    if (h3 && section === "alternative flows") {
      flow = alternative(h3[1], flows.filter((f) => f.id !== "main").length + 1, i + 1);
      flows.push(flow);
      return;
    }
    const step = /^\s*\d+[.)]\s+(.+?)\s*$/.exec(l)?.[1];
    if (flow && step) {
      // REQ-640: `[Actor] text` — the tag is the step's lane; resolved below.
      const tag = /^\[([^\]]+)\]\s*(.*)$/.exec(step);
      flow.steps.push(tag ? tag[2] : step);
      flow.lanes.push(tag ? tag[1].trim() : "");
    } else if (!flow) bodies.get(section)?.push(l);
  });
  const body = (k: string) => bodies.get(k) ?? [];
  const first = bullets(body("actors"))[0] ?? "";
  for (const f of flows) f.lanes = f.lanes.map((l) => l || first);
  return {
    id: title?.[1] ?? "",
    name: title?.[2] ?? "",
    overview: body("overview").join("\n").trim(),
    actors: bullets(body("actors")),
    preconditions: bullets(body("preconditions")),
    flows,
    postconditions: bullets(body("postconditions")),
    rules: bullets(body("business rules")).map((text) => ({
      requirement: /\bREQ-[A-Za-z0-9]+\b/.exec(text)?.[0] ?? null,
      text,
    })),
  };
}

/**
 * What is wrong with a use case's specification (REQ-631): its id, an
 * overview and a main flow with steps; each flow naming a scenario of the use
 * case's requirements (`scenarios`: the scenarios of the requirements the
 * catalog or the change lists for it); an alternative starting at a step the
 * main flow has; and every one of those scenarios proved by some flow.
 */
export function checkUseCaseSpec(
  spec: UseCaseSpec,
  expectedId: string,
  scenarios: ReadonlySet<string>
): SpecFinding[] {
  const out: SpecFinding[] = [];
  if (spec.id !== expectedId)
    out.push({
      code: "ucs_wrong_id",
      message: `The specification of ${expectedId} is titled "${spec.id || "nothing"}".`,
      fix: `Start it with "# ${expectedId} — <its name>".`,
      target: expectedId,
    });
  if (!spec.overview)
    out.push({
      code: "ucs_no_overview",
      message: `${expectedId} has no overview.`,
      fix: "Say in a sentence or two what the actor achieves and why, under ## Overview.",
      target: expectedId,
    });
  const main = spec.flows.find((f) => f.id === "main");
  if (!main || main.steps.length === 0)
    out.push({
      code: "ucs_no_main_flow",
      message: `${expectedId} has no main flow with numbered steps.`,
      fix: "Write ## Main flow (SCN-NNN) with numbered steps: 1. The actor …, 2. The system …",
      target: expectedId,
    });
  for (const f of spec.flows) {
    const where = f.id === "main" ? "Its main flow" : `${f.id}`;
    // REQ-640: a step's lane is one of the use case's actors.
    for (const lane of new Set(f.lanes))
      if (lane && !spec.actors.includes(lane))
        out.push({
          code: "ucs_unknown_lane",
          message: `${expectedId}: ${where} has a step done by ${lane}, who is not among its actors.`,
          fix: `List ${lane} under ## Actors, or tag the step with one of ${spec.actors.join(", ") || "its actors"}.`,
          line: f.line,
          target: expectedId,
        });
    if (f.scenarios.length === 0)
      out.push({
        code: "ucs_flow_untested",
        message: `${expectedId}: ${where} names no scenario.`,
        fix: "Name the scenario that proves it in its heading: (SCN-NNN).",
        line: f.line,
        target: expectedId,
      });
    for (const s of f.scenarios) {
      if (!scenarios.has(s))
        out.push({
          code: "ucs_unknown_scenario",
          message: `${expectedId}: ${where} names ${s}, which no requirement of ${expectedId} has.`,
          fix: `Name a scenario of ${expectedId}'s requirements, or list the requirement that has ${s} in its use case.`,
          line: f.line,
          target: expectedId,
        });
    }
    if (f.id !== "main") {
      if (f.atStep === null || !main || f.atStep < 1 || f.atStep > main.steps.length)
        out.push({
          code: "ucs_bad_step",
          message: `${expectedId}: ${f.id} starts at ${f.atStep === null ? "no step" : `step ${f.atStep}`}, which the main flow does not have.`,
          fix: `Say where it branches: "### ${f.id} — <what happens> (at step N) (SCN-NNN)".`,
          line: f.line,
          target: expectedId,
        });
      if (f.steps.length === 0)
        out.push({
          code: "ucs_empty_flow",
          message: `${expectedId}: ${f.id} has no steps.`,
          fix: "Number what happens: 1. The system …",
          line: f.line,
          target: expectedId,
        });
    }
  }
  const named = new Set(spec.flows.flatMap((f) => f.scenarios));
  for (const s of scenarios) {
    if (!named.has(s))
      out.push({
        code: "ucs_scenario_unflowed",
        message: `${expectedId}: ${s} is a scenario of its requirements, and no flow names it.`,
        fix: `Add the flow ${s} proves — the main flow or an alternative — with (${s}) in its heading.`,
        target: expectedId,
      });
  }
  return out;
}

/** The specification a new use case starts from (REQ-632): its sections, to fill in. */
export function templateUseCaseSpec(id: string, name: string, actor: string): string {
  return [
    `# ${id} — ${name}`,
    "",
    "## Overview",
    "",
    "<what the actor achieves, and why>",
    "",
    "## Actors",
    "",
    `- ${actor}`,
    "",
    "## Preconditions",
    "",
    "- <what holds before it starts>",
    "",
    "## Main flow (SCN-NNN)",
    "",
    "1. <the actor does one thing>",
    "2. <the system answers>",
    "",
    "## Alternative flows",
    "",
    "### A1 — <what goes otherwise> (at step 2) (SCN-NNN)",
    "",
    "1. <what happens instead>",
    "",
    "## Postconditions",
    "",
    "- <what holds once it ends>",
    "",
    "## Business rules",
    "",
    "- REQ-NNN: <the rule, as the requirement says it>",
    "",
  ].join("\n");
}
