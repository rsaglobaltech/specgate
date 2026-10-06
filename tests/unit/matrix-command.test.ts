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
  assert.equal(cli("adopt", "--project-dir", dir, "--keep-matrix", "--no-capabilities").status, 0);
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

// ── 3B: on a generated matrix, commands write the sources ────────────────────

function derived() {
  const p = project();
  assert.equal(cli("matrix", "--migrate", "--project-dir", p.dir).status, 0);
  return p;
}
const row = (dir, id) =>
  fs
    .readFileSync(MATRIX(dir), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`| ${id} |`)) || "";

test("done writes the status into spec.md, where regeneration reads it", () => {
  const { parent, dir } = derived();
  try {
    assert.equal(cli("done", "REQ-002", "--status", "Verified", "--project-dir", dir).status, 0);
    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), /csda:trace status=Verified/);
    assert.match(row(dir, "REQ-002"), /\| Verified \|$/);
    assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 0, "nothing left stale");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("req link and req add keep their fields across a regeneration", () => {
  const { parent, dir } = derived();
  try {
    cli("req", "link", "REQ-002", "--code", "lib/orders.js", "--project-dir", dir);
    cli(
      "req",
      "add",
      "Refunds are logged",
      "--feature",
      "features/refunds.feature",
      "--project-dir",
      dir
    );
    cli("matrix", "--project-dir", dir);

    assert.match(row(dir, "REQ-002"), /`lib\/orders\.js`/);
    const added = row(dir, "REQ-004");
    assert.match(added, /`features\/refunds\.feature`/);
    assert.match(added, /\| SCN-004 \|/, "the scenario id it reserved is kept");

    cli("new", "Coupons expire", "--project-dir", dir);
    assert.match(row(dir, "REQ-005"), /\| SCN-005 \|/, "and not reserved twice");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("fix has nothing to edit in a generated matrix", () => {
  const { parent, dir } = derived();
  try {
    const before = fs.readFileSync(MATRIX(dir), "utf8");
    const r = cli("fix", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /matrix is generated/);
    assert.equal(fs.readFileSync(MATRIX(dir), "utf8"), before);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── 3C: generated by default ─────────────────────────────────────────────────

test("a new adoption starts with a generated matrix, and the loop needs no req link", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-default-"));
  const dir = path.join(parent, "shop");
  try {
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"shop","version":"1.0.0"}');
    assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
    assert.match(fs.readFileSync(MATRIX(dir), "utf8"), /specgate:derived/);

    // new → a test that names it → done --strict, and nothing else.
    cli("new", "Totals are rounded half-up", "--project-dir", dir);
    const feature = path.join(dir, "features/totals-are-rounded-half-up.feature");
    fs.writeFileSync(
      feature,
      fs
        .readFileSync(feature, "utf8")
        .replace("<the state before the action>", "an order totalling 10.005 EUR")
        .replace("<the action under test>", "the total is computed")
        .replace("<the observable outcome>", "the total is 10.01 EUR")
    );
    fs.writeFileSync(path.join(dir, "test/totals.test.js"), "// REQ-002 SCN-002\n");
    const done = cli("done", "REQ-002", "--strict", "--project-dir", dir);
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.match(row(dir, "REQ-002"), /\| test\/totals\.test\.js \| Implemented \|$/);
    assert.equal(cli("validate", dir, "--strict").status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--keep-matrix keeps a hand-maintained matrix", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-keep-"));
  const dir = path.join(parent, "shop");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"shop","version":"1.0.0"}');
    assert.equal(cli("adopt", "--project-dir", dir, "--keep-matrix").status, 0);
    assert.doesNotMatch(fs.readFileSync(MATRIX(dir), "utf8"), /specgate:derived/);

    const scaffold = cli("init", "--yes", "--out", parent, "--no-git");
    assert.equal(scaffold.status, 0, scaffold.stdout + scaffold.stderr);
    const project = fs.readdirSync(parent).find((d) => d !== "shop");
    assert.match(fs.readFileSync(MATRIX(path.join(parent, project)), "utf8"), /specgate:derived/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
