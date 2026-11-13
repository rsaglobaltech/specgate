"use strict";

/**
 * REQ-528, REQ-529, REQ-530, REQ-531 — a running system specified one module
 * at a time, each requirement citing its code, and a baseline so an existing
 * project can turn the gate on (change brownfield-reverse).
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
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const {
  applyBaseline,
  baselineOf,
  parseBaseline,
} = require("../../packages/core/src/domain/GateBaseline");
const {
  citedSources,
  parseReverseAnswer,
  renderReverseDelta,
} = require("../../packages/core/src/domain/ReverseDraft");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp(prefix = "specgate-reverse-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
const sg = (dir: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};
const put = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

/** A Specgate project with two Maven modules, committed. */
function mavenProject() {
  const parent = tmp();
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  put(
    dir,
    "pom.xml",
    "<project><modules><module>orders</module><module>billing</module></modules></project>\n"
  );
  for (const m of ["orders", "billing"]) {
    put(dir, `${m}/pom.xml`, "<project/>\n");
    put(dir, `${m}/src/main/java/x/A.java`, "class A {}\n");
  }
  put(dir, "orders/src/main/java/x/Cancel.java", "class Cancel {\n  // refuse when SHIPPED\n}\n");
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { parent, dir };
}

/** An agent that writes `answer` as reverse-orders' answer, plus any `extra` lines of script. */
function agent(parent: string, answer: unknown, extra: string[] = []) {
  const file = path.join(parent, `agent-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      'const f = "docs/specs/changes/reverse-orders/reverse.json";',
      'fs.mkdirSync(require("node:path").dirname(f), { recursive: true });',
      `fs.writeFileSync(f, ${JSON.stringify(typeof answer === "string" ? answer : JSON.stringify(answer))});`,
      ...extra,
      "",
    ].join("\n")
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

const rule = (title: string, source = "orders/src/main/java/x/Cancel.java:2") => ({
  title,
  text: `The system SHALL ${title.toLowerCase()}.`,
  source: [source],
  scenarios: [{ title, steps: ["GIVEN an order", "WHEN it happens", "THEN it is so"] }],
});

// ── REQ-528 ─────────────────────────────────────────────────────────────────

test("REQ-528 SCN-528a: a Maven project with two modules", () => {
  const { parent, dir } = mavenProject();
  const marker = path.join(parent, "agent-ran");
  sg(dir, "config", "set", "agent", `touch "${marker}"`);
  const r = sg(dir, "reverse", "--modules", "--json");
  assert.equal(r.status, 0, r.out);
  const { modules } = JSON.parse(r.stdout).reverse;
  assert.deepEqual(
    modules.map((m: { path: string; stack: string; files: number }) => [m.path, m.stack, m.files]),
    [
      ["billing", "java", 1],
      ["orders", "java", 2],
    ]
  );
  assert.equal(fs.existsSync(marker), false, "no agent was started");
});

test("REQ-528: no modules answers no_modules with the fix", () => {
  const dir = tmp();
  const r = sg(dir, "reverse", "--modules", "--json");
  assert.equal(r.status, 1, r.out);
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.status[0].code, "no_modules");
  assert.match(doc.status[0].fix, /specgate reverse <path>/);
});

// ── REQ-529 ─────────────────────────────────────────────────────────────────

test("REQ-529 SCN-529a: the agent drafts the orders module", () => {
  const { parent, dir } = mavenProject();
  const specBefore = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
  const cmd = agent(
    parent,
    { requirements: [rule("Refuse a shipped cancel"), rule("Record who cancelled")] },
    ['fs.appendFileSync("spec.md", "\\nhacked\\n");']
  );
  const r = sg(dir, "reverse", "orders", "--agent", cmd, "--json");
  assert.equal(r.status, 0, r.out);
  const doc = JSON.parse(r.stdout).reverse;
  assert.equal(doc.change, "reverse-orders");
  assert.equal(doc.requirements.length, 2);
  assert.deepEqual(doc.undone, ["spec.md"]);
  const delta = fs.readFileSync(
    path.join(dir, "docs/specs/changes/reverse-orders/specs/orders/spec.md"),
    "utf8"
  );
  assert.equal((delta.match(/### Requirement: REQ-\d+/g) || []).length, 2);
  assert.equal((delta.match(/status=Draft/g) || []).length, 2);
  assert.equal(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), specBefore);
  assert.equal(
    fs.existsSync(path.join(dir, "docs/specs/changes/reverse-orders/reverse.json")),
    false
  );
  assert.equal(sg(dir, "change", "validate", "reverse-orders").status, 0);
});

test("REQ-529: an answer that is not one keeps nothing", () => {
  const { parent, dir } = mavenProject();
  const cmd = agent(parent, { requirements: [{ title: "No source", text: "x", scenarios: [] }] });
  const r = sg(dir, "reverse", "orders", "--agent", cmd, "--json");
  assert.equal(r.status, 1, r.out);
  assert.equal(JSON.parse(r.stdout).status[0].code, "reverse_answer_invalid");
  assert.equal(fs.existsSync(path.join(dir, "docs/specs/changes/reverse-orders")), false);
});

test("REQ-529: without an agent, reverse says how to give one", () => {
  const { dir } = mavenProject();
  const r = sg(dir, "reverse", "orders", "--json");
  assert.equal(r.status, 2, r.out);
  assert.equal(JSON.parse(r.stdout).status[0].code, "reverse_needs_agent");
});

// ── REQ-530 ─────────────────────────────────────────────────────────────────

test("REQ-530 SCN-530a: a rule, a defect and a deleted file", () => {
  const { parent, dir } = mavenProject();
  const cmd = agent(parent, {
    requirements: [
      rule("Refuse a shipped cancel", "orders/src/main/java/x/Cancel.java:12"),
      {
        title: "Refunds truncate",
        text: "The system truncates a refund to two decimals.",
        source: ["orders/src/main/java/x/A.java:1"],
        suspect: "It loses up to a cent per refund.",
      },
    ],
  });
  assert.equal(sg(dir, "reverse", "orders", "--agent", cmd, "--json").status, 0);
  const change = path.join(dir, "docs/specs/changes/reverse-orders");
  const delta = fs.readFileSync(path.join(change, "specs/orders/spec.md"), "utf8");
  assert.equal((delta.match(/### Requirement:/g) || []).length, 1);
  assert.match(delta, /source=orders\/src\/main\/java\/x\/Cancel\.java:12/);
  const questions = fs.readFileSync(path.join(change, "questions.md"), "utf8");
  assert.equal((questions.match(/^\| Q\d+ /gm) || []).length, 1);
  assert.match(questions, /truncates a refund/);

  fs.rmSync(path.join(dir, "orders/src/main/java/x/Cancel.java"));
  const v = sg(dir, "validate", ".", "--json");
  const missing = JSON.parse(v.stdout).status.filter(
    (d: { code: string }) => d.code === "source_missing"
  );
  assert.equal(missing.length, 1, v.out);
  assert.match(missing[0].message, /orders\/src\/main\/java\/x\/Cancel\.java does not exist/);
});

test("REQ-530: the answer is checked before anything is written", () => {
  assert.equal(parseReverseAnswer("nope").ok, false);
  assert.equal(parseReverseAnswer(JSON.stringify({ requirements: [] })).ok, false);
  const noSource = parseReverseAnswer(
    JSON.stringify({ requirements: [{ ...rule("A"), source: [] }] })
  );
  assert.equal(noSource.ok, false);
  assert.match(noSource.problems.join(), /needs a source/);
  const badStep = parseReverseAnswer(
    JSON.stringify({
      requirements: [{ ...rule("A"), scenarios: [{ title: "s", steps: ["it works"] }] }],
    })
  );
  assert.equal(badStep.ok, false);
  const ok = parseReverseAnswer(JSON.stringify({ requirements: [rule("A")] }));
  assert.equal(ok.ok, true);
});

test("REQ-530: the delta cites its sources, and they read back", () => {
  const delta = renderReverseDelta(
    "orders",
    [{ ...rule("A"), source: ["a/B.java:3", "a/C.java"] }],
    7
  );
  assert.match(delta, /### Requirement: REQ-007 — A/);
  assert.match(delta, /#### Scenario: SCN-007a — A/);
  assert.deepEqual(
    citedSources(delta).map((c: { requirement: string; file: string }) => [c.requirement, c.file]),
    [
      ["REQ-007", "a/B.java"],
      ["REQ-007", "a/C.java"],
    ]
  );
});

// ── REQ-531 ─────────────────────────────────────────────────────────────────

test("REQ-531: a finding is matched by code, file and requirement, not wording", () => {
  const e = (requirement: string, code = "strict_tdd_1") => ({
    code,
    file: "docs/specs/traceability.md",
    requirement,
  });
  const baseline = baselineOf([e("REQ-002"), e("REQ-001"), e("REQ-001")]);
  assert.deepEqual(
    baseline.findings.map((x: { requirement: string }) => x.requirement),
    ["REQ-001", "REQ-002"]
  );
  const split = applyBaseline([e("REQ-001"), e("REQ-003")], (x: unknown) => x, baseline);
  assert.deepEqual(
    split.fresh.map((x: { requirement: string }) => x.requirement),
    ["REQ-003"]
  );
  assert.deepEqual(
    split.baselined.map((x: { requirement: string }) => x.requirement),
    ["REQ-001"]
  );
  assert.deepEqual(
    split.fixed.map((x: { requirement: string }) => x.requirement),
    ["REQ-002"]
  );
  assert.deepEqual(
    applyBaseline(
      [],
      (x: unknown) => x,
      baseline,
      () => false
    ).fixed,
    [],
    "a code this run did not judge is not called fixed"
  );
  assert.throws(() => parseBaseline("{}"), /not a gate baseline/);
});

/** REQ-000 of the init template, set Implemented with no test. */
function implementedWithoutTest() {
  const parent = tmp();
  spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"]);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const matrix = path.join(dir, "docs/specs/traceability.md");
  fs.writeFileSync(
    matrix,
    fs.readFileSync(matrix, "utf8").replace("| TBD | Draft |", "| TBD | Implemented |")
  );
  return { dir, matrix };
}

test("REQ-531 SCN-531a: an old finding passes, a new one fails", () => {
  const { dir, matrix } = implementedWithoutTest();
  assert.equal(sg(dir, "check", "--json").status, 1, "the old finding fails before a baseline");
  const b = sg(dir, "check", "--baseline", "--json");
  assert.equal(b.status, 0, b.out);
  assert.equal(JSON.parse(b.stdout).baseline.findings, 1);
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/gate-baseline.json")));
  assert.equal(sg(dir, "check", "--json").status, 0, "the baselined finding no longer fails");

  fs.appendFileSync(
    matrix,
    "| REQ-002 | SCN-002 | `features/core/health.feature` | - | - | - | - | - | TBD | Implemented |\n"
  );
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 1, r.out);
  const validate = JSON.parse(r.stdout).stages.find(
    (s: { stage: string }) => s.stage === "validate"
  );
  const codes = validate.findings.map((f: { code: string }) => f.code);
  assert.equal(codes.filter((c: string) => c === "strict_tdd_1").length, 1, r.out);
  assert.ok(codes.includes("baselined"), r.out);
  assert.match(
    validate.findings.find((f: { code: string }) => f.code === "strict_tdd_1").message,
    /SCN-002/
  );
});

test("REQ-531: a baselined finding that is gone is named, so the file can shrink", () => {
  const { dir, matrix } = implementedWithoutTest();
  assert.equal(sg(dir, "check", "--baseline", "--json").status, 0);
  fs.writeFileSync(
    matrix,
    fs.readFileSync(matrix, "utf8").replace("| TBD | Implemented |", "| TBD | Draft |")
  );
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 0, r.out);
  const fixed = JSON.parse(r.stdout).status.filter(
    (d: { code: string }) => d.code === "baseline_fixed"
  );
  assert.equal(fixed.length, 1, r.out);
  assert.equal(fixed[0].target, "REQ-000");
});
