/**
 * fast-gate: after `validate --strict`, the architecture check and the tests
 * run side by side, each with its own output (REQ-518); every stage says how
 * long it took (REQ-519).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { newProject, removeProject, write } from "../helpers/project";
import { runCli } from "../helpers/cli";

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

type Stage = { stage: string; result: string; ms: number | null; command: string | null };

/** `node stage.js <name> <ms> [fail]`: records when it started and ended, waits, prints a line. */
const STAGE = `const fs = require("fs");
const path = require("path");
const [name, wait, fail] = process.argv.slice(2);
const started = Date.now();
setTimeout(() => {
  fs.writeFileSync(path.join(__dirname, name + ".json"), JSON.stringify({ started, ended: Date.now() }));
  console.log(name + " says hello");
  process.exit(fail ? 1 : 0);
}, Number(wait));
`;

function project(harness: string): string {
  const dir = newProject("sg-parallel-");
  write(dir, "stage.js", STAGE);
  write(dir, "harness.config.yaml", `harness_version: 1\n${harness}`);
  return dir;
}

const span = (dir: string, name: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8")) as {
    started: number;
    ended: number;
  };

test("REQ-518 SCN-518a: two stages of one second each run side by side, and one after the other with gate_parallel: false", () => {
  const dir = project(
    'arch_cmd: "node stage.js arch 1000"\ntest_cmd: "node stage.js tests 1000"\n'
  );
  try {
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const stages: Stage[] = json(r).stages;
    assert.equal(stages.find((s) => s.stage === "architecture")?.result, "passed");
    assert.equal(stages.find((s) => s.stage === "tests")?.result, "passed");
    const arch = span(dir, "arch");
    const tests = span(dir, "tests");
    assert.ok(
      arch.started < tests.ended && tests.started < arch.ended,
      `they overlapped: arch ${JSON.stringify(arch)}, tests ${JSON.stringify(tests)}`
    );

    fs.appendFileSync(path.join(dir, "harness.config.yaml"), "gate_parallel: false\n");
    const seq = runCli(["check", dir, "--json"]);
    assert.equal(seq.status, 0, seq.stdout + seq.stderr);
    const arch2 = span(dir, "arch");
    const tests2 = span(dir, "tests");
    assert.ok(arch2.ended <= tests2.started, "the tests started after the architecture ended");
  } finally {
    removeProject(dir);
  }
});

test("REQ-518: the architecture fails beside passing tests — both reported, each with its own output, the gate failed", () => {
  const dir = project(
    'arch_cmd: "node stage.js arch 300 fail"\ntest_cmd: "node stage.js tests 300"\n'
  );
  try {
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const doc = json(r);
    assert.equal(doc.status[0].code, "check_arch_failed");
    const stages: Stage[] = doc.stages;
    assert.equal(stages.find((s) => s.stage === "architecture")?.result, "failed");
    assert.equal(stages.find((s) => s.stage === "tests")?.result, "passed");

    const human = runCli(["check", dir]);
    assert.equal(human.status, 1);
    assert.match(human.stdout, /✖\s+Architecture\s+node stage\.js arch 300 fail/);
    assert.match(human.stdout, /✔\s+Tests\s+node stage\.js tests 300/);
    assert.match(human.stdout, /arch says hello/, "the failing stage's output is shown");
    assert.doesNotMatch(human.stdout, /tests says hello/, "a passing stage's output is not");
  } finally {
    removeProject(dir);
  }
});

test("REQ-518: validate fails first — neither the architecture check nor the tests run", () => {
  const dir = project('arch_cmd: "node stage.js arch 10"\ntest_cmd: "node stage.js tests 10"\n');
  try {
    fs.appendFileSync(
      path.join(dir, "spec.md"),
      "\n## REQ-001 — Place an order\n\nThe system SHALL place an order.\n\n<!-- specgate:trace status=Approved -->\n"
    );
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const stages: Stage[] = json(r).stages;
    assert.equal(stages.find((s) => s.stage === "validate")?.result, "failed");
    assert.equal(stages.find((s) => s.stage === "architecture")?.result, "not run");
    assert.equal(stages.find((s) => s.stage === "tests")?.result, "not run");
    assert.equal(fs.existsSync(path.join(dir, "arch.json")), false);
    assert.equal(fs.existsSync(path.join(dir, "tests.json")), false);
  } finally {
    removeProject(dir);
  }
});

test("REQ-519 SCN-519a: each stage says how long it took — null for one that did not run — and the last result keeps it", () => {
  const dir = project('test_cmd: "node stage.js tests 250"\n');
  try {
    const r = runCli(["check", dir, "--json"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const stages: Stage[] = json(r).stages;
    const of = (name: string) => stages.find((s) => s.stage === name) as Stage;
    assert.ok(typeof of("validate").ms === "number" && (of("validate").ms as number) >= 0);
    assert.ok((of("tests").ms as number) >= 250, `tests took ${of("tests").ms} ms`);
    assert.equal(of("architecture").ms, null);
    assert.ok(typeof of("ids").ms === "number");

    const last = json(runCli(["check", "--last", "--json", dir]));
    assert.deepEqual(
      last.lastCheck.stages.map((s: Stage) => [s.stage, s.ms]),
      stages.map((s) => [s.stage, s.ms])
    );
  } finally {
    removeProject(dir);
  }
});
