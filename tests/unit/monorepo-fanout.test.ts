"use strict";

/**
 * `plan`, `status` and `report` honour `projects:` (E2-06 / issue #104).
 *
 * `validate` has always fanned out over `specops.config.yaml`'s `projects:`
 * list — `tests/unit/validate-monorepo.test.ts` pins that. Measured before
 * this: nothing else did. A two-project monorepo's `plan`/`status`/`report`
 * silently saw only whichever project the CLI happened to be invoked from —
 * not an error, just wrong. Same fixture shape as `validate`'s own test, so
 * a reader can compare the two files directly.
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

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function makeSubProject(root, rel) {
  const dir = path.join(root, rel);
  fs.mkdirSync(path.join(dir, "features"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "specs", "adr"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), `# ${rel}\n\n## REQ-001 — Baseline\n`, "utf8");
  fs.writeFileSync(path.join(dir, "AI_RULES.md"), "# Rules\n", "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "# Readme\n", "utf8");
  fs.writeFileSync(path.join(dir, "docs", "specs", "adr", "README.md"), "# ADRs\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "features", "base.feature"),
    "Feature: Base\n  Scenario: ok\n    Given x\n    Then y\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [
      "# Matrix",
      "",
      RICH_HEADER,
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| REQ-001 | SCN-001 | `features/base.feature` | UC-001 | - | - | - | - | TBD | Draft |",
      "",
    ].join("\n"),
    "utf8"
  );
  return dir;
}

function withMonorepo(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-fanout-"));
  try {
    makeSubProject(tmp, path.join("services", "fhir-server"));
    makeSubProject(tmp, path.join("services", "mpi"));
    fs.writeFileSync(
      path.join(tmp, "specops.config.yaml"),
      ["specops_version: 1", "projects:", "  - services/fhir-server", "  - services/mpi", ""].join(
        "\n"
      ),
      "utf8"
    );
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const command of ["plan", "status", "report"]) {
  test(`${command} on a monorepo root walks every declared project`, () => {
    withMonorepo((root) => {
      const r = cli(command, "--project-dir", root);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, new RegExp(`Monorepo: running ${command}\\.js on 2 project\\(s\\)`));
      assert.match(r.stdout, /── services\/fhir-server ──/);
      assert.match(r.stdout, /── services\/mpi ──/);
      assert.match(r.stdout, /2\/2 project\(s\) done/);
    });
  });

  test(`${command}: a missing project directory is reported, others still run`, () => {
    withMonorepo((root) => {
      fs.appendFileSync(path.join(root, "specops.config.yaml"), "  - services/ghost\n");
      const r = cli(command, "--project-dir", root);
      assert.equal(r.status, 1);
      assert.match(r.stdout + r.stderr, /Project directory not found: services\/ghost/);
      assert.match(r.stdout + r.stderr, /Fix the 'projects:' entry/);
      assert.match(r.stdout, /2\/3 project\(s\) done/);
    });
  });

  test(`${command}: a project without projects: still runs as a single project`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-fanout-solo-"));
    try {
      const dir = makeSubProject(tmp, "solo");
      fs.writeFileSync(path.join(dir, "specops.config.yaml"), "specops_version: 1\n", "utf8");
      const r = cli(command, "--project-dir", dir);
      assert.ok(!r.stdout.includes("Monorepo"), r.stdout);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}

test("plan's monorepo summary reflects each sub-project's own requirements, not the root's", () => {
  withMonorepo((root) => {
    // REQ-001 in fhir-server has no technical/test artifact declared — "code
    // missing" — and the same is true for mpi. Confirms this ran plan.js
    // against each sub-project's own traceability.md, not one shared view.
    const r = cli("plan", "--project-dir", root);
    const occurrences = (r.stdout.match(/REQ-001/g) || []).length;
    assert.equal(occurrences, 2, r.stdout);
  });
});
