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
import { quoteArg } from "../../../lib/escape";
import {
  HarnessInterrupted,
  runWithDeadline,
  wasInterrupted,
} from "../../../lib/run-with-deadline";
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
import { withAgentPermission, withTestPermission } from "../../../lib/agent-permission";
import { detectSetupCommand } from "../../../harness/init";
import { inFlightRequirements } from "../../../lib/in-flight";
import { missingApprovals } from "../../../lib/approvals";
import { eventsFileFor, writeQueue } from "../../../lib/harness-events";
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
import { dockerWhyNot } from "../../../lib/quality-run";
import { dockerNeed } from "../../../lib/harness-environment";
import { maskCommand, secretNames } from "../../../../packages/core/src/domain/HarnessEvents";
import { analyseGherkinSource } from "../../../../packages/core/src/domain/GherkinQuality";
import {
  readHarnessConfig,
  readProfileRules,
  resolveHarnessSettings,
  resolveProfileAgent,
  HarnessSettings,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { agentIo } from "../../../lib/agent";
import { PROMPT_ARCHIVE_DIR } from "../../../../packages/core/src/domain/EmptyAttempt";
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
import { featureFilePath, scheduleLevels } from "../../../../packages/core/src/domain/HarnessRun";
import { cacheEnvironment } from "../../../../packages/core/src/domain/DependencyCache";
import { exportRunTrace } from "../../../lib/otel-export";
import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";
import { setStream, streamEvent, streamFromEnv } from "../../../lib/harness-stream";
import { recordQuestion } from "../../../lib/agent-watch";
import {
  judged,
  HarnessRequirement,
  RunContext,
  RequirementResult,
  PLAN_SCRIPT,
  VALIDATE_SCRIPT,
  setJsonMode,
  isJsonMode,
  info,
  warn,
  error,
  git,
  SUBPROCESS_MAX_BUFFER,
  resolveGeneratedConflicts,
  PublishOutcome,
  STOP_ASKED,
  notAttempted,
  unattempted,
} from "../../../harness/run/shared";
import {
  currentLedger,
  ledgerWrite,
  packagesUsedBy,
  runSpentUsdSoFar,
  setLedger,
  writeRunRecord,
  streamResult,
} from "../../../harness/run/state";
import { limitFor, gateReporter } from "../../../harness/run/gate";
import { runWorkers, workerCommandsFromEnv } from "../../../harness/run/workers";
import { runChain } from "../../../harness/run/chain";
import {
  attemptRequirement,
  projectCache,
  waitingFor,
  ResumeAt,
} from "../../../harness/run/attempt";

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
export {
  isRegeneratedMatrix,
  contractNotMet,
  outsideLane,
} from "../../../harness/run/worktree-checks";

/** The part of `plan --format json` the harness reads. */
interface PlanDocument {
  requirements?: HarnessRequirement[];
  next_steps?: Array<{ requirement: string; hint: string }>;
}

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
      // REQ-614: and it runs no test without permission for the test command.
      let testsAllowed: string[] = [];
      const permit = (command: string) => {
        const p = withAgentPermission(command);
        permitted = permitted || p.added;
        const t = withTestPermission(p.command, settings.testCmd);
        if (t.allowed.length > 0) testsAllowed = t.allowed;
        return t.command;
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
      if (testsAllowed.length > 0) {
        info(
          `Claude Code may run the test command and no other: ${testsAllowed
            .map((part) => `\`${part}\``)
            .join(", ")}.`
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
              testCmd: settings.testCmd,
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
