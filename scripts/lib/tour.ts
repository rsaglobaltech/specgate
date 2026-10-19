import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { findCliRoot } from "./project-root";

/**
 * `specgate onboard --tour` (ADR-0037): the daily loop, run for real, on a copy.
 *
 * The person's repository is copied to a temporary directory — or, when it has
 * no Node test setup to run a sample test with, a small sample project is made
 * there — and the four verbs and `check` run on it, each narrated with what it
 * proved. The repository itself is never written. If the copy's gate is red for
 * reasons of its own, the tour says so and runs on the sample instead.
 */

export interface TourStep {
  verb: string;
  command: string;
  ok: boolean;
  proved: string;
  output?: string;
}

export interface Tour {
  on: "copy" | "sample";
  /** Why the copy was not used, when it was not. */
  fallback?: string;
  steps: TourStep[];
  ok: boolean;
}

const SKIP = new Set([".git", "node_modules", "dist", "build", "target", "coverage", ".harness"]);
const TEST_FILE = "test/specgate-tour.test.js";
const TEST_CMD = `node --test ${TEST_FILE}`;
const CHANGE = "tour-greeting";

function cli(dir: string, ...args: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(findCliRoot(__dirname), "bin", "specgate.js"), ...args],
    { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", SPECGATE_PET: "0" } }
  );
}

function sample(dir: string): void {
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"tour-sample","version":"1.0.0","private":true}\n'
  );
  fs.writeFileSync(path.join(dir, "lib", "index.js"), "module.exports = {};\n");
}

function loop(dir: string): TourStep[] {
  const steps: TourStep[] = [];
  const step = (verb: string, args: string[], proved: (out: string) => string) => {
    const r = cli(dir, ...args);
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    const ok = r.status === 0;
    steps.push({
      verb,
      command: `specgate ${args.join(" ")}`,
      ok,
      proved: ok ? proved(r.stdout || "") : "",
      ...(ok ? {} : { output: out.trim().split("\n").slice(-12).join("\n") }),
    });
    return ok ? r.stdout || "" : null;
  };

  if (!fs.existsSync(path.join(dir, "spec.md"))) {
    if (step("init", ["init"], () => "adopted the code as it is, touching none of it") === null) {
      return steps;
    }
  }
  const proposed = step("propose", ["propose", CHANGE, "--capability", "tour", "--json"], (out) => {
    const range = JSON.parse(out.slice(out.indexOf("{"))).change.reqRange;
    return `a change with a delta to write, and ${range[0]}…${range[1]} reserved for it alone`;
  });
  if (proposed === null) return steps;
  const id = JSON.parse(proposed.slice(proposed.indexOf("{"))).change.reqRange[0];
  const scn = `SCN-${id.slice(4)}a`;

  fs.writeFileSync(
    path.join(dir, "docs/specs/changes", CHANGE, "specs/tour/spec.md"),
    `# Delta — tour\n\n## ADDED Requirements\n\n` +
      `### Requirement: ${id} — Greet a person by name\n\n` +
      `The system SHALL greet a person by the name they give.\n\n` +
      `#### Scenario: ${scn} — Ada is greeted\n\n` +
      `- GIVEN a person named Ada\n- WHEN the greeting is asked for\n- THEN it reads "Hello, Ada"\n\n` +
      `<!-- specgate:trace kind=functional actor=Visitor -->\n`
  );
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "lib", "specgate-tour-greet.js"),
    "module.exports = (name) => `Hello, ${name}`;\n"
  );
  fs.writeFileSync(
    path.join(dir, TEST_FILE),
    `// ${id} ${scn} — naming the requirement and its scenario is the link.\n` +
      'const test = require("node:test");\nconst assert = require("node:assert");\n' +
      'test("Ada is greeted", () => assert.equal(require("../lib/specgate-tour-greet")("Ada"), "Hello, Ada"));\n'
  );
  steps.push({
    verb: "write",
    command: `docs/specs/changes/${CHANGE}/specs/tour/spec.md, ${TEST_FILE}, lib/specgate-tour-greet.js`,
    ok: true,
    proved: `${id} and its scenario in the delta, a test that names them, and the code`,
  });

  if (
    step("status", ["status"], () => `${id} is listed while its change is open — in flight`) ===
    null
  ) {
    return steps;
  }
  if (
    step(
      "apply",
      ["apply", id, "--test-cmd", TEST_CMD],
      () => `the gate passed for ${id} — specification, then the test — so it is Implemented`
    ) === null
  ) {
    return steps;
  }
  if (
    step(
      "archive",
      ["archive", CHANGE],
      () =>
        "every requirement of the change delivered: merged into the specs, with its feature file"
    ) === null
  ) {
    return steps;
  }
  step("check", ["check", "--test-cmd", TEST_CMD], () => "the whole gate, as CI runs it, is green");
  return steps;
}

export function runTour(projectDir: string): Tour {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-tour-"));
  try {
    const hasNode = fs.existsSync(path.join(projectDir, "package.json"));
    if (hasNode) {
      const copy = path.join(root, "copy");
      fs.cpSync(projectDir, copy, {
        recursive: true,
        filter: (src) => !SKIP.has(path.basename(src)),
      });
      const steps = loop(copy);
      if (steps.every((s) => s.ok)) return { on: "copy", steps, ok: true };
      const failed = steps.find((s) => !s.ok)!;
      const fallback = `on a copy of this repository, \`${failed.command}\` failed for reasons of its own`;
      const again = path.join(root, "sample");
      fs.mkdirSync(again);
      sample(again);
      const sampleSteps = loop(again);
      return { on: "sample", fallback, steps: sampleSteps, ok: sampleSteps.every((s) => s.ok) };
    }
    const dir = path.join(root, "sample");
    fs.mkdirSync(dir);
    sample(dir);
    const steps = loop(dir);
    return {
      on: "sample",
      fallback: "this repository has no package.json to run a sample test with",
      steps,
      ok: steps.every((s) => s.ok),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
