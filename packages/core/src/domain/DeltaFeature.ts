/**
 * A delta's scenarios as a Gherkin feature file (phase-3 E2E finding).
 *
 * `change archive` promised to materialise the feature files, and did — but
 * only the `.feature` files an author had placed inside the change folder,
 * which neither the template nor `change instructions` ever asks for. An
 * author who followed the documented cycle wrote the scenario as
 * `- GIVEN / - WHEN / - THEN` bullets in the delta, pointed `feature=` at a
 * path, and archived into a matrix row naming a file that did not exist.
 *
 * The delta already says everything the file needs: the scenario's name, its
 * steps, and the requirement it belongs to.
 */

import type { ScenarioNode } from "./SpecParser";

const KEYWORD = /^(GIVEN|WHEN|THEN|AND|BUT)\b\s*/i;

/** `GIVEN an order` → `Given an order`. A step with no keyword is kept as written. */
function step(raw: string): string {
  const m = KEYWORD.exec(raw.trim());
  if (!m) return raw.trim();
  const kw = m[1].toLowerCase();
  return `${kw[0].toUpperCase()}${kw.slice(1)} ${raw.trim().slice(m[0].length)}`;
}

export function renderDeltaFeature(
  req: { id: string | null; name?: string; scenarios?: ScenarioNode[] },
  capability: string
): string {
  const lines = [`Feature: ${req.name || capability}`, ""];
  for (const sc of req.scenarios || []) {
    const tags = [req.id ? `@${req.id}` : null, sc.id ? `@${sc.id}` : null].filter(Boolean);
    if (tags.length > 0) lines.push(`  ${tags.join(" ")}`);
    lines.push(`  Scenario: ${sc.name || sc.heading}`);
    for (const s of sc.steps || []) lines.push(`    ${step(s)}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
