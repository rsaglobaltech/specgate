"use strict";

/**
 * The evidence as one web page (REQ-818, change `evidence-html`): written
 * beside EVIDENCE.md on --html, pictures inside it, English, opened on --open
 * except where there is no browser.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli, json } from "../helpers/cli";

/** A real 1×1 PNG: what a screenshot is, at its smallest. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-html-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(path.join(change, "change.yaml"), "specgate_change_version: 1\nschema: layered\n");
  fs.writeFileSync(
    path.join(change, "specs", "orders", "spec.md"),
    [
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-031 — An order is paid <fast>",
      "",
      "<!-- specgate:trace actor=Member kind=functional -->",
      "",
      "The system SHALL take it.",
      "",
      "#### Scenario: SCN-031 — Paying",
      "",
      "- WHEN the member sends POST /api/orders",
      "- THEN the response is 201",
      "",
    ].join("\n")
  );
  const side = (rel: string, file: string) => {
    const folder = path.join(dir, ".specgate", "evidence", rel);
    fs.mkdirSync(path.join(folder, "artifacts", "paying"), { recursive: true });
    fs.writeFileSync(path.join(folder, "artifacts", "paying", "test-finished-1.png"), PNG);
    fs.writeFileSync(
      path.join(folder, file),
      JSON.stringify({ command: "bdd", exitCode: 0, artifacts: ["artifacts/paying/test-finished-1.png"] })
    );
  };
  side("REQ-031/before", "run.json");
  side("REQ-031", "evidence.json");
  return { dir, change };
}

test("REQ-818 SCN-818a: --html writes one page beside the Markdown, its pictures inside it", (t: TestContext) => {
  const { dir, change } = project(t);
  const r = cli("evidence", "draft-orders", "--html", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  assert.equal(doc.evidence.html, "docs/specs/changes/draft-orders/EVIDENCE.html");
  assert.equal(doc.evidence.opened, false);
  assert.ok(fs.existsSync(path.join(change, "EVIDENCE.md")));
  const html = fs.readFileSync(path.join(change, "EVIDENCE.html"), "utf8");
  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.equal((html.match(/src="data:image\/png;base64,/g) || []).length, 2, "before and after inside");
  assert.match(html, /An order is paid &lt;fast&gt;/, "escaped");
  assert.match(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@\d+\.\d+\.\d+\/dist\/mermaid\.min\.js">/);
  assert.match(html, /<pre class="mermaid">/);
  assert.doesNotMatch(html, /src="(?!data:|https:)/, "nothing it needs beside it");
  assert.doesNotMatch(html, /Antes|Después|Escenarios/, "English");
  assert.equal(cli("evidence", "draft-orders", "--html", "--project-dir", dir).stdout.includes("EVIDENCE.html"), true);
});

test("REQ-818: without --html no page is written; --open implies it and opens nothing without a browser", (t: TestContext) => {
  const { dir, change } = project(t);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  assert.ok(!fs.existsSync(path.join(change, "EVIDENCE.html")));
  const prior = process.env.SPECGATE_NO_OPEN;
  process.env.SPECGATE_NO_OPEN = "1";
  try {
    const r = cli("evidence", "draft-orders", "--open", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(json(r).evidence.opened, false);
    assert.ok(fs.existsSync(path.join(change, "EVIDENCE.html")));
  } finally {
    if (prior === undefined) delete process.env.SPECGATE_NO_OPEN;
    else process.env.SPECGATE_NO_OPEN = prior;
  }
});
