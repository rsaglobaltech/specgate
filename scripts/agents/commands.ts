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

export const STEPS = [
  {
    name: "explore",
    summary: "See what is left, and the one command to run next.",
    when: "Starting work, or unsure what to do next.",
    run: ["specgate status --json"],
    guidance: [
      "Read `spec.md` and `AI_RULES.md` first — `AI_RULES.md` is binding, not advisory.",
      "`requirements` lists each one with what it still needs; `nextCommand` names the step.",
      "Do not start on a requirement until you can say which `REQ-NNN` it is.",
    ],
  },
  {
    name: "new",
    summary: "Add a requirement: its prose, its scenario and its row, in one step.",
    when: "The user asks for a behaviour that no requirement covers yet.",
    run: ['specgate new "<what the system must do>" --json'],
    guidance: [
      "It writes a draft `## REQ-NNN` section in `spec.md` and a scenario of `<placeholder>` steps under `features/`.",
      "Rewrite the obligation and the placeholders with the user before implementing — they are questions, not answers. The gate refuses them on delivery.",
      "Do not edit the matrix: it is generated.",
    ],
  },
  {
    name: "apply",
    summary: "Implement one requirement: the test first, then the code.",
    when: "A requirement has a real scenario and no implementation yet.",
    run: ["specgate status --json", "specgate change instructions apply --json"],
    guidance: [
      "One requirement at a time — `status` is the queue.",
      "Write the test first and **name the requirement in it** (`REQ-007` in a comment or the test name). That mention is the link: no `req link`, no matrix edit.",
      "Mention the requirement in the code that implements it too, so its row points at the code.",
      "Never change `spec.md` or a `.feature` to make a test pass.",
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
    name: "done",
    summary: "Close a requirement through the gate.",
    when: "Its scenario is real, its test names it and `check` is green.",
    run: ["specgate done <REQ-NNN> --strict --json"],
    guidance: [
      "`--strict` runs the whole gate for this requirement before recording anything; a refusal changes nothing.",
      "The status is written into `spec.md`; the matrix is regenerated from it.",
    ],
  },
  {
    name: "propose",
    summary: "Change a requirement that already shipped, as a reviewable delta.",
    when: "Rewording, extending or retiring something delivered — not for new work, use `new`.",
    run: [
      "specgate change new <change-id>",
      "specgate change instructions proposal --json",
      "specgate change instructions specs --json",
    ],
    guidance: [
      "`change instructions` returns the template, the rules the validator enforces, and the project's declared stack. Follow it rather than guessing the format.",
      "A delta states only what changes. It is not a copy of the spec.",
      "Every requirement body needs SHALL / MUST / SHOULD / MAY, and every scenario needs plain `- GIVEN` / `- WHEN` / `- THEN` bullets.",
    ],
  },
  {
    name: "archive",
    summary: "Merge an accepted change into the spec tree.",
    when: "The change is implemented and every task is checked.",
    run: [
      "specgate change instructions archive --json",
      "specgate change archive <change-id> --dry-run",
      "specgate change archive <change-id> --json",
    ],
    guidance: [
      "Preview with `--dry-run` first: it lists the specs that will move.",
      "Archiving writes the specs and materialises the feature files; the matrix follows on its own.",
    ],
  },
  {
    name: "onboard",
    summary: "Install spec-driven development on a repository that lacks it.",
    when: "The repository has code but no `spec.md`.",
    run: ["specgate init", "specgate check --json"],
    guidance: [
      "`specgate init` adopts a repository that has code: it never overwrites a file and never touches source.",
      "Then add real requirements one at a time with `specgate new`, starting with what the team is changing now.",
    ],
  },
];

/** The rules every tool's instruction file repeats, in its own format. */
export const PROJECT_RULES = [
  "`spec.md`, `AI_RULES.md` and `features/**/*.feature` are the source of truth. Do not edit them to make a test pass.",
  "`docs/specs/traceability.md` is generated — never edit it. A test or source file that names `REQ-NNN` is linked to that requirement; that is how work is traced.",
  "Every command takes `--json`. Use it: one document on stdout, diagnostics in `status`, each with a `fix`.",
  "Exit codes are a contract: 0 success, 1 failure or gate finding, 2 usage error.",
  "When you do not know the format of an artefact, run `specgate change instructions <artifact> --json` instead of guessing.",
];
