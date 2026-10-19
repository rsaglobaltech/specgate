"use strict";

/**
 * `specops diff --as-change` — deriving a reviewable change from a pack bump.
 *
 * The load-bearing test in this file is "a cosmetic pack change produces no
 * deltas". If that ever fails, the feature is worse than the file diff it
 * replaces: it manufactures review noise instead of removing it.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");

const {
  deriveDelta,
  requirementFingerprint,
  stepsForScenario,
  changeIdFor,
  materialiseChange,
} = require("../../scripts/specops/as_change");
const { validateDelta } = require("../../scripts/change/delta");
const { parseDelta } = require("../../packages/core/src/domain/SpecParser");

const PACK_ID = "parking-management/backend";

/** What a fixture pack varies; everything else is the stock parking pack. */
interface PackOptions {
  name?: string;
  version?: string;
  requirements?: string;
  scenarios?: string;
}

function pack(opts?: PackOptions) {
  const o = opts || {};
  // `parseYamlLite` has no inline-collection syntax, so an empty list is
  // expressed by omitting the key rather than by `[]`.
  const scenarios = o.scenarios ? `\nscenarios:\n${o.scenarios}\n` : "";
  return `schema_version: "1.1.0"

metadata:
  name: "${o.name || "Parking Management Backend Domain Pack"}"
  version: "${o.version || "1.0.0"}"
  language: "en"
  project_type: "backend"

requirements:
${o.requirements}
${scenarios}`;
}

const REQ_001 = `  - id: REQ-001
    title: "Alert operators when capacity reaches a threshold"
    priority: Must
    description: "Operators need proactive alerts when occupancy approaches capacity."
    status: Draft`;

const REQ_002 = `  - id: REQ-002
    title: "Register vehicle entry when a slot is available"
    priority: Must
    description: "Drivers can enter only when the facility has capacity."
    status: Draft`;

const SCN_001 = `  - id: "SCN-001"
    requirement_id: REQ-001
    use_case: UC-001
    target: "features/capacity/capacity_threshold.feature"
    template: "templates/features/capacity/capacity_threshold.feature.tpl"
    feature: "Parking Capacity"
    scenario: "Triggering alert when occupancy reaches threshold"
    command: CheckCapacityThresholdCommand
    aggregate: ParkingFacility
    events:
      - CapacityThresholdReached`;

const FEATURE_TPL = `Feature: Parking Capacity

  Scenario: Triggering alert when occupancy reaches threshold
    Given the facility is at 89% occupancy
    When another vehicle enters
    Then a CapacityThresholdReached event is emitted
    And operators receive an alert

  Scenario: Another one entirely
    Given something else
    Then nothing happens
`;

/** Write a pack tree under a fresh root and return the root. */
function mkPackRoot(packYaml: string, opts?: { template?: string | false }) {
  const o = opts || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pack-"));
  const packDir = path.join(root, PACK_ID);
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, "pack.yaml"), packYaml, "utf8");
  if (o.template !== false) {
    const tplPath = path.join(
      packDir,
      "templates/features/capacity/capacity_threshold.feature.tpl"
    );
    fs.mkdirSync(path.dirname(tplPath), { recursive: true });
    fs.writeFileSync(tplPath, o.template || FEATURE_TPL, "utf8");
  }
  return root;
}

const cleanup = (...roots: string[]) =>
  roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true }));

// ── the R6 property ───────────────────────────────────────────────────────────

test("a cosmetic pack change produces no deltas at all", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001, version: "1.0.0" }));
  // Same requirements. New pack version, renamed pack, reformatted template.
  const after = mkPackRoot(
    pack({
      requirements: REQ_001,
      scenarios: SCN_001,
      version: "2.0.0",
      name: "Parking Management Backend Domain Pack (renamed)",
    }),
    { template: FEATURE_TPL.replace(/\n\n/g, "\n\n\n") }
  );
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    assert.equal(derived.markdown, null, "a cosmetic bump must not manufacture a change");
    assert.deepEqual(derived.summary, { added: [], modified: [], removed: [] });
  } finally {
    cleanup(before, after);
  }
});

test("the fingerprint ignores template paths and ordering, not behaviour", () => {
  const req = { id: "REQ-001", title: "T", description: "D", priority: "Must", status: "Draft" };
  const scA = { id: "SCN-001", scenario: "S", use_case: "UC-001", template: "a.tpl", target: "x" };
  const scB = { ...scA, template: "moved/elsewhere.tpl", target: "y" };
  assert.equal(requirementFingerprint(req, [scA]), requirementFingerprint(req, [scB]));

  const changed = { ...req, description: "Different behaviour" };
  assert.notEqual(requirementFingerprint(req, [scA]), requirementFingerprint(changed, [scA]));
});

// ── derivation ────────────────────────────────────────────────────────────────

test("a new requirement in the pack becomes an ADDED delta", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    assert.deepEqual(derived.summary.added, ["REQ-002"]);
    assert.deepEqual(derived.summary.modified, []);
    assert.match(derived.markdown, /## ADDED Requirements/);
    assert.match(derived.markdown, /REQ-002 — Register vehicle entry/);
  } finally {
    cleanup(before, after);
  }
});

test("a reworded requirement becomes a MODIFIED delta", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(
    pack({
      requirements: REQ_001.replace("89", "80").replace(
        "Operators need proactive alerts when occupancy approaches capacity.",
        "Operators SHALL be alerted at 80% occupancy."
      ),
      scenarios: SCN_001,
    })
  );
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    assert.deepEqual(derived.summary.modified, ["REQ-001"]);
    assert.match(derived.markdown, /## MODIFIED Requirements/);
    assert.match(derived.markdown, /80% occupancy/);
  } finally {
    cleanup(before, after);
  }
});

test("a dropped requirement becomes a REMOVED delta with no invented body", () => {
  const before = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    assert.deepEqual(derived.summary.removed, ["REQ-002"]);
    assert.match(derived.markdown, /## REMOVED Requirements/);
    assert.match(derived.markdown, /retirado en esta versión del pack/);
  } finally {
    cleanup(before, after);
  }
});

test("a first-time derivation seeds Purpose from the pack metadata", () => {
  const after = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  try {
    const derived = deriveDelta(null, after, PACK_ID);
    assert.match(derived.markdown, /## Purpose/);
    assert.match(derived.markdown, /Parking Management Backend Domain Pack/);
  } finally {
    cleanup(after);
  }
});

// ── Gherkin extraction ────────────────────────────────────────────────────────

test("scenario steps come from the pack's own .feature template", () => {
  const root = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  try {
    const packDir = path.join(root, PACK_ID);
    const steps = stepsForScenario(packDir, {
      template: "templates/features/capacity/capacity_threshold.feature.tpl",
      scenario: "Triggering alert when occupancy reaches threshold",
    });
    assert.deepEqual(steps, [
      "GIVEN the facility is at 89% occupancy",
      "WHEN another vehicle enters",
      "THEN a CapacityThresholdReached event is emitted",
      "AND operators receive an alert",
    ]);
  } finally {
    cleanup(root);
  }
});

test("extraction stops at the next scenario and does not bleed steps", () => {
  const root = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  try {
    const steps = stepsForScenario(path.join(root, PACK_ID), {
      template: "templates/features/capacity/capacity_threshold.feature.tpl",
      scenario: "Another one entirely",
    });
    assert.deepEqual(steps, ["GIVEN something else", "THEN nothing happens"]);
  } finally {
    cleanup(root);
  }
});

test("a missing template yields an explicit TODO, never an invented step", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }), {
    template: false,
  });
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    // Default language is English; the TODO is prose, so it follows it.
    assert.match(derived.markdown, /TODO: write the GIVEN \/ WHEN \/ THEN steps/);
    // The keywords inside it never translate — they are what the validator parses.
    assert.match(derived.markdown, /GIVEN \/ WHEN \/ THEN/);
  } finally {
    cleanup(before, after);
  }
});

test("the trace comment carries the DDD coordinates the pack already declares", () => {
  const before = mkPackRoot(pack({ requirements: REQ_002 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    assert.match(derived.markdown, /uc=UC-001/);
    assert.match(derived.markdown, /cmd=CheckCapacityThresholdCommand/);
    assert.match(derived.markdown, /agg=ParkingFacility/);
    assert.match(derived.markdown, /evt=CapacityThresholdReached/);
    assert.match(derived.markdown, /feature=features\/capacity\/capacity_threshold\.feature/);
  } finally {
    cleanup(before, after);
  }
});

// ── the derived delta feeds the F1 engine ─────────────────────────────────────

test("a derived delta parses and validates with the change engine", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  try {
    const derived = deriveDelta(before, after, PACK_ID);

    const parsed = parseDelta(derived.markdown);
    assert.equal(parsed.added.length, 1);
    assert.equal(parsed.added[0].id, "REQ-002");

    const { diagnostics } = validateDelta(derived.markdown, { file: "derived.md" });
    const errors = diagnostics.filter((d: { severity: string }) => d.severity === "error");
    assert.deepEqual(errors, [], `derived delta must be valid; got ${JSON.stringify(errors)}`);
  } finally {
    cleanup(before, after);
  }
});

// ── materialisation ───────────────────────────────────────────────────────────

test("changeIdFor is stable and kebab-cased", () => {
  assert.equal(
    changeIdFor("parking-management/backend", "v0.1.0", "v0.2.0"),
    "upgrade-backend-v0.2.0"
  );
});

test("materialiseChange writes a complete, reviewable change folder", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-proj-"));
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    const entry = {
      repo: "https://github.com/acme/parking-specops.git",
      pack_id: PACK_ID,
      version: "v0.1.0",
    };
    const written = materialiseChange(project, entry, "v0.2.0", derived);

    assert.equal(written.changeId, "upgrade-backend-v0.2.0");
    const base = path.join(project, "docs/specs/changes/upgrade-backend-v0.2.0");
    for (const f of ["proposal.md", "tasks.md", "change.yaml"]) {
      assert.equal(fs.existsSync(path.join(base, f)), true, `${f} missing`);
    }
    assert.equal(
      fs.existsSync(path.join(base, "specs", PACK_ID, "spec.md")),
      true,
      "delta spec missing"
    );

    const proposal = fs.readFileSync(path.join(base, "proposal.md"), "utf8");
    assert.match(proposal, /v0\.1\.0/);
    assert.match(proposal, /v0\.2\.0/);
    assert.match(proposal, /REQ-002/);

    // Provenance is recorded so a later phase can trace the requirement's origin.
    const config = fs.readFileSync(path.join(base, "change.yaml"), "utf8");
    assert.match(config, /origin: pack:https:\/\/github\.com\/acme\/parking-specops\.git#/);
  } finally {
    cleanup(before, after, project);
  }
});

test("materialiseChange with dryRun writes nothing", () => {
  const before = mkPackRoot(pack({ requirements: REQ_001, scenarios: SCN_001 }));
  const after = mkPackRoot(pack({ requirements: `${REQ_001}\n${REQ_002}`, scenarios: SCN_001 }));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-proj-"));
  try {
    const derived = deriveDelta(before, after, PACK_ID);
    const entry = { repo: "https://x/y.git", pack_id: PACK_ID, version: "v0.1.0" };
    const written = materialiseChange(project, entry, "v0.2.0", derived, { dryRun: true });
    assert.ok(written.files.length > 0);
    assert.equal(fs.existsSync(path.join(project, "docs")), false);
  } finally {
    cleanup(before, after, project);
  }
});
