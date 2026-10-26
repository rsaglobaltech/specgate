"use strict";

/**
 * REQ-180 — A requirement of the live view opens into everything the project
 * holds about it. REQ-181 — The live view groups by module and keeps its
 * header in view.
 *
 * Watching a run, an adopter clicked a requirement and saw only its steps:
 * what it says, where its spec and tests are, and how earlier attempts went
 * meant leaving the page for the editor and git.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { requirementDetail } = require("../../scripts/lib/live-detail");
const { livePage } = require("../../scripts/lib/live-page");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-live-detail-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n");
  w(
    "docs/specs/changes/draft-diario/specs/diario/spec.md",
    [
      "# Delta — diario",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-024 — Ruta de la clase",
      "",
      '<!-- specgate:trace actor=Fahrschüler kind=functional status="Draft" -->',
      "",
      "The system SHALL let the Fahrschüler write the route of a class.",
      "",
      "#### Scenario: SCN-066 — Escribir la ruta",
      "",
      "- GIVEN a new class",
      "- WHEN the Fahrschüler writes the route Hauptbahnhof",
      "- THEN the class shows Hauptbahnhof",
      "",
      "### Requirement: REQ-025 — Otra",
      "",
      "Text.",
      "",
    ].join("\n")
  );
  w(
    "docs/specs/changes/draft-diario/assumptions.md",
    [
      "| # | Assumption | Used in | Why | Status |",
      "|---|---|---|---|---|",
      "| A3 | The route is free text | REQ-024, SCN-066 | Brief | decided |",
      "| A4 | Unrelated | REQ-025 | x | decided |",
    ].join("\n")
  );
  w(
    "features/diario/REQ-024.feature",
    "Feature: Ruta\n  @REQ-024 @SCN-066\n  Scenario: Escribir la ruta\n"
  );
  w("packages/core/tests/unit/diario/Ruta.test.ts", "// REQ-024 SCN-066\n");
  w("apps/web/e2e/diario.spec.ts", "test('REQ-024 SCN-066: the route', () => {});\n");
  w("node_modules/x/REQ-024.test.js", "// REQ-024, must be ignored\n");
  w(
    ".harness/events/REQ-024.jsonl",
    [
      { t: 100, attempt: 1, type: "attempt", state: "start" },
      {
        t: 150,
        attempt: 1,
        type: "step",
        kind: "edit",
        target: "apps/web/app/diario/page.tsx",
        added: 10,
        removed: 2,
      },
      { t: 200, attempt: 1, type: "gate", stage: "validate --strict", result: "pass" },
      { t: 260, attempt: 1, type: "gate", stage: "test command: npm test", result: "fail" },
      { t: 261, attempt: 1, type: "attempt", state: "end", result: "fail" },
      { t: 300, attempt: 2, type: "attempt", state: "start" },
      {
        t: 350,
        attempt: 2,
        type: "step",
        kind: "edit",
        target: "apps/web/app/diario/page.tsx",
        added: 4,
        removed: 1,
      },
      {
        t: 380,
        attempt: 2,
        type: "step",
        kind: "write",
        target: "apps/web/e2e/diario.spec.ts",
        added: 20,
      },
      { t: 420, attempt: 2, type: "gate", stage: "test command: npm test", result: "pass" },
      { t: 421, attempt: 2, type: "attempt", state: "end", result: "pass" },
    ]
      .map((e) => JSON.stringify({ req: "REQ-024", ...e }))
      .join("\n") + "\n"
  );
  return dir;
}

test("REQ-180 SCN-180a: the requirement's text, scenarios and where they live", () => {
  const dir = project();
  try {
    const d = requirementDetail(dir, "REQ-024");
    assert.equal(d.id, "REQ-024");
    assert.equal(d.title, "Ruta de la clase");
    assert.equal(d.status, "Draft");
    assert.equal(d.group, "diario");
    assert.match(d.statement, /SHALL let the Fahrschüler write the route/);
    assert.equal(d.source.file, "docs/specs/changes/draft-diario/specs/diario/spec.md");
    assert.equal(d.source.line, 5);
    assert.deepEqual(
      d.scenarios.map((s: { id: string }) => s.id),
      ["SCN-066"]
    );
    assert.deepEqual(d.scenarios[0].steps, [
      "GIVEN a new class",
      "WHEN the Fahrschüler writes the route Hauptbahnhof",
      "THEN the class shows Hauptbahnhof",
    ]);
    assert.deepEqual(d.features, ["features/diario/REQ-024.feature"]);
    assert.deepEqual(
      d.assumptions.map((a: { id: string }) => a.id),
      ["A3"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-180 SCN-180b: the tests that name it, and every attempt with its files", () => {
  const dir = project();
  try {
    const d = requirementDetail(dir, "REQ-024");
    assert.deepEqual(d.tests.slice().sort(), [
      "apps/web/e2e/diario.spec.ts",
      "packages/core/tests/unit/diario/Ruta.test.ts",
    ]);
    assert.equal(d.attempts.length, 2);
    assert.deepEqual(
      d.attempts.map((a: { attempt: number; result: string; failedAt: string | null }) => [
        a.attempt,
        a.result,
        a.failedAt,
      ]),
      [
        [1, "fail", "test command: npm test"],
        [2, "pass", null],
      ]
    );
    assert.equal(d.attempts[0].duration, 161);
    const files = Object.fromEntries(
      d.files.map((f: { path: string; added: number; removed: number }) => [
        f.path,
        [f.added, f.removed],
      ])
    );
    assert.deepEqual(files["apps/web/app/diario/page.tsx"], [4, 1], "the last attempt's changes");
    assert.deepEqual(files["apps/web/e2e/diario.spec.ts"], [20, 0]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-180: an id that is not a requirement id is refused", () => {
  const dir = project();
  try {
    assert.equal(requirementDetail(dir, "../../etc/passwd"), null);
    assert.equal(requirementDetail(dir, "REQ-999")?.title, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-181 SCN-181a: a sticky header, modules that fold, and the requirement's tabs", () => {
  const html = livePage("fuhrerschein-app");
  assert.match(html, /position:\s*sticky/);
  for (const tab of ["Steps", "Requirement", "Tests and files", "Attempts", "Traceability"]) {
    assert.ok(html.includes(tab), tab);
  }
  assert.match(html, /live\/req\//, "details are fetched per requirement");
  assert.ok(html.includes('el("details"'), "modules fold, as accordions");
  assert.doesNotMatch(html, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(html, /<script src=|<link /);
});

test("REQ-181 SCN-181b: the traceability matrix as it stands, delivered and in flight", () => {
  const dir = project();
  try {
    fs.mkdirSync(path.join(dir, "docs/specs/capabilities/mi-tarjeta"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs/specs/capabilities/mi-tarjeta/spec.md"),
      "# mi-tarjeta\n\n### Requirement: REQ-002 — La tarjeta\n\n<!-- specgate:trace status=Implemented -->\n\n#### Scenario: SCN-002 — Abrir\n\n- GIVEN a\n- WHEN b\n- THEN c\n"
    );
    fs.writeFileSync(
      path.join(dir, "apps/web/e2e/tarjeta.spec.ts"),
      "test('REQ-002 SCN-002: x', () => {});\n"
    );
    const { liveMatrix } = require("../../scripts/lib/live-detail");
    const rows = liveMatrix(dir);
    const byKey = Object.fromEntries(
      rows.map((r: { requirement: string; scenario: string }) => [
        r.requirement + " " + r.scenario,
        r,
      ])
    );
    assert.equal(byKey["REQ-002 SCN-002"].status, "Implemented");
    assert.equal(byKey["REQ-002 SCN-002"].source, "spec");
    assert.equal(byKey["REQ-002 SCN-002"].group, "mi-tarjeta");
    assert.deepEqual(byKey["REQ-002 SCN-002"].tests, ["apps/web/e2e/tarjeta.spec.ts"]);
    assert.equal(byKey["REQ-024 SCN-066"].source, "change");
    assert.equal(byKey["REQ-024 SCN-066"].group, "diario");
    assert.equal(byKey["REQ-024 SCN-066"].feature, "features/diario/REQ-024.feature");
    assert.deepEqual(byKey["REQ-024 SCN-066"].tests, [
      "apps/web/e2e/diario.spec.ts",
      "packages/core/tests/unit/diario/Ruta.test.ts",
    ]);
    assert.ok(byKey["REQ-025 -"], "a requirement with no scenario still has a row");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-180 SCN-180c: a later run's attempt 1 is the last attempt, not an earlier run's attempt 3", () => {
  const dir = project();
  try {
    const file = path.join(dir, ".harness/events/REQ-024.jsonl");
    fs.appendFileSync(
      file,
      [
        { t: 900, attempt: 1, type: "attempt", state: "start" },
        { t: 950, attempt: 1, type: "gate", stage: "validate --strict", result: "pass" },
        { t: 960, attempt: 1, type: "attempt", state: "end", result: "pass" },
      ]
        .map((e) => JSON.stringify({ req: "REQ-024", ...e }))
        .join("\n") + "\n"
    );
    const { readLive } = require("../../scripts/lib/live-model");
    const r = readLive(dir).requirements.find((x: { req: string }) => x.req === "REQ-024");
    assert.equal(r.state, "pass");
    assert.equal(r.started, 900);
    const d = requirementDetail(dir, "REQ-024");
    assert.deepEqual(
      d.attempts.map((a: { attempt: number; result: string }) => [a.attempt, a.result]),
      [
        [1, "fail"],
        [2, "pass"],
        [1, "pass"],
      ]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
