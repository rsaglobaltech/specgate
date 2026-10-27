"use strict";

/**
 * REQ-204..210 — the visual studio: approving and noting drafts from the CLI
 * the app runs, and the app's own reads and writes.
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

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const DELTA = [
  "# Delta — garaje",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-210 — Ver el horario del coche",
  "",
  "<!-- specgate:trace actor=Fahrschüler kind=functional status=Draft -->",
  "",
  "The system SHALL show when the school's car is free this week.",
  "",
  "#### Scenario: SCN-210 — El coche libre",
  "",
  "- GIVEN the car is free on Tuesday morning",
  "- WHEN the Fahrschüler opens Garaje",
  "- THEN they see Tuesday morning as free",
  "",
].join("\n");

/** A project with an open draft, draft-garaje, and an open question on it. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-studio-app-"));
  madeDirs.push(dir);
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w(
    "docs/specs/changes/draft-garaje/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\nreq_range: [REQ-210, REQ-212]\n"
  );
  w("docs/specs/changes/draft-garaje/specs/garaje/spec.md", DELTA);
  w(
    "docs/specs/changes/draft-garaje/questions.md",
    "# Questions — draft-garaje\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q1 | ¿Se reserva desde la app? | none | Solo consultar; Reservar |  | open |\n"
  );
  return dir;
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

test("REQ-206 SCN-206b: a draft with an open question is not approved", () => {
  const dir = project();
  const before = read(dir, "docs/specs/changes/draft-garaje/change.yaml");
  const r = cli(dir, "change", "approve", "draft-garaje");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Q1 is open/);
  assert.equal(read(dir, "docs/specs/changes/draft-garaje/change.yaml"), before);
});

test("REQ-206 SCN-206a: approving a ready draft records it, and the record survives a rewrite", () => {
  const dir = project();
  assert.equal(cli(dir, "answer", "Q1", "Solo consultar", "--change", "draft-garaje").status, 0);
  assert.equal(cli(dir, "answer", "Q1", "--reviewed", "--change", "draft-garaje").status, 0);
  const r = cli(dir, "change", "approve", "draft-garaje", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const today = new Date().toISOString().slice(0, 10);
  assert.match(
    read(dir, "docs/specs/changes/draft-garaje/change.yaml"),
    new RegExp(`^approved: ${today}$`, "m")
  );
  const { renderConfig } = require("../../packages/core/src/infrastructure/ChangeWorkspace");
  assert.match(renderConfig({ created: today, approved: today }), new RegExp(`approved: ${today}`));
});

test("REQ-207 SCN-207a: a note on a requirement goes to review.md", () => {
  const dir = project();
  const r = cli(
    dir,
    "change",
    "note",
    "draft-garaje",
    "Mejor",
    "2",
    "horas",
    "antes",
    "--req",
    "REQ-212"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const today = new Date().toISOString().slice(0, 10);
  assert.match(
    read(dir, "docs/specs/changes/draft-garaje/review.md"),
    new RegExp(`\\| ${today} \\| REQ-212 \\| Mejor 2 horas antes \\|`)
  );
  const { reviewNotes } = require("../../scripts/lib/change-review");
  assert.deepEqual(reviewNotes(dir, "draft-garaje"), [
    { date: today, requirement: "REQ-212", text: "Mejor 2 horas antes" },
  ]);
});
