"use strict";
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-mono-"));
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

test("validate on a monorepo root validates every declared project", () => {
  withMonorepo((root) => {
    const r = cli("validate", root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Monorepo: validating 2 project\(s\)/);
    assert.match(r.stdout, /── services\/fhir-server ──/);
    assert.match(r.stdout, /── services\/mpi ──/);
    assert.match(r.stdout, /2\/2 project\(s\) passed/);
  });
});

test("one broken sub-project fails the whole monorepo with a per-project summary", () => {
  withMonorepo((root) => {
    fs.rmSync(path.join(root, "services", "mpi", "spec.md"));
    const r = cli("validate", root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /✅ services\/fhir-server/);
    assert.match(r.stdout, /❌ services\/mpi/);
    assert.match(r.stdout, /1\/2 project\(s\) passed/);
    // The sub-project's own remedy still surfaces.
    assert.match(r.stderr, /Missing required file: spec\.md/);
  });
});

test("--strict-tdd propagates to every sub-project", () => {
  withMonorepo((root) => {
    // In Dev + TBD test artifact violates TDD-1 only under --strict-tdd.
    const trace = path.join(root, "services", "mpi", "docs", "specs", "traceability.md");
    fs.writeFileSync(
      trace,
      fs.readFileSync(trace, "utf8").replace("| Draft |", "| In Dev |"),
      "utf8"
    );
    assert.equal(cli("validate", root).status, 0);
    const strict = cli("validate", root, "--strict-tdd");
    assert.equal(strict.status, 1);
    assert.match(strict.stderr, /\[TDD-1\]/);
  });
});

test("a missing project directory is reported with a fix, others still run", () => {
  withMonorepo((root) => {
    fs.appendFileSync(path.join(root, "specops.config.yaml"), "  - services/ghost\n");
    const r = cli("validate", root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Project directory not found: services\/ghost/);
    assert.match(r.stderr, /💡 \[FIX\] Fix the 'projects:' entry/);
    assert.match(r.stdout, /2\/3 project\(s\) passed/);
  });
});

test("a project without projects: list still validates as a single project", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-single-"));
  try {
    const dir = makeSubProject(tmp, "solo");
    // specops.config.yaml with packs but no projects → normal validation.
    fs.writeFileSync(path.join(dir, "specops.config.yaml"), "specops_version: 1\n", "utf8");
    const r = cli("validate", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Validation passed/);
    assert.ok(!r.stdout.includes("Monorepo"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
