/**
 * REQ-646: `status --json` carries what an open change proposes before archive
 * brings it in — its use cases, with their specification and activity, and the
 * state machine it writes, as it will be — each naming the change.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = path.join(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""),
  "bin",
  "specgate.js"
);

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-proposed-"));
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write("spec.md", "# Spec\n");
  write(
    "docs/specs/traceability.md",
    "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n| REQ-000 | SCN-000 | - | - | - | - | - | - | TBD | Draft |\n"
  );
  write(
    "docs/specs/use-cases.md",
    "# Use Cases\n\n| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |\n|---|---|---|---|---|---|---|---|\n| UC-001 | Describe the first use case | Primary actor | REQ-TBD | - | - | - | Draft |\n"
  );
  const c = "docs/specs/changes/draft-cuenta-perfiles";
  write(
    `${c}/use-cases.md`,
    "# Use cases — draft-cuenta-perfiles\n\n## ADDED Use Cases\n\n| ID | Use Case | Actor | Requirements |\n| --- | --- | --- | --- |\n| UC-002 | Crear la cuenta familiar | Tutor | REQ-001 |\n| UC-003 | Crear un perfil infantil | Tutor | REQ-002 |\n"
  );
  write(
    `${c}/use-cases/UC-002.md`,
    "# UC-002 — Crear la cuenta familiar\n\n## Overview\n\nUn adulto crea la cuenta.\n\n## Actors\n\n- Tutor\n- System\n\n## Main flow (SCN-001)\n\n1. Rellena el formulario.\n2. [System] Crea la cuenta.\n"
  );
  write(
    `${c}/state-machines/Cuenta.md`,
    "# Delta — Cuenta\n\n## ADDED States\n\n- Pendiente (initial)\n- Activa (final)\n\n## ADDED Transitions\n\n| From | To | Trigger | Requirement |\n|---|---|---|---|\n| Pendiente | Activa | verificar | REQ-001 |\n"
  );
  return dir;
}

const status = (dir: string) =>
  JSON.parse(
    spawnSync(process.execPath, [CLI, "status", "--json", "--project-dir", dir], {
      encoding: "utf8",
    }).stdout
  );

test("REQ-646 SCN-646a: the use cases and the state machine of an open change, before archive, each naming the change", () => {
  const dir = project();
  try {
    const doc = status(dir);
    assert.deepEqual(doc.useCases.cases, [], "the catalog holds only the template");
    assert.deepEqual(
      doc.useCases.proposed.map((u: { id: string; change: string; kind: string }) => [
        u.id,
        u.change,
        u.kind,
      ]),
      [
        ["UC-002", "draft-cuenta-perfiles", "added"],
        ["UC-003", "draft-cuenta-perfiles", "added"],
      ]
    );
    const uc2 = doc.useCases.proposed[0];
    assert.equal(uc2.file, "docs/specs/changes/draft-cuenta-perfiles/use-cases/UC-002.md");
    assert.deepEqual(uc2.spec.flows[0].lanes, ["Tutor", "System"]);
    assert.match(uc2.activity, /^flowchart TD/);
    assert.equal(doc.useCases.proposed[1].spec, null);
    assert.equal(doc.stateMachines.length, 1);
    assert.equal(doc.stateMachines[0].name, "Cuenta");
    assert.equal(doc.stateMachines[0].proposed, "draft-cuenta-perfiles");
    assert.equal(
      doc.stateMachines[0].file,
      "docs/specs/changes/draft-cuenta-perfiles/state-machines/Cuenta.md"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-646: an archived change proposes nothing", () => {
  const dir = project();
  try {
    fs.mkdirSync(path.join(dir, "docs/specs/changes/archive"), { recursive: true });
    fs.renameSync(
      path.join(dir, "docs/specs/changes/draft-cuenta-perfiles"),
      path.join(dir, "docs/specs/changes/archive/2026-11-21-draft-cuenta-perfiles")
    );
    const doc = status(dir);
    assert.deepEqual(doc.useCases.proposed, []);
    assert.equal(doc.stateMachines, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
