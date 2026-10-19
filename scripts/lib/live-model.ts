import * as fs from "node:fs";
import * as path from "node:path";
import { EVENTS_DIR } from "./harness-events";

/**
 * The live view's model (ADR-0037): `.harness/events/*.jsonl`, one requirement
 * per file, folded into what a person wants to see while the harness works —
 * which attempt, doing what, for how long, which files, how the tests went.
 */

/**
 * One line of an events file, as read back. Written by `appendEvent`, but read
 * as untrusted: a line may be half-written or come from another version, so
 * every field is checked or coerced where it is used.
 */
export interface EventRecord {
  type?: unknown;
  state?: unknown;
  attempt?: unknown;
  t?: unknown;
  result?: unknown;
  kind?: unknown;
  target?: unknown;
  pass?: unknown;
  fail?: unknown;
  [key: string]: unknown;
}

export interface LiveRequirement {
  req: string;
  attempt: number;
  /** `starting`, the kind of the last step, `gate`, or the attempt's result. */
  phase: string;
  state: "running" | "pass" | "fail";
  started: number;
  updated: number;
  elapsed: number;
  files: string[];
  tests: { pass: number; fail: number } | null;
  steps: EventRecord[];
}

const STEP_LIMIT = 50;

function parse(lines: string[]): EventRecord[] {
  const out: EventRecord[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a line being written, or not ours */
    }
  }
  return out;
}

/** One requirement's state, from its events, its last attempt only. */
export function foldRequirement(req: string, events: EventRecord[]): LiveRequirement | null {
  if (events.length === 0) return null;
  const attempt = Math.max(1, ...events.map((e) => Number(e.attempt) || 0));
  const mine = events.filter((e) => (Number(e.attempt) || attempt) === attempt);
  const start = mine.find((e) => e.type === "attempt" && e.state === "start");
  const end = [...mine].reverse().find((e) => e.type === "attempt" && e.state === "end");
  const last = mine[mine.length - 1] || events[events.length - 1];
  const started = Number((start || mine[0] || last).t) || 0;
  const updated = Number(last.t) || started;
  const steps = mine.filter((e) => e.type !== "attempt");
  const lastStep = [...steps].reverse().find((e) => e.type === "step" || e.type === "gate");
  const phase = end
    ? end.result === "pass"
      ? "pass"
      : "fail"
    : lastStep
      ? lastStep.type === "gate"
        ? "gate"
        : String(lastStep.kind || "other")
      : "starting";
  const files = [
    ...new Set(
      steps
        .filter((e) => e.type === "step" && (e.kind === "edit" || e.kind === "write") && e.target)
        .map((e) => String(e.target))
    ),
  ];
  const lastTest = [...steps]
    .reverse()
    .find(
      (e) =>
        (e.kind === "test" || e.type === "gate") && (e.pass !== undefined || e.fail !== undefined)
    );
  return {
    req,
    attempt,
    phase,
    state: end ? (end.result === "pass" ? "pass" : "fail") : "running",
    started,
    updated,
    elapsed: Math.max(0, updated - started),
    files,
    tests: lastTest ? { pass: Number(lastTest.pass) || 0, fail: Number(lastTest.fail) || 0 } : null,
    steps: steps.slice(-STEP_LIMIT).reverse(),
  };
}

function eventFiles(projectDir: string): string[] {
  const dir = path.join(projectDir, EVENTS_DIR);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/** Every requirement with events, the most recently active first. */
export function readLive(projectDir: string): { requirements: LiveRequirement[] } {
  const requirements: LiveRequirement[] = [];
  for (const file of eventFiles(projectDir)) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const folded = foldRequirement(path.basename(file, ".jsonl"), parse(text.split("\n")));
    if (folded) requirements.push(folded);
  }
  requirements.sort((a, b) => b.updated - a.updated);
  return { requirements };
}

/** Changes whenever an event file is written: size and mtime of each. */
export function liveSignature(projectDir: string): string {
  return eventFiles(projectDir)
    .map((f) => {
      try {
        const st = fs.statSync(f);
        return `${f}:${st.size}:${st.mtimeMs}`;
      } catch {
        return f;
      }
    })
    .join("|");
}
