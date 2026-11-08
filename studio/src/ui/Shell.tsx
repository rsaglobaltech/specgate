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

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

export function Shell({ project, section, prefs, onPrefs, badges = {}, children }: ShellProps) {
  const lang: Lang = prefs.lang;
  const themeLabel =
    prefs.theme === "light" ? "themeLight" : prefs.theme === "dark" ? "themeDark" : "themeSystem";
  return (
    <div class="app">
      <nav class="side" aria-label={t(lang, "sections")}>
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
              <a href={hrefOf(s)} aria-current={s === section ? "page" : undefined}>
                <span>{t(lang, s)}</span>
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
