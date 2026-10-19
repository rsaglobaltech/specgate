"use strict";

/**
 * Unit tests for the `report` command (spec-coverage dashboard, C1 / P5).
 *
 * Exercise the pure builders and renderers (buildReport, renderHtml,
 * renderJson, readSpecops, sparkline) against synthetic project trees. The
 * CLI wiring is covered by the top-level smoke.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildReport,
  renderHtml,
  renderJson,
  readSpecops,
  sparkline,
} = require("../../scripts/report");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function richRow(req: string, feature: string, tech: string, test: string, status: string) {
  return `| ${req} | SCN-${req} | ${feature} | UC | Cmd | Agg | Evt | ${tech} | ${test} | ${status} |`;
}

function mkProject(rows: string[], extra: { files?: string[] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-test-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "features", "core"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [RICH_HEADER, RICH_SEP, ...rows].join("\n")
  );
  for (const rel of extra.files || []) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "x");
  }
  return dir;
}

// ── buildReport ────────────────────────────────────────────────────────────────────

test("buildReport computes implemented percentage from DONE requirements", () => {
  const dir = mkProject(
    [
      richRow("REQ-001", "features/core/a.feature", "src/A.js", "src/A.test.js", "Implemented"),
      richRow("REQ-002", "features/core/b.feature", "src/B.js", "src/B.test.js", "Draft"),
    ],
    {
      files: [
        "features/core/a.feature",
        "src/A.js",
        "src/A.test.js",
        "features/core/b.feature",
        "src/B.js",
        "src/B.test.js",
      ],
    }
  );
  const r = buildReport(dir);
  assert.equal(r.total, 2);
  assert.equal(r.implemented, 1);
  assert.equal(r.pending, 1);
  assert.equal(r.implementedPct, 50);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildReport lists REQs whose test artifact is missing", () => {
  const dir = mkProject(
    [
      richRow("REQ-001", "features/core/a.feature", "src/A.js", "src/A.test.js", "Draft"),
      richRow("REQ-002", "features/core/b.feature", "src/B.js", "src/MISSING.test.js", "Draft"),
    ],
    {
      files: [
        "features/core/a.feature",
        "src/A.js",
        "src/A.test.js",
        "features/core/b.feature",
        "src/B.js",
      ],
    }
  );
  const r = buildReport(dir);
  assert.deepEqual(r.needsTest, ["REQ-002"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildReport reports orphan feature files on disk", () => {
  const dir = mkProject(
    [richRow("REQ-001", "features/core/a.feature", "src/A.js", "src/A.test.js", "Implemented")],
    {
      files: [
        "features/core/a.feature",
        "src/A.js",
        "src/A.test.js",
        "features/core/orphan.feature",
      ],
    }
  );
  const r = buildReport(dir);
  assert.deepEqual(r.orphanFeatures, ["features/core/orphan.feature"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildReport handles an empty matrix without dividing by zero", () => {
  const dir = mkProject([]);
  const r = buildReport(dir);
  assert.equal(r.total, 0);
  assert.equal(r.implementedPct, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── readSpecops ────────────────────────────────────────────────────────────────────

test("readSpecops flags a missing baseline as drift when packs are present", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-specops-"));
  fs.writeFileSync(
    path.join(dir, ".specops.lock"),
    JSON.stringify({ packs: [{ pack: "healthcare-hie/backend", version: "v0.1.0" }] })
  );
  const s = readSpecops(dir);
  assert.equal(s.used, true);
  assert.equal(s.packs[0].pack, "healthcare-hie/backend");
  assert.equal(s.baselinePresent, false);
  assert.match(s.drift[0], /baseline/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("readSpecops reports no drift when baseline exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-specops-"));
  fs.writeFileSync(
    path.join(dir, ".specops.lock"),
    JSON.stringify({ packs: [{ pack: "p", version: "v1" }] })
  );
  fs.mkdirSync(path.join(dir, ".specops", "baseline"), { recursive: true });
  const s = readSpecops(dir);
  assert.equal(s.baselinePresent, true);
  assert.deepEqual(s.drift, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("readSpecops treats a project without a lockfile as pack-free", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-nolock-"));
  const s = readSpecops(dir);
  assert.equal(s.used, false);
  assert.deepEqual(s.drift, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── rendering ──────────────────────────────────────────────────────────────────────

test("renderHtml is self-contained — no external requests", () => {
  const report = {
    projectDir: "/tmp/demo",
    total: 1,
    implemented: 1,
    pending: 0,
    implementedPct: 100,
    byCategory: { DONE: 1 },
    needsTest: [],
    orphanFeatures: [],
    specops: { used: false, packs: [], baselinePresent: true, drift: [] },
    requirements: [
      {
        requirement: "REQ-001",
        status: "Implemented",
        feature_exists: true,
        test_exists: true,
        technical_exists: true,
        category: "DONE",
      },
    ],
  };
  const html = renderHtml(report, { generatedAt: new Date("2026-07-03T00:00:00Z"), history: [] });
  assert.match(html, /<!doctype html>/);
  assert.match(html, /REQ-001/);
  assert.match(html, /100%/);
  // No CDN scripts, stylesheets, remote images or fetches.
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<script|<link|src=/);
  fs.rmSync("/tmp/demo", { recursive: true, force: true });
});

test("renderHtml escapes requirement values", () => {
  const report = {
    projectDir: "/tmp/demo",
    total: 1,
    implemented: 0,
    pending: 1,
    implementedPct: 0,
    byCategory: {},
    needsTest: ["REQ-001"],
    orphanFeatures: [],
    specops: { used: false, packs: [], baselinePresent: true, drift: [] },
    requirements: [
      {
        requirement: "<script>x</script>",
        status: "Draft",
        feature_exists: false,
        test_exists: false,
        technical_exists: false,
        category: "NEEDS_EVERYTHING",
      },
    ],
  };
  const html = renderHtml(report, { generatedAt: new Date(0), history: [] });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>x<\/script>/);
});

test("renderJson round-trips the report structure", () => {
  const report = { total: 3, implementedPct: 66.7 };
  const parsed = JSON.parse(renderJson(report));
  assert.equal(parsed.total, 3);
  assert.equal(parsed.implementedPct, 66.7);
});

test("sparkline draws a polyline only with 2+ history points", () => {
  assert.equal(sparkline([]), "");
  assert.equal(sparkline([{ implementedPct: 50 }]), "");
  const svg = sparkline([{ implementedPct: 0 }, { implementedPct: 50 }, { implementedPct: 100 }]);
  assert.match(svg, /<svg/);
  assert.match(svg, /<polyline/);
});
