/**
 * Journeys: a scenario that chains requirements, and owes a test (REQ-552).
 *
 * Each requirement can pass its own test while the path a user actually takes
 * across them — borrow, then return — breaks at the seam. A journey is a
 * Gherkin scenario tagged `@JRN-NNN` together with the `@REQ-NNN` of every
 * requirement it crosses. Once all of them are delivered, the journey owes a
 * test that names it; a tag that names a requirement nobody specified is a
 * journey through nothing. Pure: feature files in, journeys and findings out.
 */

export interface Journey {
  readonly id: string;
  readonly title: string;
  readonly requirements: readonly string[];
  readonly file: string;
  /** 1-based line of its `Scenario:`. */
  readonly line: number;
}

/** Every scenario tagged `@JRN-NNN`, with the requirements its tags name. */
export function journeysIn(features: ReadonlyArray<{ path: string; source: string }>): Journey[] {
  const out: Journey[] = [];
  for (const f of features) {
    let tags: string[] = [];
    f.source
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((raw, i) => {
        const line = raw.trim();
        if (line.startsWith("@")) {
          tags.push(...line.split(/\s+/).filter((t) => t.startsWith("@")));
          return;
        }
        const sc = /^Scenario(?: Outline)?:\s*(.*)$/.exec(line);
        if (sc) {
          const ids = tags.filter((t) => /^@JRN-\d+$/.test(t)).map((t) => t.slice(1));
          const reqs = [
            ...new Set(tags.filter((t) => /^@REQ-\d+$/.test(t)).map((t) => t.slice(1))),
          ];
          for (const id of ids) {
            out.push({ id, title: sc[1].trim(), requirements: reqs, file: f.path, line: i + 1 });
          }
          tags = [];
          return;
        }
        if (line && !line.startsWith("#")) tags = [];
      });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** `JRN-001` as a whole token. */
const mentions = (source: string, id: string) =>
  new RegExp(`(^|[^A-Za-z0-9])${id}(?![0-9])`).test(source);

/** The tests that name a journey. */
export function journeyTests(
  journey: Journey,
  tests: ReadonlyArray<{ path: string; source: string }>
): string[] {
  return tests.filter((t) => mentions(t.source, journey.id)).map((t) => t.path);
}

export interface JourneyFinding {
  readonly code: "journey_untested" | "journey_requirement_unknown";
  readonly journey: Journey;
  /** The unknown requirement, for `journey_requirement_unknown`. */
  readonly requirement?: string;
}

const DELIVERED = new Set(["Implemented", "Verified", "Released"]);

/**
 * `journey_requirement_unknown` for each tag naming a requirement that does
 * not exist; `journey_untested` for a journey whose requirements are all
 * delivered and that no test names.
 */
export function journeyFindings(
  journeys: readonly Journey[],
  statusOf: ReadonlyMap<string, string>,
  tests: ReadonlyArray<{ path: string; source: string }>
): JourneyFinding[] {
  const out: JourneyFinding[] = [];
  for (const j of journeys) {
    const unknown = j.requirements.filter((r) => !statusOf.has(r));
    for (const r of unknown)
      out.push({ code: "journey_requirement_unknown", journey: j, requirement: r });
    if (unknown.length > 0 || j.requirements.length === 0) continue;
    const delivered = j.requirements.every((r) => DELIVERED.has(statusOf.get(r) || ""));
    if (delivered && journeyTests(j, tests).length === 0)
      out.push({ code: "journey_untested", journey: j });
  }
  return out;
}

/** The titles of the journey scenarios in one feature file. */
export function journeyTitles(source: string): Set<string> {
  return new Set(journeysIn([{ path: "", source }]).map((j) => j.title));
}

/** True when every scenario of a feature file is a journey. */
export function onlyJourneys(source: string): boolean {
  const titles = journeyTitles(source);
  if (titles.size === 0) return false;
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => /^\s*Scenario(?: Outline)?:\s*(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .every((m) => titles.has(m[1].trim()));
}
