/**
 * REQ-634: `check` and `archive` regenerate docs/specs/use-case-diagrams.md
 * and docs/specs/use-cases.puml; `validate` reports a copy edited by hand.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { refreshDomainDiagrams, staleDiagramFindings } = require("../../scripts/lib/domain-docs");

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ucd-"));
  fs.mkdirSync(path.join(dir, "docs", "specs", "use-cases"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/specs/use-cases.md"),
    "# Use Cases\n\n| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |\n|---|---|---|---|---|---|---|---|\n| UC-004 | Create a child profile | Tutor | REQ-012 | - | - | - | Approved |\n"
  );
  fs.writeFileSync(
    path.join(dir, "docs/specs/use-cases/UC-004.md"),
    "# UC-004 — Create a child profile\n\n## Overview\n\nA profile.\n\n## Main flow (SCN-012)\n\n1. The tutor presses New profile.\n2. The system saves it.\n"
  );
  return dir;
}

test("REQ-634 SCN-634c: regenerated from the catalog and the specifications; a copy edited by hand is reported", () => {
  const dir = project();
  try {
    const written = refreshDomainDiagrams(dir);
    assert.ok(written.includes("docs/specs/use-case-diagrams.md"), JSON.stringify(written));
    assert.ok(written.includes("docs/specs/use-cases.puml"), JSON.stringify(written));
    const md = fs.readFileSync(path.join(dir, "docs/specs/use-case-diagrams.md"), "utf8");
    assert.match(md, /## UC-004 — Create a child profile/);
    assert.deepEqual(staleDiagramFindings(dir), []);
    assert.deepEqual(refreshDomainDiagrams(dir), [], "nothing to rewrite the second time");
    fs.appendFileSync(path.join(dir, "docs/specs/use-cases.puml"), "' hand edit\n");
    assert.deepEqual(
      staleDiagramFindings(dir).map((d: { code: string; file: string }) => `${d.code}:${d.file}`),
      ["use_case_diagrams_stale:docs/specs/use-cases.puml"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-634: a project whose catalog holds only the template draws nothing", () => {
  const dir = project();
  try {
    fs.writeFileSync(
      path.join(dir, "docs/specs/use-cases.md"),
      "# Use Cases\n\n| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |\n|---|---|---|---|---|---|---|---|\n| UC-001 | Describe the first use case | Primary actor | REQ-TBD | - | - | - | Draft |\n"
    );
    assert.deepEqual(
      refreshDomainDiagrams(dir).filter((f: string) => f.includes("use-case")),
      []
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-635 SCN-635a: status --json carries the use cases — each with its specification and activity — and the diagram; null with no catalog", () => {
  const { spawnSync } = require("node:child_process");
  const CLI = path.join(
    __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""),
    "bin",
    "specgate.js"
  );
  const dir = project();
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.writeFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n| REQ-012 | SCN-012 | - | UC-004 | - | - | - | - | TBD | Draft |\n"
    );
    const run = () =>
      JSON.parse(
        spawnSync(process.execPath, [CLI, "status", "--json", "--project-dir", dir], {
          encoding: "utf8",
        }).stdout
      );
    const doc = run();
    assert.match(doc.useCases.diagram, /^flowchart LR/);
    assert.equal(doc.useCases.cases.length, 1);
    const uc = doc.useCases.cases[0];
    assert.equal(uc.id, "UC-004");
    assert.equal(uc.file, "docs/specs/use-cases/UC-004.md");
    assert.equal(uc.spec.flows[0].scenarios[0], "SCN-012");
    assert.match(uc.activity, /^flowchart TD/);
    fs.rmSync(path.join(dir, "docs/specs/use-cases.md"));
    assert.equal(run().useCases, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-642 SCN-642b: status --json carries each step's lane, for the studio to draw the activity's lanes", () => {
  const { spawnSync } = require("node:child_process");
  const CLI = path.join(
    __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""),
    "bin",
    "specgate.js"
  );
  const dir = project();
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.writeFileSync(
      path.join(dir, "docs/specs/traceability.md"),
      "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n| REQ-012 | SCN-012 | - | UC-004 | - | - | - | - | TBD | Draft |\n"
    );
    fs.writeFileSync(
      path.join(dir, "docs/specs/use-cases/UC-004.md"),
      "# UC-004 — Create a child profile\n\n## Overview\n\nA profile.\n\n## Actors\n\n- Tutor\n- System\n\n## Main flow (SCN-012)\n\n1. The tutor presses New profile.\n2. [System] Saves it.\n"
    );
    const doc = JSON.parse(
      spawnSync(process.execPath, [CLI, "status", "--json", "--project-dir", dir], {
        encoding: "utf8",
      }).stdout
    );
    const main = doc.useCases.cases[0].spec.flows[0];
    assert.deepEqual(main.lanes, ["Tutor", "System"]);
    assert.deepEqual(main.steps, ["The tutor presses New profile.", "Saves it."]);
    assert.match(doc.useCases.cases[0].activity, /subgraph lane_System/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
