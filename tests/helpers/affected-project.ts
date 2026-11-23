/**
 * A git project for `check --affected` (REQ-510 … REQ-516): REQ-001 and
 * REQ-002, each with a feature, a source file and a test file that name it,
 * on `main`, and a branch `work` checked out.
 *
 * Its test runner records the files it was given, one JSON line per run, in
 * `ran.log`, which git ignores.
 */
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { runCli } from "./cli";
import { git, newProject, specRequirement, write } from "./project";

const RUNNER = `const fs = require("fs");
const path = require("path");
const files = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, "ran.log"), JSON.stringify(files) + "\\n");
for (const f of files) require(path.resolve(f));
`;

/**
 * A git project on main: REQ-001 and REQ-002, each with a feature, a source
 * file and a test file that name it, the test command `node run-tests.js
 * {files}` unless told otherwise; then a branch `work`.
 */
export function project(
  opts: { testCmd?: string; extraHarness?: string; prefix?: string } = {}
): string {
  const dir = newProject(opts.prefix || "sg-affected-");
  specRequirement(dir, "REQ-001", "Place an order", "status=Approved");
  specRequirement(dir, "REQ-002", "Cancel an order", "status=Approved");
  const scenario = (req: string, scn: string, title: string, then: string) =>
    `Feature: ${title}\n\n  @${req} @${scn}\n  Scenario: ${title}\n` +
    `    Given a customer with a basket of two items\n    When they ${title.toLowerCase()}\n    Then ${then}\n`;
  write(
    dir,
    "features/orders/place.feature",
    scenario("REQ-001", "SCN-001a", "Place an order", "the order totals both items")
  );
  write(
    dir,
    "features/orders/cancel.feature",
    scenario("REQ-002", "SCN-002a", "Cancel an order", "the order is cancelled")
  );
  write(dir, "src/shared.js", "exports.total = (xs) => xs.reduce((a, b) => a + b, 0);\n");
  write(
    dir,
    "src/one.js",
    '// REQ-001: placing an order.\nconst { total } = require("./shared");\nexports.place = (xs) => total(xs);\n'
  );
  write(dir, "src/two.js", "// REQ-002: cancelling an order.\nexports.cancel = () => true;\n");
  write(
    dir,
    "test/one.test.js",
    '// REQ-001 SCN-001a\nconst { place } = require("../src/one");\nif (place([1, 2]) !== 3) process.exit(1);\n'
  );
  write(
    dir,
    "test/two.test.js",
    '// REQ-002 SCN-002a\nconst { cancel } = require("../src/two");\nif (!cancel()) process.exit(1);\n'
  );
  write(dir, "run-tests.js", RUNNER);
  write(dir, "package-lock.json", '{ "lockfileVersion": 3 }\n');
  fs.appendFileSync(path.join(dir, ".gitignore"), "\nran.log\n");
  write(
    dir,
    "harness.config.yaml",
    `harness_version: 1\ntest_cmd: "${opts.testCmd ?? "node run-tests.js {files}"}"\n${opts.extraHarness || ""}`
  );
  assert.equal(runCli(["matrix", "--project-dir", dir]).status, 0);
  assert.equal(git(dir, "init", "-q", "-b", "main").status, 0);
  git(dir, "add", "-A");
  assert.equal(git(dir, "commit", "-qm", "seed").status, 0);
  assert.equal(git(dir, "checkout", "-qb", "work").status, 0);
  return dir;
}

/** The files each run of the test command was given, in order. */
export function runs(dir: string): string[][] {
  const log = path.join(dir, "ran.log");
  if (!fs.existsSync(log)) return [];
  return fs
    .readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Append to a file of the project. */
export function edit(dir: string, rel: string, text: string): void {
  fs.appendFileSync(path.join(dir, ...rel.split("/")), text);
}
