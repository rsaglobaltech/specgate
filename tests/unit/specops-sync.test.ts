"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseArgs, buildExpandArgs, reconcileFile } = require("../../scripts/specops/sync");
const { snapshotBaseline } = require("../../scripts/specops/manifest");

// ── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs defaults projectDir to '.' when not provided", () => {
  const args = parseArgs([]);
  assert.equal(args.projectDir, ".");
  assert.equal(args.pack, "");
  assert.equal(args.packVersion, "");
  assert.equal(args.dryRun, false);
});

test("parseArgs accepts --project-dir, --pack, --pack-version, --cache-dir, --dry-run", () => {
  const args = parseArgs([
    "--project-dir",
    "./p",
    "--pack",
    "backend",
    "--pack-version",
    "v2.0.0",
    "--cache-dir",
    "/tmp/c",
    "--dry-run",
  ]);
  assert.equal(args.projectDir, "./p");
  assert.equal(args.pack, "backend");
  assert.equal(args.packVersion, "v2.0.0");
  assert.equal(args.cacheDir, "/tmp/c");
  assert.equal(args.dryRun, true);
});

test("parseArgs throws on unknown flag", () => {
  assert.throws(() => parseArgs(["--bogus"]), /Unknown argument/);
});

test("parseArgs accepts --force and --abort-on-conflict", () => {
  assert.equal(parseArgs(["--force"]).force, true);
  assert.equal(parseArgs(["--abort-on-conflict"]).abortOnConflict, true);
  assert.equal(parseArgs([]).force, false);
  assert.equal(parseArgs([]).abortOnConflict, false);
});

test("parseArgs rejects --force together with --abort-on-conflict", () => {
  assert.throws(() => parseArgs(["--force", "--abort-on-conflict"]), /mutually exclusive/);
});

test("parseArgs collects repeated --var into a vars map", () => {
  const args = parseArgs(["--var", "STACK=Node 20", "--var", "EXTRA=on"]);
  assert.deepEqual(args.vars, { STACK: "Node 20", EXTRA: "on" });
});

test("parseArgs rejects a malformed --var", () => {
  assert.throws(() => parseArgs(["--var", "NOEQUALS"]), /KEY=VALUE/);
});

test("buildExpandArgs lets --var extend and override the lockfile vars", () => {
  const entry = { repo: "r", pack_id: "backend", version: "v1", vars: { PROJECT_NAME: "Old" } };
  const out = buildExpandArgs(entry, "v2", "/p", "", false, { PROJECT_NAME: "New", STACK: "Node" });
  // CLI value wins; new key is added.
  assert.ok(out.includes("PROJECT_NAME=New"));
  assert.ok(!out.includes("PROJECT_NAME=Old"));
  assert.ok(out.includes("STACK=Node"));
});

// ── reconcileFile — three-way classification ─────────────────────────────────

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "specops-sync-recon-"));
}

function writeLocal(dir: string, rel: string, content: string) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function readLocal(dir: string, rel: string) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

const baseArgs = { dryRun: false, force: false, abortOnConflict: false };

test("reconcileFile adds a file that does not exist locally", () => {
  const dir = tmpProject();
  try {
    const res = reconcileFile("spec.md", "incoming\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "added");
    assert.equal(readLocal(dir, "spec.md"), "incoming\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile reports unchanged when local already matches incoming", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "same\n");
    const res = reconcileFile("spec.md", "same\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "unchanged");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile cleanly updates a file the user never touched", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "v1\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "v1\n" }]);
    const res = reconcileFile("spec.md", "v2\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "updated");
    assert.equal(readLocal(dir, "spec.md"), "v2\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile keeps local edits when the pack version is unchanged", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "my edits\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "v1\n" }]);
    const res = reconcileFile("spec.md", "v1\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "kept");
    assert.equal(readLocal(dir, "spec.md"), "my edits\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile flags a conflict when no baseline is recorded", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "local\n");
    const res = reconcileFile("spec.md", "incoming\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "conflict-no-base");
    assert.equal(readLocal(dir, "spec.md"), "local\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile three-way merges non-overlapping edits", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "a-mine\nb\nc\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "a\nb\nc\n" }]);
    const res = reconcileFile("spec.md", "a\nb\nc-theirs\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "merged");
    assert.equal(readLocal(dir, "spec.md"), "a-mine\nb\nc-theirs\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile writes conflict markers on overlapping edits", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "a\nb-mine\nc\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "a\nb\nc\n" }]);
    const res = reconcileFile("spec.md", "a\nb-theirs\nc\n", dir, "backend", baseArgs);
    assert.equal(res.outcome, "conflict");
    assert.ok(readLocal(dir, "spec.md").includes("<<<<<<<"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile leaves the file untouched with --abort-on-conflict", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "a\nb-mine\nc\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "a\nb\nc\n" }]);
    const res = reconcileFile("spec.md", "a\nb-theirs\nc\n", dir, "backend", {
      ...baseArgs,
      abortOnConflict: true,
    });
    assert.equal(res.outcome, "conflict-skipped");
    assert.equal(readLocal(dir, "spec.md"), "a\nb-mine\nc\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile overwrites local edits with --force", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "my edits\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "v1\n" }]);
    const res = reconcileFile("spec.md", "v2\n", dir, "backend", { ...baseArgs, force: true });
    assert.equal(res.outcome, "overwritten");
    assert.equal(readLocal(dir, "spec.md"), "v2\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reconcileFile dry-run classifies without writing", () => {
  const dir = tmpProject();
  try {
    writeLocal(dir, "spec.md", "v1\n");
    snapshotBaseline(dir, "backend", [{ rel: "spec.md", content: "v1\n" }]);
    const res = reconcileFile("spec.md", "v2\n", dir, "backend", { ...baseArgs, dryRun: true });
    assert.equal(res.outcome, "updated");
    assert.equal(readLocal(dir, "spec.md"), "v1\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── buildExpandArgs ──────────────────────────────────────────────────────────

test("buildExpandArgs flattens lockfile vars to repeated --var args", () => {
  const entry = {
    repo: "https://example.com/r.git",
    pack_id: "backend",
    version: "v1.0.0",
    vars: { PROJECT_NAME: "Smart Parking", PROJECT_SLUG: "smart-parking" },
  };
  const args = buildExpandArgs(entry, "v1.0.0", "/project", "", false);
  assert.deepEqual(args.slice(0, 8), [
    "--pack-repo",
    "https://example.com/r.git",
    "--pack-version",
    "v1.0.0",
    "--pack",
    "backend",
    "--project-dir",
    "/project",
  ]);
  // --var KEY=VALUE pairs (order matches Object.entries)
  assert.ok(args.includes("--var"));
  assert.ok(args.includes("PROJECT_NAME=Smart Parking"));
  assert.ok(args.includes("PROJECT_SLUG=smart-parking"));
});

test("buildExpandArgs appends --cache-dir when provided", () => {
  const entry = { repo: "r", pack_id: "backend", version: "v1.0.0", vars: {} };
  const args = buildExpandArgs(entry, "v1.0.0", "/p", "/tmp/cache", false);
  assert.ok(args.includes("--cache-dir"));
  assert.ok(args.includes("/tmp/cache"));
});

test("buildExpandArgs appends --dry-run when requested", () => {
  const entry = { repo: "r", pack_id: "backend", version: "v1.0.0", vars: {} };
  const args = buildExpandArgs(entry, "v1.0.0", "/p", "", true);
  assert.ok(args.includes("--dry-run"));
});

test("buildExpandArgs uses the version override when different from entry", () => {
  const entry = { repo: "r", pack_id: "backend", version: "v1.0.0", vars: {} };
  const args = buildExpandArgs(entry, "v2.0.0", "/p", "", false);
  const idx = args.indexOf("--pack-version");
  assert.equal(args[idx + 1], "v2.0.0");
});

test("buildExpandArgs handles missing vars without throwing", () => {
  const entry = { repo: "r", pack_id: "backend", version: "v1.0.0" };
  assert.doesNotThrow(() => buildExpandArgs(entry, "v1.0.0", "/p", "", false));
});
