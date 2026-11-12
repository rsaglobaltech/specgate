import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { appendEvent } from "./harness-events";
import { ask } from "./clarification";
import { withWorktreeLock } from "../harness/worktree-lock";
import type { HarnessEvent } from "../../packages/core/src/domain/HarnessEvents";

/**
 * What runs beside an agent step while the harness waits on it (REQ-494,
 * REQ-496): the requirement's events file, read as the agent and its adapter
 * write it.
 *
 * - A question `specgate ask` recorded is written into the project and
 *   committed at once, and a `question` event with its id follows it, so the
 *   question can be answered while the run goes on. It used to get its id
 *   only when the whole run ended.
 * - When the run streams, every new line goes to the stream as it is written.
 */

/** The new complete lines of a file that grows, from where the last read stopped. */
export class EventTail {
  private offset: number;
  private partial = "";

  constructor(
    private readonly file: string,
    from?: number
  ) {
    this.offset = from ?? sizeOf(file);
  }

  read(): string[] {
    let fd: number | null = null;
    try {
      fd = fs.openSync(this.file, "r");
      const size = fs.fstatSync(fd).size;
      if (size < this.offset) this.offset = 0; // truncated: start again
      if (size === this.offset) return [];
      const buf = Buffer.alloc(size - this.offset);
      fs.readSync(fd, buf, 0, buf.length, this.offset);
      this.offset = size;
      const text = this.partial + buf.toString("utf8");
      const parts = text.split("\n");
      this.partial = parts.pop() ?? "";
      return parts.filter((l) => l.trim() !== "");
    } catch {
      return [];
    } finally {
      if (fd !== null) fs.closeSync(fd);
    }
  }
}

function sizeOf(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** Each changed path of the working copy and a hash of what it holds now. */
function dirtyState(projectDir: string): Map<string, string> {
  const r = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const state = new Map<string, string>();
  const entries = String(r.stdout || "").split("\0");
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    const rel = entry.slice(3);
    // A rename carries its old path as the next entry.
    if (entry[0] === "R" || entry[0] === "C") i += 1;
    let hash = "gone";
    try {
      hash = crypto
        .createHash("sha1")
        .update(fs.readFileSync(path.join(projectDir, rel)))
        .digest("hex");
    } catch {
      /* deleted */
    }
    state.set(rel, hash);
  }
  return state;
}

export type RecordedQuestion =
  | { ok: true; id: string; change: string; file: string; committed: boolean }
  | { ok: false; message: string };

/**
 * Write the agent's question into the project and commit the files it touched
 * (REQ-494), under the lock worktrees are added under, so that two workers'
 * questions and a `git worktree add` never meet in the index.
 *
 * Only those files are committed. When one of them already held a change of
 * the person's — a run with `--allow-dirty` — nothing is committed: that
 * change is not the harness's to commit, and the question stays written.
 */
export function recordQuestion(projectDir: string, req: string, text: string): RecordedQuestion {
  return withWorktreeLock(projectDir, () => {
    const before = dirtyState(projectDir);
    const asked = ask(projectDir, req, text);
    if (!asked.ok) return { ok: false, message: asked.message };
    const after = dirtyState(projectDir);
    const touched = [...after.keys()].filter((p) => before.get(p) !== after.get(p));
    const theirs = touched.filter((p) => before.has(p));
    let committed = false;
    if (touched.length > 0 && theirs.length === 0) {
      const git = (...args: string[]) =>
        spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
      git("add", "--", ...touched);
      committed =
        git(
          "commit",
          "-q",
          "-m",
          `docs(specs): ${req} needs clarification — ${asked.question}\n\n${text}`,
          "--",
          ...touched
        ).status === 0;
    }
    return { ok: true, id: asked.question, change: asked.change, file: asked.file, committed };
  });
}

/** What the watcher of one agent step knows. */
export interface WatchOptions {
  eventsFile: string;
  req: string;
  attempt: number | undefined;
  /** The project the run works in; without it a question waits for the end of the run. */
  projectDir: string | null;
  /** Where each event goes when the run streams; `null` when it does not. */
  emit: ((line: string) => void) | null;
}

/**
 * Read what was written since the last call: record each new question, and
 * pass every line on to the stream. A question's own line is passed on once
 * it carries its id; one that could not be recorded is passed on as it came.
 */
export function watchEvents(opts: WatchOptions): () => void {
  const tail = new EventTail(opts.eventsFile);
  const poll = () => {
    for (const line of tail.read()) {
      let event: HarnessEvent | null = null;
      try {
        event = JSON.parse(line) as HarnessEvent;
      } catch {
        continue; // not ours, or half a line
      }
      if (event.type === "question" && !event.id && event.text && opts.projectDir) {
        const req = String(event.req || opts.req);
        const recorded = recordQuestion(opts.projectDir, req, String(event.text));
        if (recorded.ok) {
          const { ok: _ok, ...about } = recorded;
          appendEvent(
            opts.eventsFile,
            { type: "question", text: String(event.text), ...about },
            req,
            Number.isInteger(event.attempt) ? Number(event.attempt) : opts.attempt
          );
          continue; // its line, with the id, is the next one read
        }
      }
      if (opts.emit) opts.emit(line);
    }
  };
  return () => {
    // Until nothing new: recording a question writes the line that follows it.
    for (let i = 0; i < 5; i += 1) {
      const before = sizeOf(opts.eventsFile);
      poll();
      if (sizeOf(opts.eventsFile) === before) break;
    }
  };
}
