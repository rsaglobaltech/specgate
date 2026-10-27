/**
 * REQ-198 — a requirement an open change modifies is reworked, not re-marked.
 *
 * Nineteen delivered requirements returned to Draft for a new design kept
 * their tests, so the plan read them as NEEDS_STATUS_UPDATE and the harness
 * would have marked them done without touching them.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { withRework } from "../../src/domain/RequirementPlan";
import { AgentPrompt } from "../../src/domain/AgentPrompt";

test("REQ-198 SCN-198a: a modified requirement with tests needs rework", () => {
  const items = [
    { requirement: "REQ-017", category: "NEEDS_STATUS_UPDATE" },
    { requirement: "REQ-018", category: "NEEDS_STATUS_UPDATE" },
    { requirement: "REQ-085", category: "NEEDS_EVERYTHING" },
  ];
  assert.deepEqual(
    withRework(items, new Set(["REQ-017", "REQ-085"])).map((i) => i.category),
    ["NEEDS_REWORK", "NEEDS_STATUS_UPDATE", "NEEDS_EVERYTHING"]
  );
});

test("REQ-198 SCN-198b: the prompt of a reworked requirement says its tests and code are for the old text", () => {
  const prompt = AgentPrompt.build(
    { requirement: "REQ-017", category: "NEEDS_REWORK" },
    { requirementText: "### Requirement: REQ-017 — Cambios de marcha" }
  );
  assert.match(prompt, /This requirement changed/);
  assert.match(prompt, /they must fail against the current behaviour/);
  const plain = AgentPrompt.build({ requirement: "REQ-018", category: "NEEDS_TEST" }, {});
  assert.doesNotMatch(plain, /This requirement changed/);
});
