/**
 * Linking the matrix to the file, in the way Cucumber already understands (F4).
 *
 * ## The gap
 *
 * A matrix row says `SCN-001` and names a feature file, and **nothing checks
 * that the scenario is in it**. Measured: rename the scenario and both
 * `validate --strict-tdd` and `validate --strict-scenarios` still pass. The
 * help text has been asking for a Scenario ID "that matches a scenario in its
 * feature file" without ever comparing the two.
 *
 * Cucumber has an idiomatic way to express that link, and it is tags:
 *
 * ```gherkin
 * @REQ-001 @SCN-001
 * Scenario: Evaluation respects the rollout percentage
 * ```
 *
 * A tag survives renaming the scenario, which is what makes the harness gate
 * robust to the one thing an agent does that turns the gate green and empty
 * (§2.2): filtering by `--tags "@REQ-001"` cannot be defeated by rewording a
 * title.
 *
 * ## Idempotent on purpose
 *
 * `expand` runs more than once against the same project, and `change archive`
 * rewrites features in place. Adding a tag has to be safe to repeat: a tag
 * already present is left alone rather than duplicated, and existing tags a
 * person wrote are preserved.
 */

/** `@REQ-001`, `@SCN-014a` — ours. Anything else on the line belongs to the project. */
const CSDA_TAG = /^@(REQ|SCN)-[A-Za-z0-9.]+$/;

/** A scenario heading in any dialect, captured with its indentation. */
const SCENARIO_LINE = /^(\s*)([^\s:][^:]*):\s*(.*)$/;

export function isCsdaTag(tag: string): boolean {
  return CSDA_TAG.test(tag.trim());
}

/** The tags on a line, or `null` when the line is not a tag line. */
export function parseTagLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("@")) return null;
  const tags = trimmed.split(/\s+/).filter(Boolean);
  return tags.every((t) => t.startsWith("@")) ? tags : null;
}

/**
 * Add `tags` above the scenario named `scenarioName`.
 *
 * Returns the source unchanged when the scenario is not there — a caller that
 * wants that reported should compare, because silently doing nothing is how a
 * tagging step becomes a no-op nobody notices.
 */
export function tagScenario(source: string, scenarioName: string, tags: readonly string[]): string {
  const wanted = tags.map((t) => t.trim()).filter(Boolean);
  if (wanted.length === 0 || !scenarioName) return source;

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const target = scenarioName.trim();

  for (let i = 0; i < lines.length; i += 1) {
    const match = SCENARIO_LINE.exec(lines[i]);
    if (!match || match[3].trim() !== target) continue;
    // Only a heading that introduces a scenario; `Feature:` and `Background:`
    // take tags in Gherkin too, but this is asked for one scenario by name.
    if (
      !/^(Scenario|Scenario Outline|Example|Escenario|Esquema del escenario|Cenário|Esquema do Cenário)$/i.test(
        match[2].trim()
      )
    ) {
      continue;
    }

    const indent = match[1];
    const existing = i > 0 ? parseTagLine(lines[i - 1]) : null;
    const already = new Set(existing || []);
    const missing = wanted.filter((t) => !already.has(t));
    if (missing.length === 0) return lines.join("\n");

    if (existing) {
      lines[i - 1] = `${indent}${[...existing, ...missing].join(" ")}`;
    } else {
      lines.splice(i, 0, `${indent}${missing.join(" ")}`);
    }
    return lines.join("\n");
  }

  return lines.join("\n");
}

/** The csda tags a scenario carries, by scenario name. */
export function csdaTagsByScenario(source: string): Record<string, string[]> {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const found: Record<string, string[]> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const match = SCENARIO_LINE.exec(lines[i]);
    if (!match) continue;
    const tags = i > 0 ? parseTagLine(lines[i - 1]) : null;
    if (!tags) continue;
    const ours = tags.filter(isCsdaTag);
    if (ours.length > 0) found[match[3].trim()] = ours;
  }
  return found;
}

/** Every csda tag in a file, whatever it is attached to. */
export function csdaTagsIn(source: string): string[] {
  const found = new Set<string>();
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    for (const tag of parseTagLine(line) || []) {
      if (isCsdaTag(tag)) found.add(tag);
    }
  }
  return [...found].sort();
}

/** Whether `source` has a scenario heading with exactly this name. */
export function hasScenario(source: string, scenarioName: string): boolean {
  const target = String(scenarioName || "").trim();
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .some((line) => {
      const match = SCENARIO_LINE.exec(line);
      return Boolean(match && match[3].trim() === target);
    });
}
