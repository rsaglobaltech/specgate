/**
 * Unit tests for the `fix` command's pure-ish core (computeFixes).
 * Filesystem is used only to stage orphan feature files in a temp project.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { computeFixes } from "../../scripts/fix.js";
const { parseTraceability } = require("../../scripts/plan");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function mkProject(rows: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fix-test-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "features", "core"), { recursive: true });
  const matrix = [RICH_HEADER, RICH_SEP, ...rows].join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "docs", "specs", "traceability.md"), matrix);
  return dir;
}

test("computeFixes appends a row for an orphan feature file", () => {
  const dir = mkProject([
    "| REQ-001 | SCN-001 | features/core/a.feature | UC | Q | - | - | A | T | Draft |",
  ]);
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "a.feature"), "Feature: a\n");
    fs.writeFileSync(path.join(dir, "features", "core", "orphan.feature"), "Feature: o\n");
    const trace = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    const { content, actions } = computeFixes(dir, trace, "");
    assert.equal(actions.length, 1);
    assert.match(actions[0], /orphan\.feature/);
    const rows = parseTraceability(content);
    assert.ok(
      rows.some((r: { featureFile: string }) => r.featureFile === "features/core/orphan.feature")
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("computeFixes appends a row for a spec REQ missing from the matrix", () => {
  const dir = mkProject([
    "| REQ-001 | SCN-001 | features/core/a.feature | UC | Q | - | - | A | T | Draft |",
  ]);
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "a.feature"), "Feature: a\n");
    const trace = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    const { content, actions } = computeFixes(dir, trace, "# Spec\nREQ-001 and REQ-002 here.\n");
    assert.equal(actions.length, 1);
    assert.match(actions[0], /REQ-002/);
    const ids = parseTraceability(content).map((r: { requirement: string }) => r.requirement);
    assert.ok(ids.includes("REQ-002"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("computeFixes is a no-op when the matrix is already consistent", () => {
  const dir = mkProject([
    "| REQ-001 | SCN-001 | features/core/a.feature | UC | Q | - | - | A | T | Draft |",
  ]);
  try {
    fs.writeFileSync(path.join(dir, "features", "core", "a.feature"), "Feature: a\n");
    const trace = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    const { content, actions } = computeFixes(dir, trace, "# Spec\nREQ-001 only.\n");
    assert.equal(actions.length, 0);
    assert.equal(content, trace);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
