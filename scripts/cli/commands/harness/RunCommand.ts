#!/usr/bin/env node
/**
 * `specgate harness run` — the spec-driven delivery loop for AI coding agents.
 *
 * A spec-driven repo is already an environment for an agent: `plan` is the
 * task queue, the feature file + AI_RULES.md are the per-task context,
 * `validate --strict` + the project test command are the reward signal,
 * and `done` is the state transition. This command is the missing
 * orchestration layer — it runs plan → context → agent → verify → done
 * without a human copy-pasting prompts.
 *
 * For each pending requirement, in an isolated `git worktree` on a fresh
 * `harness/REQ-NNN` branch:
 *   1. Build a self-contained prompt (Gherkin + AI_RULES + paths + retry feedback).
 *   2. Shell out to the user-configured agent ({prompt_file} placeholder).
 *   3. Gate: `validate --strict` + the project test command.
 *   4. Green → `done REQ-NNN` + commit. Red → retry N times feeding the failure.
 *   5. Emit a pass/fail/attempts report.
 *
 * Vendor-neutral by construction: the agent is any shell command. The
 * harness never merges a branch — a human reviews and merges — except with
 * `--chain`, which a person asks for and which merges only what passed the
 * gate twice: on its branch and merged (ADR-0036).
 */

import { harnessCommitMessage, ticketKeyOf } from "../../../lib/ticket-keys";
import { runWithDeadline } from "../../../lib/run-with-deadline";
import { derivedMatrixFor, refreshDerivedMatrix } from "../spec/MatrixCommand";
import { isDerivedProject } from "../../../lib/derived-writes";
import * as ui from "../../../lib/ui";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { ChildProcess, spawn, spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";

import { resolveProjectDir } from "../../../lib/project-root";
import { buildPrompt } from "../../../harness/prompt";
import { detectSetupCommand } from "../../../harness/init";
import { inFlightRequirements, inFlightView } from "../../../lib/in-flight";
import { appendEvent, eventsFileFor, keepPrompt, writeQueue } from "../../../lib/harness-events";
import { ask as askQuestion } from "../../../lib/clarification";
import { e2eTestsNaming, onScreen } from "../../../lib/screen-requirements";
import {
  acquireRunLock,
  branchMergedInto,
  existingBranchAction,
  freeBytes,
  lowDiskMessage,
  minFreeBytes,
  orderAsGiven,
  runLockHolder,
  takeStop,
} from "../../../lib/harness-guard";
import { gateContext, runStages, type CheckOutcome } from "../../../lib/quality-run";
import type { Stage } from "../../../../packages/core/src/domain/QualityChecks";
import {
  EVENTS_ATTEMPT_VAR,
  EVENTS_FILE_VAR,
  EVENTS_REQ_VAR,
  maskCommand,
  testCounts,
} from "../../../../packages/core/src/domain/HarnessEvents";

/**
 * `read` against the project as it will be after its open changes are
 * archived (ADR-0035), so the harness sees, prompts for and gates a change's
 * requirements while they are in flight. The project itself when none is open.
 */
function judged<T>(
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
import { analyseGherkinSource } from "../../../../packages/core/src/domain/GherkinQuality";
import {
  readHarnessConfig,
  readProfileRules,
  resolveHarnessSettings,
  resolveProfileAgent,
  HarnessSettings,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

import { agentIo } from "../../../lib/agent";
import {
  checkWriteScope,
  parseGitStatus,
  WriteScopeChanges,
  protectingPattern,
  onlyTraceStatusChanged,
} from "../../../../packages/core/src/domain/WriteScope";
import {
  agentUnavailable,
  specSideFailure,
} from "../../../../packages/core/src/domain/RetryPolicy";
import { gateCommandIntegrity } from "../../../../packages/core/src/domain/GateCommandIntegrity";
import {
  isEmptyAttempt,
  PROMPT_ARCHIVE_DIR,
} from "../../../../packages/core/src/domain/EmptyAttempt";
import { checkDeclaredArtifacts } from "../../../../packages/core/src/domain/DeclaredArtifacts";
import {
  previousFailureFromPrompt,
  resumePoint,
} from "../../../../packages/core/src/domain/ResumeState";
import { requirementReadiness } from "../../../../packages/core/src/domain/RequirementReadiness";
import { selectProfile } from "../../../../packages/core/src/domain/ProfileMatch";
import { parseMatrixContexts } from "../../../../packages/core/src/domain/TraceabilityFormat";
import { RequirementPlan, withRework } from "../../../../packages/core/src/domain/RequirementPlan";
import {
  BudgetVerdict,
  budgetVerdict,
  hasBudget,
} from "../../../../packages/core/src/domain/RunBudget";
import { withWorktreeLock } from "../../../harness/worktree-lock";
import {
  NO_PROBE,
  probeFinding,
  shouldProbe,
  ProbeOutcome,
} from "../../../../packages/core/src/domain/AdversarialProbe";
import {
  checkGateRun,
  invokesCucumberDirectly,
  parseCucumberMessages,
  withMessageReport,
} from "../../../../packages/core/src/domain/CucumberMessages";
import {
  AttemptRecord,
  AttemptStep,
  featureFilePath,
  planAttempt,
  scheduleLevels,
  substituteAgentCommand,
  substituteGateCommand,
} from "../../../../packages/core/src/domain/HarnessRun";
import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";

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

/** The part of `plan --format json` the harness reads. */
interface PlanDocument {
  requirements?: HarnessRequirement[];
  next_steps?: Array<{ requirement: string; hint: string }>;
}

/**
 * The resolved settings plus `verbose`, which is a run flag rather than a
 * project setting and so only ever travels with the gate's copy.
 */
type GateSettings = Partial<HarnessSettings> & { verbose?: boolean };

/** What the gate said: green, or the stage it failed at and why. */
interface GateResult {
  ok: boolean;
  stage: string;
  output: string;
  hint?: string;
  /** The quality checks the gate ran (ADR-0040), for the run record. */
  checks?: CheckOutcome[];
}

/** Where a resumed requirement picks up, and what the gate said last time. */
interface ResumeAt {
  attempt: number;
  previousFailure: string;
}

/** What one `harness run` carries from requirement to requirement. */
interface RunContext {
  projectDir: string;
  baseRef: string;
  settings: HarnessSettings;
  timeoutMs: number;
  timeoutSeconds: number;
  keepWorktrees: boolean;
  force: boolean;
  resume: boolean;
  skipNotReady: boolean;
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
  /** The plan's hint for the requirement being processed. */
  hint?: string;
}

/** The context of one requirement's attempts, inside its worktree. */
interface AttemptContext extends RunContext {
  worktreeDir: string;
  resumeAt: ResumeAt | null;
  matchedProfile: string | null;
}

/** How a requirement ended. `blocked` and `skipped` were never attempted. */
/** `question`: the agent asked instead of guessing, and the requirement waits for the answer (REQ-189). */
type RequirementVerdict = "pass" | "fail" | "skipped" | "blocked" | "question";

/** One requirement's line in the report, the run record and a worker's JSON. */
export interface RequirementResult extends PublishOutcome {
  requirement: string;
  /** The question the agent asked, when the result is `question`. */
  question?: string;
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
}

/** What `attemptRequirement` decides; `processRequirement` adds the rest. */
type AttemptOutcome = Pick<
  RequirementResult,
  | "result"
  | "attempts"
  | "attemptLog"
  | "error"
  | "workPreserved"
  | "adversarial"
  | "question"
  | "checks"
>;

/** Runs one level of the schedule: in process, or through worker processes. */
type LevelRunner = (
  runnable: string[],
  byId: Map<string, HarnessRequirement>,
  hintByReq: Map<string, string>,
  ctx: RunContext,
  concurrency: number
) => Promise<RequirementResult[]>;

// Three levels up from dist/scripts/cli/commands/harness is dist/scripts,
// where the command entry points live.
const SCRIPTS_DIR = path.join(__dirname, "..", "..", "..");
const PLAN_SCRIPT = path.join(SCRIPTS_DIR, "plan.js");
const DONE_SCRIPT = path.join(SCRIPTS_DIR, "done.js");
const VALIDATE_SCRIPT = path.join(SCRIPTS_DIR, "validate_specs.js");
/**
 * What a worker process runs.
 *
 * It must be the file the command registry spawns, not this module: this one
 * defines the command but does not execute it, so pointing a worker at
 * `__filename` starts a process that loads, does nothing and exits 0 — which
 * the parent reports as "Worker produced no report".
 */
const WORKER_ENTRY = path.join(SCRIPTS_DIR, "harness", "run.js");

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

/**
 * A progress line. `REQ-001: attempt 1/3` is drawn with the requirement in its
 * own column, so a run over many requirements reads down one edge; a line that
 * starts with spaces continues the one above it.
 */
function progressLine(mark: string, msg: string): string {
  const m = /^([A-Z][A-Z0-9]*-[\w.-]+): (.*)$/s.exec(msg);
  if (m) return `  ${mark}  ${ui.c.accent}${ui.pad(m[1], 9)}${ui.c.reset} ${m[2]}\n`;
  if (/^\s{2,}/.test(msg)) return `     ${ui.pad("", 9)} ${ui.muted(msg.trim())}\n`;
  return `  ${mark}  ${msg}\n`;
}
function info(msg: string): void {
  (jsonMode ? process.stderr : process.stdout).write(
    progressLine(`${ui.c.brand}${ui.ASCII ? "*" : "◇"}${ui.c.reset}`, msg)
  );
}
function warn(msg: string): void {
  (jsonMode ? process.stderr : process.stdout).write(
    progressLine(`${ui.c.warn}${ui.sym.warn}${ui.c.reset}`, msg)
  );
}
export function error(msg: string): void {
  process.stderr.write(ui.fail(msg));
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness run [options]\n\n" +
      "Runs the plan → agent → verify → done loop for every pending requirement.\n\n" +
      "  --agent <cmd>          Agent command; must contain the {prompt_file} placeholder.\n" +
      '                         e.g. --agent "claude -p < {prompt_file}"\n' +
      "  --profile <name>       Run this profile's agent from .harness/profiles.yaml instead\n" +
      "                         of the configured one, for this run only.\n" +
      "  --test-cmd <cmd>       Project test command run as part of the gate (optional).\n" +
      "                         Substitutes {req}, {scenario} and {feature_file}, so the\n" +
      "                         gate can run the scenario under test.\n" +
      "  --max-attempts <n>     Retries per requirement, feeding back the failure (default 3).\n" +
      "  --concurrency <n>      Requirements in flight at once (default 1). Only requirements\n" +
      "                         that do not depend on each other ever run together.\n" +
      "  --req <REQ-NNN>        Limit to specific requirement(s); repeatable.\n" +
      "  --project-dir <path>   Project root (auto-detected from cwd if omitted).\n" +
      "  --base-branch <ref>    Branch/ref each worktree is cut from (default: current HEAD).\n" +
      "  --setup-cmd <cmd>      Run in each new worktree before the agent. Default: the\n" +
      "                         install the lockfile implies (npm ci, pnpm, yarn);\n" +
      "                         `none` runs nothing. The agent gets SPECGATE_REQ and\n" +
      "                         SPECGATE_ATTEMPT in its environment.\n" +
      "  --chain                One requirement at a time, in order, each cut from the\n" +
      "                         previous merge: a green one is merged into the branch\n" +
      "                         you are on (a merge commit, its prompts left on its\n" +
      "                         branch), the gate runs again on the merge, and a red\n" +
      "                         result is undone. Stops at the first failure.\n" +
      "  --timeout <seconds>    Per-agent-invocation timeout (default 1200).\n" +
      "  --keep-worktrees       Do not remove worktrees after each requirement.\n" +
      "  --force                Recreate harness/REQ-NNN branches that already exist.\n" +
      "  --format <text|json>   Report format (default text).\n" +
      "  --dry-run              Build prompts and print them; never invoke the agent.\n\n" +
      "CI mode (unattended runners — a nightly job that leaves PRs to review):\n" +
      "  --resume               Continue an interrupted run: reuse the existing\n" +
      "                         harness/REQ-NNN branch and worktree instead of\n" +
      "                         skipping it, and pick up at the attempt it stopped on.\n" +
      "  --budget-seconds <n>   Wall-clock ceiling for the whole run. On reaching it\n" +
      "                         the run stops cleanly and still reports what it did.\n" +
      "  --max-requirements <n> Attempt at most n requirements in this run.\n" +
      "  --verbose              Stream the gate command's output as it runs, on\n" +
      "                         stderr. Without it the output only appears when the\n" +
      "                         gate fails, so a run that takes minutes shows\n" +
      "                         nothing and a hung test looks like a working one.\n" +
      "  --skip-not-ready       Skip requirements an agent could not succeed at — no\n" +
      "                         feature, an unrunnable scenario, unmet dependencies,\n" +
      "                         Deprecated or Needs Clarification. Default: warn and\n" +
      "                         run them anyway.\n" +
      "  --skip-baseline        Run even when the base already fails `validate --strict`.\n" +
      "                         Default: refuse before any agent runs, since every\n" +
      "                         attempt would fail the same gate for a reason outside\n" +
      "                         its requirement.\n" +
      "  --strict-artifacts     Fail an attempt whose diff never touches the paths the\n" +
      "                         matrix declares for the requirement (default: warn).\n" +
      "  --push                 Push each green harness/REQ-NNN branch to the remote.\n" +
      "  --remote <name>        Remote to push to (default origin).\n" +
      "  --pr-cmd <cmd>         Command run after a successful push, with {branch} and\n" +
      '                         {req} placeholders. e.g. --pr-cmd "gh pr create --head {branch} \\\n' +
      "                         --title '{req} via harness' --fill\"\n\n" +
      "`--agent`, `--test-cmd`, `push`, `remote` and `pr_cmd` may also be set in harness.config.yaml.\n"
  );
}

export function parseArgs(argv: string[]) {
  const args = {
    projectDir: ".",
    agent: "",
    testCmd: "",
    maxAttempts: 0,
    concurrency: 0,
    reqs: [] as string[],
    baseBranch: "",
    // 600 was the original guess. Both real runs disproved it: the first
    // REQ-001 attempt hit 900s while the agent installed dependencies and
    // worked, and 1500 was needed comfortably. A default that times out on
    // ordinary work turns every first attempt into a wasted one.
    timeout: 1200,
    keepWorktrees: false,
    force: false,
    resume: false,
    format: "text",
    dryRun: false,
    verbose: false,
    strictArtifacts: false,
    skipNotReady: false,
    skipBaseline: false,
    budgetSeconds: 0,
    maxRequirements: 0,
    push: false,
    remote: "",
    prCmd: "",
    setupCmd: "",
    chain: false,
    profile: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--project-dir") {
      args.projectDir = argv[++i] || "";
    } else if (token === "--agent") {
      args.agent = argv[++i] || "";
    } else if (token === "--profile") {
      args.profile = argv[++i] || "";
    } else if (token === "--test-cmd") {
      args.testCmd = argv[++i] || "";
    } else if (token === "--max-attempts") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--max-attempts must be a positive integer");
      }
      args.maxAttempts = n;
    } else if (token === "--concurrency") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--concurrency must be a positive integer");
      }
      args.concurrency = n;
    } else if (token === "--req") {
      const r = argv[++i] || "";
      if (!/^REQ-\d+$/.test(r)) throw new Error(`--req expects REQ-NNN, got: ${r}`);
      args.reqs.push(r);
    } else if (token === "--base-branch") {
      args.baseBranch = argv[++i] || "";
    } else if (token === "--setup-cmd") {
      args.setupCmd = argv[++i] || "";
    } else if (token === "--chain") {
      args.chain = true;
    } else if (token === "--timeout") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--timeout must be a positive integer");
      args.timeout = n;
    } else if (token === "--push") {
      args.push = true;
    } else if (token === "--remote") {
      args.remote = argv[++i] || "";
    } else if (token === "--pr-cmd") {
      args.prCmd = argv[++i] || "";
    } else if (token === "--keep-worktrees") {
      args.keepWorktrees = true;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--resume") {
      args.resume = true;
    } else if (token === "--format") {
      args.format = argv[++i] || "";
    } else if (token === "--verbose") {
      args.verbose = true;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--strict-artifacts") {
      args.strictArtifacts = true;
    } else if (token === "--skip-not-ready") {
      args.skipNotReady = true;
    } else if (token === "--skip-baseline") {
      args.skipBaseline = true;
    } else if (token === "--budget-seconds") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--budget-seconds must be a positive integer");
      }
      args.budgetSeconds = n;
    } else if (token === "--max-requirements") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--max-requirements must be a positive integer");
      }
      args.maxRequirements = n;
    } else if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  // `--force` throws the branch away; `--resume` continues it. Asking for both
  // is asking for two opposite things, and silently picking one is how work
  // gets deleted after an interruption — the exact loss --resume exists to stop.
  if (args.force && args.resume) {
    throw new Error(
      "--force and --resume are opposites: --force deletes the existing branch, " +
        "--resume continues it. Pick one."
    );
  }
  if (!["text", "json"].includes(args.format)) {
    throw new Error(`Invalid --format: ${args.format}. Expected: text | json.`);
  }
  return args;
}

function git(projectDir: string, gitArgs: string[], opts: { encoding?: "utf8" } = {}) {
  return spawnSync("git", ["-C", projectDir, ...gitArgs], { encoding: "utf8", ...opts });
}

function isGitClean(projectDir: string): boolean {
  const r = git(projectDir, ["status", "--porcelain"]);
  if (r.status !== 0) {
    throw new Error(`git status failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim() === "";
}

function branchExists(projectDir: string, branch: string): boolean {
  const r = git(projectDir, ["branch", "--list", branch]);
  return r.status === 0 && r.stdout.trim() !== "";
}

function runPlan(projectDir: string): PlanDocument {
  const r = judged(projectDir, (dir) =>
    spawnSync(process.execPath, [PLAN_SCRIPT, "--project-dir", dir, "--format", "json"], {
      encoding: "utf8",
    })
  );
  if (r.status !== 0) {
    throw new Error(`plan failed:\n${r.stderr || r.stdout}`);
  }
  let parsed: PlanDocument;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (err) {
    // `JSON.parse` only ever throws a SyntaxError.
    throw new Error(`plan produced invalid JSON: ${(err as Error).message}`);
  }
  // Read on the project itself: the judged copy has every open change
  // archived into it, and no longer says which requirements were modified.
  const modified = new Set(
    inFlightRequirements(projectDir)
      .filter((r) => r.op === "modified")
      .map((r) => r.id)
  );
  if (modified.size > 0 && Array.isArray(parsed.requirements)) {
    parsed.requirements = withRework(parsed.requirements, modified);
  }
  return parsed;
}

// Generous maxBuffer for captured subprocess output — Maven/Gradle first runs
// can easily produce >1 MB of dependency-download log, and `spawnSync`'s
// default 1 MB ceiling otherwise kills the gate with ENOBUFS.
const SUBPROCESS_MAX_BUFFER = 64 * 1024 * 1024;

/** Run the gate (validate --strict, then the optional test command). */

/**
 * What Cucumber says it did, when it can be asked (F5).
 *
 * The gate's question has always been "did the command exit zero?", and H14
 * showed what that misses: `1 scenario (1 passed) · 0 steps · exit 0` is a
 * scenario that tested nothing and reported success. Cucumber has published a
 * machine-readable channel for years; this reads it.
 *
 * Two ways in, and neither guesses:
 *
 * - `message_report` in `harness.config.yaml` — the project writes the stream
 *   wherever it likes and says where. Works for any command.
 * - a **direct** `cucumber-js` invocation, which the harness appends
 *   `--format message:<tmp>` to. Deliberately narrow: `npm test` may well run
 *   Cucumber and there is no way to know from here, so it is left alone.
 *
 * Returns `null` when there is nothing to read — a project that does not use
 * Cucumber must not be failed by a check that never applied.
 */
function readGateMessages(worktreeDir: string, reportPath: string) {
  if (!reportPath) return null;
  const file = path.isAbsolute(reportPath) ? reportPath : path.join(worktreeDir, reportPath);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const run = parseCucumberMessages(raw);
  return run.parsed ? run : null;
}

/**
 * What the base already fails that no attempt in this run can fix, or null.
 * The gate judges the whole project, and a requirement past Draft with no test
 * (TDD-1, TDD-2) is one the agent may not touch: its status is in the
 * specification, and the agent works on another requirement. Findings about
 * the requirements being run are theirs to fix (a missing feature, say), and
 * do not count here.
 */
function baselineProblem(projectDir: string, running: Set<string>): string | null {
  const run = judged(projectDir, (dir, toProject) => {
    const r = spawnSync(process.execPath, [VALIDATE_SCRIPT, dir, "--strict"], {
      encoding: "utf8",
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    return { ...r, stdout: toProject(r.stdout || ""), stderr: toProject(r.stderr || "") };
  });
  if (run.status === 0) return null;
  const outside = `${run.stdout}${run.stderr}`
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\[TDD-[12]\]/.test(l))
    .filter((l) => {
      const owner = /\((?:scenario|requirement): ([A-Z]+-[A-Za-z0-9.]+)\)/.exec(l);
      return !(owner && running.has(owner[1]));
    });
  if (outside.length === 0) return null;
  const shown = outside.slice(0, 12);
  return (
    "The base already fails the gate (`validate --strict`) on requirements outside this run, " +
    "before any agent runs:\n" +
    shown.map((l) => `    ${l.replace(/^✖\s*/, "")}`).join("\n") +
    (outside.length > shown.length ? `\n    … ${outside.length - shown.length} more` : "") +
    "\nEvery attempt would fail it too, whatever its requirement: a status past Draft owes a " +
    "test. Write those tests or move those requirements back to Draft (`specgate check` shows " +
    "it whole), or pass --skip-baseline."
  );
}

/** Told about each gate stage as it ends, for the event file (ADR-0037). */
type GateReport = (stage: string, result: "pass" | "fail", extra?: Record<string, unknown>) => void;

function runGate(
  worktreeDir: string,
  testCmd: string,
  timeoutMs: number,
  req: Partial<HarnessRequirement> = {},
  settings: GateSettings = {},
  report: GateReport = () => {}
): GateResult {
  // `--delivering`: the requirement is still Draft while its gate runs, and a
  // Draft row owes no files. Without it the gate would skip the one
  // requirement this attempt exists to deliver.
  // The agent's tests are new evidence for a generated matrix: refresh it so
  // the gate judges the attempt, not the matrix as it was before it.
  refreshDerivedMatrix(worktreeDir);
  let passHint = "";
  const validate = judged(worktreeDir, (dir, toProject) => {
    const validateArgs = [VALIDATE_SCRIPT, dir, "--strict"];
    if (req.requirement) validateArgs.push("--delivering", req.requirement);
    const run = spawnSync(process.execPath, validateArgs, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    // The agent is told about its worktree, not about the copy it was judged in.
    return { ...run, stdout: toProject(run.stdout || ""), stderr: toProject(run.stderr || "") };
  });
  report("validate --strict", validate.status === 0 ? "pass" : "fail");
  if (validate.status !== 0) {
    return {
      ok: false,
      stage: "validate --strict",
      output: validate.stdout + validate.stderr,
      hint: "",
    };
  }
  // REQ-199: a requirement used on a screen needs an end-to-end test that
  // names it, when the project says where those live.
  if (settings.e2eDir && req.requirement && onScreen(worktreeDir, req.requirement)) {
    const named = e2eTestsNaming(worktreeDir, settings.e2eDir, req.requirement);
    report("e2e test", named.length ? "pass" : "fail");
    if (named.length === 0) {
      return {
        ok: false,
        stage: "e2e test",
        output: `No file under ${settings.e2eDir} names ${req.requirement}.`,
        hint:
          `${req.requirement} is used on a screen: add an end-to-end test under ` +
          `${settings.e2eDir} that names it, driving the screen its scenarios describe.`,
      };
    }
  }
  // ADR-0028: the architecture check runs between validation and the tests,
  // and its failure goes back to the agent like any other gate failure.
  const archCmd = String(settings.archCmd || "").trim();
  if (archCmd) {
    const arch = spawnSync(archCmd, {
      shell: true,
      cwd: worktreeDir,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    report(`architecture check: ${archCmd}`, arch.status === 0 ? "pass" : "fail");
    if (arch.status !== 0) {
      return {
        ok: false,
        stage: `architecture check: ${archCmd}`,
        output: (arch.stdout || "") + (arch.stderr || ""),
        hint:
          "The code is in a place the architecture does not allow. Move it to the layer the " +
          "rule names; do not change the rule.",
      };
    }
  }
  if (testCmd) {
    let resolved = substituteGateCommand(testCmd, req);

    // Where the message stream will be, if there is one to have.
    let reportPath = settings.messageReport || "";
    if (!reportPath && invokesCucumberDirectly(resolved)) {
      // Forward slashes on every platform: Cucumber reads `message:.harness\x`
      // on Windows as a path it does not write, and the gate then had no
      // stream to check and passed a run of no scenarios.
      reportPath = path.posix.join(
        ".harness",
        `messages-${req.requirement || "run"}-${crypto.randomBytes(3).toString("hex")}.ndjson`
      );
      fs.mkdirSync(path.join(worktreeDir, ".harness"), { recursive: true });
      resolved = withMessageReport(resolved, reportPath);
    }

    // A fresh worktree carries only what git tracks, so a project with
    // dependencies has no node_modules here. Verified the hard way: an agent
    // spent its first attempt installing them and timed out. The gate command
    // is the right place to say so, since only the project knows how.
    // `--verbose` streams instead of capturing, and streams to **fd 2**.
    //
    // `spawnSync` cannot do both: the buffers only exist once the child has
    // exited, which is the moment streaming stops being useful. Streaming is
    // the point of the flag — during a run that takes minutes there is nothing
    // to watch, and a gate that hangs looks exactly like a gate that is working.
    //
    // Stderr rather than inherited stdout, because `--format json` promises one
    // parseable document on stdout. Letting the test command write there is
    // precisely H18: prose and JSON sharing a stream.
    const test = spawnSync(resolved, {
      shell: true,
      cwd: worktreeDir,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
      stdio: settings.verbose ? ["ignore", 2, 2] : undefined,
    });
    report(
      `test command: ${maskCommand(resolved)}`,
      test.status === 0 ? "pass" : "fail",
      testCounts(`${test.stdout || ""}${test.stderr || ""}`)
    );
    if (test.status !== 0) {
      // Name the command. A gate that silently does the wrong thing — running
      // the whole suite because a filter did not apply, say — produces a
      // failure indistinguishable from a real one, and the operator has no way
      // to tell without the command in front of them.
      return {
        ok: false,
        stage: `test command: ${resolved}`,
        // Streamed output is not captured, so say where it went rather than
        // recording an empty string a reader would take for "printed nothing".
        output: settings.verbose
          ? "(streamed above — run without --verbose to capture it in the report)"
          : test.stdout + test.stderr,
      };
    }

    // Exit zero is where the old gate stopped. This is the part that catches a
    // suite that passed without covering the requirement at all.
    const messages = readGateMessages(worktreeDir, reportPath);
    if (messages) {
      const findings = checkGateRun(messages, {
        requirement: req.requirement,
        scenarioId: req.scenarioId || req.scenario_id,
        featureFile: featureFilePath(req),
      });
      const errors = findings.filter((f) => f.severity === "error");
      const warnings = findings.filter((f) => f.severity !== "error");
      if (errors.length > 0) {
        return {
          ok: false,
          stage: "cucumber messages",
          output:
            `The test command exited 0, but the run it reported does not support ` +
            `that verdict:\n\n` +
            errors.map((e) => `  ${e.message}\n  fix: ${e.fix}`).join("\n\n"),
        };
      }
      if (warnings.length > 0) passHint = warnings[0].message;
    }
  }
  // REQ-220, REQ-221: the quality checks, after the tests — the attempt ones,
  // then the end ones. A failure goes back to the agent like a failing test.
  const quality = settings.quality;
  if (quality && quality.checks.length > 0) {
    const ctx = gateContext(worktreeDir, req.requirement || "", "");
    const outcomes: CheckOutcome[] = [];
    for (const stage of ["attempt", "end"] as Stage[]) {
      for (const o of runStages(worktreeDir, quality, [stage], ctx)) {
        outcomes.push(o);
        // REQ-229: the step says what was measured, so /live shows it as it happens.
        const said = o.skipped
          ? " (not run)"
          : o.measure && o.measure.value !== null
            ? ` ${o.measure.value}%`
            : o.findings
              ? ` · ${o.findings.freshCount} new`
              : "";
        report(`quality: ${o.name}${said}`, o.ok || !!o.skipped || !o.gate ? "pass" : "fail", {
          ms: o.ms,
          ...(o.skipped ? { skipped: o.skipped } : {}),
          ...(o.measure ? { value: o.measure.value } : {}),
        });
        if (o.gate && !o.ok && !o.skipped) {
          return {
            ok: false,
            stage: `quality check: ${o.name}`,
            output: o.output,
            hint:
              o.measure && o.measure.kind === "coverage"
                ? "Write the tests that run the lines named above; do not lower the threshold."
                : o.measure && o.measure.kind === "mutation"
                  ? "Strengthen the tests so each surviving mutant named above would fail one."
                  : o.name === "commits"
                    ? "Reword the commits named above as Conventional Commits, or do not commit: the harness commits for you."
                    : "Fix what the check found. Do not silence it: no @SuppressWarnings, eslint-disable or baseline edit.",
            checks: outcomes,
          };
        }
      }
    }
    return { ok: true, stage: "", output: "", hint: passHint, checks: outcomes };
  }
  return { ok: true, stage: "", output: "", hint: passHint };
}

/**
 * Undo whatever an advisory agent touched.
 *
 * A reviewer returns text. If it also edited files, those edits would be gated
 * and committed as if the implementer had made them, and nobody would know
 * which agent wrote what. Discarding is cheaper to reason about than trusting
 * the reviewer to behave.
 */
/**
 * Keep a copy of exactly what each agent was given.
 *
 * It goes in the *worktree*, so `git add -A` commits it with the work and it
 * arrives in the branch a human reviews — which is the point — while the main
 * tree stays clean. It used to be written to the project directory, which
 * dirtied it and blocked the next run.
 *
 * The file name carries the role, so an attempt that ran a reviewer and then an
 * implementer leaves two files and it is obvious which prompt went to whom.
 *
 * Best-effort: never fail a run over a bookkeeping write.
 */
function archivePrompt(
  worktreeDir: string,
  requirement: string,
  attempt: number,
  step: AttemptStep,
  prompt: string
): void {
  try {
    const dir = path.join(worktreeDir, ...PROMPT_ARCHIVE_DIR.split("/"));
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const role = step.profile || (step.advisory ? "reviewer" : "agent");
    fs.writeFileSync(
      path.join(dir, `${requirement}-${ts}-attempt-${attempt}-${role}.md`),
      prompt,
      "utf8"
    );
  } catch {
    /* never fail the run on an audit-log write */
  }
}

function discardWorktreeChanges(worktreeDir: string): void {
  git(worktreeDir, ["checkout", "--", "."]);
  // The prompt archive is untracked, so an unqualified `clean -fd` deletes it —
  // taking with it the record of what the reviewer and every earlier attempt
  // were given. Auditability is the reason the archive exists; discarding the
  // reviewer's edits must not discard the evidence.
  git(worktreeDir, ["clean", "-fd", "-e", PROMPT_ARCHIVE_DIR]);
}

/**
 * Let an adversary try to break a green implementation (D3).
 *
 * Sequence, and the order is the whole design: the gate has already passed, so
 * the work is committable; the adversary writes a test in the worktree; the
 * project's own test command runs again; whatever the adversary wrote is
 * discarded so the branch carries the implementer's work alone.
 *
 * Never throws and never changes the verdict. The gate stays the only judge —
 * an adversary can always assert a behaviour the requirement never promised,
 * and a failing probe that blocked the run would stop correct work.
 */
function runAdversarialProbe(
  worktreeDir: string,
  req: HarnessRequirement,
  settings: HarnessSettings,
  timeoutMs: number,
  promptFor: (instruction: string) => string
): ProbeOutcome {
  const profile = settings.adversaryProfile;
  const command = settings.profileAgents[profile] || settings.agent;
  if (!command) return NO_PROBE;

  const instruction =
    `The implementation below already passes its gate. Your job is to try to ` +
    `**break** it: write one additional test, in the project's existing test ` +
    `style, for a case ${req.requirement} should handle and might not — an ` +
    `empty input, a boundary, a duplicate, a failure path. Write the test and ` +
    `nothing else. Do not modify the implementation, the specification or any ` +
    `existing test.`;

  const promptFile = path.join(
    os.tmpdir(),
    `specgate-probe-${req.requirement}-${crypto.randomBytes(4).toString("hex")}.md`
  );

  try {
    fs.writeFileSync(promptFile, promptFor(instruction), "utf8");
    const agent = spawnSync(substituteAgentCommand(command, promptFile), {
      shell: true,
      cwd: worktreeDir,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const wrote = git(worktreeDir, ["status", "--porcelain"])
      .stdout.split("\n")
      .map((line) => line.slice(3).trim())
      .filter((line) => line && !line.startsWith(PROMPT_ARCHIVE_DIR));

    if (wrote.length === 0) {
      // Nothing written is not a failure: an adversary that cannot think of a
      // case is telling you something mildly reassuring.
      return { ran: true, broke: false, detail: "The adversary wrote no test.", wrote: [] };
    }

    const after = runGate(worktreeDir, settings.testCmd, timeoutMs, req, {
      ...settings,
      quality: undefined,
    });
    return {
      ran: true,
      broke: !after.ok,
      detail: [`${agent.stdout || ""}${agent.stderr || ""}`.trim(), after.output || ""]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000),
      wrote,
    };
  } catch {
    // Insurance that fails is still only insurance; it must not take the run.
    return NO_PROBE;
  } finally {
    try {
      fs.rmSync(promptFile, { force: true });
    } catch {
      /* a temp file nobody will read again */
    }
    // The branch carries the implementer's work and nothing else.
    discardWorktreeChanges(worktreeDir);
  }
}

/**
 * Did the agent edit the contract it was being judged against? (A1, closes H16)
 *
 * The prompt asks it not to; nothing checked. An agent that cannot make the
 * scenario pass can relax the scenario, or add a permissive line to
 * `AI_RULES.md`, and the gate approves — `validate --strict-tdd` verifies that
 * the feature exists and is in the matrix, never that it still says what it
 * said. "Specs as executable contracts" stops being true the moment the
 * executor may edit the contract.
 *
 * Run **before** the gate, not after: once the scenario has been loosened, a
 * green gate means nothing, so there is no point asking it.
 *
 * The diff of the offending paths goes back into the next attempt's prompt.
 * That is not politeness — in practice the agent almost always did it without
 * meaning to, and being shown the hunk is what corrects it. A refusal with no
 * evidence just gets repeated.
 */
/**
 * What the agent wrote, as git sees it.
 *
 * `-uall` is not optional. Plain `--porcelain` collapses a wholly new directory
 * into a single `?? src/` entry, so `src/Health.java` never appears and any
 * check reading it concludes the file was never written. Found by an agent that
 * had correctly created both declared artifacts and was reported as having
 * touched neither.
 */
function worktreeChanges(worktreeDir: string): WriteScopeChanges | null {
  const status = git(worktreeDir, ["status", "--porcelain", "-uall"]);
  if (status.status !== 0) return null;
  return parseGitStatus(status.stdout || "");
}

/**
 * Did the agent write anything at all? (H19)
 *
 * The gate runs *before* `specgate done`, so at gate time the requirement is still
 * `Draft` — and `--strict-tdd`'s "no Test Artifact = TBD past Draft" rule does
 * not apply to a Draft row. `done` then flips the status to `Implemented` and
 * nothing validates again. The consequence, reproduced on 2026-08-26 with
 * `--agent "cat {prompt_file} > /dev/null"` against a freshly generated
 * project: **an agent that wrote zero files reported `pass (1 attempt)`**, with
 * the row moved to `Implemented` and its Test artifact still `TBD`.
 *
 * `--strict-artifacts` cannot catch this either: it compares the diff against
 * the paths the row declares, and a row that declares none has nothing to
 * compare.
 *
 * So the harness asks the one question that needs no declaration and has no
 * legitimate negative answer: did anything change? An agent that produced no
 * files cannot have implemented a requirement, whatever the gate says about the
 * documents around it. That makes this a hard failure rather than an opt-in
 * flag, under the rule ADR-0023 sets out — a content check is a gate only when
 * failing it is always a defect, and this one is.
 *
 * The prompt archive does not count. The harness writes it itself, so counting
 * it would mean the harness's own bookkeeping vouches for the agent.
 *
 * Run **before** the gate, for the same reason `checkWriteScopeInWorktree` is:
 * a green gate over an empty diff proves nothing, so there is no point asking
 * it. It is also the cheaper order — an empty attempt stops before the project's
 * test command runs.
 */
function producedNothing(worktreeDir: string): boolean {
  return isEmptyAttempt(touchedPaths(worktreeDir));
}

/**
 * A generated matrix that says exactly what regenerating it says was not
 * edited — it was regenerated. Writing tests that name scenarios changes the
 * derived matrix the moment anything runs `specgate` in the worktree, and the
 * write-scope guard failed REQ-302 twice for a matrix identical to its own
 * regeneration (golden_app finding #37). A hand edit still differs, and still
 * fails.
 */
export function isRegeneratedMatrix(worktreeDir: string, rel: string): boolean {
  if (rel !== "docs/specs/traceability.md" || !isDerivedProject(worktreeDir)) return false;
  try {
    const current = fs.readFileSync(path.join(worktreeDir, rel), "utf8");
    return derivedMatrixFor(worktreeDir, current) === current;
  } catch {
    return false;
  }
}

/** A spec file whose only change is the `status=` `specgate done` writes (#56). */
function isStatusOnlyEdit(worktreeDir: string, rel: string): boolean {
  if (!/\.md$/.test(rel)) return false;
  const d = git(worktreeDir, ["diff", "-U0", "HEAD", "--", rel]);
  return d.status === 0 && onlyTraceStatusChanged(d.stdout || "");
}

function checkWriteScopeInWorktree(worktreeDir: string, settings: HarnessSettings) {
  const all = worktreeChanges(worktreeDir);
  if (!all) return null;
  const changes = {
    ...all,
    modified: all.modified.filter(
      (p) => !isRegeneratedMatrix(worktreeDir, p) && !isStatusOnlyEdit(worktreeDir, p)
    ),
  };

  const violations = checkWriteScope(changes, {
    protectedPaths: settings.protectedPaths.length ? settings.protectedPaths : undefined,
    allowPaths: settings.allowPaths,
  });
  if (violations.length === 0) return null;

  const diff = git(worktreeDir, ["diff", "--", ...violations.map((v) => v.path)]);
  const evidence = (diff.stdout || "").trim();

  return {
    violations,
    message:
      `agent_touched_protected_path — the agent modified ${violations.length} file(s) it is ` +
      `not allowed to change:\n` +
      violations.map((v) => `  ${v.path}  (protected by \`${v.pattern}\`)`).join("\n") +
      `\n\nThese files are the contract this requirement is judged against. Editing them ` +
      `makes a passing gate meaningless. Revert them and satisfy the scenario as written.\n` +
      (evidence ? `\nWhat was changed:\n\n\`\`\`diff\n${evidence}\n\`\`\`\n` : "") +
      `\nIf the change is genuinely required, it belongs in a spec change ` +
      `(\`specgate propose\`), reviewed by a person — not in this attempt.`,
  };
}

/**
 * Did the agent rewrite the definition the gate command depends on? (#167)
 *
 * The write-scope guard covers the contract — spec.md, AI_RULES.md, features/**
 * — and not the file that defines the command the gate runs. Measured with a
 * stub agent that wrote no implementation at all and only replaced
 * `"test": "node --test tests/*.test.js"` with `"echo 'all good'"` over a red
 * suite: `✅ REQ-001 pass (1 attempt)`.
 *
 * This does not protect the manifest — adding a dependency mid-implementation
 * is legitimate, and a guard that blocks it gets switched off. It compares one
 * value: the script the gate actually invokes, at the base commit and now.
 *
 * Returns null when there is nothing to report, including when the gate command
 * is one whose meaning does not live in a file we can read.
 */
function checkGateCommandInWorktree(worktreeDir: string, baseRef: string, testCmd: string) {
  if (!testCmd) return null;

  const probe = gateCommandIntegrity(testCmd, "{}", "{}");
  if (!probe.script) return null;
  const manifest = probe.script.manifest;

  const show = git(worktreeDir, ["show", `${baseRef}:${manifest}`]);
  const before = show.status === 0 ? show.stdout : null;
  const currentPath = path.join(worktreeDir, manifest);
  const after = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, "utf8") : null;

  const result = gateCommandIntegrity(testCmd, before, after);
  if (!result.checked || !result.changed) return null;
  // A checked result always names its script: the probe above resolved it.
  const changed = result.script!;

  return {
    manifest,
    script: changed.script,
    message:
      `agent_rewrote_gate_command — the gate runs \`${testCmd}\`, and this attempt ` +
      `changed what that means.\n\n` +
      `  ${manifest} → scripts.${changed.script}\n` +
      `  before: ${result.before === null ? "(absent)" : result.before}\n` +
      `  after:  ${result.after === null ? "(absent)" : result.after}\n\n` +
      `The command the gate runs is part of the contract this requirement is ` +
      `judged against, exactly like the scenario is. Weakening it makes a green ` +
      `gate meaningless.\n\n` +
      `Revert that script and make the suite pass as it stands. If the command is ` +
      `genuinely wrong, that is a change for a person to make — not something to ` +
      `fix inside the attempt being measured by it.`,
  };
}

/**
 * Every path the agent wrote in this worktree — added and modified alike.
 *
 * Shared with the write-scope guard, which is why A2 costs almost nothing: the
 * diff was already being read.
 */
function touchedPaths(worktreeDir: string): string[] {
  const changes = worktreeChanges(worktreeDir);
  return changes ? [...changes.modified, ...changes.added] : [];
}

/**
 * Did the green diff touch what the matrix said it would? (A2)
 *
 * The row declares `test_artifact` and `technical_artifact` and the prompt
 * hands both to the agent, but nothing checked the diff contained them. An
 * agent can implement somewhere else, pass the scenario, and leave the matrix
 * pointing at a file where the logic does not live — the documentary lie
 * `AI_RULES.md` forbids this repository.
 *
 * Run after a **green** gate, because the claim being checked is about a diff
 * that already works. A red attempt has a more urgent problem.
 *
 * A warning by default. An implementation can legitimately land in a shared
 * module that already exists, and a hard failure there would be the kind of
 * gate that rejects good work — which already cost two runs on REQ-002.
 * `--strict-artifacts` is for a project that wants it enforced.
 */
function checkDeclaredArtifactsInWorktree(
  worktreeDir: string,
  req: HarnessRequirement,
  strict: boolean
) {
  const findings = checkDeclaredArtifacts(
    {
      touched: touchedPaths(worktreeDir),
      testArtifact: req.testArtifact || req.test_artifact,
      technicalArtifact: req.technicalArtifact || req.technical_artifact,
      requirement: req.requirement,
    },
    strict
  );
  return findings.length > 0 ? findings : null;
}

function attemptRequirement(req: HarnessRequirement, ctx: AttemptContext): AttemptOutcome {
  const { worktreeDir, settings, timeoutMs, hint } = ctx;
  /**
   * What the gate said last time, recovered from the prompt archive when this
   * is a resumed run. Without it the agent starts the resumed attempt blind and
   * repeats whatever it already got wrong.
   */
  let previousFailure = (ctx.resumeAt && ctx.resumeAt.previousFailure) || "";
  /**
   * What each attempt cost and where it ended.
   *
   * Wall-clock, because it is the one cost the harness can measure without the
   * agent's cooperation: an agent is any shell command, and only the agent
   * knows what it spent in tokens. `specgate harness report` is built on this.
   */
  const attemptLog: AttemptRecord[] = [];
  /** The reviewer's findings from the previous attempt, fed into this prompt. */
  let reviewFindings = "";
  // Once per requirement, not once per attempt: probing an implementation that
  // already failed tells you nothing, and probing every retry multiplies the
  // cost of the one step in the loop that is pure insurance.
  let probe: ProbeOutcome = NO_PROBE;

  const firstAttempt = Math.max(1, (ctx.resumeAt && ctx.resumeAt.attempt) || 1);
  /** Set when another attempt cannot change the outcome (#50). */
  let stopRetrying = false;

  // The live view's file (ADR-0037), in the project, not the worktree.
  const eventsFile = eventsFileFor(ctx.projectDir || worktreeDir, req.requirement);
  for (let attempt = firstAttempt; attempt <= settings.maxAttempts; attempt += 1) {
    info(`${req.requirement}: attempt ${attempt}/${settings.maxAttempts}`);
    const attemptStart = Date.now();
    const event = (e: Record<string, unknown> & { type: string }) =>
      appendEvent(eventsFile, e, req.requirement, attempt);
    event({ type: "attempt", state: "start" });
    let agentMs = 0;
    /** Which roles ran this attempt, in order — the run record's answer to "who did this". */
    const profilesUsed: string[] = [];
    const record = (stage: AttemptRecord["endedAt"]) => {
      event({
        type: "attempt",
        state: "end",
        result: stage === "pass" ? "pass" : stage === "question" ? "question" : "fail",
        ...(stage === "pass" ? {} : { stage }),
      });
      attemptLog.push({
        attempt,
        endedAt: stage,
        agentMs,
        totalMs: Date.now() - attemptStart,
        profiles: [...profilesUsed],
      });
    };

    // An attempt is a sequence of agent invocations, all bound to this one
    // requirement. Attempt 1 is a single implementing step; a retry may run an
    // advisory reviewer first, whose findings feed the step that follows.
    const steps = planAttempt(attempt, {
      attemptProfiles: settings.attemptProfiles,
      reviewProfile: settings.reviewProfile || null,
    });

    let stepFailed = false;
    try {
      for (const step of steps) {
        // Built per step, not per attempt: the reviewer runs first and the
        // implementing step that follows must see what it said. Building once
        // up front meant findings only ever reached the *next* attempt, which
        // is not what a reviewer is for.
        const prompt = judged(worktreeDir, (dir) =>
          buildPrompt(req, dir, {
            promptPrefix: settings.promptPrefix,
            hint,
            previousFailure: previousFailure || undefined,
            reviewFindings: step.advisory ? undefined : reviewFindings || undefined,
            attempt,
            maxAttempts: settings.maxAttempts,
            // Read from the worktree, which carries the matrix at the base
            // commit — the precedent must be work already accepted, not a
            // sibling requirement this same run happens to be writing.
            withPrecedents: settings.promptPrecedents === true,
            e2eDir:
              settings.e2eDir && onScreen(worktreeDir, req.requirement)
                ? settings.e2eDir
                : undefined,
          })
        );
        const promptFile = path.join(
          os.tmpdir(),
          `specgate-harness-prompt-${req.requirement}-${crypto.randomBytes(4).toString("hex")}.md`
        );
        fs.writeFileSync(promptFile, prompt, "utf8");
        archivePrompt(worktreeDir, req.requirement, attempt, step, prompt);
        // The live view shows what the agent was told and how big it was (REQ-182).
        keepPrompt(ctx.projectDir || worktreeDir, req.requirement, attempt, prompt);
        event({
          type: "prompt",
          role: step.profile || (step.advisory ? "reviewer" : "agent"),
          chars: prompt.length,
          lines: prompt.split("\n").length,
        });

        // D1: a profile chosen by matching this requirement, when one matches.
        // The role ladder still wins — `attempt_profiles` names a profile for
        // *this step*, and a step that says which role it is has already
        // answered the question.
        const profile = step.profile || ctx.matchedProfile || null;
        const agentCommand = profile
          ? settings.profileAgents[profile] || settings.agent
          : settings.agent;
        const command = substituteAgentCommand(agentCommand, promptFile);
        if (profile) {
          info(`${req.requirement}: ${step.advisory ? "reviewing" : "running"} as '${profile}'`);
        }
        const agentStart = Date.now();
        const agent = runWithDeadline(command, {
          cwd: worktreeDir,
          timeoutMs,
          maxBuffer: SUBPROCESS_MAX_BUFFER,
          // Which requirement and attempt this is, for agents and the wrappers
          // around them (ADR-0036).
          env: {
            SPECGATE_REQ: req.requirement,
            SPECGATE_ATTEMPT: String(attempt),
            [EVENTS_FILE_VAR]: eventsFile,
            [EVENTS_REQ_VAR]: req.requirement,
            [EVENTS_ATTEMPT_VAR]: String(attempt),
          },
        });
        // Node reports a timeout as an errno-carrying Error; the base `Error`
        // type the spawnSync signature declares does not have `code`.
        agentMs += Date.now() - agentStart;
        profilesUsed.push(profile ?? (step.advisory ? "reviewer" : "agent"));

        fs.rmSync(promptFile, { force: true });
        const agentError = agent.error as NodeJS.ErrnoException | undefined;
        if (agentError?.code === "ETIMEDOUT") {
          if (step.advisory) {
            warn(`${req.requirement}: reviewer timed out — continuing without findings`);
            continue;
          }
          previousFailure = `Agent timed out after ${ctx.timeoutSeconds}s.`;
          warn(`${req.requirement}: agent timed out`);
          record("agent-timeout");
          stepFailed = true;
          break;
        }

        if (step.advisory) {
          // The reviewer advises and nothing more. Its findings become input to
          // the next prompt; anything it wrote is discarded, so it cannot reach
          // the gate. That is the line between this and a committee — the gate
          // stays the only judge, and a reviewer can never approve.
          reviewFindings = `${agent.stdout || ""}${agent.stderr || ""}`.trim();
          discardWorktreeChanges(worktreeDir);
          if (agent.status !== 0) {
            warn(`${req.requirement}: reviewer exited ${agent.status} — findings may be partial`);
          }
          continue;
        }

        if (agent.status !== 0) {
          const output = `${agent.stdout || ""}${agent.stderr || ""}`;
          previousFailure = `Agent exited ${agent.status}.\n${output}`;
          warn(`${req.requirement}: agent exited ${agent.status}`);
          // Out of quota: another attempt seconds later meets the same wall (#50).
          const unavailable = agentUnavailable(output);
          if (unavailable) {
            warn(`${req.requirement}: the agent cannot run now — ${unavailable}`);
            warn(`  not retrying; run it again once the agent is available`);
            record("agent-unavailable");
            stopRetrying = true;
          } else {
            record("agent-error");
          }
          stepFailed = true;
          break;
        }
      }
    } finally {
      /* each step removes its own prompt file */
    }
    if (stopRetrying) break;
    if (stepFailed) continue;

    // The agent asked instead of guessing (REQ-189): another attempt would
    // meet the same question, and the gate has nothing to judge.
    const asked = questionAsked(eventsFile, attempt, attemptStart);
    if (asked) {
      warn(`${req.requirement}: the agent asked — ${asked}`);
      record("question");
      discardWorktreeChanges(worktreeDir);
      return {
        result: "question",
        attempts: attempt - firstAttempt + 1,
        attemptLog,
        question: asked,
        error: `Needs clarification: ${asked}`,
      };
    }

    // Before the gate: an agent that wrote nothing cannot have implemented
    // anything, and the gate would approve it. See `producedNothing` (H19).
    if (producedNothing(worktreeDir)) {
      previousFailure =
        `You produced no files. Nothing in the worktree changed, so there is ` +
        `nothing implementing ${req.requirement}.\n\n` +
        `If you could not write, that is the problem to report — a non-interactive ` +
        `agent without tool permissions reads the prompt and cannot act on it. ` +
        `See docs/automation.md.`;
      warn(`${req.requirement}: the agent produced no files — nothing to gate`);
      warn(`  fix: check the agent's write permissions (see docs/automation.md)`);
      record("no-op");
      continue;
    }

    // Before the gate: a scenario the agent has just loosened cannot fail, so a
    // green gate proves nothing. See `checkWriteScopeInWorktree`.
    const scope = checkWriteScopeInWorktree(worktreeDir, settings);
    if (scope) {
      previousFailure = scope.message;
      warn(`${req.requirement}: ${scope.violations.length} protected path(s) modified`);
      for (const v of scope.violations) warn(`  ${v.path} (${v.pattern})`);
      record("write-scope");
      continue;
    }

    // Same reason as the write-scope guard, one level up: a gate command the
    // agent has just loosened cannot fail either.
    const gateCmd = checkGateCommandInWorktree(worktreeDir, "HEAD", settings.testCmd);
    if (gateCmd) {
      previousFailure = gateCmd.message;
      warn(`${req.requirement}: the agent rewrote the gate command`);
      warn(`  ${gateCmd.manifest} → scripts.${gateCmd.script}`);
      record("write-scope");
      continue;
    }

    // `verbose` is a run flag, not a project setting, so it travels on the
    // context rather than in `harness.config.yaml`.
    const gate = runGate(
      worktreeDir,
      settings.testCmd,
      timeoutMs,
      req,
      { ...settings, verbose: ctx.verbose },
      (stage, result, extra) => event({ type: "gate", stage, result, ...(extra || {}) })
    );
    if (!gate.ok) {
      previousFailure =
        `Gate failed at: ${gate.stage}\n\n` + (gate.hint ? `⚠ ${gate.hint}\n\n` : "") + gate.output;
      warn(`${req.requirement}: gate failed at ${gate.stage}`);
      if (gate.hint) warn(gate.hint);
      // Every finding is in a file the agent may not edit: no attempt can pass (#50).
      const rules = {
        protectedPaths: settings.protectedPaths.length ? settings.protectedPaths : undefined,
        allowPaths: settings.allowPaths,
      };
      const specFiles = specSideFailure(gate.output, (f) => protectingPattern(f, rules) !== null);
      if (specFiles) {
        previousFailure =
          `The gate fails on the specification, which the agent may not edit:\n` +
          specFiles.map((f) => `  ${f}`).join("\n") +
          `\n\nFix the scenario (a person, or \`specgate change\`), then run the harness again.\n\n` +
          previousFailure;
        warn(
          `${req.requirement}: the failure is in ${specFiles.join(", ")}, which the agent may not edit`
        );
        warn(`  not retrying; fix the specification and run it again`);
        record("spec");
        stopRetrying = true;
        break;
      }
      record("gate");
      continue;
    }

    // Green — but does the diff contain what the row promised? (A2)
    const artifacts = checkDeclaredArtifactsInWorktree(
      worktreeDir,
      req,
      Boolean(ctx.strictArtifacts)
    );
    if (artifacts) {
      for (const f of artifacts) {
        warn(`${req.requirement}: ${f.message} [${f.code}]`);
        if (f.fix) warn(`  fix: ${f.fix}`);
      }
      if (ctx.strictArtifacts) {
        previousFailure =
          `The gate passed, but the diff never touches the artifacts the matrix ` +
          `declares for ${req.requirement}:\n\n` +
          artifacts.map((f) => `  ${f.message}\n  fix: ${f.fix}`).join("\n\n") +
          `\n\nA matrix that points at a file where the logic does not live is a ` +
          `documentary lie. Implement it there, or correct the row.`;
        record("artifacts");
        continue;
      }
    }

    // Close the loop inside the worktree. The gate above is the check; `done`
    // running its own again would only double the slowest step.
    const done = spawnSync(
      process.execPath,
      [DONE_SCRIPT, req.requirement, "--no-check", "--project-dir", worktreeDir],
      { encoding: "utf8" }
    );
    if (done.status !== 0) {
      previousFailure = `done ${req.requirement} failed:\n${done.stdout}${done.stderr}`;
      warn(`${req.requirement}: done failed`);
      record("done");
      continue;
    }

    git(worktreeDir, ["add", "-A"]);
    const commit = git(worktreeDir, [
      "commit",
      "-m",
      harnessCommitMessage(worktreeDir, req.requirement, attempt, settings.maxAttempts),
    ]);
    if (commit.status !== 0) {
      previousFailure = `git commit failed:\n${commit.stderr || commit.stdout}`;
      warn(`${req.requirement}: commit failed`);
      record("commit");
      continue;
    }

    // The adversary runs **after** the commit, and the order is not cosmetic:
    // before it, `git status` shows the implementer's uncommitted work, so
    // discarding "what the probe wrote" would throw the implementation away and
    // report a pass over an empty branch. That is the H19 family — a green
    // verdict over work that is not there — and it was reintroduced here once.
    if (
      shouldProbe({
        profile: settings.adversaryProfile,
        gatePassed: true,
        alreadyProbed: probe.ran,
      })
    ) {
      info(`${req.requirement}: probing with '${settings.adversaryProfile}'`);
      probe = runAdversarialProbe(worktreeDir, req, settings, timeoutMs, (instruction) =>
        buildPrompt(req, worktreeDir, {
          promptPrefix: settings.promptPrefix,
          hint: instruction,
          withPrecedents: settings.promptPrecedents === true,
        })
      );
      if (probe.broke) {
        const finding = probeFinding(req.requirement, probe);
        warn(`${req.requirement}: ${finding.message} [${finding.code}]`);
        warn(`  fix: ${finding.fix}`);
      }
    }

    record("pass");
    return {
      result: "pass",
      attempts: attempt,
      attemptLog,
      // The probe never changes the verdict; it travels beside it so
      // `harness report` and the run record can show what it found.
      ...(probe.ran ? { adversarial: probe } : {}),
      ...(gate.checks ? { checks: gate.checks.map(({ output: _o, ...rest }) => rest) } : {}),
    };
  }

  // Every attempt is spent. Commit what the agent produced anyway, on the
  // branch, before the worktree is removed.
  //
  // It used to be discarded: `continue` moved to the next attempt and the
  // worktree was deleted at the end, so a failed requirement left a branch
  // identical to its base and nothing to look at. Diagnosing a failure then
  // cost a second full agent run with --keep-worktrees purely to see what had
  // been written — fifteen minutes to recover information the first run had.
  //
  // The commit subject says it failed, and `specgate done` never ran, so the
  // requirement is still Draft in the matrix. A human decides whether the work
  // is worth keeping; git decides nothing.
  const preserved = preserveFailedAttempt(worktreeDir, req, previousFailure);

  return {
    result: "fail",
    // Attempts *this* run spent. On a resume that starts at 3 of 3, one attempt
    // was spent here, and reporting 3 would double-count the earlier run's.
    attempts: stopRetrying ? attemptLog.length : settings.maxAttempts - firstAttempt + 1,
    error: previousFailure,
    workPreserved: preserved,
    attemptLog,
  };
}

/** The question the agent recorded with `specgate ask` during this attempt, if any (REQ-189). */
function questionAsked(eventsFile: string, attempt: number, startedMs: number): string | null {
  let text = "";
  try {
    text = fs.readFileSync(eventsFile, "utf8");
  } catch {
    return null;
  }
  const since = Math.floor(startedMs / 1000) - 1;
  let asked: string | null = null;
  for (const line of text.split("\n")) {
    try {
      const e = JSON.parse(line);
      if (e.type === "question" && e.attempt === attempt && Number(e.t) >= since && e.text) {
        asked = String(e.text);
      }
    } catch {
      /* a line being written */
    }
  }
  return asked;
}

/**
 * The questions the run's agents asked, written into the project and
 * committed (REQ-189): the agent could not edit the specification, so the
 * harness does, in one commit per question, and the requirement waits.
 */
function recordQuestions(projectDir: string, results: RequirementResult[]): void {
  for (const r of results) {
    if (r.result !== "question" || !r.question) continue;
    const asked = askQuestion(projectDir, r.requirement, r.question);
    if (!asked.ok) {
      warn(`${r.requirement}: could not record its question — ${asked.message}`);
      continue;
    }
    git(projectDir, ["add", "-A", "--", "docs/specs", "spec.md"]);
    git(projectDir, [
      "commit",
      "-q",
      "-m",
      `docs(specs): ${r.requirement} needs clarification — ${asked.question}\n\n${r.question}`,
    ]);
    r.error = `Needs clarification: ${asked.question} in ${asked.file} — specgate answer ${asked.question} "…"`;
    info(
      `${r.requirement}: ${asked.question} recorded in ${asked.file}; answer it with specgate answer`
    );
  }
}

/** Where a run's record lands. Local to the machine — see `writeRunRecord`. */
export const RUNS_DIR = path.join(".harness", "runs");

/** One run, as it will be read back by `specgate harness report`. */
export interface RunRecord {
  schemaVersion: number;
  startedAt: string;
  finishedAt: string;
  baseRef: string;
  concurrency: number;
  maxAttempts: number;
  /** Whether the run had a budget ceiling (C1). A short run reads differently. */
  bounded?: boolean;
  results: unknown[];
}

/**
 * Write what a run did, so the next question about it has an answer.
 *
 * The harness printed a report and forgot it. That is fine for one run and
 * useless for the question that decides whether agent roles are worth paying
 * for (E2-01): **what does a delivered requirement cost, and how often does the
 * first attempt work?** Neither is answerable from memory, and both are
 * answerable from a directory of these.
 *
 * The agent command is deliberately *not* recorded: it is a shell command a
 * user composed, and it is exactly the kind of string that ends up carrying an
 * API key.
 *
 * The directory ignores itself. Two reasons, and the first is not optional:
 * the harness refuses to start on a dirty tree, so a ledger git could see
 * would mean the first run makes the second one refuse — H2 of the closure
 * plan, where the harness blocked itself by writing into the project. The
 * second is that a file rewritten by every run is a merge conflict waiting to
 * happen; these numbers are local measurements, not shared history.
 *
 * Best-effort — a run that produced branches must not fail over bookkeeping.
 */
function writeRunRecord(projectDir: string, record: RunRecord): string | null {
  try {
    const dir = path.join(projectDir, RUNS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(dir, ".gitignore");
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
    const file = path.join(dir, `${record.startedAt.replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return file;
  } catch {
    return null;
  }
}

/**
 * The repository's main line, for the staleness check.
 *
 * `origin/HEAD` is authoritative when it is set; otherwise the conventional
 * names, in order. A repository with none of them simply gets no warning —
 * guessing wrong would be worse than staying quiet.
 */
function defaultBranch(projectDir: string): string | null {
  const head = git(projectDir, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (head.status === 0) {
    const ref = String(head.stdout).trim().replace("refs/remotes/", "");
    if (ref) return ref;
  }
  for (const name of ["main", "master"]) {
    if (git(projectDir, ["rev-parse", "--verify", "--quiet", name]).status === 0) return name;
  }
  return null;
}

/** How many commits `target` has that `ref` does not. */
function commitsBehind(projectDir: string, ref: string, target: string): number {
  const r = git(projectDir, ["rev-list", "--count", `${ref}..${target}`]);
  if (r.status !== 0) return 0;
  return Number(String(r.stdout).trim()) || 0;
}

/**
 * Warn when the base a requirement is cut from is missing work that the main
 * line already has.
 *
 * This is H9. `--base-branch harness/REQ-001` behaves exactly as git says it
 * should — the new branch inherits its base, not `main` — and it cost two
 * agent runs to discover, because a fix that had landed on `main` was simply
 * not there and the gate failed for a reason that had nothing to do with the
 * requirement. Deriving the base (below) removes the need to pass the flag;
 * this says so out loud when the derived base is stale anyway.
 */
function warnIfBaseIsStale(projectDir: string, reqId: string, base: string): void {
  const mainLine = defaultBranch(projectDir);
  if (!mainLine || mainLine === base) return;
  const behind = commitsBehind(projectDir, base, mainLine);
  if (behind === 0) return;
  warn(
    `${reqId}: base ${base} is ${behind} commit(s) behind ${mainLine}. ` +
      `A fix that landed on ${mainLine} is not in this worktree — a gate failure may not be about ${reqId}.`
  );
}

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
const HARNESS_WRITTEN = ["docs/specs/traceability.md"];

/**
 * Resolve conflicts in generated files by keeping the base's version, and
 * report any conflict that is left.
 *
 * @returns conflicted paths that are *not* generated — the ones a human owns
 */
function resolveGeneratedConflicts(worktree: string): string[] {
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
  const commit = git(worktree, ["commit", "--no-edit"]);
  return commit.status === 0 ? [] : ["(could not conclude the merge)"];
}

/**
 * Where a requirement's worktree is cut from.
 *
 * A requirement that builds on another needs that other's code to exist, and
 * the only place it exists during a run is the dependency's own
 * `harness/REQ-NNN` branch. Deriving this is what closes H12's other half:
 * nobody has to know the order and pass `--base-branch` by hand.
 *
 * Dependencies that are already `DONE` contribute nothing here — their work is
 * in the run's base already.
 *
 * @param deps   the requirement's dependencies, in declaration order
 * @param passed REQ → branch, for the dependencies that passed in this run
 */
function deriveBase(
  projectDir: string,
  reqId: string,
  deps: string[],
  passed: Map<string, string>,
  ctx: { baseRef: string }
): { base: string } | { error: string } {
  const branches = deps.map((d) => passed.get(d)).filter((b): b is string => Boolean(b));

  if (branches.length === 0) return { base: ctx.baseRef };
  if (branches.length === 1) return { base: branches[0] };

  // More than one dependency produced code, on branches that know nothing of
  // each other. Cutting from one would silently omit the rest, so they are
  // integrated into a throwaway base first. This is not the merge the harness
  // refuses to do — that one is into a branch a human reviews; this is
  // assembling the context the requirement was declared to need, and a
  // conflict here is a real finding rather than a nuisance.
  const integration = `harness/base/${reqId}`;
  git(projectDir, ["branch", "-D", integration]);
  const cut = git(projectDir, ["branch", integration, ctx.baseRef]);
  if (cut.status !== 0) {
    return { error: `could not create ${integration}: ${cut.stderr || cut.stdout}` };
  }

  const worktree = path.join(
    os.tmpdir(),
    `specgate-harness-base-${reqId}-${crypto.randomBytes(4).toString("hex")}`
  );
  const add = git(projectDir, ["worktree", "add", worktree, integration]);
  if (add.status !== 0) {
    return { error: `could not check out ${integration}: ${add.stderr || add.stdout}` };
  }

  try {
    for (const branch of branches) {
      const merge = git(worktree, ["merge", "--no-edit", branch]);
      if (merge.status === 0) continue;

      const unresolved = resolveGeneratedConflicts(worktree);
      if (unresolved.length > 0) {
        git(worktree, ["merge", "--abort"]);
        return {
          error:
            `${branch} conflicts with the other dependencies of ${reqId} in ` +
            `${unresolved.join(", ")}. Those are source files; a human has to decide.`,
        };
      }
    }
  } finally {
    git(projectDir, ["worktree", "remove", "--force", worktree]);
  }

  info(`${reqId}: base is ${branches.join(" + ")} integrated into ${integration}`);
  return { base: integration };
}

/**
 * Commit a failed attempt so the branch carries what the agent wrote.
 *
 * Returns false when there was nothing to commit — an agent that produced no
 * files at all, which is itself worth knowing and is reported as such.
 */
/**
 * The worktree already checked out on `branch`, if git still knows of one.
 *
 * After an interruption the worktree survives — the process died before its
 * `finally` could remove it — holding the agent's uncommitted partial work.
 * Re-using it is the difference between resuming and starting over.
 */
function existingWorktreeFor(projectDir: string, branch: string): string | null {
  const listed = git(projectDir, ["worktree", "list", "--porcelain"]);
  if (listed.status !== 0) return null;

  let current: string | null = null;
  for (const line of (listed.stdout || "").split("\n")) {
    if (line.startsWith("worktree ")) current = line.slice("worktree ".length).trim();
    else if (line.trim() === `branch refs/heads/${branch}` && current) {
      return fs.existsSync(current) ? current : null;
    }
  }
  return null;
}

/**
 * Where a resumed run picks up, and what the gate last said.
 *
 * Read from the prompt archive rather than the run ledger. The ledger is
 * written when a run *finishes*, and `--resume` is for the runs that do not —
 * a killed run leaves `.harness/runs/` empty. Measured, not assumed.
 *
 * The archive is reachable the same way in both endings: still uncommitted in a
 * surviving worktree after an interruption, and committed onto the branch by
 * `preserveFailedAttempt` once the attempts are spent, so a freshly added
 * worktree checks it out.
 */
function resumeFrom(worktreeDir: string, requirement: string): ResumeAt {
  const dir = path.join(worktreeDir, ...PROMPT_ARCHIVE_DIR.split("/"));
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return { attempt: 1, previousFailure: "" };
  }

  // Interrupted or exhausted? The two deserve different answers, and the branch
  // says which: `preserveFailedAttempt` leaves a `chore(...): attempt FAILED the gate`
  // commit when the attempts run out, and an interruption leaves none.
  //
  //   exhausted   → the last attempt reached a verdict → resume at the next one
  //   interrupted → it never did → re-run it, without charging the budget
  const head = git(worktreeDir, ["log", "-1", "--format=%s"]);
  // `chore(…): attempt FAILED` since REQ-234; `wip(…): FAILED` on branches older versions left.
  const lastCompleted = /^(?:chore\([^)]*\): attempt|wip\([^)]*\):) FAILED the gate/.test(
    (head.stdout || "").trim()
  );

  const point = resumePoint(names, requirement, lastCompleted);
  if (!point.latest) return { attempt: 1, previousFailure: "" };

  let previousFailure = "";
  try {
    previousFailure = previousFailureFromPrompt(
      fs.readFileSync(path.join(dir, point.latest.fileName), "utf8")
    );
  } catch {
    /* an unreadable archive is not a reason to refuse to resume */
  }
  return { attempt: point.attempt, previousFailure };
}

function preserveFailedAttempt(
  worktreeDir: string,
  req: HarnessRequirement,
  failure: string
): boolean {
  if (isGitClean(worktreeDir)) return false;

  git(worktreeDir, ["add", "-A"]);
  const firstLine = String(failure || "").split("\n")[0] || "gate failed";
  const commit = git(worktreeDir, [
    "commit",
    "-m",
    `chore(${req.requirement}): attempt FAILED the gate — do not merge as is\n\n` +
      `${firstLine}\n\n` +
      "Committed by `specgate harness run` so the attempt is reviewable rather than\n" +
      "discarded. The requirement is still Draft: `specgate apply` never ran.",
  ]);
  return commit.status === 0;
}

/**
 * Is this requirement's scenario worth spending an agent on? (A3)
 *
 * The harness gates a requirement by running its scenario. If Cucumber sees no
 * steps in that scenario, the gate reports `0 steps · exit 0` and the run is
 * recorded as a pass — the agent is paid for, the branch is published, and
 * nothing was verified. That is H14 seen from the harness: not a weak signal, a
 * counterfeit one.
 *
 * So the check runs **before** `git worktree add`, before the prompt, before
 * the agent: an attempt costs up to `max_attempts` × the timeout, and there is
 * no point buying that against a scenario that cannot fail.
 *
 * Only errors block. Warnings — a thin scenario, a vague step — are printed and
 * allowed through: they weaken the signal without faking it, and a project
 * brought in with `specgate adopt` would otherwise be unable to run the harness at
 * all. `specgate validate --strict-scenarios` is where a project opts into the
 * stricter reading.
 */
/**
 * Is this requirement fit to hand to an agent? (B2, and A3's guard folded in)
 *
 * `plan` has always known that a requirement's feature does not exist, that its
 * dependencies are unmet, or that its row is Deprecated. `harness run` never
 * used any of it as a filter, so the agent found out halfway through and the
 * run paid `max_attempts` × the timeout to discover it. That is the worst
 * cost-to-result attempt in the loop.
 *
 * The rules are in `core/domain/RequirementReadiness`; what happens here is
 * delivery, and it is not uniform:
 *
 * - **an unrunnable scenario always skips**, flag or no flag. That guard came
 *   from A3 and is not a matter of preference: Cucumber passes an empty
 *   scenario, so the reward signal is counterfeit and a green run would prove
 *   nothing (H14).
 * - **every other blocker warns and runs anyway**, unless `--skip-not-ready`.
 *   Default behaviour stays what it was — this ships in a minor — and a person
 *   who wants to point an agent at a half-ready requirement is allowed to.
 */
function readinessOf(projectDir: string, req: HarnessRequirement) {
  const rel = featureFilePath(req);
  const file = rel ? path.resolve(projectDir, rel) : "";
  const featureExists = Boolean(file && fs.existsSync(file));

  let scenarioFindings: Diagnostic[] = [];
  if (featureExists) {
    try {
      scenarioFindings = analyseGherkinSource(fs.readFileSync(file, "utf8"), rel);
    } catch {
      // An unreadable feature is the gate's problem to report, not a reason to
      // refuse the run here.
    }
  }

  const readiness = requirementReadiness({
    requirement: req.requirement,
    status: req.status || "",
    featureFile: rel,
    // `plan` decides whether a feature is missing; when the harness is handed a
    // requirement some other way, fall back to looking.
    featureExists: req.featureExists !== undefined ? Boolean(req.featureExists) : featureExists,
    scenarioFindings,
    // Deliberately **not** `blockedBy`. That comes from the plan snapshot taken
    // before the run, so a requirement whose predecessor passed *in this run*
    // still reads as blocked — and with `--skip-not-ready` it would be skipped
    // after the scheduler had correctly unblocked it. Measured: REQ-002 was
    // reported "depends on REQ-001, which is not done" moments after REQ-001
    // passed and its branch became REQ-002's base.
    //
    // `runLevels` owns ordering during a run: it schedules by level and marks
    // dependents `blocked` when a predecessor actually fails. Readiness answers
    // the questions the scheduler cannot.
    blockedBy: [],
    derived: isDerivedProject(projectDir),
    technicalDeclared: RequirementPlan.isMeaningful(
      req.technicalArtifact || req.technical_artifact
    ),
    testDeclared: RequirementPlan.isMeaningful(req.testArtifact || req.test_artifact),
  });

  return {
    ...readiness,
    scenarioErrors: scenarioFindings.filter((f) => f.severity === "error"),
  };
}

/** The settings a context carries, tolerating the worker path's shape. */
function settingsOf(ctx: Partial<RunContext> | null | undefined): Partial<HarnessSettings> {
  return (ctx && ctx.settings) || {};
}

/**
 * The bounded context a requirement belongs to, as `expand` wrote it (D1).
 *
 * Read from the matrix rather than the pack: a project may install several
 * packs, and the matrix is its own record of what it has.
 */
function contextOfRequirement(projectDir: string, requirement: string): string {
  const matrix = path.join(projectDir, "docs", "specs", "traceability.md");
  try {
    return parseMatrixContexts(fs.readFileSync(matrix, "utf8"))[requirement] || "";
  } catch {
    return "";
  }
}

/**
 * Can git commit here? Returns the problem, or `""`.
 *
 * Asked before the first worktree rather than at the commit step. The harness
 * commits for every green requirement and again to preserve a failed attempt,
 * so a missing identity costs a whole attempt — agent time included — to
 * discover something a single command fixes.
 */
function gitIdentityProblem(projectDir: string): string {
  const missing = ["user.name", "user.email"].filter((key) => {
    const r = git(projectDir, ["config", "--get", key]);
    return r.status !== 0 || !String(r.stdout || "").trim();
  });
  if (missing.length === 0) return "";

  return (
    `git has no ${missing.join(" and ")} configured, and the harness commits on ` +
    `every requirement it lands. It would fail after the agent had already run.\n` +
    `Fix: git config user.name "Your Name" && git config user.email "you@example.com"`
  );
}

function processRequirement(req: HarnessRequirement, ctx: RunContext): RequirementResult {
  const { projectDir, baseRef, keepWorktrees, force } = ctx;
  const branch = `harness/${req.requirement}`;

  // D1: which profile this requirement matches, resolved once. The bounded
  // context comes from the matrix, where `expand` derived it — see
  // `boundedContextOf`.
  const matchedProfile = selectProfile(settingsOf(ctx).profileRules || [], {
    requirement: req.requirement,
    boundedContext: contextOfRequirement(projectDir, req.requirement),
    featureFile: featureFilePath(req),
    category: req.category,
  });
  if (matchedProfile) info(`${req.requirement}: profile '${matchedProfile}' matched`);

  const readiness = readinessOf(projectDir, req);
  const unrunnable = readiness.blockers.find((b) => b.code === "requirement_scenario_unrunnable");
  const hardStop = unrunnable || (ctx.skipNotReady && !readiness.ready);

  for (const b of readiness.blockers) {
    const line = `${req.requirement}: ${b.message} [${b.code}]`;
    if (b.severity === "error") error(line);
    else warn(line);
    if (b.fix) warn(`  fix: ${b.fix}`);
  }

  // The readiness blocker says *that* the scenario cannot fail; these say
  // which line and which keyword. Collapsing A3's findings into one summary
  // would have cost the only part a person can act on directly.
  if (unrunnable) {
    for (const f of readiness.scenarioErrors || []) {
      error(`${req.requirement}: ${f.file}:${f.line} ${f.message} [${f.code}]`);
    }
  }

  if (hardStop) {
    return {
      requirement: req.requirement,
      category: req.category,
      result: "skipped",
      attempts: 0,
      branch,
      error: unrunnable
        ? `Its scenario would pass without testing anything, so the gate could not ` +
          `tell success from failure. Run \`specgate validate <dir> --strict-scenarios\` ` +
          `to see every one.`
        : `Not ready for an agent: ${readiness.blockers
            .filter((b) => b.severity === "error")
            .map((b) => b.code)
            .join(", ")}. Fix the blockers above, or drop --skip-not-ready to run it anyway.`,
    };
  }
  const worktreeDir = path.join(
    os.tmpdir(),
    `specgate-harness-${req.requirement}-${crypto.randomBytes(4).toString("hex")}`
  );

  // A full disk mid-copy ended a night's chain with ENOSPC (REQ-184): stop
  // before starting, with the reason, instead.
  const lowDisk = lowDiskMessage(freeBytes(os.tmpdir()), minFreeBytes(), os.tmpdir());
  if (lowDisk) {
    return {
      requirement: req.requirement,
      category: req.category,
      result: "fail",
      attempts: 0,
      branch,
      error: `Not started: ${lowDisk}`,
    };
  }

  // Three ways to meet an existing branch, and until C3 there were only two:
  // skip it, or delete it with --force. After an interruption — a crash, a
  // Ctrl-C, a spend limit — neither is what anyone wants.
  let resuming = false;
  const exists = branchExists(projectDir, branch);
  // A branch already merged into the base holds nothing to lose (REQ-185).
  const merged = exists && branchMergedInto(projectDir, branch, baseRef);
  const action = existingBranchAction({ exists, merged, resume: Boolean(ctx.resume), force });
  if (exists) {
    if (action === "resume") {
      resuming = true;
    } else if (action === "skip") {
      return {
        requirement: req.requirement,
        category: req.category,
        result: "skipped",
        attempts: 0,
        branch,
        error:
          `Branch ${branch} already exists. Re-run with --resume to continue it, ` +
          `or --force to recreate it from scratch.`,
      };
    } else {
      if (merged && !force) info(`${req.requirement}: ${branch} is already merged — recreating it`);
      git(projectDir, ["branch", "-D", branch]);
    }
  } else if (ctx.resume) {
    // Nothing to resume is not an error: --resume over a whole plan should run
    // the requirements that never started, not refuse the lot.
    info(`${req.requirement}: nothing to resume, starting fresh`);
  }

  warnIfBaseIsStale(projectDir, req.requirement, baseRef);
  const startedAt = Date.now();

  // A surviving worktree still holds the partial work; re-attaching to it is
  // what makes this a resume rather than a restart.
  const survivor = resuming ? existingWorktreeFor(projectDir, branch) : null;
  const dir = survivor || worktreeDir;

  if (!survivor) {
    const args = resuming
      ? ["worktree", "add", dir, branch]
      : ["worktree", "add", "-b", branch, dir, baseRef];
    // Serialised across processes: `--concurrency` gives each requirement its
    // own process, and two `git worktree add` calls in one repository race on
    // the half-written `.git/worktrees/<name>/` entry. Only the creation is
    // inside the lock — the agent and the gate stay parallel.
    const add = withWorktreeLock(projectDir, () => git(projectDir, args));
    if (add.status !== 0) {
      return {
        requirement: req.requirement,
        category: req.category,
        result: "fail",
        attempts: 0,
        branch,
        error: `git worktree add failed:\n${add.stderr || add.stdout}`,
      };
    }
  }

  try {
    const setupCmd = String((ctx.settings && ctx.settings.setupCmd) || "").trim();
    if (setupCmd && !survivor) {
      info(`${req.requirement}: setup — ${setupCmd}`);
      const setup = spawnSync(setupCmd, { cwd: dir, shell: true, encoding: "utf8" });
      if (setup.status !== 0) {
        return {
          requirement: req.requirement,
          category: req.category,
          result: "fail",
          attempts: 0,
          branch,
          error: `setup_cmd failed before the agent ran:\n${setup.stdout || ""}${setup.stderr || ""}`,
        };
      }
    }
    const resumeAt = resuming ? resumeFrom(dir, req.requirement) : null;
    if (resumeAt && resumeAt.attempt > 1) {
      info(`${req.requirement}: resuming at attempt ${resumeAt.attempt}`);
    }
    const outcome = attemptRequirement(req, {
      ...ctx,
      worktreeDir: dir,
      resumeAt,
      matchedProfile,
    });
    const result: RequirementResult = {
      requirement: req.requirement,
      category: req.category,
      branch,
      base: baseRef,
      durationMs: Date.now() - startedAt,
      ...outcome,
    };
    if (outcome.result === "pass") {
      Object.assign(result, publishBranch(projectDir, branch, req, ctx.settings));
    }
    return result;
  } finally {
    // `dir`, not `worktreeDir`: a resumed run re-attached to the worktree that
    // survived the interruption, and `worktreeDir` names a path that was never
    // created. Removing the wrong one leaves the real worktree registered and
    // the next --resume unable to attach.
    if (!keepWorktrees) {
      git(projectDir, ["worktree", "remove", "--force", dir]);
    } else {
      info(`${req.requirement}: worktree kept at ${dir}`);
    }
  }
}

/** What publishing a green branch produced, merged into the requirement's result. */
interface PublishOutcome {
  pushed?: boolean;
  prCreated?: boolean;
  prOutput?: string;
  publishError?: string;
}

/**
 * CI mode (B7): after a green requirement, optionally push the branch and
 * open a PR/MR via a user-configured command. Publication problems never
 * flip a pass to a fail — the code is good; the human just has to publish
 * manually — but they are reported.
 */
export function publishBranch(
  projectDir: string,
  branch: string,
  req: Pick<HarnessRequirement, "requirement">,
  settings: Pick<HarnessSettings, "push" | "remote" | "prCmd">
): PublishOutcome {
  const published: PublishOutcome = {};
  if (!settings.push) return published;

  // `--force-with-lease` trusts the local remote-tracking ref. When the branch
  // was merged and deleted on the remote, that ref is stale and the push is
  // refused ("stale info") — every requirement the harness ran a second time
  // failed to publish (golden_app finding #35). Bring the ref in line with
  // the remote first: drop it when the branch is gone, refresh it when not.
  const remoteHead = git(projectDir, ["ls-remote", "--heads", settings.remote, branch]);
  if (remoteHead.status === 0) {
    if (String(remoteHead.stdout || "").trim() === "") {
      git(projectDir, ["update-ref", "-d", `refs/remotes/${settings.remote}/${branch}`]);
    } else {
      git(projectDir, [
        "fetch",
        settings.remote,
        `+refs/heads/${branch}:refs/remotes/${settings.remote}/${branch}`,
      ]);
    }
  }
  const push = git(projectDir, ["push", "--force-with-lease", "-u", settings.remote, branch]);
  if (push.status !== 0) {
    published.pushed = false;
    published.publishError = `git push failed:\n${push.stderr || push.stdout}`;
    warn(`${req.requirement}: push to ${settings.remote} failed`);
    return published;
  }
  published.pushed = true;
  info(`${req.requirement}: pushed ${branch} to ${settings.remote}`);

  if (settings.prCmd) {
    const command = settings.prCmd
      .split("{branch}")
      .join(branch)
      .split("{req}")
      .join(req.requirement);
    const pr = spawnSync(command, {
      shell: true,
      cwd: projectDir,
      encoding: "utf8",
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    if (pr.status !== 0) {
      published.prCreated = false;
      published.publishError = `pr command failed:\n${pr.stderr || pr.stdout}`;
      warn(`${req.requirement}: pr command failed`);
    } else {
      published.prCreated = true;
      const firstLine = (pr.stdout || "").trim().split("\n").pop();
      if (firstLine) published.prOutput = firstLine;
      info(`${req.requirement}: pr command succeeded${firstLine ? ` → ${firstLine}` : ""}`);
    }
  }
  return published;
}

/**
 * How much of a failing gate's output the text report shows.
 *
 * Runners put the useful part at the end, so the tail is what a human needs.
 * Twenty lines is enough for a failing assertion with its stack, and short
 * enough that ten failed requirements do not bury the summary.
 */
const FAILURE_TAIL_LINES = 20;

export function printReport(results: RequirementResult[], format: string, recorded?: string): void {
  if (format === "json") {
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.result] = (acc[r.result] || 0) + 1;
      return acc;
    }, {});
    process.stdout.write(
      JSON.stringify({ schemaVersion: 1, total: results.length, summary, results }, null, 2) + "\n"
    );
    return;
  }

  const MARK = {
    pass: `${ui.c.ok}${ui.sym.ok}${ui.c.reset}`,
    fail: `${ui.c.bad}${ui.sym.fail}${ui.c.reset}`,
    blocked: `${ui.c.warn}${ui.sym.warn}${ui.c.reset}`,
    skipped: `${ui.c.muted}${ui.sym.empty}${ui.c.reset}`,
    question: `${ui.c.warn}?${ui.c.reset}`,
  };
  const COLOR = {
    pass: ui.c.ok,
    fail: ui.c.bad,
    blocked: ui.c.warn,
    skipped: ui.c.muted,
    question: ui.c.warn,
  };
  const idWidth = Math.max(9, ...results.map((r) => String(r.requirement).length));
  process.stdout.write("\n" + ui.section("Harness report"));
  for (const r of results) {
    process.stdout.write(
      `  ${MARK[r.result] || MARK.fail}  ${ui.c.bold}${ui.pad(String(r.requirement), idWidth)}${ui.c.reset} ` +
        `${COLOR[r.result] || ""}${ui.pad(r.result, 9)}${ui.c.reset}` +
        ui.muted(`${r.attempts} attempt${r.attempts === 1 ? "" : "s"}`) +
        `   ${ui.c.accent}${ui.sym.arrow} ${r.branch}${ui.c.reset}\n`
    );
    const sub = (t: string | undefined) => process.stdout.write(`       ${t}\n`);
    if (r.result === "blocked") {
      // Nothing ran, so there is no gate output to show — only the reason.
      sub(r.error);
      continue;
    }
    if (r.result !== "pass" && r.error) {
      // The full gate output — the test failure that explains *why* — was
      // captured and then thrown away here, leaving "Gate failed at: test
      // command" and nothing to act on. With the worktree removed by default,
      // that made a failed run undiagnosable. Show the tail, where runners put
      // the actual failure, and name the two flags that give more.
      const lines = String(r.error).split("\n");
      const head = lines[0];
      const tail = lines
        .slice(1)
        .filter((l) => l.trim() !== "")
        .slice(-FAILURE_TAIL_LINES);
      sub(head);
      for (const line of tail) sub(`${ui.muted(ui.sym.pipe)} ${line}`);
      if (tail.length > 0) {
        sub(ui.muted(`${ui.sym.corner} full output: --format json · reproduce: --keep-worktrees`));
      }
      if (r.workPreserved) {
        sub(ui.muted(`↳ the attempt is committed on ${r.branch} — review it`));
      } else if (r.result === "fail") {
        sub(ui.muted("↳ the agent produced no files"));
      }
    }
    if (r.pushed) {
      sub(
        ui.muted(
          `pushed${r.prCreated ? ` · PR created${r.prOutput ? `: ${r.prOutput}` : ""}` : ""}`
        )
      );
    }
    if (r.publishError) {
      sub(`${ui.c.warn}publish issue:${ui.c.reset} ${String(r.publishError).split("\n")[0]}`);
    }
  }
  const pass = results.filter((r) => r.result === "pass").length;
  const fail = results.filter((r) => r.result === "fail").length;
  const skip = results.filter((r) => r.result === "skipped").length;
  const blocked = results.filter((r) => r.result === "blocked").length;
  // Blocked is counted apart from failed on purpose: one broken predecessor
  // used to produce N failures and N wasted agent invocations, which said
  // nothing about the N-1 requirements that were never attempted.
  const blockedNote = blocked > 0 ? ` · ${blocked} blocked` : "";
  process.stdout.write(
    `\n  ${ui.progress(pass, results.length, "passed")}` +
      ui.muted(`   ${pass} passed · ${fail} failed · ${skip} skipped${blockedNote}`) +
      "\n"
  );
  if (recorded) {
    process.stdout.write(
      `  ${ui.muted(`Run recorded in ${recorded} — specgate harness report sums them up`)}\n`
    );
  }
  if (pass > 0) {
    // `pass > 0`, so there is one.
    const first = results.find((r) => r.result === "pass")!;
    process.stdout.write(
      ui.next(
        `git diff HEAD...${first.branch}`,
        "review and merge the harness/* branches you trust"
      )
    );
  } else {
    process.stdout.write("\n");
  }
}

/**
 * Run one level.
 *
 * At concurrency 1 this is the loop the harness has always had: one
 * requirement, in this process, synchronously. Above 1 each requirement is
 * handed to a worker process running this same script with `--req`, because
 * every step inside `processRequirement` is a blocking `spawnSync` and there
 * is no way to interleave two of them in one process without rewriting all of
 * it.
 *
 * The worker is not a reduced version of the real thing: it *is* `harness run`
 * scoped to one requirement, so a parallel run and a serial run execute the
 * same code.
 */
const dispatchLevel: LevelRunner = async (runnable, byId, hintByReq, ctx, concurrency) => {
  if (concurrency <= 1) {
    const results: RequirementResult[] = [];
    for (const id of runnable) {
      // Asked before each one, not once for the level. Independent
      // requirements all land in a single level — the common case — so a
      // ceiling checked only between levels never fires. Measured: a
      // `--budget-seconds 2` run of three 3-second agents ran all three.
      if (ctx.mayStart && !ctx.mayStart()) {
        results.push(notAttempted(byId.get(id), id, ctx.stopReason!()));
        continue;
      }
      // Every id in a level comes from the queue `byId` was built from.
      results.push(
        processRequirement(byId.get(id)!, {
          ...ctx,
          baseRef: ctx.baseFor ? ctx.baseFor(id) : ctx.baseRef,
          hint: hintByReq.get(id),
        })
      );
    }
    return results;
  }
  return runWorkers(runnable, byId, ctx, concurrency);
};

/**
 * `--chain` (ADR-0036): the one place the harness merges, and only on request.
 *
 * Each requirement is cut from the head the previous merge produced, so it
 * builds on everything before it. A green one is merged into the branch the
 * run started on with a merge commit — one revertible commit per requirement,
 * its prompt archive left on its own branch — and the gate runs again on the
 * merged result: green alone is not green together. A red result is undone,
 * and the chain stops at the first requirement that does not pass.
 */
async function runChain(
  pending: HarnessRequirement[],
  ctx: RunContext,
  hintByReq: Map<string, string>
): Promise<RequirementResult[]> {
  const projectDir = ctx.projectDir;
  const results: RequirementResult[] = [];
  for (let i = 0; i < pending.length; i += 1) {
    const req = pending[i];
    const stop = (reason: string) => {
      for (const rest of pending.slice(i + 1)) {
        results.push(notAttempted(rest, rest.requirement, reason));
      }
    };
    // REQ-209: a stop asked while the last requirement ran starts no other.
    if (i > 0 && takeStop(projectDir)) {
      for (const rest of pending.slice(i)) {
        results.push(notAttempted(rest, rest.requirement, "a stop was asked"));
      }
      info(`stopped as asked: ${pending.length - i} requirement(s) not attempted`);
      break;
    }
    const [result] = await runLevels([req], ctx, {
      concurrency: 1,
      hintByReq,
      runOne: dispatchLevel,
    });
    results.push(result);
    if (!result || result.result !== "pass") {
      stop(`the chain stopped at ${req.requirement}`);
      break;
    }

    const branch = `harness/${req.requirement}`;
    const merge = git(projectDir, ["merge", "--no-ff", "--no-commit", branch]);
    if (merge.status !== 0) {
      const unresolved = resolveGeneratedConflicts(projectDir);
      if (unresolved.length > 0) {
        git(projectDir, ["merge", "--abort"]);
        Object.assign(result, {
          result: "fail",
          error: `merge into the chain's branch conflicted in: ${unresolved.join(", ")}`,
        });
        stop(`the chain stopped at ${req.requirement}`);
        break;
      }
    }
    // The prompts stay on the requirement's branch, for review and --resume;
    // they never reach the branch the chain merges into.
    const prompts = git(projectDir, [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=A",
      "HEAD",
      "--",
      PROMPT_ARCHIVE_DIR,
    ])
      .stdout.split("\n")
      .filter(Boolean);
    if (prompts.length > 0) {
      git(projectDir, ["rm", "-q", "--cached", "--", ...prompts]);
      for (const f of prompts) fs.rmSync(path.join(projectDir, f), { force: true });
    }
    const title = String(req.title || req.use_case || req.useCase || "").replace(/^UC-\d+\s*/, "");
    const mergeKey = ticketKeyOf(projectDir, req.requirement);
    git(projectDir, [
      "commit",
      "-q",
      "-m",
      `${mergeKey ? `${mergeKey} ` : ""}Merge ${branch}${title ? ` — ${title}` : ""}\n\n` +
        `Merged by \`specgate harness run --chain\` after its gate passed on ${branch}.`,
    ]);

    const eventsFile = eventsFileFor(projectDir, req.requirement);
    const attempt = Number(result.attempts) || undefined;
    appendEvent(eventsFile, { type: "merge", into: "HEAD", branch }, req.requirement, attempt);
    const gate = runGate(
      projectDir,
      ctx.settings.testCmd,
      ctx.timeoutMs,
      req,
      // The checks judged the branch already; the post-merge gate is the suite's.
      { ...ctx.settings, quality: undefined },
      (stage, res, extra) =>
        appendEvent(
          eventsFile,
          { type: "gate", stage: `post-merge ${stage}`, result: res, ...(extra || {}) },
          req.requirement,
          attempt
        )
    );
    if (!gate.ok) {
      git(projectDir, ["reset", "-q", "--hard", "HEAD~1"]);
      Object.assign(result, {
        result: "fail",
        error: `post-merge gate: ${gate.stage}\n${String(gate.output || "").slice(-4000)}`,
      });
      warn(
        `${req.requirement}: green on ${branch}, red once merged — the merge was undone. ` +
          `This gate runs in the working copy: tests or a server started there by hand ` +
          `while the harness runs can break it.`
      );
      stop(`the chain stopped at ${req.requirement}`);
      break;
    }
    // The gate may regenerate the matrix: it belongs to the merge commit.
    if (!isGitClean(projectDir)) {
      git(projectDir, ["add", "-A"]);
      git(projectDir, ["commit", "-q", "--amend", "--no-edit"]);
    }
    info(`${req.requirement}: merged into the chain's branch, gate green`);
  }
  return results;
}

/** A requirement the budget never let start. Not a failure — it was not tried. */
function notAttempted(
  req: HarnessRequirement | null | undefined,
  id: string,
  reason: string
): RequirementResult {
  return {
    requirement: id,
    category: req ? req.category : "",
    result: "skipped",
    attempts: 0,
    branch: `harness/${id}`,
    error: `Not attempted: ${reason}`,
  };
}

/**
 * Run requirements in parallel worker processes, at most `concurrency` at a
 * time, and collect their reports.
 *
 * Each worker prints a one-requirement JSON report; the parent parses it. A
 * worker that dies without printing one is reported as a failure carrying its
 * output, rather than vanishing from the run.
 */
function runWorkers(
  runnable: string[],
  byId: Map<string, HarnessRequirement> | null,
  ctx: RunContext,
  concurrency: number
): Promise<RequirementResult[]> {
  return new Promise((resolve) => {
    const results: RequirementResult[] = [];
    const queue = [...runnable];
    const running = new Map<string, ChildProcess>();

    const fill = () => {
      while (running.size < concurrency && queue.length > 0) {
        const id = queue.shift()!;
        // Same question as the sequential path: a worker already in flight is
        // never interrupted, but the next one need not be started.
        if (ctx.mayStart && !ctx.mayStart()) {
          results.push(notAttempted(byId ? byId.get(id) : null, id, ctx.stopReason!()));
          continue;
        }
        const child = spawn(process.execPath, [WORKER_ENTRY, ...workerArgs(id, ctx)], {
          env: { ...process.env, SPECGATE_HARNESS_WORKER: "1" },
        });

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => {
          stdout += d;
        });
        // A worker's prose goes straight through, so a long run is not silent.
        // Its JSON report is the only thing the parent parses.
        child.stderr.on("data", (d) => {
          stderr += d;
          process.stderr.write(d);
        });

        running.set(id, child);
        info(`${id}: started (${running.size}/${concurrency} in flight)`);

        child.on("close", () => {
          running.delete(id);
          results.push(parseWorkerReport(id, stdout, stderr));
          if (queue.length === 0 && running.size === 0) resolve(results);
          else fill();
        });
      }
    };

    fill();
    if (running.size === 0) resolve(results);
  });
}

/**
 * The argv a worker gets: this same command, scoped to one requirement and
 * pinned to concurrency 1 so a worker never spawns workers of its own.
 *
 * Settings are passed explicitly rather than left to the worker's own read of
 * `harness.config.yaml`, so a profile resolved once in the parent cannot
 * resolve differently in a child.
 */
function workerArgs(id: string, ctx: RunContext): string[] {
  return [
    "--req",
    id,
    "--project-dir",
    ctx.projectDir,
    "--format",
    "json",
    "--concurrency",
    "1",
    "--base-branch",
    ctx.baseFor ? ctx.baseFor(id) : ctx.baseRef,
    "--timeout",
    String(ctx.timeoutSeconds),
    "--max-attempts",
    String(ctx.settings.maxAttempts),
    "--setup-cmd",
    ctx.settings.setupCmd || "none",
    ...(ctx.force ? ["--force"] : []),
    ...(ctx.keepWorktrees ? ["--keep-worktrees"] : []),
    ...(ctx.settings.agent ? ["--agent", ctx.settings.agent] : []),
    ...(ctx.settings.testCmd ? ["--test-cmd", ctx.settings.testCmd] : []),
  ];
}

/** A worker's report, or an honest failure describing why there is none. */
function parseWorkerReport(id: string, stdout: string, stderr: string): RequirementResult {
  try {
    const parsed = JSON.parse(stdout) as { results?: RequirementResult[] };
    const one = (parsed.results || []).find((r) => r.requirement === id);
    if (one) return one;
  } catch {
    // fall through
  }
  return {
    requirement: id,
    category: "",
    result: "fail",
    attempts: 0,
    branch: `harness/${id}`,
    error: `Worker produced no report.\n${(stderr || stdout || "").slice(-2000)}`,
  };
}

/**
 * Run the queue level by level.
 *
 * **Why concurrency 1 stays on the in-process path.** Every step of a
 * requirement — the gate, the agent, `done`, git — is a `spawnSync`, and
 * §12.11 of the closure plan is a list of eleven defects that only appeared
 * when this loop ran against a real agent. Converting all of it to async so
 * that one requirement could run "in parallel" with nothing would put the one
 * path that has actually been exercised behind an untested rewrite. So the
 * default path is the path it has always been, and only `--concurrency > 1`
 * dispatches through worker processes.
 *
 * **Why a failure blocks rather than fails.** Without dependencies expressed,
 * `harness run` processed the matrix in order and a broken predecessor made
 * every successor fail too — N failures for one cause, and N wasted agent
 * invocations. A requirement whose dependency failed has not been attempted;
 * calling that a failure would be a lie in the report.
 */
export async function runLevels(
  pending: HarnessRequirement[],
  ctx: RunContext,
  opts: { concurrency: number; hintByReq: Map<string, string>; runOne: LevelRunner }
): Promise<RequirementResult[]> {
  const { concurrency, hintByReq, runOne } = opts;
  /**
   * The run's ceiling (C1). Checked before starting a level, never inside one:
   * interrupting an attempt mid-flight would throw away the money already spent
   * on it and leave a worktree nobody asked for. A budget bounds what a run
   * *begins*.
   */
  const limits = {
    budgetSeconds: ctx.budgetSeconds || 0,
    maxRequirements: ctx.maxRequirements || 0,
  };
  const budgetStartedAt = Date.now();
  let started = 0;
  // Asserted rather than annotated: it is assigned inside `mayStart`, and an
  // annotated `null` would stay narrowed to `null` everywhere below.
  let stoppedBy = null as BudgetVerdict | null;
  const schedule = scheduleLevels(pending);
  const { levels, cycles, graph } = schedule;
  // REQ → the requirements in this run it waits for. Core builds it as a plain
  // object and does not declare its shape.
  const dependsOn: Record<string, string[]> = schedule.dependsOn;
  const byId = new Map<string, HarnessRequirement>(pending.map((r) => [r.requirement, r]));

  if (cycles.length > 0) {
    // `validate` is the gate that reports the cycle properly. Here we only
    // have to refuse to loop forever, and say which requirements are stuck.
    for (const cycle of cycles) {
      warn(`Dependency cycle, not attempted: ${[...cycle, cycle[0]].join(" → ")}`);
    }
  }

  const results: RequirementResult[] = [];
  const blocked = new Set<string>();
  /** REQ → the branch its work landed on, for the requirements that follow it. */
  const passedBranches = new Map<string, string>();

  for (const level of levels) {
    const runnable = level.filter((id) => !blocked.has(id));

    for (const id of level) {
      if (!blocked.has(id)) continue;
      const req = byId.get(id);
      results.push({
        requirement: id,
        category: req ? req.category : "",
        result: "blocked",
        attempts: 0,
        branch: `harness/${id}`,
        error: `Not attempted: ${(dependsOn[id] || []).filter((d) => blocked.has(d) || results.some((r) => r.requirement === d && r.result !== "pass")).join(", ")} did not pass.`,
      });
    }

    if (runnable.length === 0) continue;

    // A requirement is cut from its dependencies' branches, not from the run's
    // base: that is where the code it builds on exists during a run.
    const derivationFailures = new Map<string, string>();
    const baseFor = (id: string): string => {
      const derived = deriveBase(ctx.projectDir, id, dependsOn[id] || [], passedBranches, ctx);
      if ("error" in derived) {
        derivationFailures.set(id, derived.error);
        return ctx.baseRef;
      }
      return derived.base;
    };

    const bases = new Map(runnable.map((id) => [id, baseFor(id)]));
    const attemptable = runnable.filter((id) => !derivationFailures.has(id));

    for (const [id, reason] of derivationFailures) {
      const req = byId.get(id);
      results.push({
        requirement: id,
        category: req ? req.category : "",
        result: "blocked",
        attempts: 0,
        branch: `harness/${id}`,
        error: `Not attempted: could not assemble its base. ${reason}`,
      });
      for (const dependent of graph.transitiveDependents(id)) blocked.add(dependent);
    }

    if (attemptable.length === 0) continue;

    if (stoppedBy) break;
    // The ceiling bites *inside* the level, through `mayStart` below —
    // independent requirements all land in one level, which is the common
    // case, so a check that only ran between levels would let a run of
    // fourteen sail past `--max-requirements 2`. Measured: it did exactly
    // that, and again with `--budget-seconds`.
    const levelResults = await runOne(
      attemptable,
      byId,
      hintByReq,
      {
        ...ctx,
        // Only `attemptable` ids reach the runner, and each has a base.
        baseFor: (id) => bases.get(id)!,
        // The level asks before starting each requirement. `started` counts
        // what was actually begun, so the count ceiling and the clock agree.
        mayStart: () => {
          if (stoppedBy) return false;
          // REQ-209: a stop asked while a requirement ran starts no other.
          if (started > 0 && takeStop(ctx.projectDir)) {
            stoppedBy = { stop: true, code: "stop_asked", reason: "a stop was asked" };
            return false;
          }
          const verdict = budgetVerdict(
            limits,
            { startedAt: budgetStartedAt, started },
            Date.now()
          );
          if (verdict.stop) {
            stoppedBy = verdict;
            return false;
          }
          started += 1;
          return true;
        },
        stopReason: () => (stoppedBy ? stoppedBy.reason : ""),
      },
      concurrency
    );
    results.push(...levelResults);

    for (const r of levelResults) {
      if (r.result === "pass") passedBranches.set(r.requirement, r.branch);
    }

    for (const r of levelResults) {
      if (r.result !== "pass") {
        for (const dependent of graph.transitiveDependents(r.requirement)) {
          blocked.add(dependent);
        }
      }
    }
  }

  // Once the budget is spent, later levels are not even walked: their
  // requirements are named as not attempted, with the same reason.
  if (stoppedBy) {
    for (const level of levels) {
      for (const id of level) {
        if (results.some((r) => r.requirement === id)) continue;
        results.push(notAttempted(byId.get(id), id, stoppedBy.reason));
      }
    }
  }

  // Requirements caught in a cycle never reach a level. Report them rather
  // than dropping them from the run.
  for (const cycle of cycles) {
    for (const id of cycle) {
      if (results.some((r) => r.requirement === id)) continue;
      const req = byId.get(id);
      results.push({
        requirement: id,
        category: req ? req.category : "",
        result: "blocked",
        attempts: 0,
        branch: `harness/${id}`,
        error: `Not attempted: caught in a dependency cycle (${cycle.join(" → ")}). Run \`specgate validate\` for the fix.`,
      });
    }
  }

  return results;
}

export class RunCommand extends BaseCommand {
  public async execute() {
    try {
      const args = parseArgs(this.args);
      setJsonMode(args.format === "json");
      const projectDir = resolveProjectDir(args.projectDir, { requireSentinel: true });

      // REQ-211: a profile chosen for this run is its agent, ahead of the file's.
      if (args.profile && !args.agent) args.agent = resolveProfileAgent(projectDir, args.profile);
      const fileConfig = readHarnessConfig(projectDir);
      const settings = resolveHarnessSettings(fileConfig, args);
      // A fresh worktree has no dependencies. Unless told, install what the
      // lockfile pins (ADR-0036); `--setup-cmd none` runs nothing.
      if (settings.setupCmd === "none") settings.setupCmd = "";
      else if (!settings.setupCmd) settings.setupCmd = detectSetupCommand(projectDir);

      // D1: profile match rules live in `.harness/profiles.yaml`, and a project
      // may declare profiles without ever writing a `harness.config.yaml`.
      // Reaching them through the config reader made them silently absent
      // there — the same gap the cost hints had, found the same way.
      if (settings.profileRules.length === 0 && !args.profile) {
        const rules = readProfileRules(projectDir);
        if (rules.length > 0) {
          settings.profileRules = rules;
          settings.profileAgents = { ...settings.profileAgents };
          for (const rule of rules) {
            if (!settings.profileAgents[rule.name]) {
              settings.profileAgents[rule.name] = resolveProfileAgent(projectDir, rule.name);
            }
          }
        }
      }

      // A ladder of per-attempt profiles configures agents just as much as a
      // single `agent:` does, so a project that declares one is configured.
      const hasAgent = Boolean(settings.agent) || settings.attemptProfiles.length > 0;
      if (!args.dryRun && !hasAgent) {
        throw new Error(
          'No agent configured. Pass --agent "<cmd with {prompt_file}>", set `agent:` ' +
            "in harness.config.yaml, or declare `attempt_profiles:`."
        );
      }

      const plan = runPlan(projectDir);
      // The plan has a row per scenario; the harness works per requirement.
      // A requirement with two scenarios was processed twice — two agent
      // sessions, paid twice, both on branch harness/REQ-NNN. The prompt carries
      // every scenario of the requirement, so one run per requirement is enough.
      const firstRow = new Set<string>();
      let pending = (plan.requirements || []).filter((r) => {
        if (r.category === "DONE" || firstRow.has(r.requirement)) return false;
        firstRow.add(r.requirement);
        return true;
      });
      if (args.reqs.length > 0) {
        const wanted = new Set(args.reqs);
        // In the order given (REQ-185): the plan's order reshuffled a chain silently.
        pending = orderAsGiven(
          pending.filter((r) => wanted.has(r.requirement)),
          args.reqs
        );
        const found = new Set(pending.map((r) => r.requirement));
        for (const want of args.reqs) {
          if (!found.has(want)) warn(`${want} is not a pending requirement — skipped.`);
        }
      }

      if (pending.length === 0) {
        if (jsonMode) info("No pending requirements. Nothing to do.");
        else
          process.stdout.write(
            ui.header("harness run") + ui.ok("No pending requirements. Nothing to do.") + "\n"
          );
        process.exit(0);
      }

      const hintByReq = new Map((plan.next_steps || []).map((s) => [s.requirement, s.hint]));

      if (args.dryRun) {
        process.stdout.write(
          ui.header(
            "harness run",
            `dry run · ${pending.length} requirement(s) would be processed`
          ) +
            (settings.agent ? ui.kv("Agent", settings.agent, 14) : "") +
            ui.kv("Setup", settings.setupCmd || "none", 14) +
            (args.chain ? ui.kv("Chain", "each green requirement merged into this branch", 14) : "")
        );
        for (const req of pending) {
          const prompt = judged(projectDir, (dir) =>
            buildPrompt(req, dir, {
              promptPrefix: settings.promptPrefix,
              hint: hintByReq.get(req.requirement) as string | undefined,
              withPrecedents: settings.promptPrecedents === true,
            })
          );
          process.stdout.write(
            "\n" +
              ui.section(
                `${req.requirement} · ${req.category} → branch harness/${req.requirement}`
              ) +
              "\n"
          );
          process.stdout.write(prompt + "\n");
        }
        process.exit(0);
      }

      if (!isGitClean(projectDir)) {
        throw new Error(
          "Working tree is not clean. Commit or stash your changes before running the harness."
        );
      }

      // Git needs to know who is committing, and the harness commits — once per
      // green requirement, and again to preserve a failed attempt. Without an
      // identity it discovers this *after* the agent has run and the gate has
      // passed, so a full attempt is paid for and thrown away by a one-line
      // config. Found by CI, which has no global git identity and produced
      // `Author identity unknown` at the commit step of every requirement.
      const identity = gitIdentityProblem(projectDir);
      if (identity) throw new Error(identity);
      if (args.chain) {
        if (args.baseBranch) {
          throw new Error(
            "--chain merges into the branch you are on: check that branch out instead of --base-branch."
          );
        }
        const current = git(projectDir, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
        if (!current || current === "HEAD") {
          throw new Error("--chain needs a branch to merge into; HEAD is detached.");
        }
      }

      // REQ-175: the gate judges the whole project, so a base it already fails
      // fails every attempt, whatever the agent does for its requirement. Said
      // once, here, rather than after three paid attempts per requirement.
      // Only for the branch you are on: --base-branch names a ref this checkout
      // does not hold, and a worker has already been through it in its parent.
      if (!args.skipBaseline && !args.baseBranch && !process.env.SPECGATE_HARNESS_WORKER) {
        // The ids the run owns: its requirements and their scenarios.
        const running = new Set<string>();
        const inRun = new Set(pending.map((r) => r.requirement));
        for (const row of plan.requirements || []) {
          if (!inRun.has(row.requirement)) continue;
          running.add(row.requirement);
          const scn = row.scenarioId || row.scenario_id;
          if (scn) running.add(String(scn));
        }
        const red = baselineProblem(projectDir, running);
        if (red) throw new Error(red);
      }

      const baseRef = args.baseBranch || "HEAD";
      const concurrencyNote =
        settings.concurrency > 1 ? `, up to ${settings.concurrency} at a time` : "";
      if (jsonMode || process.env.SPECGATE_HARNESS_WORKER) {
        info(`Processing ${pending.length} requirement(s) from base ${baseRef}${concurrencyNote}.`);
      } else {
        process.stdout.write(
          ui.header(
            "harness run",
            `${pending.length} requirement(s) from ${baseRef}${concurrencyNote}`
          )
        );
      }

      // One prune, in the parent, before anything is created. It used to run per
      // requirement, which is harmless in series and a race in parallel:
      // `git worktree prune` running while a sibling is inside
      // `git worktree add` can remove the record of the worktree being created.
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        git(projectDir, ["worktree", "prune"]);
      }

      const ctx = {
        projectDir,
        baseRef,
        settings,
        timeoutMs: args.timeout * 1000,
        timeoutSeconds: args.timeout,
        keepWorktrees: args.keepWorktrees,
        force: args.force,
        resume: args.resume,
        skipNotReady: args.skipNotReady,
        budgetSeconds: args.budgetSeconds,
        maxRequirements: args.maxRequirements,
        strictArtifacts: args.strictArtifacts,
        verbose: args.verbose,
      };

      // One run per working copy (REQ-186): the post-merge gate runs in it.
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        const release = acquireRunLock(
          projectDir,
          pending.map((r) => r.requirement)
        );
        if (!release) {
          const holder = runLockHolder(projectDir);
          throw new Error(
            `Another harness run (pid ${holder ? holder.pid : "?"}) is working in this project` +
              (holder ? ` on ${holder.reqs.join(", ")}` : "") +
              `. Wait for it to finish: its post-merge gate runs in this working copy.`
          );
        }
        // A stop left from an earlier run is not this run's (REQ-209).
        takeStop(projectDir);
      }

      // What the live view lists as up next (REQ-182).
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        writeQueue(
          projectDir,
          pending.map((r) => r.requirement)
        );
      }

      const startedAt = new Date().toISOString();
      const results = args.chain
        ? await runChain(pending, ctx, hintByReq)
        : await runLevels(pending, ctx, {
            concurrency: settings.concurrency,
            hintByReq,
            runOne: dispatchLevel,
          });
      // What the agents asked goes into the project, once the run is done (REQ-189).
      if (!process.env.SPECGATE_HARNESS_WORKER) recordQuestions(projectDir, results);

      // Only the run that a person started writes a record. A worker is one
      // slice of that run, and its own record would be a second copy of the
      // same requirement — `harness report` reads every file in the directory,
      // so duplicates land straight in "cost per delivered REQ".
      const recordPath = process.env.SPECGATE_HARNESS_WORKER
        ? null
        : writeRunRecord(projectDir, {
            schemaVersion: 1,
            startedAt,
            finishedAt: new Date().toISOString(),
            baseRef,
            concurrency: settings.concurrency,
            maxAttempts: settings.maxAttempts,
            // Whether this run had a ceiling at all. Reading the ledger later,
            // a short run is a different thing depending on the answer.
            bounded: hasBudget({
              budgetSeconds: args.budgetSeconds,
              maxRequirements: args.maxRequirements,
            }),
            results,
          });

      printReport(
        results,
        args.format,
        recordPath ? path.relative(projectDir, recordPath) : undefined
      );

      // A blocked requirement was never attempted, so it is not a pass — but it
      // is also not evidence that anything is broken beyond the failure that
      // caused it. It still fails the run, because work was left undone.
      const failed = results.filter((r) => r.result !== "pass").length;
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      const thrown = err as { message?: string };
      let isJson = false;
      try {
        isJson = parseArgs(this.args).format === "json";
      } catch {
        /* ignore */
      }
      const io = agentIo(isJson);
      return io.fail({ results: null }, [
        { severity: "error", code: "harness_run_error", message: thrown.message || String(err) },
      ]);
    }
  }
}
