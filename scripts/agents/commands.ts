/**
 * The six steps of the spec-driven loop, defined once.
 *
 * Every agent tool gets the same six; only the file format differs. Writing
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
    summary: "Understand the project before proposing anything.",
    when: "Starting work on an unfamiliar spec-driven repository.",
    run: ["specgate status --json", "specgate plan --json"],
    guidance: [
      "Read `spec.md` and `AI_RULES.md` first — `AI_RULES.md` is binding, not advisory.",
      "`specgate status` gives totals, orphan features and locked pack versions in one document.",
      "Do not propose a change until you can name which capability it belongs to.",
    ],
  },
  {
    name: "propose",
    summary: "Open a change and write its proposal and delta.",
    when: "A requirement needs adding, rewording or retiring.",
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
    name: "verify",
    summary: "Check the change before anyone reviews it.",
    when: "After writing or editing any artefact of a change.",
    run: ["specgate change validate --json", "specgate validate . --json"],
    guidance: [
      "Every diagnostic carries a `fix`. Apply it rather than guessing.",
      "Branch on `code`, never on `message` — the message is prose and may be reworded.",
      "`specgate validate` validates active changes too, so this is also the PR gate.",
    ],
  },
  {
    name: "apply",
    summary: "Implement the change: tests first, then code.",
    when: "The change is validated and its proposal is agreed.",
    run: ["specgate change instructions apply --json", "specgate plan --json"],
    guidance: [
      "One requirement at a time. `specgate plan` is the queue.",
      "Write the test first. Set the row's status to `In Dev` only once it exists, or `validate --strict` fails with `[TDD-1]`.",
      "Never edit `docs/specs/traceability.md` by hand — `specgate req link` and `specgate done` write it.",
    ],
  },
  {
    name: "archive",
    summary: "Merge the change into the spec tree.",
    when: "The work is done and every task is checked.",
    run: [
      "specgate change instructions archive --json",
      "specgate change archive <change-id> --dry-run",
      "specgate change archive <change-id> --json",
    ],
    guidance: [
      "Preview with `--dry-run` first: it lists the specs and matrix rows that will move.",
      "Archiving inserts the traceability rows and materialises the feature files. It is not a file move.",
      "After archiving, `specgate plan` lists the requirement as pending work.",
    ],
  },
  {
    name: "onboard",
    summary: "Install spec-driven development on a repository that lacks it.",
    when: "The repository has code but no `spec.md`.",
    run: ["specgate adopt", "specgate doctor --json", "specgate validate . --json"],
    guidance: [
      "`specgate adopt` never overwrites a file and never touches source code.",
      "Retro-fill real requirements one at a time; a baseline REQ-001 anchors the matrix until then.",
      "`specgate doctor` reports a concrete fix per finding — work through them before adding the CI gate.",
    ],
  },
];

/** The rules every tool's instruction file repeats, in its own format. */
export const PROJECT_RULES = [
  "`spec.md`, `AI_RULES.md` and `features/**/*.feature` are the source of truth. Do not edit them to make a test pass.",
  "`docs/specs/traceability.md` is written by `specgate req`, `specgate done` and `specgate change archive` — never by hand.",
  "Every command takes `--json`. Use it: one document on stdout, diagnostics in `status`, each with a `fix`.",
  "Exit codes are a contract: 0 success, 1 failure or gate finding, 2 usage error.",
  "When you do not know the format of an artefact, run `specgate change instructions <artifact> --json` instead of guessing.",
];
