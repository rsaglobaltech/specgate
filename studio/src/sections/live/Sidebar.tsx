/**
 * Live's sidebar as the run's work queue (REQ-182): now — with the step that
 * runs, the model, its context and output; what needs a person, the agent's
 * questions answered here (REQ-189, REQ-201); up next with an estimate; every
 * other open question (REQ-203); and what finished recently.
 */
import { t, type Lang } from "../../core/i18n";
import { Answer, type AnswerActions } from "./Answer";
import { dur, elapsed, kt, type Queue } from "./model";

export interface SidebarProps extends AnswerActions {
  lang: Lang;
  queue: Queue;
  now: number;
  selected: string;
  onSelect: (req: string) => void;
}

const shortModel = (m: string) => m.replace(/^claude-/, "").replace(/-\d{8}$/, "");

function Job({
  req,
  title,
  note,
  state,
  selected,
  onSelect,
}: {
  req: string;
  title: string;
  note: string;
  state: string;
  selected: boolean;
  onSelect: (req: string) => void;
}) {
  return (
    <button
      type="button"
      class={`job job-${state}`}
      aria-pressed={selected}
      onClick={() => onSelect(req)}
    >
      <span class={`dot dot-${state}`} aria-hidden="true" />
      <span class="job-text">
        <span>
          <span class="id">{req}</span> {title}
        </span>
        {note ? <span class="faint">{note}</span> : null}
      </span>
    </button>
  );
}

function Block({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: preact.ComponentChildren;
}) {
  return (
    <section class="wq" aria-label={title}>
      <h3>
        {title}
        {count ? <span class="badge">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

export function Sidebar({
  lang,
  queue,
  now,
  selected,
  onSelect,
  onAnswer,
  onReviewed,
}: SidebarProps) {
  const cur = queue.now;
  return (
    <aside class="live-side" aria-label={t(lang, "workQueue")}>
      <Block title={t(lang, "wqNow")}>
        {cur ? (
          <div class="now-card">
            <Job
              req={cur.req}
              title={cur.title}
              note={`${t(lang, "attemptN").replace("{N}", String(cur.attempt))} · ${dur(elapsed(cur, now))}`}
              state="running"
              selected={selected === cur.req}
              onSelect={onSelect}
            />
            <dl class="kv">
              {cur.running ? (
                <>
                  <dt>{t(lang, "wqRunning")}</dt>
                  <dd>
                    <code>{cur.running.stage}</code> · {dur(now - cur.running.since)}
                  </dd>
                </>
              ) : null}
              <dt>{t(lang, "wqModel")}</dt>
              <dd>{cur.agent ? shortModel(cur.agent.model) : t(lang, "notReported")}</dd>
              <dt>{t(lang, "wqContext")}</dt>
              <dd>
                {cur.usage && cur.usage.window ? (
                  <>
                    <span class="ctx" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.min(100, (cur.usage.context / cur.usage.window) * 100)}%`,
                        }}
                      />
                    </span>{" "}
                    {kt(cur.usage.context)} / {kt(cur.usage.window)}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt>{t(lang, "wqOutput")}</dt>
              <dd>{cur.usage ? `${kt(cur.usage.output)} tokens` : "—"}</dd>
            </dl>
          </div>
        ) : (
          <p class="faint">{t(lang, "nothingRunning")}</p>
        )}
      </Block>
      <Block title={t(lang, "wqAttention")} count={queue.attention.length}>
        {!queue.attention.length ? <p class="faint">{t(lang, "wqNothingAttention")}</p> : null}
        {queue.attention.map((a) => (
          <div class="attention">
            <Job
              req={a.req}
              title={a.title}
              note={
                a.state === "question"
                  ? `${t(lang, "asks")}: ${a.note}`
                  : a.state === "fail"
                    ? `${t(lang, "failed")}${a.note ? ` · ${a.note}` : ""}`
                    : t(lang, "blockedNeeds")
              }
              state={a.state}
              selected={selected === a.req}
              onSelect={onSelect}
            />
            {a.state === "question" && a.question ? (
              <Answer lang={lang} q={a.question} onAnswer={onAnswer} onReviewed={onReviewed} />
            ) : null}
          </div>
        ))}
      </Block>
      <Block title={t(lang, "wqNext")} count={queue.next.length}>
        {queue.next.length && queue.each ? (
          <p class="faint">
            {t(lang, "wqEstimate")
              .replace("{T}", dur(queue.next.length * queue.each))
              .replace("{E}", dur(queue.each))}
          </p>
        ) : null}
        {queue.next.slice(0, 6).map((x) => (
          <Job
            req={x.req}
            title={x.title}
            note=""
            state="queued"
            selected={selected === x.req}
            onSelect={onSelect}
          />
        ))}
        {queue.next.length > 6 ? <p class="faint">+ {queue.next.length - 6}</p> : null}
        {!queue.next.length ? <p class="faint">{t(lang, "wqQueueDone")}</p> : null}
      </Block>
      <Block
        title={t(lang, "openQuestions")}
        count={queue.openQuestions.length + queue.waiting.length}
      >
        {!queue.openQuestions.length && !queue.waiting.length ? (
          <p class="faint">{t(lang, "wqNothingWaits")}</p>
        ) : null}
        {queue.openQuestions.map((q) => (
          <div class="oq">
            <p>
              <span class="id">{q.id}</span>{" "}
              <span class="faint">
                {q.change === "project" ? t(lang, "fromProject") : q.change}
                {q.blocks.length ? ` · ${t(lang, "blocks")} ${q.blocks.join(", ")}` : ""}
              </span>
            </p>
            <p>{q.text}</p>
            <Answer lang={lang} q={q} onAnswer={onAnswer} onReviewed={onReviewed} />
          </div>
        ))}
        {queue.waiting.map((w) => (
          <div class="oq">
            <p>
              <span class="id">{w.requirement}</span> {w.title}
            </p>
            <p class="faint">
              {t(lang, "waitsNoQuestion")} <code>specgate ask {w.requirement} "…"</code>
            </p>
          </div>
        ))}
      </Block>
      <Block title={t(lang, "wqDone")}>
        {!queue.done.length ? <p class="faint">{t(lang, "noneYet")}</p> : null}
        {queue.done.map((r) => (
          <Job
            req={r.req}
            title={r.title}
            note={`${dur(r.elapsed)}${r.usage && r.usage.cost !== null ? ` · $${r.usage.cost.toFixed(2)}` : ""}`}
            state="pass"
            selected={selected === r.req}
            onSelect={onSelect}
          />
        ))}
      </Block>
    </aside>
  );
}
