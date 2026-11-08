/**
 * Live (REQ-433, REQ-179, REQ-181, REQ-182, REQ-203, REQ-274): the run as it
 * happens, through server-sent events. A header that stays in view with the
 * run's figures; the run as a matrix by module, or the traceability matrix as
 * it stands; the work queue beside it — now, what needs a person, what is
 * next, every open question, what finished; and the requirement opened in its
 * tabs. The run is stopped after this requirement, or at once.
 */
import { useEffect, useState } from "preact/hooks";
import { t, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";
import { Detail, type RequirementDetail } from "./live/Detail";
import { Matrix } from "./live/Matrix";
import { Sidebar } from "./live/Sidebar";
import { Trace } from "./live/Trace";
import {
  dur,
  kt,
  matrixByModule,
  summary,
  workQueue,
  type LiveData,
  type MatrixRow,
} from "./live/model";

export { logLine } from "./live/Log";
export type { LiveData, LiveReq, LiveStep, MatrixRow } from "./live/model";
export type { RequirementDetail } from "./live/Detail";

export type Connection = "connecting" | "open" | "lost";

export interface LiveProps {
  lang: Lang;
  data: LiveData;
  matrix: MatrixRow[];
  connection: Connection;
  /** Seconds since the epoch; the clock's own time when not given (a test gives it). */
  now?: number;
  onAnswer: (question: string, change: string, answer: string) => Promise<Result>;
  onReviewed: (question: string, change: string) => Promise<Result>;
  onStop: (now: boolean) => Promise<Result>;
  detailOf: (id: string) => Promise<RequirementDetail | null>;
  promptOf: (id: string, attempt: number) => Promise<string>;
  /** What a test opens, with its details, instead of reading them. */
  initial?: { id: string; detail: RequirementDetail | null };
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

export function Live(props: LiveProps) {
  const {
    lang,
    data,
    matrix,
    connection,
    now: given,
    onAnswer,
    onReviewed,
    onStop,
    detailOf,
    promptOf,
    initial,
  } = props;
  // The clocks move every second, between the stream's pushes.
  const [, tick] = useState(0);
  useEffect(() => {
    if (given !== undefined) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [given]);
  const now = given ?? Date.now() / 1000;
  const [view, setView] = useState<"run" | "trace">("run");
  const [picked, setPicked] = useState(initial?.id || "");
  const queue = workQueue(data, matrix);
  const rows = matrixByModule(data.requirements, matrix, now);
  const sum = summary(data, now);
  // What is open: the viewer's choice, else what runs, what needs a person, the first of the run.
  const selected =
    picked ||
    queue.now?.req ||
    queue.attention[0]?.req ||
    data.requirements[0]?.req ||
    rows[0]?.reqs[0]?.req ||
    "";
  const r = data.requirements.find((x) => x.req === selected) || null;
  const stateWord = {
    running: "runInProgress",
    fail: "runFailed",
    asks: "runWaitsAnswer",
    pass: "runCompleted",
    idle: "runWaiting",
  } as const;
  return (
    <div class="live-page">
      <header class="live-head">
        <div class="row spread">
          <div>
            <h1>{t(lang, "live")}</h1>
            <p class="lead">
              <span class={`run-badge run-${sum.state}`}>{t(lang, stateWord[sum.state])}</span>{" "}
              {queue.now ? `${queue.now.req} ${queue.now.title}` : ""}
            </p>
          </div>
          <div class="row">
            <div class="seg-switch" role="group" aria-label={t(lang, "liveView")}>
              <button type="button" aria-pressed={view === "run"} onClick={() => setView("run")}>
                {t(lang, "viewRun")}
              </button>
              <button
                type="button"
                aria-pressed={view === "trace"}
                onClick={() => setView("trace")}
              >
                {t(lang, "traceability")}
              </button>
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
          </div>
        </div>
        <dl class="run-sum" aria-label={t(lang, "summary")}>
          <div>
            <dt>{t(lang, "sumLabel")}</dt>
            <dd>
              {t(lang, "sumReqs")
                .replace("{P}", String(sum.pass))
                .replace("{R}", String(sum.running))
                .replace("{F}", String(sum.fail))}
              {sum.asks ? ` · ${t(lang, "sumAsks").replace("{A}", String(sum.asks))}` : ""}
            </dd>
          </div>
          <div>
            <dt>{t(lang, "runTime")}</dt>
            <dd>{sum.started ? dur(sum.duration) : "—"}</dd>
          </div>
          <div>
            <dt>{t(lang, "agentTime")}</dt>
            <dd>{dur(sum.agentTime)}</dd>
          </div>
          <div>
            <dt>Tokens</dt>
            <dd>
              {sum.tokensIn || sum.tokensOut
                ? `${kt(sum.tokensIn)} ${t(lang, "tokIn")} · ${kt(sum.tokensOut)} ${t(lang, "tokOut")}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>{t(lang, "costSoFar")}</dt>
            <dd>{sum.cost === null ? "—" : `$${sum.cost.toFixed(2)}`}</dd>
          </div>
        </dl>
        {queue.now ? <Stop lang={lang} onStop={onStop} /> : null}
      </header>
      {view === "trace" ? (
        <Trace lang={lang} rows={matrix} />
      ) : (
        <div class="live">
          <div class="live-main">
            <Matrix lang={lang} rows={rows} selected={selected} onSelect={setPicked} />
            {selected ? (
              <Detail
                key={selected}
                lang={lang}
                id={selected}
                r={r}
                now={now}
                detailOf={detailOf}
                promptOf={promptOf}
                initial={initial && initial.id === selected ? initial.detail : null}
              />
            ) : (
              <section class="card empty">
                <p>{t(lang, "nothingRunning")}</p>
                <a class="btn-ghost" href="#/build">
                  {t(lang, "build")} →
                </a>
              </section>
            )}
          </div>
          <Sidebar
            lang={lang}
            queue={queue}
            now={now}
            selected={selected}
            onSelect={setPicked}
            onAnswer={onAnswer}
            onReviewed={onReviewed}
          />
        </div>
      )}
    </div>
  );
}
