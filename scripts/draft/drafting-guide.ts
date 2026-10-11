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
  maxRequirements: number;
  /** actor → surfaces, from the brief's front matter. */
  actors: Map<string, string[]>;
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
          `\`specgate draft ${i.module}\` again.`,
        ];

  return [
    `# Drafting the ${i.module} module`,
    "",
    `Turn **only the ${i.module} module** of the brief into requirements and`,
    "scenarios. Nothing is built yet: this is the specification a person will",
    "review. Specgate checks it against the brief.",
    "",
    `- **The brief:** \`${i.brief}\` — the only source of business facts.`,
    `- **Write only inside:** \`${scope}\`.`,
    `- **Requirement ids:** \`${i.reqRange[0]}\` … \`${i.reqRange[1]}\`, no others — at most ${i.maxRequirements} requirements.`,
    `- **Scenario ids:** from \`${i.firstScenario}\` up, one each.`,
    "",
    "## 1. The requirements — `specs/" + i.module + "/spec.md`",
    "",
    "Replace the placeholder with one block per requirement:",
    "",
    "```markdown",
    "## ADDED Requirements",
    "",
    `### Requirement: ${i.reqRange[0]} — <a short name>`,
    "",
    `<!-- csda:trace actor=${actor} kind=functional -->`,
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
    "| # | Question | Blocks | Options seen |",
    "|---|---|---|---|",
    `| Q1 | <the question, in the client's words> | ${i.reqRange[0]} | <what you could imagine> |`,
    "```",
    "",
    'A requirement a question blocks carries `status="Needs Clarification"` in',
    "its trace: nobody builds it until someone answers.",
    "",
    "## 4. Check it, until it is ready",
    "",
    "```bash",
    `specgate draft ${i.module}`,
    "```",
    "",
    "Fix every finding and run it again, until it says **Ready to review**. A",
    "`D6_unlisted_value` means a value the brief never gave: use the brief's",
    "value, list it in `assumptions.md`, or turn it into a question.",
    "",
    "Do not archive. A person reads the draft, answers what they can in",
    `\`questions.md\`, and then runs \`specgate change archive ${i.changeId}\`.`,
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
    "",
    "---",
    "",
    guide,
  ].join("\n");
}
