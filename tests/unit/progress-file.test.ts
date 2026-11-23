"use strict";

/**
 * REQ-654 — a command that takes time tells how far it is: with
 * SPECGATE_PROGRESS_FILE set, `apply` and `check` write one JSON line per
 * stage as it starts and as it ends, each running stage naming the file its
 * output goes to as it is written, so a studio can show the stage and the
 * line it is on.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { runCli, cli } from "../helpers/cli";

const FEATURE = `Feature: Health

  Scenario: SCN-001 the service reports healthy
    Given the service is running
    When health is requested
    Then it reports healthy
`;

function project(t: any, testPasses = true) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-progress-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const r = cli("init", "--yes", "--out", parent, "--no-git", "--no-sample-req");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(parent, "my-spec-driven-app");
  fs.mkdirSync(path.join(dir, "features/core"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "features/core/health.feature"), FEATURE);
  fs.writeFileSync(path.join(dir, "src/health.js"), "export const h = () => 'healthy';\n");
  fs.writeFileSync(
    path.join(dir, "tests/health.test.js"),
    `// SCN-001 the service reports healthy\nconsole.log("health › reports healthy");\nprocess.exit(${testPasses ? 0 : 1});\n`
  );
  fs.appendFileSync(
    path.join(dir, "docs/specs/traceability.md"),
    "\n| REQ-001 | SCN-001 | `features/core/health.feature` | UC-001 Health | - | - | - |" +
      " src/health.js | tests/health.test.js | Draft |\n"
  );
  const progress = path.join(parent, "progress.jsonl");
  return { dir, progress };
}

const lines = (file: string) =>
  fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l: string) => JSON.parse(l));

test("REQ-654 SCN-654a: apply tells each stage as it starts and ends, the tests' output in their log", (t: any) => {
  const { dir, progress } = project(t);
  const r = runCli(
    [
      "apply",
      "REQ-001",
      "--strict",
      "--project-dir",
      dir,
      "--test-cmd",
      "node tests/health.test.js",
      "--json",
    ],
    { env: { ...process.env, SPECGATE_PROGRESS_FILE: progress } }
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const events = lines(progress);
  assert.deepEqual(
    events.map((e: any) => `${e.stage}:${e.state}`),
    ["validate:running", "validate:passed", "tests:running", "tests:passed"]
  );
  const tests = events.find((e: any) => e.stage === "tests" && e.state === "running");
  assert.equal(typeof tests.log, "string");
  assert.match(fs.readFileSync(tests.log, "utf8"), /health › reports healthy/);
  assert.ok(events.every((e: any) => typeof e.at === "number"));
});

test("REQ-654 SCN-654b: a failing stage ends failed, and apply still answers its evidence", (t: any) => {
  const { dir, progress } = project(t, false);
  const r = runCli(
    [
      "apply",
      "REQ-001",
      "--strict",
      "--project-dir",
      dir,
      "--test-cmd",
      "node tests/health.test.js",
      "--json",
    ],
    { env: { ...process.env, SPECGATE_PROGRESS_FILE: progress } }
  );
  assert.notEqual(r.status, 0);
  const events = lines(progress);
  assert.deepEqual(
    events.slice(-1).map((e: any) => `${e.stage}:${e.state}`),
    ["tests:failed"]
  );
  assert.match(r.stdout + r.stderr, /done_tests_failed|tests? failed|exit/i);
});

test("REQ-654 SCN-654c: check tells its stages, validate first and the tests last", (t: any) => {
  const { dir, progress } = project(t);
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    'harness_version: 1\ntest_cmd: "node tests/health.test.js"\n'
  );
  runCli(["check", dir], { env: { ...process.env, SPECGATE_PROGRESS_FILE: progress } });
  const events = lines(progress);
  const stages = events.map((e: any) => `${e.stage}:${e.state}`);
  assert.ok(stages.includes("validate:running"), stages.join(" "));
  assert.ok(
    stages.some((s: string) => /^validate:(passed|failed)$/.test(s)),
    stages.join(" ")
  );
  assert.ok(stages.includes("tests:running"), stages.join(" "));
  assert.ok(
    stages.some((s: string) => /^tests:(passed|failed)$/.test(s)),
    stages.join(" ")
  );
  assert.ok(stages.indexOf("validate:running") < stages.indexOf("tests:running"));
});

test("REQ-654: without SPECGATE_PROGRESS_FILE nothing is written", (t: any) => {
  const { dir, progress } = project(t);
  const env = { ...process.env };
  delete env.SPECGATE_PROGRESS_FILE;
  runCli(
    [
      "apply",
      "REQ-001",
      "--strict",
      "--project-dir",
      dir,
      "--test-cmd",
      "node tests/health.test.js",
      "--json",
    ],
    { env }
  );
  assert.equal(fs.existsSync(progress), false);
});
