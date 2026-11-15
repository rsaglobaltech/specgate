"use strict";

/**
 * REQ-568, REQ-569 — the public surface frozen at a release, and what may
 * change in it: additions in a minor, removals only in a major and only after
 * a deprecation (change semver-contract).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const { judge } = require("../../scripts/semver/contract-check");
const { apiItems, flagsOf, jsonPaths } = require("../../scripts/semver/surface");

const base = {
  version: "1.0.0",
  items: ["command:status", "flag:status --json", "json:status total:number"],
};

test("REQ-568 SCN-568a: a flag removed in a minor fails", () => {
  const j = judge(base, ["command:status", "json:status total:number"], [], "1.1.0");
  assert.deepEqual(j.removed, ["flag:status --json"]);
  assert.equal(j.errors.length, 1);
  assert.match(
    j.errors[0],
    /flag:status --json is gone: removing from the public surface waits for 2\.0\.0/
  );
});

test("REQ-568: a key whose type changes is a removal", () => {
  const j = judge(
    base,
    ["command:status", "flag:status --json", "json:status total:string"],
    [],
    "1.1.0"
  );
  assert.deepEqual(j.removed, ["json:status total:number"]);
  assert.deepEqual(j.added, ["json:status total:string"]);
  assert.equal(j.errors.length, 1);
});

test("REQ-568: an addition passes, and asks for a minor at release", () => {
  const more = [...base.items, "flag:status --short"];
  assert.deepEqual(judge(base, more, [], "1.0.0").errors, []);
  assert.deepEqual(judge(base, more, [], "1.1.0", "1.1.0").errors, []);
  const patch = judge(base, more, [], "1.0.1", "1.0.1");
  assert.match(patch.errors.join("\n"), /1\.0\.1 adds 1 item\(s\).*at least 1\.1\.0/);
});

test("REQ-569 SCN-569a: a removal in a major, after a deprecation", () => {
  const without = ["command:status", "json:status total:number"];
  const dep = [{ item: "flag:status --json", since: "1.4.0", use: "--format json" }];
  assert.deepEqual(
    judge(base, without, dep, "2.0.0").errors,
    [],
    "deprecated, then removed in 2.0"
  );
  assert.match(
    judge(base, without, [], "2.0.0").errors.join("\n"),
    /without a deprecation/,
    "a major still needs the deprecation first"
  );
  const still = judge(base, base.items, dep, "1.4.0");
  assert.deepEqual(still.errors, []);
  assert.equal(
    still.deprecated[0].item,
    "flag:status --json",
    "a deprecated item still here is said"
  );
});

test("REQ-568: the surface is read from what the CLI and the API say", () => {
  assert.deepEqual(
    flagsOf(
      "Usage: specgate apply [<REQ>] [--no-check] [--test-cmd <cmd>]\n  --json   JSON\n  --help"
    ).sort(),
    ["--json", "--no-check", "--test-cmd"]
  );
  assert.deepEqual(jsonPaths({ total: 2, items: [{ id: "a", at: null }], next: null }).sort(), [
    "items:array",
    "items[].at",
    "items[].id:string",
    "items[]:object",
    "next",
    "total:number",
  ]);
  assert.deepEqual(
    apiItems(
      'export declare const API_VERSION: "1.0.0";\nexport interface StatusAnswer {\n  total: number;\n  readonly next?: string;\n}\n'
    ).sort(),
    ["api:API_VERSION", "api:StatusAnswer", "api:StatusAnswer.next", "api:StatusAnswer.total"]
  );
});

test("REQ-568: the frozen surface and the deprecations are committed", () => {
  const frozen = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "contract", "surface.json"), "utf8")
  );
  assert.match(frozen.version, /^\d+\.\d+\.\d+/);
  assert.ok(frozen.items.length > 1000);
  assert.deepEqual([...frozen.items].sort(), frozen.items, "sorted, so a diff reads");
  assert.ok(
    Array.isArray(
      JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "contract", "deprecations.json"), "utf8"))
    )
  );
});
