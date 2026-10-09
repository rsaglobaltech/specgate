/**
 * `spawnSync` for an agent command whose time limit holds (#66): the command
 * runs under `deadline-runner`, which kills its whole process group at the
 * deadline. Same result shape as `spawnSync`, with `error.code === "ETIMEDOUT"`
 * on timeout so callers keep branching on what they already branch on.
 */
import * as path from "node:path";
import { spawnSync, SpawnSyncReturns } from "node:child_process";

const RUNNER = path.join(__dirname, "deadline-runner.js");

export function runWithDeadline(
  command: string,
  opts: { cwd: string; timeoutMs: number; maxBuffer: number }
): SpawnSyncReturns<string> {
  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: opts.maxBuffer,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HARNESS_CMD: command, HARNESS_DEADLINE_MS: String(opts.timeoutMs) },
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
