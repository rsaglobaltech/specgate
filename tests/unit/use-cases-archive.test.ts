/**
 * REQ-625: archive merges a change's use cases into docs/specs/use-cases.md,
 * and refuses a removal while a requirement still names the use case (#543).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { planArchive, executeArchive } = require("../../scripts/change/archive");

const TRACEABILITY = `# Traceability Matrix

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-000 | SCN-000 | \`features/core/health.feature\` | UC-002 | - | - | - | \`API /health\` | TBD | Draft |
`;

const CATALOG = `# Use Cases

| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |
|---|---|---|---|---|---|---|---|
| UC-001 | Describe the first use case | Primary actor | REQ-TBD | CMD-001 ExampleCommand | AGG-001 CoreAggregate | EVT-001 ExampleEvent | Draft |
| UC-002 | Check the service is up | Operator | REQ-000 | - | - | - | Approved |
`;

const DELTA = `# Delta — pricing

## ADDED Requirements

### Requirement: REQ-001 — Dynamic peak pricing

El sistema SHALL aplicar un recargo del 20 %.

#### Scenario: SCN-001a — Hora punta

- GIVEN una sesión iniciada a las 18:00
- WHEN se calcula la tarifa
- THEN el importe incluye un recargo del 20 %

<!-- specgate:trace uc=UC-007 feature=features/billing/dynamic_pricing.feature -->
`;

function project(useCases: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-uc-"));
  const write = (rel: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), contents, "utf8");
  };
  const id = "add-pricing";
  write("spec.md", "# Spec\n");
  write("docs/specs/traceability.md", TRACEABILITY);
  write("docs/specs/use-cases.md", CATALOG);
  write(`docs/specs/changes/${id}/proposal.md`, "# Proposal\n");
  write(`docs/specs/changes/${id}/tasks.md`, "# Tasks\n\n- [x] 1.1 done\n");
  write(
    `docs/specs/changes/${id}/change.yaml`,
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-11-21\nrigor: lite\nskip_specs: false\nretire_capabilities: false\n"
  );
  write(`docs/specs/changes/${id}/specs/pricing/spec.md`, DELTA);
  write(
    `docs/specs/changes/${id}/features/billing/dynamic_pricing.feature`,
    "Feature: Pricing\n\n  Scenario: Hora punta\n    Given una sesión\n"
  );
  write(`docs/specs/changes/${id}/use-cases.md`, useCases);
  return { root, id };
}

const catalogOf = (root: string) =>
  fs.readFileSync(path.join(root, "docs/specs/use-cases.md"), "utf8");

test("REQ-625 SCN-625a: archive adds UC-007 to the catalog, drops the template row, and dry-run lists it", () => {
  const { root, id } = project(`# Use cases — add-pricing

## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-007 | Price a session at peak time | Driver | REQ-001 |
`);
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, true, JSON.stringify(plan.diagnostics));
    const write = plan.writes.find((w: { kind: string }) => w.kind === "use-cases");
    assert.ok(write, "the catalog is among the writes");
    assert.deepEqual(plan.totals.useCases, { added: 1, modified: 0, removed: 0 });
    executeArchive(plan);
    const catalog = catalogOf(root);
    assert.match(
      catalog,
      /\| UC-007 \| Price a session at peak time \| Driver \| REQ-001 \| - \| - \| - \| Approved \|/
    );
    assert.match(catalog, /\| UC-002 \| Check the service is up \|/);
    assert.doesNotMatch(catalog, /Describe the first use case/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-625 SCN-625c: removing UC-002 while REQ-000 names it is refused, and nothing is written", () => {
  const { root, id } = project(`# Use cases — add-pricing

## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-007 | Price a session at peak time | Driver | REQ-001 |

## REMOVED Use Cases

| ID | Reason |
| --- | --- |
| UC-002 | Health moves to the platform |
`);
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, false);
    const codes = plan.diagnostics.map((d: { code: string }) => d.code);
    assert.ok(codes.includes("uc_removed_in_use"), JSON.stringify(codes));
    assert.equal(catalogOf(root), CATALOG, "the catalog is untouched");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-625: a change with no use-cases.md archives as before, the catalog untouched", () => {
  const { root, id } = project("");
  fs.rmSync(path.join(root, `docs/specs/changes/${id}/use-cases.md`));
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, true, JSON.stringify(plan.diagnostics));
    assert.equal(
      plan.writes.some((w: { kind: string }) => w.kind === "use-cases"),
      false
    );
    executeArchive(plan);
    assert.equal(catalogOf(root), CATALOG);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
