/**
 * The matrix as a projection of spec.md, feature tags and tests (phase 3).
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  deriveRows,
  diffRows,
  fieldsToReproduce,
  isDerivedMatrix,
  renderDerivedMatrix,
  requirementsIn,
  rowsOf,
  setTraceFields,
} from "../../src/domain/DerivedMatrix";

const SPEC = [
  "# Shop — Specification",
  "",
  "## REQ-002 — Totals are rounded half-up",
  "",
  "The system MUST round totals half-up.",
  "",
  "## REQ-003 — Orders can be cancelled",
  "",
  "<!-- csda:trace status=Implemented artifact=lib/orders.js -->",
  "",
  "The system MUST let a customer cancel an unshipped order.",
  "",
].join("\n");

const FEATURE = {
  path: "features/totals.feature",
  source: [
    "Feature: Totals",
    "",
    "  @REQ-002 @SCN-002",
    "  Scenario: Half a cent rounds up",
    "    Given an order of 10.005 EUR",
    "    When the total is computed",
    "    Then it is 10.01 EUR",
    "",
    "  @REQ-002 @SCN-002b",
    "  Scenario: Below half a cent rounds down",
    "    Given an order of 10.004 EUR",
    "    When the total is computed",
    "    Then it is 10.00 EUR",
  ].join("\n"),
};

const sources = (over: any = {}) => ({
  spec: SPEC,
  features: [FEATURE],
  tests: [
    { path: "test/totals.test.js", source: "// covers REQ-002\n" },
    { path: "test/other.test.js", source: "// REQ-0021 is a different requirement\n" },
    { path: "test/cancel.test.js", source: "describe('REQ-003 cancel', () => {})\n" },
  ],
  ...over,
});

test("requirements come from spec.md sections, with their csda:trace", () => {
  const reqs = requirementsIn(SPEC);
  assert.deepEqual(
    reqs.map((r) => r.id),
    ["REQ-002", "REQ-003"]
  );
  assert.equal(reqs[0].title, "Totals are rounded half-up");
  assert.equal(reqs[1].trace.status, "Implemented");
});

test("one row per tagged scenario, the test found by mentioning the id", () => {
  const rows = deriveRows(sources());
  const req2 = rows.filter((r) => r.requirement === "REQ-002");
  assert.deepEqual(
    req2.map((r) => r.scenarioId),
    ["SCN-002", "SCN-002b"]
  );
  assert.equal(req2[0].featureFile, "`features/totals.feature`");
  assert.equal(req2[0].testArtifact, "test/totals.test.js", "REQ-0021 is not REQ-002");
  assert.equal(req2[0].useCase, "Totals are rounded half-up");
  assert.equal(req2[0].status, "Draft");
});

test("an explicit csda:trace key wins over what is derived", () => {
  const rows = deriveRows(sources());
  const req3 = rows.find((r) => r.requirement === "REQ-003");
  assert.equal(req3.status, "Implemented");
  assert.equal(req3.technicalArtifact, "`lib/orders.js`");
  assert.equal(req3.testArtifact, "test/cancel.test.js");
  assert.equal(req3.scenarioId, "-", "no tagged scenario, nothing invented");
});

test("setTraceFields creates, updates in a stable order, and removes", () => {
  const created = setTraceFields(SPEC, "REQ-002", { test: "t.js", status: "Implemented" })!;
  assert.match(
    created,
    /## REQ-002 — Totals are rounded half-up\n\n<!-- csda:trace status=Implemented test=t.js -->/
  );

  const updated = setTraceFields(created, "REQ-002", { status: "Verified" })!;
  assert.match(updated, /<!-- csda:trace status=Verified test=t.js -->/);
  assert.equal((updated.match(/csda:trace/g) || []).length, 2, "one comment per section");

  const removed = setTraceFields(updated, "REQ-002", { status: "", test: "" })!;
  assert.equal((removed.match(/csda:trace/g) || []).length, 1);

  assert.equal(setTraceFields(SPEC, "REQ-999", { status: "x" }), null);
});

test("a value with spaces survives the round trip", () => {
  const spec = setTraceFields(SPEC, "REQ-002", {
    test: "npm test",
    artifact: "existing codebase",
  })!;
  assert.equal(requirementsIn(spec)[0].trace.test, "npm test");
  assert.equal(requirementsIn(spec)[0].trace.artifact, "existing codebase");
});

test("the rendered matrix is marked as generated and reads back the same rows", () => {
  const rows = deriveRows(sources());
  const md = renderDerivedMatrix(rows, "shop");
  assert.ok(isDerivedMatrix(md));
  assert.match(md, /# Traceability Matrix — shop/);
  assert.deepEqual(diffRows(rows, rowsOf(md)), { missing: [], extra: [] });
});

test("migration writes only what derivation would get wrong", () => {
  const src = sources();
  const req = requirementsIn(SPEC)[0];
  const derived = deriveRows(src).filter((r) => r.requirement === "REQ-002");
  const plan = fieldsToReproduce(req, derived, src);
  assert.deepEqual(plan, { fields: {} }, "tags and test names already carry everything");

  const hand = [{ ...derived[0], status: "Implemented", technicalArtifact: "`lib/totals.js`" }];
  const one = fieldsToReproduce(req, hand, { ...src, features: [] });
  assert.ok("fields" in one);
  assert.equal((one as any).fields.status, "Implemented");
  assert.equal((one as any).fields.artifact, "lib/totals.js");
});

test("several rows that tags cannot tell apart block the migration, with the reason", () => {
  const req = requirementsIn(SPEC)[0];
  const rows = [
    { requirement: "REQ-002", scenarioId: "SCN-X", featureFile: "`a.feature`", status: "Draft" },
    { requirement: "REQ-002", scenarioId: "SCN-Y", featureFile: "`a.feature`", status: "Draft" },
  ];
  const plan = fieldsToReproduce(req, rows, sources({ features: [] }));
  assert.ok("reason" in plan);
  assert.match((plan as any).reason, /not tagged @REQ-002/);
});

test("a value with a single quote is stored in double quotes, and read back", () => {
  const value = "echo 'configure your test command'";
  const spec = setTraceFields(SPEC, "REQ-002", { test: value })!;
  assert.equal(requirementsIn(spec)[0].trace.test, value);
});

test("requirements archived into capability specs are rows too", () => {
  const capability = {
    path: "docs/specs/capabilities/billing/spec.md",
    source: [
      "# Billing",
      "",
      "## Requirements",
      "",
      "### Requirement: REQ-100 — Invoices carry VAT",
      "",
      "<!-- csda:trace scn=SCN-100 feature=features/billing.feature status=Implemented -->",
      "",
      "The system SHALL add VAT to every invoice.",
      "",
      "#### Scenario: SCN-100 VAT is added",
      "- WHEN an invoice is issued",
      "- THEN it carries VAT",
    ].join("\n"),
  };
  const rows = deriveRows(sources({ capabilities: [capability] }));
  const r = rows.find((x) => x.requirement === "REQ-100");
  assert.ok(r, JSON.stringify(rows.map((x) => x.requirement)));
  assert.equal(r.status, "Implemented");
  assert.equal(r.scenarioId, "SCN-100");
});

test("the code column comes from source files that mention the requirement", () => {
  const rows = deriveRows(
    sources({
      code: [
        { path: "lib/totals.js", source: "// REQ-002: half-up rounding\n" },
        { path: "lib/other.js", source: "// REQ-0021\n" },
      ],
    })
  );
  const r = rows.find((x) => x.requirement === "REQ-002");
  assert.equal(r.technicalArtifact, "`lib/totals.js`");
  const r3 = rows.find((x) => x.requirement === "REQ-003");
  assert.equal(r3.technicalArtifact, "`lib/orders.js`", "an explicit artifact still wins");
});
