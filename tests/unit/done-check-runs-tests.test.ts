"use strict";

/**
 * Fase 1.1 — `done --check` was a no-op that printed a tick.
 *
 * `--check` and `--strict` were parsed into DoneOptions and never read, so the
 * command flipped a row to Implemented over a matrix pointing at files that do
 * not exist, while four documentation pages said it "validates first".
 *
 * A cold evaluator summarised the whole product as "nothing ever runs a test".
 * These tests are the answer to that sentence, so they are deliberately about
 * behaviour and not about the flag parser.
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

const FEATURE = `Feature: Health

  Scenario: SCN-001 the service reports healthy
    Given the service is running
    When health is requested
    Then it reports healthy
`;

/**
 * A project whose gate can genuinely pass, so a refusal below means something.
 * `opts.testPasses` decides whether the suite is red or green.
 */
function project(opts: any = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-done-"));
  const r = cli("init", "--yes", "--out", parent, "--no-git", "--no-sample-req");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(parent, "my-spec-driven-app");

  fs.mkdirSync(path.join(dir, "features/core"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "features/core/health.feature"), FEATURE);
  fs.writeFileSync(path.join(dir, "src/health.js"), "export const h = () => 'healthy';\n");
  // Deliberately NOT `node --test`: this suite already runs under node's test
  // runner, and a nested `node --test` inherits NODE_TEST_CONTEXT, reports up
  // to the parent and exits 0 — a red suite that looks green, which would have
  // made these tests pass for the wrong reason. What is under test here is that
  // `done` runs the configured command and honours its exit code, so the
  // simplest possible command is also the most honest one.
  fs.writeFileSync(
    path.join(dir, "tests/health.test.js"),
    `// SCN-001 the service reports healthy\nprocess.exit(${opts.testPasses === false ? 1 : 0});\n`
  );
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"x","type":"module","scripts":{"test":"node tests/health.test.js"}}'
  );

  const code = opts.brokenLinks ? "src/nope.js" : "src/health.js";
  const proof = opts.brokenLinks ? "tests/nope.test.js" : "tests/health.test.js";
  fs.appendFileSync(
    path.join(dir, "docs/specs/traceability.md"),
    `\n| REQ-001 | SCN-001 | \`features/core/health.feature\` | UC-001 Health | - | - | - |` +
      ` ${code} | ${proof} | Draft |\n`
  );
  return { parent, dir };
}

function statusOf(dir) {
  const row = fs
    .readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("| REQ-001"));
  return row
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean)
    .pop();
}

test("the fixture's gate really can pass, or every refusal below proves nothing", () => {
  const { parent, dir } = project();
  try {
    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir, "--test-cmd", "npm test");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(statusOf(dir), "Implemented");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict refuses when the matrix points at files that do not exist", () => {
  // Measured before the fix: this printed `✔ REQ-001 → Implemented` and exit 0.
  const { parent, dir } = project({ brokenLinks: true });
  try {
    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /done_validate_failed/);
    assert.equal(statusOf(dir), "Draft", "a refused requirement must not be written");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a green validate over a red suite is still a refusal", () => {
  // The sentence this whole phase answers: "nothing ever runs a test".
  const { parent, dir } = project({ testPasses: false });
  try {
    const clean = cli("validate", dir, "--strict-tdd", "--strict-links", "--strict-coverage");
    assert.equal(clean.status, 0, `validate should pass here:\n${clean.stdout}${clean.stderr}`);

    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir, "--test-cmd", "npm test");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /done_tests_failed/);
    assert.equal(statusOf(dir), "Draft");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the failing output is shown, not summarised away", () => {
  const { parent, dir } = project({ testPasses: false });
  try {
    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir, "--test-cmd", "npm test");
    // The command's own output is what the user needs; `done` must pass it
    // through rather than summarise it away.
    assert.match(r.stderr, /tests\/health\.test\.js|npm (test|ERR)/i, r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("no test command is reported, never silently treated as verified", () => {
  const { parent, dir } = project();
  try {
    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /checked the specification, not the code/);
    assert.match(r.stderr, /test_cmd/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("test_cmd in harness.config.yaml is honoured without repeating it", () => {
  const { parent, dir } = project({ testPasses: false });
  try {
    fs.writeFileSync(path.join(dir, "harness.config.yaml"), 'test_cmd: "npm test"\n');
    const r = cli("done", "REQ-001", "--strict", "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /done_tests_failed/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("plain `done` runs the gate: it refuses what `check` would refuse", () => {
  // It used to just write the status, so the daily loop's `done` printed a
  // tick and the `check` in CI went red on the same requirement.
  const { parent, dir } = project({ brokenLinks: true });
  try {
    const r = cli("done", "REQ-001", "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /done_validate_failed/);
    assert.notEqual(statusOf(dir), "Implemented");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("`done --no-check` writes the status without the gate; Approved never ran it", () => {
  const { parent, dir } = project({ brokenLinks: true });
  try {
    const approved = cli("done", "REQ-001", "--status", "Approved", "--project-dir", dir);
    assert.equal(approved.status, 0, approved.stdout + approved.stderr);
    assert.equal(statusOf(dir), "Approved");
    const r = cli("done", "REQ-001", "--no-check", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(statusOf(dir), "Implemented");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
