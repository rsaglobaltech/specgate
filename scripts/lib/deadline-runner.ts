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
 *
 * It is also the one process awake while the harness waits on the agent, so it
 * watches the requirement's events file (REQ-494) and, when the run streams,
 * writes the agent's output and events to file descriptor 3 (REQ-496).
 */
import "./blocking-stdio";
import { spawn, spawnSync } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { forShell } from "./shell-command";
import { watchEvents } from "./agent-watch";
import { outputEvents, streamLine, writeWhole } from "./harness-stream";

const command = process.env.HARNESS_CMD || "";
const deadline = Number(process.env.HARNESS_DEADLINE_MS || "0");
const streaming = process.env.HARNESS_STREAM === "1";
const projectDir = process.env.HARNESS_PROJECT_DIR || null;
const eventsFile = process.env.AGENT_EVENTS_FILE || "";
const req = process.env.AGENT_EVENTS_REQ || "";
const attempt = Number(process.env.AGENT_EVENTS_ATTEMPT) || undefined;
const windows = process.platform === "win32";
/** The run that started this command, through any worker in between (REQ-573). */
const rootPid = Number(process.env.SPECGATE_HARNESS_ROOT_PID) || 0;
const parentPid = process.ppid;

/** The stream is file descriptor 3, which the harness opened for this process. */
const STREAM_FD = 3;
const emit = streaming ? (line: string) => writeWhole(STREAM_FD, `${line}\n`) : null;

// What the harness tells this process is not the agent's business.
const env = { ...process.env };
for (const name of [
  "HARNESS_CMD",
  "HARNESS_DEADLINE_MS",
  "HARNESS_STREAM",
  "HARNESS_PROJECT_DIR",
  "SPECGATE_HARNESS_STREAM_FD",
  "SPECGATE_HARNESS_ROOT_PID",
]) {
  delete env[name];
}

const child = spawn(forShell(command), {
  shell: true,
  detached: !windows,
  env,
  // Streamed, the output passes through here on its way to the harness;
  // otherwise the agent writes straight into the pipes the harness reads.
  stdio: streaming ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
});

const poll = eventsFile
  ? watchEvents({ eventsFile, req, attempt, projectDir, emit })
  : () => undefined;
const watcher = setInterval(poll, 200);

if (streaming) {
  for (const [name, source, sink] of [
    ["stdout", child.stdout, process.stdout],
    ["stderr", child.stderr, process.stderr],
  ] as const) {
    const decoder = new StringDecoder("utf8");
    source?.on("data", (chunk: Buffer) => {
      sink.write(chunk);
      for (const e of outputEvents(decoder.write(chunk), name)) {
        writeWhole(STREAM_FD, streamLine(e, req || undefined, attempt));
      }
    });
  }
}

/** The command and everything it started: its process group, or its tree on Windows. */
function killCommand(): void {
  try {
    if (windows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else process.kill(-(child.pid as number), "SIGKILL");
  } catch {
    /* already gone */
  }
}

let timedOut = false;
const timer =
  deadline > 0
    ? setTimeout(() => {
        timedOut = true;
        killCommand();
      }, deadline)
    : null;

/**
 * REQ-573: the command is in a group of its own, which Ctrl-C does not reach,
 * so it would outlive the run. A signal to this process, or the run that
 * started it going away — killed, crashed, or a worker's parent gone — ends
 * the command too, and this process exits 198 (INTERRUPTED_STATUS).
 */
let interrupted = false;
function interrupt(): void {
  if (finished || interrupted) return;
  interrupted = true;
  killCommand();
  finish(null);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, interrupt);
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as { code?: string }).code === "EPERM";
  }
};
const orphanWatch = setInterval(() => {
  if (process.ppid !== parentPid || (rootPid && !alive(rootPid))) interrupt();
}, 500);

let finished = false;
function finish(code: number | null): void {
  if (finished) return;
  finished = true;
  if (timer) clearTimeout(timer);
  clearInterval(watcher);
  clearInterval(orphanWatch);
  // What the agent wrote last — its question among it — before the harness reads on.
  poll();
  process.exit(interrupted ? 198 : timedOut ? 124 : (code ?? 1));
}

let exitCode: number | null = null;
child.on("exit", (code) => {
  exitCode = code;
  if (!streaming) return finish(code);
  // Streamed, the output may still be in the pipes: wait for them to close,
  // but not for a descendant that keeps them open after the agent is gone.
  setTimeout(() => finish(code), 2000).unref();
});
child.on("close", () => finish(exitCode));
