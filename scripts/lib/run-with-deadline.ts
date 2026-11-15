/**
 * `spawnSync` for an agent command whose time limit holds (#66): the command
 * runs under `deadline-runner`, which kills its whole process group at the
 * deadline. Same result shape as `spawnSync`, with `error.code === "ETIMEDOUT"`
 * on timeout so callers keep branching on what they already branch on.
 *
 * `projectDir` lets the runner record a question in the project as soon as the
 * agent asks it (REQ-494); `streamFd` is the run's stream, handed to the runner
 * as its file descriptor 3 so it can write while this process waits (REQ-496).
 */
import * as path from "node:path";
import { spawnSync, SpawnSyncReturns, StdioOptions } from "node:child_process";

const RUNNER = path.join(__dirname, "deadline-runner.js");

export function runWithDeadline(
  command: string,
  opts: {
    cwd: string;
    timeoutMs: number;
    maxBuffer: number;
    env?: Record<string, string>;
    projectDir?: string;
    streamFd?: number | null;
  }
): SpawnSyncReturns<string> {
  const streaming = typeof opts.streamFd === "number";
  const stdio: StdioOptions = streaming
    ? ["ignore", "pipe", "pipe", opts.streamFd as number]
    : ["ignore", "pipe", "pipe"];
  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: opts.maxBuffer,
    stdio,
    env: {
      ...process.env,
      ...(opts.env || {}),
      HARNESS_CMD: command,
      HARNESS_DEADLINE_MS: String(opts.timeoutMs),
      ...(opts.projectDir ? { HARNESS_PROJECT_DIR: opts.projectDir } : {}),
      ...(streaming ? { HARNESS_STREAM: "1" } : {}),
    },
    // A backstop only: the runner kills the group at the deadline itself.
    timeout: opts.timeoutMs + 30_000,
    killSignal: "SIGKILL",
  });
  if (r.status === 124 && !r.error) {
    const error = Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" });
    return { ...r, error };
  }
  return r;
}
