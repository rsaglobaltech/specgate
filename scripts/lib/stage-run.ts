/**
 * A gate stage's command, run so another can run beside it (REQ-518).
 *
 * `spawnSync` blocks until its command ends, so the architecture check and the
 * tests ran one after the other. Each now writes its output to a file of its
 * own, not a pipe: no event loop has to drain it, so a stage judged with
 * `spawnSync` (the SARIF architecture check) can run at the same time, and the
 * two outputs never interleave.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { forShell } from "./shell-command";

export interface StageRun {
  /** The exit code; null when a signal ended it or it could not start. */
  status: number | null;
  stdout: string;
  stderr: string;
  /** How long it took. */
  ms: number;
}

/** Start `command` through the shell in `cwd`; the promise settles when it ends. */
export function startShell(command: string, cwd: string): Promise<StageRun> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-stage-"));
  const outFile = path.join(dir, "stdout");
  const errFile = path.join(dir, "stderr");
  const out = fs.openSync(outFile, "w");
  const err = fs.openSync(errFile, "w");
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: number | null, extra = "") => {
      if (settled) return;
      settled = true;
      const read = (f: string) => {
        try {
          return fs.readFileSync(f, "utf8");
        } catch {
          return "";
        }
      };
      const run = {
        status,
        stdout: read(outFile),
        stderr: read(errFile) + extra,
        ms: Date.now() - started,
      };
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      resolve(run);
    };
    try {
      const child = spawn(forShell(command), {
        cwd,
        shell: true,
        stdio: ["ignore", out, err],
        windowsHide: true,
      });
      child.on("error", (e) => finish(null, `${e.message}\n`));
      child.on("close", (code) => finish(code));
    } catch (e) {
      finish(null, `${(e as Error).message}\n`);
    } finally {
      // The child holds its own copies of the two files.
      fs.closeSync(out);
      fs.closeSync(err);
    }
  });
}
