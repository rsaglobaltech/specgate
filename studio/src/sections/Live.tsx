/**
 * Live (REQ-433): the run in progress, followed through server-sent events —
 * the requirement and its stages with the current one marked, its log as it
 * streams, the queue, the time and the cost so far; a question the agent asked
 * answered here; the run stopped after this requirement, or at once.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Key, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";
import { stageOf } from "./Build";

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
  pass?: number;
  fail?: number;
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
  usage: { cost: number | null } | null;
  question: { text: string } | null;
}

export interface LiveData {
  requirements: LiveReq[];
  queue: string[];
  queueStarted: number;
  totals: { input: number; output: number; cost: number | null; turns: number };
  questions: { open: Array<{ id: string; change: string; text: string; blocks: string[] }> };
}

export type Connection = "connecting" | "open" | "lost";

export interface LiveProps {
  lang: Lang;
  data: LiveData;
  connection: Connection;
  /** Seconds since the epoch; the clock's own time when not given (a test gives it). */
  now?: number;
  onAnswer: (question: string, change: string, answer: string) => Promise<Result>;
  onStop: (now: boolean) => Promise<Result>;
}

const STAGES: Key[] = ["stProgram", "stTest", "stQuality", "stSave"];

const clock = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.floor(Math.max(0, s) % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};
const stamp = (t: number) => (t ? new Date(t * 1000).toTimeString().slice(0, 8) : "");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One event as one log line: when, what kind, what it did. */
export function logLine(e: LiveStep): { ts: string; kind: string; what: string; tone: string } {
  const kind =
    e.type === "step"
      ? String(e.kind || "")
      : e.type === "message"
        ? "agent"
        : String(e.type || "");
  const what =
    e.type === "message"
      ? String(e.text || "")
      : e.type === "gate-start"
        ? `started  ${e.stage || ""}`
        : e.type === "gate"
          ? `${e.result === "pass" ? "passed" : "failed"}  ${e.stage || ""}${
              e.pass !== undefined || e.fail !== undefined
                ? `  (${e.pass || 0} ✓ ${e.fail || 0} ✗)`
                : ""
            }`
          : e.type === "merge"
            ? `merged into ${e.into || "HEAD"}`
            : String(e.target || e.tool || "");
  const tone =
    e.type === "message"
      ? "say"
      : e.type === "gate"
        ? e.result === "pass"
          ? "ok"
          : "bad"
        : e.type === "merge"
          ? "ok"
          : "";
  return { ts: stamp(Number(e.ended || e.t) || 0), kind, what: clip(what, 400), tone };
}

function Log({ lang, steps }: { lang: Lang; steps: LiveStep[] }) {
  const box = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);
  // The model keeps the newest first; the log reads top to bottom.
  const lines = steps.slice(0, 200).slice().reverse();
  useEffect(() => {
    const el = box.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [lines.length, follow]);
  return (
    <div class="term-wrap">
      <ol
        class="term"
        ref={box}
        tabIndex={0}
        aria-label={t(lang, "logLabel")}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(e) => {
          const el = e.target as HTMLOListElement;
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {!lines.length ? <li class="term-empty">{t(lang, "logEmpty")}</li> : null}
        {lines.map((e) => {
          const l = logLine(e);
          return (
            <li class={l.tone}>
              <span class="t-ts">{l.ts}</span>
              <span class="t-k">{l.kind}</span>
              <span class="t-x">{l.what}</span>
            </li>
          );
        })}
      </ol>
      {!follow ? (
        <button type="button" class="btn-ghost follow" onClick={() => setFollow(true)}>
          ↓ {t(lang, "followLog")}
        </button>
      ) : null}
    </div>
  );
}

function Ask({
  lang,
  q,
  onAnswer,
}: {
  lang: Lang;
  q: { id: string; change: string; text: string };
  onAnswer: LiveProps["onAnswer"];
}) {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<Result | null>(null);
  const field = `live-answer-${q.change}-${q.id}`;
  return (
    <section class="card ask" aria-labelledby={`${field}-h`}>
      <span class="eyebrow">[ {t(lang, "agentAsks")} ]</span>
      <h2 id={`${field}-h`}>
        <span class="id">{q.id}</span> {q.text}
      </h2>
      <label for={field} class="label">
        {t(lang, "yourAnswer")}
      </label>
      <textarea
        id={field}
        rows={2}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <div class="row">
        <Busy
          busyLabel={t(lang, "saving")}
          disabled={!text.trim()}
          onRun={() => onAnswer(q.id, q.change, text.trim())}
          onDone={setSaid}
        >
          {t(lang, "saveAnswer")} →
        </Busy>
        {said ? (
          <span class={said.ok ? "ok" : "err"}>
            {said.ok ? t(lang, "savedTo") : `${t(lang, "errorPrefix")} ${said.message || ""}`}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Stop({ lang, onStop }: { lang: Lang; onStop: LiveProps["onStop"] }) {
  const [sure, setSure] = useState(false);
  // Asked to stop now, the focus goes to the button that confirms it (REQ-435).
  useEffect(() => {
    if (sure) document.getElementById("stop-now-sure")?.focus();
  }, [sure]);
  const [said, setSaid] = useState<Result | null>(null);
  return (
    <div class="row stop">
      <Busy
        class="btn-ghost"
        busyLabel={t(lang, "stopping")}
        onRun={() => onStop(false)}
        onDone={setSaid}
      >
        {t(lang, "stopAfter")}
      </Busy>
      {!sure ? (
        <button type="button" class="btn-danger" onClick={() => setSure(true)}>
          {t(lang, "stopNow")}
        </button>
      ) : (
        <>
          <span class="err" id="stop-now-why">
            {t(lang, "stopNowWhy")}
          </span>
          <Busy
            id="stop-now-sure"
            class="btn-danger"
            busyLabel={t(lang, "stopping")}
            onRun={() => onStop(true)}
            onDone={setSaid}
          >
            {t(lang, "stopNowSure")}
          </Busy>
          <button type="button" class="link" onClick={() => setSure(false)}>
            {t(lang, "cancel")}
          </button>
        </>
      )}
      {said ? (
        <span class={said.ok ? "ok" : "err"}>
          {said.ok ? t(lang, "stopAsked") : `${t(lang, "errorPrefix")} ${said.message || ""}`}
        </span>
      ) : null}
    </div>
  );
}

export function Live({ lang, data, connection, now: given, onAnswer, onStop }: LiveProps) {
  // The clocks move every second, between the stream's pushes.
  const [, tick] = useState(0);
  useEffect(() => {
    if (given !== undefined) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [given]);
  const now = given ?? Date.now() / 1000;
  const current = data.requirements.find((r) => r.state === "running" || r.state === "question");
  const byId = new Map(data.requirements.map((r) => [r.req, r]));
  const startedRun = data.queueStarted || 0;
  const inRun = (r?: LiveReq) => !!r && r.updated >= startedRun;
  const queue = data.queue.map((id) => {
    const r = byId.get(id);
    const state = !r || !inRun(r) ? "queued" : r.state;
    return { id, title: r?.title || id, state, elapsed: r && inRun(r) ? r.elapsed : 0 };
  });
  const asked = current
    ? data.questions.open.find((q) => current.question && q.text === current.question.text) ||
      (current.question ? { id: "", change: "", text: current.question.text } : null)
    : null;
  const at = current ? stageOf(current) : -1;
  const cost = data.totals.cost;
  return (
    <>
      <header class="head head-row">
        <div>
          <h1>{t(lang, "live")}</h1>
          <p class="lead">{t(lang, "liveIntro")}</p>
        </div>
        <span class={`conn conn-${connection}`} role="status">
          <i aria-hidden="true" />
          {t(
            lang,
            connection === "open"
              ? "connOpen"
              : connection === "lost"
                ? "connLost"
                : "connConnecting"
          )}
        </span>
      </header>
      {!current ? (
        <section class="card empty">
          <p>{t(lang, "nothingRunning")}</p>
          <a class="btn-ghost" href="#/build">
            {t(lang, "build")} →
          </a>
        </section>
      ) : (
        <div class="live">
          <div class="live-main">
            <section class="card now" aria-labelledby="now-h">
              <div class="row spread">
                <div>
                  <span class="eyebrow">
                    [ {current.req} · {t(lang, "attemptN").replace("{N}", String(current.attempt))}{" "}
                    ]
                  </span>
                  <h2 id="now-h">{current.title || current.req}</h2>
                </div>
                <span class="clock" aria-label={t(lang, "elapsed")}>
                  {clock(now - current.started)}
                </span>
              </div>
              <ol class="stages" aria-label={t(lang, "stages")}>
                {STAGES.map((k, i) => (
                  <li
                    class={i < at ? "done" : i === at ? "now" : "todo"}
                    aria-current={i === at ? "step" : undefined}
                  >
                    <i />
                    {t(lang, k)}
                  </li>
                ))}
              </ol>
              {current.tests ? (
                <span class="faint">
                  {t(lang, "testsSoFar")} · <span class="ok">{current.tests.pass} ✓</span>{" "}
                  <span class={current.tests.fail ? "err" : "faint"}>{current.tests.fail} ✗</span>
                </span>
              ) : null}
              {current.files.length ? (
                <details>
                  <summary class="faint">
                    {t(lang, "filesTouched").replace("{N}", String(current.files.length))}
                  </summary>
                  <ul class="files">
                    {current.files.map((f) => (
                      <li>
                        <code>{f}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <Stop lang={lang} onStop={onStop} />
            </section>
            {asked && current.state === "question" ? (
              <Ask lang={lang} q={asked} onAnswer={onAnswer} />
            ) : null}
            <Log lang={lang} steps={current.steps} />
          </div>
          <aside class="live-side">
            <section class="card" aria-labelledby="queue-h">
              <h2 id="queue-h">{t(lang, "queue")}</h2>
              <ol class="queue">
                {queue.map((x) => (
                  <li
                    class={`q-${x.state}`}
                    aria-current={current.req === x.id ? "step" : undefined}
                  >
                    <span class="dot" aria-hidden="true" />
                    <span class="grow">
                      <span class="id">{x.id}</span> {x.title !== x.id ? x.title : ""}
                    </span>
                    <span class="faint">
                      {x.state === "queued"
                        ? t(lang, "queued")
                        : x.state === "running"
                          ? clock(now - (byId.get(x.id)?.started || now))
                          : x.state === "pass"
                            ? `✓ ${clock(x.elapsed)}`
                            : x.state === "question"
                              ? t(lang, "waitsAnswer")
                              : "✗"}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <section class="stats one" aria-label={t(lang, "summary")}>
              <div class="stat">
                <span class="faint">{t(lang, "runTime")}</span>
                <b>{clock(now - (startedRun || current.started))}</b>
              </div>
              <div class="stat">
                <span class="faint">{t(lang, "costSoFar")}</span>
                <b>{cost === null ? "—" : `$${cost.toFixed(2)}`}</b>
                <span class="faint">
                  {Math.round((data.totals.input + data.totals.output) / 1000)}k tokens
                </span>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
