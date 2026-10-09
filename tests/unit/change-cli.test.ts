"use strict";

/**
 * CLI-level coverage for `specgate change`.
 *
 * The engine is unit-tested elsewhere; this file exercises the wrapper — the
 * part an agent actually talks to. Every assertion here is about the contract
 * from ADR-0017: one JSON document on stdout, prose on stderr, the command's
 * null-shape plus `status` on failure, and the documented exit codes.
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
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "csda-change-cli-"));
  fs.writeFileSync(path.join(root, "spec.md"), "# Spec\n", "utf8");
  fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "specs", "traceability.md"),
    `# Traceability Matrix

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
`,
    "utf8"
  );
  return root;
}

const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });

function run(root, args) {
  return spawnSync(process.execPath, [CLI_PATH, "change", ...args, "--project-dir", root], {
    cwd: root,
    encoding: "utf8",
  });
}

/** Parse stdout as the single JSON document the contract promises. */
function json(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(
      `stdout was not one JSON document (${err.message}).\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }
}

const GOOD_DELTA = `## ADDED Requirements

### Requirement: REQ-001 — Dynamic peak pricing

El sistema SHALL aplicar un recargo del 20 %.

#### Scenario: SCN-001a — Hora punta

- GIVEN una sesión iniciada a las 18:00
- WHEN se calcula la tarifa
- THEN el importe incluye un recargo del 20 %

<!-- csda:trace uc=UC-007 feature=features/billing/dynamic.feature -->
`;

// ── new ───────────────────────────────────────────────────────────────────────

test("change new scaffolds the folder and reports it as JSON", () => {
  const root = mkProject();
  try {
    const result = run(root, ["new", "add-pricing", "--capability", "pricing", "--json"]);
    assert.equal(result.status, 0);
    const doc = json(result);
    assert.equal(doc.change.id, "add-pricing");
    assert.equal(doc.change.rigor, "lite");
    assert.deepEqual(doc.change.reqRange, ["REQ-001", "REQ-003"]);
    assert.ok(doc.change.created.includes("docs/specs/changes/add-pricing/proposal.md"));
    assert.deepEqual(doc.status, []);
    assert.equal(
      fs.existsSync(path.join(root, "docs/specs/changes/add-pricing/change.yaml")),
      true
    );
  } finally {
    cleanup(root);
  }
});

test("change new --full also scaffolds design.md", () => {
  const root = mkProject();
  try {
    const doc = json(run(root, ["new", "add-pricing", "--full", "--json"]));
    assert.equal(doc.change.rigor, "full");
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-pricing/design.md")), true);
  } finally {
    cleanup(root);
  }
});

test("change new rejects a non-kebab-case id with a fix", () => {
  const root = mkProject();
  try {
    const result = run(root, ["new", "Add Pricing", "--json"]);
    assert.equal(result.status, 1);
    const doc = json(result);
    assert.equal(doc.change, null, "the null-shape must be present on failure");
    assert.equal(doc.status[0].code, "invalid_change_id");
    assert.match(doc.status[0].fix, /kebab-case/);
  } finally {
    cleanup(root);
  }
});

test("change new refuses to clobber an existing change", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing"]);
    const result = run(root, ["new", "add-pricing", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(json(result).status[0].code, "change_exists");
  } finally {
    cleanup(root);
  }
});

test("two changes never reserve overlapping REQ ranges", () => {
  const root = mkProject();
  try {
    const first = json(run(root, ["new", "add-a", "--json"]));
    const second = json(run(root, ["new", "add-b", "--json"]));
    assert.deepEqual(first.change.reqRange, ["REQ-001", "REQ-003"]);
    assert.deepEqual(second.change.reqRange, ["REQ-004", "REQ-006"]);
  } finally {
    cleanup(root);
  }
});

// ── list / show / status ──────────────────────────────────────────────────────

test("change list reports an empty project without failing", () => {
  const root = mkProject();
  try {
    const result = run(root, ["list", "--json"]);
    assert.equal(result.status, 0);
    assert.deepEqual(json(result).changes, []);
  } finally {
    cleanup(root);
  }
});

test("change list reports task progress and delta count", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing", "--capability", "pricing"]);
    const doc = json(run(root, ["list", "--json"]));
    assert.equal(doc.changes.length, 1);
    assert.equal(doc.changes[0].id, "add-pricing");
    assert.equal(doc.changes[0].deltaCount, 1);
    assert.equal(doc.changes[0].status, "in-progress");
  } finally {
    cleanup(root);
  }
});

test("change show lists what each delta touches", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing", "--capability", "pricing"]);
    fs.writeFileSync(
      path.join(root, "docs/specs/changes/add-pricing/specs/pricing/spec.md"),
      GOOD_DELTA,
      "utf8"
    );
    const doc = json(run(root, ["show", "add-pricing", "--json"]));
    assert.equal(doc.change.deltaCount, 1);
    assert.equal(doc.change.deltas[0].capability, "pricing");
    assert.deepEqual(doc.change.deltas[0].added, ["REQ-001 — Dynamic peak pricing"]);
    assert.deepEqual(doc.change.deltas[0].removed, []);
  } finally {
    cleanup(root);
  }
});

test("change show on a missing change fails with the null-shape", () => {
  const root = mkProject();
  try {
    const result = run(root, ["show", "ghost", "--json"]);
    assert.equal(result.status, 1);
    const doc = json(result);
    assert.equal(doc.change, null);
    assert.equal(doc.status[0].code, "change_not_found");
  } finally {
    cleanup(root);
  }
});

test("change status reports artefacts in dependency order with next steps", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing", "--capability", "pricing"]);
    const doc = json(run(root, ["status", "add-pricing", "--json"]));
    assert.deepEqual(
      doc.artifacts.map((a) => a.id),
      ["proposal", "specs", "design", "tasks"]
    );
    // Lite rigor skips design; a skipped artefact satisfies its dependents.
    const design = doc.artifacts.find((a) => a.id === "design");
    assert.equal(design.status, "skipped");
    const tasks = doc.artifacts.find((a) => a.id === "tasks");
    assert.equal(tasks.status, "done");
    assert.equal(doc.isPlanningComplete, true);
    assert.ok(doc.nextSteps.some((s) => /tasks\.md/.test(s)));
  } finally {
    cleanup(root);
  }
});

test("change status with no argument and several changes asks which one", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-a"]);
    run(root, ["new", "add-b"]);
    const doc = json(run(root, ["status", "--json"]));
    assert.deepEqual(doc.changes, ["add-a", "add-b"]);
    assert.match(doc.message, /name the one/i);
  } finally {
    cleanup(root);
  }
});

// ── validate ──────────────────────────────────────────────────────────────────

test("change validate passes a well-formed delta and exits 0", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing", "--capability", "pricing"]);
    fs.writeFileSync(
      path.join(root, "docs/specs/changes/add-pricing/specs/pricing/spec.md"),
      GOOD_DELTA,
      "utf8"
    );
    const result = run(root, ["validate", "--json"]);
    assert.equal(result.status, 0);
    const doc = json(result);
    assert.equal(doc.summary.failed, 0);
    assert.equal(doc.items[0].valid, true);
  } finally {
    cleanup(root);
  }
});

test("change validate fails an invalid delta and exits 1", () => {
  const root = mkProject();
  try {
    run(root, ["new", "add-pricing", "--capability", "pricing"]);
    fs.writeFileSync(
      path.join(root, "docs/specs/changes/add-pricing/specs/pricing/spec.md"),
      "## ADDED Requirements\n\n### Requirement: REQ-001 — Sin escenario\n\nEl sistema SHALL algo.\n",
      "utf8"
    );
    const result = run(root, ["validate", "--json"]);
    assert.equal(result.status, 1);
    const doc = json(result);
    assert.equal(doc.summary.failed, 1);
    assert.ok(doc.items[0].issues.some((i) => i.code === "requirement_without_scenario"));
  } finally {
    cleanup(root);
  }
});

// ── archive ───────────────────────────────────────────────────────────────────

function readyChange(root) {
  run(root, ["new", "add-pricing", "--capability", "pricing"]);
  const dir = path.join(root, "docs/specs/changes/add-pricing");
  fs.writeFileSync(path.join(dir, "specs/pricing/spec.md"), GOOD_DELTA, "utf8");
  fs.writeFileSync(path.join(dir, "tasks.md"), "# Tasks\n\n- [x] 1.1 done\n", "utf8");
  fs.mkdirSync(path.join(dir, "features/billing"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "features/billing/dynamic.feature"),
    "Feature: Dynamic pricing\n\n  Scenario: Hora punta\n    Given una sesión\n",
    "utf8"
  );
  return dir;
}

test("archive --dry-run writes nothing and reports the plan", () => {
  const root = mkProject();
  try {
    readyChange(root);
    const result = run(root, ["archive", "add-pricing", "--dry-run", "--json"]);
    assert.equal(result.status, 0);
    const doc = json(result);
    assert.equal(doc.archive.dryRun, true);
    assert.ok(doc.archive.writes.some((w) => w.kind === "spec"));
    assert.ok(doc.archive.writes.some((w) => w.kind === "traceability"));
    assert.ok(doc.archive.writes.some((w) => w.kind === "feature"));
    assert.equal(fs.existsSync(path.join(root, "docs/specs/capabilities/pricing/spec.md")), false);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-pricing")), true);
  } finally {
    cleanup(root);
  }
});

test("archive merges the spec, the matrix and the feature, then moves the change", () => {
  const root = mkProject();
  try {
    readyChange(root);
    const result = run(root, ["archive", "add-pricing", "--json"]);
    assert.equal(result.status, 0);
    const doc = json(result);
    assert.equal(doc.archive.specsUpdated, true);
    assert.match(doc.archive.archivedAs, /^\d{4}-\d{2}-\d{2}-add-pricing$/);

    const spec = fs.readFileSync(
      path.join(root, "docs/specs/capabilities/pricing/spec.md"),
      "utf8"
    );
    assert.match(spec, /REQ-001 — Dynamic peak pricing/);

    const matrix = fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8");
    assert.match(matrix, /\| REQ-001 \|/);
    assert.match(matrix, /UC-007/);

    assert.equal(fs.existsSync(path.join(root, "features/billing/dynamic.feature")), true);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/add-pricing")), false);
  } finally {
    cleanup(root);
  }
});

test("#46/#47: a draft with no feature= and no .feature files gets one per requirement, in its language", () => {
  const root = mkProject();
  try {
    run(root, ["new", "draft-reservas", "--capability", "reservas"]);
    const dir = path.join(root, "docs/specs/changes/draft-reservas");
    fs.writeFileSync(
      path.join(dir, "specs/reservas/spec.md"),
      `## ADDED Requirements

### Requirement: REQ-143 — No se reserva por encima de los puestos

<!-- csda:trace kind=business-rule -->

El sistema SHALL rechazar una reserva cuando los puestos están llenos.

#### Scenario: SCN-145 — No se reserva el último puesto ya ocupado

- DADO "Peluquería" con 2 puestos a las 10:00 y 2 reservas a esa hora
- CUANDO un cliente hace POST /api/reservas para las 10:00
- ENTONCES la respuesta es 409 y la reserva no se crea
`,
      "utf8"
    );
    fs.writeFileSync(path.join(dir, "tasks.md"), "# Tasks\n\n- [x] 1.1 done\n", "utf8");

    const doc = json(run(root, ["archive", "draft-reservas", "--json"]));
    assert.ok(doc.archive, JSON.stringify(doc.status));

    const feature = fs.readFileSync(path.join(root, "features/reservas/REQ-143.feature"), "utf8");
    assert.match(
      feature,
      /^# language: es\nCaracterística: No se reserva por encima de los puestos/
    );
    assert.match(feature, /@REQ-143 @SCN-145\n {2}Escenario: .*\n {4}Dado "Peluquería"/);

    const spec = fs.readFileSync(
      path.join(root, "docs/specs/capabilities/reservas/spec.md"),
      "utf8"
    );
    assert.match(spec, /feature=features\/reservas\/REQ-143\.feature/);
    const matrix = fs.readFileSync(path.join(root, "docs/specs/traceability.md"), "utf8");
    assert.match(matrix, /\| REQ-143 \| SCN-145 \| `?features\/reservas\/REQ-143\.feature/);
  } finally {
    cleanup(root);
  }
});

test("archive refuses while tasks are unchecked, and --force overrides", () => {
  const root = mkProject();
  try {
    readyChange(root);
    fs.writeFileSync(
      path.join(root, "docs/specs/changes/add-pricing/tasks.md"),
      "# Tasks\n\n- [ ] 1.1 pending\n",
      "utf8"
    );
    const blocked = run(root, ["archive", "add-pricing", "--json"]);
    assert.equal(blocked.status, 1);
    const doc = json(blocked);
    assert.equal(doc.archive, null);
    assert.equal(doc.status[0].code, "archive_tasks_incomplete");
    assert.match(doc.status[0].fix, /--force/);

    const forced = run(root, ["archive", "add-pricing", "--force", "--json"]);
    assert.equal(forced.status, 0);
  } finally {
    cleanup(root);
  }
});

// ── contract ──────────────────────────────────────────────────────────────────

test("in --json mode stdout carries exactly one document and prose goes to stderr", () => {
  const root = mkProject();
  try {
    readyChange(root);
    for (const args of [
      ["list"],
      ["show", "add-pricing"],
      ["status", "add-pricing"],
      ["validate"],
    ]) {
      const result = run(root, [...args, "--json"]);
      const parsed = json(result);
      assert.ok(parsed && typeof parsed === "object", `${args[0]} produced no document`);
      // One document, not a stream of them.
      assert.equal(result.stdout.trim().lastIndexOf("}"), result.stdout.trim().length - 1);
    }
  } finally {
    cleanup(root);
  }
});

test("an unknown sub-command is a usage error, exit 2", () => {
  const root = mkProject();
  try {
    const result = spawnSync(process.execPath, [CLI_PATH, "change", "frobnicate"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown change sub-command/);
  } finally {
    cleanup(root);
  }
});

test("an unknown flag is a usage error, exit 2", () => {
  const root = mkProject();
  try {
    const result = run(root, ["list", "--nope"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown flag/);
  } finally {
    cleanup(root);
  }
});
