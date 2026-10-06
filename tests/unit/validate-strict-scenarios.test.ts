"use strict";

/**
 * `specgate validate --strict-scenarios` — the pack's quality rules, applied where
 * the harness actually runs (A3).
 *
 * `docs/specs/harness.md` states the dependency plainly: the gate is only as
 * strong as its scenarios. Until now the rules enforcing that lived in `pack
 * lint` and judged one thing, a `pack.yaml` — while a project's features arrive
 * by three routes that never touch it: `change archive`, `req add`, and a person
 * with an editor.
 *
 * Two promises are pinned here, and the second matters as much as the first:
 * the flag catches a scenario that cannot fail, and **the default still does
 * not**. A project brought in with `specgate adopt` carries features written long
 * before this tool existed; failing its first `validate` teaches people to skip
 * the gate rather than fix the scenarios.
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

/** A scaffolded project, which is the only kind that validates clean to start with. */
function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "strict-scenarios-"));
  const init = cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix");
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

/** Rewrite the project's own feature with upper-case keywords — H14 in one line. */
function shoutTheKeywords(projectDir) {
  const file = path.join(projectDir, "features", "core", "health.feature");
  assert.ok(fs.existsSync(file), "the scaffold no longer ships features/core/health.feature");
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(/^(\s*)(Given|When|Then|And) /gm, (_m, pad, kw) => `${pad}${kw.toUpperCase()} `),
    "utf8"
  );
  return file;
}

test("a scaffolded project passes --strict-scenarios", () => {
  // If the tool's own output cannot clear its own strictest scenario gate, the
  // gate is wrong. This is the false-positive check.
  const { parent, projectDir } = scaffold();
  try {
    const r = cli("validate", projectDir, "--strict-scenarios");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-scenarios fails on a scenario Cucumber would see as empty", () => {
  const { parent, projectDir } = scaffold();
  try {
    shoutTheKeywords(projectDir);
    const r = cli("validate", projectDir, "--strict-scenarios");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    const out = r.stdout + r.stderr;
    assert.match(out, /keyword_case_invalid/);
    assert.match(out, /scenario_has_no_steps/);
    assert.match(out, /features\/core\/health\.feature:\d+/, "it should say where");
    assert.match(out, /write `Given`/, "and what to write instead");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("without the flag, scenario quality does not fail validate", () => {
  // The gradual-adoption promise. If this ever starts failing, `specgate adopt` has
  // become a wall instead of a door.
  const { parent, projectDir } = scaffold();
  try {
    shoutTheKeywords(projectDir);
    const r = cli("validate", projectDir);
    assert.equal(r.status, 0, `plain validate should still pass:\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, /keyword_case_invalid/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("doctor reports the same finding as an advisory, with its fix", () => {
  // The other half of gradual adoption: seen, named, fixable — without a gate.
  const { parent, projectDir } = scaffold();
  try {
    shoutTheKeywords(projectDir);
    const r = cli("doctor", "--project-dir", projectDir);
    const out = r.stdout + r.stderr;
    assert.match(out, /keyword_case_invalid|is not a Gherkin keyword/);
    assert.match(out, /scenarios/, "the finding should be filed under a scenarios check");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-scenarios is a declared flag, not one that slips through", () => {
  // The dispatcher rejects unknown flags for validate, so a flag that is not
  // registered is silently no flag at all.
  const r = cli("validate", ".", "--strict-scenariosX");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Unknown flag/);
});

// ── The matrix must point at a scenario that is there (F4) ───────────────────
//
// The help text has asked for a Scenario ID "that matches a scenario in its
// feature file" for as long as it has existed, and nothing compared the two.
// Measured before this was written: rename the scenario and both
// `--strict-tdd` and `--strict-scenarios` pass, with the matrix pointing at
// something that is not there.
//
// The check runs off tags, because the matrix carries an id and not a title —
// and because a tag survives the rename that a title does not.

test("a scaffolded project is tagged, and validates", () => {
  const { parent, projectDir } = scaffold();
  try {
    const feature = fs.readFileSync(path.join(projectDir, "features/core/health.feature"), "utf8");
    assert.match(feature, /@REQ-000 @SCN-000/, feature);
    assert.equal(cli("validate", projectDir).status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a row pointing at a scenario the file does not carry is caught", () => {
  const { parent, projectDir } = scaffold();
  try {
    const file = path.join(projectDir, "features/core/health.feature");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace("@REQ-000 @SCN-000", "@REQ-000"),
      "utf8"
    );
    const r = cli("validate", projectDir);
    assert.notEqual(r.status, 0);
    const out = r.stdout + r.stderr;
    assert.match(out, /not @SCN-000/);
    assert.match(out, /points at a scenario that is not there/);
    assert.match(out, /or correct the Scenario ID/, "a failure without a fix just stops you");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("renaming the scenario no longer defeats the link", () => {
  // The failure this exists for: the title moved, the tag did not, and the
  // matrix still points at something real.
  const { parent, projectDir } = scaffold();
  try {
    const file = path.join(projectDir, "features/core/health.feature");
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace("Scenario: API reports service as healthy", "Scenario: Renamed by an agent"),
      "utf8"
    );
    assert.equal(cli("validate", projectDir).status, 0, "the tag still links the two");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an untagged project is left alone — adoption must not become a wall", () => {
  // A repository brought in with `specgate adopt`, or scaffolded before this
  // existed, carries no tags. Failing it here would punish it for a link it was
  // never given the means to make.
  const { parent, projectDir } = scaffold();
  try {
    const file = path.join(projectDir, "features/core/health.feature");
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace("  @REQ-000 @SCN-000\n", "")
        .replace("Scenario: API reports service as healthy", "Scenario: Renamed entirely"),
      "utf8"
    );
    assert.equal(cli("validate", projectDir).status, 0, "an untagged file has nothing to compare");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
