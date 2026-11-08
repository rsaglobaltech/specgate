/**
 * What Live draws, worked out from the live model and the matrix — pure, so
 * it is tested without a browser (REQ-179, REQ-181, REQ-182, REQ-274).
 */

export interface LiveStep {
  type?: string;
  kind?: string;
  t?: number;
  ended?: number;
  stage?: string;
  result?: string;
  target?: string;
  tool?: string;
  text?: string;
  into?: string;
  ms?: number;
  pass?: number;
  fail?: number;
}

export interface Usage {
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

export interface LiveReq {
  req: string;
  title: string;
  group: string;
  attempt: number;
  phase: string;
  state: "running" | "pass" | "fail" | "question";
  started: number;
  updated: number;
  elapsed: number;
  tests: { pass: number; fail: number } | null;
  files: string[];
  steps: LiveStep[];
  agent?: { model: string; version: string; permission: string; tools: number } | null;
  usage: Usage | null;
  prompt?: { role: string; chars: number; lines: number; tokens: number } | null;
  question: { text: string; answer?: string; id?: string; change?: string } | null;
  running?: { stage: string; since: number; runner: string; image: string } | null;
}

export interface OpenQuestion {
  id: string;
  change: string;
  text: string;
  blocks: string[];
}

export interface LiveData {
  requirements: LiveReq[];
  queue: string[];
  queueStarted: number;
  totals: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost: number | null;
    turns: number;
  };
  questions: {
    open: OpenQuestion[];
    waitingWithoutQuestion?: Array<{ requirement: string; title: string }>;
  };
}

export interface MatrixRow {
  requirement: string;
  title: string;
  scenario: string;
  group: string;
  feature: string;
  tests: string[];
  status: string;
  source: "spec" | "change";
}

/** How long, said short: 45 s, 3 min 05 s, 1 h 02 min. */
export function dur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}

/** Thousands as `12.4k`. */
export const kt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

/** A running requirement's time up to now; an ended one's up to its last event. */
export const elapsed = (r: LiveReq, now: number) =>
  r.state === "running" ? now - r.started : r.elapsed;

export type SegState = "pass" | "running" | "fail" | "question" | "blocked" | "queued";

const DONE = new Set(["Implemented", "Verified", "Released"]);

/** A requirement's colour in the matrix: what the run did to it, or its status when the run has not reached it. */
export function segState(ev: LiveReq | undefined, status: string): SegState {
  if (ev) return ev.state;
  if (DONE.has(status)) return "pass";
  return status === "Needs Clarification" ? "blocked" : "queued";
}

export interface ModuleRow {
  group: string;
  reqs: Array<{ req: string; title: string; state: SegState; elapsed: number }>;
  passed: number;
  time: number;
}

/**
 * The run as a matrix by module (REQ-181): one row per module, one segment per
 * requirement in id order — those the run has not reached included — the
 * modules the run touched first on top.
 */
export function matrixByModule(list: LiveReq[], matrix: MatrixRow[], now: number): ModuleRow[] {
  const byReq = new Map(list.map((r) => [r.req, r]));
  const reqs = new Map<string, { req: string; title: string; group: string; status: string }>();
  for (const m of matrix) {
    if (!reqs.has(m.requirement))
      reqs.set(m.requirement, {
        req: m.requirement,
        title: m.title,
        group: m.group,
        status: m.status,
      });
  }
  for (const r of list)
    if (!reqs.has(r.req))
      reqs.set(r.req, { req: r.req, title: r.title, group: r.group, status: "Draft" });
  const rows = new Map<string, ModuleRow>();
  for (const q of [...reqs.values()].sort((a, b) =>
    a.req.localeCompare(b.req, undefined, { numeric: true })
  )) {
    const g = q.group || "spec";
    const row = rows.get(g) || { group: g, reqs: [], passed: 0, time: 0 };
    const ev = byReq.get(q.req);
    const state = segState(ev, q.status);
    const t = ev ? elapsed(ev, now) : 0;
    row.reqs.push({ req: q.req, title: q.title || ev?.title || "", state, elapsed: t });
    if (state === "pass") row.passed += 1;
    row.time += t;
    rows.set(g, row);
  }
  const firstStart = (row: ModuleRow) =>
    Math.min(...row.reqs.map((x) => byReq.get(x.req)?.started ?? Infinity));
  return [...rows.values()].sort((a, b) => firstStart(a) - firstStart(b));
}

export type StepKind = "Agent" | "Specification" | "Architecture" | "Tests" | "Merge";
const PLANNED: StepKind[] = ["Specification", "Architecture", "Tests", "Merge"];

export function kindOf(stage: string): StepKind {
  if (stage.startsWith("post-merge") || stage.startsWith("merge")) return "Merge";
  if (stage.includes("validate")) return "Specification";
  if (stage.includes("architecture")) return "Architecture";
  return "Tests";
}

export interface PipelineRow {
  name: string;
  kind: StepKind;
  state: "pass" | "fail" | "running" | "idle" | "question";
  seconds: number | null;
  /** The step whose log is the agent's stream, or the one running now. */
  current: boolean;
  image?: string;
}

/**
 * The steps of one requirement (REQ-179, REQ-274): the agent, each gate stage
 * as it ran with its time — the running one by its name and how long it has
 * run — and the stages still to come.
 */
export function pipeline(r: LiveReq, now: number): PipelineRow[] {
  const events = r.steps.slice().reverse();
  const firstGate = events.find((e) => e.type === "gate" || e.type === "gate-start");
  const rows: PipelineRow[] = [];
  const agentEnd = firstGate ? Number(firstGate.t) : r.state === "running" ? now : r.updated;
  rows.push({
    name: "Agent",
    kind: "Agent",
    state: firstGate ? "pass" : r.state === "running" ? "running" : r.state,
    seconds: agentEnd - r.started,
    current: !firstGate,
  });
  const seen = new Set<StepKind>();
  let prev = agentEnd;
  for (const e of events) {
    if (e.type !== "gate" && e.type !== "merge") continue;
    const stage = e.type === "merge" ? `merge into ${e.into || "HEAD"}` : String(e.stage || "");
    const kind = e.type === "merge" ? "Merge" : kindOf(stage);
    seen.add(kind);
    rows.push({
      name: stage,
      kind,
      state: e.type === "merge" || e.result === "pass" ? "pass" : "fail",
      seconds: e.ms !== undefined ? Math.round(Number(e.ms) / 1000) : Number(e.t) - prev,
      current: false,
    });
    prev = Number(e.t);
  }
  if (r.running) {
    const kind = kindOf(r.running.stage);
    seen.add(kind);
    rows.push({
      name: r.running.stage,
      kind,
      state: "running",
      seconds: now - r.running.since,
      current: true,
      image: r.running.image || undefined,
    });
  }
  if (r.state === "running") {
    for (const k of PLANNED)
      if (!seen.has(k))
        rows.push({ name: k, kind: k, state: "idle", seconds: null, current: false });
  }
  return rows;
}

export interface Queue {
  now: LiveReq | null;
  attention: Array<{
    req: string;
    title: string;
    state: "question" | "fail" | "blocked";
    note: string;
    question?: OpenQuestion;
  }>;
  next: Array<{ req: string; title: string }>;
  /** The median time of what passed this run, for the estimate of what is next. */
  each: number;
  done: LiveReq[];
  openQuestions: OpenQuestion[];
  waiting: Array<{ requirement: string; title: string }>;
}

/**
 * The run as a work queue (REQ-182, REQ-189, REQ-203): what runs now; what
 * needs a person — the agent's questions first, then failures and blocked
 * requirements; what is next with an estimate; every other open question; and
 * what finished.
 */
export function workQueue(data: LiveData, matrix: MatrixRow[]): Queue {
  const list = data.requirements;
  const byReq = new Map(list.map((r) => [r.req, r]));
  const since = data.queueStarted || 0;
  const findQ = (r: LiveReq) =>
    r.question
      ? data.questions.open.find((q) => q.text === r.question!.text) ||
        (r.question.id
          ? {
              id: r.question.id,
              change: r.question.change || "",
              text: r.question.text,
              blocks: [r.req],
            }
          : undefined)
      : undefined;
  const attention: Queue["attention"] = [
    ...list
      .filter((r) => r.state === "question" && r.question)
      .map((r) => ({
        req: r.req,
        title: r.title,
        state: "question" as const,
        note: r.question!.text,
        question: findQ(r),
      })),
    ...list
      .filter((r) => r.state === "fail")
      .map((r) => {
        const g = r.steps.find((e) => e.type === "gate" && e.result !== "pass");
        return {
          req: r.req,
          title: r.title,
          state: "fail" as const,
          note: g ? String(g.stage || "").split(":")[0] : "",
        };
      }),
  ];
  const blocked = new Set<string>();
  for (const m of matrix) {
    if (
      m.status === "Needs Clarification" &&
      !byReq.has(m.requirement) &&
      !blocked.has(m.requirement)
    ) {
      blocked.add(m.requirement);
      attention.push({ req: m.requirement, title: m.title, state: "blocked", note: "" });
    }
  }
  const done = list.filter((r) => r.state === "pass" && r.started >= since);
  const times = done.map((r) => r.elapsed).sort((a, b) => a - b);
  const titles = new Map(matrix.map((m) => [m.requirement, m.title]));
  const asked = new Set(
    attention.filter((a) => a.question).map((a) => `${a.question!.change}:${a.question!.id}`)
  );
  return {
    now: list.find((r) => r.state === "running") || null,
    attention,
    next: data.queue
      .filter((id) => {
        const r = byReq.get(id);
        return !(r && r.started >= since);
      })
      .map((id) => ({ req: id, title: titles.get(id) || byReq.get(id)?.title || "" })),
    each: times.length ? times[Math.floor(times.length / 2)] : 0,
    done: list
      .filter((r) => r.state === "pass")
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 5),
    openQuestions: data.questions.open.filter((q) => !asked.has(`${q.change}:${q.id}`)),
    waiting: data.questions.waitingWithoutQuestion || [],
  };
}

/** The run in figures (REQ-179): what passed, runs, failed and waits, since when, and what it cost. */
export function summary(data: LiveData, now: number) {
  const list = data.requirements;
  let pass = 0;
  let fail = 0;
  let running = 0;
  let asks = 0;
  let first = 0;
  let last = 0;
  for (const r of list) {
    if (r.state === "pass") pass += 1;
    else if (r.state === "fail") fail += 1;
    else if (r.state === "question") asks += 1;
    else running += 1;
    if (!first || r.started < first) first = r.started;
    last = Math.max(last, r.state === "running" ? now : r.updated);
  }
  const t = data.totals;
  return {
    pass,
    fail,
    running,
    asks,
    state: (running ? "running" : fail ? "fail" : asks ? "asks" : list.length ? "pass" : "idle") as
      "running" | "fail" | "asks" | "pass" | "idle",
    started: first,
    duration: first ? last - first : 0,
    agentTime: list.reduce((a, r) => a + elapsed(r, now), 0),
    tokensIn: t.input + (t.cacheRead || 0) + (t.cacheWrite || 0),
    tokensOut: t.output,
    cost: t.cost,
  };
}
