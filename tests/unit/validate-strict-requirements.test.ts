"use strict";

/**
 * `specgate validate --strict-requirements` — EARS-checkable requirement prose,
 * at rest (F6, `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.1).
 *
 * The prerequisite for any code-level verifier is a spec that says something a
 * machine can check. `DeltaSpec` already enforces an obligation keyword inside
 * a delta, but a capability spec at rest — `docs/specs/capabilities/<cap>/
 * spec.md` — was never checked. This flag reads those, and adds the one EARS
 * shape a regex can check honestly: an `IF` trigger has to resolve with
 * `THEN` in the same sentence.
 *
 * Same gradual-adoption promise as `--strict-scenarios`: the flag catches
 * unchecked prose, and the default still does not.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(REPO_ROOT, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "strict-requirements-"));
  const init = cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix");
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

function writeCapabilitySpec(projectDir, name, body) {
  const dir = path.join(projectDir, "docs/specs/capabilities", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), body, "utf8");
}

test("a scaffolded project has no docs/specs/capabilities/ and passes --strict-requirements", () => {
  // Most projects never grow this directory — it belongs to the change-lifecycle
  // structure, not to `init`. Nothing to check is not a violation.
  const { parent, projectDir } = scaffold();
  try {
    const r = cli("validate", projectDir, "--strict-requirements");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-requirements fails a requirement with no obligation keyword", () => {
  const { parent, projectDir } = scaffold();
  try {
    writeCapabilitySpec(
      projectDir,
      "widgets",
      [
        "# Widgets",
        "",
        "## Requirements",
        "",
        "### Requirement: REQ-200 — No obligation",
        "",
        "The system creates a widget when asked.",
        "",
        "#### Scenario: SCN-200a — Create",
        "",
        "- GIVEN nothing",
        "- WHEN asked",
        "- THEN a widget exists",
        "",
      ].join("\n")
    );
    const r = cli("validate", projectDir, "--strict-requirements");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    const out = r.stdout + r.stderr;
    assert.match(out, /no_rfc2119_keyword/);
    assert.match(out, /REQ-200/);
    assert.match(out, /docs\/specs\/capabilities\/widgets\/spec\.md:\d+/, "it should say where");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-requirements fails an IF requirement with no THEN clause", () => {
  const { parent, projectDir } = scaffold();
  try {
    writeCapabilitySpec(
      projectDir,
      "widgets",
      [
        "# Widgets",
        "",
        "## Requirements",
        "",
        "### Requirement: REQ-201 — Dangling IF",
        "",
        "IF the widget queue is full the system rejects new widgets.",
        "",
        "#### Scenario: SCN-201a — Reject",
        "",
        "- GIVEN a full queue",
        "- WHEN a widget is submitted",
        "- THEN it is rejected",
        "",
      ].join("\n")
    );
    const r = cli("validate", projectDir, "--strict-requirements");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /requirement_missing_then_clause/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-requirements passes a well-formed EARS unwanted-behaviour requirement", () => {
  const { parent, projectDir } = scaffold();
  try {
    writeCapabilitySpec(
      projectDir,
      "widgets",
      [
        "# Widgets",
        "",
        "## Requirements",
        "",
        "### Requirement: REQ-202 — Well formed",
        "",
        "IF the widget queue is full, THEN the system SHALL reject new widgets.",
        "",
        "#### Scenario: SCN-202a — Reject",
        "",
        "- GIVEN a full queue",
        "- WHEN a widget is submitted",
        "- THEN it is rejected",
        "",
      ].join("\n")
    );
    const r = cli("validate", projectDir, "--strict-requirements");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("without the flag, requirement syntax does not fail validate", () => {
  const { parent, projectDir } = scaffold();
  try {
    writeCapabilitySpec(
      projectDir,
      "widgets",
      [
        "# Widgets",
        "",
        "## Requirements",
        "",
        "### Requirement: REQ-200 — No obligation",
        "",
        "The system creates a widget when asked.",
        "",
        "#### Scenario: SCN-200a — Create",
        "",
        "- GIVEN nothing",
        "- WHEN asked",
        "- THEN a widget exists",
        "",
      ].join("\n")
    );
    const r = cli("validate", projectDir);
    assert.equal(r.status, 0, `plain validate should still pass:\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, /no_rfc2119_keyword/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-requirements is a declared flag, not one that slips through", () => {
  const r = cli("validate", ".", "--strict-requirementsX");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Unknown flag/);
});

test("this repository's own capability spec passes --strict-requirements", () => {
  // Dogfooding: docs/specs/capabilities/change-lifecycle/spec.md is real
  // content, not a fixture, and it already writes "El sistema SHALL …".
  const r = cli("validate", REPO_ROOT, "--strict-requirements");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
