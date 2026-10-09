"use strict";

/**
 * #168 at the CLI, which is where the defect lived.
 *
 * A feature file declaring three scenarios with tests covering two passed
 * --strict-tdd, --strict-scenarios and --strict-links all at once, with the row
 * on `Implemented`. The domain rules are unit-tested in
 * packages/core/test/unit/scenario-coverage.test.ts; this pins the wiring.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { cwd: ROOT_DIR, encoding: "utf8" });
}

const FEATURE = `Feature: Invoice totals

  Scenario: SCN-010 subtotal is the sum of line amounts
    Given two lines
    When the invoice is totalled
    Then the subtotal is their sum

  Scenario: SCN-012 a fully discounted invoice carries no tax
    Given a 100% discount
    When the invoice is totalled
    Then the tax is zero
`;

function project(testFileBody, status = "Implemented") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-coverage-"));
  const r = cli("init", "--yes", "--out", parent, "--no-git", "--no-sample-req");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(parent, "my-spec-driven-app");

  fs.mkdirSync(path.join(dir, "features/billing"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "features/billing/totals.feature"), FEATURE);
  fs.writeFileSync(path.join(dir, "src/totals.js"), "export const t = () => ({});\n");
  fs.writeFileSync(path.join(dir, "tests/totals.test.js"), testFileBody);

  const trace = path.join(dir, "docs/specs/traceability.md");
  fs.appendFileSync(
    trace,
    "\n| REQ-010 | SCN-010 | `features/billing/totals.feature` | UC-010 Totals | - | - | - |" +
      ` src/totals.js | tests/totals.test.js | ${status} |\n`
  );
  return { parent, dir };
}

test("a declared scenario that no test names fails --strict-coverage", () => {
  const { parent, dir } = project(
    'test("SCN-010 subtotal is the sum of line amounts", () => {});\n'
  );
  try {
    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const out = r.stdout + r.stderr;
    assert.match(out, /scenario_not_covered/);
    assert.match(out, /fully discounted/);
    assert.match(out, /SCN-012/, "the fix must name what to add");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the same project passes once every scenario is named", () => {
  const { parent, dir } = project(
    'test("SCN-010 subtotal", () => {});\ntest("SCN-012 fully discounted", () => {});\n'
  );
  try {
    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the older gates stay green — the check is opt-in on purpose", () => {
  // A project that names its tests some other way must not start failing
  // because a new release shipped a heuristic.
  const { parent, dir } = project(
    'test("SCN-010 subtotal is the sum of line amounts", () => {});\n'
  );
  try {
    for (const flags of [[], ["--strict-tdd"], ["--strict-scenarios"], ["--strict-links"]]) {
      const r = cli("validate", dir, ...flags);
      assert.equal(r.status, 0, `${flags.join(" ")} should still pass:\n${r.stdout}${r.stderr}`);
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a TBD test artifact is --strict-tdd's finding, not reported twice here", () => {
  const { parent, dir } = project("// nothing\n");
  try {
    const trace = path.join(dir, "docs/specs/traceability.md");
    fs.writeFileSync(
      trace,
      fs.readFileSync(trace, "utf8").replace("tests/totals.test.js | Implemented", "TBD | Draft")
    );
    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-coverage is a declared flag, not one that slips through", () => {
  const r = cli("validate", ".", "--strict-coverageX");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Unknown flag/);
});

// ── Fase 1.2: a link that exists but lies ────────────────────────────────────

test("a row whose test artifact names nothing about it is reported, not failed", () => {
  // The measured case from a real adoption: a "Vet" requirement declaring
  // PetValidatorTests.java as its proof, with every gate green. The row has no
  // scenario, so the per-scenario check has nothing to match — which is why
  // seeded rows lie most easily.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-lie-"));
  try {
    const r = cli("init", "--yes", "--out", parent, "--no-git", "--no-sample-req");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const dir = path.join(parent, "my-spec-driven-app");

    fs.mkdirSync(path.join(dir, "features/core"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features/core/health.feature"),
      "Feature: Health\n\n  Scenario: SCN-001 healthy\n    Given a service\n" +
        "    When asked\n    Then healthy\n"
    );
    fs.writeFileSync(path.join(dir, "src/PetValidator.java"), "class PetValidator {}\n");
    fs.writeFileSync(
      path.join(dir, "tests/PetValidatorTests.java"),
      "class PetTypeFormatterTests { void formatsAName() {} }\n"
    );
    // The feature file needs a row of its own, or the base check fires on an
    // orphan and this test would pass for the wrong reason.
    fs.writeFileSync(path.join(dir, "tests/health.test.js"), "// SCN-001 healthy\n");
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-001 | SCN-001 | `features/core/health.feature` | UC-001 Health | - | - | - |" +
        " src/PetValidator.java | tests/health.test.js | Draft |\n" +
        "| REQ-014 | - | - | UC-014 Vet | - | - | - | src/PetValidator.java |" +
        " tests/PetValidatorTests.java | Draft |\n"
    );

    // Every path exists, so the flag that is supposed to catch drift is happy.
    assert.equal(cli("validate", dir, "--strict-links").status, 0);

    // Advisory, not a failure. At row level this cannot tell "the team has not
    // adopted the convention yet" from "this link is a lie", and failing the
    // first to catch the second is what turned one comment into three red rows.
    const cov = cli("validate", dir, "--strict-coverage");
    assert.equal(cov.status, 0, cov.stdout + cov.stderr);
    assert.match(cov.stdout + cov.stderr, /link_without_evidence/);
    assert.match(cov.stdout + cov.stderr, /REQ-014/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("naming the requirement in the test is evidence enough", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-lie-ok-"));
  try {
    cli("init", "--yes", "--out", parent, "--no-git", "--no-sample-req");
    const dir = path.join(parent, "my-spec-driven-app");
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.mkdirSync(path.join(dir, "features/core"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features/core/health.feature"),
      "Feature: Health\n\n  Scenario: SCN-001 healthy\n    Given a service\n" +
        "    When asked\n    Then healthy\n"
    );
    fs.writeFileSync(path.join(dir, "src/vet.js"), "export const v = () => 1;\n");
    fs.writeFileSync(path.join(dir, "tests/vet.test.js"), "// REQ-014 vets are listed\n");
    fs.writeFileSync(path.join(dir, "tests/health.test.js"), "// SCN-001 healthy\n");
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-001 | SCN-001 | `features/core/health.feature` | UC-001 Health | - | - | - |" +
        " src/vet.js | tests/health.test.js | Draft |\n" +
        "| REQ-014 | - | - | UC-014 Vet | - | - | - | src/vet.js | tests/vet.test.js | Draft |\n"
    );
    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("#64: a Draft requirement owes no scenario its test until it is the one delivered", () => {
  const { parent, dir } = project(
    'test("SCN-010 subtotal is the sum of line amounts", () => {});\n',
    "Draft"
  );
  try {
    const pending = cli("validate", dir, "--strict-coverage");
    assert.doesNotMatch(
      pending.stdout + pending.stderr,
      /scenario_not_covered/,
      "another requirement's gate is not blocked by it"
    );
    const delivering = cli("validate", dir, "--strict-coverage", "--delivering", "REQ-010");
    assert.match(
      delivering.stdout + delivering.stderr,
      /scenario_not_covered/,
      "the one being delivered still owes every scenario"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
