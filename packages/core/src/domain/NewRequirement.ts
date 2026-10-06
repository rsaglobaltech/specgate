/**
 * What `specgate new` writes for a requirement: a slug for its feature file
 * and a tagged scenario of placeholders for a person to rewrite.
 *
 * The placeholders are deliberate. A scenario the tool invents would read as
 * a decision nobody made; `<the observable outcome>` reads as a question. The
 * gate leaves them alone while the requirement is Draft and refuses them once
 * it is delivered (`scenario_placeholder_step`).
 */

const MAX_SLUG_WORDS = 6;

/** `Totals are rounded half-up` → `totals-are-rounded-half-up`. */
export function slugFor(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SLUG_WORDS);
  return words.join("-") || "requirement";
}

/** The scenario, tagged so `validate` can tie it to its matrix row. */
export function scenarioBlock(reqId: string, scenarioId: string, title: string): string {
  return [
    `  @${reqId} @${scenarioId}`,
    `  Scenario: ${title}`,
    "    Given <the state before the action>",
    "    When <the action under test>",
    "    Then <the observable outcome>",
    "",
  ].join("\n");
}

/** A new feature file, or the scenario appended to an existing one. */
export function featureWithScenario(existing: string | null, title: string, block: string): string {
  if (existing === null) return `Feature: ${title}\n\n${block}`;
  return `${existing.replace(/\s*$/, "")}\n\n${block}`;
}
