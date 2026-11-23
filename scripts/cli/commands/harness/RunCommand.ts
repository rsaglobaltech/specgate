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

import { agentPreflight } from "../../../harness/doctor";
import { HarnessInterrupted } from "../../../lib/run-with-deadline";
import * as ui from "../../../lib/ui";
import { BaseCommand } from "../../../lib/command";
import { resolveProjectDir } from "../../../lib/project-root";
import { agentIo } from "../../../lib/agent";
import { setStream, streamFromEnv } from "../../../lib/harness-stream";
import { setJsonMode, isJsonMode, info, error } from "../../../harness/run/shared";
import { workerCommandsFromEnv } from "../../../harness/run/workers";
import { runChain } from "../../../harness/run/chain";
import {
  runSettings,
  runQueue,
  printDryRun,
  preflight,
  startRun,
  finishRun,
} from "../../../harness/run/prepare";

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
export { RUNS_DIR, RunRecord } from "../../../harness/run/state";
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
export { baselineProblem } from "../../../harness/run/prepare";
export {
  isRegeneratedMatrix,
  contractNotMet,
  outsideLane,
} from "../../../harness/run/worktree-checks";
import { printReport } from "../../../harness/run/run-report";
import { dispatchLevel, runLevels } from "../../../harness/run/levels";
import { parseArgs } from "../../../harness/run/cli";

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

      const { settings, unkept } = runSettings(projectDir, args);
      const { plan, pending, hintByReq } = runQueue(projectDir, args);

      if (pending.length === 0) {
        if (args.format === "jsonl") printReport([], "jsonl");
        if (isJsonMode()) info("No pending requirements. Nothing to do.");
        else
          process.stdout.write(
            ui.header("harness run") + ui.ok("No pending requirements. Nothing to do.") + "\n"
          );
        process.exit(0);
      }
      if (args.dryRun) {
        printDryRun(projectDir, args, settings, pending, hintByReq);
        process.exit(0);
      }

      // agent-routing REQ-691: every agent this run needs answers, before any worktree.
      if (
        !args.skipDoctor &&
        !process.env.SPECGATE_SKIP_DOCTOR?.match(/^(1|true|yes)$/i) &&
        !process.env.SPECGATE_HARNESS_WORKER
      ) {
        agentPreflight(projectDir, settings, pending);
      }
      const dirty = preflight(projectDir, args, settings, plan, pending);
      const { ctx, runRecordBase } = startRun(projectDir, args, settings, pending, dirty);
      const results = args.chain
        ? await runChain(pending, ctx, hintByReq, (reqs, levelCtx, hints) =>
            runLevels(reqs, levelCtx, { concurrency: 1, hintByReq: hints, runOne: dispatchLevel })
          )
        : await runLevels(pending, ctx, {
            concurrency: settings.concurrency,
            hintByReq,
            runOne: dispatchLevel,
          });
      process.exit(
        await finishRun(projectDir, args, results, runRecordBase, dirty, unkept, ctx.run)
      );
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
                code: codeOf(thrown),
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
              status: [{ severity: "error", code: codeOf(thrown), message: thrown.message }],
            }) + "\n"
          );
        } else error(thrown.message || String(err));
        process.exit(exitCode);
      }
      const io = agentIo(isJson);
      return io.fail({ results: null }, [
        { severity: "error", code: codeOf(thrown), message: thrown.message || String(err) },
      ]);
    }
  }
}

/** A refusal's own code (`harness_no_commit`, REQ-643), else the run's. */
function codeOf(thrown: { code?: unknown; message?: string }): string {
  return typeof thrown.code === "string" && thrown.code.startsWith("harness_")
    ? thrown.code
    : "harness_run_error";
}
