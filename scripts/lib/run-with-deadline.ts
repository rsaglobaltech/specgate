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

/** The exit status of a runner ended by a signal or by its run going away (REQ-573): its own, so a command's 130 is not taken for one. */
export const INTERRUPTED_STATUS = 198;

/** Thrown when a command was interrupted: the run stops, and leaves its worktree for --resume. */
export class HarnessInterrupted extends Error {
  constructor() {
    super("the run was interrupted: its commands were ended, its worktree kept for --resume");
  }
}

let interruptedOnce = false;
/** Whether a command of this process was interrupted. */
export function wasInterrupted(): boolean {
  return interruptedOnce;
}

export function runWithDeadline(
  command: string,
  opts: {
    cwd: string;
    timeoutMs: number;
    maxBuffer: number;
    env?: Record<string, string>;
    projectDir?: string;
    streamFd?: number | null;
    /** The command's output goes to this process's stderr as it runs, and is not captured. */
    toStderr?: boolean;
    /** REQ-587: the variables the command gets, besides the essential and the harness's own. */
    envAllow?: string[];
  }
): SpawnSyncReturns<string> {
  const streaming = typeof opts.streamFd === "number";
  const stdio: StdioOptions = streaming
    ? ["ignore", "pipe", "pipe", opts.streamFd as number]
    : opts.toStderr
      ? ["ignore", 2, 2]
      : ["ignore", "pipe", "pipe"];
  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: opts.maxBuffer,
    stdio,
    env: {
      ...process.env,
      ...(opts.env || {}),
      // REQ-573: every runner knows the run, so it ends its command when the run is gone.
      SPECGATE_HARNESS_ROOT_PID: process.env.SPECGATE_HARNESS_ROOT_PID || String(process.pid),
      HARNESS_CMD: command,
      HARNESS_DEADLINE_MS: String(opts.timeoutMs),
      ...(opts.envAllow ? { HARNESS_ENV_ALLOW: JSON.stringify(opts.envAllow) } : {}),
      ...(opts.projectDir ? { HARNESS_PROJECT_DIR: opts.projectDir } : {}),
      ...(streaming ? { HARNESS_STREAM: "1" } : {}),
    },
    // A backstop only: the runner kills the group at the deadline itself.
    timeout: opts.timeoutMs + 30_000,
    killSignal: "SIGKILL",
  });
  if (r.status === INTERRUPTED_STATUS || (r.signal && r.signal !== "SIGKILL")) {
    interruptedOnce = true;
    throw new HarnessInterrupted();
  }
  if (r.status === 124 && !r.error) {
    const error = Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" });
    return { ...r, error };
  }
  return r;
}
