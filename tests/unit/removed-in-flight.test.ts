"use strict";

/**
 * REQ-557 — a requirement an open change removes owes nothing to validate
 * (issue #432, change removed-in-flight): `check` judges the project after
 * archive, where it is gone, so `validate` must not ask for its files.
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
const { withStatus } = require("../../packages/core/src/domain/TraceabilityFormat");
const { inFlightView, leavingRequirements } = require("../../scripts/lib/in-flight");

const made: string[] = [];
require("node:test").after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const put = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const validate = (dir: string) => {
  const r = spawnSync(process.execPath, [CLI, "validate", ".", "--strict", "--json"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  let codes: string[] = [];
  try {
    codes = (JSON.parse(r.stdout).status || []).map((d: { code: string }) => d.code);
  } catch {
    codes = [];
  }
  return { status: r.status, codes, out: r.stdout + r.stderr };
};

/** A hand-kept project whose REQ-000 is delivered: a feature file, a test, the code. */
function deliveredProject(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-leaving-"));
  made.push(parent);
  const r = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--keep-matrix", "--out", parent, "--no-git"],
    { encoding: "utf8" }
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const matrix = path.join(dir, "docs/specs/traceability.md");
  fs.writeFileSync(
    matrix,
    fs
      .readFileSync(matrix, "utf8")
      .replace(
        /\| REQ-000 \|.*\n/,
        "| REQ-000 | SCN-000 | `features/core/health.feature` | - | - | - | - | `src/health.js` | `test/health.test.js` | Implemented |\n"
      )
  );
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs.readFileSync(spec, "utf8").replace("| Must | Draft |", "| Must | Implemented |")
  );
  // A second requirement, still Draft, so the project keeps a feature file.
  fs.appendFileSync(
    matrix,
    "| REQ-001 | SCN-001 | `features/core/status.feature` | - | - | - | - | - | TBD | Draft |\n"
  );
  put(
    dir,
    "features/core/status.feature",
    "Feature: Status\n\n  @REQ-001 @SCN-001\n  Scenario: A status page\n    Given the service runs\n    When someone opens /status\n    Then it answers 200\n"
  );
  put(dir, "src/health.js", "module.exports = () => ({ status: 'UP' });\n");
  put(dir, "test/health.test.js", "// REQ-000 SCN-000: the health endpoint\n");
  return dir;
}

const REMOVE = `# Delta — core

## REMOVED Requirements

### Requirement: REQ-000 — The service reports its own health

No longer offered.
`;

test("REQ-557 SCN-557a: removing a delivered requirement", () => {
  const dir = deliveredProject();
  assert.equal(validate(dir).status, 0, "the delivered project passes");

  // Without a change that removes it, its files going missing is drift.
  fs.rmSync(path.join(dir, "features/core/health.feature"));
  fs.rmSync(path.join(dir, "test/health.test.js"));
  const drift = validate(dir);
  assert.equal(drift.status, 1, drift.out);
  assert.ok(drift.codes.includes("declared_artifact_missing"), drift.out);

  // With an open change that removes it, it owes nothing.
  put(
    dir,
    "docs/specs/changes/drop-health/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-11-15\nrigor: lite\nreq_range: []\n"
  );
  put(
    dir,
    "docs/specs/changes/drop-health/proposal.md",
    "# Proposal: drop-health\n\n## Intent\n\nGone.\n"
  );
  put(dir, "docs/specs/changes/drop-health/specs/core/spec.md", REMOVE);
  const leaving = validate(dir);
  assert.equal(leaving.status, 0, leaving.out);
  assert.ok(!leaving.codes.includes("declared_artifact_missing"), leaving.out);
  assert.ok(!leaving.codes.some((c) => c.startsWith("strict_tdd")), leaving.out);
  assert.ok(leaving.codes.includes("requirement_leaving"), leaving.out);
});

test("REQ-557: the requirements open changes remove, and the matrix as validate judges it", () => {
  const dir = deliveredProject();
  assert.equal(leavingRequirements(dir).size, 0);
  put(dir, "docs/specs/changes/drop-health/specs/core/spec.md", REMOVE);
  assert.deepEqual([...leavingRequirements(dir)], [["REQ-000", "drop-health"]]);

  const matrix =
    "| Requirement | Scenario ID | Status |\n|---|---|---|\n" +
    "| REQ-000 | SCN-000a | Implemented |\n| REQ-000 | SCN-000b | Implemented |\n| REQ-001 | SCN-001 | Implemented |\n";
  assert.equal(
    withStatus(matrix, new Set(["REQ-000"]), "Deprecated"),
    "| Requirement | Scenario ID | Status |\n|---|---|---|\n" +
      "| REQ-000 | SCN-000a | Deprecated |\n| REQ-000 | SCN-000b | Deprecated |\n| REQ-001 | SCN-001 | Implemented |\n"
  );
  assert.equal(withStatus(matrix, new Set(), "Deprecated"), matrix);
});

test("REQ-558 SCN-558a: a linked node_modules", { skip: process.platform === "win32" }, () => {
  const dir = deliveredProject();
  // An open change with a requirement in it, so there is an after-archive view.
  put(
    dir,
    "docs/specs/changes/status-page/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-11-15\nrigor: lite\nreq_range: [REQ-002, REQ-002]\n"
  );
  put(
    dir,
    "docs/specs/changes/status-page/specs/core/spec.md",
    "# Delta — core\n\n## ADDED Requirements\n\n### Requirement: REQ-002 — A status page\n\nThe system SHALL answer /status.\n\n" +
      "#### Scenario: SCN-002a — Status\n\n- GIVEN the service runs\n- WHEN someone opens /status\n- THEN it answers 200\n"
  );
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-shared-"));
  made.push(shared);
  fs.writeFileSync(path.join(shared, "dep.js"), "module.exports = 1;\n");
  // Linked, and not ignored: `node_modules/` in .gitignore matches a folder, not a link.
  fs.symlinkSync(shared, path.join(dir, "node_modules"));
  for (const args of [
    ["init", "-q", "-b", "main"],
    ["add", "-A"],
  ]) {
    spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  }
  const view = inFlightView(dir);
  assert.ok(view, "the open change gives an after-archive view");
  try {
    const link = path.join(view.dir, "node_modules");
    assert.ok(fs.lstatSync(link).isSymbolicLink(), "linked again, not copied");
    assert.equal(fs.readlinkSync(link), shared);
  } finally {
    view.cleanup();
  }
});
