"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  planArchive,
  executeArchive,
  syncTraceability,
  traceRow,
} = require("../../scripts/change/archive");
const {
  listChangeIds,
  listDeltas,
  taskProgress,
  reserveReqRange,
  readConfig,
} = require("../../packages/core/src/infrastructure/ChangeWorkspace");
const { parseSpec } = require("../../packages/core/src/domain/SpecParser");

const TRACEABILITY_HEADER = `# Traceability Matrix

Map requirements to scenarios, domain model elements, implementation artifacts, and tests.

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-000 | SCN-000 | \`features/core/health.feature\` | UC-000 | - | - | - | \`API /health\` | TBD | Draft |
`;

const DELTA = `# Delta — pricing

## Purpose

Tarificación de sesiones.

## ADDED Requirements

### Requirement: REQ-001 — Dynamic peak pricing

El sistema SHALL aplicar un recargo del 20 %.

#### Scenario: SCN-001a — Hora punta

- GIVEN una sesión iniciada a las 18:00
- WHEN se calcula la tarifa
- THEN el importe incluye un recargo del 20 %

<!-- specgate:trace uc=UC-007 cmd=CMD-011 feature=features/billing/dynamic_pricing.feature -->
`;

function mkProject(opts?) {
  const o = opts || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-change-"));
  const write = (rel, contents) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, "utf8");
    return full;
  };

  write("spec.md", "# Spec\n");
  write("docs/specs/traceability.md", TRACEABILITY_HEADER);

  if (o.change !== false) {
    const id = o.changeId || "add-dynamic-pricing";
    write(`docs/specs/changes/${id}/proposal.md`, "# Proposal: add dynamic pricing\n");
    write(
      `docs/specs/changes/${id}/tasks.md`,
      o.tasksDone === false ? "# Tasks\n\n- [ ] 1.1 pendiente\n" : "# Tasks\n\n- [x] 1.1 hecho\n"
    );
    write(
      `docs/specs/changes/${id}/change.yaml`,
      `specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-08-15\nrigor: lite\nskip_specs: ${o.skipSpecs === true}\nretire_capabilities: ${o.retire === true}\n`
    );
    if (o.delta !== false)
      write(`docs/specs/changes/${id}/specs/pricing/spec.md`, o.delta || DELTA);
    if (o.feature !== false) {
      write(
        `docs/specs/changes/${id}/features/billing/dynamic_pricing.feature`,
        "Feature: Dynamic peak pricing\n\n  Scenario: Hora punta\n    Given una sesión\n"
      );
    }
  }
  if (o.capabilitySpec) write("docs/specs/capabilities/pricing/spec.md", o.capabilitySpec);

  return { root, write };
}

const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });

// ── retro-compatibility ───────────────────────────────────────────────────────

test("a project with no changes/ directory reports no changes rather than failing", () => {
  const { root } = mkProject({ change: false });
  try {
    assert.deepEqual(listChangeIds(root), []);
    assert.deepEqual(listDeltas(root, "whatever"), []);
    assert.deepEqual(taskProgress(root, "whatever"), {
      total: 0,
      complete: 0,
      remaining: 0,
      tasks: [],
    });
  } finally {
    cleanup(root);
  }
});

test("readConfig falls back to defaults when change.yaml is absent", () => {
  const { root, write } = mkProject({ change: false });
  try {
    write("docs/specs/changes/bare/proposal.md", "# Proposal\n");
    const cfg = readConfig(root, "bare");
    assert.equal(cfg.schema, "spec-driven");
    assert.equal(cfg.skip_specs, false);
    assert.equal(cfg.retire_capabilities, false);
  } finally {
    cleanup(root);
  }
});

// ── REQ id reservation ────────────────────────────────────────────────────────

test("reserveReqRange never recycles an id already used anywhere", () => {
  const { root } = mkProject();
  try {
    // REQ-000 lives in the matrix, REQ-001 in the pending delta.
    const [start, end] = reserveReqRange(root, 3);
    assert.equal(start, "REQ-002");
    assert.equal(end, "REQ-004");
  } finally {
    cleanup(root);
  }
});

// ── planning gates ────────────────────────────────────────────────────────────

test("archiving a change that does not exist is an error with a fix", () => {
  const { root } = mkProject();
  try {
    const plan = planArchive(root, "ghost");
    assert.equal(plan.ok, false);
    const d = plan.diagnostics.find((x) => x.code === "archive_change_not_found");
    assert.ok(d);
    assert.match(d.fix, /change list/);
  } finally {
    cleanup(root);
  }
});

test("unchecked tasks block the archive unless forced", () => {
  const { root } = mkProject({ tasksDone: false });
  try {
    const blocked = planArchive(root, "add-dynamic-pricing");
    assert.equal(blocked.ok, false);
    assert.ok(blocked.diagnostics.some((d) => d.code === "archive_tasks_incomplete"));

    const forced = planArchive(root, "add-dynamic-pricing", { force: true });
    assert.equal(forced.ok, true);
  } finally {
    cleanup(root);
  }
});

test("an invalid delta blocks the archive", () => {
  const { root } = mkProject({
    delta:
      "## ADDED Requirements\n\n### Requirement: REQ-001 — Sin escenario\n\nEl sistema SHALL algo.\n",
  });
  try {
    const plan = planArchive(root, "add-dynamic-pricing");
    assert.equal(plan.ok, false);
    assert.ok(plan.diagnostics.some((d) => d.code === "requirement_without_scenario"));
  } finally {
    cleanup(root);
  }
});

test("planArchive writes nothing to disk", () => {
  const { root } = mkProject();
  try {
    const before = fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8");
    const plan = planArchive(root, "add-dynamic-pricing");
    assert.equal(plan.ok, true);
    assert.ok(plan.writes.length > 0);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/capabilities/pricing/spec.md")), false);
    assert.equal(fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8"), before);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-dynamic-pricing")), true);
  } finally {
    cleanup(root);
  }
});

// ── execution ─────────────────────────────────────────────────────────────────

test("archive merges the spec, upserts traceability, materialises the feature and moves the change", () => {
  const { root } = mkProject();
  try {
    const plan = planArchive(root, "add-dynamic-pricing", { stamp: "2026-08-15" });
    assert.equal(plan.ok, true);
    const result = executeArchive(plan);
    assert.equal(result.archivedAs, "2026-08-15-add-dynamic-pricing");

    const spec = parseSpec(
      fs.readFileSync(path.join(root, "docs/specs/capabilities/pricing/spec.md"), "utf8")
    );
    assert.equal(spec.requirements.length, 1);
    assert.equal(spec.requirements[0].id, "REQ-001");
    assert.match(spec.purpose, /Tarificación/);

    const matrix = fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8");
    assert.match(matrix, /\| REQ-001 \| SCN-001a \|/);
    assert.match(matrix, /UC-007/);
    assert.match(matrix, /\| REQ-000 \|/, "the pre-existing row must survive");

    assert.equal(fs.existsSync(path.join(root, "features/billing/dynamic_pricing.feature")), true);

    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-dynamic-pricing")), false);
    assert.equal(
      fs.existsSync(
        path.join(root, "docs/specs/changes/archive/2026-08-15-add-dynamic-pricing/proposal.md")
      ),
      true
    );
  } finally {
    cleanup(root);
  }
});

test("an existing feature file is never silently overwritten", () => {
  const { root, write } = mkProject();
  try {
    write("features/billing/dynamic_pricing.feature", "Feature: mine\n");
    const plan = planArchive(root, "add-dynamic-pricing");
    assert.ok(plan.warnings.some((w) => w.code === "archive_feature_exists"));
    assert.equal(
      plan.writes.some((w) => w.kind === "feature"),
      false
    );
    executeArchive(plan);
    assert.equal(
      fs.readFileSync(path.join(root, "features/billing/dynamic_pricing.feature"), "utf8"),
      "Feature: mine\n"
    );
  } finally {
    cleanup(root);
  }
});

test("removing the last requirement needs retire_capabilities declared", () => {
  const existing = `# Pricing

## Requirements

### Requirement: REQ-001 — Base rate

El sistema SHALL cobrar.

#### Scenario: SCN-001a — Cobro

- GIVEN una sesión
- THEN se cobra
`;
  const removeDelta = `## REMOVED Requirements

### Requirement: REQ-001 — Base rate

(obsoleto)
`;
  const undeclared = mkProject({ capabilitySpec: existing, delta: removeDelta, feature: false });
  try {
    const plan = planArchive(undeclared.root, "add-dynamic-pricing");
    assert.equal(plan.ok, false);
    assert.ok(plan.diagnostics.some((d) => d.code === "archive_retire_not_declared"));
  } finally {
    cleanup(undeclared.root);
  }

  const declared = mkProject({
    capabilitySpec: existing,
    delta: removeDelta,
    feature: false,
    retire: true,
  });
  try {
    const plan = planArchive(declared.root, "add-dynamic-pricing");
    assert.equal(plan.ok, true);
    assert.ok(plan.warnings.some((w) => w.code === "archive_capability_retired"));
    executeArchive(plan);
    assert.equal(
      fs.existsSync(path.join(declared.root, "docs/specs/capabilities/pricing/spec.md")),
      false
    );
  } finally {
    cleanup(declared.root);
  }
});

test("skip_specs archives a tooling change with no deltas", () => {
  const { root } = mkProject({ skipSpecs: true, delta: false, feature: false });
  try {
    const plan = planArchive(root, "add-dynamic-pricing");
    assert.equal(plan.ok, true);
    assert.equal(plan.specsUpdated, false);
    executeArchive(plan);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-dynamic-pricing")), false);
  } finally {
    cleanup(root);
  }
});

// ── transactionality ──────────────────────────────────────────────────────────

test("a failure mid-write rolls every file back and leaves the change in place", () => {
  const { root } = mkProject();
  try {
    const plan = planArchive(root, "add-dynamic-pricing", { stamp: "2026-08-15" });
    assert.equal(plan.ok, true);

    const matrixBefore = fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8");

    // Poison the last write: a directory where the engine expects to write a
    // file makes writeFileSync throw EISDIR, after earlier writes succeeded.
    const poisoned = plan.writes[plan.writes.length - 1].file;
    fs.rmSync(poisoned, { force: true });
    fs.mkdirSync(poisoned, { recursive: true });

    assert.throws(() => executeArchive(plan));

    // Everything the engine had already written must be back to its original
    // state, and the change must NOT have been archived.
    assert.equal(
      fs.existsSync(path.join(root, "docs/specs/capabilities/pricing/spec.md")),
      false,
      "a spec created during the failed run must be removed"
    );
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-dynamic-pricing")), true);
    assert.equal(
      fs.existsSync(path.join(root, "docs/specs/changes/archive/2026-08-15-add-dynamic-pricing")),
      false
    );
    if (poisoned !== path.join(root, "docs/specs/traceability.md")) {
      assert.equal(
        fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8"),
        matrixBefore
      );
    }
  } finally {
    cleanup(root);
  }
});

// ── traceability upsert ───────────────────────────────────────────────────────

test("upsert preserves columns a later change does not speak about", () => {
  const existing = `# Traceability Matrix

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001a | \`features/a.feature\` | UC-007 | CMD-011 | AGG-P | EVT-X | \`PricingService\` | \`PricingTest\` | Implemented |
`;
  const req = {
    id: "REQ-001",
    name: "Dynamic pricing",
    scenarios: [{ id: "SCN-001a", name: "x", steps: ["GIVEN a", "THEN b"] }],
    trace: { uc: "UC-009" },
  };
  const { markdown, totals } = syncTraceability(existing, {
    upserts: [{ req, capability: "pricing" }],
    removals: [],
  });
  assert.equal(totals.updated, 1);
  assert.equal(totals.added, 0);
  // The change only restated the use case; implementation columns survive.
  assert.match(markdown, /UC-009/);
  assert.match(markdown, /PricingService/);
  assert.match(markdown, /PricingTest/);
  assert.match(markdown, /Implemented/);
});

test("an upsert never downgrades an Implemented requirement back to Draft", () => {
  // Regression: `traceRow` defaults status to Draft for new rows. Letting that
  // default reach an existing row would silently take an implemented REQ back
  // out from under the --strict-tdd gate.
  const existing = `| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001a | \`a\` | - | - | - | - | \`Svc\` | \`SvcTest\` | Implemented |
`;
  const req = {
    id: "REQ-001",
    name: "X",
    scenarios: [{ id: "SCN-001a" }],
    trace: { uc: "UC-009" },
  };
  const { markdown } = syncTraceability(existing, {
    upserts: [{ req, capability: "pricing" }],
    removals: [],
  });
  assert.match(markdown, /Implemented/);
  assert.doesNotMatch(markdown, /Draft/);
  assert.match(markdown, /SvcTest/, "the test artifact must survive too");
});

test("an explicit status in specgate:trace does win", () => {
  const existing = `| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001a | \`a\` | - | - | - | - | - | TBD | Draft |
`;
  const req = {
    id: "REQ-001",
    name: "X",
    scenarios: [{ id: "SCN-001a" }],
    trace: { status: "Ready for Dev" },
  };
  const { markdown } = syncTraceability(existing, {
    upserts: [{ req, capability: "pricing" }],
    removals: [],
  });
  assert.match(markdown, /Ready for Dev/);
});

test("a removed requirement drops its row", () => {
  const existing = `| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001a | \`a\` | - | - | - | - | - | TBD | Draft |
| REQ-002 | SCN-002a | \`b\` | - | - | - | - | - | TBD | Draft |
`;
  const { markdown, totals } = syncTraceability(existing, { upserts: [], removals: ["REQ-001"] });
  assert.equal(totals.removed, 1);
  assert.doesNotMatch(markdown, /REQ-001/);
  assert.match(markdown, /REQ-002/);
});

test("traceRow backticks paths so the generated matrix reads uniformly", () => {
  const row = traceRow({
    id: "REQ-005",
    name: "X",
    scenarios: [{ id: "SCN-005a" }],
    trace: { feature: "features/a/b.feature" },
  });
  assert.equal(row.featureFile, "`features/a/b.feature`");
  assert.equal(row.status, "Draft");
  assert.equal(row.testArtifact, "TBD");
});

// ── Surrounding content is not the tool's to delete ───────────────────────────

test("syncTraceability keeps everything around the matrix table", () => {
  // buildTraceabilityMarkdown regenerates a whole document from rows alone.
  // Used directly it wiped every other section of traceability.md — the
  // non-functional requirements, the test inventory, the notes — silently.
  // Dogfooding this repo's own matrix is what surfaced it.
  const existing = `# Traceability Matrix — my project

> A preamble the tool did not write.

## 1. Requirements

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-000 | SCN-000 | \`features/core/health.feature\` | - | - | - | - | \`API /health\` | TBD | Draft |

## 2. Non-functional requirements

| NFR | Requirement | Attribute | Measured by | Status |
|---|---|---|---|---|
| NFR-001 | Boots in under a second | Performance | A benchmark | Draft |

## 3. Notes

Prose the tool has no business touching.
`;

  const applied = {
    upserts: [{ req: { id: "REQ-014", title: "Dynamic peak pricing", scenarios: [] } }],
    removals: [],
  };
  const { markdown, totals } = syncTraceability(existing, applied);

  assert.equal(totals.added, 1);
  assert.match(markdown, /REQ-014/, "the new row is spliced in");
  assert.match(markdown, /REQ-000/, "the existing row survives");
  assert.match(markdown, /A preamble the tool did not write/);
  assert.match(markdown, /## 2\. Non-functional requirements/);
  assert.match(markdown, /NFR-001 \| Boots in under a second/);
  assert.match(markdown, /## 3\. Notes/);
  assert.match(markdown, /Prose the tool has no business touching/);
});

test("syncTraceability still generates a whole document when there is no table", () => {
  const applied = {
    upserts: [{ req: { id: "REQ-001", title: "First requirement", scenarios: [] } }],
    removals: [],
  };
  const { markdown } = syncTraceability("", applied);
  assert.match(markdown, /^# Traceability Matrix/);
  assert.match(markdown, /REQ-001/);
});
