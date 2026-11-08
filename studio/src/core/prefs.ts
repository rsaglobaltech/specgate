/**
 * What the viewer chose — mode, language, theme — remembered in their browser
 * (REQ-204). Storage can be missing or refuse; the studio works without it.
 */
import type { Lang } from "./i18n";

export type Mode = "simple" | "advanced";
export type Theme = "system" | "light" | "dark";

export interface Prefs {
  mode: Mode;
  lang: Lang;
  theme: Theme;
}

export const DEFAULTS: Prefs = { mode: "simple", lang: "es", theme: "system" };

const KEY = "sg-studio-prefs";

/** The preferences kept in the given storage, the defaults for anything missing or wrong. */
export function readPrefs(storage: Pick<Storage, "getItem"> | null | undefined): Prefs {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || "{}") as Partial<Prefs>;
    return {
      mode: raw.mode === "advanced" ? "advanced" : "simple",
      lang: raw.lang === "en" ? "en" : "es",
      theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Keep the preferences; a storage that refuses is not an error. */
export function writePrefs(storage: Pick<Storage, "setItem"> | null | undefined, p: Prefs): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private window, blocked storage: the choice lasts this visit */
  }
}
