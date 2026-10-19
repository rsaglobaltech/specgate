"use strict";

import { test } from "node:test";
import assert = require("node:assert/strict");

import {
  parseArgs,
  parseFeatureFile,
  toPascalCase,
  collectRequirementIds,
  extractEventNames,
  inferModel,
  renderYamlFragment,
} from "../../scripts/infer_pack";

const FEATURE = `@REQ-001
Feature: Parking Capacity

  Scenario: Triggering alert when occupancy reaches threshold
    Given a parking facility "Lot-A" with total capacity of "200" spots
    And current occupancy is "180" vehicles
    When 10 more vehicles enter the facility
    Then occupancy should become "190" vehicles
    And a "CapacityThresholdReached" event should be emitted
`;

// ── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs reads --from and defaults --format to yaml", () => {
  const opts = parseArgs(["--from", "x.feature"]);
  assert.equal(opts.from, "x.feature");
  assert.equal(opts.format, "yaml");
});

test("parseArgs accepts --format json", () => {
  assert.equal(parseArgs(["--from", "x", "--format", "json"]).format, "json");
});

// ── parseFeatureFile ─────────────────────────────────────────────────────────

test("parseFeatureFile extracts feature name, tags and scenario steps", () => {
  const parsed = parseFeatureFile(FEATURE);
  assert.equal(parsed.featureName, "Parking Capacity");
  assert.deepEqual(parsed.featureTags, ["@REQ-001"]);
  assert.equal(parsed.scenarios.length, 1);
  assert.equal(parsed.scenarios[0].title, "Triggering alert when occupancy reaches threshold");
  const kinds = parsed.scenarios[0].steps.map((s) => s.keyword);
  // And after Given inherits given; And after Then inherits then.
  assert.deepEqual(kinds, ["given", "given", "when", "then", "then"]);
});

// ── toPascalCase ─────────────────────────────────────────────────────────────

test("toPascalCase drops quoted literals, bare numbers and glue words", () => {
  // The stopword list is why these end on a noun. Gherkin is written as prose,
  // so a name built from every word came out `MoreVehiclesEnterThe` — the four
  // word budget spent on "the". Dropping the glue reaches the word that
  // carries the meaning.
  assert.equal(toPascalCase("10 more vehicles enter the facility"), "MoreVehiclesEnterFacility");
  assert.equal(toPascalCase('register entry for "ABC-123"'), "RegisterEntry");
  assert.equal(toPascalCase('"123"'), "Action");
});

test("the stopword list stays short enough not to eat domain words", () => {
  // A long list starts removing words that are common *and* meaningful. A name
  // missing its noun is worse than a long one.
  assert.equal(toPascalCase("user pays the invoice"), "UserPaysInvoice");
  assert.equal(toPascalCase("operator opens the gate"), "OperatorOpensGate");
});

// ── collectRequirementIds ────────────────────────────────────────────────────

test("collectRequirementIds picks REQ ids out of tags", () => {
  const parsed = parseFeatureFile(FEATURE);
  assert.deepEqual(collectRequirementIds(parsed), ["REQ-001"]);
});

test("collectRequirementIds returns [] when no REQ tag is present", () => {
  const parsed = parseFeatureFile("Feature: F\n  Scenario: s\n    When x\n    Then y\n");
  assert.deepEqual(collectRequirementIds(parsed), []);
});

// ── extractEventNames ────────────────────────────────────────────────────────

test("extractEventNames returns quoted PascalCase tokens only", () => {
  assert.deepEqual(extractEventNames('a "CapacityThresholdReached" event should be emitted'), [
    "CapacityThresholdReached",
  ]);
  // A quoted number or lowercase literal is data, not an event.
  assert.deepEqual(extractEventNames('occupancy should become "190" vehicles'), []);
});

// ── inferModel ───────────────────────────────────────────────────────────────

test("inferModel references the REQ tag and proposes command + event", () => {
  const model = inferModel(parseFeatureFile(FEATURE), "capacity.feature");
  assert.deepEqual(
    model.requirements.map((r) => r.id),
    ["REQ-001"]
  );
  assert.equal(model.use_cases[0].name, "Parking Capacity");
  assert.equal(model.use_cases[0].requirement, "REQ-001");
  assert.equal(model.commands.length, 1);
  assert.equal(model.commands[0].name, "MoreVehiclesEnterFacilityCommand");
  assert.deepEqual(
    model.events.map((e) => e.name),
    ["CapacityThresholdReached"]
  );
  assert.equal(model.use_cases[0].command, "MoreVehiclesEnterFacilityCommand");
  assert.deepEqual(model.use_cases[0].emits, ["CapacityThresholdReached"]);
  assert.equal(model.scenarios[0].id, "SCN-001");
});

test("inferModel falls back to a REQ-XXX placeholder when no tag exists", () => {
  const parsed = parseFeatureFile("Feature: Bare\n  Scenario: s\n    When act\n    Then check\n");
  const model = inferModel(parsed, "bare.feature");
  assert.equal(model.requirements[0].id, "REQ-XXX");
  assert.match(model.requirements[0].title, /TODO:/);
  assert.equal(model.use_cases[0].aggregate, "TODO: aggregate");
});

// ── renderYamlFragment ───────────────────────────────────────────────────────

test("renderYamlFragment emits a parseable, TODO-annotated fragment", () => {
  const model = inferModel(parseFeatureFile(FEATURE), "capacity.feature");
  const yamlText = renderYamlFragment(model, "capacity.feature");
  assert.match(yamlText, /^# Proposed pack\.yaml fragment inferred from capacity\.feature/);
  assert.match(yamlText, /requirements:/);
  assert.match(yamlText, /- id: REQ-001/);
  assert.match(yamlText, /command: MoreVehiclesEnterFacilityCommand/);
  assert.match(yamlText, /- CapacityThresholdReached/);

  // The fragment must round-trip through the project's YAML reader.
  const { parseYamlLite } = require("../../packages/core/src/domain/YamlLite");
  const reparsed = parseYamlLite(yamlText);
  assert.ok(Array.isArray(reparsed.requirements));
  assert.equal(reparsed.requirements[0].id, "REQ-001");
  assert.equal(reparsed.use_cases[0].name, "Parking Capacity");
  assert.equal(reparsed.events[0].name, "CapacityThresholdReached");
});

// ── pack infer v2 (#32) ──────────────────────────────────────────────────────
//
// Five heuristic improvements. The line ADR-0014 draws holds through all of
// them: the output is a skeleton to review, every guess keeps its `TODO`, and
// an inference that stops looking like a guess is the failure mode here.

import { isQueryStep, extractPayloadHints, mergeModels } from "../../scripts/infer_pack";

const SEARCH = `@REQ-004
Feature: Parking search

  Scenario: an operator searches by plate
    When the operator searches for plate "ABC-123"
    Then a matching vehicle is shown

  Scenario: no match
    When the operator searches for plate "ZZZ-999"
    Then nothing is shown

  Scenario Outline: register an entry
    When the operator registers entry with <plate> and <bay>
    Then a "VehicleRegistered" event should be emitted
`;

// ── 1. dedup ─────────────────────────────────────────────────────────────────

test("the same operation in two scenarios is proposed once", () => {
  // The most common thing a reader deleted by hand: the happy path and its
  // failure exercise one command and produced two entries with two ids.
  const model = inferModel(parseFeatureFile(SEARCH), "search.feature");
  const searches = [...model.commands, ...model.queries].filter((c) => /Searches/.test(c.name));
  assert.equal(searches.length, 1, "the shared operation was proposed twice");
});

// ── 2. query vs command ──────────────────────────────────────────────────────

test("a step that reads is a query, and one that writes is a command", () => {
  assert.equal(isQueryStep("the operator searches for plate"), true);
  assert.equal(isQueryStep("the user views the invoice"), true);
  assert.equal(isQueryStep("the operator registers an entry"), false);
  assert.equal(isQueryStep("the system charges the card"), false);
});

test("queries get QRY ids and commands get CMD ids", () => {
  // The distinction is already in the pack model; inference did not make it,
  // so every query arrived proposed as a command.
  const model = inferModel(parseFeatureFile(SEARCH), "search.feature");
  assert.equal(model.queries.length, 1);
  assert.match(model.queries[0].id, /^QRY-\d{3}$/);
  assert.match(model.queries[0].name, /Query$/);
  assert.equal(model.commands.length, 1);
  assert.match(model.commands[0].id, /^CMD-\d{3}$/);
  assert.match(model.commands[0].name, /Command$/);
});

// ── 5. payload hints ─────────────────────────────────────────────────────────

test("field names come from placeholders and key/value pairs, never from prose", () => {
  assert.deepEqual(extractPayloadHints("registers entry with <plate> and <bay>"), ["plate", "bay"]);
  assert.deepEqual(extractPayloadHints('sets limit: "10"'), ["limit"]);
  // A quoted literal is a value, not a field name.
  assert.deepEqual(extractPayloadHints('searches for "ABC-123"'), []);
});

test("every inferred field keeps a TODO for its type", () => {
  // Guessing a type would be the ADR-0014 failure: an inference that stops
  // looking like a guess.
  const model = inferModel(parseFeatureFile(SEARCH), "search.feature");
  const command = model.commands[0];
  assert.ok(command.fields.length > 0);
  for (const field of command.fields) assert.match(field.type, /TODO/);
});

// ── 3. multi-file ────────────────────────────────────────────────────────────

test("an operation shared by two files is proposed once, not once per file", () => {
  const a = inferModel(parseFeatureFile(SEARCH), "a.feature");
  const b = inferModel(
    parseFeatureFile(
      "@REQ-005\nFeature: Exit\n\n  Scenario: search on exit\n" +
        '    When the operator searches for plate "ABC-123"\n    Then the stay is shown\n'
    ),
    "b.feature"
  );
  const merged = mergeModels([a, b], ["a.feature", "b.feature"]);
  assert.equal(
    merged.queries.filter((q: { name: string }) => /Searches/.test(q.name)).length,
    1,
    "the shared query was proposed twice"
  );
  assert.deepEqual(
    merged.requirements.map((r: { id: string }) => r.id),
    ["REQ-004", "REQ-005"],
    "both files' requirements should survive"
  );
});

test("merging renumbers ids so the fragment reads as one document", () => {
  // Three files each proposing CMD-001 is not a fragment anyone can paste.
  const a = inferModel(parseFeatureFile(SEARCH), "a.feature");
  const b = inferModel(
    parseFeatureFile(
      "@REQ-005\nFeature: Exit\n\n  Scenario: charge\n" +
        '    When the operator charges the stay\n    Then a "StayCharged" event should be emitted\n'
    ),
    "b.feature"
  );
  const merged = mergeModels([a, b], ["a.feature", "b.feature"]);
  const ids = merged.commands.map((c: { id: string }) => c.id);
  assert.deepEqual(ids, [...new Set(ids)], "duplicate command ids");
  assert.deepEqual(
    merged.scenarios.map((s: { id: string }) => s.id),
    merged.scenarios.map((_: unknown, i: number) => `SCN-${String(i + 1).padStart(3, "0")}`)
  );
});

test("merged use cases get distinct ids and keep their own requirement", () => {
  // A single file keeps `UC-XXX`, which is honest — nothing inferred an id.
  // Two files cannot: two `UC-XXX` in one fragment is not a placeholder, it is
  // something a reader has to repair.
  const a = inferModel(parseFeatureFile(SEARCH), "a.feature");
  const b = inferModel(
    parseFeatureFile(
      "@REQ-005\nFeature: Exit\n\n  Scenario: charge\n" +
        "    When the operator charges the stay\n    Then it is charged\n"
    ),
    "b.feature"
  );
  const merged = mergeModels([a, b], ["a.feature", "b.feature"]);
  const ids = merged.use_cases.map((u: { id: string }) => u.id);
  assert.deepEqual(ids, [...new Set(ids)], "duplicate use case ids");
  assert.deepEqual(
    merged.use_cases.map((u: { requirement: string }) => u.requirement),
    ["REQ-004", "REQ-005"],
    "a use case must keep the requirement its own file tagged"
  );
});

test("a single file is unchanged by the merge", () => {
  // The common case must not pay for the multi-file one.
  const one = inferModel(parseFeatureFile(SEARCH), "a.feature");
  assert.equal(mergeModels([one], ["a.feature"]).use_cases[0].id, "UC-XXX");
});

// ── the line ADR-0014 draws ──────────────────────────────────────────────────

test("nothing inferred here loses its TODO", () => {
  const yamlText = renderYamlFragment(
    mergeModels([inferModel(parseFeatureFile(SEARCH), "a.feature")], ["a.feature"]),
    "a.feature"
  );
  assert.match(yamlText, /review and resolve every TODO/i);
  assert.match(yamlText, /aggregate: "TODO: aggregate"/);
  assert.match(yamlText, /type: "TODO: type"/);
});
