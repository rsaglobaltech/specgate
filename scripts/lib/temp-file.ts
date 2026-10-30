/**
 * REQ-372: remove a scratch file the CLI wrote for an agent without ever
 * failing the command. On Windows a file stays held a moment after the process
 * that read it ended (an agent's child, a virus scanner): four `change author`
 * runs side by side ended in `EBUSY … unlink` after the agent had written its
 * layer (truck-flote, MS2-5).
 */
import * as fs from "node:fs";

export interface RemoveDeps {
  rm(file: string): void;
  wait(ms: number): void;
}

const HELD = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

const defaults: RemoveDeps = {
  rm: (file) => fs.rmSync(file, { force: true }),
  wait: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
};

/**
 * Remove `file`, retrying while the system holds it; true when it was left for
 * the system to clear (the temporary folder is its own). Any other error is
 * thrown, as a plain removal would.
 */
export function removeTempFile(file: string, deps: RemoveDeps = defaults): boolean {
  const tries = 5;
  for (let i = 1; i <= tries; i++) {
    try {
      deps.rm(file);
      return false;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code || "";
      if (!HELD.has(code)) throw e;
      if (i < tries) deps.wait(100 * i);
    }
  }
  return true;
}
