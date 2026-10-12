"use strict";

/**
 * Guard: the licence policy gate must actually reject something.
 *
 * A gate nobody has watched fail is decorative — this repository already
 * shipped one, `c8` without `--check-coverage`, whose thresholds meant
 * nothing for months. So these tests assert the failing path first, and the
 * real dependency tree second.
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
const SCRIPT = path.join(ROOT_DIR, "dist", "scripts", "license_check.js");
const { isAllowed, licenseOf, summarise } = require(SCRIPT);

function bomWith(components) {
  return { bomFormat: "CycloneDX", specVersion: "1.5", components };
}

function runOn(bom, ...extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-lic-"));
  const file = path.join(tmp, "sbom.json");
  fs.writeFileSync(file, JSON.stringify(bom), "utf8");
  try {
    return spawnSync(process.execPath, [SCRIPT, "--sbom", file, ...extra], { encoding: "utf8" });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("a copyleft licence fails the gate and is named in the output", () => {
  const r = runOn(
    bomWith([
      { name: "fine", version: "1.0.0", licenses: [{ license: { id: "MIT" } }] },
      { name: "evil", version: "2.0.0", licenses: [{ license: { id: "AGPL-3.0-only" } }] },
    ])
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /evil@2\.0\.0/);
  assert.match(r.stderr, /AGPL-3\.0-only/);
  // Every diagnostic in this project ships a fix.
  assert.match(r.stderr, /Fix:/);
});

test("a component with no declared licence fails rather than passing by omission", () => {
  const r = runOn(bomWith([{ name: "silent", version: "1.0.0" }]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /UNKNOWN/);
});

test("an all-permissive tree passes", () => {
  const r = runOn(
    bomWith([
      { name: "a", version: "1.0.0", licenses: [{ license: { id: "MIT" } }] },
      { name: "b", version: "1.0.0", licenses: [{ license: { id: "Apache-2.0" } }] },
      { name: "c", version: "1.0.0", licenses: [{ license: { id: "ISC" } }] },
    ])
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Components: 3/);
});

test("OR takes either side, AND requires every term", () => {
  // "MIT OR CC0-1.0" is MIT-available, so rejecting it would be wrong.
  assert.equal(isAllowed("(MIT OR CC0-1.0)"), true);
  assert.equal(isAllowed("MIT AND Apache-2.0"), true);
  assert.equal(isAllowed("MIT AND AGPL-3.0-only"), false);
  assert.equal(isAllowed("AGPL-3.0-only"), false);
  assert.equal(isAllowed("UNKNOWN"), false);
});

test("licenseOf reads both the id form and an SPDX expression", () => {
  assert.equal(licenseOf({ licenses: [{ license: { id: "MIT" } }] }), "MIT");
  assert.equal(licenseOf({ licenses: [{ license: { name: "Python-2.0" } }] }), "Python-2.0");
  assert.equal(licenseOf({ licenses: [{ expression: "MIT OR CC0-1.0" }] }), "MIT OR CC0-1.0");
  assert.equal(licenseOf({}), "UNKNOWN");
});

test("summarise groups by licence, most common first", () => {
  const result = summarise([
    { name: "a", version: "1", licenses: [{ license: { id: "MIT" } }] },
    { name: "b", version: "1", licenses: [{ license: { id: "MIT" } }] },
    { name: "c", version: "1", licenses: [{ license: { id: "ISC" } }] },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.table[0].license, "MIT");
  assert.equal(result.table[0].count, 2);
  assert.equal(result.violations.length, 0);
});

test("no SBOM at all is a usage error, not a silent pass", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "--sbom", "/nonexistent/sbom.json"], {
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
});
