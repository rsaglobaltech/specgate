"use strict";

/**
 * REQ-551, REQ-552 — a change as a page for people outside the repository,
 * and journeys that chain requirements and owe a test (change business-review).
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
const { escapeHtml, renderReviewPage } = require("../../packages/core/src/domain/ReviewPage");
const { journeyFindings, journeysIn } = require("../../packages/core/src/domain/Journeys");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true });
});

function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-review-"));
  madeDirs.push(parent);
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}
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

// ── REQ-551 ─────────────────────────────────────────────────────────────────

test("REQ-551 SCN-551a: a page that opens without a network", () => {
  const dir = project();
  assert.equal(sg(dir, "propose", "pdf-invoices", "--json").status, 0);
  const id = /req_range: \[(REQ-\d+)/.exec(
    fs.readFileSync(path.join(dir, "docs/specs/changes/pdf-invoices/change.yaml"), "utf8")
  )![1];
  put(
    dir,
    "docs/specs/changes/pdf-invoices/specs/pdf-invoices/spec.md",
    `# Delta — pdf-invoices\n\n## ADDED Requirements\n\n### Requirement: ${id} — Invoices download as PDF\n\n` +
      "The system SHALL offer an invoice as a PDF.\n\n" +
      `#### Scenario: SCN-${id.slice(4)}a — A paid invoice\n\n- GIVEN a paid invoice\n- WHEN its owner downloads it\n- THEN a PDF arrives\n\n` +
      "<!-- specgate:trace status=Draft actor=Customer kind=functional -->\n"
  );
  put(
    dir,
    "docs/specs/changes/pdf-invoices/questions.md",
    "# Questions — pdf-invoices\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n" +
      `| Q1 | Does an unpaid invoice <script>alert(1)</script> download too? | ${id} |  |  | open |\n`
  );
  const r = sg(dir, "review", "pdf-invoices", "--out", "review.html", "--json");
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(path.join(dir, "review.html"), "utf8");
  assert.match(html, /Invoices download as PDF/);
  assert.match(
    html,
    /<li>Given a paid invoice<\/li><li>When its owner downloads it<\/li><li>Then a PDF arrives<\/li>/
  );
  assert.match(
    html,
    /Does an unpaid invoice &lt;script&gt;alert\(1\)&lt;\/script&gt; download too\?/
  );
  assert.doesNotMatch(html, /<script/i, "nothing runs");
  assert.doesNotMatch(html, /\b(src|href)\s*=/i, "nothing loads from outside the file");
  assert.doesNotMatch(html, /<link\b|@import|url\(/i);

  const missing = sg(dir, "review", "nope", "--json");
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).status[0].code, "change_not_found");
});

test("REQ-551: every value is escaped", () => {
  assert.equal(
    escapeHtml(`<a href="x">'&'</a>`),
    "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
  );
  const page = renderReviewPage({
    change: "c",
    title: "<b>T</b>",
    intent: "",
    kind: "bug",
    requirements: [],
    questions: [],
    assumptions: ["We assume <img src=x>"],
    date: "2026-11-14",
    commit: "0123456789abcdef",
  });
  assert.doesNotMatch(page, /<b>T<\/b>|<img/);
  assert.match(page, /c · bug · 2026-11-14 · 0123456789ab/);
});

// ── REQ-552 ─────────────────────────────────────────────────────────────────

const JOURNEY =
  "Feature: Library\n\n  @JRN-001 @REQ-002 @REQ-003\n  Scenario: Borrow then return\n" +
  "    Given a member\n    When they borrow a book and return it\n    Then the book is available again\n";

/** Two Implemented requirements, each with a test, and a journey across them. */
function library(journey = JOURNEY) {
  const dir = project();
  const req = (id: string, title: string) =>
    `\n## ${id} — ${title}\n\n<!-- specgate:trace status=Implemented -->\n\nThe system SHALL ${title.toLowerCase()}.\n`;
  fs.appendFileSync(
    path.join(dir, "spec.md"),
    req("REQ-002", "Lend a book") + req("REQ-003", "Take a book back")
  );
  put(
    dir,
    "features/library/lend.feature",
    "Feature: Lend\n\n  @REQ-002 @SCN-002\n  Scenario: A member borrows an available book\n    Given a book\n    When it is lent\n    Then it is out\n\n" +
      "  @REQ-003 @SCN-003\n  Scenario: A member brings a borrowed book back\n    Given a lent book\n    When it is returned\n    Then it is in\n"
  );
  put(dir, "features/library/journey.feature", journey);
  put(dir, "tests/lend.test.js", "// REQ-002 SCN-002\n// REQ-003 SCN-003\n");
  assert.equal(sg(dir, "matrix").status, 0);
  return dir;
}

test("REQ-552 SCN-552a: borrow then return", () => {
  const dir = library();
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 1, r.out);
  const found = JSON.parse(r.stdout).status.filter(
    (d: { code: string }) => d.code === "journey_untested"
  );
  assert.deepEqual(
    found.map((d: { target: string }) => d.target),
    ["JRN-001"],
    r.out
  );

  const status = JSON.parse(sg(dir, "status", "--json").stdout);
  assert.deepEqual(
    status.journeys.map((j: { id: string; requirements: string[]; tests: string[] }) => [
      j.id,
      j.requirements,
      j.tests,
    ]),
    [["JRN-001", ["REQ-002", "REQ-003"], []]]
  );

  put(dir, "tests/journey.test.js", "// JRN-001: borrow then return, end to end\n");
  assert.equal(sg(dir, "matrix").status, 0);
  const after = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(after.status, 0, after.out);
  assert.deepEqual(JSON.parse(sg(dir, "status", "--json").stdout).journeys[0].tests, [
    "tests/journey.test.js",
  ]);
});

test("REQ-552: a journey through a requirement nobody specified", () => {
  const dir = library(JOURNEY.replace("@REQ-003", "@REQ-404"));
  const r = sg(dir, "validate", ".", "--strict", "--json");
  const codes = JSON.parse(r.stdout).status.map((d: { code: string; target: string }) => [
    d.code,
    d.target,
  ]);
  assert.ok(
    codes.some(([c, t]: string[]) => c === "journey_requirement_unknown" && t === "REQ-404"),
    r.out
  );
});

test("REQ-552: a journey owes nothing until all its requirements are delivered", () => {
  const journeys = journeysIn([{ path: "f.feature", source: JOURNEY }]);
  assert.equal(journeys[0].line, 4);
  const status = new Map([
    ["REQ-002", "Implemented"],
    ["REQ-003", "Draft"],
  ]);
  assert.deepEqual(journeyFindings(journeys, status, []), []);
  assert.deepEqual(journeysIn([{ path: "f", source: "@REQ-001\nScenario: plain\n" }]), []);
});
