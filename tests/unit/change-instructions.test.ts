"use strict";

// csda:allow-placeholders — the templates under test carry {{VAR}} tokens.

/**
 * `change instructions` — the single context engine.
 *
 * The point of these tests is that the rules an agent is handed stay in step
 * with what the validator actually enforces. A rule list that drifts from the
 * checker is worse than no rule list: it teaches the agent to fail.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const {
  buildInstructions,
  unlockedBy,
  KNOWN,
  STAGES,
} = require("../../scripts/change/instructions");
const { TEMPLATES } = require("../../scripts/change/cli");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

function withChange(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "instructions-"));
  const r = cli(
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, "acme-energy-hub");
  assert.equal(cli("change", "new", "add-pricing", "--project-dir", dir).status, 0);
  try {
    fn(dir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("unlocks is derived from the graph, not restated", () => {
  // proposal enables both specs and design; tasks ends the chain.
  assert.deepEqual(unlockedBy("proposal").sort(), ["design", "specs"]);
  assert.deepEqual(unlockedBy("specs"), ["tasks"]);
  assert.deepEqual(unlockedBy("tasks"), []);
});

test("every artefact and stage is reachable", () => {
  for (const id of ["proposal", "specs", "design", "tasks", "apply", "archive"]) {
    assert.ok(KNOWN.includes(id), `${id} should be a known artefact`);
  }
});

test("instructions for an artefact carry the template, the rules and the state", () => {
  withChange((dir) => {
    const ins = buildInstructions(dir, "specs", "add-pricing", TEMPLATES);
    assert.equal(ins.kind, "artifact");
    assert.equal(ins.state, "ready");
    assert.deepEqual(ins.requires, ["proposal"]);
    assert.deepEqual(ins.unlocks, ["tasks"]);
    assert.match(ins.template, /## ADDED Requirements/);
    assert.ok(ins.rules.length > 0);
    // The project's declared stack, so an agent does not invent one.
    assert.match(ins.context.stack, /Quarkus/);
    assert.equal(ins.context.rigor, "lite");
  });
});

test("the proposal is passed as context to every later artefact", () => {
  withChange((dir) => {
    const specs = buildInstructions(dir, "specs", "add-pricing", TEMPLATES);
    assert.ok(specs.context.proposal, "specs should receive the proposal as intent");
    const proposal = buildInstructions(dir, "proposal", "add-pricing", TEMPLATES);
    assert.equal(proposal.context.proposal, undefined, "the proposal is not its own context");
  });
});

test("a stage carries rules and a next command, not a template", () => {
  withChange((dir) => {
    const ins = buildInstructions(dir, "apply", "add-pricing", TEMPLATES);
    assert.equal(ins.kind, "stage");
    assert.equal(ins.template, undefined);
    assert.ok(ins.rules.length > 0);
    assert.match(ins.nextCommand, /validate \. --strict$/);
    // `<id>` is substituted, never handed to the caller raw.
    const archive = buildInstructions(dir, "archive", "add-pricing", TEMPLATES);
    assert.match(archive.nextCommand, /add-pricing/);
    assert.doesNotMatch(archive.nextCommand, /<id>/);
  });
});

test("the delta rules match what the validator enforces", () => {
  // If the validator's codes change, these rules become a lie. Naming the codes
  // here means the drift is visible in this test rather than in the field.
  const rules = buildInstructionsRules();
  assert.ok(rules.some((r) => r.includes("no_rfc2119_keyword")));
  assert.ok(rules.some((r) => r.includes("scenario_not_gherkin")));
  assert.ok(rules.some((r) => r.includes("ADDED Requirements")));

  const delta = fs.readFileSync(path.join(ROOT_DIR, "scripts/change/delta.ts"), "utf8");
  assert.match(delta, /no_rfc2119_keyword/);
  assert.match(delta, /scenario_not_gherkin/);
});

function buildInstructionsRules() {
  const { DELTA_RULES } = require("../../scripts/change/instructions");
  return DELTA_RULES;
}

test("--json emits one document with the contract's envelope", () => {
  withChange((dir) => {
    const r = cli("change", "instructions", "specs", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.ok(doc.instructions);
    assert.deepEqual(doc.status, []);
  });
});

test("an unknown artefact is a usage error with the valid list", () => {
  withChange((dir) => {
    const r = cli("change", "instructions", "nonsense", "--project-dir", dir, "--json");
    assert.equal(r.status, 2);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.instructions, null);
    assert.equal(doc.status[0].code, "artifact_unknown");
    assert.match(doc.status[0].fix, /proposal/);
  });
});

test("--project-dir's value is not mistaken for a change id", () => {
  // The naive "starts with -" filter left the path behind as a positional.
  withChange((dir) => {
    const r = cli("change", "instructions", "specs", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).instructions.change, "add-pricing");
  });
});

test("every stage names a next command", () => {
  for (const [id, stage] of Object.entries(STAGES) as [string, any][]) {
    assert.ok(stage.nextCommand, `${id} should suggest what to run next`);
    assert.ok(stage.rules.length > 0, `${id} should carry rules`);
  }
});
