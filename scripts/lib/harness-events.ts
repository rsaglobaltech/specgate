import * as fs from "node:fs";
import * as path from "node:path";
import {
  eventLine,
  scrub,
  secretValues,
  type HarnessEvent,
} from "../../packages/core/src/domain/HarnessEvents";

/**
 * Writing harness events (ADR-0037): `.harness/events/<REQ>.jsonl`, git-ignored.
 * An event that cannot be written never breaks the run it describes.
 */

export const EVENTS_DIR = path.join(".harness", "events");

/** The events file of one requirement, its directory created and ignored by git. */
export function eventsFileFor(projectDir: string, req: string): string {
  const dir = path.join(projectDir, EVENTS_DIR);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(dir, ".gitignore");
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  } catch {
    /* the view is optional; the run is not */
  }
  return path.join(dir, `${req}.jsonl`);
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
}
