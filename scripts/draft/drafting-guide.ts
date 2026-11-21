/**
 * `DRAFTING.md` — what `specgate draft <module>` leaves in the change for
 * whoever writes the draft, a person or an agent.
 *
 * The brief-to-draft step used to need four commands, a hand edit of
 * `change.yaml`, and a prompt the user had to write themselves: `change
 * author --artifact specs` handed the agent the delta grammar and never the
 * brief, never asked for `assumptions.md` or `questions.md`, and never said
 * that `draft --check` was the bar (#93, #94). This file is that prompt,
 * written once, with the project's own facts filled in: the module, the
 * brief, the reserved ids, and every actor and surface the checklist will
 * ask about. An agent told "follow DRAFTING.md" needs nothing else.
 *
 * The formats below are the ones `DraftChecklist` parses — the trace keys
 * D2 and D3 read, the `Used in` column D6 reads, the `Blocks` column D7
 * reads — so following the guide is following the gate.
 */

export interface DraftingGuideInput {
  module: string;
  changeId: string;
  brief: string;
  reqRange: [string, string];
  firstScenario: string;
  /** The last of the change's reserved scenario ids (REQ-157). */
  lastScenario?: string;
  maxRequirements: number;
  /** actor → surfaces, from the brief's front matter. */
  actors: Map<string, string[]>;
  /** The module's own section of the brief, when it has one (ADR-0038). */
  cards?: ModuleCards;
  /** The use case ids reserved for this draft (REQ-626); none for an older draft. */
  ucRange?: [string, string];
}

/** A module's section of the brief, as `DRAFTING.md` hands it over. */
export interface ModuleCards {
  /** The section as the brief writes it, heading included. */
  source: string;
  /** Its numbers and "quoted labels", in order. */
  values: string[];
  questions: string[];
  /**
   * The brief's `## Quality` entries this draft writes, as the brief writes
   * them (REQ-603): the ones naming the module, and the product-wide ones in
   * the first module's draft.
   */
  quality?: string[];
}

/** The module's cards: the scope, the values, the questions — or nothing. */
function cardsPart(i: DraftingGuideInput): string[] {
  const cards = i.cards;
  if (!cards) return [];
  return [
    "## 0. Your scope — the " + i.module + " section of the brief",
    "",
    "This is the only text you draft from. Each **rule** becomes a requirement",
    "(quote it under `> Brief:`), each **example** a scenario of that",
    "requirement, each **question** a row of `questions.md`.",
    "",
    "````markdown",
    cards.source,
    "````",
    "",
    ...(cards.values.length
      ? [
          "**The values you may use** — write them exactly so; any other value goes",
          "in `assumptions.md` or becomes a question:",
          "",
          cards.values.map((v) => `\`${v}\``).join(" · "),
          "",
        ]
      : []),
    ...(cards.questions.length
      ? [
          "**Questions to copy into `questions.md`**, each with the requirements it",
          "blocks:",
          "",
          ...cards.questions.map((q) => `- ${q}`),
          "",
        ]
      : []),
    ...(cards.quality && cards.quality.length
      ? [
          "**Quality requirements to write** — from the brief's `## Quality` section",
          "(ISO/IEC 25010). Each becomes one requirement of kind `non-functional`,",
          "its entry quoted under `> Brief:`, with a scenario that measures its",
          "number:",
          "",
          ...cards.quality.map((q) => `- ${q}`),
          "",
        ]
      : []),
  ];
}

const SCREEN = new Set(["web", "mobile", "desktop", "app", "screen", "ui"]);

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Member: an API scenario and a web scenario". */
function surfaceLine(actor: string, surfaces: string[]): string {
  const each = surfaces.map((s) =>
    s === "api"
      ? "an API scenario (WHEN they send `POST /api/…`, THEN the response)"
      : `a ${s} scenario (WHEN they open or tap something${SCREEN.has(s) ? "" : ` on ${s}`}, THEN what they see)`
  );
  return `- **${capitalise(actor)}** — ${each.join("; ")}`;
}

/** How many requirements the draft may hold: its range, never more than the review limit. */
function idCount(i: DraftingGuideInput): number {
  const n = (id: string) => Number((/(\d+)$/.exec(id) || [])[1]);
  const range = n(i.reqRange[1]) - n(i.reqRange[0]) + 1;
  return Number.isFinite(range) && range > 0
    ? Math.min(range, i.maxRequirements)
    : i.maxRequirements;
}

export function draftingGuide(i: DraftingGuideInput): string {
  const scope = `docs/specs/changes/${i.changeId}/`;
  const actor = i.actors.size > 0 ? capitalise([...i.actors.keys()][0]) : "<Actor>";
  const who =
    i.actors.size > 0
      ? [
          "Each requirement names one actor in its trace, and gets one scenario per",
          "surface that actor uses:",
          "",
          ...[...i.actors].map(([a, s]) => surfaceLine(a, s)),
        ]
      : [
          "The brief names no actors in its front matter, so the checklist cannot ask",
          "for a scenario per screen and API (D3 is skipped). Add them to the brief —",
          "`actors: [{ name: Member, surfaces: [api, web] }]` — and run",
          `\`specgate propose --from-brief ${i.module}\` again.`,
        ];

  return [
    `# Drafting the ${i.module} module`,
    "",
    `Turn **only the ${i.module} module** of the brief into requirements and`,
    "scenarios. Nothing is built yet: this is the specification a person will",
    "review. Specgate checks it against the brief.",
    "",
    ...(i.cards
      ? [`The brief's \`## Module: ${i.module}\` section is your scope: section 0 below.`, ""]
      : []),
    `- **The brief:** \`${i.brief}\` — the only source of business facts.`,
    `- **Write only inside:** \`${scope}\`.`,
    // The range is the limit: "at most 25" next to ten ids read as room for 25 (REQ-194).
    `- **Requirement ids:** \`${i.reqRange[0]}\` … \`${i.reqRange[1]}\`: ${idCount(i)} ids, no others. ` +
      "More are needed? `specgate draft --reserve <n>` grows the range while this is the last draft opened.",
    i.lastScenario
      ? `- **Scenario ids:** \`${i.firstScenario}\` … \`${i.lastScenario}\`, one each, no others.`
      : `- **Scenario ids:** from \`${i.firstScenario}\` up, one each.`,
    "",
    // ADR-0044: the change has three layers, each with its owner.
    "**The layers of this change.** `discover.md` is product's: the business",
    "context, the use case and its acceptance criteria (`- AC-1: …`), in the brief's",
    "words and with no technology. `design.md` is the architect's and `tasks.md` the",
    "developer's: leave them as they are — they are written after the review.",
    "",
    ...cardsPart(i),
    "## 1. The requirements — `specs/" + i.module + "/spec.md`",
    "",
    "Replace the placeholder with one block per requirement:",
    "",
    "```markdown",
    "## ADDED Requirements",
    "",
    `### Requirement: ${i.reqRange[0]} — <a short name>`,
    "",
    i.ucRange
      ? `<!-- specgate:trace actor=${actor} kind=functional uc=${i.ucRange[0]} -->`
      : `<!-- specgate:trace actor=${actor} kind=functional -->`,
    "",
    "The system SHALL <what it does, observably>.",
    "",
    '> Brief: "<the sentence of the brief this comes from>"',
    "",
    `#### Scenario: ${i.firstScenario} — <what happens>`,
    "",
    "- GIVEN <a concrete state>",
    "- WHEN <the actor does one thing>",
    "- THEN <what they get back, with values a test can assert>",
    "```",
    "",
    "- `kind` is `functional`, `business-rule` or `non-functional`. A",
    "  non-functional requirement states a number with a unit.",
    "- Quote the brief under every requirement. If no sentence supports it, it",
    "  does not belong in this draft.",
    '- Concrete values — "the centre court on Monday at 18:00", never "a court".',
    "- Steps are plain `- GIVEN` / `- WHEN` / `- THEN` lines.",
    "",
    ...who,
    "",
    ...(i.ucRange
      ? [
          "## 1b. The use cases — `use-cases.md`",
          "",
          "Group the requirements by what an actor achieves: one use case each, a",
          'name an actor would say ("Create a child profile"), its actor from the',
          "brief, and every requirement that delivers it. Each requirement names its",
          "use case with `uc=` in its trace, and the use case lists it back.",
          "",
          "```markdown",
          "## ADDED Use Cases",
          "",
          "| ID | Use Case | Actor | Requirements |",
          "| --- | --- | --- | --- |",
          `| ${i.ucRange[0]} | <what the actor achieves> | ${actor} | ${i.reqRange[0]} |`,
          "```",
          "",
          `- Ids from ${i.ucRange[0]} to ${i.ucRange[1]}; a use case the catalog`,
          "  (`docs/specs/use-cases.md`) has already goes under `## MODIFIED Use Cases`",
          "  with its row as it becomes, never added again.",
          "- A use case no requirement delivers does not belong here.",
          "",
          "## 1c. Each use case's specification — `use-cases/UC-NNN.md`",
          "",
          "One file per use case you add or modify, its flows naming the scenarios",
          "of the requirements that deliver it — every one of them, so a flow no",
          "test proves shows. Start a step with `[Who]` when someone other than the",
          "first actor does it — the system, a service — and list them all under",
          "Actors: the activity is drawn with a lane for each.",
          "",
          "```markdown",
          `# ${i.ucRange[0]} — <what the actor achieves>`,
          "",
          "## Overview",
          "",
          "<a sentence or two: what and why>",
          "",
          "## Actors",
          "",
          `- ${actor}`,
          "- System",
          "",
          "## Preconditions",
          "",
          "- <what holds before it starts>",
          "",
          `## Main flow (${i.firstScenario})`,
          "",
          "1. <the actor does one thing>",
          "2. [System] <the system answers>",
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
          `- ${i.reqRange[0]}: <the rule, as the requirement says it>`,
          "```",
          "",
        ]
      : []),
    // REQ-639: an entity whose status the brief describes gets its state machine.
    "## 1d. An entity's states — `state-machines/<Entity>.md` (when the brief has them)",
    "",
    "When the brief says what states something goes through — an order paid,",
    "shipped, cancelled; a request received, approved, rejected — write that",
    "entity's machine as a delta. Every transition names the requirement that",
    "asks for it; a transition the brief forbids goes under Forbidden. Skip this",
    "section when the module has no such entity.",
    "",
    "```markdown",
    "# Delta — <Entity>",
    "",
    "## ADDED States",
    "",
    "- <First state> (initial) — entry / <what it does>",
    "- <Next state>",
    "- <Last state> (final)",
    "",
    "## ADDED Transitions",
    "",
    "| From | To | Trigger | Requirement |",
    "|---|---|---|---|",
    `| <First state> | <Next state> | <event> [<guard>] / <action> | ${i.reqRange[0]} |`,
    "",
    "## ADDED Forbidden",
    "",
    `- <Last state> → <First state> (${i.reqRange[0]})`,
    "```",
    "",
    "For a machine that already exists, use MODIFIED and REMOVED sections too;",
    "archive refuses to remove a state a transition still uses.",
    "",
    "## 2. What the brief does not say — `assumptions.md`",
    "",
    "Every value in a scenario that the brief does not give — a limit, a status",
    "code, a button label — gets a row naming where it is used:",
    "",
    "```markdown",
    "| # | Assumption | Used in | Why | Status |",
    "|---|---|---|---|---|",
    `| A1 | HTTP answers: 201 created, 409 taken | ${i.reqRange[0]} | REST convention | to confirm |`,
    "```",
    "",
    "## 3. What only the client can decide — `questions.md`",
    "",
    "Prices, limits, legal, clinical or teaching rules that the brief leaves",
    "open are **questions, not guesses**. Never invent a business rule.",
    "",
    "```markdown",
    "| # | Question | Blocks | Options seen | Answer | Status |",
    "|---|---|---|---|---|---|",
    `| Q1 | <the question, in the client's words> | ${i.reqRange[0]} | <what you could imagine> |  | open |`,
    "```",
    "",
    'A requirement a question blocks carries `status="Needs Clarification"` in',
    "its trace: nobody builds it until someone answers.",
    "",
    "## 4. Check it, until it is ready",
    "",
    "```bash",
    `specgate propose --from-brief ${i.module}`,
    "```",
    "",
    "Fix every finding and run it again, until it says **Ready to review**. A",
    "`D6_unlisted_value` means a value the brief never gave: use the brief's",
    "value, list it in `assumptions.md`, or turn it into a question.",
    "",
    "Do not archive. A person reads the draft and answers what they can in",
    "`questions.md`. Each requirement is then built test first and delivered with",
    `\`specgate apply REQ-NNN\`; once all are applied, a person runs \`specgate archive ${i.changeId}\`.`,
    "",
  ].join("\n");
}

/** What `--agent` sends: the guide, introduced, so any agent can follow it. */
export function draftingPrompt(module: string, changeId: string, guide: string): string {
  return [
    `Draft the ${module} module of this project's brief, following the guide below`,
    `(also saved as docs/specs/changes/${changeId}/DRAFTING.md).`,
    `Anything you write outside docs/specs/changes/${changeId}/ is undone afterwards.`,
    "When you finish, say how many requirements you wrote and list the open questions.",
    // An agent left to explore read Specgate's installed source to learn the
    // checklist and never drafted (opencode, petclinic rehearsal).
    "Everything you need is in this guide and in that folder. Do not read Specgate's own code,",
    "do not install anything, and do not explore the rest of the repository: write the files now.",
    // #106: see briefSetupPrompt.
    `Specgate runs \`specgate propose --from-brief\` itself as soon as you finish and shows the person the result: do not run it, and do not ask for permission to.`,
    "",
    "---",
    "",
    guide,
  ].join("\n");
}
