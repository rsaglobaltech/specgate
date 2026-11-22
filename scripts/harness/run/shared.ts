/**
 * `harness run`: what the command and its gate, workers and chain share — the
 * types a run passes around, the progress lines, git, and the scripts it runs.
 */

import * as ui from "../../lib/ui";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPrompt } from "../prompt";
import { inFlightView } from "../../lib/in-flight";
import { type CheckOutcome } from "../../lib/quality-run";
import { maskCommand, secretValues } from "../../../packages/core/src/domain/HarnessEvents";
import { HarnessSettings } from "../../../packages/core/src/infrastructure/HarnessConfigFile";
import { ProbeOutcome } from "../../../packages/core/src/domain/AdversarialProbe";
import { AttemptRecord } from "../../../packages/core/src/domain/HarnessRun";

/**
 * REQ-582: text that leaves the run — the run record, the prompt archive that
 * is committed and pushed — with token-like values and the values of secret
 * environment variables replaced by "***".
 */
export function scrubText(
  text: string,
  env: Record<string, string | undefined> = process.env
): string {
  return secretValues(env).reduce((out, v) => out.split(v).join("***"), maskCommand(text));
}

/**
 * `read` against the project as it will be after its open changes are
 * archived (ADR-0035), so the harness sees, prompts for and gates a change's
 * requirements while they are in flight. The project itself when none is open.
 */
export function judged<T>(
  dir: string,
  read: (judgedDir: string, toProject: (text: string) => string) => T
): T {
  const view = inFlightView(dir);
  try {
    return read(view ? view.dir : dir, view ? view.toProject : (text) => text);
  } finally {
    if (view) view.cleanup();
  }
}

/**
 * A prompt built from the project as the harness judges it (REQ-268).
 *
 * The implementer's prompt was; the reviewer's and the adversary's read the
 * worktree as written, where a reviewed draft's requirement has no text, and
 * the reviewer was told to stop and report that REQ-002 did not exist
 * (truck-flote, S53).
 */
export function promptInFlight(
  req: Record<string, unknown>,
  dir: string,
  opts: Parameters<typeof buildPrompt>[2] = {}
): string {
  return judged(dir, (judgedDir) => buildPrompt(req, judgedDir, opts));
}

/**
 * One requirement as `plan --format json` hands it to the harness.
 *
 * Both spellings of a field are declared because both arrive: `plan` writes
 * camelCase, while the matrix rows and older callers carry snake_case, and the
 * harness reads whichever is present. The index signature keeps it a plain
 * record, which is what `buildPrompt` takes.
 */
export interface HarnessRequirement {
  requirement: string;
  category?: string;
  status?: string;
  title?: string;
  useCase?: string;
  use_case?: string;
  scenarioId?: string;
  scenario_id?: string;
  featureFile?: string;
  feature_file?: string;
  featureExists?: boolean;
  testArtifact?: string;
  test_artifact?: string;
  technicalArtifact?: string;
  technical_artifact?: string;
  dependsOn?: string[];
  depends_on?: string[];
  [key: string]: unknown;
}

/** What one `harness run` carries from requirement to requirement. */
export interface RunContext {
  projectDir: string;
  baseRef: string;
  settings: HarnessSettings;
  timeoutMs: number;
  timeoutSeconds: number;
  keepWorktrees: boolean;
  force: boolean;
  resume: boolean;
  skipNotReady: boolean;
  /** REQ-591: wait for a person between a failed attempt and the next. */
  pauseBetweenAttempts?: boolean;
  budgetSeconds: number;
  maxRequirements: number;
  strictArtifacts: boolean;
  verbose: boolean;
  /** Set per level by `runLevels`: the base each requirement is cut from. */
  baseFor?: (id: string) => string;
  /** Set per level by `runLevels`: may one more requirement start? */
  mayStart?: () => boolean;
  /** Why `mayStart` said no. */
  stopReason?: () => string;
  /** The code of that reason: `stop_asked`, or the budget's. */
  stopCode?: () => string;
  /** The plan's hint for the requirement being processed. */
  hint?: string;
  /** What this run keeps while it goes; see `runStateOf`. */
  run?: import("./state").RunState;
}

/** How a requirement ended. `blocked` and `skipped` were never attempted. */
/** `question`: the agent asked instead of guessing, and the requirement waits for the answer (REQ-189). */
/** `unverified`: the gate ran no test — the project has no test command — so nothing proved the code (REQ-649). */
export type RequirementVerdict =
  | "pass"
  | "fail"
  | "skipped"
  | "blocked"
  | "question"
  | "unverified";

/** One requirement's line in the report, the run record and a worker's JSON. */
export interface RequirementResult extends PublishOutcome {
  requirement: string;
  /** The question the agent asked, when the result is `question`. */
  question?: string;
  /** The question recorded in the project that the requirement waits on (REQ-495). */
  waitingForAnswer?: WaitingForAnswer;
  /** Why it was never started: `stop_asked` (REQ-491) or the budget's code. */
  stoppedBy?: string;
  category?: string;
  result: RequirementVerdict;
  attempts: number;
  branch: string;
  base?: string;
  durationMs?: number;
  error?: string;
  workPreserved?: boolean;
  attemptLog?: AttemptRecord[];
  adversarial?: ProbeOutcome;
  /** The quality checks of the passing attempt: time, verdict, findings, measure (REQ-228). */
  checks?: Array<Omit<CheckOutcome, "output">>;
  /** The role packages its prompts carried, as `role@version` (REQ-317). */
  packages?: string[];
}

/** The question a requirement waits on, and the command that answers it (REQ-495). */
export interface WaitingForAnswer {
  id: string;
  text: string;
  change: string;
  file: string;
  answer: string;
}

// Two levels up from dist/scripts/harness/run is dist/scripts, where the
// command entry points live.
export const SCRIPTS_DIR = path.join(__dirname, "..", "..");
export const PLAN_SCRIPT = path.join(SCRIPTS_DIR, "plan.js");
export const DONE_SCRIPT = path.join(SCRIPTS_DIR, "done.js");
export const VALIDATE_SCRIPT = path.join(SCRIPTS_DIR, "validate_specs.js");

/**
 * In `--format json` mode stdout carries exactly one JSON document and nothing
 * else — rule 1 of the agent contract (ADR-0017). It did not: progress lines
 * went to stdout alongside the report, so
 * `harness run --format json 2>/dev/null | jq .` did not parse. Nobody noticed
 * because nothing parsed it until the worker pool did.
 */
let jsonMode = false;

export function setJsonMode(on: unknown): void {
  jsonMode = Boolean(on);
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/**
 * A progress line. `REQ-001: attempt 1/3` is drawn with the requirement in its
 * own column, so a run over many requirements reads down one edge; a line that
 * starts with spaces continues the one above it.
 */
export function progressLine(mark: string, msg: string): string {
  const m = /^([A-Z][A-Z0-9]*-[\w.-]+): (.*)$/s.exec(msg);
  if (m) return `  ${mark}  ${ui.c.accent}${ui.pad(m[1], 9)}${ui.c.reset} ${m[2]}\n`;
  if (/^\s{2,}/.test(msg)) return `     ${ui.pad("", 9)} ${ui.muted(msg.trim())}\n`;
  return `  ${mark}  ${msg}\n`;
}
export function info(msg: string): void {
  (jsonMode ? process.stderr : process.stdout).write(
    progressLine(`${ui.c.brand}${ui.ASCII ? "*" : "◇"}${ui.c.reset}`, msg)
  );
}
export function warn(msg: string): void {
  (jsonMode ? process.stderr : process.stdout).write(
    progressLine(`${ui.c.warn}${ui.sym.warn}${ui.c.reset}`, msg)
  );
}
export function error(msg: string): void {
  process.stderr.write(ui.fail(msg));
}

export function git(projectDir: string, gitArgs: string[], opts: { encoding?: "utf8" } = {}) {
  return spawnSync("git", ["-C", projectDir, ...gitArgs], { encoding: "utf8", ...opts });
}

export function isGitClean(projectDir: string): boolean {
  const r = git(projectDir, ["status", "--porcelain"]);
  if (r.status !== 0) {
    throw new Error(`git status failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim() === "";
}

// Generous maxBuffer for captured subprocess output — Maven/Gradle first runs
// can easily produce >1 MB of dependency-download log, and `spawnSync`'s
// default 1 MB ceiling otherwise kills the gate with ENOBUFS.
export const SUBPROCESS_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Files the harness writes itself, and whose conflicts on an integration base
 * therefore mean nothing.
 *
 * Two sibling requirement branches *always* conflict here: each run ends with
 * `specgate done REQ-NNN`, which edits the same traceability matrix. The
 * integration base exists only so an agent can see the code its dependencies
 * produced; the matrix state on a throwaway branch is consulted by nobody, and
 * each real `harness/REQ-NNN` branch keeps its own row untouched.
 */
export const HARNESS_WRITTEN = ["docs/specs/traceability.md"];

/**
 * Resolve conflicts in generated files by keeping the base's version, and
 * report any conflict that is left.
 *
 * @returns conflicted paths that are *not* generated — the ones a human owns
 */
export function resolveGeneratedConflicts(worktree: string, commit = true): string[] {
  const listed = git(worktree, ["diff", "--name-only", "--diff-filter=U"]);
  if (listed.status !== 0) return ["(could not list conflicts)"];

  const conflicted = String(listed.stdout)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rest = conflicted.filter((p) => !HARNESS_WRITTEN.includes(p));
  if (rest.length > 0) return rest;

  for (const file of conflicted) {
    git(worktree, ["checkout", "--ours", "--", file]);
    git(worktree, ["add", "--", file]);
  }
  // REQ-574: `--chain` concludes the merge itself, as one commit it checks.
  if (!commit) return [];
  const concluded = git(worktree, ["commit", "--no-edit"]);
  return concluded.status === 0 ? [] : ["(could not conclude the merge)"];
}

/** What publishing a green branch produced, merged into the requirement's result. */
export interface PublishOutcome {
  pushed?: boolean;
  prCreated?: boolean;
  prOutput?: string;
  publishError?: string;
}

/** The code of a stop a person asked for (REQ-209, REQ-491). */
export const STOP_ASKED = "stop_asked";

/**
 * A requirement the budget never let start. Not a failure — it was not tried.
 * `code` says it was a stop or the budget, as against a chain that stopped at
 * a failure (REQ-491).
 */
export function notAttempted(
  req: HarnessRequirement | null | undefined,
  id: string,
  reason: string,
  code?: string
): RequirementResult {
  return {
    ...unattempted(
      id,
      req ? req.category : "",
      "skipped",
      `harness/${id}`,
      `Not attempted: ${reason}`
    ),
    ...(code ? { stoppedBy: code } : {}),
  };
}

/**
 * A requirement's result when it ended without an attempt: never started,
 * skipped, blocked, or a worker that left no report.
 */
export function unattempted(
  requirement: string,
  category: string | undefined,
  result: RequirementVerdict,
  branch: string,
  error: string
): RequirementResult {
  return { requirement, category, result, attempts: 0, branch, error };
}
