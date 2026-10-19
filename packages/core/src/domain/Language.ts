/**
 * The language of generated prose.
 *
 * A Spanish team writing Spanish specs should not have `Added` and `Retired`
 * appear in the middle of them — but they must not have `SHALL` translated
 * either. The grammar is not prose: `SHALL`, `GIVEN`/`WHEN`/`THEN`,
 * `## ADDED Requirements`, `REQ-NNN` and `specgate:trace` are what the validator
 * parses. Translating any of them breaks the file.
 *
 * So the split is explicit. Only the sentences a human reads are translated;
 * the keywords never are, and there is a test asserting that.
 *
 * Set with `specgate config set language es`. Defaults to English.
 *
 * The tables and the tag-matching live here. Finding out which language a
 * given project asked for reads its config, so that half is infrastructure —
 * see `DiskLanguageRepository`.
 */

/** Never translated, in any language. These are parsed, not read. */
export const KEYWORDS = Object.freeze([
  "SHALL",
  "MUST",
  "SHOULD",
  "MAY",
  "GIVEN",
  "WHEN",
  "THEN",
  "AND",
  "ADDED Requirements",
  "MODIFIED Requirements",
  "REMOVED Requirements",
  "Requirement:",
  "Scenario:",
  "specgate:trace",
]);

/** The sentences a generator may translate. Never the grammar. */
export interface Phrases {
  systemShall: (behaviour: string) => string;
  systemShallMeet: (what: string) => string;
  observableBehaviour: string;
  priority: (value: string) => string;
  todoSteps: (name: string) => string;
  todoStepsPlain: string;
  precondition: string;
  action: string;
  outcome: string;
  scenarioName: string;
  shortName: string;
  capability: string;
  added: string;
  modified: string;
  removed: string;
}

/** The languages a phrase table exists for. */
export type Language = "en" | "es" | "pt";

export const PHRASES: Record<Language, Phrases> = {
  en: {
    systemShall: (behaviour) => `The system SHALL ${behaviour}.`,
    systemShallMeet: (what) => `The system SHALL satisfy "${what}".`,
    observableBehaviour: "<observable behaviour>",
    priority: (value) => `_Priority: ${value}._`,
    todoSteps: (name) => `- TODO: write the GIVEN / WHEN / THEN steps for "${name}"`,
    todoStepsPlain: "- TODO: write the GIVEN / WHEN / THEN steps",
    precondition: "<precondition>",
    action: "<action>",
    outcome: "<observable outcome>",
    scenarioName: "<scenario name>",
    shortName: "<short name>",
    capability: "<capability>",
    added: "Added",
    modified: "Modified",
    removed: "Retired",
  },
  es: {
    systemShall: (behaviour) => `El sistema SHALL ${behaviour}.`,
    systemShallMeet: (what) => `El sistema SHALL cumplir "${what}".`,
    observableBehaviour: "<comportamiento observable>",
    priority: (value) => `_Prioridad: ${value}._`,
    todoSteps: (name) => `- TODO: escribir los pasos GIVEN / WHEN / THEN de "${name}"`,
    todoStepsPlain: "- TODO: escribir los pasos GIVEN / WHEN / THEN",
    precondition: "<precondición>",
    action: "<acción>",
    outcome: "<resultado observable>",
    scenarioName: "<nombre del escenario>",
    shortName: "<nombre corto>",
    capability: "<capacidad>",
    added: "Añadidos",
    modified: "Modificados",
    removed: "Retirados",
  },
  pt: {
    systemShall: (behaviour) => `O sistema SHALL ${behaviour}.`,
    systemShallMeet: (what) => `O sistema SHALL cumprir "${what}".`,
    observableBehaviour: "<comportamento observável>",
    priority: (value) => `_Prioridade: ${value}._`,
    todoSteps: (name) => `- TODO: escrever os passos GIVEN / WHEN / THEN de "${name}"`,
    todoStepsPlain: "- TODO: escrever os passos GIVEN / WHEN / THEN",
    precondition: "<precondição>",
    action: "<ação>",
    outcome: "<resultado observável>",
    scenarioName: "<nome do cenário>",
    shortName: "<nome curto>",
    capability: "<capacidade>",
    added: "Adicionados",
    modified: "Modificados",
    removed: "Retirados",
  },
};

export const DEFAULT = "en";

/**
 * The phrase table for a language tag, falling back to the base tag and then
 * to English. `null` or an unknown tag both mean English.
 */
export function phrasesFor(tag: string | null | undefined): Phrases {
  return (PHRASES as Record<string, Phrases>)[languageFor(tag)];
}

/** Which of the tables above a tag selects. */
export function languageFor(tag: string | null | undefined): string {
  if (!tag) return DEFAULT;
  // Indexed as a plain record on purpose: the lookup is a truthiness test on
  // whatever tag the config holds, not a membership test on `Language`.
  const tables: Record<string, Phrases | undefined> = PHRASES;
  const lower = String(tag).toLowerCase();
  if (tables[lower]) return lower;
  const base = lower.split("-")[0];
  return tables[base] ? base : DEFAULT;
}
