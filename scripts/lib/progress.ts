/**
 * How far a command is (REQ-654): with SPECGATE_PROGRESS_FILE set, one JSON
 * line per stage as it starts and as it ends — `{ at, stage, state, log? }` —
 * so a studio can show the stage and, from the running stage's `log`, the
 * line it is on. Without the variable nothing is written.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const PROGRESS_FILE_VAR = "SPECGATE_PROGRESS_FILE";

export type ProgressState = "running" | "passed" | "failed" | "skipped";

export interface ProgressEvent {
  stage: string;
  /** A quality check's name, when the stage is one. */
  name?: string;
  state: ProgressState;
  /** The file the running stage's output goes to, as it is written. */
  log?: string;
}

/** Writes one progress line, when a studio asked for them. */
export function progress(e: ProgressEvent): void {
  const file = process.env[PROGRESS_FILE_VAR];
  if (!file) return;
  try {
    fs.appendFileSync(file, `${JSON.stringify({ at: Date.now(), ...e })}\n`);
  } catch {
    // A progress file that cannot be written never stops the command.
  }
}

/**
 * A shell command whose output goes, as it is written, to a log the progress
 * names; its stdout and stderr read back as `spawnSync` would give them.
 * Without SPECGATE_PROGRESS_FILE it is `spawnSync` itself.
 */
export function runLogged(stage: string, command: string, cwd: string): SpawnSyncReturns<string> {
  if (!process.env[PROGRESS_FILE_VAR]) {
    progress({ stage, state: "running" });
    return spawnSync(command, { cwd, encoding: "utf8", shell: true });
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-progress-"));
  const log = path.join(dir, `${stage}.log`);
  const fd = fs.openSync(log, "w");
  progress({ stage, state: "running", log });
  try {
    const run = spawnSync(command, {
      cwd,
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", fd, fd],
    });
    const text = fs.readFileSync(log, "utf8");
    return {
      ...run,
      stdout: text,
      stderr: "",
      output: [null, text, ""],
    } as SpawnSyncReturns<string>;
  } finally {
    fs.closeSync(fd);
  }
}
