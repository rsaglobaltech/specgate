"use strict";

/**
 * REQ-173 — Approved owes a test, as the strict gate says.
 *
 * `apply REQ-002 --status Approved` wrote Approved on a requirement no test
 * named, silently: the next `validate --strict` failed TDD-1, and with it every
 * gate that judges the whole project. An adopter marked 76 requirements
 * Approved before their tests, and every `harness run` went red.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { cli } from "../helpers/cli";

const FEATURE = "features/totals-are-rounded-half-up.feature";

/** An adopted project with REQ-002 written (obligation and scenario), no test yet. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-approved-"));
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
        "The system MUST round every invoice total half-up to two decimals."
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

function row(dir: string) {
  return fs
    .readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8")
    .split("\n")
    .find((l: string) => l.startsWith("| REQ-002 |"));
}

function writeTest(dir: string) {
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(path.join(dir, "test/totals.test.js"), "// REQ-002 SCN-002\n");
}

test("REQ-173 SCN-173a: Approved before the test is refused, and nothing is written", () => {
  const { parent, dir } = project();
  try {
    const r = cli("apply", "REQ-002", "--status", "Approved", "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /TDD-1/);
    assert.match(r.stdout + r.stderr, /write a test that names REQ-002/);
    assert.match(row(dir), /\| Draft \|$/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-173 SCN-173b: Approved once a test names the requirement", () => {
  const { parent, dir } = project();
  try {
    writeTest(dir);
    const r = cli("apply", "REQ-002", "--status", "Approved", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(row(dir), /\| Approved \|$/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-173 SCN-173c: an unknown status is refused, naming the ones accepted", () => {
  const { parent, dir } = project();
  try {
    for (const args of [["REQ-002"], ["REQ-002", "REQ-001"]]) {
      const r = cli("apply", ...args, "--status", "Aproved", "--project-dir", dir);
      assert.equal(r.status, 2, r.stdout + r.stderr);
      assert.match(r.stdout + r.stderr, /Aproved/);
      assert.match(
        r.stdout + r.stderr,
        /Draft, Approved, Implemented, Verified, Released, Deprecated/
      );
      assert.match(row(dir), /\| Draft \|$/);
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-173 SCN-173d: --no-check writes Approved and warns about TDD-1", () => {
  const { parent, dir } = project();
  try {
    const r = cli("apply", "REQ-002", "--status", "Approved", "--no-check", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(row(dir), /\| Approved \|$/);
    assert.match(r.stderr, /validate --strict/);
    assert.match(r.stderr, /TDD-1/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-173: several ids, Approved, refuses the one no test names and keeps the other", () => {
  const { parent, dir } = project();
  try {
    const r = cli("apply", "REQ-002", "REQ-001", "--status", "Approved", "--project-dir", dir);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /TDD-1/);
    assert.match(row(dir), /\| Draft \|$/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
