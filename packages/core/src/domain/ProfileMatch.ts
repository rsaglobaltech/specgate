/**
 * Which agent profile a requirement gets (D1).
 *
 * ## Why per requirement and not per run
 *
 * `agent_profile` resolves one profile for the whole run, so an infrastructure
 * requirement and a domain one get the same prompt prefix and the same allowed
 * tools. The tool allowances then have to be the greatest common denominator of
 * everything in the plan — a domain requirement carrying `Bash(terraform:*)`
 * because some other requirement needed it.
 *
 * ## The criterion, and what it cost to find
 *
 * The proposal named the bounded context, "which is already in the model". It
 * is in the *pack* model; it was not reachable from a requirement. Measured
 * across the eleven curated packs: **zero of twenty-seven scenarios** link to
 * an aggregate, directly or through their use case, so matching on it would
 * have matched nothing and fallen through to the default every time — a feature
 * that looks like it works and does nothing.
 *
 * The link does exist, one step further round: use case → command → aggregate →
 * bounded context resolves for **all twenty-seven**. So `expand` derives it and
 * writes it beside the matrix, and this module matches on what is written.
 *
 * ## First match wins
 *
 * Order in the file is the priority, which is what makes a `"*"` catch-all at
 * the end read the way people expect. No match is not an error: the run's
 * default profile applies, exactly as before this existed.
 */

export interface ProfileRule {
  readonly name: string;
  /** `{ bounded_context: "Platform" }`, or `"*"` for any. Empty matches nothing. */
  readonly match?: Readonly<Record<string, string>>;
}

export interface RequirementFacts {
  readonly requirement?: string;
  readonly boundedContext?: string;
  readonly featureFile?: string;
  readonly category?: string;
  /** The requirement's capability: its module (agent-routing REQ-688). */
  readonly module?: string;
}

/** What a `match:` key is asking about. Unknown keys never match, and say so. */
const FACT_BY_KEY: Readonly<Record<string, keyof RequirementFacts>> = Object.freeze({
  bounded_context: "boundedContext",
  requirement: "requirement",
  feature: "featureFile",
  category: "category",
  module: "module",
});

export const MATCHABLE_KEYS = Object.freeze(Object.keys(FACT_BY_KEY));

/**
 * Glob in the small dialect these rules use: `*` matches any run of characters.
 *
 * Deliberately not path-aware — a bounded context is a name, not a path, and
 * `feature` is matched as a whole string so `features/billing/*` reads the way
 * it looks.
 */
function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+^${}()|[\]\\?]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`, "i").test(value);
}

/** Does this rule match, and did it actually test anything? */
export function ruleMatches(rule: ProfileRule, facts: RequirementFacts): boolean {
  const criteria = Object.entries(rule.match || {});
  if (criteria.length === 0) return false;

  for (const [key, pattern] of criteria) {
    const factKey = FACT_BY_KEY[key];
    if (!factKey) return false;
    const value = facts[factKey];
    if (!value || !matchesPattern(String(value), String(pattern))) return false;
  }
  return true;
}

/**
 * The first profile whose `match:` accepts this requirement, or `null`.
 *
 * `null` means "use the run's default", not "something went wrong".
 */
export function selectProfile(
  rules: readonly ProfileRule[],
  facts: RequirementFacts
): string | null {
  for (const rule of rules) {
    if (ruleMatches(rule, facts)) return rule.name;
  }
  return null;
}
