"use strict";

/**
 * `specgate matrix` — the matrix generated instead of maintained (phase 3 of
 * mejoras/plan-simplificacion-equipo.md).
 *
 * The promise pinned here is the one that makes the switch safe: migration is
 * row-for-row identical or does nothing, a hand-kept matrix is never touched,
 * and a stale generated one fails the gate.
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

/** An adopted repo with one linked, delivered requirement and one Draft. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-matrix-"));
  const dir = path.join(parent, "shop");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"shop","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/orders.js"), "module.exports = {};\n");
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  cli("new", "Totals are rounded half-up", "--project-dir", dir);
  cli("new", "Orders can be cancelled", "--project-dir", dir);
  fs.writeFileSync(path.join(dir, "test/cancel.test.js"), "// REQ-003\n");
  cli(
    "req",
    "link",
    "REQ-003",
    "--test",
    "test/cancel.test.js",
    "--code",
    "lib/orders.js",
    "--project-dir",
    dir
  );
  cli("done", "REQ-003", "--project-dir", dir);
  return { parent, dir };
}

const MATRIX = (dir) => path.join(dir, "docs/specs/traceability.md");
const rows = (md) => md.split("\n").filter((l) => l.startsWith("| REQ-"));
const norm = (l) => l.replace(/`/g, "").replace(/\| TBD \|/g, "| - |");

test("migrate turns a hand-kept matrix into a generated one, row for row", () => {
  const { parent, dir } = project();
  try {
    const before = fs.readFileSync(MATRIX(dir), "utf8");
    const r = cli("matrix", "--migrate", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /identical row for row/);

    const after = fs.readFileSync(MATRIX(dir), "utf8");
    assert.match(after, /specgate:derived/);
    assert.deepEqual(rows(after).map(norm), rows(before).map(norm));

    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.match(spec, /csda:trace status=Implemented artifact=lib\/orders\.js/);
    assert.doesNotMatch(
      spec,
      /test=test\/cancel/,
      "a test that names its requirement needs no link"
    );

    assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 0);
    assert.equal(cli("validate", dir).status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a generated matrix that no longer matches its sources fails validate", () => {
  const { parent, dir } = project();
  try {
    cli("matrix", "--migrate", "--project-dir", dir);
    fs.writeFileSync(path.join(dir, "test/totals.test.js"), "// REQ-002\n");

    const v = cli("validate", dir, "--json");
    assert.equal(v.status, 1, v.stdout + v.stderr);
    assert.match(v.stdout, /matrix_stale/);
    assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 1);

    // `check` regenerates it, so nobody runs `matrix` by hand.
    cli("check", dir);
    assert.match(fs.readFileSync(MATRIX(dir), "utf8"), /\| test\/totals\.test\.js \|/);
    assert.equal(cli("validate", dir).status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a migration that would lose a row changes nothing", () => {
  const { parent, dir } = project();
  try {
    // Two hand-written rows for one requirement, scenarios untagged: no tag
    // can say which is which, so derivation cannot reproduce them.
    const file = MATRIX(dir);
    const md = fs.readFileSync(file, "utf8");
    const extra =
      "| REQ-002 | SCN-099 | `features/elsewhere.feature` | Totals are rounded half-up | - | - | - | - | - | Draft |";
    fs.writeFileSync(file, md.replace(/(\| REQ-002 \|[^\n]*\n)/, `$1${extra}\n`));
    const specBefore = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    const matrixBefore = fs.readFileSync(file, "utf8");

    const r = cli("matrix", "--migrate", "--project-dir", dir, "--json");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /migration_not_lossless/);
    assert.equal(fs.readFileSync(file, "utf8"), matrixBefore);
    assert.equal(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), specBefore);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a hand-kept matrix is never touched by matrix, check or validate", () => {
  const { parent, dir } = project();
  try {
    const before = fs.readFileSync(MATRIX(dir), "utf8");
    const r = cli("matrix", "--project-dir", dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /keeps its matrix by hand/);
    cli("check", dir);
    cli("validate", dir);
    assert.equal(fs.readFileSync(MATRIX(dir), "utf8"), before);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
