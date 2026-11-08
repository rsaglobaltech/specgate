/**
 * What happened, said after an action (REQ-434): a success goes by itself, a
 * failure stays until it is closed and carries the action that retries it.
 */
import { t, type Lang } from "../core/i18n";

export interface Notice {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
  retry?: () => void;
}

export function Notices({
  lang,
  list,
  onClose,
}: {
  lang: Lang;
  list: Notice[];
  onClose: (id: number) => void;
}) {
  return (
    <div class="notices" role="region" aria-label={t(lang, "notices")}>
      <div aria-live="polite">
        {list
          .filter((n) => n.kind !== "err")
          .map((n) => (
            <div class={`notice notice-${n.kind}`} key={n.id}>
              <span aria-hidden="true">{n.kind === "ok" ? "✓" : "•"}</span>
              <span class="grow">{n.text}</span>
              <button
                type="button"
                class="x"
                aria-label={t(lang, "close")}
                onClick={() => onClose(n.id)}
              >
                ×
              </button>
            </div>
          ))}
      </div>
      <div role="alert">
        {list
          .filter((n) => n.kind === "err")
          .map((n) => (
            <div class="notice notice-err" key={n.id}>
              <span aria-hidden="true">!</span>
              <span class="grow">{n.text}</span>
              {n.retry ? (
                <button
                  type="button"
                  class="btn-ghost"
                  onClick={() => {
                    onClose(n.id);
                    n.retry!();
                  }}
                >
                  {t(lang, "retryIt")}
                </button>
              ) : null}
              <button
                type="button"
                class="x"
                aria-label={t(lang, "close")}
                onClick={() => onClose(n.id)}
              >
                ×
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
