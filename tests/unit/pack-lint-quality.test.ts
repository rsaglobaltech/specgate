"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseFeature,
  isGenericTitle,
  lintScenarioQuality,
  runLint,
} = require("../../scripts/lint_pack");

// ── parseFeature ─────────────────────────────────────────────────────────────

test("parseFeature extracts scenarios with their steps", () => {
  const scenarios = parseFeature(
    "Feature: F\n" +
      "  Scenario: does a thing\n" +
      "    Given a state\n" +
      "    When an action happens\n" +
      "    Then an outcome holds\n"
  );
  assert.equal(scenarios.length, 1);
  assert.equal(scenarios[0].title, "does a thing");
  assert.deepEqual(
    scenarios[0].steps.map((s: { keyword: string }) => s.keyword),
    ["given", "when", "then"]
  );
});

test("parseFeature makes And/But inherit the previous keyword's role", () => {
  const [scn] = parseFeature("Scenario: t\n  Given x\n  And y\n  When z\n  Then w\n  And v\n");
  assert.deepEqual(
    scn.steps.map((s: { keyword: string }) => s.keyword),
    ["given", "given", "when", "then", "then"]
  );
});

test("parseFeature flags a Scenario Outline and its Examples table", () => {
  const withExamples = parseFeature(
    "Scenario Outline: o\n  When <x>\n  Then <y>\n  Examples:\n    | x | y |\n"
  );
  assert.equal(withExamples[0].outline, true);
  assert.equal(withExamples[0].hasExamples, true);

  const without = parseFeature("Scenario Outline: o\n  When <x>\n  Then <y>\n");
  assert.equal(without[0].outline, true);
  assert.equal(without[0].hasExamples, false);
});

// ── isGenericTitle ───────────────────────────────────────────────────────────

test("isGenericTitle rejects placeholder and too-short titles", () => {
  assert.equal(isGenericTitle("test 1"), true);
  assert.equal(isGenericTitle("Scenario A"), true);
  assert.equal(isGenericTitle("works"), true);
  assert.equal(isGenericTitle(""), true);
  assert.equal(isGenericTitle("Triggering alert when occupancy reaches threshold"), false);
});

// ── lintScenarioQuality ──────────────────────────────────────────────────────

function tmpPack() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pack-lint-quality-"));
}

function writeTemplate(root: string, rel: string, content: string) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

test("lintScenarioQuality passes a well-formed scenario clean", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/good.feature.tpl",
      "Feature: Capacity\n" +
        "  Scenario: alert when occupancy reaches threshold\n" +
        '    Given a facility with capacity "200"\n' +
        '    When occupancy reaches "180"\n' +
        '    Then a "CapacityThresholdReached" event is emitted\n'
    );
    const pack = {
      scenarios: [
        {
          id: "SCN-001",
          template: "templates/good.feature.tpl",
          scenario: "alert when occupancy reaches threshold",
        },
      ],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);
    assert.deepEqual(errors, []);
    assert.deepEqual(issues, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintScenarioQuality flags a vague, thin, assertion-less scenario", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/weak.feature.tpl",
      "Feature: F\n  Scenario: test\n    Given stuff\n    When it works\n"
    );
    const pack = { scenarios: [{ id: "SCN-009", template: "templates/weak.feature.tpl" }] };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);
    assert.deepEqual(errors, []);
    const joined = issues.join("\n");
    assert.match(joined, /generic/);
    assert.match(joined, /only 2 step/);
    assert.match(joined, /no Then step/);
    assert.match(joined, /vague step/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintScenarioQuality errors on a missing template and an Examples-less Outline", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/outline.feature.tpl",
      "Scenario Outline: charge the fee for a duration\n  When the stay is <minutes>\n  Then the fee is <amount>\n"
    );
    const pack = {
      scenarios: [
        { id: "SCN-A", template: "templates/missing.feature.tpl" },
        { id: "SCN-B", template: "templates/outline.feature.tpl" },
      ],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);
    assert.match(errors.join("\n"), /SCN-A template not found/);
    assert.match(errors.join("\n"), /Scenario Outline has no Examples table/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintScenarioQuality flags drift between pack.yaml name and template title", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/drift.feature.tpl",
      "Scenario: registering vehicle entry with an available slot\n" +
        "  Given a slot is free\n  When a vehicle enters\n  Then the slot is taken\n"
    );
    const pack = {
      scenarios: [
        {
          id: "SCN-002",
          template: "templates/drift.feature.tpl",
          scenario: "vehicle entry happy path",
        },
      ],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);
    assert.match(issues.join("\n"), /does not match template title/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintScenarioQuality reports a scenario entry with no content", () => {
  const errors: string[] = [];
  const issues: string[] = [];
  lintScenarioQuality({ scenarios: [{ id: "SCN-X" }] }, "/nonexistent", errors, issues);
  assert.match(issues.join("\n"), /SCN-X declares no scenario content/);
});

test("lintScenarioQuality lints inline given/when/then scenarios", () => {
  const errors: string[] = [];
  const issues: string[] = [];
  const pack = {
    scenarios: [
      {
        id: "SCN-INLINE",
        title: "recording an action emits an audit entry",
        given: "a state-changing operation completes",
        when: "the system records the audit entry",
        then: "AuditEntryRecorded is emitted with actor and action",
      },
      {
        id: "SCN-WEAK",
        title: "test",
        given: "stuff",
        then: "it works",
      },
    ],
  };
  lintScenarioQuality(pack, "/nonexistent", errors, issues);
  const joined = issues.join("\n");
  // The well-formed inline scenario is clean.
  assert.ok(!joined.includes("SCN-INLINE"));
  // The weak inline scenario is flagged: generic title, no When, vague step.
  assert.match(joined, /SCN-WEAK.*generic/s);
  assert.match(joined, /SCN-WEAK.*no When step/s);
  assert.match(joined, /SCN-WEAK.*vague step/s);
});

test("runLint routes scenario issues to warnings, or to errors under --strict", () => {
  const weakPack = {
    scenarios: [{ id: "SCN-W", title: "test", given: "x", then: "it works" }],
  };
  const lenient = runLint(weakPack, "/nonexistent", { strict: false });
  // This fragment is not a whole pack, so runLint also reports that it could
  // not be installed. That is a different rule; what is asserted here is where
  // the *scenario-quality* findings land.
  assert.ok(
    !lenient.errors.some((e: string) => e.includes("SCN-W")),
    "scenario issues must be warnings without --strict"
  );
  assert.ok(lenient.warnings.some((w: string) => w.includes("SCN-W")));

  const strict = runLint(weakPack, "/nonexistent", { strict: true });
  assert.ok(strict.errors.some((e: string) => e.includes("SCN-W")));
});

// ── F3: the two rules that are errors, never warnings ────────────────────────
//
// H14 shipped because these were style opinions. `--strict` promoted them, CI
// used `--strict`, and the packs still went out with 27 scenarios that executed
// nothing — so the promotion was never the protection it looked like. Both are
// now errors on their own, and these tests assert that without passing strict.

test("scenario_has_no_steps is an error without --strict", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/features/empty.feature.tpl",
      "Feature: Flags\n  Scenario: Defining a flag emits FlagDefined\n"
    );
    const pack = {
      scenarios: [{ id: "SCN-001", template: "templates/features/empty.feature.tpl" }],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);

    assert.ok(
      errors.some((e: string) => e.includes("scenario_has_no_steps")),
      `expected an error, got errors=${JSON.stringify(errors)} issues=${JSON.stringify(issues)}`
    );
    assert.ok(
      errors.some((e) => /case-sensitive/.test(e)),
      "the message should point at the usual cause rather than leaving it to be guessed"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keyword_case_invalid is an error, and names the spelling that works", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/features/shouting.feature.tpl",
      "Feature: Flags\n" +
        "  Scenario: Defining a flag emits FlagDefined\n" +
        "    GIVEN no flag exists\n" +
        "    WHEN an operator defines one\n" +
        "    THEN FlagDefined is emitted\n"
    );
    const pack = {
      scenarios: [{ id: "SCN-001", template: "templates/features/shouting.feature.tpl" }],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);

    const cased = errors.filter((e) => e.includes("keyword_case_invalid"));
    assert.equal(cased.length, 3, `expected one per bad keyword, got ${JSON.stringify(errors)}`);
    assert.ok(cased[0].includes("`GIVEN`"), "it should quote what was written");
    assert.ok(cased[0].includes("`Given`"), "and what to write instead");
    assert.ok(/:3:/.test(cased[0]), "with the line, so it can be found");

    // The same file also has no steps at all, which is the consequence.
    assert.ok(errors.some((e: string) => e.includes("scenario_has_no_steps")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a well-formed scenario raises neither rule", () => {
  const root = tmpPack();
  try {
    writeTemplate(
      root,
      "templates/features/good.feature.tpl",
      "Feature: Flags\n" +
        "  Scenario: Defining a flag emits FlagDefined\n" +
        "    Given no flag with id 'new-checkout' exists\n" +
        "    When an operator defines the flag with default=false\n" +
        "    Then FlagDefined is emitted\n"
    );
    const pack = {
      scenarios: [{ id: "SCN-001", template: "templates/features/good.feature.tpl" }],
    };
    const errors: string[] = [];
    const issues: string[] = [];
    lintScenarioQuality(pack, root, errors, issues);
    assert.deepEqual(errors, []);
    assert.deepEqual(issues, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
