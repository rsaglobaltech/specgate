import * as fs from "node:fs";
import {
  eventLine,
  scrub,
  secretValues,
  type HarnessEvent,
} from "../../packages/core/src/domain/HarnessEvents";

/**
 * `harness run --format jsonl` (REQ-496, REQ-497): one JSON event per line on
 * the run's stdout, and nothing else there.
 *
 * The run is synchronous — every agent step is a `spawnSync` — so while an
 * agent works the harness cannot write a line. The process that runs beside
 * the agent (`deadline-runner`) does: it gets the stream as file descriptor 3.
 * In the run a person started, that descriptor is the run's stdout; in a
 * worker of a parallel run it is a pipe its parent reads line by line, so the
 * lines of two workers never interleave.
 *
 * Writes are synchronous and whole: a line is written before the next step
 * starts, and a partial write is finished, never dropped.
 */

/** Set in a worker's environment: its stream is file descriptor 3. */
export const STREAM_FD_VAR = "SPECGATE_HARNESS_STREAM_FD";

/** The most agent output one `output` event carries; a longer chunk is split. */
export const OUTPUT_CHUNK = 4000;

let streamFd: number | null = null;

/** Stream to `fd` from now on, or stop streaming with `null`. */
export function setStream(fd: number | null): void {
  streamFd = fd;
}

/** The descriptor the run streams to, or `null` when it does not stream. */
export function streamFdOf(): number | null {
  return streamFd;
}

/** A worker streams when its parent gave it a descriptor (REQ-497). */
export function streamFromEnv(env: Record<string, string | undefined> = process.env): void {
  const fd = Number(env[STREAM_FD_VAR]);
  if (Number.isInteger(fd) && fd > 2) setStream(fd);
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Write all of `text` to `fd`, waiting out a full non-blocking pipe. Never throws. */
export function writeWhole(fd: number, text: string): void {
  const bytes = Buffer.from(text, "utf8");
  let at = 0;
  let tries = 0;
  while (at < bytes.length) {
    try {
      at += fs.writeSync(fd, bytes, at, bytes.length - at);
      tries = 0;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EAGAIN" && tries < 10_000) {
        tries += 1;
        sleep(2);
        continue;
      }
      // The reader is gone (EPIPE): the run goes on without its stream.
      return;
    }
  }
}

/** One line, as written: the event with `t`, `req` and `attempt`, secrets masked. */
export function streamLine(
  event: HarnessEvent,
  req?: string,
  attempt?: number,
  env: Record<string, string | undefined> = process.env
): string {
  return `${JSON.stringify(scrub(eventLine(event, req, attempt), secretValues(env)))}\n`;
}

/** Write one event to the stream, when the run streams; never throws. */
export function streamEvent(event: HarnessEvent, req?: string, attempt?: number): void {
  if (streamFd === null) return;
  writeWhole(streamFd, streamLine(event, req, attempt));
}

/** A line already serialised elsewhere (a worker's), passed through whole. */
export function streamRaw(line: string): void {
  if (streamFd === null || !line.trim()) return;
  writeWhole(streamFd, line.endsWith("\n") ? line : `${line}\n`);
}

/** Agent output as `output` events, split so that no line grows without bound. */
export function outputEvents(text: string, stream: "stdout" | "stderr"): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  for (let at = 0; at < text.length; at += OUTPUT_CHUNK) {
    events.push({ type: "output", stream, text: text.slice(at, at + OUTPUT_CHUNK) });
  }
  return events;
}
