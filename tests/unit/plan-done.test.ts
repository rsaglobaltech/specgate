"use strict";

/**
 * Unit tests for the `plan` and `done` commands.
 *
 * These exercise the pure helpers (parseTraceability, classify,
 * setRequirementStatus) without spawning the CLI. End-to-end CLI behaviour is
 * covered in tests/cli.test.ts.
 */

import { test } from "node:test";
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");

const { parseTraceability, classify, hintFor, detectOrphans } = require("../../scripts/plan");
const { setRequirementStatus, ALLOWED_STATUSES } = require("../../scripts/done");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-test-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "features", "core"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src", "main"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src", "test"), { recursive: true });
  return dir;
}

function richRow(
  req: string,
  scn: string,
  feature: string,
  useCase: string,
  cmd: string,
  agg: string,
  evt: string,
  tech: string,
  test: string,
  status: string
): string {
  return `| ${req} | ${scn} | ${feature} | ${useCase} | ${cmd} | ${agg} | ${evt} | ${tech} | ${test} | ${status} |`;
}

// ── parseTraceability ─────────────────────────────────────────────────────────────

test("parseTraceability extracts rich-matrix rows", () => {
  const content = [
    RICH_HEADER,
    RICH_SEP,
    richRow(
      "REQ-001",
      "SCN-001",
      "features/core/health.feature",
      "UC-001",
      "Cmd",
      "Agg",
      "Evt",
      "src/main/Health.java",
      "src/test/HealthTest.java",
      "Draft"
    ),
  ].join("\n");
  const rows = parseTraceability(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requirement, "REQ-001");
  assert.equal(rows[0].featureFile, "features/core/health.feature");
  assert.equal(rows[0].technicalArtifact, "src/main/Health.java");
  assert.equal(rows[0].testArtifact, "src/test/HealthTest.java");
  assert.equal(rows[0].status, "Draft");
});

test("parseTraceability ignores divider rows and headers", () => {
  const content = [RICH_HEADER, RICH_SEP, "Some prose between tables.", ""].join("\n");
  assert.deepEqual(parseTraceability(content), []);
});

// ── classify ─────────────────────────────────────────────────────────────────────────

test("classify → NEEDS_FEATURE when the .feature file is missing", () => {
  const dir = mkProject();
  try {
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-007",
          "SCN-007",
          "features/pricing/nope.feature",
          "UC-007",
          "TBD",
          "TBD",
          "TBD",
          "src/main/Pricing.java",
          "src/test/PricingTest.java",
          "Draft"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "NEEDS_FEATURE");
    assert.equal(result.feature_exists, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify → NEEDS_EVERYTHING when feature exists but no test/code declared", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "health.feature"), "Feature: x\n");
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-001",
          "SCN-001",
          "features/core/health.feature",
          "UC-001",
          "TBD",
          "TBD",
          "TBD",
          "TBD",
          "TBD",
          "Draft"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "NEEDS_EVERYTHING");
    assert.equal(result.feature_exists, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify → NEEDS_TEST when feature exists and the declared test file is missing", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "health.feature"), "Feature: x\n");
    fs.writeFileSync(path.join(dir, "src", "main", "Health.java"), "// impl\n");
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-001",
          "SCN-001",
          "features/core/health.feature",
          "UC-001",
          "TBD",
          "TBD",
          "TBD",
          "src/main/Health.java",
          "src/test/HealthTest.java",
          "Draft"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "NEEDS_TEST");
    assert.equal(result.technical_exists, true);
    assert.equal(result.test_exists, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify → NEEDS_IMPLEMENTATION when test exists and code is missing", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "health.feature"), "Feature: x\n");
    fs.writeFileSync(path.join(dir, "src", "test", "HealthTest.java"), "// test\n");
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-001",
          "SCN-001",
          "features/core/health.feature",
          "UC-001",
          "TBD",
          "TBD",
          "TBD",
          "src/main/Health.java",
          "src/test/HealthTest.java",
          "Draft"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "NEEDS_IMPLEMENTATION");
    assert.equal(result.test_exists, true);
    assert.equal(result.technical_exists, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify → NEEDS_STATUS_UPDATE when all artifacts present and status is Draft", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "health.feature"), "Feature: x\n");
    fs.writeFileSync(path.join(dir, "src", "main", "Health.java"), "// impl\n");
    fs.writeFileSync(path.join(dir, "src", "test", "HealthTest.java"), "// test\n");
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-001",
          "SCN-001",
          "features/core/health.feature",
          "UC-001",
          "TBD",
          "TBD",
          "TBD",
          "src/main/Health.java",
          "src/test/HealthTest.java",
          "Draft"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "NEEDS_STATUS_UPDATE");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify → DONE when all artifacts exist and status is Implemented", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "health.feature"), "Feature: x\n");
    fs.writeFileSync(path.join(dir, "src", "main", "Health.java"), "// impl\n");
    fs.writeFileSync(path.join(dir, "src", "test", "HealthTest.java"), "// test\n");
    const row = parseTraceability(
      [
        RICH_HEADER,
        RICH_SEP,
        richRow(
          "REQ-001",
          "SCN-001",
          "features/core/health.feature",
          "UC-001",
          "TBD",
          "TBD",
          "TBD",
          "src/main/Health.java",
          "src/test/HealthTest.java",
          "Implemented"
        ),
      ].join("\n")
    )[0];
    const result = classify(row, dir);
    assert.equal(result.category, "DONE");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classify ignores non-REQ rows (e.g. legend rows starting with letters)", () => {
  const row = parseTraceability(
    [
      RICH_HEADER,
      RICH_SEP,
      richRow("note", "see below", "TBD", "TBD", "TBD", "TBD", "TBD", "TBD", "TBD", "Draft"),
    ].join("\n")
  )[0];
  const result = classify(row, "/tmp/whatever");
  assert.equal(result, null);
});

// ── hintFor ────────────────────────────────────────────────────────────────────────────

test("hintFor returns a useful message for each category", () => {
  const sample = {
    requirement: "REQ-007",
    feature_file: "features/x/y.feature",
    test_artifact: "src/test/YTest.java",
    technical_artifact: "src/main/Y.java",
  };
  assert.match(hintFor({ ...sample, category: "NEEDS_FEATURE" }), /Create/);
  assert.match(hintFor({ ...sample, category: "NEEDS_TEST" }), /test/);
  assert.match(hintFor({ ...sample, category: "NEEDS_IMPLEMENTATION" }), /create/);
  assert.match(hintFor({ ...sample, category: "NEEDS_STATUS_UPDATE" }), /apply REQ-007/);
});

// ── done.setRequirementStatus ──────────────────────────────────────────────────────────

test("setRequirementStatus updates the matching row only", () => {
  const original = [
    RICH_HEADER,
    RICH_SEP,
    richRow(
      "REQ-001",
      "SCN-001",
      "features/a.feature",
      "UC-001",
      "C",
      "A",
      "E",
      "src/main/A.java",
      "src/test/ATest.java",
      "Draft"
    ),
    richRow(
      "REQ-002",
      "SCN-002",
      "features/b.feature",
      "UC-002",
      "C",
      "A",
      "E",
      "src/main/B.java",
      "src/test/BTest.java",
      "Draft"
    ),
  ].join("\n");
  const res = setRequirementStatus(original, "REQ-002", "Implemented");
  assert.equal(res.updated, 1);
  // REQ-001 untouched
  assert.match(res.content, /REQ-001.*Draft/);
  // REQ-002 flipped
  assert.match(res.content, /REQ-002.*Implemented/);
  assert.doesNotMatch(res.content, /REQ-002.*Draft/);
});

test("setRequirementStatus returns updated=0 when REQ is not found", () => {
  const content = [
    RICH_HEADER,
    RICH_SEP,
    richRow(
      "REQ-001",
      "SCN-001",
      "features/a.feature",
      "UC-001",
      "C",
      "A",
      "E",
      "src/main/A.java",
      "src/test/ATest.java",
      "Draft"
    ),
  ].join("\n");
  const res = setRequirementStatus(content, "REQ-999", "Implemented");
  assert.equal(res.updated, 0);
  assert.equal(res.content, content);
});

test("setRequirementStatus preserves the header rows verbatim", () => {
  const original = [
    RICH_HEADER,
    RICH_SEP,
    richRow(
      "REQ-001",
      "SCN-001",
      "features/a.feature",
      "UC-001",
      "C",
      "A",
      "E",
      "src/main/A.java",
      "src/test/ATest.java",
      "Draft"
    ),
  ].join("\n");
  const res = setRequirementStatus(original, "REQ-001", "Verified");
  assert.ok(res.content.includes(RICH_HEADER), "rich header must survive");
  assert.ok(res.content.includes(RICH_SEP), "divider row must survive");
});

test("ALLOWED_STATUSES contains the documented terminal states", () => {
  for (const s of ["Draft", "Approved", "Implemented", "Verified", "Released", "Deprecated"]) {
    assert.ok(ALLOWED_STATUSES.includes(s), `${s} should be allowed`);
  }
});

// ── detectOrphans ────────────────────────────────────────────────────────────────────

test("detectOrphans returns features on disk not present in the matrix", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "tracked.feature"), "Feature: ok\n");
    fs.writeFileSync(path.join(dir, "features", "core", "orphan.feature"), "Feature: lost\n");
    const items = [
      {
        feature_file: "features/core/tracked.feature",
        requirement: "REQ-001",
        category: "DONE",
      },
    ];
    const orphans = detectOrphans(dir, items);
    assert.deepEqual(orphans, ["features/core/orphan.feature"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("detectOrphans returns an empty list when every feature is tracked", () => {
  const dir = mkProject();
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "a.feature"), "Feature: a\n");
    const items = [{ feature_file: "features/core/a.feature", requirement: "REQ-001" }];
    assert.deepEqual(detectOrphans(dir, items), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("detectOrphans is robust when features/ does not exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-no-features-"));
  try {
    assert.deepEqual(detectOrphans(dir, []), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
