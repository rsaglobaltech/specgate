"use strict";

/**
 * REQ-178 — Three papercuts an adopter hit on a first project.
 *
 * - A brief written in the first person ("Soy hispanohablante… quiero una
 *   web personal") was warned that its one declared actor is never named.
 * - `harness init --project-dir .`, run to register the merge drivers, refused
 *   because the prompt prefix it said to edit had been edited; `--force` would
 *   have thrown the edit away.
 * - `validate --strict` with no directory printed the whole CLI help.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { CliResult } from "../helpers/cli";
const { checkBrief } = require("../../scripts/draft/brief-check");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const firstPerson = (actors: string) => `---
product: fuhrerschein-app
surfaces: [web]
actors:
${actors}
modules: [tarjeta]
---

# Brief

Soy hispanohablante y estoy sacando el carnet de conducir. Quiero una web personal para
preparar mis clases y registrar lo que voy logrando. Después de la clase marco lo que el
profesor tachó.
`;

const b9 = (text: string) =>
  checkBrief(text, "docs/brief.md").filter((d: { code: string }) => d.code === "B9_actor_unnamed");

test("REQ-178 SCN-178a: a first-person brief with one actor is not warned about it", () => {
  assert.equal(b9(firstPerson("  - { name: Fahrschüler, surfaces: [web] }")).length, 0);
});

test("REQ-178 SCN-178a: with two actors, the one never named is still warned", () => {
  const found = b9(
    firstPerson("  - { name: Fahrschüler, surfaces: [web] }\n  - { name: Prüfer, surfaces: [web] }")
  );
  assert.deepEqual(
    found.map((d: { target: string }) => d.target.toLowerCase()),
    ["fahrschüler", "prüfer"]
  );
  assert.match(found[0].fix, /first person/);
});

function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-papercuts-"));
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

const harnessInit = (projectDir: string, ...args: string[]): CliResult =>
  spawnSync(process.execPath, [CLI, "harness", "init", ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });

test("REQ-178 SCN-178b: harness init keeps a prompt prefix you edited", () => {
  const { parent, projectDir } = scaffold();
  try {
    assert.equal(harnessInit(projectDir).status, 0);
    const prefix = path.join(projectDir, ".harness", "prompt-prefix.md");
    const edited = fs.readFileSync(prefix, "utf8") + "\n# Our rules\n\n- Business logic in core.\n";
    fs.writeFileSync(prefix, edited, "utf8");

    const again = harnessInit(projectDir, "--project-dir", ".");
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.equal(fs.readFileSync(prefix, "utf8"), edited, "the edited prefix must survive");
    assert.match(again.stdout + again.stderr, /prompt-prefix\.md/);
    assert.match(again.stdout + again.stderr, /kept/);

    const forced = harnessInit(projectDir, "--force");
    assert.equal(forced.status, 0, forced.stderr);
    assert.doesNotMatch(fs.readFileSync(prefix, "utf8"), /# Our rules/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-178 SCN-178c: validate with no directory names the one to pass", () => {
  const r = spawnSync(process.execPath, [CLI, "validate", "--strict"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /expects exactly one positional argument/);
  assert.match(r.stderr, /specgate validate \. --strict/);
});
