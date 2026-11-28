"use strict";

/**
 * One page shows a change's evidence (ADR-0047, REQ-807): EVIDENCE.md, each
 * requirement's before and after side by side, its diagrams, what is missing.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli, json } from "../helpers/cli";

const DELTA = [
  "# Delta — orders",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-031 — An order is paid",
  "",
  "<!-- specgate:trace actor=Member kind=functional -->",
  "",
  "The system SHALL take the order.",
  "",
  "#### Scenario: SCN-031 — Paying",
  "",
  "- GIVEN a cart with 2 books",
  "- WHEN the member sends POST /api/orders",
  "- THEN the response is 201",
  "",
  "### Requirement: REQ-032 — An order is refunded",
  "",
  "<!-- specgate:trace actor=Member kind=functional -->",
  "",
  "The system SHALL refund the order.",
  "",
  "#### Scenario: SCN-032 — Refunding",
  "",
  "- WHEN the member sends POST /api/refunds",
  "- THEN the response is 200",
  "",
].join("\n");

/** A run as evidence keeps it: its json, and its artifacts on disk. */
function run(dir: string, rel: string, file: string, artifacts: Record<string, number>) {
  const folder = path.join(dir, ".specgate", "evidence", rel);
  fs.mkdirSync(folder, { recursive: true });
  for (const [a, size] of Object.entries(artifacts)) {
    const to = path.join(folder, a);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, Buffer.alloc(size, 1));
  }
  const doc = {
    command: "node bdd.js @REQ",
    exitCode: rel.endsWith("before") ? 1 : 0,
    artifacts: Object.keys(artifacts).sort(),
    ...(file === "evidence.json" ? { scenarios: { exitCode: 0 } } : {}),
  };
  fs.writeFileSync(path.join(folder, file), JSON.stringify(doc));
}

function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-page-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(
    path.join(change, "change.yaml"),
    "specgate_change_version: 1\nschema: layered\n"
  );
  fs.writeFileSync(path.join(change, "specs", "orders", "spec.md"), DELTA);
  // REQ-031: a before and an after, each with a screenshot and a video; one picture too big.
  run(dir, "REQ-031/before", "run.json", {
    "artifacts/paying-chromium/test-finished-1.png": 100,
    "artifacts/paying-chromium/video.webm": 50,
  });
  run(dir, "REQ-031", "evidence.json", {
    "artifacts/paying-chromium/test-finished-1.png": 120,
    "artifacts/paying-chromium/huge.png": 400 * 1024,
    "artifacts/paying-chromium/trace.zip": 10,
  });
  // REQ-032: delivered, no before.
  run(dir, "REQ-032", "evidence.json", {});
  return { dir, change };
}

test("REQ-807 SCN-807a: one before, one missing", (t: TestContext) => {
  const { dir, change } = project(t);
  const r = cli("evidence", "draft-orders", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  assert.equal(doc.evidence.file, "docs/specs/changes/draft-orders/EVIDENCE.md");
  assert.deepEqual(
    doc.evidence.requirements.map((q: { id: string; before: boolean; after: boolean }) => [
      q.id,
      q.before,
      q.after,
    ]),
    [
      ["REQ-031", true, true],
      ["REQ-032", false, true],
    ]
  );
  const page = fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8");
  // REQ-031: the last picture of each test, before and after, side by side.
  assert.match(page, /## REQ-031 — An order is paid/);
  assert.match(
    page,
    /\| Paying \| !\[before\]\(evidence\/REQ-031\/before\/paying-chromium\/test-finished-1\.png\) \| !\[after\]\(evidence\/REQ-031\/after\/paying-chromium\/test-finished-1\.png\) \|/
  );
  assert.ok(
    fs.existsSync(
      path.join(change, "evidence", "REQ-031", "after", "paying-chromium", "test-finished-1.png")
    )
  );
  assert.ok(
    !fs.existsSync(path.join(change, "evidence", "REQ-031", "after", "paying-chromium", "huge.png"))
  );
  assert.match(page, /huge\.png.*over 300 KB/);
  assert.match(
    page,
    /\.specgate\/evidence\/REQ-031\/before\/artifacts\/paying-chromium\/video\.webm/
  );
  assert.match(page, /\.specgate\/evidence\/REQ-031\/artifacts\/paying-chromium\/trace\.zip/);
  assert.match(
    page,
    /```mermaid\n%%\{init: \{"theme": "neutral"\}\}%%\nsequenceDiagram\n {2}title Paying/
  );
  assert.doesNotMatch(page, /At the base<\/summary>[\s\S]*?note for \w+ "new"[\s\S]*?<\/details>/);
  // REQ-032: what is missing, and how to get it.
  assert.match(page, /## REQ-032 — An order is refunded/);
  assert.match(page, /No before: `specgate evidence before REQ-032`/);
  assert.match(page, /No screenshots: `specgate doctor`/);
});

test("REQ-807: the page is written the same twice, and the change still validates", (t: TestContext) => {
  const { dir, change } = project(t);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  const first = fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8");
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  assert.equal(fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8"), first);
  const v = cli("change", "validate", "draft-orders", "--project-dir", dir, "--json");
  const codes = json(v).status.map((s: { code: string }) => s.code);
  assert.ok(
    !codes.some((c: string) => /evidence|unknown_file|unexpected/i.test(c)),
    codes.join(",")
  );
});

test("REQ-807: a change that does not exist is refused", (t: TestContext) => {
  const { dir } = project(t);
  const r = cli("evidence", "draft-nothing", "--project-dir", dir, "--json");
  assert.equal(r.status, 1);
  assert.equal(json(r).status[0].code, "evidence_no_change");
});
