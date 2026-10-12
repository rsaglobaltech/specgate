"use strict";

/**
 * `specgate report` — declared-value drift (§8.6 of PLAN_PREDICTABLE_CODE_EVOLUTION.md).
 *
 * `packages/core/test/unit/value-annotations.test.ts` pins the pure compare
 * logic. This is the I/O wiring: read a capability spec's `value_<id>=`
 * trace keys, find the file(s) its matrix row already declares, read those
 * files for `specgate:value <id>=` markers, and aggregate — as a report section,
 * never as a gate. `validate` is untouched by this feature on purpose.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { spawnSync } = require("node:child_process");
const { buildReport, buildDeclaredValues, renderHtml, sparkline } = require("../../scripts/report");

const REPO_ROOT = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(REPO_ROOT, "bin", "specgate.js");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function richRow(req: string, tech: string, testArt = "TBD", status = "In Dev") {
  return `| ${req} | SCN-${req} | features/x.feature | UC | Cmd | Agg | Evt | ${tech} | ${testArt} | ${status} |`;
}

function mkProject(rows: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-values-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "features"), { recursive: true });
  fs.writeFileSync(path.join(dir, "features", "x.feature"), "Feature: x\n");
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [RICH_HEADER, RICH_SEP, ...rows].join("\n")
  );
  return dir;
}

function writeCapabilitySpec(dir: string, name: string, body: string) {
  const capDir = path.join(dir, "docs", "specs", "capabilities", name);
  fs.mkdirSync(capDir, { recursive: true });
  fs.writeFileSync(path.join(capDir, "spec.md"), body, "utf8");
}

function writeCode(dir: string, rel: string, body: string) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
}

test("no docs/specs/capabilities/ — declaredValues is all zero, no error", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    const report = buildReport(dir);
    assert.deepEqual(report.declaredValues, {
      total: 0,
      matched: 0,
      diverging: 0,
      specOnly: 0,
      codeOnly: 0,
      items: [],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a requirement with no value_ key contributes nothing", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL authenticate users.",
        "<!-- specgate:trace uc=Login -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "// specgate:value session_timeout=15m\n");
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.total, 0);
    assert.equal(dv.items.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("matched — same id, same literal, on the file the matrix already declares", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace uc=Login value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "// specgate:value session_timeout=15m\nconst X = '15m';\n");
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.total, 1);
    assert.equal(dv.matched, 1);
    assert.equal(dv.diverging, 0);
    assert.deepEqual(dv.items[0], {
      id: "session_timeout",
      requirement: "REQ-001",
      specValue: "15m",
      specFile: "docs/specs/capabilities/auth/spec.md",
      specLine: dv.items[0].specLine,
      codeValue: "15m",
      codeFile: "src/a.ts",
      codeLine: 1,
      status: "matched",
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("diverging — same id, different literal, no unit interpretation", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "// specgate:value session_timeout=30m\n");
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.diverging, 1);
    assert.equal(dv.matched, 0);
    assert.equal(dv.items[0].status, "diverging");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("spec_only — the declared file exists but carries no matching marker", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "const X = '15m'; // no marker\n");
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.specOnly, 1);
    assert.equal(dv.items[0].status, "spec_only");
    assert.equal(dv.items[0].codeFile, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("code_only — a marker for an id the spec never declared, on the same file", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(
      dir,
      "src/a.ts",
      "// specgate:value session_timeout=15m\n// specgate:value retry_backoff=2s\n"
    );
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.matched, 1);
    assert.equal(dv.codeOnly, 1);
    const codeOnly = dv.items.find((i: any) => i.id === "retry_backoff");
    assert.equal(codeOnly.status, "code_only");
    assert.equal(codeOnly.specValue, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a requirement's test_artifact is scanned too, not only technical_artifact", () => {
  const dir = mkProject([richRow("REQ-001", "-", "test/a.spec.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "test/a.spec.ts", "// specgate:value session_timeout=15m\n");
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.matched, 1);
    assert.equal(dv.items[0].codeFile, "test/a.spec.ts");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a requirement with no matrix row is skipped, not crashed on", () => {
  const dir = mkProject([richRow("REQ-002", "src/other.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    const dv = buildReport(dir).declaredValues;
    assert.equal(dv.specOnly, 1);
    assert.equal(dv.items[0].codeFile, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("HTML shows the section and a tile only when something was declared", () => {
  const clean = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    const html = renderHtml(buildReport(clean), { generatedAt: new Date(), history: [] });
    assert.doesNotMatch(html, /Declared values/);
  } finally {
    fs.rmSync(clean, { recursive: true, force: true });
  }

  const withValues = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      withValues,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(withValues, "src/a.ts", "// specgate:value session_timeout=30m\n");
    const html = renderHtml(buildReport(withValues), { generatedAt: new Date(), history: [] });
    assert.match(html, /Declared values/);
    assert.match(html, /Value drift/);
    assert.match(html, /session_timeout/);
  } finally {
    fs.rmSync(withValues, { recursive: true, force: true });
  }
});

test("buildDeclaredValues is exported directly, for callers that already have items", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "// specgate:value session_timeout=15m\n");
    const report = buildReport(dir);
    const recomputed = buildDeclaredValues(dir, report.requirements);
    assert.deepEqual(recomputed, report.declaredValues);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sparkline draws a second series only when every history point has one", () => {
  const partial = [
    { implementedPct: 50, valuesTotal: 2, valuesMatched: 1 },
    { implementedPct: 60 },
  ];
  const full = [
    { implementedPct: 50, valuesTotal: 2, valuesMatched: 1 },
    { implementedPct: 60, valuesTotal: 4, valuesMatched: 4 },
  ];
  const noValues: any[] = [{ implementedPct: 50 }, { implementedPct: 60 }];

  const partialSvg = sparkline(partial);
  const fullSvg = sparkline(full);
  const noneSvg = sparkline(noValues);

  // One polyline for coverage always; a second, dashed one only for `full`.
  assert.equal((noneSvg.match(/<polyline/g) || []).length, 1);
  assert.equal((partialSvg.match(/<polyline/g) || []).length, 1);
  assert.equal((fullSvg.match(/<polyline/g) || []).length, 2);
  assert.match(fullSvg, /stroke-dasharray/);
});

test("--record appends valuesTotal/valuesMatched/valuesDiverging additively", () => {
  const dir = mkProject([richRow("REQ-001", "src/a.ts")]);
  try {
    writeCapabilitySpec(
      dir,
      "auth",
      [
        "# Auth",
        "## Requirements",
        "### Requirement: REQ-001 — Login",
        "The system SHALL expire the session after 15 minutes.",
        "<!-- specgate:trace value_session_timeout=15m -->",
      ].join("\n")
    );
    writeCode(dir, "src/a.ts", "// specgate:value session_timeout=15m\n");

    // A history line written before this feature existed — no values fields
    // at all — has to survive being read alongside a new-format line.
    const historyPath = path.join(dir, "reports", "spec-coverage-history.jsonl");
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(
      historyPath,
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        total: 1,
        implemented: 0,
        implementedPct: 0,
      }) + "\n"
    );

    const r = cli("report", "--project-dir", dir, "--record", "--json", "--stdout");
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const lines = fs
      .readFileSync(historyPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].valuesTotal, undefined);
    assert.equal(lines[1].valuesTotal, 1);
    assert.equal(lines[1].valuesMatched, 1);
    assert.equal(lines[1].valuesDiverging, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
