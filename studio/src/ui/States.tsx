/**
 * A section's states besides its content (REQ-434): its shape while the first
 * read is under way, a failed read inside it with the way to read again, and
 * the line that says the studio's server cannot be reached.
 */
import { t, type Lang } from "../core/i18n";

/** The section's shape, before anything is known: a heading and three cards. */
export function Skeleton({ lang }: { lang: Lang }) {
  return (
    <div class="skeleton" aria-busy="true" aria-label={t(lang, "loading")}>
      <span class="sk sk-title" />
      <span class="sk sk-line" />
      {[0, 1, 2].map(() => (
        <div class="sk-card">
          <span class="sk sk-line short" />
          <span class="sk sk-line" />
          <span class="sk sk-line" />
        </div>
      ))}
      <span class="visually-hidden" role="status">
        {t(lang, "loading")}
      </span>
    </div>
  );
}

export function SectionError({
  lang,
  message,
  onRetry,
}: {
  lang: Lang;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section class="card section-error" role="alert">
      <h2>{t(lang, "readFailed")}</h2>
      <p class="faint">{message}</p>
      <div class="row">
        <button type="button" class="btn-ghost" onClick={onRetry}>
          {t(lang, "readAgain")}
        </button>
      </div>
    </section>
  );
}

export function Offline({ lang }: { lang: Lang }) {
  return (
    <div class="offline" role="status">
      <span class="spin" aria-hidden="true" />
      <span>
        <strong>{t(lang, "offline")}</strong> {t(lang, "offlineHint")}
      </span>
    </div>
  );
}
