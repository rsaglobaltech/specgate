/**
 * One requirement, from its branch to its verdict: whether it is ready, the
 * worktree it is built in (new, or the one an interrupted run left), where a
 * resumed run picks up, its attempts, and publishing a branch that passed.
 *
 * The attempts themselves are `attempt.ts`; which requirements run, and how
 * many at once, is `levels.ts`.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Diagnostic } from "../../../packages/core/src/domain/Diagnostic";
import {
  HarnessRequirement,
  PublishOutcome,
  RequirementResult,
  RunContext,
  SUBPROCESS_MAX_BUFFER,
  error,
  git,
  info,
  unattempted,
  warn,
} from "./shared";
import { HarnessSettings } from "../../../packages/core/src/infrastructure/HarnessConfigFile";
import { PROMPT_ARCHIVE_DIR } from "../../../packages/core/src/domain/EmptyAttempt";
import { RequirementPlan } from "../../../packages/core/src/domain/RequirementPlan";
import { ResumeAt, attemptRequirement, projectCache } from "./attempt";
import { analyseGherkinSource } from "../../../packages/core/src/domain/GherkinQuality";
import { branchExists, existingWorktreeFor, warnIfBaseIsStale } from "./branches";
import {
  branchMergedInto,
  existingBranchAction,
  freeBytes,
  lowDiskMessage,
  minFreeBytes,
} from "../../lib/harness-guard";
import { cacheEnvironment } from "../../../packages/core/src/domain/DependencyCache";
import { runStateOf } from "./state";
import { eventsFileFor } from "../../lib/harness-events";
import { featureFilePath } from "../../../packages/core/src/domain/HarnessRun";
import { gateReporter, limitFor } from "./gate";
import { inFlightRequirements } from "../../lib/in-flight";
import { isDerivedProject } from "../../lib/derived-writes";
import { maskCommand } from "../../../packages/core/src/domain/HarnessEvents";
import { missingApprovals } from "../../lib/approvals";
import { harnessTrustRefusal, runIntent } from "../../lib/trust";
import { parseMatrixContexts } from "../../../packages/core/src/domain/TraceabilityFormat";
import {
  previousFailureFromPrompt,
  resumePoint,
} from "../../../packages/core/src/domain/ResumeState";
import { quoteArg } from "../../lib/escape";
import { requirementReadiness } from "../../../packages/core/src/domain/RequirementReadiness";
import { runWithDeadline, wasInterrupted } from "../../lib/run-with-deadline";
import { selectProfile } from "../../../packages/core/src/domain/ProfileMatch";
import { requirementCapabilities } from "../../lib/capabilities";
import { ensureSandbox } from "../../lib/sandbox-registry";
import { withWorktreeLock } from "../worktree-lock";
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
export function resumeFrom(worktreeDir: string, requirement: string): ResumeAt {
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
export function readinessOf(projectDir: string, req: HarnessRequirement) {
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
export function settingsOf(ctx: Partial<RunContext> | null | undefined): Partial<HarnessSettings> {
  return (ctx && ctx.settings) || {};
}

/**
 * The bounded context a requirement belongs to, as `expand` wrote it (D1).
 *
 * Read from the matrix rather than the pack: a project may install several
 * packs, and the matrix is its own record of what it has.
 */
export function contextOfRequirement(projectDir: string, requirement: string): string {
  const matrix = path.join(projectDir, "docs", "specs", "traceability.md");
  try {
    return parseMatrixContexts(fs.readFileSync(matrix, "utf8"))[requirement] || "";
  } catch {
    return "";
  }
}

export function processRequirement(req: HarnessRequirement, ctx: RunContext): RequirementResult {
  const run = runStateOf(ctx);
  const starting = run.currentLedger();
  if (starting) {
    starting.record.running = {
      requirement: req.requirement,
      startedAt: new Date().toISOString(),
      attemptLog: [],
    };
    run.ledgerWrite();
  }
  const result = processOneRequirement(req, ctx);
  const used = run.packagesUsedBy(req.requirement);
  if (used && used.size > 0) result.packages = [...used];
  const ending = run.currentLedger();
  if (ending) {
    ending.record.results.push(result);
    delete ending.record.running;
    run.ledgerWrite();
  }
  // A worker's result reaches the stream through its parent, which reads its report.
  if (!process.env.SPECGATE_HARNESS_WORKER) run.streamResult(result);
  return result;
}

/**
 * Why this requirement is not handed to an agent at all, if so: its change
 * waits for an approval, its scenario could not fail, it is not ready and the
 * run skips those, or the disk is too full to start. Everything a person can
 * act on is said here, before any worktree exists.
 */
function refusedBeforeStarting(
  req: HarnessRequirement,
  ctx: RunContext,
  branch: string
): RequirementResult | null {
  const { projectDir } = ctx;
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

  // REQ-671: only what the module's trust level allows.
  const untrusted = harnessTrustRefusal(projectDir, req.requirement, owning?.change, runIntent());
  if (untrusted) {
    warn(`${req.requirement}: ${untrusted}`);
    return unattempted(req.requirement, req.category, "skipped", branch, untrusted);
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

  // A full disk mid-copy ended a night's chain with ENOSPC (REQ-184): stop
  // before starting, with the reason, instead.
  const lowDisk = lowDiskMessage(freeBytes(os.tmpdir()), minFreeBytes(), os.tmpdir());
  if (lowDisk) {
    return unattempted(req.requirement, req.category, "fail", branch, `Not started: ${lowDisk}`);
  }
  return null;
}

/**
 * The requirement's branch, when one is already there: three ways to meet it,
 * and until C3 there were only two — skip it, or delete it with --force. After
 * an interruption — a crash, a Ctrl-C, a spend limit — neither is what anyone
 * wants. Says whether this run resumes it, or why the requirement is not run.
 */
function claimBranch(
  req: HarnessRequirement,
  ctx: RunContext,
  branch: string
): { resuming: boolean } | { refused: RequirementResult } {
  const { projectDir, baseRef, force } = ctx;
  const exists = branchExists(projectDir, branch);
  // A branch already merged into the base holds nothing to lose (REQ-185).
  const merged = exists && branchMergedInto(projectDir, branch, baseRef);
  const action = existingBranchAction({ exists, merged, resume: Boolean(ctx.resume), force });
  if (!exists) {
    // Nothing to resume is not an error: --resume over a whole plan should run
    // the requirements that never started, not refuse the lot.
    if (ctx.resume) info(`${req.requirement}: nothing to resume, starting fresh`);
    return { resuming: false };
  }
  if (action === "resume") return { resuming: true };
  if (action === "skip") {
    return {
      refused: unattempted(
        req.requirement,
        req.category,
        "skipped",
        branch,
        `Branch ${branch} already exists. Re-run with --resume to continue it, ` +
          `or --force to recreate it from scratch.`
      ),
    };
  }
  if (merged && !force) info(`${req.requirement}: ${branch} is already merged — recreating it`);
  const deleted = git(projectDir, ["branch", "-D", branch]);
  // REQ-579: said here, rather than as a confusing failure to create it below.
  if (deleted.status !== 0) {
    return {
      refused: unattempted(
        req.requirement,
        req.category,
        "fail",
        branch,
        `could not delete ${branch} to recreate it:\n${deleted.stderr || deleted.stdout}`
      ),
    };
  }
  return { resuming: false };
}

/**
 * The worktree the requirement is built in. A surviving one still holds the
 * partial work; re-attaching to it is what makes this a resume rather than a
 * restart. Otherwise a new one is added, on a new branch or on the one resumed.
 */
function openWorktree(
  req: HarnessRequirement,
  ctx: RunContext,
  branch: string,
  resuming: boolean
): { dir: string; survivor: boolean } | { refused: RequirementResult } {
  const { projectDir, baseRef } = ctx;
  const survivor = resuming ? existingWorktreeFor(projectDir, branch) : null;
  if (survivor) return { dir: survivor, survivor: true };
  // sandbox-swarm REQ-698: inside the folder of its module's sandbox, made the first time.
  const dir = path.join(
    sandboxBase(req, ctx) || os.tmpdir(),
    `specgate-harness-${req.requirement}-${crypto.randomBytes(4).toString("hex")}`
  );
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
      refused: unattempted(
        req.requirement,
        req.category,
        "fail",
        branch,
        `git worktree add failed:\n${add.stderr || add.stdout}`
      ),
    };
  }
  return { dir, survivor: false };
}

/**
 * A fresh worktree has no dependencies: run the setup command in it, as a
 * stage the live view shows. Returns why the requirement stops, if it failed.
 */
function setUpWorktree(
  req: HarnessRequirement,
  ctx: RunContext,
  branch: string,
  dir: string
): RequirementResult | null {
  const setupCmd = String((ctx.settings && ctx.settings.setupCmd) || "").trim();
  if (!setupCmd) return null;
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
  if (setup.status === 0) return null;
  return unattempted(
    req.requirement,
    req.category,
    "fail",
    branch,
    `setup_cmd failed before the agent ran:\n${setup.stdout || ""}${setup.stderr || ""}`
  );
}

/**
 * One requirement, from its branch to its verdict: refused before starting,
 * or its branch claimed, its worktree opened and set up, its attempts run and
 * a branch that passed published — and the worktree removed, or kept for
 * `--resume` when the run was interrupted.
 */
export function processOneRequirement(req: HarnessRequirement, ctx: RunContext): RequirementResult {
  const { projectDir, baseRef, keepWorktrees } = ctx;
  const branch = `harness/${req.requirement}`;

  // D1: which profile this requirement matches, resolved once. The bounded
  // context comes from the matrix, where `expand` derived it — see
  // `boundedContextOf`.
  const matchedProfile = selectProfile(settingsOf(ctx).profileRules || [], {
    requirement: req.requirement,
    boundedContext: contextOfRequirement(projectDir, req.requirement),
    featureFile: featureFilePath(req),
    category: req.category,
    // agent-routing REQ-688: a module's own agent.
    module: requirementCapabilities(projectDir).get(req.requirement),
  });
  if (matchedProfile) info(`${req.requirement}: profile '${matchedProfile}' matched`);

  const refused = refusedBeforeStarting(req, ctx, branch);
  if (refused) return refused;

  const claim = claimBranch(req, ctx, branch);
  if ("refused" in claim) return claim.refused;
  const { resuming } = claim;

  warnIfBaseIsStale(projectDir, req.requirement, baseRef);
  const startedAt = Date.now();

  const worktree = openWorktree(req, ctx, branch, resuming);
  if ("refused" in worktree) return worktree.refused;
  const { dir, survivor } = worktree;

  try {
    const setupFailed = survivor ? null : setUpWorktree(req, ctx, branch, dir);
    if (setupFailed) return setupFailed;
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
    // `dir` is the worktree in use: on a resume, the one that survived the
    // interruption. Removing any other path leaves the real worktree
    // registered and the next --resume unable to attach.
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
 * sandbox-swarm REQ-698: with `sandbox: { engine: sbx }`, the folder of the
 * sandbox of the requirement's change and module — made, opened and set up
 * the first time; else null.
 */
function sandboxBase(req: HarnessRequirement, ctx: RunContext): string | null {
  const sandbox = settingsOf(ctx).sandbox;
  if (!sandbox || sandbox.engine !== "sbx") return null;
  const id = String(req.requirement || "");
  const owning = inFlightRequirements(ctx.projectDir).find((r) => r.id === id);
  const change = owning?.change || path.basename(ctx.projectDir);
  const module = requirementCapabilities(ctx.projectDir).get(id) || "project";
  return ensureSandbox(ctx.projectDir, sandbox, change, module, (line) => info(line)).workspace;
}
