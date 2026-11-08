/**
 * A question answered from Live (REQ-201, REQ-203): the answer saved into its
 * change, or the question marked reviewed when the spec already says it.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import { Busy, type Result } from "../../ui/Busy";
import type { OpenQuestion } from "./model";

export interface AnswerActions {
  onAnswer: (question: string, change: string, answer: string) => Promise<Result>;
  onReviewed: (question: string, change: string) => Promise<Result>;
}

export function Answer({
  lang,
  q,
  onAnswer,
  onReviewed,
}: { lang: Lang; q: OpenQuestion } & AnswerActions) {
  const [text, setText] = useState("");
  const field = `live-answer-${q.change}-${q.id}`;
  return (
    <div class="answer">
      <label for={field} class="label">
        {t(lang, "yourAnswer")} · {q.id}
      </label>
      <textarea
        id={field}
        rows={2}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
          e.preventDefault();
          (
            e.currentTarget
              .closest(".answer")
              ?.querySelector(".btn-primary") as HTMLButtonElement | null
          )?.click();
        }}
      />
      <div class="row">
        <Busy
          busyLabel={t(lang, "saving")}
          disabled={!text.trim()}
          onRun={() => onAnswer(q.id, q.change, text.trim())}
        >
          {t(lang, "saveAnswer")} →
        </Busy>
        <Busy
          class="btn-ghost"
          busyLabel={t(lang, "saving")}
          onRun={() => onReviewed(q.id, q.change)}
        >
          {t(lang, "markReviewed")}
        </Busy>
      </div>
    </div>
  );
}
