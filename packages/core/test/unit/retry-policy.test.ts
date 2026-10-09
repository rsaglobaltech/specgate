/** When another harness attempt cannot help (reservas_app, defect #50). */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { agentUnavailable, specSideFailure } from "../../src/domain/RetryPolicy";

const isFeature = (f: string) => f.startsWith("features/");

test("a quota or rate-limit exit is recognised", () => {
  assert.match(
    agentUnavailable(
      "Agent exited 1.\nYou've hit your session limit · resets 11:20am (Europe/Berlin)"
    ) || "",
    /session limit/
  );
  assert.ok(agentUnavailable("Error: 429 Too Many Requests"));
  assert.equal(agentUnavailable("TypeError: x is not a function"), null);
});

test("a gate that blames only a feature file is the specification's to fix", () => {
  const out = [
    "Gate failed at: validate --strict",
    "❌ [ERROR] --strict-scenarios violations detected: 1",
    "  ▲  features/comercio/REQ-101.feature:17 scenario title is generic — name the behaviour under test. [scenario_title_generic]",
  ].join("\n");
  assert.deepEqual(specSideFailure(out, isFeature), ["features/comercio/REQ-101.feature"]);
});

test("a gate that blames code, or nothing located, is the agent's to fix", () => {
  const mixed =
    "  ▲  features/a.feature:3 vague step\n  ✖  apps/web/app/api/x/route.ts:12 missing test";
  assert.equal(specSideFailure(mixed, isFeature), null);
  assert.equal(specSideFailure("FAIL tests/x.test.ts > REQ-101 expected 201", isFeature), null);
});
