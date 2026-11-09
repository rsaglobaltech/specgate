"use strict";

/**
 * REQ-270 — the studio's report judges the project as `check` does: after the
 * harness delivered a draft's requirement, before the draft was archived, the
 * report said "No pasa" for a feature file the written matrix has no row for
 * (truck-flote S57).
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
const { gate } = require("../../scripts/lib/studio-app");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("REQ-270 SCN-270a: a draft's requirement delivered before the draft is archived", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-studio-inflight-"));
  madeDirs.push(parent);
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w(
    "docs/specs/changes/draft-flota/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-10-28\nrigor: lite\nskip_specs: false\nretire_capabilities: false\n"
  );
  w(
    "docs/specs/changes/draft-flota/proposal.md",
    "# Proposal: draft-flota\n\n## Intent\n\nThe fleet.\n"
  );
  w("docs/specs/changes/draft-flota/tasks.md", "# Tasks\n\n- [ ] 1.1 REQ-002\n");
  w(
    "docs/specs/changes/draft-flota/specs/flota/spec.md",
    [
      "# Delta — flota",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-002 — Alta de vehículo",
      "",
      "The system SHALL let the Despachador register a vehicle with its matrícula.",
      "",
      "#### Scenario: SCN-002 — Un camión nuevo",
      "",
      '- GIVEN the fleet has no vehicle "1234-BCD"',
      '- WHEN the Despachador registers "1234-BCD"',
      '- THEN they see "1234-BCD" in the fleet list',
      "",
      "<!-- specgate:trace actor=Despachador feature=features/flota/REQ-002.feature kind=functional -->",
      "",
    ].join("\n")
  );
  // What the harness wrote for REQ-002 before the draft was archived.
  w(
    "features/flota/REQ-002.feature",
    [
      "Feature: Alta de vehículo",
      "",
      "  @REQ-002 @SCN-002",
      "  Scenario: Un camión nuevo",
      '    Given the fleet has no vehicle "1234-BCD"',
      '    When the Despachador registers "1234-BCD"',
      '    Then they see "1234-BCD" in the fleet list',
      "",
    ].join("\n")
  );
  spawnSync(process.execPath, [CLI, "matrix", "--project-dir", dir], { encoding: "utf8" });
  const git = (...a: string[]) =>
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], {
      cwd: dir,
      encoding: "utf8",
    });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "seed");

  const bare = spawnSync(process.execPath, [CLI, "validate", dir, "--strict"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.notEqual(bare.status, 0, "the specification as written has no row for the feature");
  assert.match(bare.stdout + bare.stderr, /features\/flota\/REQ-002\.feature/);

  const judged = gate(dir);
  assert.equal(judged.ok, true, judged.findings.join("\n"));
});
