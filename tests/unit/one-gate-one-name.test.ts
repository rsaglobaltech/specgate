"use strict";

/**
 * Round 2 sent a verdict backwards, and this is why.
 *
 * A cold evaluator counted ten places calling `--strict-tdd` "the gate" — the
 * quickstart, `adopt`'s epilogue, the generated AI_RULES.md, `harness init`,
 * the harness prompt — while `ci init` alone emitted the stronger command.
 * Anyone following any of the ten got a check that passes on an `Implemented`
 * requirement whose test file does not exist. Round 1 fixed `ci init` and left
 * the other nine, which made the right one look like the mistake.
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

test("--strict means every strict check, so a rotted link cannot pass it", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-gate-"));
  try {
    assert.equal(cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix").status, 0);
    const dir = path.join(parent, "my-spec-driven-app");

    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-050 | SCN-050 | - | UC-050 Gone | - | - | - | src/nope.js | tests/does/not/Exist.js |" +
        " Implemented |\n"
    );

    // The measured trap: the flag nine places called "the gate" is green here.
    assert.equal(cli("validate", dir, "--strict-tdd").status, 0);
    // The one name that is the gate is not.
    assert.equal(cli("validate", dir, "--strict").status, 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("nothing tells a user to run a weaker gate than --strict", () => {
  // Fixing the wording in ten places would have left the same trap for the
  // eleventh, so the check is that no shipped text recommends the old command.
  const shipped = [
    "docs/quickstart.md",
    "templates/base/AGENTS.md.tpl",
    "templates/adopt/stack-rules.md",
    "templates/ci/github.yml.tpl",
    "templates/ci/gitlab.yml.tpl",
    "templates/ci/azure.yml.tpl",
    "templates/ci/jenkins.tpl",
  ];
  for (const rel of shipped) {
    const body = fs.readFileSync(path.join(ROOT_DIR, rel), "utf8");
    assert.ok(
      !/validate[^\n]*--strict-tdd(?![\w-])/.test(body),
      `${rel} still recommends --strict-tdd as the gate`
    );
  }
});

test("a freshly generated project passes --strict", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-gate-fresh-"));
  try {
    assert.equal(cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix").status, 0);
    const r = cli("validate", path.join(parent, "my-spec-driven-app"), "--strict");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict is a declared flag", () => {
  const r = cli("validate", ".", "--strictX");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Unknown flag/);
});

// ── The gate must not contradict `adopt`'s promise ───────────────────────────

test("a brownfield link to a pre-existing test does not force a source edit", () => {
  // The regression round 2 found: every retro-fitted row failed
  // `link_without_evidence`, and the only fix was to write REQ-006 into
  // somebody's existing test — the one thing `adopt` promises never to make
  // you do. A gate that contradicts the product's headline promise is a reason
  // to stop using the product.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-brown-"));
  const dir = path.join(parent, "app");
  try {
    fs.mkdirSync(path.join(dir, "src/main/java"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src/test/java"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "pom.xml"),
      "<project><artifactId>petclinic</artifactId></project>"
    );
    fs.writeFileSync(path.join(dir, "src/main/java/Owner.java"), "class Owner {}\n");
    fs.writeFileSync(
      path.join(dir, "src/test/java/OwnerTests.java"),
      "class OwnerTests { void telephoneIsTenDigits() {} }\n"
    );
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"], {
      cwd: dir,
    });

    assert.equal(cli("adopt", "--project-dir", dir, "--keep-matrix").status, 0);
    const added = cli("req", "add", "Owner telephone must be ten digits", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(added.stdout)[1];
    assert.equal(
      cli(
        "req",
        "link",
        reqId,
        "--code",
        "src/main/java/Owner.java",
        "--test",
        "src/test/java/OwnerTests.java",
        "--project-dir",
        dir
      ).status,
      0
    );

    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 0, `a retro-fitted link must not fail:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /could not run/, "and it must say why it did not check");

    const dirty = spawnSync("git", ["status", "--short", "--", "src"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(dirty.stdout.trim(), "", "the gate must not have required a source edit");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("once a project uses the convention, the check holds every row to it", () => {
  // Calibration, not abdication: the skipped scenario is still caught.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-conv-"));
  try {
    assert.equal(
      cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix", "--no-sample-req").status,
      0
    );
    const dir = path.join(parent, "my-spec-driven-app");
    fs.mkdirSync(path.join(dir, "features/billing"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features/billing/totals.feature"),
      "Feature: Totals\n\n  Scenario: SCN-010 subtotal\n    Given a\n    When b\n    Then c\n\n" +
        "  Scenario: SCN-012 discounted\n    Given a\n    When b\n    Then c\n"
    );
    fs.writeFileSync(path.join(dir, "src/totals.js"), "export const t = () => ({});\n");
    fs.writeFileSync(path.join(dir, "tests/totals.test.js"), "// SCN-010 subtotal\n");
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-010 | SCN-010 | `features/billing/totals.feature` | UC-010 Totals | - | - | - |" +
        " src/totals.js | tests/totals.test.js | Implemented |\n"
    );

    // Implemented: since #64 a Draft row owes its scenarios only when it is
    // the one being delivered (`--delivering`), which is where an agent would
    // skip one. This pins the calibration, on a row that owes coverage.
    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /SCN-012/, "the skipped scenario is still caught");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Round 2b: the one-comment cliff, and the machine-local merge driver ──────

test("adopting the naming convention on one test does not turn other rows red", () => {
  // Measured: adding `// Covers REQ-009` to one test file turned three
  // unrelated rows red at once. Doing the correct thing produced a punishment,
  // which teaches people not to do the correct thing.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-cliff-"));
  try {
    assert.equal(
      cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix", "--no-sample-req").status,
      0
    );
    const dir = path.join(parent, "my-spec-driven-app");
    fs.mkdirSync(path.join(dir, "features/core"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features/core/h.feature"),
      "Feature: H\n\n  Scenario: SCN-001 a\n    Given a\n    When b\n    Then c\n"
    );
    fs.writeFileSync(path.join(dir, "src/a.js"), "export const a = () => 1;\n");
    fs.writeFileSync(path.join(dir, "tests/a.test.js"), "// nothing\n");
    fs.writeFileSync(path.join(dir, "tests/b.test.js"), "// nothing\n");
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-010 | SCN-001 | `features/core/h.feature` | UC-010 A | - | - | - | src/a.js |" +
        " tests/a.test.js | Draft |\n" +
        "| REQ-011 | - | - | UC-011 B | - | - | - | src/a.js | tests/b.test.js | Draft |\n"
    );

    assert.equal(cli("validate", dir, "--strict-coverage").status, 0);

    fs.appendFileSync(path.join(dir, "tests/b.test.js"), "// Covers REQ-011\n");
    const after = cli("validate", dir, "--strict-coverage");
    assert.equal(
      after.status,
      0,
      `one comment must not fail the build:\n${after.stdout}${after.stderr}`
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a scenario skipped in a file whose others are named is still caught", () => {
  // The calibration is per feature file, so #168's case survives it.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-skip-"));
  try {
    assert.equal(
      cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix", "--no-sample-req").status,
      0
    );
    const dir = path.join(parent, "my-spec-driven-app");
    fs.mkdirSync(path.join(dir, "features/billing"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features/billing/totals.feature"),
      "Feature: Totals\n\n  Scenario: SCN-010 subtotal\n    Given a\n    When b\n    Then c\n\n" +
        "  Scenario: SCN-012 discounted\n    Given a\n    When b\n    Then c\n"
    );
    fs.writeFileSync(path.join(dir, "src/t.js"), "export const t = () => 1;\n");
    fs.writeFileSync(path.join(dir, "tests/t.test.js"), "// SCN-010 subtotal\n");
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-010 | SCN-010 | `features/billing/totals.feature` | UC-010 T | - | - | - |" +
        " src/t.js | tests/t.test.js | Implemented |\n"
    );

    const r = cli("validate", dir, "--strict-coverage");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /SCN-012/);

    // And with nothing named at all, there is nothing to conclude.
    fs.writeFileSync(path.join(dir, "tests/t.test.js"), "// nothing\n");
    assert.equal(cli("validate", dir, "--strict-coverage").status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the merge driver git registers is portable, not a path on one machine", () => {
  // It used to write `node "/Users/someone/.../merge-traceability.js"` into
  // .git/config while committing `merge=csda-matrix` to .gitattributes — a
  // shared rule pointing at a directory that exists on one laptop.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-driver-"));
  const dir = path.join(parent, "app");
  try {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "pom.xml"), "<project><artifactId>d</artifactId></project>");
    fs.writeFileSync(path.join(dir, "src/A.java"), "class A {}\n");
    fs.writeFileSync(path.join(dir, ".gitattributes"), "*.md text\n");
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"], {
      cwd: dir,
    });

    assert.equal(cli("adopt", "--project-dir", dir, "--keep-matrix").status, 0);
    const init = cli("harness", "init", "--project-dir", dir);
    assert.equal(init.status, 0, init.stdout + init.stderr);

    const driver = spawnSync("git", ["config", "--get", "merge.csda-matrix.driver"], {
      cwd: dir,
      encoding: "utf8",
    }).stdout.trim();

    assert.ok(driver.length > 0, "the driver should be registered");

    // This project has no specgate in its node_modules, so the only address
    // that works here and now is the running CLI's own path — and the command
    // has to say so rather than let the next clone find out during a merge.
    assert.match(init.stderr, /machine's copy|machine-local/i, init.stderr);
    assert.match(init.stderr, /npm i -D @rsaglobaltech\/specgate/, "offer the reproducible fix");
    // And touching a tracked file is said out loud, not discovered in git status.
    assert.match(init.stderr, /\.gitattributes/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("ci init announces the command it actually generates", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-ciann-"));
  try {
    assert.equal(cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix").status, 0);
    const dir = path.join(parent, "my-spec-driven-app");
    const r = cli("ci", "init", "--provider", "github", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const workflow = fs.readFileSync(path.join(dir, ".github/workflows/spec-gate.yml"), "utf8");
    // A project with tests gets `check` (#70); one without, `validate --strict`.
    const generated = / check \./.test(workflow)
      ? "specgate check"
      : /validate \. (--strict\b[^\s]*)/.exec(workflow)[1];
    assert.ok(
      r.stdout.includes(generated),
      `announced something other than what it wrote (${generated}):\n${r.stdout}`
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
