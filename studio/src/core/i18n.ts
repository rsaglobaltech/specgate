/** The studio's words, in Spanish and English (REQ-204): both hold every key. */
export const TEXTS = {
  es: {
    home: "Inicio",
    brief: "Brief",
    changes: "Cambios",
    questions: "Preguntas",
    build: "Construir",
    live: "En vivo",
    report: "Informe",
    settings: "Ajustes",
    sections: "Secciones",
    simple: "Simple",
    advanced: "Avanzado",
    themeLight: "Tema claro",
    themeDark: "Tema oscuro",
    themeSystem: "Tema del sistema",
    language: "Idioma",
    mode: "Modo",
  },
  en: {
    home: "Home",
    brief: "Brief",
    changes: "Changes",
    questions: "Questions",
    build: "Build",
    live: "Live",
    report: "Report",
    settings: "Settings",
    sections: "Sections",
    simple: "Simple",
    advanced: "Advanced",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    themeSystem: "System theme",
    language: "Language",
    mode: "Mode",
  },
} as const;

export type Lang = keyof typeof TEXTS;
export type Key = keyof (typeof TEXTS)["es"];

/** A word in the language chosen, Spanish when the key is missing. */
export function t(lang: Lang, key: Key): string {
  return (TEXTS[lang] as Record<string, string>)[key] ?? TEXTS.es[key];
}
