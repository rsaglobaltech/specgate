/**
 * The getting-started journeys, declared as data.
 *
 * Two journeys, one per answer to the first question a newcomer has — "am I
 * starting from nothing, or bringing code I already have?" — each in five
 * phases, one page per phase under `docs/start/`. Every command a page shows
 * with its output is a step here: `record-journey.ts` runs it for real against
 * this CLI and writes the output into the page, between sentinels, and
 * `docs-journey.test.ts` checks the pages and this list still agree.
 *
 * The same court-bookings brief the landing page records is the from-scratch
 * project, so a reader who watched the demo meets the same product again.
 */

/** One command a journey page shows, with its real output. */
export interface JourneyStep {
  /** Stable id. The page's block is `out-<id>`. */
  readonly id: string;
  /** The page under `docs/` whose block holds the output, without `.md`. */
  readonly page: string;
  /** Relative to the scratch home. */
  readonly cwd: string;
  /** argv, run without a shell. Mutually exclusive with `shell`. */
  readonly argv?: readonly string[];
  /** A command that genuinely needs a shell. Run via `bash -c`. */
  readonly shell?: string;
  /** The `specgate` surface it exercises, as `scripts/lib/surface.ts` spells it; null if not ours. */
  readonly surface: string | null;
  /** Lines kept; beyond this the block says how many were left out. */
  readonly maxLines: number;
  /** The exit status the page describes. Absent means 0. */
  readonly expectExit?: number;
}

export interface Journey {
  readonly id: "scratch" | "existing";
  /** The project folder, under the scratch home. */
  readonly project: string;
  readonly steps: readonly JourneyStep[];
}

const S = "court-bookings";
const sg = (...args: string[]) => ["specgate", ...args];

export const SCRATCH: Journey = {
  id: "scratch",
  project: S,
  steps: [
    // Before phase 1 — writing the brief (start/write-the-brief), on a second
    // project, "Lingo", so the court-bookings journey starts clean.
    {
      id: "brief-new",
      page: "start/write-the-brief",
      cwd: "lingo-new",
      argv: sg("propose", "--from-brief", "--new-brief"),
      surface: "propose",
      maxLines: 18,
    },
    {
      id: "brief-agent",
      page: "start/write-the-brief",
      cwd: "lingo",
      argv: sg("propose", "--from-brief", "--agent", "claude -p"),
      surface: "propose",
      maxLines: 30,
    },
    {
      id: "brief-cards-agent",
      page: "start/write-the-brief",
      cwd: "lingo",
      argv: sg("propose", "--from-brief", "--agent", "claude -p"),
      surface: "propose",
      maxLines: 20,
    },
    {
      id: "brief-check",
      page: "start/write-the-brief",
      cwd: "lingo",
      argv: sg("propose", "--from-brief", "--check"),
      surface: "propose",
      maxLines: 24,
    },
    {
      id: "brief-ready",
      page: "start/write-the-brief",
      cwd: "lingo",
      argv: sg("propose", "--from-brief"),
      surface: "propose",
      maxLines: 16,
    },
    {
      id: "brief-draft",
      page: "start/write-the-brief",
      cwd: "lingo",
      argv: sg("propose", "--from-brief", "courses"),
      surface: "propose",
      maxLines: 12,
    },
    {
      id: "brief-scope",
      page: "start/write-the-brief",
      cwd: "lingo",
      shell: "sed -n '/^## 0/,/^## 1/p' docs/specs/changes/draft-courses/DRAFTING.md | sed '$d'",
      surface: null,
      maxLines: 40,
    },
    // 1 — Install
    {
      id: "scratch-init",
      page: "start/scratch-1-install",
      cwd: S,
      argv: sg("init"),
      surface: "init",
      maxLines: 28,
    },
    {
      id: "scratch-test-cmd",
      page: "start/scratch-1-install",
      cwd: S,
      argv: sg("config", "set", "test_cmd", "node --test"),
      surface: "config set",
      maxLines: 6,
    },
    {
      id: "scratch-check",
      page: "start/scratch-1-install",
      cwd: S,
      argv: sg("check"),
      surface: "check",
      maxLines: 26,
    },
    // 2 — Specify
    {
      id: "scratch-draft-list",
      page: "start/scratch-2-specify",
      cwd: S,
      argv: sg("propose", "--from-brief"),
      surface: "propose",
      maxLines: 12,
    },
    {
      id: "scratch-draft-open",
      page: "start/scratch-2-specify",
      cwd: S,
      argv: sg("propose", "--from-brief", "bookings"),
      surface: "propose",
      maxLines: 16,
    },
    {
      id: "scratch-draft-check",
      page: "start/scratch-2-specify",
      cwd: S,
      argv: sg("propose", "--from-brief", "bookings"),
      surface: "propose",
      maxLines: 26,
      expectExit: 1,
    },
    {
      id: "scratch-draft-check-again",
      page: "start/scratch-2-specify",
      cwd: S,
      argv: sg("propose", "--from-brief", "bookings"),
      surface: "propose",
      maxLines: 12,
    },
    {
      id: "scratch-status",
      page: "start/scratch-2-specify",
      cwd: S,
      argv: sg("status"),
      surface: "status",
      maxLines: 20,
    },
    // 3 — Build
    {
      id: "scratch-node-test",
      page: "start/scratch-3-build",
      cwd: S,
      argv: ["node", "--test"],
      surface: null,
      maxLines: 14,
    },
    {
      id: "scratch-harness-prompt",
      page: "start/scratch-3-build",
      cwd: S,
      argv: sg("harness", "prompt", "REQ-003"),
      surface: "harness prompt",
      maxLines: 20,
    },
    // 4 — Prove
    {
      id: "scratch-apply",
      page: "start/scratch-4-prove",
      cwd: S,
      argv: sg("apply", "REQ-002"),
      surface: "apply",
      maxLines: 14,
    },
    {
      id: "scratch-apply-blocked",
      page: "start/scratch-4-prove",
      cwd: S,
      argv: sg("apply", "REQ-004"),
      surface: "apply",
      maxLines: 14,
      expectExit: 1,
    },
    // A draft is archived after its requirements are applied (ADR-0035):
    // with REQ-004 waiting for the client, archive says what is left.
    {
      id: "scratch-archive",
      page: "start/scratch-4-prove",
      cwd: S,
      argv: sg("archive", "draft-bookings"),
      surface: "archive",
      maxLines: 8,
      expectExit: 1,
    },
    {
      id: "scratch-check-green",
      page: "start/scratch-4-prove",
      cwd: S,
      argv: sg("check"),
      surface: "check",
      maxLines: 22,
    },
    {
      id: "scratch-report",
      page: "start/scratch-4-prove",
      cwd: S,
      argv: sg("report", "--out", "report.html"),
      surface: "report",
      maxLines: 6,
    },
    // 5 — Every day
    {
      id: "scratch-ci",
      page: "start/scratch-5-every-day",
      cwd: S,
      argv: sg("ci", "init", "--provider", "github"),
      surface: "ci init",
      maxLines: 12,
    },
    {
      id: "scratch-propose",
      page: "start/scratch-5-every-day",
      cwd: S,
      argv: sg("propose", "free-courts"),
      surface: "propose",
      maxLines: 14,
    },
    {
      id: "scratch-status-daily",
      page: "start/scratch-5-every-day",
      cwd: S,
      argv: sg("status"),
      surface: "status",
      maxLines: 20,
    },
  ],
};

const E = "invoicing";

export const EXISTING: Journey = {
  id: "existing",
  project: E,
  steps: [
    // 1 — Adopt
    {
      id: "existing-onboard",
      page: "start/existing-1-adopt",
      cwd: E,
      argv: sg("onboard"),
      surface: "onboard",
      maxLines: 30,
    },
    {
      id: "existing-init",
      page: "start/existing-1-adopt",
      cwd: E,
      argv: sg("init"),
      surface: "init",
      maxLines: 28,
    },
    {
      id: "existing-test-cmd",
      page: "start/existing-1-adopt",
      cwd: E,
      argv: sg("config", "set", "test_cmd", "node --test"),
      surface: "config set",
      maxLines: 6,
    },
    {
      id: "existing-check",
      page: "start/existing-1-adopt",
      cwd: E,
      argv: sg("check"),
      surface: "check",
      maxLines: 30,
    },
    // 2 — Specify what you rely on
    {
      id: "existing-status",
      page: "start/existing-2-specify",
      cwd: E,
      argv: sg("status"),
      surface: "status",
      maxLines: 20,
    },
    {
      id: "existing-propose",
      page: "start/existing-2-specify",
      cwd: E,
      argv: sg("propose", "invoice-rounding"),
      surface: "propose",
      maxLines: 14,
    },
    {
      id: "existing-delta",
      page: "start/existing-2-specify",
      cwd: E,
      shell: "cat docs/specs/changes/invoice-rounding/specs/invoice-rounding/spec.md",
      surface: null,
      maxLines: 16,
    },
    {
      id: "existing-status-change",
      page: "start/existing-2-specify",
      cwd: E,
      argv: sg("status"),
      surface: "status",
      maxLines: 20,
    },
    // 3 — Close the first
    {
      id: "existing-apply-refused",
      page: "start/existing-3-first-requirement",
      cwd: E,
      argv: sg("apply", "REQ-004"),
      surface: "apply",
      maxLines: 14,
      expectExit: 1,
    },
    {
      id: "existing-test",
      page: "start/existing-3-first-requirement",
      cwd: E,
      shell: "cat test/total.test.js",
      surface: null,
      maxLines: 20,
    },
    {
      id: "existing-apply",
      page: "start/existing-3-first-requirement",
      cwd: E,
      argv: sg("apply", "REQ-004"),
      surface: "apply",
      maxLines: 14,
    },
    // A change is archived once every requirement it adds is applied (ADR-0035).
    {
      id: "existing-archive",
      page: "start/existing-3-first-requirement",
      cwd: E,
      argv: sg("archive", "invoice-rounding"),
      surface: "archive",
      maxLines: 14,
    },
    // 4 — The gate in CI
    {
      id: "existing-ci",
      page: "start/existing-4-ci",
      cwd: E,
      argv: sg("ci", "init", "--provider", "github"),
      surface: "ci init",
      maxLines: 12,
    },
    {
      id: "existing-check-green",
      page: "start/existing-4-ci",
      cwd: E,
      argv: sg("check"),
      surface: "check",
      maxLines: 22,
    },
    // 5 — Every day
    {
      id: "existing-status-daily",
      page: "start/existing-5-every-day",
      cwd: E,
      argv: sg("status"),
      surface: "status",
      maxLines: 20,
    },
  ],
};

export const JOURNEYS: readonly Journey[] = [SCRATCH, EXISTING];

/** The block a step's output lives in. */
export function blockName(step: JourneyStep): string {
  return `out-${step.id}`;
}

/** The command as the page shows it. */
export function displayCommand(step: JourneyStep): string {
  if (step.shell) return step.shell;
  return (step.argv || []).map((a) => (/[ '"$]/.test(a) ? `"${a}"` : a)).join(" ");
}
