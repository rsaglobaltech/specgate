/**
 * The steps of the spec-driven loop, defined once.
 *
 * Every agent tool gets the same steps; only the file format differs. Writing
 * them per tool would guarantee that Cursor and Claude drift apart the first
 * time one is edited — which is the same failure this repository has been
 * fixing everywhere else.
 *
 * Each step delegates its context to `specgate change instructions`, so the rules
 * an agent follows come from the engine rather than from a copy frozen into a
 * markdown file at generation time.
 */

/** One step of the loop, as every agent tool renders it. */
export interface AgentStep {
  name: string;
  summary: string;
  when: string;
  /** The commands the step runs, in order. */
  run: string[];
  guidance: string[];
  /** The placeholder in `run` the host fills from the slash command's argument. */
  argumentHint?: string;
}

export const STEPS: AgentStep[] = [
  {
    name: "explore",
    summary: "See what is left, and the one command to run next.",
    when: "Starting work, or unsure what to do next.",
    run: ["specgate status --json"],
    guidance: [
      "Read `spec.md` and `AGENTS.md` first — `AGENTS.md` is binding, not advisory.",
      "`requirements` lists each one with what it still needs; `nextCommand` names the step.",
      "Do not start on a requirement until you can say which `REQ-NNN` it is.",
    ],
  },
  {
    // The brief-first path (#93, #94): most projects start from a plan, and
    // turning it into a draft took four commands and a prompt the user wrote.
    name: "draft",
    summary: "Turn the plan or brief into requirements, one module at a time.",
    when: "The project starts from a plan or brief (`docs/brief.md`), or the user names a module of it to specify.",
    argumentHint: "<module>",
    run: ["specgate draft", "specgate draft <module>"],
    guidance: [
      "No `docs/brief.md`: show the person what `specgate draft` prints about a brief, and stop — the brief is theirs to write (`specgate draft --new-brief` gives them one to fill in).",
      "If `specgate draft` says the brief has no front matter, or that it needs fixes: follow `docs/specs/BRIEF-SETUP.md`. Write or fix only the front matter at the top of `docs/brief.md` — never a word below it — run `specgate draft` again, then **stop** and show the front matter to the person to review. Draft no module in the same turn.",
      "Without a module, `specgate draft` lists the brief's modules and names the next one. Draft that one.",
      "`specgate draft <module>` opens the draft and writes `DRAFTING.md` inside it. Follow it exactly: it has the reserved ids, the actors and surfaces, and every format the checklist reads.",
      "Write only inside `docs/specs/changes/draft-<module>/`. Then run `specgate draft <module>` again and fix every finding until it says **Ready to review**.",
      "A `D6_unlisted_value` is a value the brief never gave: use the brief's value, list it in `assumptions.md`, or make it a question. Never invent a business rule — what only the client can decide goes in `questions.md`.",
      "Do not archive. End with the open questions for the person: they review the draft and answer what they can. Then each requirement is built test first and delivered with `specgate apply REQ-NNN`; a person runs `specgate archive draft-<module>` once all of them are applied.",
    ],
  },
  {
    // ADR-0035: the daily loop is propose → test → apply → archive. A change
    // is archived after its requirements are applied, never before.
    name: "propose",
    summary: "Open a change: the requirements to add or modify, as a reviewable delta.",
    when: "The user asks for a behaviour no requirement covers, or for a change to one that shipped.",
    run: [
      "specgate propose <change-id>",
      "specgate change instructions proposal --json",
      "specgate change instructions specs --json",
    ],
    guidance: [
      "`change instructions` returns the template, the rules the validator enforces, and the project's declared stack. Follow it rather than guessing the format.",
      "A delta states only what changes. It is not a copy of the spec. Until it is archived, its requirements are in flight: `status`, `check` and `apply` read them from the delta.",
      "Every requirement body needs SHALL / MUST / SHOULD / MAY, and every scenario needs plain `- GIVEN` / `- WHEN` / `- THEN` bullets.",
      "Do not archive yet. Next: a test for each requirement, then `/specgate:apply`.",
    ],
  },
  {
    name: "new",
    summary: "Add one requirement straight to `spec.md`: its prose, its scenario and its row.",
    when: "A small project without changes, or the user asks for a single requirement outside a change.",
    run: ['specgate new "<what the system must do>" --json'],
    guidance: [
      "It writes a draft `## REQ-NNN` section in `spec.md` and a scenario of `<placeholder>` steps under `features/`.",
      "Rewrite the obligation and the placeholders with the user before implementing — they are questions, not answers. The gate refuses them on delivery.",
      "Do not edit the matrix: it is generated.",
    ],
  },
  {
    name: "apply",
    summary: "Deliver one requirement: the test first, then the code, then the gate.",
    when: "A requirement — in `spec.md` or in an open change — has a real scenario and no implementation yet.",
    run: [
      "specgate status --json",
      "specgate change instructions apply --json",
      "specgate apply <REQ-NNN> --json",
    ],
    guidance: [
      "One requirement at a time — `status` is the queue.",
      "Write the test first and **name the requirement in it** (`REQ-007` in a comment or the test name). That mention is the link: no `req link`, no matrix edit.",
      "Mention the requirement in the code that implements it too, so its row points at the code.",
      "Never change `spec.md`, a delta or a `.feature` to make a test pass.",
      "`specgate apply` refuses a requirement no test names and runs the gate; a refusal changes nothing. Green, it records Implemented.",
    ],
  },
  {
    // Was `verify` until 0.15, when `specgate verify` became the OpenSpec
    // check (ADR-0030); the slash command takes the name of what it runs.
    // `specgate update` moves files generated under the old name.
    name: "check",
    summary: "Run the gate: specs, links, coverage and the project's tests.",
    when: "After every change, and before saying the work is done.",
    run: ["specgate check --json"],
    guidance: [
      "Every diagnostic carries a `fix`. Apply it rather than guessing.",
      "Branch on `code`, never on `message` — the message is prose and may be reworded.",
      "`tests_not_configured` means nothing executed the suite: say so, do not report success.",
    ],
  },
  {
    name: "archive",
    summary: "Merge a change into the spec tree once every requirement in it is applied.",
    when: "Every requirement the change adds or modifies is Implemented, and the person reviewing it says merge.",
    run: [
      "specgate change instructions archive --json",
      "specgate archive <change-id> --dry-run",
      "specgate archive <change-id> --json",
    ],
    guidance: [
      "A person runs archive: review is the change's pull request. Never archive a change you have not been told to.",
      "Archive refuses while a requirement of the change is not applied; the fix it prints names the `specgate apply` to run.",
      "Preview with `--dry-run` first: it lists the specs that will move.",
      "Archiving writes the specs and materialises the feature files; the matrix follows on its own.",
    ],
  },
  {
    // `done` is `apply`'s old name (ADR-0035). Kept so commands installed by
    // 0.20 and the scripts that call them still work.
    name: "done",
    summary: "Old name of `/specgate:apply`: deliver one requirement through the gate.",
    when: "Only when a script or a person asks for `done` — otherwise use `/specgate:apply`.",
    run: ["specgate apply <REQ-NNN> --json"],
    guidance: [
      "Same command as `/specgate:apply`: the test first, named after the requirement, then `specgate apply`.",
      "The status is written into `spec.md` or the open change; the matrix is regenerated from it.",
    ],
  },
  {
    name: "onboard",
    summary: "Install spec-driven development on a repository that lacks it.",
    when: "The repository has code but no `spec.md`.",
    run: ["specgate init", "specgate check --json"],
    guidance: [
      "`specgate init` adopts a repository that has code: it never overwrites a file and never touches source.",
      "Then propose real requirements with `specgate propose <change-id>`, starting with what the team is changing now.",
    ],
  },
];

/** The rules every tool's instruction file repeats, in its own format. */
export const PROJECT_RULES = [
  "`spec.md`, `AGENTS.md` and `features/**/*.feature` are the source of truth. Do not edit them to make a test pass.",
  "`docs/specs/traceability.md` is generated — never edit it. A test or source file that names `REQ-NNN` is linked to that requirement; that is how work is traced.",
  "Every command takes `--json`. Use it: one document on stdout, diagnostics in `status`, each with a `fix`.",
  "Exit codes are a contract: 0 success, 1 failure or gate finding, 2 usage error.",
  "When you do not know the format of an artefact, run `specgate change instructions <artifact> --json` instead of guessing.",
];
