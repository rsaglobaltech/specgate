"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const VALIDATE_SCRIPT = path.resolve(__dirname, "../../scripts/validate_specs.js");

// ── helpers ──────────────────────────────────────────────────────────────────

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "strict-tdd-"));
}

/** What a test may replace in the generated project. */
interface ProjectOverrides {
  traceabilityContent?: string;
  specContent?: string;
}

function buildProject(root: string, overrides: ProjectOverrides = {}) {
  fs.mkdirSync(path.join(root, "features"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/specs/adr"), { recursive: true });

  const richHeader =
    "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
  const separator = "|---|---|---|---|---|---|---|---|---|---|";
  const defaultRow =
    "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | SampleCommand | SampleAggregate | SampleEvent | SampleTest.java | SampleTest#test | Draft |";

  const traceability = overrides.traceabilityContent
    ? overrides.traceabilityContent
    : `# Traceability\n\n${richHeader}\n${separator}\n${defaultRow}\n`;

  fs.writeFileSync(
    path.join(root, "spec.md"),
    overrides.specContent || "# Spec\n\nREQ-001 is the main requirement.\n"
  );
  fs.writeFileSync(path.join(root, "AI_RULES.md"), "# AI Rules\n");
  fs.writeFileSync(path.join(root, "README.md"), "# Readme\n");
  fs.writeFileSync(path.join(root, "docs/specs/traceability.md"), traceability);
  fs.writeFileSync(path.join(root, "docs/specs/adr/README.md"), "# ADR\n");
  fs.writeFileSync(
    path.join(root, "features/sample.feature"),
    "Feature: Sample\n  Scenario: Works\n    Given it works\n"
  );
}

function runValidate(projectDir: string, extraArgs: string[] = []) {
  return spawnSync(process.execPath, [VALIDATE_SCRIPT, projectDir, ...extraArgs], {
    encoding: "utf8",
  });
}

// ── standard validate still passes on a clean project ────────────────────────

test("validate passes on a well-formed project without --strict-tdd", () => {
  const root = mktemp();
  try {
    buildProject(root);
    const result = runValidate(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── --strict-tdd: TDD-1 (TBD test artifact past Draft) ───────────────────────

test("--strict-tdd fails when Test artifact is TBD and Status is In Dev", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    const row =
      "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art.java | TBD | In Dev |";
    buildProject(root, {
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("TDD-1"), result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("--strict-tdd passes when Test artifact is TBD but Status is Draft", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    const row =
      "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art.java | TBD | Draft |";
    buildProject(root, {
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("--strict-tdd passes when Test artifact is defined and Status is In Dev", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    const row =
      "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art.java | SampleTest#test | In Dev |";
    buildProject(root, {
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── --strict-tdd: TDD-2 (row without Scenario ID past Draft) ─────────────────

test("--strict-tdd fails when a row lacks Scenario ID and Status is Ready for Dev", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    const row =
      "| REQ-001 |  | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art.java | SomeTest | Ready for Dev |";
    buildProject(root, {
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("TDD-2"), result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── --strict-tdd: TDD-3 (requirement in spec.md missing from matrix) ──────────

test("--strict-tdd fails when spec.md declares a REQ not in traceability.md", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    // Matrix only has REQ-001; spec.md declares REQ-001 and REQ-002 (a
    // heading — a mention in prose owes no row, ADR-0036).
    const row =
      "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art | Test | Draft |";
    buildProject(root, {
      specContent: "# Spec\n\n## REQ-001 — Covered\n\n## REQ-002 — Not covered\n",
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("TDD-3"), result.stderr);
    assert.ok(result.stderr.includes("REQ-002"), result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("--strict-tdd passes when all REQs in spec.md are in traceability.md", () => {
  const root = mktemp();
  try {
    const richHeader =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
    const separator = "|---|---|---|---|---|---|---|---|---|---|";
    const row1 =
      "| REQ-001 | SCN-001 | features/sample.feature | UC-001 | Cmd | Agg | Evt | Art | Test | Draft |";
    const row2 =
      "| REQ-002 | SCN-002 | features/sample.feature | UC-002 | Cmd2 | Agg | Evt2 | Art2 | Test2 | Draft |";
    buildProject(root, {
      specContent: "# Spec\n\nREQ-001 and REQ-002 are both covered.\n",
      traceabilityContent: `# Traceability\n\n${richHeader}\n${separator}\n${row1}\n${row2}\n`,
    });
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── validate still enforces base checks even with --strict-tdd ───────────────

test("--strict-tdd does not suppress the standard no-feature-files check", () => {
  const root = mktemp();
  try {
    buildProject(root);
    // Remove the feature file after building
    fs.rmSync(path.join(root, "features/sample.feature"));
    const result = runValidate(root, ["--strict-tdd"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("No .feature files"), result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
