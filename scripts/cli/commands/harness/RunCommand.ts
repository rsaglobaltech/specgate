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

import { inBuildOrder, modulePlaces } from "../../../lib/build-order";
import { stackFileCommand } from "../../../lib/stack-detect";
import {
  DECISION_RIGHTS_FILE,
  decisionsExceeded,
  parseDecisionRights,
} from "../../../../packages/core/src/domain/DecisionRights";
import { quoteArg } from "../../../lib/escape";
import { harnessCommitMessage } from "../../../lib/ticket-keys";
import {
  HarnessInterrupted,
  runWithDeadline,
  wasInterrupted,
} from "../../../lib/run-with-deadline";
import { derivedMatrixFor } from "../spec/MatrixCommand";
import { isDerivedProject } from "../../../lib/derived-writes";
import * as ui from "../../../lib/ui";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { resolveProjectDir } from "../../../lib/project-root";
import { buildPrompt } from "../../../harness/prompt";
import { withAgentPermission } from "../../../lib/agent-permission";
import { detectSetupCommand } from "../../../harness/init";
import { inFlightRequirements } from "../../../lib/in-flight";
import { missingApprovals } from "../../../lib/approvals";
import { citedOperation, conformanceWarnings, memberCitations } from "../../../lib/contracts";
import { workspaceMemberDirs } from "../../../lib/story-part";
import { packagesFor } from "../../../lib/role-packages";
import {
  appendEvent,
  eventsFileFor,
  eventsLineCount,
  eventsLinesSince,
  keepPrompt,
  writeQueue,
} from "../../../lib/harness-events";
import { onScreen } from "../../../lib/screen-requirements";
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
  waitAtPause,
} from "../../../lib/harness-guard";
import { dockerWhyNot } from "../../../lib/quality-run";
import { dockerNeed } from "../../../lib/harness-environment";
import { isTestFile } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";
import type { HarnessRole } from "../../../../packages/core/src/domain/HarnessRun";
import {
  EVENTS_ATTEMPT_VAR,
  EVENTS_FILE_VAR,
  EVENTS_REQ_VAR,
  maskCommand,
  secretNames,
} from "../../../../packages/core/src/domain/HarnessEvents";
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
  onlyTaskTicksChanged,
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
  AttemptRecord,
  StepUsage,
  stepUsage,
  fallbackAttempt,
  AttemptStep,
  featureFilePath,
  planAttempt,
  scheduleLevels,
} from "../../../../packages/core/src/domain/HarnessRun";
import { cacheEnvironment } from "../../../../packages/core/src/domain/DependencyCache";
import { exportRunTrace } from "../../../lib/otel-export";
import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";
import { removeTempFile } from "../../../lib/temp-file";
import { setStream, streamEvent, streamFdOf, streamFromEnv } from "../../../lib/harness-stream";
import { recordQuestion } from "../../../lib/agent-watch";
import {
  scrubText,
  judged,
  promptInFlight,
  HarnessRequirement,
  RunContext,
  RequirementResult,
  WaitingForAnswer,
  PLAN_SCRIPT,
  DONE_SCRIPT,
  VALIDATE_SCRIPT,
  setJsonMode,
  isJsonMode,
  info,
  warn,
  error,
  git,
  isGitClean,
  SUBPROCESS_MAX_BUFFER,
  resolveGeneratedConflicts,
  PublishOutcome,
  STOP_ASKED,
  notAttempted,
  unattempted,
} from "../../../harness/run/shared";
import {
  addRunSpentUsd,
  agentWroteInThisRun,
  currentLedger,
  ledgerWrite,
  ledgerAttempts,
  markAgentWrote,
  notePackagesUsed,
  packagesUsedBy,
  runSpentUsdSoFar,
  setLedger,
  writeRunRecord,
  streamResult,
} from "../../../harness/run/state";
import {
  limitFor,
  agentLine,
  gateReporter,
  runGate,
  discardWorktreeChanges,
  runAdversarialProbe,
} from "../../../harness/run/gate";
import { runWorkers, workerCommandsFromEnv } from "../../../harness/run/workers";
import { runChain } from "../../../harness/run/chain";

// What this module exported before the gate, the workers and the chain moved
// out of it: tests and `scripts/harness/run.ts` import them from here.
export {
  scrubText,
  promptInFlight,
  HarnessRequirement,
  RequirementResult,
  WaitingForAnswer,
  setJsonMode,
  error,
} from "../../../harness/run/shared";
export { resetAgentWrote, RUNS_DIR, RunRecord } from "../../../harness/run/state";
export { limitFor, projectOf } from "../../../harness/run/gate";
export { workerCommandsFromEnv, workerCommands, workerArgs } from "../../../harness/run/workers";

/** The part of `plan --format json` the harness reads. */
interface PlanDocument {
  requirements?: HarnessRequirement[];
  next_steps?: Array<{ requirement: string; hint: string }>;
}

/** Where a resumed requirement picks up, and what the gate said last time. */
interface ResumeAt {
  attempt: number;
  previousFailure: string;
}

/** The context of one requirement's attempts, inside its worktree. */
interface AttemptContext extends RunContext {
  worktreeDir: string;
  resumeAt: ResumeAt | null;
  matchedProfile: string | null;
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
  | "waitingForAnswer"
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
      "  --allow-dirty          Run on a working tree with uncommitted or untracked files:\n" +
      "                         every branch is cut from the last commit and those files\n" +
      "                         stay as they are here. The JSON says which (`dirty`).\n" +
      "                         Not with --chain, which merges into this working copy.\n" +
      "  --format <text|json|jsonl>\n" +
      "                         Report format (default text). jsonl streams one JSON\n" +
      "                         event per line on stdout while the run goes, ending\n" +
      "                         with `run-end` (docs/harness-control.md).\n" +
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
      "  --pause-between-attempts\n" +
      "                         After a failed attempt, wait for `specgate harness continue`\n" +
      "                         before the next one.\n" +
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
    pauseBetweenAttempts: false,
    skipBaseline: false,
    budgetSeconds: 0,
    maxRequirements: 0,
    push: false,
    remote: "",
    prCmd: "",
    setupCmd: "",
    chain: false,
    profile: "",
    allowDirty: false,
    /** The profile `--profile` resolved `agent` from (REQ-509). */
    agentProfile: "",
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
    } else if (token === "--allow-dirty") {
      args.allowDirty = true;
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
    } else if (token === "--pause-between-attempts") {
      args.pauseBetweenAttempts = true;
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
  if (!["text", "json", "jsonl"].includes(args.format)) {
    throw new Error(`Invalid --format: ${args.format}. Expected: text | json | jsonl.`);
  }
  // REQ-490: --chain merges into the working copy, where the uncommitted files are.
  if (args.allowDirty && args.chain) {
    throw new Error(
      "--allow-dirty cannot go with --chain: --chain merges each green requirement into " +
        "this working copy, where the uncommitted files are. Commit or stash them, or run " +
        "without --chain."
    );
  }
  if (args.dryRun && args.format === "jsonl") {
    throw new Error("--dry-run prints the prompts; it has no stream. Drop --format jsonl.");
  }
  return args;
}

/**
 * The paths `git status` shows: changed, staged, deleted or untracked — what a
 * run cut from the last commit leaves out (REQ-490). Sorted, `/`-separated.
 */
function uncommittedPaths(projectDir: string): string[] {
  const r = git(projectDir, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (r.status !== 0) {
    throw new Error(`git status failed: ${r.stderr || r.stdout}`);
  }
  const out: string[] = [];
  const entries = String(r.stdout).split("\0");
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    out.push(entry.slice(3));
    // A rename or copy carries its old path as the next entry: left out too.
    if (entry[0] === "R" || entry[0] === "C") {
      if (entries[i + 1]) out.push(entries[i + 1]);
      i += 1;
    }
  }
  return [...new Set(out)].sort();
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

/**
 * What the base already fails that no attempt in this run can fix, or null.
 * The gate judges the whole project, and a requirement past Draft with no test
 * (TDD-1, TDD-2) is one the agent may not touch: its status is in the
 * specification, and the agent works on another requirement. Findings about
 * the requirements being run are theirs to fix (a missing feature, say), and
 * do not count here.
 */
export function baselineProblem(projectDir: string, running: Set<string>): string | null {
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
      // REQ-582: committed and pushed with the branch — scrubbed of secrets.
      scrubText(prompt),
      "utf8"
    );
  } catch {
    /* never fail the run on an audit-log write */
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

/** REQ-375: a change's tasks.md whose tasks only changed their box. */
function isTaskTickOnlyEdit(worktreeDir: string, rel: string): boolean {
  if (!/(^|\/)docs\/specs\/changes\/[^/]+\/tasks\.md$/.test(rel.split(path.sep).join("/")))
    return false;
  const d = git(worktreeDir, ["diff", "-U0", "HEAD", "--", rel]);
  return d.status === 0 && onlyTaskTicksChanged(d.stdout || "");
}

function checkWriteScopeInWorktree(worktreeDir: string, settings: HarnessSettings) {
  const all = worktreeChanges(worktreeDir);
  if (!all) return null;
  const changes = {
    ...all,
    modified: all.modified.filter(
      (p) =>
        !isRegeneratedMatrix(worktreeDir, p) &&
        !isStatusOnlyEdit(worktreeDir, p) &&
        !isTaskTickOnlyEdit(worktreeDir, p)
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
 * REQ-547: a decision the project keeps for a person — a dependency, a
 * migration, a public API operation — taken by the agent anyway. Read from the
 * diff against the attempt's base; the rights file is read from the worktree's
 * base too, so an agent cannot grant itself the right (the file is protected).
 */
function checkDecisionRightsInWorktree(worktreeDir: string) {
  const committed = git(worktreeDir, ["show", `HEAD:${DECISION_RIGHTS_FILE}`]);
  if (committed.status !== 0) return null;
  const { rights } = parseDecisionRights(committed.stdout || "");
  if (![...rights.values()].includes("ask")) return null;
  const all = worktreeChanges(worktreeDir);
  if (!all) return null;
  const read = (rel: string) => {
    const full = path.join(worktreeDir, rel);
    return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, "utf8") : null;
  };
  const changes = [
    ...all.modified.map((p) => {
      const before = git(worktreeDir, ["show", `HEAD:${p}`]);
      return { path: p, before: before.status === 0 ? before.stdout : null, after: read(p) };
    }),
    ...all.added.map((p) => ({ path: p, before: null, after: read(p) })),
  ];
  const exceeded = decisionsExceeded(rights, changes);
  if (exceeded.length === 0) return null;
  return {
    exceeded,
    message:
      `decision_right_exceeded — the attempt took ${exceeded.length} decision(s) ` +
      `${DECISION_RIGHTS_FILE} keeps for a person:\n` +
      exceeded.map((e) => `  ${e.decision}: ${e.file} (${e.detail})`).join("\n") +
      `\n\nUndo them and meet the requirement without them. If it cannot be met ` +
      `without one, ask: \`specgate ask <REQ> "<what you need, and why>"\`.`,
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

/** REQ-418: the operations `requirement` cites whose path no source file of the worktree has. */
export function contractNotMet(worktreeDir: string, projectDir: string, requirement: string) {
  const dirOf = workspaceMemberDirs(projectDir);
  // Another repository's operation: the contracts repository cites its own
  // operations unqualified, and serves none of them.
  const cited = memberCitations(worktreeDir).filter(
    (c) => c.requirement === requirement && /^[A-Za-z][A-Za-z0-9-]*:[^#]+#/.test(c.ref)
  );
  if (cited.length === 0) return [];
  return conformanceWarnings(
    worktreeDir,
    "",
    cited,
    (c) => citedOperation(c.ref, dirOf, worktreeDir)?.operation || null,
    () => "Implemented",
    true
  );
}

/**
 * Build manifests either role may change (REQ-533): a tester adds the test
 * runner, an implementer the library it uses. Kept and visible in the diff.
 */
const LANE_FREE =
  /(^|\/)(package\.json|package-lock\.json|pom\.xml|build\.gradle|build\.gradle\.kts)$/;

/** Is this file outside the lane of `role` (REQ-533)? */
export function outsideLane(role: HarnessRole, rel: string): boolean {
  if (rel.startsWith(PROMPT_ARCHIVE_DIR) || LANE_FREE.test(rel)) return false;
  return role === "tester" ? !isTestFile(rel) : isTestFile(rel);
}

/** What the role is told, before the requirement's own prompt (REQ-532). */
function roleInstruction(role: HarnessRole, requirement: string): string {
  return role === "tester"
    ? `You are the **tester** for ${requirement}. Write the failing tests its scenarios call ` +
        `for, each naming ${requirement} and its scenario id, in the project's test style. Write ` +
        "no production code: a separate implementer session makes your tests pass, and any " +
        "file you write outside the tests is reverted."
    : `You are the **implementer** for ${requirement}. The tester has written its tests; make ` +
        "them pass by writing the production code. Do not change any test file: test changes " +
        "are reverted, and a test that is wrong is the tester's to fix on the next attempt.";
}

/**
 * The worktree's uncommitted files of one lane, to put back the ones a session
 * changes outside it (REQ-533). Only what is dirty is kept: a file clean at
 * the start of the session is HEAD's, and git can restore it.
 */
function laneGuard(worktreeDir: string, role: HarnessRole): () => string[] {
  const dirtyNow = () => {
    const c = worktreeChanges(worktreeDir);
    return c ? [...c.modified, ...c.added] : [];
  };
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(worktreeDir, rel));
    } catch {
      return null;
    }
  };
  const before = new Map<string, Buffer | null>();
  for (const rel of dirtyNow()) if (outsideLane(role, rel)) before.set(rel, read(rel));

  return () => {
    const reverted: string[] = [];
    const after = dirtyNow().filter((rel) => outsideLane(role, rel));
    for (const rel of new Set([...after, ...before.keys()])) {
      const now = read(rel);
      const was = before.has(rel) ? before.get(rel)! : undefined;
      if (was !== undefined) {
        if (was === null ? now === null : now !== null && now.equals(was)) continue;
        if (was === null) fs.rmSync(path.join(worktreeDir, rel), { force: true });
        else {
          fs.mkdirSync(path.dirname(path.join(worktreeDir, rel)), { recursive: true });
          fs.writeFileSync(path.join(worktreeDir, rel), was);
        }
      } else if (git(worktreeDir, ["cat-file", "-e", `HEAD:${rel}`]).status === 0) {
        git(worktreeDir, ["checkout", "HEAD", "--", rel]);
      } else {
        fs.rmSync(path.join(worktreeDir, rel), { force: true });
      }
      reverted.push(rel);
    }
    return reverted.sort();
  };
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
  /** An empty attempt was retried once already (REQ-417). */
  let retriedEmpty = false;
  /** REQ-535: what this requirement's sessions have cost, and its ceiling. */
  const maxCost = settings.maxCostUsd || 0;
  /** REQ-585: and the tokens they used, and theirs. */
  const maxTokens = settings.maxTokens || 0;
  let spent = 0;
  let tokens = 0;
  let costUnknownSaid = false;
  const budgetMessage = () =>
    maxTokens > 0 && tokens >= maxTokens
      ? `budget_exceeded — ${req.requirement} used ${tokens} of its ${maxTokens} tokens ` +
        "(max_tokens), so no further session ran."
      : `budget_exceeded — ${req.requirement} spent $${spent.toFixed(2)} of its $${maxCost} ` +
        "budget (max_cost_usd), so no further session ran.";
  const overBudget = () =>
    (maxCost > 0 && spent >= maxCost) || (maxTokens > 0 && tokens >= maxTokens);

  // The live view's file (ADR-0037), in the project, not the worktree.
  const eventsFile = eventsFileFor(ctx.projectDir || worktreeDir, req.requirement);
  for (let attempt = firstAttempt; attempt <= settings.maxAttempts; attempt += 1) {
    // REQ-535: a retry is more sessions, and the budget is spent.
    if (overBudget()) {
      warn(`${req.requirement}: ${budgetMessage()}`);
      previousFailure = `${budgetMessage()}\n\n${previousFailure}`;
      stopRetrying = true;
      break;
    }
    // REQ-591: a person looks at the failed attempt before the next one starts.
    if (ctx.pauseBetweenAttempts && attempt > firstAttempt && ctx.projectDir) {
      info(
        `${req.requirement}: paused before attempt ${attempt} — ` +
          "`specgate harness continue` starts it, `--stop` does not"
      );
      appendEvent(eventsFile, { type: "pause", next: attempt }, req.requirement, attempt - 1);
      const go = waitAtPause(ctx.projectDir, {
        requirement: req.requirement,
        attempt: attempt - 1,
        stage: attemptLog.at(-1)?.gateStage || attemptLog.at(-1)?.endedAt || "",
      });
      if (!go) {
        warn(`${req.requirement}: not retried, as asked`);
        stopRetrying = true;
        break;
      }
    }
    info(`${req.requirement}: attempt ${attempt}/${settings.maxAttempts}`);
    const attemptStart = Date.now();
    const event = (e: Record<string, unknown> & { type: string }) =>
      appendEvent(eventsFile, e, req.requirement, attempt);
    event({ type: "attempt", state: "start" });
    let agentMs = 0;
    /** Which roles ran this attempt, in order — the run record's answer to "who did this". */
    const profilesUsed: string[] = [];
    /** The tokens each step's agent reported, when its stream said (REQ-509). */
    const usageUsed: StepUsage[] = [];
    const record = (stage: AttemptRecord["endedAt"], gateStage?: string) => {
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
        // REQ-301: which stage rejected it is what says what to strengthen.
        ...(gateStage ? { gateStage } : {}),
        ...(usageUsed.length > 0 ? { usage: [...usageUsed] } : {}),
      });
      ledgerAttempts(attemptLog);
    };

    // An attempt is a sequence of agent invocations, all bound to this one
    // requirement. Attempt 1 is a single implementing step; a retry may run an
    // advisory reviewer first, whose findings feed the step that follows.
    const steps = planAttempt(attempt, {
      attemptProfiles: settings.attemptProfiles,
      reviewProfile: settings.reviewProfile || null,
      roles: settings.lanes || [],
    });

    let stepFailed = false;
    /** REQ-586: the attempt to jump to, past rungs of an agent that cannot run now. */
    let fallbackTo = 0;
    /** REQ-579: the prompt file in use, removed even when a step throws. */
    let openPrompt: string | null = null;
    try {
      for (const step of steps) {
        // REQ-535: a session after the budget is spent is not started.
        if (overBudget()) {
          previousFailure = budgetMessage();
          warn(`${req.requirement}: ${budgetMessage()}`);
          record("budget");
          stopRetrying = true;
          stepFailed = true;
          break;
        }
        // Built per step, not per attempt: the reviewer runs first and the
        // implementing step that follows must see what it said. Building once
        // up front meant findings only ever reached the *next* attempt, which
        // is not what a reviewer is for.
        let stepPackages: string[] = [];
        const prompt = judged(worktreeDir, (dir) => {
          stepPackages = packagesFor(dir, req.requirement).map((p) => p.id);
          return buildPrompt(req, dir, {
            promptPrefix: settings.promptPrefix,
            hint: step.role
              ? [roleInstruction(step.role, req.requirement), hint].filter(Boolean).join("\n\n")
              : hint,
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
          });
        });
        if (stepPackages.length > 0) {
          notePackagesUsed(req.requirement, stepPackages);
        }
        const promptFile = path.join(
          os.tmpdir(),
          `specgate-harness-prompt-${req.requirement}-${crypto.randomBytes(4).toString("hex")}.md`
        );
        // REQ-579: readable by this user only — it may quote the gate's output.
        fs.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 0o600 });
        openPrompt = promptFile;
        archivePrompt(worktreeDir, req.requirement, attempt, step, prompt);
        // The live view shows what the agent was told and how big it was (REQ-182).
        keepPrompt(ctx.projectDir || worktreeDir, req.requirement, attempt, prompt);
        event({
          type: "prompt",
          role: step.profile || (step.advisory ? "reviewer" : "agent"),
          chars: prompt.length,
          lines: prompt.split("\n").length,
          // REQ-317: which role packages it carried.
          ...(stepPackages.length > 0 ? { packages: stepPackages } : {}),
        });

        // D1: a profile chosen by matching this requirement, when one matches.
        // The role ladder still wins — `attempt_profiles` names a profile for
        // *this step*, and a step that says which role it is has already
        // answered the question.
        const profile = step.profile || ctx.matchedProfile || null;
        const agentCommand = profile
          ? settings.profileAgents[profile] || settings.agent
          : settings.agent;
        // REQ-588: in the project's container when \`sandbox:\` names one; REQ-589: its caches.
        const cacheDir = settings.dependencyCache
          ? projectCache(ctx.projectDir || worktreeDir)
          : "";
        const cacheEnv = cacheDir ? cacheEnvironment(cacheDir, process.env) : {};
        const command = agentLine(agentCommand, promptFile, worktreeDir, settings, {
          env: [
            "SPECGATE_REQ",
            "SPECGATE_ATTEMPT",
            ...(step.role ? ["SPECGATE_LANE"] : []),
            EVENTS_FILE_VAR,
            EVENTS_REQ_VAR,
            EVENTS_ATTEMPT_VAR,
            ...Object.keys(cacheEnv),
          ],
          mounts: [path.dirname(eventsFile), ...(cacheDir ? [cacheDir] : [])],
        });
        if (profile) {
          info(`${req.requirement}: ${step.advisory ? "reviewing" : "running"} as '${profile}'`);
        }
        const agentStart = Date.now();
        // REQ-509: the default agent's profile, when it came from one, so its
        // tokens are priced and its hint applies.
        const role =
          step.role ?? profile ?? (step.advisory ? "reviewer" : settings.agentProfile || "agent");
        const eventsBefore = eventsLineCount(eventsFile);
        // REQ-533: what is outside this role's lane, to put back after it.
        const lane = step.role ? laneGuard(worktreeDir, step.role) : null;
        streamEvent({ type: "agent-start", role }, req.requirement, attempt);
        const agent = runWithDeadline(command, {
          cwd: worktreeDir,
          timeoutMs: limitFor(settings, "agent", timeoutMs),
          ...(settings.agentEnv ? { envAllow: settings.agentEnv } : {}),
          maxBuffer: SUBPROCESS_MAX_BUFFER,
          // A question it asks is written into the project at once (REQ-494),
          // and its output streamed while this process waits (REQ-496).
          projectDir: ctx.projectDir || undefined,
          streamFd: streamFdOf(),
          // Which requirement and attempt this is, for agents and the wrappers
          // around them (ADR-0036).
          env: {
            ...cacheEnv,
            SPECGATE_REQ: req.requirement,
            SPECGATE_ATTEMPT: String(attempt),
            ...(step.role ? { SPECGATE_LANE: step.role } : {}),
            [EVENTS_FILE_VAR]: eventsFile,
            [EVENTS_REQ_VAR]: req.requirement,
            [EVENTS_ATTEMPT_VAR]: String(attempt),
          },
        });
        // Node reports a timeout as an errno-carrying Error; the base `Error`
        // type the spawnSync signature declares does not have `code`.
        agentMs += Date.now() - agentStart;
        streamEvent(
          {
            type: "agent-end",
            role,
            exit: agent.status,
            timedOut: (agent.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT",
            ms: Date.now() - agentStart,
          },
          req.requirement,
          attempt
        );
        profilesUsed.push(role);
        const used = stepUsage(eventsLinesSince(eventsFile, eventsBefore), attempt, role);
        if (used) usageUsed.push(used);
        if (used) tokens += used.input + used.output + used.cacheRead + used.cacheWrite;
        if (used && typeof used.cost === "number") addRunSpentUsd(used.cost);
        // REQ-585: a session that says nothing of its cost is not free when the project says so.
        if (settings.requireKnownCost && !(used && typeof used.cost === "number")) {
          previousFailure =
            `cost_unknown — the ${role} session of ${req.requirement} reported no cost, ` +
            "and require_known_cost is set: it is not counted as free.";
          warn(`${req.requirement}: ${previousFailure}`);
          record("budget");
          stopRetrying = true;
          stepFailed = true;
          break;
        }
        if (maxCost > 0) {
          if (used && typeof used.cost === "number") spent += used.cost;
          else if (!costUnknownSaid) {
            costUnknownSaid = true;
            warn(
              `${req.requirement}: cost_unknown — the agent reported no cost; ` +
                "max_cost_usd counts its sessions as free"
            );
          }
        }
        if (lane) {
          for (const rel of lane()) {
            warn(`${req.requirement}: lane_crossed — ${step.role} wrote ${rel}; reverted`);
            event({ type: "lane", role: step.role, path: rel, result: "reverted" });
          }
        }

        removeTempFile(promptFile);
        openPrompt = null;
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
          // REQ-586: another profile of the ladder may be available; one that is
          // the same profile again would meet the same wall.
          const fallback =
            unavailable && !step.advisory
              ? fallbackAttempt(attempt, settings.maxAttempts, settings.attemptProfiles)
              : null;
          if (unavailable && fallback) {
            warn(`${req.requirement}: the agent cannot run now — ${unavailable}`);
            warn(`  falling back to profile '${fallback.profile}' (attempt ${fallback.attempt})`);
            record("agent-unavailable");
            fallbackTo = fallback.attempt;
          } else if (unavailable) {
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
      // REQ-579: each step removes its own; this one is left by a step that threw.
      if (openPrompt) removeTempFile(openPrompt);
    }
    if (stopRetrying) break;
    // REQ-586: the loop's own step brings it to the fallback's attempt.
    if (fallbackTo > attempt + 1) attempt = fallbackTo - 1;
    if (stepFailed) continue;

    // The agent asked instead of guessing (REQ-189): another attempt would
    // meet the same question, and the gate has nothing to judge.
    // REQ-495: the run does not wait for the answer. It becomes an assumption
    // a person reviews before the specification says it (REQ-188); building
    // on it first would gate a scenario that does not say what was answered.
    const asked = questionAsked(eventsFile, attempt, attemptStart);
    if (asked) {
      warn(`${req.requirement}: the agent asked — ${asked.text}`);
      record("question");
      discardWorktreeChanges(worktreeDir);
      const waiting = asked.id ? waitingFor(asked as Required<AskedQuestion>) : null;
      return {
        result: "question",
        attempts: attempt - firstAttempt + 1,
        attemptLog,
        question: asked.text,
        ...(waiting ? { waitingForAnswer: waiting } : {}),
        error: waiting
          ? `Needs clarification: ${waiting.id} in ${waiting.file} — ${waiting.answer}`
          : `Needs clarification: ${asked.text}`,
      };
    }

    // Before the gate: an agent that wrote nothing cannot have implemented
    // anything, and the gate would approve it. See `producedNothing` (H19).
    // REQ-264: the same command writes nothing the next time either — three
    // attempts and 7 min 40 s said so in truck-flote (S50) — so it ends here.
    if (producedNothing(worktreeDir)) {
      // REQ-417: the agent wrote for another requirement of this run, so it
      // can write; one more attempt, told so, before giving up.
      if (agentWroteInThisRun() && !retriedEmpty && attempt < settings.maxAttempts) {
        retriedEmpty = true;
        previousFailure =
          `You produced no files. Nothing in the worktree changed, so there is ` +
          `nothing implementing ${req.requirement}. Write its test first, then the ` +
          `code that makes it pass, in this worktree.`;
        warn(`${req.requirement}: the agent produced no files — retrying once`);
        warn(`  it wrote files for another requirement of this run, so it can write`);
        record("no-op");
        continue;
      }
      previousFailure =
        `You produced no files. Nothing in the worktree changed, so there is ` +
        `nothing implementing ${req.requirement}.\n\n` +
        `If you could not write, that is the problem to report — a non-interactive ` +
        `agent without tool permissions reads the prompt and cannot act on it. ` +
        `See docs/agent-setup.md, § Tool allowances.`;
      warn(`${req.requirement}: the agent produced no files — nothing to gate`);
      warn(
        `  fix: give the agent write permission and the tools it needs (docs/agent-setup.md, § Tool allowances)`
      );
      warn(`  not retrying: the same command would write nothing again`);
      record("no-op");
      stopRetrying = true;
      break;
    }

    markAgentWrote();

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

    // REQ-547: a decision kept for a person, taken anyway.
    const rights = checkDecisionRightsInWorktree(worktreeDir);
    if (rights) {
      previousFailure = rights.message;
      for (const e of rights.exceeded) {
        warn(
          `${req.requirement}: decision_right_exceeded — ${e.decision} in ${e.file} (${e.detail})`
        );
      }
      record("decision-right");
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
      gateReporter(eventsFile, req.requirement, attempt)
    );
    if (!gate.ok && gate.couldNotRun) {
      // REQ-267: nothing in the code can fix the tool's own setup, and another
      // attempt would meet it again (truck-flote S52: 15 minutes each).
      previousFailure = `Gate stopped at: ${gate.stage}\n\n${gate.couldNotRun}\n\n${gate.output}`;
      warn(`${req.requirement}: ${gate.couldNotRun}`);
      for (const line of gate.output.trim().split("\n").slice(-5)) warn(`  ${line}`);
      warn(
        gate.stage.startsWith("quality check")
          ? `  not retrying: fix the check (harness.config.yaml) and run it again`
          : `  not retrying: the agent cannot fix the machine`
      );
      record("check", gate.stage);
      stopRetrying = true;
      break;
    }
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
        record("spec", gate.stage);
        stopRetrying = true;
        break;
      }
      record("gate", gate.stage);
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

    // REQ-418: green, but a requirement citing an operation serves or calls
    // its path. In runs 7 and 8 tracking served no route of the contract and
    // web called none, and every requirement passed (truck-flote, MS7-1).
    const missing = contractNotMet(worktreeDir, ctx.projectDir || worktreeDir, req.requirement);
    if (missing.length) {
      previousFailure =
        `The gate passed, but the code does not serve or call the operation ` +
        `${req.requirement} cites:\n\n` +
        missing.map((d) => `  ${d.message}\n  fix: ${d.fix}`).join("\n\n");
      for (const d of missing) {
        warn(`${req.requirement}: ${d.message} [${d.code}]`);
        if (d.fix) warn(`  fix: ${d.fix}`);
      }
      discardWorktreeChanges(worktreeDir);
      record("gate", "contract operation");
      continue;
    }

    // Close the loop inside the worktree. The gate above is the check; `done`
    // running its own again would only double the slowest step.
    const done = spawnSync(
      process.execPath,
      [DONE_SCRIPT, req.requirement, "--no-check", "--project-dir", worktreeDir],
      { encoding: "utf8", timeout: ctx.timeoutMs, maxBuffer: SUBPROCESS_MAX_BUFFER }
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
        promptInFlight(req, worktreeDir, {
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

/** A question an agent asked, with where it was recorded once it was (REQ-494). */
interface AskedQuestion {
  text: string;
  id?: string;
  change?: string;
  file?: string;
}

/** The question the agent recorded with `specgate ask` during this attempt, if any (REQ-189). */
function questionAsked(
  eventsFile: string,
  attempt: number,
  startedMs: number
): AskedQuestion | null {
  let text = "";
  try {
    text = fs.readFileSync(eventsFile, "utf8");
  } catch {
    return null;
  }
  const since = Math.floor(startedMs / 1000) - 1;
  let asked: AskedQuestion | null = null;
  for (const line of text.split("\n")) {
    try {
      const e = JSON.parse(line);
      if (e.type === "question" && e.attempt === attempt && Number(e.t) >= since && e.text) {
        // The line with the id follows the agent's own once the question is recorded.
        asked = {
          text: String(e.text),
          ...(e.id
            ? { id: String(e.id), change: String(e.change || ""), file: String(e.file || "") }
            : {}),
        };
      }
    } catch {
      /* a line being written */
    }
  }
  return asked;
}

/** What a requirement waits on, with the command that answers it (REQ-495). */
function waitingFor(q: {
  id: string;
  text: string;
  change: string;
  file: string;
}): WaitingForAnswer {
  return {
    id: q.id,
    text: q.text,
    change: q.change,
    file: q.file,
    answer: `specgate answer ${q.id} "…"${q.change && q.change !== "project" ? ` --change ${q.change}` : ""}`,
  };
}

/**
 * The questions the run's agents asked and nothing recorded while they ran,
 * written into the project and committed (REQ-189): the agent could not edit
 * the specification, so the harness does, and the requirement waits. A
 * question is normally recorded the moment it is asked (REQ-494); this is for
 * one that could not be.
 */
function recordQuestions(projectDir: string, results: RequirementResult[]): void {
  for (const r of results) {
    if (r.result !== "question" || !r.question || r.waitingForAnswer) continue;
    const asked = recordQuestion(projectDir, r.requirement, r.question);
    if (!asked.ok) {
      warn(`${r.requirement}: could not record its question — ${asked.message}`);
      continue;
    }
    r.waitingForAnswer = waitingFor({ ...asked, text: r.question });
    r.error = `Needs clarification: ${asked.id} in ${asked.file} — ${r.waitingForAnswer.answer}`;
    info(`${r.requirement}: ${asked.id} recorded in ${asked.file}; answer it with specgate answer`);
  }
}

/**
 * REQ-579: the \`harness/base/REQ-NNN\` branches a run made to merge several
 * dependencies into — derived again on every run, so none is kept. One still
 * checked out (a kept worktree) is left.
 */
export function dropIntegrationBranches(projectDir: string): void {
  const refs = git(projectDir, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/harness/base/",
  ]);
  if (refs.status !== 0) return;
  for (const branch of String(refs.stdout).split("\n").filter(Boolean)) {
    git(projectDir, ["branch", "-D", branch]);
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
  const starting = currentLedger();
  if (starting) {
    starting.record.running = {
      requirement: req.requirement,
      startedAt: new Date().toISOString(),
      attemptLog: [],
    };
    ledgerWrite();
  }
  const result = processOneRequirement(req, ctx);
  const used = packagesUsedBy(req.requirement);
  if (used && used.size > 0) result.packages = [...used];
  const ending = currentLedger();
  if (ending) {
    ending.record.results.push(result);
    delete ending.record.running;
    ledgerWrite();
  }
  // A worker's result reaches the stream through its parent, which reads its report.
  if (!process.env.SPECGATE_HARNESS_WORKER) streamResult(result);
  return result;
}

function processOneRequirement(req: HarnessRequirement, ctx: RunContext): RequirementResult {
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

  // REQ-315: a requirement of an open change waits for its approvals — the 1.0
  // default for a layered change — before any worktree or agent.
  const owning = inFlightRequirements(projectDir).find((r) => r.id === req.requirement);
  const unapproved = owning ? missingApprovals(projectDir, owning.change) : null;
  if (unapproved) {
    error(`${req.requirement}: ${unapproved.message} [harness_not_approved]`);
    warn(`  fix: ${unapproved.fix}`);
    return unattempted(
      req.requirement,
      req.category,
      "skipped",
      branch,
      `harness_not_approved: ${unapproved.message} Fix: ${unapproved.fix}`
    );
  }

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
    return unattempted(
      req.requirement,
      req.category,
      "skipped",
      branch,
      unrunnable
        ? `Its scenario would pass without testing anything, so the gate could not ` +
            `tell success from failure. Run \`specgate validate <dir> --strict-scenarios\` ` +
            `to see every one.`
        : `Not ready for an agent: ${readiness.blockers
            .filter((b) => b.severity === "error")
            .map((b) => b.code)
            .join(", ")}. Fix the blockers above, or drop --skip-not-ready to run it anyway.`
    );
  }
  const worktreeDir = path.join(
    os.tmpdir(),
    `specgate-harness-${req.requirement}-${crypto.randomBytes(4).toString("hex")}`
  );

  // A full disk mid-copy ended a night's chain with ENOSPC (REQ-184): stop
  // before starting, with the reason, instead.
  const lowDisk = lowDiskMessage(freeBytes(os.tmpdir()), minFreeBytes(), os.tmpdir());
  if (lowDisk) {
    return unattempted(req.requirement, req.category, "fail", branch, `Not started: ${lowDisk}`);
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
      return unattempted(
        req.requirement,
        req.category,
        "skipped",
        branch,
        `Branch ${branch} already exists. Re-run with --resume to continue it, ` +
          `or --force to recreate it from scratch.`
      );
    } else {
      if (merged && !force) info(`${req.requirement}: ${branch} is already merged — recreating it`);
      const deleted = git(projectDir, ["branch", "-D", branch]);
      // REQ-579: said here, rather than as a confusing failure to create it below.
      if (deleted.status !== 0) {
        return unattempted(
          req.requirement,
          req.category,
          "fail",
          branch,
          `could not delete ${branch} to recreate it:\n${deleted.stderr || deleted.stdout}`
        );
      }
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
      return unattempted(
        req.requirement,
        req.category,
        "fail",
        branch,
        `git worktree add failed:\n${add.stderr || add.stdout}`
      );
    }
  }

  try {
    const setupCmd = String((ctx.settings && ctx.settings.setupCmd) || "").trim();
    if (setupCmd && !survivor) {
      const report = gateReporter(
        eventsFileFor(ctx.projectDir || dir, req.requirement),
        req.requirement,
        undefined
      );
      report(`setup: ${maskCommand(setupCmd)}`, "start");
      const setupStart = Date.now();
      // REQ-575: an install that hangs ends at the run's deadline, with what it started.
      const setup = runWithDeadline(setupCmd, {
        cwd: dir,
        timeoutMs: limitFor(ctx.settings, "setup", ctx.timeoutMs),
        maxBuffer: SUBPROCESS_MAX_BUFFER,
        // REQ-589: what the last worktree downloaded, this one reads from disk.
        ...(ctx.settings.dependencyCache
          ? {
              env: cacheEnvironment(projectCache(ctx.projectDir), process.env),
            }
          : {}),
      });
      report(`setup: ${maskCommand(setupCmd)}`, setup.status === 0 ? "pass" : "fail", {
        ms: Date.now() - setupStart,
      });
      if (setup.status !== 0) {
        return unattempted(
          req.requirement,
          req.category,
          "fail",
          branch,
          `setup_cmd failed before the agent ran:\n${setup.stdout || ""}${setup.stderr || ""}`
        );
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
      Object.assign(result, publishBranch(projectDir, branch, req, ctx.settings, ctx.timeoutMs));
    }
    return result;
  } finally {
    // `dir`, not `worktreeDir`: a resumed run re-attached to the worktree that
    // survived the interruption, and `worktreeDir` names a path that was never
    // created. Removing the wrong one leaves the real worktree registered and
    // the next --resume unable to attach.
    // REQ-573: an interrupted run keeps the worktree, for --resume.
    if (wasInterrupted()) {
      info(`${req.requirement}: interrupted — worktree kept at ${dir} for --resume`);
    } else if (!keepWorktrees) {
      git(projectDir, ["worktree", "remove", "--force", dir]);
    } else {
      info(`${req.requirement}: worktree kept at ${dir}`);
    }
  }
}

/**
 * REQ-589: the project's download cache, made if absent — a container mounts
 * only a folder that exists — and ignored by git, as the events folder is: a
 * cache that showed as untracked files would make the next run refuse a
 * working tree that is not clean.
 */
function projectCache(projectDir: string): string {
  const dir = path.join(projectDir, ".harness", "cache");
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  return dir;
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
  settings: Pick<HarnessSettings, "push" | "remote" | "prCmd">,
  /** REQ-575: how long the PR command may run. */
  timeoutMs = 20 * 60 * 1000
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
    // REQ-580: each value one shell argument.
    const command = settings.prCmd
      .split("{branch}")
      .join(quoteArg(branch))
      .split("{req}")
      .join(quoteArg(req.requirement));
    const pr = runWithDeadline(command, {
      cwd: projectDir,
      timeoutMs,
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

/** Why a run started no more requirements (REQ-491): a stop asked, or its budget. */
export interface RunStopped {
  by: "request" | "budget";
  code: string;
  reason: string;
  notAttempted: string[];
}

/** What `--allow-dirty` left out (REQ-490). */
export interface RunDirty {
  allowed: boolean;
  leftOut: string[];
}

/** The requirements a stop or a budget kept from starting, and why; `null` when none. */
export function runStopped(results: RequirementResult[]): RunStopped | null {
  const halted = results.filter((r) => r.stoppedBy);
  if (halted.length === 0) return null;
  const code = String(halted[0].stoppedBy);
  return {
    by: code === STOP_ASKED ? "request" : "budget",
    code,
    reason: String(halted[0].error || "").replace(/^Not attempted: /, ""),
    notAttempted: halted.map((r) => r.requirement),
  };
}

/** The document `--format json` prints, and the stream's `run-end` carries. */
export function reportDocument(
  results: RequirementResult[],
  extra: { dirty?: RunDirty; stopped?: RunStopped | null } = {}
) {
  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.result] = (acc[r.result] || 0) + 1;
    return acc;
  }, {});
  return {
    schemaVersion: 1,
    total: results.length,
    summary,
    results,
    dirty: extra.dirty || { allowed: false, leftOut: [] },
    stopped: extra.stopped === undefined ? runStopped(results) : extra.stopped,
  };
}

export function printReport(
  results: RequirementResult[],
  format: string,
  recorded?: string,
  extra: { dirty?: RunDirty } = {}
): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(reportDocument(results, extra), null, 2) + "\n");
    return;
  }
  if (format === "jsonl") {
    for (const r of results) streamResult(r);
    streamEvent({ type: "run-end", report: reportDocument(results, extra), status: [] });
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
        results.push(notAttempted(byId.get(id), id, ctx.stopReason!(), ctx.stopCode?.()));
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
    maxRunCostUsd: ctx.settings?.maxRunCostUsd || 0,
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
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: ${(dependsOn[id] || []).filter((d) => blocked.has(d) || results.some((r) => r.requirement === d && r.result !== "pass")).join(", ")} did not pass.`
        )
      );
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
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: could not assemble its base. ${reason}`
        )
      );
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
            stoppedBy = { stop: true, code: STOP_ASKED, reason: "a stop was asked" };
            return false;
          }
          const verdict = budgetVerdict(
            limits,
            { startedAt: budgetStartedAt, started, spentUsd: runSpentUsdSoFar() },
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
        stopCode: () => (stoppedBy && stoppedBy.code) || "",
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
        results.push(notAttempted(byId.get(id), id, stoppedBy.reason, stoppedBy.code || ""));
      }
    }
  }

  // Requirements caught in a cycle never reach a level. Report them rather
  // than dropping them from the run.
  for (const cycle of cycles) {
    for (const id of cycle) {
      if (results.some((r) => r.requirement === id)) continue;
      const req = byId.get(id);
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: caught in a dependency cycle (${cycle.join(" → ")}). Run \`specgate validate\` for the fix.`
        )
      );
    }
  }

  return results;
}

/**
 * The requirements a run takes: one row each (the plan has one per scenario,
 * and two rows cost two agent sessions), none already done, and never the
 * adoption baseline unless it is named — an agent cannot build "existing
 * behaviour is preserved"; a test that names REQ-001 closes it (REQ-478).
 */
export function harnessQueue<
  T extends { requirement: string; category?: string; featureFile?: string; feature_file?: string },
>(rows: T[], reqs: readonly string[]): T[] {
  const wanted = new Set(reqs);
  const firstRow = new Set<string>();
  return rows.filter((r) => {
    if (r.category === "DONE" || firstRow.has(r.requirement)) return false;
    if (wanted.size > 0 && !wanted.has(r.requirement)) return false;
    const baseline = String(r.featureFile ?? r.feature_file ?? "").includes(
      "features/adoption/baseline"
    );
    if (baseline && !wanted.has(r.requirement)) return false;
    firstRow.add(r.requirement);
    return true;
  });
}

export class RunCommand extends BaseCommand {
  public async execute() {
    // REQ-573: every command this run starts ends with it — through the workers too.
    if (!process.env.SPECGATE_HARNESS_ROOT_PID) {
      process.env.SPECGATE_HARNESS_ROOT_PID = String(process.pid);
    }
    try {
      const args = parseArgs([...this.args, ...workerCommandsFromEnv()]);
      setJsonMode(args.format !== "text");
      // REQ-496: the stream is this run's stdout; a worker's is the pipe its parent gave it.
      if (args.format === "jsonl") setStream(1);
      else streamFromEnv();
      const projectDir = resolveProjectDir(args.projectDir, { requireSentinel: true });

      // REQ-211: a profile chosen for this run is its agent, ahead of the file's.
      if (args.profile && !args.agent) {
        args.agent = resolveProfileAgent(projectDir, args.profile);
        args.agentProfile = args.profile;
      }
      const fileConfig = readHarnessConfig(projectDir);
      const settings = resolveHarnessSettings(fileConfig, args);
      // REQ-548: the stack file's test command when the configuration sets none.
      if (!settings.testCmd) settings.testCmd = stackFileCommand(projectDir, "test");
      // REQ-587: say which secret-looking variables the agent would inherit — names, never values.
      if (!process.env.SPECGATE_HARNESS_WORKER && !settings.agentEnv && !args.dryRun) {
        const names = secretNames(process.env);
        if (names.length > 0) {
          info(
            `the agent inherits ${names.length} variable(s) that look like secrets: ${names.join(", ")} ` +
              "— agent_env: in harness.config.yaml chooses what it gets"
          );
        }
      }
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

      // REQ-264: Claude Code in print mode writes nothing without permission.
      let permitted = false;
      const permit = (command: string) => {
        const p = withAgentPermission(command);
        permitted = permitted || p.added;
        return p.command;
      };
      if (settings.agent) settings.agent = permit(settings.agent);
      for (const name of Object.keys(settings.profileAgents || {})) {
        settings.profileAgents[name] = permit(settings.profileAgents[name]);
      }
      if (permitted) {
        info(
          "Claude Code runs with --permission-mode acceptEdits: in print mode it cannot write " +
            "without it, and the harness's worktree confines what it writes."
        );
      }
      // REQ-271: an agent given on the command line is forgotten after the run.
      const unkept = Boolean(args.agent) && !(fileConfig && fileConfig.agent);

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
      // REQ-600: in the brief's module order, as status and apply take them.
      let pending = harnessQueue(
        inBuildOrder(plan.requirements || [], modulePlaces(projectDir)),
        args.reqs
      );
      if (args.reqs.length > 0) {
        // In the order given (REQ-185): the plan's order reshuffled a chain silently.
        pending = orderAsGiven(pending, args.reqs);
        const found = new Set(pending.map((r) => r.requirement));
        for (const want of args.reqs) {
          if (!found.has(want)) warn(`${want} is not a pending requirement — skipped.`);
        }
      }

      if (pending.length === 0) {
        if (args.format === "jsonl") printReport([], "jsonl");
        if (isJsonMode()) info("No pending requirements. Nothing to do.");
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
            (settings.agent ? ui.kv("Agent", maskCommand(settings.agent), 14) : "") +
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

      // REQ-490: worktrees are cut from the last commit, so what is not
      // committed is not part of the run. Refused unless asked for, and said.
      // A worker is a slice of a run whose parent has already looked.
      const dirty: RunDirty = { allowed: args.allowDirty, leftOut: [] };
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        dirty.leftOut = uncommittedPaths(projectDir);
        if (dirty.leftOut.length > 0 && !args.allowDirty) {
          throw new Error(
            "Working tree is not clean. Commit or stash your changes before running the " +
              "harness, or pass --allow-dirty to build from the last commit and leave them as they are."
          );
        }
        if (dirty.leftOut.length > 0) {
          warn(
            `--allow-dirty: ${dirty.leftOut.length} uncommitted file(s) stay as they are here ` +
              `and are not part of the run: ${dirty.leftOut.slice(0, 5).join(", ")}` +
              (dirty.leftOut.length > 5 ? ", …" : "")
          );
        }
      }

      // Git needs to know who is committing, and the harness commits — once per
      // green requirement, and again to preserve a failed attempt. Without an
      // identity it discovers this *after* the agent has run and the gate has
      // passed, so a full attempt is paid for and thrown away by a one-line
      // config. Found by CI, which has no global git identity and produced
      // `Author identity unknown` at the commit step of every requirement.
      const identity = gitIdentityProblem(projectDir);
      if (identity) throw new Error(identity);
      // REQ-279: a stopped Docker fails every attempt in the tests or the
      // checks, and the agent cannot start it (truck-flote S61: three attempts).
      const needsDocker = dockerNeed(projectDir, settings.quality || null);
      const noDocker = needsDocker ? dockerWhyNot() : null;
      if (noDocker) throw new Error(`${noDocker} This project needs it: ${needsDocker}.`);
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
      if (isJsonMode() || process.env.SPECGATE_HARNESS_WORKER) {
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
        pauseBetweenAttempts: args.pauseBetweenAttempts,
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
        streamEvent({
          type: "run-start",
          schemaVersion: 1,
          projectDir,
          base: baseRef,
          queue: pending.map((r) => r.requirement),
          concurrency: settings.concurrency,
          maxAttempts: settings.maxAttempts,
          dirty,
        });
      }

      const startedAt = new Date().toISOString();
      const runRecordBase = {
        schemaVersion: 1,
        startedAt,
        baseRef,
        concurrency: settings.concurrency,
        maxAttempts: settings.maxAttempts,
        // Whether this run had a ceiling at all. Reading the ledger later,
        // a short run is a different thing depending on the answer.
        bounded: hasBudget({
          budgetSeconds: args.budgetSeconds,
          maxRequirements: args.maxRequirements,
          maxRunCostUsd: settings.maxRunCostUsd || 0,
        }),
      };
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        setLedger({ projectDir, record: { ...runRecordBase, finishedAt: "", results: [] } });
        ledgerWrite();
      }
      const results = args.chain
        ? await runChain(pending, ctx, hintByReq, (reqs, levelCtx, hints) =>
            runLevels(reqs, levelCtx, { concurrency: 1, hintByReq: hints, runOne: dispatchLevel })
          )
        : await runLevels(pending, ctx, {
            concurrency: settings.concurrency,
            hintByReq,
            runOne: dispatchLevel,
          });
      // What the agents asked goes into the project, once the run is done (REQ-189).
      if (!process.env.SPECGATE_HARNESS_WORKER) recordQuestions(projectDir, results);
      // REQ-579: the throwaway bases several dependencies were merged into go with the run.
      if (!process.env.SPECGATE_HARNESS_WORKER) dropIntegrationBranches(projectDir);

      // Only the run that a person started writes a record. A worker is one
      // slice of that run, and its own record would be a second copy of the
      // same requirement — `harness report` reads every file in the directory,
      // so duplicates land straight in "cost per delivered REQ".
      const recordPath = process.env.SPECGATE_HARNESS_WORKER
        ? null
        : writeRunRecord(projectDir, {
            ...runRecordBase,
            finishedAt: new Date().toISOString(),
            results,
          });
      setLedger(null);
      // REQ-590: the run as a trace, when an OpenTelemetry collector is configured.
      if (!process.env.SPECGATE_HARNESS_WORKER) {
        const sent = await exportRunTrace({
          ...runRecordBase,
          finishedAt: new Date().toISOString(),
          results,
        });
        if (sent.sent) info(`trace sent to ${sent.url}`);
        else if (sent.error) warn(`the trace was not sent to ${sent.url}: ${sent.error}`);
      }

      printReport(
        results,
        args.format,
        recordPath ? path.relative(projectDir, recordPath) : undefined,
        { dirty }
      );
      // REQ-271: the studio's Build reads the agent from harness.config.yaml.
      if (unkept && !isJsonMode() && !process.env.SPECGATE_HARNESS_WORKER) {
        process.stdout.write(
          `  ${ui.muted("Keep this agent for the next run and the studio's Build:")}\n` +
            `    specgate config set agent ${quoteArg(args.agent)}\n\n`
        );
      }

      // A blocked requirement was never attempted, so it is not a pass — but it
      // is also not evidence that anything is broken beyond the failure that
      // caused it. It still fails the run, because work was left undone.
      const failed = results.filter((r) => r.result !== "pass").length;
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      const thrown = err as { message?: string };
      // REQ-573: interrupted, it exits 130 as a shell's Ctrl-C does; the worktree stays.
      const exitCode = err instanceof HarnessInterrupted ? 130 : 1;
      let isJson = false;
      let format = "";
      try {
        format = parseArgs(this.args).format;
        isJson = format === "json";
      } catch {
        // Refused arguments are answered in the format asked for, too.
        const at = this.args.indexOf("--format");
        format = at >= 0 ? this.args[at + 1] || "" : "";
        isJson = format === "json";
      }
      if (format === "jsonl") {
        // The last line of a stream is always `run-end`, a refused run's too.
        process.stdout.write(
          JSON.stringify({
            t: Math.floor(Date.now() / 1000),
            type: "run-end",
            report: null,
            status: [
              {
                severity: "error",
                code: "harness_run_error",
                message: thrown.message || String(err),
              },
            ],
          }) + "\n"
        );
        process.exit(exitCode);
      }
      if (exitCode !== 1) {
        if (isJson) {
          process.stdout.write(
            JSON.stringify({
              results: null,
              status: [{ severity: "error", code: "harness_run_error", message: thrown.message }],
            }) + "\n"
          );
        } else error(thrown.message || String(err));
        process.exit(exitCode);
      }
      const io = agentIo(isJson);
      return io.fail({ results: null }, [
        { severity: "error", code: "harness_run_error", message: thrown.message || String(err) },
      ]);
    }
  }
}
