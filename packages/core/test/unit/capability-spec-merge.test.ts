/**
 * The requirement-wise merge of a capability spec (REQ-166).
 *
 * Each case is a way two branches meet in `docs/specs/capabilities/<x>/spec.md`
 * — and a requirement lost without a conflict is the outcome worse than one.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { mergeCapabilitySpec } from "../../src/domain/CapabilitySpecMerge";

const req = (n: string, text = "The system SHALL do it.") =>
  [
    `### Requirement: REQ-${n} — Rule ${n}`,
    "",
    text,
    "",
    `#### Scenario: SCN-${n} — Case`,
    "",
    "- GIVEN a",
    "- WHEN b",
    "- THEN c",
    "",
  ].join("\n");

const spec = (...blocks: string[]) => ["# Owners", "", "## Requirements", "", ...blocks].join("\n");

const ids = (content: string) =>
  [...content.matchAll(/^### Requirement: (REQ-\d+)/gm)].map((m) => m[1]);

test("REQ-166 SCN-166a: two sides adding to a capability that did not exist merge cleanly, in id order", () => {
  const result = mergeCapabilitySpec("", spec(req("009")), spec(req("006"), req("007")));
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(ids(result.content), ["REQ-006", "REQ-007", "REQ-009"]);
  assert.match(result.content, /^# Owners\n\n## Requirements\n\n### Requirement: REQ-006/);
});

test("REQ-166: a change on one side only is taken, the other side untouched", () => {
  const base = spec(req("006"), req("007"));
  const ours = spec(req("006", "The system SHALL ignore case."), req("007"));
  const theirs = spec(req("006"), req("007"), req("008"));
  const result = mergeCapabilitySpec(base, ours, theirs);
  assert.deepEqual(result.conflicts, []);
  assert.match(result.content, /SHALL ignore case/);
  assert.deepEqual(ids(result.content), ["REQ-006", "REQ-007", "REQ-008"]);
});

test("REQ-166: a requirement removed on one side and untouched on the other is removed", () => {
  const base = spec(req("006"), req("007"));
  const result = mergeCapabilitySpec(base, spec(req("006")), base);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(ids(result.content), ["REQ-006"]);
});

test("REQ-166: the same rewrite on both sides is no conflict", () => {
  const base = spec(req("009"));
  const both = spec(req("009", "The system SHALL accept + and 8 to 15 digits."));
  const result = mergeCapabilitySpec(base, both, both);
  assert.deepEqual(result.conflicts, []);
  assert.match(result.content, /8 to 15 digits/);
});

test("REQ-166 SCN-166b: two different rewrites conflict on that requirement alone", () => {
  const base = spec(req("006"), req("009"));
  const ours = spec(
    req("006", "The system SHALL ignore case."),
    req("009", "International numbers are accepted.")
  );
  const theirs = spec(req("006"), req("009", "An empty telephone is accepted."));
  const result = mergeCapabilitySpec(base, ours, theirs);
  assert.deepEqual(result.conflicts, ["REQ-009"]);
  assert.match(result.content, /SHALL ignore case/, "the other requirement is merged");
  const markers = result.content.match(/^<<<<<<< ours$[\s\S]*?^>>>>>>> theirs$/m);
  assert.ok(markers, result.content);
  assert.match(markers![0], /International numbers/);
  assert.match(markers![0], /An empty telephone/);
  assert.doesNotMatch(markers![0], /REQ-006/);
});

test("REQ-166: a file that is not a capability spec is left to git", () => {
  const result = mergeCapabilitySpec("a\n", "b\n", "c\n");
  assert.equal(result.unparsable, true);
});
