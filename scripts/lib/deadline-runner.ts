/**
 * Runs `HARNESS_CMD` in a shell, in its own process group, and kills the whole
 * group when `HARNESS_DEADLINE_MS` passes. Exits 124 on timeout.
 *
 * Why a separate process: `spawnSync(cmd, { shell: true, timeout })` kills the
 * shell when the time is up, then keeps waiting for the pipes — and the agent
 * the shell started still holds them. In credito-tienda an agent that hung on
 * the API ran for 53 minutes under a 20-minute limit; the harness reported the
 * timeout only once a person killed it (#66). Killing the group closes every
 * pipe, so the caller's `spawnSync` returns.
 */
import { spawn, spawnSync } from "node:child_process";

const command = process.env.HARNESS_CMD || "";
const deadline = Number(process.env.HARNESS_DEADLINE_MS || "0");
const windows = process.platform === "win32";

const child = spawn(command, {
  shell: true,
  detached: !windows,
  stdio: ["ignore", "inherit", "inherit"],
});

let timedOut = false;
const timer =
  deadline > 0
    ? setTimeout(() => {
        timedOut = true;
        try {
          if (windows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
          else process.kill(-(child.pid as number), "SIGKILL");
        } catch {
          /* already gone */
        }
      }, deadline)
    : null;

child.on("exit", (code) => {
  if (timer) clearTimeout(timer);
  process.exit(timedOut ? 124 : (code ?? 1));
});
