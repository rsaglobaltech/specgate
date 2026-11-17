import { spawnSync } from "node:child_process";

/**
 * REQ-593: when a process started, epoch milliseconds — or null when the
 * system will not say (a `ps` without `lstart`, a process gone). Second
 * precision on macOS and Linux (`ps -o lstart`), finer on Windows.
 */
export function processStartMs(pid: number): number | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (process.platform === "win32") {
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')`,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10_000 }
    );
    const ms = Date.parse(String(r.stdout || "").trim());
    return r.status === 0 && Number.isFinite(ms) ? ms : null;
  }
  // LC_ALL=C: the date `ps` prints is English whatever the person's locale.
  const r = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    timeout: 10_000,
  });
  const ms = Date.parse(String(r.stdout || "").trim());
  return r.status === 0 && Number.isFinite(ms) ? ms : null;
}

/**
 * REQ-593: whether the process `pid` names is still the one that wrote a lock
 * at `writtenMs`. A pid is reused once its process ends: a process that started
 * after the lock was written cannot have written it. `startOf` is injectable
 * for tests; when it cannot tell, the pid alone decides, as before.
 */
export function isSameProcess(
  pid: number,
  writtenMs: number,
  startOf: (pid: number) => number | null = processStartMs
): boolean {
  const started = startOf(pid);
  if (started === null || !Number.isFinite(writtenMs)) return true;
  // `ps` rounds the start down to the second; a second of slack either way.
  return started <= writtenMs + 1000;
}
