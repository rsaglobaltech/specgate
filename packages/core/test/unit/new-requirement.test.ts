/**
 * What `specgate new` writes: a slug, and a tagged scenario of placeholders.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { featureWithScenario, scenarioBlock, slugFor } from "../../src/domain/NewRequirement";
import { analyseGherkinSource } from "../../src/domain/GherkinQuality";
import { csdaTagsIn } from "../../src/domain/GherkinTags";

test("a slug is the first six words, lowercased and ascii", () => {
  assert.equal(slugFor("Totals are rounded half-up"), "totals-are-rounded-half-up");
  assert.equal(slugFor("Facturación: el IVA se redondea"), "facturacion-el-iva-se-redondea");
  assert.equal(slugFor("one two three four five six seven"), "one-two-three-four-five-six");
  assert.equal(slugFor("!!!"), "requirement");
});

test("the scenario carries the tags validate ties to the matrix row", () => {
  const source = featureWithScenario(null, "Totals", scenarioBlock("REQ-007", "SCN-007", "Totals"));
  const tags = csdaTagsIn(source);
  assert.ok(JSON.stringify(tags).includes("REQ-007"), JSON.stringify(tags));
  assert.ok(JSON.stringify(tags).includes("SCN-007"), JSON.stringify(tags));
});

test("the scenario is three placeholders the gate refuses on delivery", () => {
  const source = featureWithScenario(
    null,
    "Totals are rounded",
    scenarioBlock("REQ-1", "SCN-1", "Totals are rounded")
  );
  const codes = analyseGherkinSource(source, "f.feature").map((d) => d.code);
  assert.deepEqual(codes, Array(3).fill("scenario_placeholder_step"));
});

test("an existing feature file gets the scenario appended, not replaced", () => {
  const out = featureWithScenario(
    "Feature: Totals\n\n  Scenario: old one\n",
    "x",
    "  @REQ-2 @SCN-2\n  Scenario: x\n"
  );
  assert.match(out, /^Feature: Totals/);
  assert.match(out, /Scenario: old one/);
  assert.match(out, /@REQ-2 @SCN-2\n {2}Scenario: x/);
});
