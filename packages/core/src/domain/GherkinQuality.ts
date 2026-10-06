/**
 * Whether a scenario is worth running — the rules, with nothing around them.
 *
 * ## Why this is its own module (A3)
 *
 * `docs/specs/harness.md` says it plainly: *the gate is only as strong as the
 * scenarios in the pack*. Eight rules enforce that — no `When`, no `Then`, too
 * few steps, a generic title, vague language, an Outline without Examples, and
 * the two H14 rules — and until now all eight lived inside `pack lint` and
 * applied to one thing: a `pack.yaml`.
 *
 * But the harness does not gate packs. It gates **projects**, and a project's
 * features arrive by three routes that never touch `pack lint`: `change
 * archive`, `req add`, and a person with an editor. The rule protecting the
 * harness was not applied where the harness runs.
 *
 * So the rules live here, in the domain, knowing nothing about `pack.yaml`,
 * files, or flags. `pack lint`, `validate --strict-scenarios`, `doctor` and
 * `harness run` all read the same judgement instead of three drifting copies —
 * which is the shape H14 taught: three hand-written parsers disagreeing is how
 * a linter ends up approving what the runner ignores.
 *
 * ## Why `Diagnostic` and not a new shape
 *
 * ADR-0017 already fixes the envelope every machine-readable surface emits:
 * `{ severity, code, message, target?, fix?, file?, line? }`. A3 asked for
 * rules carrying a `code` and a `fix`; that is this envelope, so it is reused
 * rather than reinvented. Callers branch on `code`, never on message text.
 *
 * ## Severity is not a matter of taste
 *
 * Three rules are errors and can never be demoted to style: `scenario_has_no_steps`,
 * `keyword_case_invalid` and `scenario_placeholder_step` — a template nobody
 * filled in describes no behaviour. Cucumber reports an empty scenario as
 * `1 scenario (1 passed) · 0 steps · exit 0` — a test that proves nothing and
 * says it passed. 27 shipped scenarios were in that state while `--strict`
 * called them fine (H14). The rest are warnings: a two-step scenario is weak,
 * but it does run.
 */

import type { Diagnostic } from "./Diagnostic";
import { error, warning } from "./Diagnostic";
import { findKeywordCaseIssues, parseGherkin } from "./Gherkin";

/**
 * The least a rule needs to judge a scenario.
 *
 * Deliberately narrower than `GherkinScenario`: a pack may declare a scenario
 * inline as `given:`/`when:`/`then:` lists with no `.feature` file behind it,
 * and those deserve the same rules. Anything that can produce a title and a
 * list of steps can be checked.
 */
export interface ScenarioQualityInput {
  /** The scenario title. */
  readonly name: string;
  readonly steps: ReadonlyArray<{ readonly keyword: string; readonly text: string }>;
  readonly outline: boolean;
  readonly hasExamples: boolean;
  readonly line?: number;
}

/**
 * Language that describes nothing checkable.
 *
 * `Then it works correctly` is not falsifiable: it passes or fails on the
 * implementer's mood, which makes the gate's verdict meaningless.
 */
const VAGUE_STEP_RE =
  /\b(works?|correctly|properly|as expected|should be fine|should work|somehow|something|some stuff|etc\.?|tbd|todo)\b|\.\.\./i;

/** Every code this module can emit. Callers branch on these, never on prose. */
export const QUALITY_CODES = Object.freeze({
  TITLE_GENERIC: "scenario_title_generic",
  NO_STEPS: "scenario_has_no_steps",
  TOO_FEW_STEPS: "scenario_too_few_steps",
  NO_WHEN: "scenario_without_when",
  NO_THEN: "scenario_without_then",
  OUTLINE_WITHOUT_EXAMPLES: "scenario_outline_without_examples",
  VAGUE_STEP: "vague_step",
  KEYWORD_CASE: "keyword_case_invalid",
  PLACEHOLDER_STEP: "scenario_placeholder_step",
});

/**
 * An unfilled `<placeholder>` in a plain Scenario.
 *
 * In an Outline, `<x>` is a parameter the Examples table fills. In a plain
 * Scenario nothing fills it: `Given <the starting state>` is a template a
 * person was meant to rewrite. Measured 2026-10-06: a scenario made of three
 * such steps passed `validate --strict` and `done --strict` with its
 * requirement Implemented — three steps, a real title, no vague word.
 */
const PLACEHOLDER_RE = /<[^<>]+>/;

/**
 * A title that names nothing: `Test`, `Scenario 1`, or fewer than three words.
 *
 * Exported because `pack lint` has always exposed it and its tests pin it.
 */
export function isGenericTitle(title: string): boolean {
  if (!title) return true;
  if (/^(test|scenario|example|untitled)\b/i.test(title)) return true;
  return title.split(/\s+/).filter(Boolean).length < 3;
}

/**
 * The nine rules, applied to one scenario.
 *
 * `target` is what the caller wants the reader to look at — a pack scenario id,
 * a file path, whatever locates it. The domain does not invent it because the
 * domain does not know which surface is asking.
 */
export function analyseScenario(
  scenario: ScenarioQualityInput,
  target: string,
  file?: string
): Diagnostic[] {
  const found: Diagnostic[] = [];
  const at = (extra: Record<string, unknown> = {}) => ({
    target,
    ...(file ? { file } : {}),
    ...(scenario.line ? { line: scenario.line } : {}),
    ...extra,
  });
  const kinds = new Set(scenario.steps.map((s) => s.keyword));

  if (isGenericTitle(scenario.name)) {
    found.push(
      warning(
        QUALITY_CODES.TITLE_GENERIC,
        "scenario title is generic — name the behaviour under test.",
        at({ fix: "Title it after the behaviour, e.g. `Defining a flag emits FlagDefined`." })
      )
    );
  }

  if (scenario.steps.length === 0) {
    // Never a warning. See the module note: Cucumber passes this scenario.
    found.push(
      error(
        QUALITY_CODES.NO_STEPS,
        "scenario_has_no_steps — Cucumber sees no steps here, so this scenario " +
          "passes without testing anything. If the steps look like they are there, " +
          "check their keywords: Gherkin is case-sensitive.",
        at({ fix: "Write Given / When / Then steps, in that capitalisation." })
      )
    );
  } else if (scenario.steps.length < 3) {
    found.push(
      warning(
        QUALITY_CODES.TOO_FEW_STEPS,
        `only ${scenario.steps.length} step(s) — a real scenario needs Given/When/Then.`,
        at({ fix: "Add the missing context, action or assertion." })
      )
    );
  }

  if (!kinds.has("when")) {
    found.push(
      warning(
        QUALITY_CODES.NO_WHEN,
        "no When step — the scenario exercises no action.",
        at({ fix: "Add a `When` step naming the action under test." })
      )
    );
  }
  if (!kinds.has("then")) {
    found.push(
      warning(
        QUALITY_CODES.NO_THEN,
        "no Then step — the scenario asserts nothing.",
        at({ fix: "Add a `Then` step stating the observable outcome." })
      )
    );
  }

  if (scenario.outline && !scenario.hasExamples) {
    found.push(
      error(
        QUALITY_CODES.OUTLINE_WITHOUT_EXAMPLES,
        "Scenario Outline has no Examples table.",
        at({ fix: "Add an `Examples:` table, or make it a plain `Scenario`." })
      )
    );
  }

  for (const step of scenario.steps) {
    if (!scenario.outline && PLACEHOLDER_RE.test(step.text)) {
      found.push(
        error(
          QUALITY_CODES.PLACEHOLDER_STEP,
          `unfilled placeholder in "${step.keyword} ${step.text}" — nothing fills it outside an Outline.`,
          at({ fix: "Replace the <placeholder> with the concrete state, action or outcome." })
        )
      );
      continue;
    }
    if (VAGUE_STEP_RE.test(step.text)) {
      found.push(
        warning(
          QUALITY_CODES.VAGUE_STEP,
          `vague step "${step.keyword} ${step.text}" — make it concrete and falsifiable.`,
          at({ fix: "State a checkable fact: a value, a state, an emitted event." })
        )
      );
    }
  }

  return found;
}

/**
 * Just the case check, for callers that label findings their own way.
 *
 * Split out because `pack lint` locates a finding by pack scenario id while
 * `validate` locates it by path; the rule is the same, the address is not.
 */
/**
 * The same rules over a whole Gherkin source, plus the case check.
 *
 * The case check runs on the raw text rather than the parse, because the
 * failure it catches is invisible after parsing: `GIVEN a flag` is absorbed as
 * the scenario's description, so a parsed document simply has no steps and
 * cannot say why.
 */
/**
 * Just the case check, for callers that label findings their own way.
 *
 * Split out because `pack lint` locates a finding by pack scenario id while
 * `validate` locates it by path; the rule is the same, the address is not.
 */
export function analyseKeywordCase(source: string, file: string): Diagnostic[] {
  return findKeywordCaseIssues(source).map((issue) =>
    error(
      QUALITY_CODES.KEYWORD_CASE,
      `\`${issue.found}\` is not a Gherkin keyword; write \`${issue.expected}\`. ` +
        "Cucumber reads it as prose, so the line does nothing.",
      { file, line: issue.line, target: file, fix: `Write \`${issue.expected}\`.` }
    )
  );
}

export function analyseGherkinSource(source: string, file: string): Diagnostic[] {
  const found: Diagnostic[] = [...analyseKeywordCase(source, file)];

  const doc = parseGherkin(source);
  for (const scenario of doc.scenarios) {
    found.push(
      ...analyseScenario(
        {
          name: scenario.name,
          steps: scenario.steps.map((s) => ({ keyword: s.keyword, text: s.text })),
          outline: scenario.outline,
          hasExamples: scenario.hasExamples,
          line: scenario.line,
        },
        `${file} → "${scenario.name || "(no title)"}"`,
        file
      )
    );
  }

  return found;
}
