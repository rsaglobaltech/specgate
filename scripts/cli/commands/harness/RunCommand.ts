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
import { HarnessInterrupted } from "../../../lib/run-with-deadline";
import * as ui from "../../../lib/ui";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { resolveProjectDir } from "../../../lib/project-root";
import { buildPrompt } from "../../../harness/prompt";
import { withAgentPermission, withTestPermission } from "../../../lib/agent-permission";
import { detectSetupCommand } from "../../../harness/init";
import { inFlightRequirements } from "../../../lib/in-flight";
import { writeQueue } from "../../../lib/harness-events";
import { acquireRunLock, orderAsGiven, runLockHolder, takeStop } from "../../../lib/harness-guard";
import { dockerWhyNot } from "../../../lib/quality-run";
import { dockerNeed } from "../../../lib/harness-environment";
import { maskCommand, secretNames } from "../../../../packages/core/src/domain/HarnessEvents";
import {
  readHarnessConfig,
  readProfileRules,
  resolveHarnessSettings,
  resolveProfileAgent,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { agentIo } from "../../../lib/agent";
import { withRework } from "../../../../packages/core/src/domain/RequirementPlan";
import { hasBudget } from "../../../../packages/core/src/domain/RunBudget";
import { exportRunTrace } from "../../../lib/otel-export";
import { setStream, streamEvent, streamFromEnv } from "../../../lib/harness-stream";
import { recordQuestion } from "../../../lib/agent-watch";
import {
  judged,
  HarnessRequirement,
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
} from "../../../harness/run/shared";
import { ledgerWrite, setLedger, writeRunRecord } from "../../../harness/run/state";
import { workerCommandsFromEnv } from "../../../harness/run/workers";
import { runChain } from "../../../harness/run/chain";
import { waitingFor } from "../../../harness/run/attempt";

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
export { dropIntegrationBranches } from "../../../harness/run/branches";
export { parseArgs } from "../../../harness/run/cli";
export { harnessQueue, runLevels } from "../../../harness/run/levels";
export { publishBranch } from "../../../harness/run/requirement";
export {
  RunDirty,
  RunStopped,
  printReport,
  reportDocument,
  runStopped,
} from "../../../harness/run/run-report";
export {
  isRegeneratedMatrix,
  contractNotMet,
  outsideLane,
} from "../../../harness/run/worktree-checks";
import {
  uncommittedPaths,
  dropIntegrationBranches,
  gitIdentityProblem,
} from "../../../harness/run/branches";
import { RunDirty, printReport } from "../../../harness/run/run-report";
import { dispatchLevel, runLevels, harnessQueue } from "../../../harness/run/levels";
import { parseArgs } from "../../../harness/run/cli";

/** The part of `plan --format json` the harness reads. */
interface PlanDocument {
  requirements?: HarnessRequirement[];
  next_steps?: Array<{ requirement: string; hint: string }>;
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
