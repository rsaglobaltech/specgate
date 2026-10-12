"use strict";

/**
 * Guard: one Node floor, declared consistently.
 *
 * The floor is stated in a dozen places — the root `engines`, three
 * publishable packages, the CI matrix, every workflow's `setup-node`, the
 * Dockerfile, the CI templates handed to users, and the prose in README and
 * the guides. They drifted before: the packages said `>=18` while the root said
 * `>=20`, and the docs said 18 in one place long after the package required 20.
 *
 * A floor that only some of those agree on is not a floor. `cucumber` sat
 * parked for a release because its `engines` wanted 22 while ours said 20, so
 * the cost of a stale declaration here is real.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const read = (rel) => fs.readFileSync(path.join(ROOT_DIR, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

/** The single source of truth. Everything else is checked against it. */
const FLOOR = 22;

test("the root package declares the floor", () => {
  assert.equal(json("package.json").engines.node, `>=${FLOOR}`);
});

test("every publishable package declares the same floor", () => {
  // A package saying >=18 while the CLI needs 22 is a promise it cannot keep.
  const pkgs = fs
    .readdirSync(path.join(ROOT_DIR, "packages"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `packages/${e.name}/package.json`)
    .filter((rel) => fs.existsSync(path.join(ROOT_DIR, rel)));

  assert.ok(pkgs.length > 0, "no packages found");
  for (const rel of pkgs) {
    const engines = json(rel).engines;
    if (!engines || !engines.node) continue;
    assert.equal(engines.node, `>=${FLOOR}`, `${rel} declares ${engines.node}`);
  }
});

test("no workflow pins a Node older than the floor", () => {
  const dir = path.join(ROOT_DIR, ".github", "workflows");
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".yml"))) {
    const content = fs.readFileSync(path.join(dir, name), "utf8");
    for (const m of content.matchAll(/node-version:\s*['"]?(\d+)/g)) {
      assert.ok(
        Number(m[1]) >= FLOOR,
        `.github/workflows/${name} pins Node ${m[1]}, below the ${FLOOR} floor`
      );
    }
    for (const m of content.matchAll(/node:\s*\[([^\]]+)\]/g)) {
      for (const v of m[1].match(/\d+/g) || []) {
        assert.ok(
          Number(v) >= FLOOR,
          `.github/workflows/${name} tests Node ${v}, below the ${FLOOR} floor`
        );
      }
    }
  }
});

test("the CI matrix covers the floor itself", () => {
  // Testing only newer runtimes proves the floor compiles, not that it runs.
  const ci = read(".github/workflows/ci.yml");
  const matrix = /node:\s*\[([^\]]+)\]/.exec(ci);
  assert.ok(matrix, "ci.yml declares no node matrix");
  const versions = (matrix[1].match(/\d+/g) || []).map(Number);
  assert.ok(versions.includes(FLOOR), `matrix ${versions.join(", ")} omits the floor`);
});

test("the Docker image is built on the floor", () => {
  for (const m of read("Dockerfile.cli").matchAll(/FROM node:(\d+)/g)) {
    assert.ok(Number(m[1]) >= FLOOR, `Dockerfile.cli uses node:${m[1]}`);
  }
});

test("the CI templates handed to users do not pin an unsupported Node", () => {
  // These generate a pipeline that runs specgate, so anything below the floor
  // produces a gate that cannot start.
  const dir = path.join(ROOT_DIR, "templates");
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tpl")) {
        const content = fs.readFileSync(full, "utf8");
        const rel = path.relative(ROOT_DIR, full).split(path.sep).join("/");
        for (const m of content.matchAll(/node-version:\s*['"]?(\d+)/g)) {
          assert.ok(Number(m[1]) >= FLOOR, `${rel} pins Node ${m[1]}`);
        }
        for (const m of content.matchAll(/node:(\d+)/g)) {
          assert.ok(Number(m[1]) >= FLOOR, `${rel} uses node:${m[1]}`);
        }
        for (const m of content.matchAll(/versionSpec:\s*['"](\d+)\.x/g)) {
          assert.ok(Number(m[1]) >= FLOOR, `${rel} pins versionSpec ${m[1]}.x`);
        }
      }
    }
  };
  walk(dir);
});

test("the prose agrees with the package", () => {
  for (const rel of ["README.md", "CONTRIBUTING.md", "docs/quickstart.md", "docs/how-to.md"]) {
    const content = read(rel);
    for (const m of content.matchAll(/Node(?:\.js)?\s*≥\s*(\d+)/g)) {
      assert.equal(Number(m[1]), FLOOR, `${rel} claims Node ≥ ${m[1]}`);
    }
  }
});

test("cucumber's own floor is satisfied by ours", () => {
  // The concrete reason the floor moved: cucumber 13 requires 22, and it sat
  // parked for a release while the declared floor was 20.
  const engines = json("node_modules/@cucumber/cucumber/package.json").engines;
  if (!engines || !engines.node) return;
  const lowest = Math.min(...(engines.node.match(/\d+/g) || []).map(Number));
  assert.ok(FLOOR >= lowest, `cucumber wants Node >= ${lowest}, our floor is ${FLOOR}`);
});
