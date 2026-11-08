/** The frame of every section: the sidebar of the approved design, and the section beside it. */
import type { ComponentChildren } from "preact";
import { SECTIONS, hrefOf, type Section } from "../core/routes";
import { t, type Lang } from "../core/i18n";
import type { Prefs, Theme } from "../core/prefs";

export interface ShellProps {
  project: string;
  section: Section;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  badges?: Partial<Record<Section, number>>;
  children?: ComponentChildren;
}

/** One line icon per section, drawn in a 24-unit box with the current colour. */
const ICONS: Record<Section, string> = {
  home: "M3 11 12 4l9 7M5 10v10h14V10",
  brief: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  changes: "M6 4v16M6 8h8a4 4 0 0 1 4 4v8M14 16l4 4 4-4",
  questions:
    "M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V15M12 19h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  build: "M14 6l4 4M4 20l9-9M15 3l6 6-3 3-6-6z",
  live: "M2 12h4l3-7 4 14 3-7h6",
  report: "M5 20V10M12 20V4M19 20v-7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
};

function Icon({ section }: { section: Section }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[section]} />
    </svg>
  );
}

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

export function Shell({ project, section, prefs, onPrefs, badges = {}, children }: ShellProps) {
  const lang: Lang = prefs.lang;
  const themeLabel =
    prefs.theme === "light" ? "themeLight" : prefs.theme === "dark" ? "themeDark" : "themeSystem";
  return (
    <div class={`app${prefs.folded ? " folded" : ""}`}>
      <nav class="side" id="side" aria-label={t(lang, "sections")}>
        <button
          type="button"
          class="fold"
          aria-controls="side"
          aria-expanded={!prefs.folded}
          aria-label={t(lang, prefs.folded ? "unfold" : "fold")}
          title={t(lang, prefs.folded ? "unfold" : "fold")}
          onClick={() => onPrefs({ ...prefs, folded: !prefs.folded })}
        >
          <span aria-hidden="true">{prefs.folded ? "›" : "‹"}</span>
        </button>
        <div class="brand">
          <span class="mark" aria-hidden="true">
            ✓
          </span>
          <span class="name">
            specgate<span class="accent"> studio</span>
          </span>
          <span class="project">{project}</span>
        </div>
        <ul class="nav">
          {SECTIONS.map((s) => (
            <li key={s}>
              <a
                href={hrefOf(s)}
                aria-current={s === section ? "page" : undefined}
                title={prefs.folded ? t(lang, s) : undefined}
              >
                <Icon section={s} />
                <span class="label">{t(lang, s)}</span>
                {badges[s] ? <span class="badge">{badges[s]}</span> : null}
              </a>
            </li>
          ))}
        </ul>
        <div class="prefs">
          <div role="group" aria-label={t(lang, "language")}>
            {(["es", "en"] as const).map((l) => (
              <button
                type="button"
                aria-pressed={prefs.lang === l}
                onClick={() => onPrefs({ ...prefs, lang: l })}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t(lang, "mode")}>
            {(["simple", "advanced"] as const).map((m) => (
              <button
                type="button"
                aria-pressed={prefs.mode === m}
                onClick={() => onPrefs({ ...prefs, mode: m })}
              >
                {t(lang, m)}
              </button>
            ))}
          </div>
          <button
            type="button"
            class="theme"
            aria-label={t(lang, themeLabel)}
            title={t(lang, themeLabel)}
            onClick={() => onPrefs({ ...prefs, theme: NEXT_THEME[prefs.theme] })}
          >
            {prefs.theme === "dark" ? "☾" : prefs.theme === "light" ? "☀" : "◐"}
          </button>
        </div>
      </nav>
      <main class="main" id="main">
        {children}
      </main>
    </div>
  );
}
