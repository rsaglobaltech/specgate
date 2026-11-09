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

// The new studio's Live, rendered to text (REQ-433): the live view the old page was.
const studio = require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));
const NOW = 1_800_000_000;
const liveModel = (reqs: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  requirements: reqs,
  queue: [],
  queueStarted: 0,
  totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, turns: 0 },
  questions: { open: [], waitingWithoutQuestion: [] },
  ...extra,
});
const running = (extra: Record<string, unknown> = {}) => ({
  req: "REQ-022",
  title: "Registrar una clase",
  group: "diario",
  attempt: 1,
  phase: "gate",
  state: "running",
  started: NOW - 120,
  updated: NOW,
  elapsed: 120,
  tests: null,
  files: [],
  steps: [{ type: "gate-start", stage: "tests", t: NOW - 20 }],
  agent: null,
  usage: null,
  prompt: null,
  question: null,
  running: { stage: "tests", since: NOW - 20, runner: "host", image: "" },
  ...extra,
});

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
  // Live in the app: requirements by module, the run's summary, the steps of the one opened.
  const html: string = studio.renderLive("en", liveModel([running()]), "open", NOW, []);
  assert.match(html, /<dl class="run-sum" aria-label="Summary">/);
  assert.match(
    html,
    /id="chain" role="group"/,
    "the run by module (REQ-181 replaced the graph of jobs)"
  );
  assert.match(html, /<span class="mm-name">diario<\/span>/);
  for (const stage of ["Agent", "Specification", "Architecture", "Merge"]) {
    assert.match(html, new RegExp(`>${stage}<`), stage);
  }
  assert.match(html, /<li class="pl pl-running" aria-current="step">[^]*?tests</);
  assert.match(html, /class="term"/, "the log of the step in progress");
  // Self-contained, and nothing from an event is ever read as HTML: it goes in as text.
  assert.doesNotMatch(html, /<link |<script|https?:\/\//);
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "studio", "app.css"), "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /prefers-color-scheme/);
  const evil: string = studio.renderLive(
    "en",
    liveModel([
      running({
        steps: [{ type: "step", kind: "edit", target: "<img src=x onerror=alert(1)>", t: NOW }],
      }),
    ]),
    "open",
    NOW,
    []
  );
  assert.doesNotMatch(evil, /<img src=x/);
  assert.match(evil, /&lt;img src=x/);
});

test("REQ-179: the project name is escaped in the page", () => {
  const { studioShell } = require("../../scripts/lib/studio-shell");
  const html = studioShell('<img src=x onerror="alert(1)">', "ab12", "live");
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(
    studio.renderShell("live", studio.DEFAULTS, '<img src=x onerror="alert(1)">'),
    /<img src=x/
  );
});
