/**
 * What the landing page's terminals show, declared as data.
 *
 * Three recordings, one per question a visitor brings — "what happens to my
 * client's brief?", "what stops a bad change?", "what if an agent does the
 * work?" — shown as tabs over one player. Each is captured from the real CLI
 * by `record-terminal.ts` and checked by `docs-terminal.test.ts`.
 *
 * Read by two things that must not disagree: `record-terminal.ts`, which runs
 * these commands for real and writes the recording, and `docs-terminal.test.ts`,
 * which checks the recording is still of this storyboard and of this CLI.
 *
 * ## Why these nine
 *
 * `scripts/demo/demo.tape` tells the same story in ten beats for a video. A
 * landing page is not a video: it is read beside prose, by someone deciding
 * whether to spend an afternoon on this. So the beats that survive are the ones
 * that answer a question an evaluator actually has —
 *
 *   - how much do I have to write?          `cat smart-parking.yaml`
 *   - what do I get?                        `init`, `specops add`
 *   - what does it think is left to do?     `plan`
 *   - does it lock me to one AI vendor?     `cat harness.config.yaml`
 *   - what happens when I let it run?       `harness run`
 *   - did it touch my specs?                `git diff --stat`
 *   - is the code real?                     `node --test`
 *   - and is the chain still intact?        `validate`
 *
 * — and the beats that only look good in motion are gone.
 *
 * Every one of these was run against the real CLI before being written down.
 * The last beat is `validate` because the page's "The loop" section promises
 * exactly that, and ending there closes the loop the reader just read about.
 */

/** One command in the recording. */
export interface Beat {
  /** Stable id. The recording and this list are compared by it. */
  readonly id: string;
  /** The sentence shown beside the step. Human, not a restatement of the command. */
  readonly caption: string;
  /** Relative to the scratch home: `""` is `~`, `smart-parking` is `~/smart-parking`. */
  readonly cwd: string;
  /** argv, run without a shell. Mutually exclusive with `shell`. */
  readonly argv?: readonly string[];
  /** A command that genuinely needs a shell — a pipe, a `&&`. Run via `bash -c`. */
  readonly shell?: string;
  /**
   * The `specgate` surface this beat exercises, spelled as `scripts/lib/surface.ts`
   * spells it, or `null` for a command that is not ours. This is what lets the
   * test check the recording against the CLI without running anything.
   */
  readonly surface: string | null;
  /** Lines kept. Beyond this the player shows "… N more lines". */
  readonly maxLines: number;
  /**
   * The exit status this beat is recorded for. Absent means 0. A demo of a
   * gate has to show it refusing, so a refusal is declared here — and the test
   * fails if a beat exits with anything else, in either direction.
   */
  readonly expectExit?: number;
}

/** One recording: a tab on the landing page and a JSON file beside it. */
export interface Storyboard {
  /** `brief`, `gate`, `harness`. Also the tab's id. */
  readonly id: string;
  /** The tab's label. */
  readonly label: string;
  /** The terminal's title strip. */
  readonly title: string;
  /** Under `docs/assets/`. */
  readonly file: string;
  /** The `csda:<block>` sentinel in `docs/index.html` holding the fallback. */
  readonly block: string;
  readonly beats: readonly Beat[];
}

/** The agent harness — the original recording, kept under its original names. */
export const BEATS: readonly Beat[] = [
  {
    id: "config",
    caption: "Everything you have to write by hand. Seven lines.",
    cwd: "",
    argv: ["cat", "smart-parking.yaml"],
    surface: null,
    maxLines: 10,
  },
  {
    id: "init",
    caption: "Requirements, Gherkin, a traceability matrix and the rules for agents.",
    cwd: "",
    argv: ["specgate", "init", "--config", "./smart-parking.yaml", "--out", ".", "--no-git"],
    surface: "init",
    maxLines: 14,
  },
  {
    id: "specops-add",
    caption: "A domain pack, installed and pinned. Not copy-pasted.",
    cwd: "smart-parking",
    argv: [
      "specgate",
      "specops",
      "add",
      "--pack-root",
      "{HOME}/packs",
      "--pack",
      "multi-tenant/backend",
      "--var",
      "PROJECT_NAME=Smart Parking",
      "--var",
      "PROJECT_SLUG=smart-parking",
      "--var",
      "DOMAIN=parking operations",
    ],
    surface: "specops add",
    maxLines: 8,
  },
  {
    id: "plan",
    caption: "The queue, derived from the matrix. Nobody maintains this by hand.",
    cwd: "smart-parking",
    argv: ["specgate", "plan"],
    surface: "plan",
    maxLines: 15,
  },
  {
    id: "harness-config",
    caption: "Any CLI that takes a prompt. The tool never talks to a model itself.",
    cwd: "smart-parking",
    argv: ["cat", "harness.config.yaml"],
    surface: null,
    maxLines: 6,
  },
  {
    id: "harness-run",
    caption: "One requirement, one worktree, one agent — and a gate that can say no.",
    cwd: "smart-parking",
    argv: ["specgate", "harness", "run", "--req", "REQ-000"],
    surface: "harness run",
    maxLines: 14,
  },
  {
    id: "diff",
    caption: "What the agent touched. The feature files are not on this list.",
    cwd: "smart-parking",
    argv: ["git", "diff", "--stat", "main", "harness/REQ-000"],
    surface: null,
    maxLines: 8,
  },
  {
    id: "tests",
    caption: "Its own test, on its own branch. Nothing was merged for you.",
    cwd: "smart-parking",
    shell: "git switch -q harness/REQ-000 && node --test test/*.test.js",
    surface: null,
    maxLines: 12,
  },
  {
    id: "validate",
    caption: "And the chain still holds. This is the command CI runs.",
    cwd: "smart-parking",
    argv: ["specgate", "validate", "."],
    surface: "validate",
    maxLines: 8,
  },
];

/**
 * From a client's brief to a specification.
 *
 * The beat that matters is the first `draft --check`: the agent wrote a
 * plausible draft and invented a fee the brief never states. The checklist
 * finds it, the fee becomes a question for the client, and the requirement it
 * blocks arrives as "waiting for an answer" instead of as code.
 */
export const BRIEF_BEATS: readonly Beat[] = [
  {
    id: "brief",
    caption: "The client's brief, as it arrived. Four sentences.",
    cwd: "courts",
    argv: ["cat", "docs/brief.md"],
    surface: null,
    maxLines: 14,
  },
  {
    id: "check-draft",
    caption: "An agent drafted three requirements. The checklist finds every value nobody gave it.",
    cwd: "courts",
    argv: ["specgate", "draft", "--check", "draft-bookings"],
    surface: "draft",
    maxLines: 16,
    expectExit: 1,
  },
  {
    id: "the-fix",
    caption: "The invented fee is gone from the draft. It becomes a question.",
    cwd: "courts",
    shell:
      "git diff -U0 docs/specs/changes/draft-bookings/specs | grep -E '^[-+]' | grep -vE '^(---|[+]{3}) '",
    surface: null,
    maxLines: 10,
  },
  {
    id: "questions",
    caption: "What only the client can answer — and the requirement each question blocks.",
    cwd: "courts",
    argv: ["cat", "docs/specs/changes/draft-bookings/questions.md"],
    surface: null,
    maxLines: 8,
  },
  {
    id: "check-again",
    caption: "Every value is now in the brief or written down as an assumption.",
    cwd: "courts",
    argv: ["specgate", "draft", "--check", "draft-bookings"],
    surface: "draft",
    maxLines: 8,
  },
  {
    id: "archive",
    caption: "Requirements, Gherkin and the traceability matrix, written in one step.",
    cwd: "courts",
    argv: ["specgate", "change", "archive", "draft-bookings"],
    surface: "change archive",
    maxLines: 10,
  },
  {
    id: "status",
    caption: "The blocked requirement waits for the client. Nobody builds it by mistake.",
    cwd: "courts",
    argv: ["specgate", "status"],
    surface: "status",
    maxLines: 16,
  },
];

/**
 * The gate refusing, then accepting.
 *
 * Starts where the brief recording ends. Two refusals are the point: work
 * with no test behind it, and a requirement still waiting for the client.
 */
export const GATE_BEATS: readonly Beat[] = [
  {
    id: "done-no-test",
    caption: "Calling it done before a test exists. The gate says no and writes nothing.",
    cwd: "courts",
    argv: ["specgate", "done", "REQ-002"],
    surface: "done",
    maxLines: 8,
    expectExit: 1,
  },
  {
    id: "the-test",
    caption: "A test that names the requirement. That mention is the whole link.",
    cwd: "courts",
    argv: ["cat", "test/bookings.test.js"],
    surface: null,
    maxLines: 14,
  },
  {
    id: "done",
    caption: "Now the scenario, the test and the suite all pass — and only then is it marked.",
    cwd: "courts",
    argv: ["specgate", "done", "REQ-002"],
    surface: "done",
    maxLines: 6,
  },
  {
    id: "done-blocked",
    caption:
      "The requirement waiting for the client cannot be closed — not by you, not by an agent.",
    cwd: "courts",
    argv: ["specgate", "done", "REQ-004"],
    surface: "done",
    maxLines: 6,
    expectExit: 1,
  },
  {
    id: "check",
    caption: "What CI runs on every pull request: the whole chain, then your tests.",
    cwd: "courts",
    argv: ["specgate", "check"],
    surface: "check",
    maxLines: 22,
  },
];

export const STORYBOARDS: readonly Storyboard[] = [
  {
    id: "brief",
    label: "From a brief",
    title: "courts — draft from a brief",
    file: "terminal-brief.json",
    block: "terminal-brief",
    beats: BRIEF_BEATS,
  },
  {
    id: "gate",
    label: "The gate says no",
    title: "courts — the gate",
    file: "terminal-gate.json",
    block: "terminal-gate",
    beats: GATE_BEATS,
  },
  {
    id: "harness",
    label: "Hand it to an agent",
    title: "smart-parking",
    file: "terminal-demo.json",
    block: "terminal",
    beats: BEATS,
  },
];
