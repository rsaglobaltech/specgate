"use strict";

/**
 * One front door, two engines (ADR-0033): `specgate init --forja` and
 * `specgate add` hand the work to forja, with a fake forja here that records
 * what it was asked.
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
const { forjaCommand, FORJA_PACKAGE } = require(
  path.join(ROOT_DIR, "dist/scripts/cli/commands/project/Forja")
);

/** A fake forja: writes its argv and cwd to `log`, exits with `code`. */
function fakeForja(dir, code = 0) {
  const script = path.join(dir, "fake-forja.js");
  const log = path.join(dir, "forja.log");
  fs.writeFileSync(
    script,
    `require("fs").writeFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));\n` +
      `process.exit(${code});\n`
  );
  return {
    env: { ...process.env, SPECGATE_FORJA_CMD: `"${process.execPath}" "${script}"` },
    calls: () => (fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : null),
  };
}

function run(cwd, env, ...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, env, encoding: "utf8" });
}

function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-forja-")));
}

test("forja is fetched with npx at a pinned major, unless SPECGATE_FORJA_CMD says otherwise", () => {
  assert.equal(forjaCommand({}), `npx --yes ${FORJA_PACKAGE}@1`);
  assert.equal(forjaCommand({ SPECGATE_FORJA_CMD: " forja " }), "forja");
});

test("init --forja hands its name and flags to forja init", () => {
  const dir = tmp();
  try {
    const forja = fakeForja(dir);
    const r = run(dir, forja.env, "init", "--forja", "shop", "--backend", "spring");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(forja.calls().argv, ["init", "shop", "--backend", "spring"]);
    assert.equal(forja.calls().cwd, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("init --forja exits with forja's code", () => {
  const dir = tmp();
  try {
    const r = run(dir, fakeForja(dir, 3).env, "init", "--forja", "shop");
    assert.equal(r.status, 3, r.stdout + r.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("add runs forja add, from anywhere inside a forja project", () => {
  const dir = tmp();
  try {
    fs.writeFileSync(path.join(dir, "forja.config.json"), "{}");
    const sub = path.join(dir, "packages", "core");
    fs.mkdirSync(sub, { recursive: true });
    const forja = fakeForja(dir);
    const r = run(sub, forja.env, "add", "usecase", "orders/PlaceOrder", "--req", "REQ-001");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(forja.calls().argv, [
      "add",
      "usecase",
      "orders/PlaceOrder",
      "--req",
      "REQ-001",
    ]);
    assert.equal(forja.calls().cwd, sub);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("add outside a forja project says what to do instead, and runs nothing", () => {
  const dir = tmp();
  try {
    const forja = fakeForja(dir);
    const r = run(dir, forja.env, "add", "usecase", "orders/PlaceOrder", "--json");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    assert.equal(doc.status[0].code, "add_needs_forja");
    assert.match(doc.status[0].fix, /specgate new/);
    assert.equal(forja.calls(), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("add refuses a kind forja does not have", () => {
  const dir = tmp();
  try {
    fs.writeFileSync(path.join(dir, "forja.config.json"), "{}");
    const r = run(dir, fakeForja(dir).env, "add", "controller", "orders/X");
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /add_kind_unknown/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("add --json is one document, with forja's output inside it", () => {
  const dir = tmp();
  try {
    fs.writeFileSync(path.join(dir, "forja.config.json"), "{}");
    const forja = fakeForja(dir);
    const r = run(dir, forja.env, "add", "entity", "orders/Order", "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.deepEqual(doc.add.args, ["add", "entity", "orders/Order"]);
    assert.deepEqual(forja.calls().argv, ["add", "entity", "orders/Order"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("in a forja project, status names the use case to add for the next requirement", () => {
  const { nextCommandPlain, forjaAddCommand } = require(
    path.join(ROOT_DIR, "dist/scripts/cli/commands/spec/StatusCommand")
  );
  const todo = {
    requirement: "REQ-004",
    category: "NEEDS_EVERYTHING",
    featureFile: "features/place-an-order.feature",
  };
  assert.equal(forjaAddCommand(todo), "specgate add usecase <module>/PlaceAnOrder --req REQ-004");
  const summary = { items: [todo], counts: { total: 1 }, orphans: [], derived: true };
  assert.equal(nextCommandPlain({ ...summary, forja: true }), forjaAddCommand(todo));
  assert.equal(nextCommandPlain({ ...summary, forja: false }), "specgate apply REQ-004");

  const dir = tmp();
  try {
    const app = path.join(dir, "app");
    fs.mkdirSync(path.join(app, "lib"), { recursive: true });
    fs.writeFileSync(path.join(app, "package.json"), '{"name":"a","version":"1.0.0"}');
    fs.writeFileSync(path.join(app, "lib/index.js"), "");
    assert.equal(
      run(dir, process.env, "adopt", "--project-dir", app, "--no-capabilities").status,
      0
    );
    fs.writeFileSync(path.join(app, "forja.config.json"), "{}");
    assert.equal(run(app, process.env, "new", "Place an order").status, 0);
    const r = run(app, process.env, "status", "--json");
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    assert.match(JSON.stringify(doc), /specgate add usecase <module>\/PlaceAnOrder --req REQ-\d+/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
