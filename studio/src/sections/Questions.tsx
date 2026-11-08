/**
 * Questions (REQ-210): each open question with where it comes from, what it
 * blocks and the options seen, the form that answers it; and the answers the
 * spec must still say, one per question — the approved design's Preguntas.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";

export interface OpenQuestion {
  id: string;
  change: string;
  text: string;
  blocks: string[];
  options: string[];
  from: "agent" | "draft" | "project";
}

export interface QuestionsData {
  open: OpenQuestion[];
  toReview: Array<{ change: string; assumption: string; question: string; text: string }>;
}

export interface QuestionsProps {
  lang: Lang;
  data: QuestionsData;
  onAnswer: (q: OpenQuestion, answer: string) => Promise<Result>;
  onConfirm: (change: string, question: string) => Promise<Result>;
}

function Question({
  lang,
  q,
  onAnswer,
}: {
  lang: Lang;
  q: OpenQuestion;
  onAnswer: QuestionsProps["onAnswer"];
}) {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<Result | null>(null);
  const field = `answer-${q.change}-${q.id}`;
  const from =
    q.from === "agent" ? "fromAgent" : q.from === "project" ? "fromProject" : "fromDraft";
  return (
    <article class="card question" aria-labelledby={`${field}-h`}>
      <div class="meta">
        <span class="id">{q.id}</span>
        {q.blocks.length ? (
          <span class="chip warn">
            {t(lang, "blocks")} {q.blocks.join(", ")}
          </span>
        ) : null}
        <span class="faint">
          {t(lang, from)}
          {q.from === "draft" ? ` ${q.change.replace(/^draft-/, "")}` : ""}
        </span>
      </div>
      <h2 id={`${field}-h`}>{q.text}</h2>
      {q.options.length ? (
        <div class="chips" role="group" aria-label={t(lang, "optionsSeen")}>
          {q.options.map((o) => (
            <button
              type="button"
              class="chip-btn"
              aria-pressed={text === o}
              onClick={() => setText(o)}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}
      <label for={field} class="label">
        {t(lang, "yourAnswer")}
      </label>
      <textarea
        id={field}
        rows={2}
        value={text}
        placeholder={t(lang, "answerPlaceholder")}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <div class="row">
        <Busy
          busyLabel={t(lang, "saving")}
          disabled={!text.trim()}
          onRun={() => onAnswer(q, text.trim())}
          onDone={setSaid}
        >
          {t(lang, "saveAnswer")} →
        </Busy>
        {said ? (
          <span role="status" class={said.ok ? "ok" : "err"}>
            {said.ok ? t(lang, "savedTo") : `${t(lang, "errorPrefix")} ${said.message || ""}`}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function Questions({ lang, data, onAnswer, onConfirm }: QuestionsProps) {
  // A saved answer leaves the list, its card with it: the section says it was kept.
  const [saved, setSaved] = useState("");
  const answer: QuestionsProps["onAnswer"] = async (q, text) => {
    const r = await onAnswer(q, text);
    if (r.ok) setSaved(q.id);
    return r;
  };
  return (
    <>
      <header class="head">
        <h1>{t(lang, "questions")}</h1>
        <p class="lead">{t(lang, "questionsIntro")}</p>
      </header>
      {saved ? (
        <p role="status" class="ok">
          {saved} · {t(lang, "savedTo")}
        </p>
      ) : null}
      {!data.open.length && !data.toReview.length ? (
        <div class="card empty">{t(lang, "noQuestions")}</div>
      ) : null}
      {data.open.map((q) => (
        <Question key={`${q.change}:${q.id}`} lang={lang} q={q} onAnswer={answer} />
      ))}
      {data.toReview.length ? (
        <section class="card" aria-labelledby="confirm-h">
          <div>
            <h2 id="confirm-h">{t(lang, "toConfirm")}</h2>
            <p class="faint">{t(lang, "toConfirmHint")}</p>
          </div>
          {data.toReview.map((x) => (
            <div class="confirm-row" key={`${x.change}:${x.question}`}>
              <span class="id">{x.question}</span>
              <span class="grow">{x.text || x.question}</span>
              <Busy
                class="btn-dark"
                busyLabel={t(lang, "saving")}
                onRun={() => onConfirm(x.change, x.question)}
              >
                {t(lang, "inSpec")}
              </Busy>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
