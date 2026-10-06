"use strict";

/**
 * Fase 3.1 — one cause, two symptoms.
 *
 * `req add` wrote a matrix row and no prose, so the requirement existed as a
 * table entry with no text anywhere. The expensive consequence was downstream:
 * `harness prompt` emitted "# Implement REQ-002" with every fact `-` and the
 * requirement nowhere in it. A cold evaluator: *"the loop doesn't close on a
 * brownfield adopt"*.
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
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-prose-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib/router"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"d","version":"1.0.0","scripts":{"test":"echo ok"}}'
  );
  fs.writeFileSync(path.join(dir, "lib/router/index.js"), "module.exports = {};\n");
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"], {
    cwd: dir,
  });
  const r = cli("adopt", "--project-dir", dir, "--keep-matrix");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir };
}

test("req add writes the requirement's prose, not just a row", () => {
  const { parent, dir } = adopted();
  try {
    const r = cli("req", "add", "Totals are rounded half-up", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const reqId = /Added (REQ-\d+)/.exec(r.stdout)[1];

    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.match(spec, new RegExp(`REQ-${reqId.slice(4)} — Totals are rounded half-up`));
    assert.match(spec, /MUST satisfy: Totals are rounded half-up\./);
    assert.match(r.stdout, /spec\.md/, "the user should be told prose was written");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the adopted spec.md describes what req add does today", () => {
  // The header written by `adopt` kept saying `req add` "does not write a
  // section here" after it started writing one — the first thing a joiner
  // reads, contradicted by the first command they run.
  const { parent, dir } = adopted();
  try {
    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.doesNotMatch(spec, /does not write a section here/);
    assert.match(spec, /draft `## REQ-NNN` section/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the harness prompt now carries the requirement it asks for", () => {
  const { parent, dir } = adopted();
  try {
    const added = cli("req", "add", "Totals are rounded half-up", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(added.stdout)[1];

    const prompt = cli("harness", "prompt", reqId, "--project-dir", dir);
    assert.equal(prompt.status, 0, prompt.stdout + prompt.stderr);
    assert.match(prompt.stdout, /The requirement \(spec\.md\)/);
    assert.match(prompt.stdout, /Totals are rounded half-up/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a requirement with no prose anywhere is warned about, not failed", () => {
  // A warning on purpose. ADR-0026 commits the 0.9 line to warning about checks
  // that become mandatory in 1.0: every project whose matrix predates `req add`
  // writing prose would otherwise go red on upgrade, and a green-to-red flip in
  // a minor release is how a tool gets removed from a pipeline.
  const { parent, dir } = adopted();
  try {
    // A row written by hand, the way the matrix used to end up after `req add`.
    fs.appendFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "\n| REQ-900 | - | - | UC-900 Orphan | - | - | - | - | TBD | Draft |\n"
    );
    const r = cli("validate", dir, "--strict-tdd");
    assert.equal(r.status, 0, `should warn, not fail:\n${r.stdout}${r.stderr}`);
    const out = r.stdout + r.stderr;
    assert.match(out, /REQ-900/);
    assert.match(out, /no requirement text in spec\.md/);
    assert.match(out, /error in 1\.0/, "the user should learn this before it bites");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a freshly generated project passes its own gates", () => {
  // H20 was exactly this, and adding TDD-4 reintroduced it once before the
  // shipped template gained a REQ-000 section.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-fresh-"));
  try {
    const r = cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const dir = path.join(parent, "my-spec-driven-app");
    for (const flags of [
      ["--strict-tdd"],
      ["--strict-tdd", "--strict-links", "--strict-coverage", "--strict-scenarios"],
    ]) {
      const v = cli("validate", dir, ...flags);
      assert.equal(v.status, 0, `${flags.join(" ")}:\n${v.stdout}${v.stderr}`);
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a freshly adopted project passes its own gates", () => {
  const { parent, dir } = adopted();
  try {
    const v = cli("validate", dir, "--strict-tdd");
    assert.equal(v.status, 0, v.stdout + v.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
