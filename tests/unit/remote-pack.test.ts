"use strict";

/**
 * Integration test for `scripts/domain-pack/remote.js`.
 * Uses a local git repository as the "remote" — no network access required.
 */

const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  resolveRemotePack,
  createPackBundle,
  repoHash,
  safeVersionDir,
  gitAvailable,
} = require("../../packages/core/src/infrastructure/RemotePackResolver");

const HAS_GIT = gitAvailable();
const skipReason = HAS_GIT ? undefined : "git is not available on PATH";

function git(args, opts = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function makeBareSourceRepo(tag) {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "specops-src-"));
  git(["init", "--quiet", "--initial-branch=main", src]);
  // Configure local identity + disable signing so commits succeed in any environment.
  git(["config", "user.email", "test@example.com"], { cwd: src });
  git(["config", "user.name", "Test"], { cwd: src });
  git(["config", "commit.gpgsign", "false"], { cwd: src });
  git(["config", "tag.gpgsign", "false"], { cwd: src });
  // Minimal pack layout: <root>/backend/pack.yaml
  fs.mkdirSync(path.join(src, "backend"), { recursive: true });
  fs.writeFileSync(
    path.join(src, "backend", "pack.yaml"),
    [
      'schema_version: "1.1.0"',
      "metadata:",
      '  name: "Test Pack"',
      '  version: "1.0.0"',
      '  language: "en"',
      '  project_type: "backend"',
      "",
    ].join("\n"),
    "utf8"
  );
  git(["add", "."], { cwd: src });
  git(["commit", "--quiet", "-m", "initial"], { cwd: src });
  git(["tag", tag], { cwd: src });
  return src;
}

let SOURCE_REPO;
const TAG = "v1.0.0";

before(() => {
  if (!HAS_GIT) return;
  SOURCE_REPO = makeBareSourceRepo(TAG);
});

test("repoHash is deterministic for the same URL", () => {
  assert.equal(repoHash("https://example.com/r.git"), repoHash("https://example.com/r.git"));
});

test("repoHash differs for different URLs", () => {
  assert.notEqual(repoHash("https://a.com/r.git"), repoHash("https://b.com/r.git"));
});

test("safeVersionDir strips path-unsafe characters", () => {
  assert.equal(safeVersionDir("v1.0.0"), "v1.0.0");
  assert.equal(safeVersionDir("feature/branch"), "feature_branch");
  assert.equal(safeVersionDir("../escape"), ".._escape");
});

test("resolveRemotePack throws when repo is missing", () => {
  assert.throws(() => resolveRemotePack({ version: "v1.0.0" }), /'repo' is required/);
});

test("resolveRemotePack throws when version is missing", () => {
  assert.throws(() => resolveRemotePack({ repo: "x" }), /'version' is required/);
});

test(
  "resolveRemotePack clones a tag and returns its local path + commit",
  { skip: skipReason },
  () => {
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
    try {
      const result = resolveRemotePack({
        repo: SOURCE_REPO,
        version: TAG,
        cacheDir: cache,
      });
      assert.equal(result.cached, false);
      assert.ok(fs.existsSync(path.join(result.packRoot, "backend", "pack.yaml")));
      assert.match(result.commit, /^[0-9a-f]{40}$/);
      assert.equal(result.version, TAG);
    } finally {
      fs.rmSync(cache, { recursive: true, force: true });
    }
  }
);

test(
  "resolveRemotePack returns cached=true on second call without re-cloning",
  { skip: skipReason },
  () => {
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
    try {
      const first = resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache });
      const second = resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache });
      assert.equal(first.cached, false);
      assert.equal(second.cached, true);
      assert.equal(first.commit, second.commit);
      assert.equal(first.packRoot, second.packRoot);
    } finally {
      fs.rmSync(cache, { recursive: true, force: true });
    }
  }
);

test("resolveRemotePack with force=true re-clones even when cached", { skip: skipReason }, () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
  try {
    resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache });
    const forced = resolveRemotePack({
      repo: SOURCE_REPO,
      version: TAG,
      cacheDir: cache,
      force: true,
    });
    assert.equal(forced.cached, false);
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});

test("resolveRemotePack throws a contextual error for an unknown ref", { skip: skipReason }, () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
  try {
    assert.throws(
      () => resolveRemotePack({ repo: SOURCE_REPO, version: "v999.0.0", cacheDir: cache }),
      /git/
    );
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});

// ── Offline mode (B4) ─────────────────────────────────────────────────────────

test("offline mode serves a cached pack without touching the network", { skip: skipReason }, () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
  try {
    resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache });
    const offline = resolveRemotePack({
      repo: SOURCE_REPO,
      version: TAG,
      cacheDir: cache,
      offline: true,
    });
    assert.equal(offline.cached, true);
    assert.ok(fs.existsSync(path.join(offline.packRoot, "backend", "pack.yaml")));
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});

test("offline mode fails a cache miss with the bundle remedy", { skip: skipReason }, () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
  try {
    assert.throws(
      () => resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache, offline: true }),
      /Offline mode: .*not in the local cache[\s\S]*pack bundle/
    );
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});

test("SPECGATE_OFFLINE env var activates offline mode", { skip: skipReason }, () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
  const prev = process.env.SPECGATE_OFFLINE;
  process.env.SPECGATE_OFFLINE = "1";
  try {
    assert.throws(
      () => resolveRemotePack({ repo: SOURCE_REPO, version: TAG, cacheDir: cache }),
      /Offline mode/
    );
  } finally {
    if (prev === undefined) delete process.env.SPECGATE_OFFLINE;
    else process.env.SPECGATE_OFFLINE = prev;
    fs.rmSync(cache, { recursive: true, force: true });
  }
});

// ── Pack bundles for air-gapped transport (B4) ────────────────────────────────

test(
  "a bundle round-trips: create, then resolve a tagged pack from it",
  { skip: skipReason },
  () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "specops-bundle-"));
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specops-cache-"));
    try {
      const bundlePath = path.join(workDir, "pack.bundle");
      const { out, refs } = createPackBundle({ repo: SOURCE_REPO, out: bundlePath });
      assert.ok(fs.existsSync(out));
      assert.ok(
        refs.some((r) => r.includes(TAG)),
        `bundle should carry the ${TAG} tag, got: ${refs.join(", ")}`
      );

      // The bundle file is a valid --pack-repo source (this is the air-gapped path).
      const resolved = resolveRemotePack({ repo: bundlePath, version: TAG, cacheDir: cache });
      assert.ok(fs.existsSync(path.join(resolved.packRoot, "backend", "pack.yaml")));
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
      fs.rmSync(cache, { recursive: true, force: true });
    }
  }
);
