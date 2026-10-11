import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import * as assert from "node:assert/strict";

import { scanPacks } from "../../src/scan";
// `escape` must be imported by name: dropping it silently binds the JS global
// of the same name, which URL-encodes instead of HTML-escaping.
import { renderIndex, renderCard, escape } from "../../src/render";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const PACKS_DIR = path.join(REPO_ROOT, "packs");

// ── escape ────────────────────────────────────────────────────────────────────

test("escape converts HTML special chars", () => {
  assert.equal(escape("<script>"), "&lt;script&gt;");
  assert.equal(escape('a & "b"'), "a &amp; &quot;b&quot;");
});

test("escape handles null and undefined", () => {
  assert.equal(escape(null), "");
  assert.equal(escape(undefined), "");
});

// ── renderCard ────────────────────────────────────────────────────────────────

test("renderCard includes pack name, id, and counts", () => {
  const html = renderCard({
    id: "auth/backend",
    domain: "auth",
    name: "Auth Pack",
    description: "Auth description",
    version: "1.0.0",
    language: "en",
    project_type: "backend",
    requirements: 5,
    useCases: 5,
    aggregates: 2,
    events: 5,
    scenarios: 3,
    lintStatus: "pass",
    lintMessages: [],
  });
  assert.ok(html.includes("Auth Pack"));
  assert.ok(html.includes("auth/backend"));
  // stat chips: requirements=5, useCases=5, events=5 all render as stat__val spans
  assert.ok(html.includes('class="stat__val">5</span>'));
  assert.ok(html.includes("verified"));
});

test("renderCard shows lint warnings when present", () => {
  const html = renderCard({
    id: "x/y",
    name: "X",
    version: "1.0.0",
    language: "en",
    project_type: "backend",
    requirements: 1,
    useCases: 1,
    aggregates: 0,
    events: 0,
    scenarios: 1,
    lintStatus: "warn",
    lintMessages: ["Pack contains 3 TODO placeholder(s)."],
  });
  assert.ok(html.includes("warn"));
  assert.ok(html.includes("TODO placeholder"));
});

// ── renderIndex ───────────────────────────────────────────────────────────────

test("renderIndex emits valid HTML5", () => {
  const html = renderIndex([], { title: "Test", generated: "2026-01-01T00:00:00Z" });
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<title>Test</title>"));
  // count badge shows "0 shown" when there are no packs
  assert.ok(html.includes("0 shown"));
});

test("renderIndex shows verified count", () => {
  const packs = [
    {
      id: "a",
      name: "A",
      version: "1",
      language: "en",
      project_type: "backend",
      requirements: 1,
      useCases: 1,
      aggregates: 0,
      events: 0,
      scenarios: 1,
      lintStatus: "pass",
      lintMessages: [],
    },
    {
      id: "b",
      name: "B",
      version: "1",
      language: "en",
      project_type: "backend",
      requirements: 1,
      useCases: 1,
      aggregates: 0,
      events: 0,
      scenarios: 1,
      lintStatus: "warn",
      lintMessages: [],
    },
  ];
  const html = renderIndex(packs);
  // count badge shows total visible packs
  assert.ok(html.includes("2 shown"));

  // One of the two passes lint. Asserted on the fact rather than on the markup
  // that carries it — the previous version pinned the KPI tile's class names
  // and broke when the page adopted the documentation site's shell, which was
  // a presentation change and not a behaviour one.
  assert.match(html, /<dt>1<\/dt><dd>passing lint<\/dd>/);
  // Neither declares a tier, so both are starters and none is proven.
  assert.match(html, /<dt>0<\/dt><dd>proven in pilots<\/dd>/);
  assert.match(html, /<dt>2<\/dt><dd>starter examples<\/dd>/);
});

test("a proven pack's card says so and shows what proved it; a starter says it is an example", () => {
  const base = {
    name: "X",
    domain: "x",
    version: "1.0.0",
    language: "en",
    project_type: "backend",
    requirements: 1,
    useCases: 1,
    aggregates: 0,
    events: 0,
    scenarios: 1,
    lintStatus: "pass",
    lintMessages: [],
  };
  const proven = renderCard({
    ...base,
    id: "ledger/backend",
    tier: "proven",
    provenance: "Derived from the FinCore pilot: implemented and tested in Spring Boot.",
  });
  assert.match(proven, /Proven in a pilot/);
  assert.match(proven, /implemented and tested in Spring Boot/);
  const starter = renderCard({ ...base, id: "billing/backend", tier: "starter", provenance: "" });
  assert.match(starter, /Starter example/);
  assert.doesNotMatch(starter, /Proven/);
  // The word that overstated the eleven starters is gone from the page.
  assert.doesNotMatch(renderIndex([]), /[Cc]urated/);
});

test("the registry wears the same shell as the rest of the site", () => {
  // It used to carry its own top bar, its own footer and a second hardcoded
  // palette that ignored the theme, so following a link to it looked like
  // arriving at a different product.
  const html = renderIndex([]);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/docs\.css">/);
  assert.match(html, /class="top"/, "no site header");
  assert.match(html, /class="top__theme"/, "no theme toggle, so the page cannot follow the site");
  assert.match(html, /class="foot"/, "no site footer");
  assert.match(html, /href="\.\.\/docs\.html"/, "no way back into the documentation");
  assert.doesNotMatch(html, /--bg:\s*#/, "a second hardcoded palette has come back");
});

// ── scanPacks (integration with the real packs/ dir) ──────────────────────────

test("scanPacks discovers the 7 proven packs, first, and the 11 starter examples", () => {
  const packs = scanPacks(PACKS_DIR);
  assert.equal(
    packs.length,
    18,
    `expected 18 packs, found ${packs.length}: ${packs.map((p) => p.id).join(", ")}`
  );
  const proven = packs.filter((p) => p.tier === "proven").map((p) => p.id);
  assert.deepEqual(proven.sort(), [
    "appointment-booking/backend",
    "clinical-record/backend",
    "event-registration/backend",
    "ledger/backend",
    "shop-orders/backend",
    "time-attendance/backend",
    "transfers/backend",
  ]);
  // Proven first: the reader sees what they can build on before the examples.
  assert.ok(
    packs.slice(0, 7).every((p) => p.tier === "proven"),
    packs.map((p) => p.id).join(", ")
  );
  const ids = packs.map((p) => p.id);
  assert.ok(ids.includes("auth/backend"));
  assert.ok(ids.includes("billing/backend"));
  assert.ok(ids.includes("audit-log/backend"));
  assert.ok(ids.includes("notifications/backend"));
  assert.ok(ids.includes("feature-flags/backend"));
  assert.ok(ids.includes("multi-tenant/backend"));
  assert.ok(ids.includes("file-storage/backend"));
  assert.ok(ids.includes("search/backend"));
  assert.ok(ids.includes("reporting/backend"));
  assert.ok(ids.includes("webhooks/backend"));
  assert.ok(ids.includes("sample-contracts/contracts"));
});

test("scanPacks marks every shipped pack as verified (lintStatus=pass)", () => {
  const packs = scanPacks(PACKS_DIR);
  for (const p of packs) {
    assert.equal(
      p.lintStatus,
      "pass",
      `${p.id} should pass lint, got ${p.lintStatus}: ${p.lintMessages.join("; ")}`
    );
  }
});

test("scanPacks throws when packsRoot does not exist", () => {
  assert.throws(() => scanPacks("/no/such/dir"), /does not exist/);
});

test("scanPacks returns empty array when packsRoot has no packs", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "empty-packs-"));
  try {
    assert.deepEqual(scanPacks(empty), []);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
