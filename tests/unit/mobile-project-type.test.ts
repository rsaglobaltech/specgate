"use strict";

/**
 * `mobile` as a first-class project type.
 *
 * Before this, a mobile app was scaffolded by declaring `frontend` and setting
 * the stack — so the type recorded in the generated project was simply untrue,
 * and the AI rules it inherited talked about responsive behaviour and route
 * navigation. The type existed as a real use case long before the enum
 * accepted it.
 *
 * The load-bearing test is the last one: four places have to agree on the list
 * of types, and nothing but a test keeps them in step.
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
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function scaffoldMobile() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-mobile-"));
  const config = path.join(parent, "project.yaml");
  fs.writeFileSync(
    config,
    [
      'PROJECT_NAME: "Field Ops"',
      "PROJECT_SLUG: field-ops",
      "PROJECT_TYPE: mobile",
      'DOMAIN: "field inspections"',
      'STACK: "React Native 0.76 + TypeScript"',
      'API_STYLE: "REST"',
      'TESTING: "Jest + Detox"',
      "",
    ].join("\n"),
    "utf8"
  );
  const r = cli("init", "--config", config, "--out", parent, "--no-git");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir: path.join(parent, "field-ops") };
}

test("PROJECT_TYPE: mobile scaffolds, and the recorded type is the truth", () => {
  const { parent, dir } = scaffoldMobile();
  try {
    assert.match(fs.readFileSync(path.join(dir, "README.md"), "utf8"), /Project type: `mobile`/);
    assert.equal(cli("validate", dir).status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a mobile project gets mobile rules, not the web ones", () => {
  const { parent, dir } = scaffoldMobile();
  try {
    const rules = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(rules, /mobile project/);
    // The vocabulary that made `frontend` the wrong answer.
    assert.match(rules, /Offline is a state, not an error/);
    assert.match(rules, /process can die at any moment/i);
    assert.match(rules, /store review/i);
    assert.match(rules, /permission is a flow with a denial branch/i);
    assert.doesNotMatch(rules, /Responsive behavior as acceptance criteria/);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(rules), "unrendered placeholder in AGENTS.md");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the baseline scenario is an app launch, not an HTTP route", () => {
  const { parent, dir } = scaffoldMobile();
  try {
    const feature = fs.readFileSync(path.join(dir, "features/core/health.feature"), "utf8");
    assert.match(feature, /cold start/i);
    assert.doesNotMatch(feature, /navigate to the "\/" route/);
    assert.doesNotMatch(feature, /web application/i);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a mobile project declares no datastore, so no DATABASE_ variables leak in", () => {
  // DATASTORE defaults to none for anything that is not a backend. A phone is
  // not where a Postgres connection string belongs.
  const { parent, dir } = scaffoldMobile();
  try {
    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.doesNotMatch(spec, /DATABASE_/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an unknown project type is rejected, naming the ones that exist", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-badtype-"));
  try {
    const config = path.join(parent, "project.yaml");
    // Every other required variable present, so the type check is what fires
    // rather than the missing-variable check that runs before it.
    fs.writeFileSync(
      config,
      [
        'PROJECT_NAME: "X"',
        "PROJECT_SLUG: x",
        "PROJECT_TYPE: desktop",
        'DOMAIN: "d"',
        'STACK: "whatever"',
        'API_STYLE: "REST"',
        'TESTING: "none"',
        "",
      ].join("\n"),
      "utf8"
    );
    const r = cli("init", "--config", config, "--out", parent, "--no-git");
    assert.notEqual(r.status, 0);
    const out = r.stdout + r.stderr;
    assert.match(out, /backend/);
    assert.match(out, /mobile/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("`pack init --type mobile` produces a pack that lints", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-mobilepack-"));
  try {
    const init = cli(
      "pack",
      "init",
      "--out",
      parent,
      "--name",
      "Field Ops Mobile",
      "--type",
      "mobile"
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const packYaml = path.join(parent, "field-ops-mobile", "mobile", "pack.yaml");
    assert.match(fs.readFileSync(packYaml, "utf8"), /project_type:\s*"mobile"/);
    const lint = cli("pack", "lint", "--pack-root", parent, "--pack", "field-ops-mobile/mobile");
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("every place that lists project types agrees", () => {
  // The four: init's own list, the wizard's choices, the pack validator, and
  // the JSON Schema enum. A type accepted by one and refused by another is how
  // `contracts` became scaffoldable but impossible to install (ADR-0020).
  //
  // Read as values, not scraped out of source text. The regex this used to run
  // over `scripts/init_project.ts` and `scripts/wizard.ts` kept matching after
  // both became re-export shims — in the wizard's case it matched a doc comment
  // restating the list, so the test compared prose against the schema and passed
  // no matter what the wizard actually offered.
  const { PROJECT_TYPES } = require("../../scripts/init_project");
  const { WIZARD_FIELDS } = require("../../scripts/cli/commands/project/WizardCommand");
  const { PACK_PROJECT_TYPES } = require("../../packages/core/src/domain/PackSpec");
  const schema = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "schemas/pack.schema.json"), "utf8")
  );

  const projectTypeField = WIZARD_FIELDS.find((f) => f.key === "PROJECT_TYPE");
  assert.ok(projectTypeField, "the wizard no longer asks for PROJECT_TYPE");

  const fromInit = [...PROJECT_TYPES];
  const fromWizard = [...projectTypeField.choices];
  const fromSchema = schema.properties.metadata.properties.project_type.enum;

  assert.ok(fromInit.length > 0, "init declares no project types");
  assert.deepEqual(fromInit, fromWizard, "init and the wizard disagree");

  // `init` scaffolds a project; packs additionally target `contracts`, which
  // is a pack flavour rather than something you scaffold an app as.
  assert.deepEqual(
    [...fromSchema].sort(),
    [...new Set([...fromInit, "contracts"])].sort(),
    "the JSON Schema enum and init disagree"
  );
  assert.deepEqual(
    [...PACK_PROJECT_TYPES].sort(),
    [...fromSchema].sort(),
    "validator and schema disagree"
  );
});
