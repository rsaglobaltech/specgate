"use strict";

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  findRequirementIds,
  findIdInTraceability,
  parseValidateOutput,
} from "../../src/traceability";

// ── findRequirementIds ────────────────────────────────────────────────────────

test("findRequirementIds finds REQ-001 in text", () => {
  const ids = findRequirementIds("This links to REQ-001 and REQ-002.");
  assert.equal(ids.length, 2);
  assert.equal(ids[0].id, "REQ-001");
  assert.equal(ids[1].id, "REQ-002");
});

test("findRequirementIds finds multiple prefixes (UC, SCN, BC, AGG, EVT, RUL, CMD)", () => {
  const text = "UC-001 BC-002 AGG-003 EVT-004 RUL-005 CMD-006 SCN-007";
  const ids = findRequirementIds(text);
  const found = ids.map((i) => i.id);
  assert.ok(found.includes("UC-001"));
  assert.ok(found.includes("BC-002"));
  assert.ok(found.includes("AGG-003"));
  assert.ok(found.includes("EVT-004"));
  assert.ok(found.includes("RUL-005"));
  assert.ok(found.includes("CMD-006"));
  assert.ok(found.includes("SCN-007"));
});

test("findRequirementIds returns correct line and col numbers", () => {
  const text = "line 0\nline 1 REQ-042 more text\nline 2";
  const ids = findRequirementIds(text);
  assert.equal(ids.length, 1);
  assert.equal(ids[0].id, "REQ-042");
  assert.equal(ids[0].line, 1);
  assert.equal(ids[0].col, 7);
  assert.equal(ids[0].endCol, 14);
});

test("findRequirementIds returns empty array when no IDs found", () => {
  assert.deepEqual(findRequirementIds("no ids here at all"), []);
});

test("findRequirementIds does NOT match lowercase patterns", () => {
  const ids = findRequirementIds("req-001 uc-002 should not match");
  assert.equal(ids.length, 0);
});

test("findRequirementIds handles multi-line Gherkin content", () => {
  const gherkin = `
Feature: Parking
  Scenario: REQ-001 is satisfied
    Given a slot is available  # see UC-003
    When a vehicle enters
    Then SCN-005 passes
`;
  const ids = findRequirementIds(gherkin);
  const found = ids.map((i) => i.id);
  assert.ok(found.includes("REQ-001"));
  assert.ok(found.includes("UC-003"));
  assert.ok(found.includes("SCN-005"));
});

// ── findIdInTraceability ──────────────────────────────────────────────────────

test("findIdInTraceability finds ID on the correct line", () => {
  const content = "# Traceability\n\n| REQ-001 | Some title |\n| REQ-002 | Other |\n";
  assert.equal(findIdInTraceability(content, "REQ-001"), 2);
  assert.equal(findIdInTraceability(content, "REQ-002"), 3);
});

test("findIdInTraceability returns -1 when ID not present", () => {
  const content = "| REQ-001 | title |\n";
  assert.equal(findIdInTraceability(content, "REQ-999"), -1);
});

test("findIdInTraceability finds first occurrence when ID appears multiple times", () => {
  const content = "REQ-001 intro\n| REQ-001 | row |\n";
  assert.equal(findIdInTraceability(content, "REQ-001"), 0);
});

// ── parseValidateOutput ───────────────────────────────────────────────────────

test("parseValidateOutput detects ERROR lines", () => {
  const stdout = "ℹ️ [INFO] checking\n❌ [ERROR] Missing spec.md\n";
  const diags = parseValidateOutput(stdout, "");
  const errors = diags.filter((d) => d.severity === "error");
  assert.equal(errors.length, 1);
  assert.ok(errors[0].message.includes("Missing spec.md"));
});

test("parseValidateOutput detects WARN lines", () => {
  const stderr = "⚠️ [WARN] Traceability has TBD entries\n";
  const diags = parseValidateOutput("", stderr);
  const warns = diags.filter((d) => d.severity === "warning");
  assert.equal(warns.length, 1);
  assert.ok(warns[0].message.includes("Traceability"));
});

test("parseValidateOutput returns empty array for clean output", () => {
  const stdout = "ℹ️ [INFO] ✅ Validation passed\n";
  const diags = parseValidateOutput(stdout, "").filter((d) => d.severity !== "info");
  assert.equal(diags.length, 0);
});

test("parseValidateOutput handles both stdout and stderr simultaneously", () => {
  const stdout = "❌ [ERROR] error one\n";
  const stderr = "⚠️ [WARN] warning one\n";
  const diags = parseValidateOutput(stdout, stderr);
  assert.equal(diags.filter((d) => d.severity === "error").length, 1);
  assert.equal(diags.filter((d) => d.severity === "warning").length, 1);
});

test("parseValidateOutput reads the CLI's current markers", () => {
  const { TraceabilityManager } = require("../../src/traceability");
  const m = new TraceabilityManager();
  const d = m.parseValidateOutput(
    "  ✔  Validation passed\n",
    "  ✖  Missing spec.md\n  ▲  Adoption never retro-filled\n"
  );
  assert.deepEqual(
    d.map((x: { severity: string; message: string }) => [x.severity, x.message]),
    [
      ["info", "Validation passed"],
      ["error", "Missing spec.md"],
      ["warning", "Adoption never retro-filled"],
    ]
  );
});
