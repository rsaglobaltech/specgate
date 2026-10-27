import * as fs from "node:fs";
import * as path from "node:path";
import { EVENTS_DIR, QUEUE_FILE } from "./harness-events";
import { waiting } from "./clarification";

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
  /** Its title in the specification, or "" when no spec names it (REQ-179). */
  title: string;
  /** The module it belongs to: its open change (`draft-diario` → `diario`) or capability; "" for spec.md. */
  group: string;
  attempt: number;
  /** `starting`, the kind of the last step, `gate`, or the attempt's result. */
  phase: string;
  /** `question`: the agent asked, and the requirement waits for an answer (REQ-189). */
  state: "running" | "pass" | "fail" | "question";
  started: number;
  updated: number;
  elapsed: number;
  files: string[];
  tests: { pass: number; fail: number } | null;
  steps: EventRecord[];
  /** The agent's session, when its adapter reports one (REQ-182). */
  agent: { model: string; version: string; permission: string; tools: number } | null;
  /** Its tokens: how full the context is now and at most, against its window; totals once it ends. */
  usage: AgentUsage | null;
  /** The prompt the attempt was given: its size, and who it was for. */
  prompt: { role: string; chars: number; lines: number; tokens: number } | null;
  /** What the agent asked, and the command that answers it once the harness recorded it. */
  question: { text: string; answer: string } | null;
}

export interface AgentUsage {
  context: number;
  peak: number;
  window: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number | null;
  turns: number | null;
}

/** Events about the agent's session rather than its work: not steps. */
const SESSION = new Set(["agent", "usage", "prompt", "question"]);

const num = (v: unknown) => Number(v) || 0;

/** The usage lines of one attempt, folded. */
export function foldUsage(events: EventRecord[]): AgentUsage | null {
  const usages = events.filter((e) => e.type === "usage");
  if (usages.length === 0) return null;
  const live = usages.filter((e) => e.final !== true);
  const finals = usages.filter((e) => e.final === true);
  const last = live[live.length - 1];
  const sum = (k: string) => finals.reduce((a, e) => a + num(e[k]), 0);
  const costs = finals.filter((e) => typeof e.cost === "number");
  const turns = finals.filter((e) => typeof e.turns === "number");
  return {
    context: last ? num(last.context) : 0,
    peak: Math.max(0, ...live.map((e) => num(e.context))),
    window: Math.max(0, ...usages.map((e) => num(e.window))),
    input: finals.length ? sum("input") : 0,
    output: finals.length ? sum("output") : last ? num(last.output) : 0,
    cacheRead: sum("cacheRead"),
    cacheWrite: sum("cacheWrite"),
    cost: costs.length ? costs.reduce((a, e) => a + num(e.cost), 0) : null,
    turns: turns.length ? turns.reduce((a, e) => a + num(e.turns), 0) : null,
  };
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
  // The last attempt is the one that started last, not the highest number: a
  // new run counts from 1 again on the same events file (REQ-180).
  const lastStart = events
    .map((e) => e.type === "attempt" && e.state === "start")
    .lastIndexOf(true);
  const attempt =
    lastStart >= 0
      ? Number(events[lastStart].attempt) || 1
      : Math.max(1, ...events.map((e) => Number(e.attempt) || 0));
  const mine =
    lastStart >= 0
      ? events.slice(lastStart)
      : events.filter((e) => (Number(e.attempt) || attempt) === attempt);
  const start = mine.find((e) => e.type === "attempt" && e.state === "start");
  const end = [...mine].reverse().find((e) => e.type === "attempt" && e.state === "end");
  const last = mine[mine.length - 1] || events[events.length - 1];
  const started = Number((start || mine[0] || last).t) || 0;
  const updated = Number(last.t) || started;
  const steps = mine.filter((e) => e.type !== "attempt" && !SESSION.has(String(e.type)));
  const agentEv = [...mine].reverse().find((e) => e.type === "agent");
  const promptEv = [...mine].reverse().find((e) => e.type === "prompt");
  const lastStep = [...steps].reverse().find((e) => e.type === "step" || e.type === "gate");
  const asked = [...mine].reverse().find((e) => e.type === "question");
  const phase = end
    ? end.result === "pass"
      ? "pass"
      : end.result === "question"
        ? "question"
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
    title: "",
    group: "",
    attempt,
    phase,
    state: end
      ? end.result === "pass"
        ? "pass"
        : end.result === "question"
          ? "question"
          : "fail"
      : "running",
    started,
    updated,
    elapsed: Math.max(0, updated - started),
    files,
    tests: lastTest ? { pass: Number(lastTest.pass) || 0, fail: Number(lastTest.fail) || 0 } : null,
    steps: steps.slice(-STEP_LIMIT).reverse(),
    agent: agentEv
      ? {
          model: String(agentEv.model || ""),
          version: String(agentEv.version || ""),
          permission: String(agentEv.permission || ""),
          tools: num(agentEv.tools),
        }
      : null,
    usage: foldUsage(mine),
    question: asked ? { text: String(asked.text || ""), answer: "specgate questions" } : null,
    prompt: promptEv
      ? {
          role: String(promptEv.role || "agent"),
          chars: num(promptEv.chars),
          lines: num(promptEv.lines),
          // About four characters a token: an estimate, and shown as one.
          tokens: Math.round(num(promptEv.chars) / 4),
        }
      : null,
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

const TITLE = /^(?:##|###\s+Requirement:)\s+(REQ-\d+)\s+[—–-]\s+(.+?)\s*$/gm;

/**
 * Requirement titles from spec.md and every markdown file under docs/specs —
 * capability specs and open changes' deltas alike — so the live view can say
 * what REQ-022 is (REQ-179). The first title found for an id wins.
 */
export function requirementTitles(
  projectDir: string
): Map<string, { title: string; group: string }> {
  const titles = new Map<string, { title: string; group: string }>();
  const read = (file: string) => {
    const parts = path.relative(projectDir, file).split(path.sep);
    const at = parts.findIndex((p) => p === "changes" || p === "capabilities");
    const group =
      at >= 0 && parts[at + 1] && parts[at + 1] !== "archive"
        ? parts[at + 1].replace(/^draft-/, "")
        : "";
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return;
    }
    for (const m of text.matchAll(TITLE)) {
      // A template's "<a short name>" is not a title.
      if (!titles.has(m[1]) && !/[<>]/.test(m[2])) titles.set(m[1], { title: m[2], group });
    }
  };
  read(path.join(projectDir, "spec.md"));
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      // DRAFTING.md shows the format with an example requirement; it names none.
      else if (e.name.endsWith(".md") && e.name !== "DRAFTING.md") read(full);
    }
  };
  walk(path.join(projectDir, "docs", "specs"));
  return titles;
}

/**
 * The command that answers what the agent asked: the open question the
 * harness recorded for it, or `specgate questions` until it has (REQ-189).
 */
function withAnswer(
  projectDir: string,
  req: string,
  text: string
): { text: string; answer: string } {
  const q = waiting(projectDir).questions.find((x) => x.blocks.includes(req) && x.text === text);
  return {
    text,
    answer: q
      ? `specgate answer ${q.id} "…"${q.change !== "project" ? ` --change ${q.change}` : ""}`
      : "specgate questions",
  };
}

/** The run's queue and when it started, as the harness wrote it; empty when there is none. */
export function readQueue(projectDir: string): { t: number; queue: string[] } {
  try {
    const q = JSON.parse(fs.readFileSync(path.join(projectDir, EVENTS_DIR, QUEUE_FILE), "utf8"));
    const queue = Array.isArray(q.queue)
      ? q.queue.filter((r: unknown) => typeof r === "string" && /^REQ-\d+$/.test(r))
      : [];
    return { t: num(q.t), queue };
  } catch {
    return { t: 0, queue: [] };
  }
}

export interface LiveTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number | null;
  turns: number;
}

/** Every requirement with events, the most recently active first; the run's queue and what it cost. */
export function readLive(projectDir: string): {
  requirements: LiveRequirement[];
  queue: string[];
  queueStarted: number;
  totals: LiveTotals;
} {
  const requirements: LiveRequirement[] = [];
  const titles = requirementTitles(projectDir);
  const { t: since, queue } = readQueue(projectDir);
  const totals: LiveTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: null,
    turns: 0,
  };
  for (const file of eventFiles(projectDir)) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const events = parse(text.split("\n"));
    // Every attempt of this run, not only the last: a retry is paid for too.
    const run = foldUsage(events.filter((e) => num(e.t) >= since));
    if (run) {
      totals.input += run.input;
      totals.output += run.output;
      totals.cacheRead += run.cacheRead;
      totals.cacheWrite += run.cacheWrite;
      totals.turns += run.turns || 0;
      if (run.cost !== null) totals.cost = (totals.cost || 0) + run.cost;
    }
    const folded = foldRequirement(path.basename(file, ".jsonl"), events);
    if (folded) {
      const known = titles.get(folded.req);
      requirements.push({
        ...folded,
        title: known ? known.title : "",
        group: known ? known.group : "",
        question: folded.question ? withAnswer(projectDir, folded.req, folded.question.text) : null,
      });
    }
  }
  requirements.sort((a, b) => b.updated - a.updated);
  return { requirements, queue, queueStarted: since, totals };
}

/** Changes whenever an event file is written: size and mtime of each. */
export function liveSignature(projectDir: string): string {
  return [...eventFiles(projectDir), path.join(projectDir, EVENTS_DIR, QUEUE_FILE)]
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
