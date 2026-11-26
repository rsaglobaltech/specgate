/**
 * The gate's policy (change `gate-policy`, issue #494): `.specgate/gate.yaml`
 * says, rule by rule, whether the gate fails, reports or skips — from a
 * preset, with a date from which the errors count.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { TestContext } from "node:test";
import {
  gatePolicyTemplate,
  levelOf,
  parseGatePolicy,
  readGatePolicy,
} from "../../scripts/lib/gate-policy";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}
function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}

/**
 * A Node project with REQ-002 Implemented and no test that names it: a
 * `strict_tdd_1` finding, the only one, under `validate --strict`.
 */
function project(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-policy-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", version: "1.0.0", scripts: { test: "node --test" } })
  );
  git(dir, "init", "-q");
  const init = run(dir, ["init", "--no-agents", "--no-ci", "--yes"]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  fs.rmSync(path.join(dir, ".specgate", "gate.yaml"), { force: true });
  assert.equal(run(dir, ["new", "A customer can cancel an order before it ships"]).status, 0);
  const feature = fs
    .readdirSync(path.join(dir, "features"))
    .find((f) => f.startsWith("a-customer-can-cancel"))!;
  fs.writeFileSync(
    path.join(dir, "features", feature),
    [
      "Feature: A customer can cancel an order before it ships",
      "",
      "  @REQ-002 @SCN-002",
      "  Scenario: Ana cancels an order that has not shipped",
      '    Given Ana has order 1001 with status "paid"',
      "    When Ana cancels order 1001",
      '    Then order 1001 has status "cancelled"',
      "",
    ].join("\n")
  );
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "The system MUST satisfy: A customer can cancel an order before it ships.",
        'The system SHALL let a customer cancel an order whose status is not "shipped".'
      )
      .replace(/\n> Written by Specgate[^\n]*\n/g, "\n")
  );
  assert.equal(run(dir, ["apply", "REQ-002", "--no-check"]).status, 0);
  assert.equal(run(dir, ["matrix"]).status, 0);
  return dir;
}
const policy = (dir: string, text: string) => {
  fs.mkdirSync(path.join(dir, ".specgate"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".specgate", "gate.yaml"), text);
};
const statusOf = (stdout: string) =>
  (
    JSON.parse(stdout.slice(stdout.indexOf("{"))).status as Array<{
      code: string;
      severity: string;
    }>
  ).map((d) => `${d.code}/${d.severity}`);

// ── REQ-604 ───────────────────────────────────────────────────────────────────

test("REQ-604 SCN-604a: a preset and an override", () => {
  const p = parseGatePolicy("preset: standard\nrules:\n  links: off\n");
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.rules, {
    tdd: "error",
    scenarios: "error",
    requirements: "error",
    links: "off",
    coverage: "warning",
    ids: "error",
    quality: "error",
    use_cases: "warning",
    state_machines: "error",
    scope: "warning",
    controls: "warning",
  });
});

test("REQ-604: no file is the strict gate; the template reads as the standard preset", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-policy-none-"));
  try {
    const p = readGatePolicy(dir);
    assert.equal(p.source, "default");
    // Every rule fails it but use_cases, reported until a catalog is written (REQ-627),
    // and controls, reported for the reviewer in every preset (REQ-754).
    const { use_cases: useCases, controls, ...rest } = p.rules;
    assert.ok(Object.values(rest).every((l) => l === "error"));
    assert.equal(useCases, "warning");
    assert.equal(controls, "warning");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const t = parseGatePolicy(gatePolicyTemplate());
  assert.deepEqual(t.problems, []);
  assert.equal(t.preset, "standard");
  assert.equal(t.rules.coverage, "warning");
});

test("REQ-604 SCN-604b: a policy that cannot be read fails validate with every problem", (t) => {
  const dir = project(t);
  policy(dir, "preset: lax\nrules:\n  speed: error\nenforce_from: soon\n");
  const r = run(dir, ["validate", ".", "--strict"]);
  assert.equal(r.status, 1);
  const out = r.stdout + r.stderr;
  assert.match(out, /gate_policy_invalid|cannot be read/);
  for (const word of ["lax", "speed", "soon", "minimal, standard, strict"]) {
    assert.ok(out.includes(word), word);
  }
});

// ── REQ-605 ───────────────────────────────────────────────────────────────────

test("REQ-605 SCN-605a: tdd reported, not failed", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: warning\n");
  const r = run(dir, ["check"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Policy\s+\.specgate\/gate\.yaml \(strict\): tdd warning/);
  assert.match(r.stdout, /1 tdd finding\(s\) reported, not failed/);
  const j = run(dir, ["check", "--json"]);
  assert.equal(j.status, 0);
  const codes = statusOf(j.stdout);
  assert.ok(codes.includes("gate_rule_reported/warning"), codes.join());
  // Each finding the rule reported is in the validate stage, as a warning.
  const doc = JSON.parse(j.stdout.slice(j.stdout.indexOf("{")));
  const stage = doc.stages.find((s: { stage: string }) => s.stage === "validate");
  assert.ok(
    stage.findings.some(
      (f: { code: string; severity: string }) =>
        f.code === "strict_tdd_1" && f.severity === "warning"
    ),
    JSON.stringify(stage.findings)
  );
});

test("REQ-605 SCN-605b: the flag still fails, and the date relaxes", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: warning\n");
  assert.equal(run(dir, ["validate", ".", "--strict", "--strict-tdd"]).status, 1);
  policy(dir, "preset: strict\nenforce_from: 2099-01-01\n");
  const r = run(dir, ["validate", ".", "--strict"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /enforces errors from 2099-01-01/);
  // On the date, the error counts again.
  assert.equal(run(dir, ["validate", ".", "--strict"], { SPECGATE_TODAY: "2099-01-01" }).status, 1);
  assert.equal(
    levelOf(parseGatePolicy("enforce_from: 2099-01-01\n"), "tdd", "2098-12-31"),
    "warning"
  );
});

test("REQ-605: off does not run the rule", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n");
  const j = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(j.status, 0, j.stdout + j.stderr);
  assert.ok(!statusOf(j.stdout).some((c) => c.startsWith("strict_tdd")));
});

test("REQ-605 SCN-605c: no policy, the gate as it was", (t) => {
  const dir = project(t);
  const r = run(dir, ["check"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /check_validate_failed/);
  assert.doesNotMatch(r.stdout, /Policy/);
});

// ── REQ-606 ───────────────────────────────────────────────────────────────────

test("REQ-606 SCN-606a: set through config, refused when it would not read", (t) => {
  const dir = project(t);
  const ok = run(dir, ["config", "set", "gate.rules.coverage", "off"]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(readGatePolicy(dir).rules.coverage, "off");
  const bad = run(dir, ["config", "set", "gate.preset", "loose"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stdout + bad.stderr, /config_value_invalid/);
  assert.match(bad.stdout + bad.stderr, /minimal, standard, strict/);
  assert.equal(run(dir, ["config", "set", "gate.enforce_from", "2026-13-45"]).status, 2);
  const keys = run(dir, ["config", "keys"]);
  for (const k of ["gate.preset", "gate.rules.tdd", "gate.rules.quality", "gate.enforce_from"]) {
    assert.ok(keys.stdout.includes(k), k);
  }
});

test("REQ-606 SCN-606b: a new project's policy is the standard preset", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-policy-init-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","version":"1.0.0"}');
  git(dir, "init", "-q");
  const r = run(dir, ["init", "--no-agents", "--no-ci", "--yes"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const text = fs.readFileSync(path.join(dir, ".specgate", "gate.yaml"), "utf8");
  assert.match(text, /^preset: standard$/m);
  for (const rule of ["tdd", "scenarios", "requirements", "links", "coverage", "ids", "quality"]) {
    assert.match(text, new RegExp(`^  ${rule}: (error|warning|off)`, "m"), rule);
  }
  // Run again: the policy a team edited is never touched.
  fs.writeFileSync(path.join(dir, ".specgate", "gate.yaml"), "preset: minimal\n");
  run(dir, ["init", "--no-agents", "--no-ci", "--yes"]);
  assert.equal(
    fs.readFileSync(path.join(dir, ".specgate", "gate.yaml"), "utf8"),
    "preset: minimal\n"
  );
});

// ── REQ-627 ───────────────────────────────────────────────────────────────────

/** The catalog `init` writes for a layered project: the template's row. */
const catalog = (dir: string) =>
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "use-cases.md"),
    "# Use Cases\n\n| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |\n|---|---|---|---|---|---|---|---|\n| UC-001 | Describe the first use case | Primary actor | REQ-TBD | CMD-001 ExampleCommand | AGG-001 CoreAggregate | EVT-001 ExampleEvent | Draft |\n"
  );

test("REQ-627 SCN-627a: by default, a requirement with no use case is reported, not failed", (t) => {
  const dir = project(t);
  catalog(dir);
  // The fixture's REQ-002 has no test: tdd off, so only use_cases speaks — at its default.
  policy(dir, "preset: strict\nrules:\n  tdd: off\n");
  const j = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(j.status, 0, j.stdout + j.stderr);
  assert.match(j.stdout, /use_case_missing/);
  assert.match(j.stdout, /REQ-002 names no use case/);
});

test("REQ-627 SCN-627b: use_cases set to error fails the gate — the requirement and the template row named", (t) => {
  const dir = project(t);
  catalog(dir);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n  use_cases: error\n");
  const r = run(dir, ["validate", ".", "--strict"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const out = r.stdout + r.stderr;
  assert.match(out, /use_case_missing/);
  assert.match(out, /use_case_template/);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n  use_cases: off\n");
  const off = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(off.status, 0, off.stdout + off.stderr);
  assert.doesNotMatch(off.stdout, /use_case_missing/);
});

test("REQ-627: a project with no use-cases.md does not model use cases — the rule says nothing", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n  use_cases: error\n");
  const r = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /use_case_/);
});
