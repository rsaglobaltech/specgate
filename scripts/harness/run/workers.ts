/**
 * `harness run --concurrency N`: each requirement in a worker process running
 * this same command, and the report each one prints.
 */

import * as path from "node:path";
import { ChildProcess, spawn } from "node:child_process";
import { reportedCost } from "../../../packages/core/src/domain/RunBudget";
import { STREAM_FD_VAR, streamFdOf, streamRaw } from "../../lib/harness-stream";
import {
  HarnessRequirement,
  RunContext,
  RequirementResult,
  SCRIPTS_DIR,
  info,
  notAttempted,
  unattempted,
} from "./shared";
import { addRunSpentUsd, streamResult } from "./state";

/**
 * What a worker process runs.
 *
 * It must be the file the command registry spawns, not this module: this one
 * defines the command but does not execute it, so pointing a worker at
 * `__filename` starts a process that loads, does nothing and exits 0 — which
 * the parent reports as "Worker produced no report".
 */
export const WORKER_ENTRY = path.join(SCRIPTS_DIR, "harness", "run.js");

/**
 * Run requirements in parallel worker processes, at most `concurrency` at a
 * time, and collect their reports.
 *
 * Each worker prints a one-requirement JSON report; the parent parses it. A
 * worker that dies without printing one is reported as a failure carrying its
 * output, rather than vanishing from the run.
 */
export function runWorkers(
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
          results.push(
            notAttempted(byId ? byId.get(id) : null, id, ctx.stopReason!(), ctx.stopCode?.())
          );
          continue;
        }
        // REQ-497: a streaming run gives each worker a pipe of its own as fd 3,
        // read here line by line, so two workers' lines never interleave.
        const streaming = streamFdOf() !== null;
        const child = spawn(process.execPath, [WORKER_ENTRY, ...workerArgs(id, ctx)], {
          env: {
            ...process.env,
            SPECGATE_HARNESS_WORKER: "1",
            [WORKER_ARGS_VAR]: JSON.stringify(workerCommands(ctx)),
            ...(streaming ? { [STREAM_FD_VAR]: "3" } : {}),
          },
          stdio: ["pipe", "pipe", "pipe", streaming ? "pipe" : "ignore"],
        });
        if (streaming) {
          let partial = "";
          const events = child.stdio[3] as NodeJS.ReadableStream;
          events.setEncoding("utf8");
          events.on("data", (d: string) => {
            const parts = (partial + d).split("\n");
            partial = parts.pop() ?? "";
            for (const line of parts) streamRaw(line);
          });
          events.on("end", () => {
            if (partial) streamRaw(partial);
            partial = "";
          });
        }

        let stdout = "";
        let stderr = "";
        child.stdout!.on("data", (d) => {
          stdout += d;
        });
        // A worker's prose goes straight through, so a long run is not silent.
        // Its JSON report is the only thing the parent parses.
        child.stderr!.on("data", (d) => {
          stderr += d;
          process.stderr.write(d);
        });

        running.set(id, child);
        info(`${id}: started (${running.size}/${concurrency} in flight)`);

        child.on("close", () => {
          running.delete(id);
          const result = parseWorkerReport(id, stdout, stderr);
          // REQ-585: what the worker's agents spent counts against the run's budget.
          addRunSpentUsd(reportedCost(result.attemptLog));
          results.push(result);
          streamResult(result);
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
/**
 * REQ-576: the commands a worker runs — the agent's, the tests', the PR's —
 * travel in its environment, not on its command line, where \`ps\` shows them.
 */
export const WORKER_ARGS_VAR = "SPECGATE_HARNESS_WORKER_ARGS";

/** A worker's commands, from the environment its run gave it; none for a run of its own. */
export function workerCommandsFromEnv(): string[] {
  const raw = process.env.SPECGATE_HARNESS_WORKER ? process.env[WORKER_ARGS_VAR] : "";
  // Read once: the agent this worker starts inherits its environment.
  delete process.env[WORKER_ARGS_VAR];
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

export function workerCommands(ctx: Pick<RunContext, "settings">): string[] {
  return [
    ...(ctx.settings.agent ? ["--agent", ctx.settings.agent] : []),
    ...(ctx.settings.testCmd ? ["--test-cmd", ctx.settings.testCmd] : []),
    ...(ctx.settings.prCmd ? ["--pr-cmd", ctx.settings.prCmd] : []),
  ];
}

export function workerArgs(id: string, ctx: RunContext): string[] {
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
    // REQ-576: every option of the run reaches its workers, as it reaches a serial run.
    ...(ctx.resume ? ["--resume"] : []),
    ...(ctx.skipNotReady ? ["--skip-not-ready"] : []),
    ...(ctx.strictArtifacts ? ["--strict-artifacts"] : []),
    ...(ctx.verbose ? ["--verbose"] : []),
    ...(ctx.settings.push ? ["--push"] : []),
    ...(ctx.settings.remote ? ["--remote", ctx.settings.remote] : []),
  ];
}

/** A worker's report, or an honest failure describing why there is none. */
export function parseWorkerReport(id: string, stdout: string, stderr: string): RequirementResult {
  try {
    const parsed = JSON.parse(stdout) as { results?: RequirementResult[] };
    const one = (parsed.results || []).find((r) => r.requirement === id);
    if (one) return one;
  } catch {
    // fall through
  }
  return unattempted(
    id,
    "",
    "fail",
    `harness/${id}`,
    `Worker produced no report.\n${(stderr || stdout || "").slice(-2000)}`
  );
}
