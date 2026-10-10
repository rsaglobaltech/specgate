"use strict";

/**
 * `specgate new` — one requirement in one step (phase 1 of
 * mejoras/plan-simplificacion-equipo.md).
 *
 * Before it: `req add`, an edit to spec.md, a hand-written `.feature` with the
 * right tags, then `req link --feature`. The promise this file pins is the one
 * that makes the shortcut safe: the scenario it writes is a template, the gate
 * leaves it alone while the requirement is Draft, and refuses it on delivery.
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
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-new-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  const r = cli("adopt", "--project-dir", dir, "--no-capabilities");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir };
}

function json(r) {
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}

const FEATURE = "features/totals-are-rounded-half-up.feature";

test("new writes the prose, the tagged scenario and the linked row", () => {
  const { parent, dir } = adopted();
  try {
    const r = cli("new", "Totals are rounded half-up", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const req = json(r).requirement;
    assert.equal(req.featureFile, FEATURE);
    assert.equal(req.status, "Draft");

    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), new RegExp(`## ${req.id}`));
    const feature = fs.readFileSync(path.join(dir, FEATURE), "utf8");
    assert.match(feature, new RegExp(`@${req.id} @${req.scenarioId}`));
    const matrix = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    const row = matrix.split("\n").find((l) => l.startsWith(`| ${req.id} |`));
    assert.ok(row && row.includes(FEATURE), row);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a Draft from new passes the gate; delivering its template does not", () => {
  const { parent, dir } = adopted();
  try {
    const id = json(cli("new", "Totals are rounded half-up", "--project-dir", dir, "--json"))
      .requirement.id;
    assert.equal(cli("check", dir).status, 0, "a Draft owes nothing");

    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "test/totals.test.js"), `// ${id}\n`);
    cli("req", "link", id, "--test", "test/totals.test.js", "--project-dir", dir);

    const refused = cli("done", id, "--strict", "--project-dir", dir);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stdout + refused.stderr, /scenario_placeholder_step/);

    const file = path.join(dir, FEATURE);
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace("<the state before the action>", "an order totalling 10.005 EUR")
        .replace("<the action under test>", "the invoice total is computed")
        .replace("<the observable outcome>", "the total is 10.01 EUR")
    );
    // The scenario is real now; the obligation is still the sentence `new`
    // wrote, and it states MUST, so nothing but this rule notices (#67).
    const template = cli("done", id, "--strict", "--project-dir", dir);
    assert.equal(template.status, 1, template.stdout + template.stderr);
    assert.match(template.stdout + template.stderr, /requirement_template_obligation/);
    assert.match(template.stdout + template.stderr, /spec\.md/);

    const spec = path.join(dir, "spec.md");
    fs.writeFileSync(
      spec,
      fs
        .readFileSync(spec, "utf8")
        .replace(
          "The system MUST satisfy: Totals are rounded half-up.",
          "The system MUST round every invoice total half-up to two decimals."
        )
        .replace(/^> Written by Specgate\..*$/m, "")
    );
    const ok = cli("done", id, "--strict", "--project-dir", dir);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--feature appends to an existing file instead of replacing it", () => {
  const { parent, dir } = adopted();
  try {
    cli("new", "Totals are rounded half-up", "--project-dir", dir);
    const r = cli("new", "Totals never go negative", "--feature", FEATURE, "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const feature = fs.readFileSync(path.join(dir, FEATURE), "utf8");
    assert.match(feature, /Scenario: Totals are rounded half-up/);
    assert.match(feature, /Scenario: Totals never go negative/);
    assert.equal((feature.match(/^Feature:/gm) || []).length, 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("new without a title, or outside a spec-driven repo, is a usage error", () => {
  const { parent, dir } = adopted();
  try {
    assert.equal(cli("new", "--project-dir", dir).status, 2);
    assert.equal(cli("new", "x", "--project-dir", parent).status, 2);
    assert.equal(cli("new", "--help").status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("scenario rules that make a suite lie still apply to a Draft", () => {
  // H14: Cucumber reports a stepless scenario as passed. That lies whatever
  // the row's status, so it is not owed-on-delivery like the rest.
  const { parent, dir } = adopted();
  try {
    cli("new", "Totals are rounded half-up", "--project-dir", dir);
    fs.writeFileSync(
      path.join(dir, FEATURE),
      "Feature: Totals\n\n  @REQ-002 @SCN-002\n  Scenario: Totals are rounded half-up\n"
    );
    const r = cli("validate", dir, "--strict");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /scenario_has_no_steps/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
