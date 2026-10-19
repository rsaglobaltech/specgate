// specgate:allow-placeholders — this file emits or asserts on {{VAR}} template syntax.
"use strict";
import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import { cliFromRoot as cli } from "../helpers/cli";

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";

/** Minimal project that passes plain `validate`; tests then break one piece. */
function makeValidProject(tmp: string): string {
  const dir = path.join(tmp, "project");
  fs.mkdirSync(path.join(dir, "features"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "specs", "adr"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n\n## REQ-001 — Health\n", "utf8");
  fs.writeFileSync(path.join(dir, "AI_RULES.md"), "# Rules\n", "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "# Readme\n", "utf8");
  fs.writeFileSync(path.join(dir, "docs", "specs", "adr", "README.md"), "# ADRs\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "features", "health.feature"),
    "Feature: Health\n  Scenario: ok\n    Given up\n    Then 200\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [
      "# Traceability Matrix",
      "",
      RICH_HEADER,
      RICH_SEPARATOR,
      "| REQ-001 | SCN-001 | `features/health.feature` | UC-001 | TBD | TBD | TBD | TBD | TBD | Draft |",
      "",
    ].join("\n"),
    "utf8"
  );
  return dir;
}

function withProject<T>(fn: (dir: string, tmp: string) => T): T {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-remedy-"));
  try {
    return fn(makeValidProject(tmp), tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("baseline fixture passes validate", () => {
  withProject((dir) => {
    const r = cli("validate", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test("missing required file suggests its template", () => {
  withProject((dir) => {
    fs.rmSync(path.join(dir, "spec.md"));
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Missing required file: spec\.md/);
    assert.match(r.stderr, / {5}/);
    assert.match(r.stderr, /templates\/base\/spec\.md\.tpl/);
  });
});

test("missing traceability.md prints the rich header to paste", () => {
  withProject((dir) => {
    fs.rmSync(path.join(dir, "docs", "specs", "traceability.md"));
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, / {5}.*rich matrix header/s);
    assert.ok(r.stderr.includes(RICH_HEADER));
  });
});

test("no feature files suggests writing a scenario or adding a pack", () => {
  withProject((dir) => {
    fs.rmSync(path.join(dir, "features", "health.feature"));
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No \.feature files/);
    assert.match(r.stderr, / {5}.*Gherkin scenario/);
    assert.match(r.stderr, /specops add/);
  });
});

test("unresolved placeholders list the missing variables", () => {
  withProject((dir) => {
    fs.appendFileSync(path.join(dir, "README.md"), "\nStack: {{STACK}} on {{PROJECT_SLUG}}\n");
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unresolved placeholders/);
    assert.match(r.stderr, /Missing variables: .*STACK/);
    assert.match(r.stderr, /PROJECT_SLUG/);
  });
});

test("invalid status lists the allowed values", () => {
  withProject((dir) => {
    const trace = path.join(dir, "docs", "specs", "traceability.md");
    fs.writeFileSync(trace, fs.readFileSync(trace, "utf8").replace("| Draft |", "| WIP |"), "utf8");
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Invalid status in traceability\.md: WIP/);
    assert.match(r.stderr, / {5}Allowed statuses: Draft · /);
  });
});

test("duplicate scenario id suggests renumbering", () => {
  withProject((dir) => {
    const trace = path.join(dir, "docs", "specs", "traceability.md");
    fs.appendFileSync(
      trace,
      "| REQ-002 | SCN-001 | `features/health.feature` | UC-002 | TBD | TBD | TBD | TBD | TBD | Draft |\n"
    );
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Duplicate Scenario ID/);
    assert.match(r.stderr, / {5}.*renumber/);
  });
});

test("feature file missing from the matrix prints a paste-ready row", () => {
  withProject((dir) => {
    fs.writeFileSync(
      path.join(dir, "features", "extra.feature"),
      "Feature: Extra\n  Scenario: x\n    Given y\n    Then z\n",
      "utf8"
    );
    const r = cli("validate", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Feature file missing from traceability\.md: features\/extra\.feature/);
    assert.match(r.stderr, / {5}Add a row/);
    assert.match(r.stderr, /\| REQ-TBD \| SCN-TBD \| `features\/extra\.feature` \|/);
  });
});

test("strict-tdd violations come with per-code remedies", () => {
  withProject((dir) => {
    const trace = path.join(dir, "docs", "specs", "traceability.md");
    // TDD-1: post-Draft status with TBD test artifact.
    fs.writeFileSync(
      trace,
      fs.readFileSync(trace, "utf8").replace("| Draft |", "| In Dev |"),
      "utf8"
    );
    // TDD-3: REQ-002 exists in spec.md but not in the matrix.
    fs.appendFileSync(path.join(dir, "spec.md"), "\n## REQ-002 — Extra\n");
    const r = cli("validate", dir, "--strict-tdd");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /\[TDD-1\]/);
    assert.match(r.stderr, /\[TDD-3\]/);
    assert.match(r.stderr, / {5}TDD-1: Write the test first/);
    assert.match(r.stderr, / {5}TDD-3: Add a traceability row/);
    // No TDD-2 violation → no TDD-2 remedy noise.
    assert.ok(!r.stderr.includes("TDD-2:"));
  });
});
