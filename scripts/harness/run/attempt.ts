/**
 * One requirement's attempts, inside its worktree: the agent's sessions, the
 * checks on what it left, the gate, the commit — and what is kept when every
 * attempt is spent.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { harnessCommitMessage } from "../../lib/ticket-keys";
import { runWithDeadline } from "../../lib/run-with-deadline";
import { buildPrompt } from "../prompt";
import { packagesFor } from "../../lib/role-packages";
import {
  appendEvent,
  eventsFileFor,
  eventsLineCount,
  eventsLinesSince,
  keepPrompt,
} from "../../lib/harness-events";
import { onScreen } from "../../lib/screen-requirements";
import { waitAtPause } from "../../lib/harness-guard";
import {
  EVENTS_ATTEMPT_VAR,
  EVENTS_FILE_VAR,
  EVENTS_REQ_VAR,
} from "../../../packages/core/src/domain/HarnessEvents";
import { protectingPattern } from "../../../packages/core/src/domain/WriteScope";
import { agentUnavailable, specSideFailure } from "../../../packages/core/src/domain/RetryPolicy";
import { PROMPT_ARCHIVE_DIR } from "../../../packages/core/src/domain/EmptyAttempt";
import {
  NO_PROBE,
  probeFinding,
  shouldProbe,
  ProbeOutcome,
} from "../../../packages/core/src/domain/AdversarialProbe";
import {
  AttemptRecord,
  StepUsage,
  stepUsage,
  fallbackAttempt,
  AttemptStep,
  planAttempt,
} from "../../../packages/core/src/domain/HarnessRun";
import { cacheEnvironment } from "../../../packages/core/src/domain/DependencyCache";
import { AttemptBudget, costKnown } from "../../../packages/core/src/domain/AttemptBudget";
import { removeTempFile } from "../../lib/temp-file";
import { streamEvent, streamFdOf } from "../../lib/harness-stream";
import {
  scrubText,
  judged,
  promptInFlight,
  HarnessRequirement,
  RunContext,
  RequirementResult,
  WaitingForAnswer,
  DONE_SCRIPT,
  info,
  warn,
  git,
  isGitClean,
  SUBPROCESS_MAX_BUFFER,
} from "./shared";
import { runStateOf } from "./state";
import {
  limitFor,
  agentLine,
  gateReporter,
  runGate,
  discardWorktreeChanges,
  runAdversarialProbe,
  GateResult,
} from "./gate";
import {
  checkDeclaredArtifactsInWorktree,
  checkDecisionRightsInWorktree,
  checkGateCommandInWorktree,
  checkWriteScopeInWorktree,
  contractNotMet,
  laneGuard,
  producedNothing,
  roleInstruction,
} from "./worktree-checks";

/** Where a resumed requirement picks up, and what the gate said last time. */
export interface ResumeAt {
  attempt: number;
  previousFailure: string;
}

/** The context of one requirement's attempts, inside its worktree. */
export interface AttemptContext extends RunContext {
  worktreeDir: string;
  resumeAt: ResumeAt | null;
  matchedProfile: string | null;
}

/** What `attemptRequirement` decides; `processRequirement` adds the rest. */
export type AttemptOutcome = Pick<
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
export function archivePrompt(
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
 * What a session, or a check on what it left, decides about the attempt in
 * progress: go on to the next step, try the requirement again, or stop trying.
 * The loop in `attemptRequirement` is the only place that acts on it.
 */
type Decision =
  | { kind: "proceed" }
  | {
      kind: "retry" | "stop";
      /** How the attempt is recorded as having ended. */
      endedAt: AttemptRecord["endedAt"];
      /** REQ-301: which stage rejected it is what says what to strengthen. */
      gateStage?: string;
      /** What the next prompt, or the report, is told. */
      failure: string;
      /** REQ-586: the attempt to jump to, past rungs of an agent that cannot run now. */
      skipTo?: number;
    };

const PROCEED: Decision = { kind: "proceed" };

/** Another attempt may change the outcome. */
const retry = (
  endedAt: AttemptRecord["endedAt"],
  failure: string,
  extra: { gateStage?: string; skipTo?: number } = {}
): Decision => ({ kind: "retry", endedAt, failure, ...extra });

/** Another attempt cannot change the outcome (#50). */
const stop = (
  endedAt: AttemptRecord["endedAt"],
  failure: string,
  extra: { gateStage?: string } = {}
): Decision => ({ kind: "stop", endedAt, failure, ...extra });

/** What is the same for every attempt of one requirement. */
interface AttemptEnv {
  req: HarnessRequirement;
  ctx: AttemptContext;
  /** The live view's file (ADR-0037), in the project, not the worktree. */
  eventsFile: string;
}

/** What lasts from one attempt of a requirement to the next. */
interface RequirementState {
  /**
   * What the gate said last time, recovered from the prompt archive when this
   * is a resumed run. Without it the agent starts the resumed attempt blind and
   * repeats whatever it already got wrong.
   */
  previousFailure: string;
  /** The reviewer's findings from the previous attempt, fed into this prompt. */
  reviewFindings: string;
  /** REQ-535, REQ-585: what this requirement's sessions have cost, and its ceilings. */
  budget: AttemptBudget;
  costUnknownSaid: boolean;
  /** An empty attempt was retried once already (REQ-417). */
  retriedEmpty: boolean;
}

/** What one attempt adds up, for its record. */
interface AttemptTally {
  attempt: number;
  agentMs: number;
  /** Which roles ran this attempt, in order — the run record's answer to "who did this". */
  profilesUsed: string[];
  /** The tokens each step's agent reported, when its stream said (REQ-509). */
  usageUsed: StepUsage[];
  event: (e: Record<string, unknown> & { type: string }) => void;
}

/**
 * An attempt is a sequence of agent invocations, all bound to this one
 * requirement. Attempt 1 is a single implementing step; a retry may run an
 * advisory reviewer first, whose findings feed the step that follows.
 */
function runSessions(
  steps: AttemptStep[],
  env: AttemptEnv,
  state: RequirementState,
  tally: AttemptTally
): Decision {
  for (const step of steps) {
    // REQ-535: a session after the budget is spent is not started.
    if (state.budget.over()) {
      warn(`${env.req.requirement}: ${state.budget.message()}`);
      return stop("budget", state.budget.message());
    }
    const decision = runSession(step, env, state, tally);
    if (decision.kind !== "proceed") return decision;
  }
  return PROCEED;
}

/**
 * What one step's agent is told. Built per step, not per attempt: the reviewer
 * runs first and the implementing step that follows must see what it said.
 * Building once up front meant findings only ever reached the *next* attempt,
 * which is not what a reviewer is for.
 */
function sessionPrompt(
  step: AttemptStep,
  env: AttemptEnv,
  state: RequirementState,
  attempt: number
): { prompt: string; packages: string[] } {
  const { req, ctx } = env;
  const { worktreeDir, settings, hint } = ctx;
  let packages: string[] = [];
  const prompt = judged(worktreeDir, (dir) => {
    packages = packagesFor(dir, req.requirement).map((p) => p.id);
    return buildPrompt(req, dir, {
      promptPrefix: settings.promptPrefix,
      hint: step.role
        ? [roleInstruction(step.role, req.requirement), hint].filter(Boolean).join("\n\n")
        : hint,
      previousFailure: state.previousFailure || undefined,
      reviewFindings: step.advisory ? undefined : state.reviewFindings || undefined,
      attempt,
      maxAttempts: settings.maxAttempts,
      // Read from the worktree, which carries the matrix at the base
      // commit — the precedent must be work already accepted, not a
      // sibling requirement this same run happens to be writing.
      withPrecedents: settings.promptPrecedents === true,
      testCmd: settings.testCmd,
      e2eDir:
        settings.e2eDir && onScreen(worktreeDir, req.requirement) ? settings.e2eDir : undefined,
    });
  });
  if (packages.length > 0) runStateOf(ctx).notePackagesUsed(req.requirement, packages);
  return { prompt, packages };
}

/** How one agent process ended, and what it used. */
interface AgentRun {
  /** The role it ran as: the lane, the profile, or `agent` / `reviewer`. */
  role: string;
  status: number | null;
  output: string;
  timedOut: boolean;
  /** The tokens and cost its stream reported, when it said (REQ-509). */
  used: StepUsage | null;
  /** REQ-533: put back what it wrote outside its lane, and say so. */
  keepToLane: () => void;
}

/**
 * Run the step's agent on its prompt file, in the worktree: the command of its
 * profile, the environment that says which requirement and attempt this is,
 * the deadline, and — with lanes — what it wrote outside its own, put back.
 */
function runAgent(
  step: AttemptStep,
  env: AttemptEnv,
  tally: AttemptTally,
  promptFile: string
): AgentRun {
  const { req, ctx, eventsFile } = env;
  const { worktreeDir, settings, timeoutMs } = ctx;
  const { attempt, event } = tally;
  // D1: a profile chosen by matching this requirement, when one matches.
  // The role ladder still wins — `attempt_profiles` names a profile for
  // *this step*, and a step that says which role it is has already
  // answered the question.
  const profile = step.profile || ctx.matchedProfile || null;
  const agentCommand = profile ? settings.profileAgents[profile] || settings.agent : settings.agent;
  // REQ-588: in the project's container when \`sandbox:\` names one; REQ-589: its caches.
  const cacheDir = settings.dependencyCache ? projectCache(ctx.projectDir || worktreeDir) : "";
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
  const agentError = agent.error as NodeJS.ErrnoException | undefined;
  const timedOut = agentError?.code === "ETIMEDOUT";
  tally.agentMs += Date.now() - agentStart;
  streamEvent(
    { type: "agent-end", role, exit: agent.status, timedOut, ms: Date.now() - agentStart },
    req.requirement,
    attempt
  );
  tally.profilesUsed.push(role);
  const used = stepUsage(eventsLinesSince(eventsFile, eventsBefore), attempt, role);
  if (used) tally.usageUsed.push(used);
  return {
    role,
    status: agent.status,
    output: `${agent.stdout || ""}${agent.stderr || ""}`,
    timedOut,
    used,
    keepToLane: () => {
      for (const rel of lane ? lane() : []) {
        warn(`${req.requirement}: lane_crossed — ${step.role} wrote ${rel}; reverted`);
        event({ type: "lane", role: step.role, path: rel, result: "reverted" });
      }
    },
  };
}

/**
 * Count what the session used against the requirement's ceiling and the
 * run's. Stops the requirement when the project requires a known cost and the
 * session reported none (REQ-585).
 */
function countSession(env: AttemptEnv, state: RequirementState, run: AgentRun): Decision {
  const { req, ctx } = env;
  const { used, role } = run;
  state.budget.add(used);
  if (used && typeof used.cost === "number") runStateOf(ctx).addSpentUsd(used.cost);
  // A session that says nothing of its cost is not free when the project says so.
  if (ctx.settings.requireKnownCost && !costKnown(used)) {
    const failure =
      `cost_unknown — the ${role} session of ${req.requirement} reported no cost, ` +
      "and require_known_cost is set: it is not counted as free.";
    warn(`${req.requirement}: ${failure}`);
    return stop("budget", failure);
  }
  if (state.budget.limitsCost && !costKnown(used) && !state.costUnknownSaid) {
    state.costUnknownSaid = true;
    warn(
      `${req.requirement}: cost_unknown — the agent reported no cost; ` +
        "max_cost_usd counts its sessions as free"
    );
  }
  return PROCEED;
}

/** What the way the agent ended means for the attempt. */
function sessionEnding(
  step: AttemptStep,
  env: AttemptEnv,
  state: RequirementState,
  attempt: number,
  run: AgentRun
): Decision {
  const { req, ctx } = env;
  const { worktreeDir, settings } = ctx;
  if (run.timedOut) {
    if (step.advisory) {
      warn(`${req.requirement}: reviewer timed out — continuing without findings`);
      return PROCEED;
    }
    warn(`${req.requirement}: agent timed out`);
    return retry("agent-timeout", `Agent timed out after ${ctx.timeoutSeconds}s.`);
  }

  if (step.advisory) {
    // The reviewer advises and nothing more. Its findings become input to
    // the next prompt; anything it wrote is discarded, so it cannot reach
    // the gate. That is the line between this and a committee — the gate
    // stays the only judge, and a reviewer can never approve.
    state.reviewFindings = run.output.trim();
    discardWorktreeChanges(worktreeDir);
    if (run.status !== 0) {
      warn(`${req.requirement}: reviewer exited ${run.status} — findings may be partial`);
    }
    return PROCEED;
  }

  if (run.status === 0) return PROCEED;
  const failure = `Agent exited ${run.status}.\n${run.output}`;
  warn(`${req.requirement}: agent exited ${run.status}`);
  // Out of quota: another attempt seconds later meets the same wall (#50).
  const unavailable = agentUnavailable(run.output);
  if (!unavailable) return retry("agent-error", failure);
  // REQ-586: another profile of the ladder may be available; one that is
  // the same profile again would meet the same wall.
  const fallback = fallbackAttempt(attempt, settings.maxAttempts, settings.attemptProfiles);
  warn(`${req.requirement}: the agent cannot run now — ${unavailable}`);
  if (fallback) {
    warn(`  falling back to profile '${fallback.profile}' (attempt ${fallback.attempt})`);
    return retry("agent-unavailable", failure, { skipTo: fallback.attempt });
  }
  warn(`  not retrying; run it again once the agent is available`);
  return stop("agent-unavailable", failure);
}

/** One agent invocation: its prompt, its process, what it used, how it ended. */
function runSession(
  step: AttemptStep,
  env: AttemptEnv,
  state: RequirementState,
  tally: AttemptTally
): Decision {
  const { req, ctx } = env;
  const { worktreeDir } = ctx;
  const { attempt, event } = tally;
  const { prompt, packages } = sessionPrompt(step, env, state, attempt);
  const promptFile = path.join(
    os.tmpdir(),
    `specgate-harness-prompt-${req.requirement}-${crypto.randomBytes(4).toString("hex")}.md`
  );
  // REQ-579: readable by this user only — it may quote the gate's output —
  // and removed even when the session throws.
  fs.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 0o600 });
  let run: AgentRun;
  try {
    archivePrompt(worktreeDir, req.requirement, attempt, step, prompt);
    // The live view shows what the agent was told and how big it was (REQ-182).
    keepPrompt(ctx.projectDir || worktreeDir, req.requirement, attempt, prompt);
    event({
      type: "prompt",
      role: step.profile || (step.advisory ? "reviewer" : "agent"),
      chars: prompt.length,
      lines: prompt.split("\n").length,
      // REQ-317: which role packages it carried.
      ...(packages.length > 0 ? { packages } : {}),
    });
    run = runAgent(step, env, tally, promptFile);
  } finally {
    removeTempFile(promptFile);
  }
  const counted = countSession(env, state, run);
  if (counted.kind !== "proceed") return counted;
  run.keepToLane();
  return sessionEnding(step, env, state, attempt, run);
}

/**
 * Before the gate: what the agent left that the gate must not be asked about —
 * nothing at all, or the contract it is judged against.
 */
function checksBeforeGate(env: AttemptEnv, state: RequirementState, attempt: number): Decision {
  const { req, ctx } = env;
  const { worktreeDir, settings } = ctx;
  // An agent that wrote nothing cannot have implemented anything, and the
  // gate would approve it. See `producedNothing` (H19).
  // REQ-264: the same command writes nothing the next time either — three
  // attempts and 7 min 40 s said so in truck-flote (S50) — so it ends here.
  if (producedNothing(worktreeDir)) {
    // REQ-417: the agent wrote for another requirement of this run, so it
    // can write; one more attempt, told so, before giving up.
    if (runStateOf(ctx).agentWrote() && !state.retriedEmpty && attempt < settings.maxAttempts) {
      state.retriedEmpty = true;
      warn(`${req.requirement}: the agent produced no files — retrying once`);
      warn(`  it wrote files for another requirement of this run, so it can write`);
      return retry(
        "no-op",
        `You produced no files. Nothing in the worktree changed, so there is ` +
          `nothing implementing ${req.requirement}. Write its test first, then the ` +
          `code that makes it pass, in this worktree.`
      );
    }
    warn(`${req.requirement}: the agent produced no files — nothing to gate`);
    warn(
      `  fix: give the agent write permission and the tools it needs (docs/agent-setup.md, § Tool allowances)`
    );
    warn(`  not retrying: the same command would write nothing again`);
    return stop(
      "no-op",
      `You produced no files. Nothing in the worktree changed, so there is ` +
        `nothing implementing ${req.requirement}.\n\n` +
        `If you could not write, that is the problem to report — a non-interactive ` +
        `agent without tool permissions reads the prompt and cannot act on it. ` +
        `See docs/agent-setup.md, § Tool allowances.`
    );
  }

  runStateOf(ctx).markAgentWrote();

  // A scenario the agent has just loosened cannot fail, so a green gate
  // proves nothing. See `checkWriteScopeInWorktree`.
  const scope = checkWriteScopeInWorktree(worktreeDir, settings);
  if (scope) {
    warn(`${req.requirement}: ${scope.violations.length} protected path(s) modified`);
    for (const v of scope.violations) warn(`  ${v.path} (${v.pattern})`);
    return retry("write-scope", scope.message);
  }

  // Same reason as the write-scope guard, one level up: a gate command the
  // agent has just loosened cannot fail either.
  const gateCmd = checkGateCommandInWorktree(worktreeDir, "HEAD", settings.testCmd);
  if (gateCmd) {
    warn(`${req.requirement}: the agent rewrote the gate command`);
    warn(`  ${gateCmd.manifest} → scripts.${gateCmd.script}`);
    return retry("write-scope", gateCmd.message);
  }

  // REQ-547: a decision kept for a person, taken anyway.
  const rights = checkDecisionRightsInWorktree(worktreeDir);
  if (rights) {
    for (const e of rights.exceeded) {
      warn(
        `${req.requirement}: decision_right_exceeded — ${e.decision} in ${e.file} (${e.detail})`
      );
    }
    return retry("decision-right", rights.message);
  }
  return PROCEED;
}

/** The gate, and what its failure means for another attempt. */
function judgeAtGate(env: AttemptEnv, attempt: number): { decision: Decision; gate: GateResult } {
  const { req, ctx, eventsFile } = env;
  const { worktreeDir, settings, timeoutMs } = ctx;
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
  if (gate.ok) return { decision: PROCEED, gate };
  if (gate.couldNotRun) {
    // REQ-267: nothing in the code can fix the tool's own setup, and another
    // attempt would meet it again (truck-flote S52: 15 minutes each).
    warn(`${req.requirement}: ${gate.couldNotRun}`);
    for (const line of gate.output.trim().split("\n").slice(-5)) warn(`  ${line}`);
    warn(
      gate.stage.startsWith("quality check")
        ? `  not retrying: fix the check (harness.config.yaml) and run it again`
        : `  not retrying: the agent cannot fix the machine`
    );
    return {
      gate,
      decision: stop(
        "check",
        `Gate stopped at: ${gate.stage}\n\n${gate.couldNotRun}\n\n${gate.output}`,
        { gateStage: gate.stage }
      ),
    };
  }
  const failure =
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
    warn(
      `${req.requirement}: the failure is in ${specFiles.join(", ")}, which the agent may not edit`
    );
    warn(`  not retrying; fix the specification and run it again`);
    return {
      gate,
      decision: stop(
        "spec",
        `The gate fails on the specification, which the agent may not edit:\n` +
          specFiles.map((f) => `  ${f}`).join("\n") +
          `\n\nFix the scenario (a person, or \`specgate change\`), then run the harness again.\n\n` +
          failure,
        { gateStage: gate.stage }
      ),
    };
  }
  return { gate, decision: retry("gate", failure, { gateStage: gate.stage }) };
}

/** Green — but is what the requirement promised in the diff? */
function checksAfterGate(env: AttemptEnv): Decision {
  const { req, ctx } = env;
  const { worktreeDir } = ctx;
  // Does the diff contain what the row promised? (A2)
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
      return retry(
        "artifacts",
        `The gate passed, but the diff never touches the artifacts the matrix ` +
          `declares for ${req.requirement}:\n\n` +
          artifacts.map((f) => `  ${f.message}\n  fix: ${f.fix}`).join("\n\n") +
          `\n\nA matrix that points at a file where the logic does not live is a ` +
          `documentary lie. Implement it there, or correct the row.`
      );
    }
  }

  // REQ-418: green, but a requirement citing an operation serves or calls
  // its path. In runs 7 and 8 tracking served no route of the contract and
  // web called none, and every requirement passed (truck-flote, MS7-1).
  const missing = contractNotMet(worktreeDir, ctx.projectDir || worktreeDir, req.requirement);
  if (missing.length) {
    for (const d of missing) {
      warn(`${req.requirement}: ${d.message} [${d.code}]`);
      if (d.fix) warn(`  fix: ${d.fix}`);
    }
    discardWorktreeChanges(worktreeDir);
    return retry(
      "gate",
      `The gate passed, but the code does not serve or call the operation ` +
        `${req.requirement} cites:\n\n` +
        missing.map((d) => `  ${d.message}\n  fix: ${d.fix}`).join("\n\n"),
      { gateStage: "contract operation" }
    );
  }
  return PROCEED;
}

/**
 * Close the loop inside the worktree: mark the requirement and commit. The
 * gate before it is the check; `done` running its own again would only double
 * the slowest step.
 */
function closeAttempt(env: AttemptEnv, attempt: number): Decision {
  const { req, ctx } = env;
  const { worktreeDir, settings } = ctx;
  const done = spawnSync(
    process.execPath,
    [DONE_SCRIPT, req.requirement, "--no-check", "--project-dir", worktreeDir],
    { encoding: "utf8", timeout: ctx.timeoutMs, maxBuffer: SUBPROCESS_MAX_BUFFER }
  );
  if (done.status !== 0) {
    warn(`${req.requirement}: done failed`);
    return retry("done", `done ${req.requirement} failed:\n${done.stdout}${done.stderr}`);
  }

  git(worktreeDir, ["add", "-A"]);
  const commit = git(worktreeDir, [
    "commit",
    "-m",
    harnessCommitMessage(worktreeDir, req.requirement, attempt, settings.maxAttempts),
  ]);
  if (commit.status !== 0) {
    warn(`${req.requirement}: commit failed`);
    return retry("commit", `git commit failed:\n${commit.stderr || commit.stdout}`);
  }
  return PROCEED;
}

/**
 * REQ-591: a person looks at the failed attempt before the next one starts.
 * Waits for `specgate harness continue`; false when it said not to retry.
 */
function goOnAfterPause(
  env: AttemptEnv,
  attempt: number,
  last: AttemptRecord | undefined
): boolean {
  const { req, ctx, eventsFile } = env;
  info(
    `${req.requirement}: paused before attempt ${attempt} — ` +
      "`specgate harness continue` starts it, `--stop` does not"
  );
  appendEvent(eventsFile, { type: "pause", next: attempt }, req.requirement, attempt - 1);
  const go = waitAtPause(ctx.projectDir, {
    requirement: req.requirement,
    attempt: attempt - 1,
    stage: last?.gateStage || last?.endedAt || "",
  });
  if (!go) warn(`${req.requirement}: not retried, as asked`);
  return go;
}

/**
 * The adversary runs **after** the commit, and the order is not cosmetic:
 * before it, `git status` shows the implementer's uncommitted work, so
 * discarding "what the probe wrote" would throw the implementation away and
 * report a pass over an empty branch. That is the H19 family — a green
 * verdict over work that is not there — and it was reintroduced here once.
 *
 * The probe never changes the verdict; it travels beside it.
 */
function probeAfterCommit(env: AttemptEnv, before: ProbeOutcome): ProbeOutcome {
  const { req, ctx } = env;
  const { worktreeDir, settings, timeoutMs } = ctx;
  if (
    !shouldProbe({
      profile: settings.adversaryProfile,
      gatePassed: true,
      alreadyProbed: before.ran,
    })
  ) {
    return before;
  }
  info(`${req.requirement}: probing with '${settings.adversaryProfile}'`);
  const probe = runAdversarialProbe(worktreeDir, req, settings, timeoutMs, (instruction) =>
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
  return probe;
}

/**
 * One requirement's attempts: each is its sessions, the checks on what they
 * left, the gate and the commit, in that order, and the first of them that
 * does not let the attempt proceed says whether there is another.
 */
export function attemptRequirement(req: HarnessRequirement, ctx: AttemptContext): AttemptOutcome {
  const { worktreeDir, settings } = ctx;
  const state: RequirementState = {
    previousFailure: (ctx.resumeAt && ctx.resumeAt.previousFailure) || "",
    reviewFindings: "",
    budget: new AttemptBudget(req.requirement, {
      maxCostUsd: settings.maxCostUsd,
      maxTokens: settings.maxTokens,
    }),
    costUnknownSaid: false,
    retriedEmpty: false,
  };
  /**
   * What each attempt cost and where it ended.
   *
   * Wall-clock, because it is the one cost the harness can measure without the
   * agent's cooperation: an agent is any shell command, and only the agent
   * knows what it spent in tokens. `specgate harness report` is built on this.
   */
  const attemptLog: AttemptRecord[] = [];
  let probe: ProbeOutcome = NO_PROBE;

  const firstAttempt = Math.max(1, (ctx.resumeAt && ctx.resumeAt.attempt) || 1);
  /** Set when another attempt cannot change the outcome (#50). */
  let stopRetrying = false;

  const eventsFile = eventsFileFor(ctx.projectDir || worktreeDir, req.requirement);
  const env: AttemptEnv = { req, ctx, eventsFile };
  for (let attempt = firstAttempt; attempt <= settings.maxAttempts; attempt += 1) {
    // REQ-535: a retry is more sessions, and the budget is spent.
    if (state.budget.over()) {
      warn(`${req.requirement}: ${state.budget.message()}`);
      state.previousFailure = `${state.budget.message()}\n\n${state.previousFailure}`;
      stopRetrying = true;
      break;
    }
    if (ctx.pauseBetweenAttempts && attempt > firstAttempt && ctx.projectDir) {
      if (!goOnAfterPause(env, attempt, attemptLog.at(-1))) {
        stopRetrying = true;
        break;
      }
    }
    info(`${req.requirement}: attempt ${attempt}/${settings.maxAttempts}`);
    const attemptStart = Date.now();
    const tally: AttemptTally = {
      attempt,
      agentMs: 0,
      profilesUsed: [],
      usageUsed: [],
      event: (e) => appendEvent(eventsFile, e, req.requirement, attempt),
    };
    tally.event({ type: "attempt", state: "start" });
    const record = (stage: AttemptRecord["endedAt"], gateStage?: string) => {
      tally.event({
        type: "attempt",
        state: "end",
        result: stage === "pass" ? "pass" : stage === "question" ? "question" : "fail",
        ...(stage === "pass" ? {} : { stage }),
      });
      attemptLog.push({
        attempt,
        endedAt: stage,
        agentMs: tally.agentMs,
        totalMs: Date.now() - attemptStart,
        profiles: [...tally.profilesUsed],
        ...(gateStage ? { gateStage } : {}),
        ...(tally.usageUsed.length > 0 ? { usage: [...tally.usageUsed] } : {}),
      });
      runStateOf(ctx).ledgerAttempts(attemptLog);
    };

    const steps = planAttempt(attempt, {
      attemptProfiles: settings.attemptProfiles,
      reviewProfile: settings.reviewProfile || null,
      roles: settings.lanes || [],
    });
    let decision = runSessions(steps, env, state, tally);

    // The agent asked instead of guessing (REQ-189): another attempt would
    // meet the same question, and the gate has nothing to judge.
    // REQ-495: the run does not wait for the answer. It becomes an assumption
    // a person reviews before the specification says it (REQ-188); building
    // on it first would gate a scenario that does not say what was answered.
    const asked =
      decision.kind === "proceed" ? questionAsked(eventsFile, attempt, attemptStart) : null;
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

    let gate: GateResult | null = null;
    if (decision.kind === "proceed") decision = checksBeforeGate(env, state, attempt);
    if (decision.kind === "proceed") ({ decision, gate } = judgeAtGate(env, attempt));
    if (decision.kind === "proceed") decision = checksAfterGate(env);
    if (decision.kind === "proceed") decision = closeAttempt(env, attempt);

    if (decision.kind !== "proceed") {
      state.previousFailure = decision.failure;
      record(decision.endedAt, decision.gateStage);
      if (decision.kind === "stop") {
        stopRetrying = true;
        break;
      }
      // REQ-586: the loop's own step brings it to the fallback's attempt.
      if (decision.skipTo && decision.skipTo > attempt + 1) attempt = decision.skipTo - 1;
      continue;
    }

    // Once per requirement, not once per attempt: probing an implementation that
    // already failed tells you nothing, and probing every retry multiplies the
    // cost of the one step in the loop that is pure insurance.
    probe = probeAfterCommit(env, probe);

    record("pass");
    return {
      result: "pass",
      attempts: attempt,
      attemptLog,
      // The probe never changes the verdict; it travels beside it so
      // `harness report` and the run record can show what it found.
      ...(probe.ran ? { adversarial: probe } : {}),
      ...(gate && gate.checks
        ? { checks: gate.checks.map(({ output: _o, ...rest }) => rest) }
        : {}),
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
  const preserved = preserveFailedAttempt(worktreeDir, req, state.previousFailure);

  return {
    result: "fail",
    // Attempts *this* run spent. On a resume that starts at 3 of 3, one attempt
    // was spent here, and reporting 3 would double-count the earlier run's.
    attempts: stopRetrying ? attemptLog.length : settings.maxAttempts - firstAttempt + 1,
    error: state.previousFailure,
    workPreserved: preserved,
    attemptLog,
  };
}

/** A question an agent asked, with where it was recorded once it was (REQ-494). */
export interface AskedQuestion {
  text: string;
  id?: string;
  change?: string;
  file?: string;
}

/** The question the agent recorded with `specgate ask` during this attempt, if any (REQ-189). */
export function questionAsked(
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
export function waitingFor(q: {
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

export function preserveFailedAttempt(
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
 * REQ-589: the project's download cache, made if absent — a container mounts
 * only a folder that exists — and ignored by git, as the events folder is: a
 * cache that showed as untracked files would make the next run refuse a
 * working tree that is not clean.
 */
export function projectCache(projectDir: string): string {
  const dir = path.join(projectDir, ".harness", "cache");
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  return dir;
}
