"use strict";

/**
 * REQ-300..REQ-304 — the two gaps of the 1.0 line (enterprise-sdd-gap.md, 6):
 * spec → implementation (the spec was clear, the code diverged) and intent →
 * spec (a detail of the use case was missed). `harness report` counted
 * attempts, cost and false failures, and could say neither.
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
const { summariseRuns } = require("../../packages/core/src/domain/HarnessReport");
const { report } = require("../../scripts/lib/studio-route");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

/** A project `specgate init` wrote, with no git and its matrix kept by hand. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-gaps-"));
  madeDirs.push(parent);
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}

type Attempt = { attempt: number; endedAt: string; gateStage?: string };
const row = (requirement: string, attemptLog: Attempt[]) => ({
  requirement,
  result: attemptLog[attemptLog.length - 1].endedAt === "pass" ? "pass" : "fail",
  attempts: attemptLog.length,
  durationMs: 60_000,
  attemptLog,
});
const ledger = (...results: unknown[]) => ({
  startedAt: "2026-10-29T10:00:00.000Z",
  finishedAt: "2026-10-29T10:30:00.000Z",
  maxAttempts: 3,
  results,
});
const rejectedThenPassed = (requirement: string, gateStage: string) =>
  row(requirement, [
    { attempt: 1, endedAt: "gate", gateStage },
    { attempt: 2, endedAt: "pass" },
  ]);
const passedAtOnce = (requirement: string) => row(requirement, [{ attempt: 1, endedAt: "pass" }]);

function writeLedger(dir: string, run: unknown) {
  w(dir, ".harness/runs/2026-10-29T10-00-00-000Z.json", JSON.stringify(run));
}

// ── REQ-300 ─────────────────────────────────────────────────────────────────

test("REQ-300 SCN-300a: classifying a requirement", () => {
  const dir = project();
  writeLedger(dir, ledger(rejectedThenPassed("REQ-002", "quality check: pmd")));
  const r = sg(
    dir,
    "harness",
    "report",
    "--classify",
    "REQ-002",
    "--gap",
    "intent-spec",
    "--reason",
    "the brief never said a truck can carry two drivers",
    "--json"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const marks = fs.readFileSync(path.join(dir, ".harness", "gaps.jsonl"), "utf8");
  assert.match(marks, /"requirement":"REQ-002"/);
  assert.match(marks, /"gap":"intent-spec"/);
  assert.match(marks, /"markedAt":"\d{4}-/);
  const gaps = JSON.parse(r.stdout).report.gaps;
  const req = gaps.rows.find((g: { requirement: string }) => g.requirement === "REQ-002");
  assert.equal(req.gap, "intent-spec", "the person's word wins over the suggestion");
  assert.equal(req.source, "person");
  assert.equal(gaps.marked, 1);
});

test("REQ-300 SCN-300b: a classification without a reason", () => {
  const dir = project();
  writeLedger(dir, ledger(rejectedThenPassed("REQ-002", "quality check: pmd")));
  const r = sg(dir, "harness", "report", "--classify", "REQ-002", "--gap", "spec-impl");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /--reason/);
  assert.equal(fs.existsSync(path.join(dir, ".harness", "gaps.jsonl")), false);
  const other = sg(
    dir,
    "harness",
    "report",
    "--classify",
    "REQ-002",
    "--gap",
    "elsewhere",
    "--reason",
    "x"
  );
  assert.notEqual(other.status, 0, "only the two gaps exist");
  assert.match(other.stdout + other.stderr, /spec-impl|intent-spec/);
});

// ── REQ-301 ─────────────────────────────────────────────────────────────────

test("REQ-301 SCN-301a: a rejection the agent fixed", () => {
  const s = summariseRuns([ledger(rejectedThenPassed("REQ-002", "quality check: pmd"))]);
  const req = s.gaps.rows.find((g: { requirement: string }) => g.requirement === "REQ-002");
  assert.equal(req.gap, "spec-impl");
  assert.equal(req.source, "suggested");
  assert.equal(req.check, "pmd");
});

test("REQ-301 SCN-301b: a requirement changed after review", () => {
  const dir = project();
  writeLedger(dir, ledger(passedAtOnce("REQ-010")));
  w(
    dir,
    "docs/specs/changes/draft-flota/questions.md",
    [
      "# Questions — flota",
      "",
      "| # | Question | Blocks | Options seen | Answer |",
      "|---|---|---|---|---|",
      "| Q5 | Can a truck carry two drivers? | REQ-010 | one; two | Up to two |",
      "",
    ].join("\n")
  );
  const r = sg(dir, "harness", "report", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const req = JSON.parse(r.stdout).report.gaps.rows.find(
    (g: { requirement: string }) => g.requirement === "REQ-010"
  );
  assert.ok(req, r.stdout);
  assert.equal(req.gap, "intent-spec");
  assert.equal(req.source, "suggested");
  assert.match(req.why, /Q5/);

  // A rejection the agent fixed, on a requirement that changed after review:
  // the review is what was missed.
  const both = summariseRuns(
    [ledger(rejectedThenPassed("REQ-010", "test command: npm test"))],
    [],
    {},
    { evidence: [{ requirement: "REQ-010", why: "Q5 answered" }] }
  );
  assert.equal(both.gaps.rows[0].gap, "intent-spec");
  // The gate failing on the specification itself is the spec, not the code.
  const spec = summariseRuns([
    ledger(
      row("REQ-011", [
        { attempt: 1, endedAt: "spec" },
        { attempt: 2, endedAt: "pass" },
      ])
    ),
  ]);
  assert.equal(spec.gaps.rows[0].gap, "intent-spec");
});

// ── REQ-302 ─────────────────────────────────────────────────────────────────

test("REQ-302 SCN-302a: two modules", () => {
  const s = summariseRuns(
    [
      ledger(
        rejectedThenPassed("REQ-002", "quality check: pmd"),
        passedAtOnce("REQ-003"),
        passedAtOnce("REQ-012"),
        passedAtOnce("REQ-013")
      ),
    ],
    [],
    {},
    {
      evidence: [{ requirement: "REQ-012", why: "Q1 answered" }],
      moduleOf: {
        "REQ-002": "flota",
        "REQ-003": "flota",
        "REQ-012": "tracking",
        "REQ-013": "tracking",
      },
    }
  );
  assert.equal(s.gaps.requirements, 4);
  assert.deepEqual(s.gaps.specImpl, { count: 1, rate: 0.25 });
  assert.deepEqual(s.gaps.intentSpec, { count: 1, rate: 0.25 });
  assert.deepEqual(s.gaps.byModule, [
    { module: "flota", requirements: 2, specImpl: 1, intentSpec: 0 },
    { module: "tracking", requirements: 2, specImpl: 0, intentSpec: 1 },
  ]);
  assert.equal(s.gaps.suggested, 2);
  assert.equal(s.gaps.marked, 0);
});

// ── REQ-303 ─────────────────────────────────────────────────────────────────

test("REQ-303 SCN-303a: the check that catches most", () => {
  const s = summariseRuns(
    [
      ledger(
        rejectedThenPassed("REQ-002", "quality check: pmd"),
        rejectedThenPassed("REQ-003", "quality check: pmd"),
        rejectedThenPassed("REQ-004", "test command: npm test"),
        passedAtOnce("REQ-012"),
        passedAtOnce("REQ-013")
      ),
    ],
    [],
    {},
    {
      evidence: [
        { requirement: "REQ-012", why: "Q1 answered", at: "2026-10-28" },
        { requirement: "REQ-013", why: "review note", at: "2026-10-29" },
      ],
      moduleOf: { "REQ-012": "tracking", "REQ-013": "rutas" },
    }
  );
  assert.equal(s.gaps.strengthen.specImpl, "pmd");
  assert.equal(s.gaps.strengthen.intentSpec, "rutas", "a tie goes to the newest");
  const none = summariseRuns([ledger(passedAtOnce("REQ-002"))]);
  assert.deepEqual(none.gaps.strengthen, { specImpl: null, intentSpec: null });
});

// ── REQ-304 ─────────────────────────────────────────────────────────────────

test("REQ-304 SCN-304a: a report after two runs", () => {
  const dir = project();
  writeLedger(
    dir,
    ledger(rejectedThenPassed("REQ-002", "quality check: pmd"), passedAtOnce("REQ-003"))
  );
  const view = report(dir, false);
  assert.deepEqual(view.gaps, { specImpl: 0.5, intentSpec: 0 });

  const empty = project();
  assert.equal(report(empty, false).gaps, null, "no ledger, no rates");
});
