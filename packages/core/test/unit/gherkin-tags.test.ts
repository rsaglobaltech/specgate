/**
 * Linking the matrix to the file the way Cucumber already understands (F4).
 *
 * A matrix row names `SCN-001` and a feature file, and nothing checked the
 * scenario was in it. Measured: rename the scenario and both `validate
 * --strict-tdd` and `validate --strict-scenarios` still pass.
 *
 * A tag survives the rename, which is the point — it is the one thing an agent
 * does that turns the harness gate green and empty.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  specgateTagsByScenario,
  specgateTagsIn,
  isSpecgateTag,
  parseTagLine,
  tagScenario,
} from "../../src/domain/GherkinTags";

const FEATURE = [
  "Feature: Platform health baseline",
  "",
  "  Scenario: API reports service as healthy",
  "    Given the backend service is running",
  "    Then the response status should be 200",
  "",
].join("\n");

test("a scenario gains its tags, indented to match", () => {
  const tagged = tagScenario(FEATURE, "API reports service as healthy", ["@REQ-000", "@SCN-000"]);
  assert.match(tagged, /\n {2}@REQ-000 @SCN-000\n {2}Scenario: API reports/);
});

test("tagging twice does not tag twice", () => {
  // `expand` runs more than once against the same project, and `change archive`
  // rewrites features in place. A step that duplicates on every run is one
  // people learn to avoid running.
  const once = tagScenario(FEATURE, "API reports service as healthy", ["@REQ-000"]);
  const twice = tagScenario(once, "API reports service as healthy", ["@REQ-000"]);
  assert.equal(once, twice);
});

test("tags a person already wrote are kept", () => {
  const withTag = [
    "Feature: F",
    "",
    "  @slow @wip",
    "  Scenario: A thing happens here",
    "    Given a thing",
    "",
  ].join("\n");
  const tagged = tagScenario(withTag, "A thing happens here", ["@SCN-001"]);
  assert.match(tagged, /@slow @wip @SCN-001/);
});

test("a scenario that is not there leaves the file untouched", () => {
  // Not an error here — the caller compares and reports. Silently tagging the
  // wrong scenario would be worse than doing nothing.
  assert.equal(tagScenario(FEATURE, "No such scenario", ["@SCN-000"]), FEATURE);
  assert.deepEqual(specgateTagsIn(tagScenario(FEATURE, "No such scenario", ["@SCN-000"])), []);
});

test("only a scenario heading takes the tag, not the Feature line", () => {
  // `Feature:` accepts tags in Gherkin too. Asked for one scenario by name, a
  // tagger that matched the feature heading would put the requirement's tag on
  // every scenario in the file.
  const tagged = tagScenario(FEATURE, "Platform health baseline", ["@REQ-000"]);
  assert.equal(tagged.replace(/\r\n/g, "\n"), FEATURE);
});

test("the Spanish and Portuguese headings are recognised", () => {
  const es = ["Característica: F", "", "  Escenario: Emitir una factura", "    Dado x", ""].join(
    "\n"
  );
  assert.match(tagScenario(es, "Emitir una factura", ["@SCN-001"]), /@SCN-001\n {2}Escenario:/);
});

test("reading back gives the scenario its tags, ours only", () => {
  const tagged = tagScenario(
    tagScenario(FEATURE, "API reports service as healthy", ["@REQ-000", "@SCN-000"]),
    "API reports service as healthy",
    []
  );
  assert.deepEqual(specgateTagsByScenario(tagged), {
    "API reports service as healthy": ["@REQ-000", "@SCN-000"],
  });
  assert.deepEqual(specgateTagsIn(tagged), ["@REQ-000", "@SCN-000"]);
});

test("a project's own tags are not mistaken for ours", () => {
  // `@slow` is the project's business. Treating it as a traceability tag would
  // make an untagged file look tagged, and the check below it silent.
  const withTag = [
    "Feature: F",
    "",
    "  @slow",
    "  Scenario: A thing happens",
    "    Given x",
    "",
  ].join("\n");
  assert.deepEqual(specgateTagsIn(withTag), []);
  assert.deepEqual(specgateTagsByScenario(withTag), {});
  assert.equal(isSpecgateTag("@slow"), false);
  assert.equal(isSpecgateTag("@REQ-001"), true);
  assert.equal(isSpecgateTag("@SCN-014a"), true);
});

test("a tag line is all tags, or it is not a tag line", () => {
  assert.deepEqual(parseTagLine("  @a @b  "), ["@a", "@b"]);
  assert.equal(parseTagLine("  Scenario: x"), null);
  assert.equal(parseTagLine("  @a and some prose"), null);
});
