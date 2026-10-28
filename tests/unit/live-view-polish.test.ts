"use strict";

/**
 * REQ-179 — The live view reads at a glance.
 *
 * The first live view listed every requirement the same way, mixed what was
 * running with what had finished, and named requirements by id alone. An
 * adopter watching a nineteen-requirement run could not tell what the agent
 * was doing now, nor how far the run had got.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readLive } = require("../../scripts/lib/live-model");
const { livePage } = require("../../scripts/lib/live-page");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-live-polish-"));
  fs.mkdirSync(path.join(dir, ".harness", "events"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "specs", "changes", "draft-diario", "specs", "diario"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    "# Spec\n\n## REQ-001 — Existing behaviour is preserved\n\nText.\n"
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "changes", "draft-diario", "specs", "diario", "spec.md"),
    "# Delta\n\n## ADDED Requirements\n\n### Requirement: REQ-022 — Registrar una clase con su fecha\n\nText.\n"
  );
  // DRAFTING.md carries an example requirement with a placeholder title.
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "changes", "draft-diario", "DRAFTING.md"),
    "### Requirement: REQ-022 — <a short name>\n"
  );
  const events = (req: string, lines: object[]) =>
    fs.writeFileSync(
      path.join(dir, ".harness", "events", `${req}.jsonl`),
      lines.map((l) => JSON.stringify({ req, ...l })).join("\n") + "\n"
    );
  return { dir, events };
}

test("REQ-179 SCN-179a: each requirement in the live model carries its title", () => {
  const { dir, events } = project();
  try {
    events("REQ-022", [
      { t: 100, attempt: 1, type: "attempt", state: "start" },
      { t: 110, attempt: 1, type: "message", text: "Reading the use case." },
    ]);
    events("REQ-001", [
      { t: 50, attempt: 1, type: "attempt", state: "start" },
      { t: 60, attempt: 1, type: "attempt", state: "end", result: "pass" },
    ]);
    const model = readLive(dir);
    const byReq = Object.fromEntries(
      model.requirements.map((r: { req: string; title: string }) => [r.req, r.title])
    );
    assert.equal(byReq["REQ-022"], "Registrar una clase con su fecha");
    assert.equal(byReq["REQ-001"], "Existing behaviour is preserved");
    const groups = Object.fromEntries(
      model.requirements.map((r: { req: string; group: string }) => [r.req, r.group])
    );
    assert.equal(groups["REQ-022"], "diario", "a draft's module names its group");
    assert.equal(groups["REQ-001"], "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-179 SCN-179a: an id the specification does not hold has an empty title", () => {
  const { dir, events } = project();
  try {
    events("REQ-404", [{ t: 1, attempt: 1, type: "attempt", state: "start" }]);
    assert.equal(readLive(dir).requirements[0].title, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-179 SCN-179b: the page reads like a CI run: requirements by module, the run's summary, its graph of jobs, the steps of one", () => {
  const html = livePage("fuhrerschein-app");
  for (const id of [
    'id="jobs"',
    'id="progress"',
    'id="chain"',
    'id="focus"',
    'id="pipeline"',
    '"feed"',
  ]) {
    assert.ok(html.includes(id), id);
  }
  for (const stage of ["Agent", "Specification", "Architecture", "Tests", "Merge"]) {
    assert.ok(html.includes(stage), stage);
  }
  // Self-contained, and nothing from an event is ever parsed as HTML.
  assert.doesNotMatch(html, /<link |<script src=|https?:\/\//);
  assert.doesNotMatch(html, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /prefers-color-scheme/);
  assert.match(html, /createElementNS/, "the graph is SVG built node by node");
});

test("REQ-179: the project name is escaped in the page", () => {
  const html = livePage('<img src=x onerror="alert(1)">');
  assert.doesNotMatch(html, /<img src=x/);
});
