"use strict";

/**
 * `specgate init --from-pack <repo>@<tag>` — the multi-repo answer.
 *
 * OpenSpec solves sharing specs across repositories with a central Store. This
 * repository already had the same capability in a different shape — a private
 * pack, versioned and pinned — so what was missing was one command instead of
 * two. The property worth protecting is the pin: an unpinned reference is
 * refused, because two services scaffolded a week apart silently getting
 * different requirements is the failure this is meant to prevent.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { parseReference, newestProjectIn } = require("../../scripts/init_from_pack");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

test("a reference splits on the last @, so scp-style git URLs still parse", () => {
  assert.deepEqual(parseReference("https://github.com/acme/x.git@v1.2.3"), {
    repo: "https://github.com/acme/x.git",
    version: "v1.2.3",
  });
  // git@github.com:acme/x.git@v1 — the first @ belongs to the user.
  assert.deepEqual(parseReference("git@github.com:acme/x.git@v1"), {
    repo: "git@github.com:acme/x.git",
    version: "v1",
  });
  assert.deepEqual(parseReference("https://github.com/acme/x.git"), {
    repo: "https://github.com/acme/x.git",
    version: null,
  });
});

test("an unpinned pack reference is refused", () => {
  const r = cli(
    "init",
    "--from-pack",
    "https://github.com/acme/x.git",
    "--pack",
    "backend",
    "--json"
  );
  assert.equal(r.status, 2);
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.project, null);
  assert.equal(doc.status[0].code, "from_pack_unpinned");
  assert.match(doc.status[0].fix, /week apart/);
});

test("--pack is required — a repo may hold several", () => {
  const r = cli("init", "--from-pack", "https://github.com/acme/x.git@v1", "--json");
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).status[0].code, "pack_id_required");
});

test("newestProjectIn finds the scaffolded project, not any directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "from-pack-"));
  try {
    fs.mkdirSync(path.join(root, "not-a-project"));
    fs.mkdirSync(path.join(root, "a-project"));
    fs.writeFileSync(path.join(root, "a-project", "spec.md"), "# Spec\n", "utf8");
    assert.equal(newestProjectIn(root), path.join(root, "a-project"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("newestProjectIn returns null rather than guessing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "from-pack-empty-"));
  try {
    assert.equal(newestProjectIn(root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── The starter requirement, and why --from-pack drops it ────────────────────
//
// `init` seeds REQ-000 with a health scenario so a new project has one worked
// example. When a pack follows, the pack brings its own requirements — often
// its own health one — and `include_existing_rows` carries REQ-000 forward
// beside them. csda-studio-app ended up with REQ-000 and the pack's REQ-015
// both describing deployment health.

const FIXTURE_PACKS = path.resolve(ROOT_DIR, "tests/fixtures/domain-packs");

function scaffold(...extra) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-sample-"));
  const r = cli("init", "--yes", "--out", parent, "--no-git", "--keep-matrix", ...extra);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir: path.join(parent, fs.readdirSync(parent)[0]) };
}

function matrix(dir) {
  return fs.readFileSync(path.join(dir, "docs", "specs", "traceability.md"), "utf8");
}

test("plain `init` still seeds the starter requirement", () => {
  const { parent, dir } = scaffold();
  try {
    assert.match(matrix(dir), /^\| REQ-000 \|/m);
    assert.ok(fs.existsSync(path.join(dir, "features", "core", "health.feature")));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--no-sample-req omits the row and its feature file, keeping features/", () => {
  const { parent, dir } = scaffold("--no-sample-req");
  try {
    assert.doesNotMatch(matrix(dir), /^\| REQ-000 \|/m);
    assert.ok(!fs.existsSync(path.join(dir, "features", "core", "health.feature")));
    // Required structure: the pack renders into it moments later.
    assert.ok(fs.existsSync(path.join(dir, "features")), "features/ must survive");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("with --no-sample-req, an installed pack leaves no leftover requirement", () => {
  // The end-to-end shape of the defect: scaffold, install a pack, count rows.
  const withSample = scaffold();
  const without = scaffold("--no-sample-req");
  try {
    for (const dir of [withSample.dir, without.dir]) {
      const r = cli(
        "expand",
        "--pack-root",
        FIXTURE_PACKS,
        "--pack",
        "parking-management/backend",
        "--project-dir",
        dir,
        "--var",
        "PROJECT_NAME=Cmp",
        "--var",
        "PROJECT_SLUG=cmp",
        "--var",
        "DOMAIN=parking"
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }

    const rows = (dir) =>
      matrix(dir)
        .split("\n")
        .filter((l) => /^\| REQ-\d/.test(l));
    assert.equal(
      rows(without.dir).length + 1,
      rows(withSample.dir).length,
      "exactly one row differs"
    );
    assert.ok(
      rows(withSample.dir).some((l) => l.startsWith("| REQ-000 ")),
      "the leftover"
    );
    assert.ok(!rows(without.dir).some((l) => l.startsWith("| REQ-000 ")), "no leftover");

    // Both are still valid projects — this is a tidiness fix, not a repair.
    for (const dir of [withSample.dir, without.dir]) {
      assert.equal(cli("validate", dir).status, 0);
    }
  } finally {
    fs.rmSync(withSample.parent, { recursive: true, force: true });
    fs.rmSync(without.parent, { recursive: true, force: true });
  }
});
