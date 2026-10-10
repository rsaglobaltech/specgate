"use strict";

/**
 * `done` refuses what cannot be delivered (FinCore pilot, #72 and #73).
 *
 * `done REQ-055` marked Implemented a requirement in `Needs Clarification`
 * that no test named and no code implemented: validation judged the row by the
 * status it had, which owes nothing, and the suite was green because nothing in
 * it was about REQ-055. The next `check` failed TDD-1. And `status` listed that
 * requirement under "To do" as "a test and code", inviting exactly that.
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
const FEATURE = "features/totals-are-rounded-half-up.feature";

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

/** An adopted project with one real requirement (obligation and scenario written), no test yet. */
function project(needsClarification) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-undeliverable-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  assert.equal(cli("new", "Totals are rounded half-up", "--project-dir", dir).status, 0);

  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "The system MUST satisfy: Totals are rounded half-up.",
        "The system MUST round every invoice total half-up to two decimals." +
          (needsClarification ? '\n\n<!-- csda:trace status="Needs Clarification" -->' : "")
      )
      .replace(/^> Written by Specgate\..*$/m, "")
  );
  const feature = path.join(dir, FEATURE);
  fs.writeFileSync(
    feature,
    fs
      .readFileSync(feature, "utf8")
      .replace("<the state before the action>", "an order totalling 10.005 EUR")
      .replace("<the action under test>", "the invoice total is computed")
      .replace("<the observable outcome>", "the total is 10.01 EUR")
  );
  return { parent, dir };
}

function row(dir) {
  return fs
    .readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("| REQ-002 |"));
}

function writeTest(dir) {
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(path.join(dir, "test/totals.test.js"), "// REQ-002 SCN-002\n");
}

test("done refuses a requirement no test names, and writes nothing", () => {
  const { parent, dir } = project(false);
  try {
    const r = cli("done", "REQ-002", "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /TDD-1/);
    assert.match(row(dir), /\| Draft \|$/);

    writeTest(dir);
    const ok = cli("done", "REQ-002", "--project-dir", dir);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(row(dir), /\| Implemented \|$/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("done refuses a requirement waiting for an answer, even with its test (#72)", () => {
  const { parent, dir } = project(true);
  try {
    const bare = cli("done", "REQ-002", "--project-dir", dir);
    assert.equal(bare.status, 1, bare.stdout + bare.stderr);
    assert.match(bare.stdout + bare.stderr, /done_needs_clarification/);

    writeTest(dir);
    const tested = cli("done", "REQ-002", "--project-dir", dir);
    assert.equal(tested.status, 1, tested.stdout + tested.stderr);
    assert.match(tested.stdout + tested.stderr, /done_needs_clarification/);
    assert.match(row(dir), /\| Needs Clarification \|$/);

    // The gate says the same thing to anything else that delivers (the harness).
    const gate = cli("validate", dir, "--strict", "--delivering", "REQ-002");
    assert.equal(gate.status, 1);
    assert.match(gate.stdout + gate.stderr, /waiting for an answer/);

    // And the project as it stands still passes: waiting owes nothing.
    assert.equal(cli("check", dir).status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("status lists a requirement waiting for an answer apart, naming the question (#73)", () => {
  const { parent, dir } = project(true);
  try {
    fs.mkdirSync(path.join(dir, "docs/specs/changes/draft-totals"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs/specs/changes/draft-totals/questions.md"),
      "# Questions\n\n| # | Question | Blocks | Answer |\n|---|---|---|---|\n" +
        "| Q1 | Half-up or banker's rounding? | REQ-002 | |\n"
    );
    const text = cli("status", "--project-dir", dir).stdout;
    assert.match(text, /Waiting for an answer/);
    assert.match(text, /REQ-002.*an answer to Q1/);
    assert.doesNotMatch(text, /REQ-002.*a test and code/);

    const doc = JSON.parse(cli("status", "--project-dir", dir, "--json").stdout);
    const req = doc.requirements.find((r) => r.id === "REQ-002");
    assert.equal(req.category, "WAITING_FOR_ANSWER");
    assert.match(req.question, /^Q1 \(docs\/specs\/changes\/draft-totals\/questions\.md\)$/);
    assert.equal(doc.counts.WAITING_FOR_ANSWER, 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
