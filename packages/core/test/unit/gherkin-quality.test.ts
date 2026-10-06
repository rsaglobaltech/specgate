/**
 * The scenario-quality rules, tested where they now live (A3).
 *
 * They used to live inside `pack lint` and judge one thing: a `pack.yaml`. The
 * harness does not gate packs, it gates projects, and a project's features
 * arrive by routes that never touch `pack lint`. Moving the rules into the
 * domain is what lets `validate --strict-scenarios`, `doctor` and `harness run`
 * reach the same verdict instead of growing three drifting copies — which is
 * exactly how H14 happened.
 *
 * Severity is the part worth pinning: two rules are errors and can never be
 * demoted to style, because the scenarios they catch *pass*.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  QUALITY_CODES,
  analyseGherkinSource,
  analyseKeywordCase,
  analyseScenario,
  isGenericTitle,
} from "../../src/domain/GherkinQuality";

const codesOf = (findings: any[]) => findings.map((f) => f.code);
const byCode = (findings: any[], code: string) => findings.find((f) => f.code === code);

const GOOD = {
  name: "Defining a flag emits FlagDefined",
  steps: [
    { keyword: "given", text: "no flag with id 'new-checkout' exists" },
    { keyword: "when", text: "an operator defines the flag with default=false" },
    { keyword: "then", text: "FlagDefined is emitted" },
  ],
  outline: false,
  hasExamples: true,
};

test("a well-formed scenario raises nothing", () => {
  assert.deepEqual(analyseScenario(GOOD, "SCN-001"), []);
});

test("an empty scenario is an error, never a warning", () => {
  // The whole point of A3 meeting H14: Cucumber reports this as
  // `1 scenario (1 passed) · 0 steps · exit 0`. A warning would let it ship.
  const found = analyseScenario({ ...GOOD, steps: [] }, "SCN-001");
  const noSteps = byCode(found, QUALITY_CODES.NO_STEPS);
  assert.ok(noSteps, `expected ${QUALITY_CODES.NO_STEPS}, got ${codesOf(found)}`);
  assert.equal(noSteps.severity, "error");
  assert.ok(noSteps.fix, "a rule without a fix is a rule the user cannot act on");
  assert.match(noSteps.message, /case-sensitive/, "it should name the usual cause");
});

test("a Scenario Outline without Examples is an error — it runs zero times", () => {
  const found = analyseScenario({ ...GOOD, outline: true, hasExamples: false }, "SCN-001");
  const outline = byCode(found, QUALITY_CODES.OUTLINE_WITHOUT_EXAMPLES);
  assert.ok(outline);
  assert.equal(outline.severity, "error");
});

test("thin, actionless, assertionless and vague scenarios are warnings", () => {
  // They weaken the signal; they do not fake it. Blocking on them would make
  // the tool unusable on a repository brought in with `specgate adopt`.
  const thin = analyseScenario(
    { ...GOOD, steps: [{ keyword: "given", text: "a thing" }] },
    "SCN-001"
  );
  assert.equal(byCode(thin, QUALITY_CODES.TOO_FEW_STEPS).severity, "warning");
  assert.equal(byCode(thin, QUALITY_CODES.NO_WHEN).severity, "warning");
  assert.equal(byCode(thin, QUALITY_CODES.NO_THEN).severity, "warning");

  const vague = analyseScenario(
    { ...GOOD, steps: [...GOOD.steps, { keyword: "then", text: "it works correctly" }] },
    "SCN-001"
  );
  const v = byCode(vague, QUALITY_CODES.VAGUE_STEP);
  assert.ok(v, `expected a vague-step finding, got ${codesOf(vague)}`);
  assert.equal(v.severity, "warning");
});

test("every finding carries the target it was asked to report against", () => {
  const found = analyseScenario({ ...GOOD, steps: [] }, "SCN-042", "features/x.feature");
  assert.equal(found[0].target, "SCN-042");
  assert.equal(found[0].file, "features/x.feature");
});

test("isGenericTitle knows a name from a placeholder", () => {
  for (const bad of ["", "Test", "Scenario 1", "Example", "Untitled", "two words"]) {
    assert.equal(isGenericTitle(bad), true, `${JSON.stringify(bad)} should be generic`);
  }
  assert.equal(isGenericTitle("Defining a flag emits FlagDefined"), false);
});

test("keyword case is judged on the raw text, with the line and the fix", () => {
  const source = [
    "Feature: Flags",
    "  Scenario: Defining a flag emits FlagDefined",
    "    GIVEN no flag exists",
    "    When an operator defines one",
    "    Then FlagDefined is emitted",
    "",
  ].join("\n");

  const found = analyseKeywordCase(source, "features/flags.feature");
  assert.equal(found.length, 1, `expected one, got ${JSON.stringify(found)}`);
  assert.equal(found[0].code, QUALITY_CODES.KEYWORD_CASE);
  assert.equal(found[0].severity, "error");
  assert.equal(found[0].line, 3);
  assert.equal(found[0].file, "features/flags.feature");
  assert.match(found[0].message, /`GIVEN`/);
  assert.match(found[0].message, /`Given`/);
});

test("a source-level analysis reports the case error and the emptiness it causes", () => {
  // Both, deliberately. The case error says what to change; `no steps` says
  // what it costs. One without the other is either a riddle or a nag.
  const source = [
    "Feature: Flags",
    "  Scenario: Defining a flag emits FlagDefined",
    "    GIVEN no flag exists",
    "    WHEN an operator defines one",
    "    THEN FlagDefined is emitted",
    "",
  ].join("\n");

  const codes = codesOf(analyseGherkinSource(source, "features/flags.feature"));
  assert.equal(codes.filter((c) => c === QUALITY_CODES.KEYWORD_CASE).length, 3);
  assert.ok(codes.includes(QUALITY_CODES.NO_STEPS));
});

test("a good source analyses clean, in Spanish as in English", () => {
  const es = [
    "# language: es",
    "Característica: Facturación",
    "  Escenario: Emitir una factura genera InvoiceIssued",
    "    Dado un cliente con id 'C-1'",
    "    Cuando se emite la factura por 100 EUR",
    "    Entonces se emite InvoiceIssued",
    "",
  ].join("\n");
  assert.deepEqual(analyseGherkinSource(es, "features/facturacion.feature"), []);
});

test("an unfilled <placeholder> in a plain Scenario is an error", () => {
  // Three steps, a real title, no vague word — it passed every gate with its
  // requirement Implemented. A template nobody filled in describes nothing.
  const template = {
    ...GOOD,
    steps: [
      { keyword: "given", text: "<the state before the action>" },
      { keyword: "when", text: "<the action under test>" },
      { keyword: "then", text: "<the observable outcome>" },
    ],
  };
  const found = analyseScenario(template, "t");
  assert.deepEqual(codesOf(found), Array(3).fill(QUALITY_CODES.PLACEHOLDER_STEP));
  assert.equal(byCode(found, QUALITY_CODES.PLACEHOLDER_STEP).severity, "error");
});

test("in an Outline, <x> is a parameter, not a placeholder", () => {
  const outline = {
    ...GOOD,
    outline: true,
    hasExamples: true,
    steps: [
      { keyword: "given", text: "an order of <amount>" },
      { keyword: "when", text: "the total is computed" },
      { keyword: "then", text: "the total is <total>" },
    ],
  };
  assert.deepEqual(analyseScenario(outline, "t"), []);
});
