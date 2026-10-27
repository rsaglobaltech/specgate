"use strict";

/**
 * REQ-190..192 — evolving a delivered specification.
 *
 * A design change over nineteen delivered requirements could only be written
 * as new requirements; a MODIFIED delta meant copying a requirement by hand;
 * nothing said what a change to a requirement touches; and a new requirement
 * for a module already archived did not start from the brief.
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

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

const FICHAS = [
  "# fichas",
  "",
  "### Requirement: REQ-017 — Cambios de marcha",
  "",
  "The system SHALL teach the reference speeds of the gears.",
  "",
  "#### Scenario: SCN-048 — Tabla de referencia",
  "",
  "- GIVEN the Fahrschüler is on Mi tarjeta",
  "- WHEN they open the ficha Schaltübungen",
  "- THEN they see 1ª arrancar and 4ª 50 km/h",
  "",
  "<!-- specgate:trace actor=Fahrschüler feature=features/fichas/REQ-017.feature kind=business-rule status=Implemented -->",
  "",
  "### Requirement: REQ-018 — Reducir para girar",
  "",
  "The system SHALL teach to brake first, then 2ª, naming REQ-017's table.",
  "",
  "#### Scenario: SCN-051 — Frenar primero",
  "",
  "- GIVEN the Fahrschüler is on the ficha Abbiegen",
  "- WHEN they open Cómo se hace",
  "- THEN step 1 is to brake",
  "",
  "<!-- specgate:trace actor=Fahrschüler feature=features/fichas/REQ-018.feature kind=business-rule status=Implemented -->",
  "",
].join("\n");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evolve-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w("docs/specs/capabilities/fichas/spec.md", FICHAS);
  w("features/fichas/REQ-017.feature", "Feature: gears\n");
  w("tests/fichas.test.ts", "// REQ-017 SCN-048\n");
  w("src/FichasContent.ts", "export const gears = 1;\n");
  w(
    "docs/brief.md",
    "---\nactors:\n  - { name: Fahrschüler, surfaces: [web] }\nmodules: [fichas, examen]\n---\n\n# Brief\n\nFichas y examen.\n"
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  fs.appendFileSync(path.join(dir, "src/FichasContent.ts"), "export const four = 50;\n");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "feat(REQ-017): gear table");
  return dir;
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

test("REQ-190 SCN-190a: --modify copies the requirement into a MODIFIED delta and reopens it alone", () => {
  const dir = project();
  try {
    const r = cli(dir, "change", "new", "gears", "--modify", "REQ-017");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const delta = read(dir, "docs/specs/changes/gears/specs/fichas/spec.md");
    assert.match(delta, /## MODIFIED Requirements/);
    assert.match(delta, /### Requirement: REQ-017 — Cambios de marcha/);
    assert.match(delta, /The system SHALL teach the reference speeds of the gears\./);
    assert.match(delta, /#### Scenario: SCN-048 — Tabla de referencia/);
    assert.match(delta, /status=Draft/);
    assert.doesNotMatch(delta, /REQ-018/, "only the requirement asked for");
    assert.match(
      read(dir, "docs/specs/capabilities/fichas/spec.md"),
      /REQ-018[\s\S]*status=Implemented/
    );
    const v = cli(dir, "change", "validate", "gears");
    assert.equal(v.status, 0, v.stdout + v.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-190 SCN-190b: a requirement nowhere, or already modified by an open change, is refused", () => {
  const dir = project();
  try {
    const none = cli(dir, "change", "new", "other", "--modify", "REQ-999");
    assert.notEqual(none.status, 0);
    assert.match(none.stdout + none.stderr, /REQ-999 is not in a capability spec/);
    assert.equal(fs.existsSync(path.join(dir, "docs/specs/changes/other")), false);

    assert.equal(cli(dir, "change", "new", "gears", "--modify", "REQ-017").status, 0);
    const twice = cli(dir, "change", "new", "other", "--modify", "REQ-017");
    assert.notEqual(twice.status, 0);
    assert.match(twice.stdout + twice.stderr, /gears already modifies REQ-017/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-191 SCN-191a: the impact of one requirement", () => {
  const dir = project();
  try {
    const r = cli(dir, "change", "impact", "REQ-017", "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [i] = JSON.parse(r.stdout).impact;
    assert.equal(i.requirement, "REQ-017");
    assert.deepEqual(i.spec, { file: "docs/specs/capabilities/fichas/spec.md", line: 3 });
    assert.deepEqual(i.features, ["features/fichas/REQ-017.feature"]);
    assert.deepEqual(i.tests, ["tests/fichas.test.ts"]);
    assert.deepEqual(i.files, ["src/FichasContent.ts"]);
    assert.deepEqual(i.namedBy, ["REQ-018"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-191 SCN-191b: the impact of a change", () => {
  const dir = project();
  try {
    assert.equal(
      cli(dir, "change", "new", "gears", "--modify", "REQ-017", "--modify", "REQ-018").status,
      0
    );
    const r = cli(dir, "change", "impact", "gears", "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(
      JSON.parse(r.stdout).impact.map((i: { requirement: string }) => i.requirement),
      ["REQ-017", "REQ-018"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-192 SCN-192a: a module already archived gets a change from the brief", () => {
  const dir = project();
  try {
    const r = cli(dir, "brief", "add", "fichas", "Subir de marcha paso a paso", "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const doc = JSON.parse(r.stdout).brief;
    assert.equal(doc.change, "fichas-additions");
    const brief = read(dir, "docs/brief.md");
    assert.match(brief, /## Additions/);
    assert.match(brief, /- fichas \(\d{4}-\d{2}-\d{2}\): Subir de marcha paso a paso/);
    const delta = read(dir, "docs/specs/changes/fichas-additions/specs/fichas/spec.md");
    assert.match(delta, /## ADDED Requirements/);
    assert.match(delta, new RegExp(`### Requirement: ${doc.requirement} — `));
    assert.match(delta, /> Brief: "Subir de marcha paso a paso"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-192 SCN-192b: a module with an open change grows it, with the next free id of its range", () => {
  const dir = project();
  try {
    assert.equal(cli(dir, "brief", "add", "examen", "Situaciones de noche").status, 0);
    const first = read(dir, "docs/specs/changes/examen-additions/specs/examen/spec.md");
    const ids = [...first.matchAll(/### Requirement: (REQ-\d+)/g)].map((m) => m[1]);
    assert.equal(ids.length, 1);
    const again = cli(dir, "brief", "add", "examen", "Situaciones con lluvia", "--json");
    assert.equal(again.status, 0, again.stdout + again.stderr);
    const second = read(dir, "docs/specs/changes/examen-additions/specs/examen/spec.md");
    const ids2 = [...second.matchAll(/### Requirement: (REQ-\d+)/g)].map((m) => m[1]);
    assert.equal(ids2.length, 2);
    assert.equal(Number(ids2[1].slice(4)), Number(ids2[0].slice(4)) + 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-192 SCN-192c: an unknown module is refused, and nothing is written", () => {
  const dir = project();
  try {
    const before = read(dir, "docs/brief.md");
    const r = cli(dir, "brief", "add", "garaje", "x");
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /fichas, examen/);
    assert.equal(read(dir, "docs/brief.md"), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-198 SCN-198a: the in-flight view says which requirements a change modifies", () => {
  const dir = project();
  try {
    assert.equal(cli(dir, "change", "new", "gears", "--modify", "REQ-017").status, 0);
    const { inFlightRequirements } = require("../../scripts/lib/in-flight");
    const r17 = inFlightRequirements(dir).find((r: { id: string }) => r.id === "REQ-017");
    assert.equal(r17.op, "modified");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
