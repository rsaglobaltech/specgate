"use strict";

/**
 * `specgate validate --strict-links` — a declared link still points at something
 * that exists (`PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.5, the F6 follow-on).
 *
 * Not formal verification — just the matrix's own promises kept. A file named
 * in the Feature file, Technical artifact or Test artifact column can be
 * renamed or deleted with nothing updating the row that names it, so the
 * matrix keeps pointing a reader (or an agent) at code that is not there.
 *
 * **Opt-in, corrected from an earlier assumption.** The first version of this
 * check ran unconditionally on the theory that "this path does not exist" has
 * no legitimate reading. `tests/unit/validate-strict-tdd.test.ts` disproved
 * that immediately: a `Draft` or `In Dev` row routinely names the file a
 * requirement is *going to* land in before anyone writes it. Same promise as
 * `--strict-scenarios`: a project with aspirational rows does not fail its
 * next `validate` over this.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(REPO_ROOT, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "declared-exists-"));
  const init = cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix");
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

function tracePath(projectDir) {
  return path.join(projectDir, "docs/specs/traceability.md");
}

/**
 * Mark REQ-000 delivered. A missing file is drift only on a row that claims the
 * work exists; a Draft row names where the work is going to land.
 */
function deliver(projectDir) {
  const file = tracePath(projectDir);
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace("| TBD | Draft |", "| TBD | Implemented |"),
    "utf8"
  );
}

function pointAtNothing(projectDir, { delivered = true } = {}) {
  const file = tracePath(projectDir);
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace("`API /health`, smoke test", "`src/health/HealthCheck.ts`"),
    "utf8"
  );
  if (delivered) deliver(projectDir);
}

test("a scaffolded project declares no real paths and passes --strict-links", () => {
  // REQ-000's row says `` `API /health`, smoke test `` and `TBD` — neither
  // column looks like a path, so there is nothing to check yet.
  const { parent, projectDir } = scaffold();
  try {
    const r = cli("validate", projectDir, "--strict-links");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("without the flag, a stale declared path does not fail validate", () => {
  // The gradual-adoption promise: aspirational rows are normal, and the
  // default gate must not punish a project for planning ahead.
  const { parent, projectDir } = scaffold();
  try {
    pointAtNothing(projectDir);
    const r = cli("validate", projectDir);
    assert.equal(r.status, 0, `plain validate should still pass:\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, /declared_artifact_missing/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-links fails a technical artifact pointing nowhere", () => {
  const { parent, projectDir } = scaffold();
  try {
    pointAtNothing(projectDir);
    const r = cli("validate", projectDir, "--strict-links");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    const out = r.stdout + r.stderr;
    assert.match(out, /declared_artifact_missing/);
    assert.match(out, /src\/health\/HealthCheck\.ts/);
    assert.match(out, /REQ-000/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-links catches a feature file column pointing nowhere too", () => {
  const { parent, projectDir } = scaffold();
  try {
    const file = tracePath(projectDir);
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace("`features/core/health.feature`", "`features/core/moved.feature`"),
      "utf8"
    );
    deliver(projectDir);
    const r = cli("validate", projectDir, "--strict-links");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /features\/core\/moved\.feature/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a Draft row may name a file that does not exist yet", () => {
  // Measured 2026-10-06: with `--strict` as the CI gate, a team that declares
  // where a requirement will land before writing it had a red build, and the
  // harness failed one requirement's worktree over a sibling's planned paths.
  const { parent, projectDir } = scaffold();
  try {
    pointAtNothing(projectDir, { delivered: false });
    const r = cli("validate", projectDir, "--strict-links");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--delivering holds a Draft requirement to what a delivered one owes", () => {
  // `done --check` and the harness gate run before the status flips. Without
  // this they would skip the one requirement they are about to mark Implemented.
  const { parent, projectDir } = scaffold();
  try {
    pointAtNothing(projectDir, { delivered: false });
    const r = cli("validate", projectDir, "--strict-links", "--delivering", "REQ-000");
    assert.notEqual(r.status, 0, `expected a failure:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /src\/health\/HealthCheck\.ts/);

    const other = cli("validate", projectDir, "--strict-links", "--delivering", "REQ-999");
    assert.equal(other.status, 0, "another requirement's delivery owes nothing for REQ-000");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-links strips a line-range anchor before checking existence", () => {
  const { parent, projectDir } = scaffold();
  try {
    const file = tracePath(projectDir);
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace("`API /health`, smoke test", "`README.md#L1-L10`"),
      "utf8"
    );
    // The file exists; only the anchor is fictional. Should pass.
    const r = cli("validate", projectDir, "--strict-links");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("fixing the path clears the --strict-links failure", () => {
  const { parent, projectDir } = scaffold();
  try {
    const file = tracePath(projectDir);
    const original = fs.readFileSync(file, "utf8");
    pointAtNothing(projectDir);
    assert.notEqual(cli("validate", projectDir, "--strict-links").status, 0);

    fs.writeFileSync(file, original, "utf8");
    const r = cli("validate", projectDir, "--strict-links");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--json carries the diagnostic with file, target and fix", () => {
  const { parent, projectDir } = scaffold();
  try {
    pointAtNothing(projectDir);
    const r = cli("validate", projectDir, "--strict-links", "--json");
    assert.notEqual(r.status, 0);
    const doc = JSON.parse(r.stdout);
    const found = doc.status.find((d) => d.code === "declared_artifact_missing");
    assert.ok(found, JSON.stringify(doc));
    assert.equal(found.file, "docs/specs/traceability.md");
    assert.equal(found.target, "REQ-000");
    assert.match(found.fix, /restore/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-links is a declared flag, not one that slips through", () => {
  const r = cli("validate", ".", "--strict-linksX");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Unknown flag/);
});

test("this repository's own matrix passes --strict-links — 22 real declared paths, 0 stale", () => {
  const r = cli("validate", REPO_ROOT, "--strict-links");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
