import * as fs from "node:fs";
import * as path from "node:path";
import {
  eventLine,
  scrub,
  secretValues,
  type HarnessEvent,
} from "../../packages/core/src/domain/HarnessEvents";
import { streamEvent } from "./harness-stream";

/**
 * Writing harness events (ADR-0037): `.harness/events/<REQ>.jsonl`, git-ignored.
 * An event that cannot be written never breaks the run it describes.
 */

export const EVENTS_DIR = path.join(".harness", "events");

/** The events directory, created, with a `.gitignore` that keeps everything in it out of git. */
function eventsDir(projectDir: string): string {
  const dir = path.join(projectDir, EVENTS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  return dir;
}

/**
 * A log the studio writes for a job it starts — `studio-run.log` and the like —
 * in the ignored events directory. Written anywhere git sees it, the harness
 * found the tree not clean and refused to run (REQ-208).
 */
export function studioLog(projectDir: string, kind: string): string {
  return path.join(eventsDir(projectDir), `studio-${kind}.log`);
}

/** The events file of one requirement, its directory created and ignored by git. */
export function eventsFileFor(projectDir: string, req: string): string {
  try {
    return path.join(eventsDir(projectDir), `${req}.jsonl`);
  } catch {
    /* the view is optional; the run is not */
    return path.join(projectDir, EVENTS_DIR, `${req}.jsonl`);
  }
}

/** Append one event as one line, masked; never throws. */
export function appendEvent(
  file: string | null | undefined,
  event: HarnessEvent,
  req?: string,
  attempt?: number,
  env: Record<string, string | undefined> = process.env
): void {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const line = scrub(eventLine(event, req, attempt), secretValues(env));
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
  } catch {
    /* the view must not break the run */
  }
  // The same event on the run's stream, when it streams (REQ-496).
  streamEvent(event, req, attempt);
}

/** The run's queue, in the order it works through it (REQ-182). */
export const QUEUE_FILE = "queue.json";

/** Record which requirements this run will work on, in order; never throws. */
export function writeQueue(
  projectDir: string,
  reqs: string[],
  t = Math.floor(Date.now() / 1000)
): void {
  try {
    const dir = path.dirname(eventsFileFor(projectDir, "x"));
    fs.writeFileSync(path.join(dir, QUEUE_FILE), JSON.stringify({ t, queue: reqs }), "utf8");
  } catch {
    /* the view must not break the run */
  }
}

/** Where the live view keeps the prompt an attempt was given, git-ignored with the events. */
export function promptFileFor(projectDir: string, req: string, attempt: number): string {
  return path.join(projectDir, EVENTS_DIR, "prompts", `${req}-${attempt}.md`);
}

/** Keep the prompt an attempt was given, for the live view; never throws. */
export function keepPrompt(projectDir: string, req: string, attempt: number, prompt: string): void {
  try {
    eventsFileFor(projectDir, req);
    const file = promptFileFor(projectDir, req, attempt);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, prompt, "utf8");
  } catch {
    /* the view must not break the run */
  }
}
