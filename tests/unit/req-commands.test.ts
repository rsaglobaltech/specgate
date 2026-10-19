/**
 * Unit tests for the pure helpers behind the `req` command:
 * nextReqId, nextScenarioId, buildRow, appendRequirement, updateRequirementFields.
 * End-to-end CLI behaviour is covered in tests/cli.test.ts.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  nextReqId,
  nextScenarioId,
  buildRow,
  appendRequirement,
  updateRequirementFields,
} from "../../scripts/req";
const { parseTraceability } = require("../../scripts/plan");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function matrix(...rows: string[]): string {
  return [RICH_HEADER, RICH_SEP, ...rows].join("\n");
}

// ── nextReqId / nextScenarioId ──────────────────────────────────────────────────────

test("nextReqId returns REQ-001 on an empty matrix", () => {
  assert.equal(nextReqId([]), "REQ-001");
});

test("nextReqId returns max+1 zero-padded", () => {
  const rows = parseTraceability(
    matrix(
      "| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |",
      "| REQ-009 | SCN-009 | - | - | - | - | - | - | - | Draft |"
    )
  );
  assert.equal(nextReqId(rows), "REQ-010");
});

test("nextScenarioId tracks the SCN sequence independently", () => {
  const rows = parseTraceability(
    matrix("| REQ-001 | SCN-004 | - | - | - | - | - | - | - | Draft |")
  );
  assert.equal(nextScenarioId(rows), "SCN-005");
});

// ── buildRow ────────────────────────────────────────────────────────────────────────

test("buildRow fills missing cells with '-' and defaults status to Draft", () => {
  const row = buildRow({ requirement: "REQ-002", scenarioId: "SCN-002", useCase: "Pay session" });
  assert.equal(row, "| REQ-002 | SCN-002 | - | Pay session | - | - | - | - | - | Draft |");
});

test("buildRow honours an explicit status", () => {
  const row = buildRow({ requirement: "REQ-002", scenarioId: "SCN-002", status: "Approved" });
  assert.match(row, /Approved \|$/);
});

// ── appendRequirement ──────────────────────────────────────────────────────────────

test("appendRequirement auto-assigns the next REQ and SCN ids", () => {
  const before = matrix("| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |");
  const { content, reqId, scenarioId } = appendRequirement(before, { useCase: "New thing" });
  assert.equal(reqId, "REQ-002");
  assert.equal(scenarioId, "SCN-002");
  const rows = parseTraceability(content);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].requirement, "REQ-002");
  assert.equal(rows[1].useCase, "New thing");
});

test("appendRequirement creates the matrix when none exists", () => {
  const { content, reqId } = appendRequirement("# Traceability Matrix\n", {
    useCase: "First",
  });
  assert.equal(reqId, "REQ-001");
  assert.ok(content.includes(RICH_HEADER), "header inserted");
  assert.ok(content.includes(RICH_SEP), "separator inserted");
  assert.equal(parseTraceability(content).length, 1);
});

test("appendRequirement respects an explicit requirement id", () => {
  const { reqId } = appendRequirement(matrix(), { requirement: "REQ-042", useCase: "x" });
  assert.equal(reqId, "REQ-042");
});

// ── updateRequirementFields ─────────────────────────────────────────────────────────

test("updateRequirementFields sets only the requested columns on the matching row", () => {
  const before = matrix(
    "| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |",
    "| REQ-002 | SCN-002 | - | - | - | - | - | - | - | Draft |"
  );
  const { content, updated } = updateRequirementFields(before, "REQ-002", {
    featureFile: "features/pay.feature",
    testArtifact: "src/test/PayTest.java",
  });
  assert.equal(updated, 1);
  const rows = parseTraceability(content);
  const r2 = rows.find((r: { requirement: string }) => r.requirement === "REQ-002");
  assert.equal(r2.featureFile, "features/pay.feature");
  assert.equal(r2.testArtifact, "src/test/PayTest.java");
  // REQ-001 untouched
  const r1 = rows.find((r: { requirement: string }) => r.requirement === "REQ-001");
  assert.equal(r1.featureFile, "-");
});

test("updateRequirementFields returns updated=0 when REQ is absent", () => {
  const before = matrix("| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |");
  const { content, updated } = updateRequirementFields(before, "REQ-999", {
    testArtifact: "x",
  });
  assert.equal(updated, 0);
  assert.equal(content, before);
});

test("updateRequirementFields ignores unknown field keys", () => {
  const before = matrix("| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |");
  const { updated } = updateRequirementFields(before, "REQ-001", { bogus: "x" });
  assert.equal(updated, 0);
});

test("updateRequirementFields preserves header and separator rows", () => {
  const before = matrix("| REQ-001 | SCN-001 | - | - | - | - | - | - | - | Draft |");
  const { content } = updateRequirementFields(before, "REQ-001", { testArtifact: "t" });
  assert.ok(content.includes(RICH_HEADER));
  assert.ok(content.includes(RICH_SEP));
});
