"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  computePackDigest,
  readSecurityPolicy,
  verifyTagSignature,
  assertDigestUnchanged,
} = require("../../scripts/specops/verify");
const { gitAvailable } = require("../../packages/core/src/infrastructure/RemotePackResolver");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const FIXTURE_PACK = path.join(ROOT_DIR, "tests", "fixtures", "domain-packs", "parking-management");

const HAS_GIT = gitAvailable();
const skipReason = HAS_GIT ? undefined : "git is not available on PATH";

function cli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    ...options,
  });
}

function git(args, opts = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

// ── computePackDigest ─────────────────────────────────────────────────────────

test("computePackDigest is deterministic and content-sensitive", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-digest-"));
  try {
    fs.mkdirSync(path.join(tmp, "sub"));
    fs.writeFileSync(path.join(tmp, "a.txt"), "alpha", "utf8");
    fs.writeFileSync(path.join(tmp, "sub", "b.txt"), "beta", "utf8");

    const first = computePackDigest(tmp);
    const second = computePackDigest(tmp);
    assert.equal(first, second);
    assert.match(first, /^sha256:[0-9a-f]{64}$/);

    fs.writeFileSync(path.join(tmp, "a.txt"), "ALPHA", "utf8");
    assert.notEqual(computePackDigest(tmp), first);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("computePackDigest ignores .git internals", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-digest-"));
  try {
    fs.writeFileSync(path.join(tmp, "a.txt"), "alpha", "utf8");
    const before = computePackDigest(tmp);
    fs.mkdirSync(path.join(tmp, ".git"));
    fs.writeFileSync(path.join(tmp, ".git", "config"), "noise", "utf8");
    assert.equal(computePackDigest(tmp), before);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── assertDigestUnchanged ─────────────────────────────────────────────────────

test("assertDigestUnchanged passes on match, missing digest, or version bump", () => {
  const entry = { version: "v1", digest: "sha256:aa" };
  assert.doesNotThrow(() => assertDigestUnchanged(entry, "p", "v1", "sha256:aa"));
  assert.doesNotThrow(() => assertDigestUnchanged({ version: "v1" }, "p", "v1", "sha256:bb"));
  assert.doesNotThrow(() => assertDigestUnchanged(entry, "p", "v2", "sha256:bb"));
  assert.doesNotThrow(() => assertDigestUnchanged(null, "p", "v1", "sha256:bb"));
});

test("assertDigestUnchanged throws on a content change behind the same version", () => {
  const entry = { version: "v1", digest: "sha256:aa" };
  assert.throws(
    () => assertDigestUnchanged(entry, "billing/backend", "v1", "sha256:bb"),
    /integrity check failed for billing\/backend@v1[\s\S]*moved tag/
  );
});

// ── readSecurityPolicy ────────────────────────────────────────────────────────

test("readSecurityPolicy reads require_signed_packs from specops.config.yaml", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-policy-"));
  try {
    assert.equal(readSecurityPolicy(tmp).requireSignedPacks, false);
    fs.writeFileSync(
      path.join(tmp, "specops.config.yaml"),
      "specops_version: 1\nrequire_signed_packs: true\n",
      "utf8"
    );
    assert.equal(readSecurityPolicy(tmp).requireSignedPacks, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── verifyTagSignature ────────────────────────────────────────────────────────

test("verifyTagSignature reports unsigned tags as unverified", { skip: skipReason }, () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sig-"));
  try {
    git(["init", "--quiet", "--initial-branch=main", src]);
    git(["config", "user.email", "t@example.com"], { cwd: src });
    git(["config", "user.name", "T"], { cwd: src });
    git(["config", "commit.gpgsign", "false"], { cwd: src });
    git(["config", "tag.gpgsign", "false"], { cwd: src });
    fs.writeFileSync(path.join(src, "f.txt"), "x", "utf8");
    git(["add", "."], { cwd: src });
    git(["commit", "--quiet", "-m", "c"], { cwd: src });
    git(["tag", "v1.0.0"], { cwd: src });

    const result = verifyTagSignature(src, "v1.0.0");
    assert.equal(result.verified, false);
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
  }
});

// ── End-to-end: digest in lock + poisoned-cache detection ─────────────────────

function makePackRepo() {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-packrepo-"));
  fs.cpSync(FIXTURE_PACK, path.join(src, "parking-management"), { recursive: true });
  git(["init", "--quiet", "--initial-branch=main", src]);
  git(["config", "user.email", "t@example.com"], { cwd: src });
  git(["config", "user.name", "T"], { cwd: src });
  git(["config", "commit.gpgsign", "false"], { cwd: src });
  git(["config", "tag.gpgsign", "false"], { cwd: src });
  git(["add", "."], { cwd: src });
  git(["commit", "--quiet", "-m", "pack"], { cwd: src });
  git(["tag", "v1.0.0"], { cwd: src });
  return src;
}

test(
  "expand records the pack digest and detects a poisoned cache on re-add",
  { skip: skipReason },
  () => {
    const repo = makePackRepo();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-verify-e2e-"));
    const cache = path.join(tmp, "cache");
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    try {
      const args = [
        "expand",
        "--pack-repo",
        repo,
        "--pack-version",
        "v1.0.0",
        "--pack",
        "parking-management/backend",
        "--project-dir",
        projectDir,
        "--cache-dir",
        cache,
        "--var",
        "PROJECT_NAME=Verify Test",
        "--var",
        "PROJECT_SLUG=verify-test",
        "--var",
        "DOMAIN=testing",
      ];
      const first = cli(args);
      assert.equal(first.status, 0, first.stdout + first.stderr);

      const lock = JSON.parse(fs.readFileSync(path.join(projectDir, ".specops.lock"), "utf8"));
      assert.match(lock.packs[0].digest, /^sha256:[0-9a-f]{64}$/);

      // Poison the cached pack (same version, altered content).
      const cachedPackYaml = spawnSync(
        process.execPath,
        [
          "-e",
          `const fs=require('fs'),path=require('path');
           function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
             const f=path.join(d,e.name);
             if(e.name==='.git')return[];
             return e.isDirectory()?walk(f):[f];})}
           const hit=walk(process.argv[1]).find(f=>f.endsWith('pack.yaml'));
           fs.appendFileSync(hit,'\\n# tampered\\n');
           console.log(hit);`,
          cache,
        ],
        { encoding: "utf8" }
      );
      assert.equal(cachedPackYaml.status, 0, cachedPackYaml.stderr);

      const second = cli(args);
      assert.equal(second.status, 1);
      assert.match(second.stderr, /integrity check failed/);
      assert.match(second.stderr, /re-pin with a new --pack-version/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  }
);

test("require_signed_packs blocks an unsigned pack with a remedy", { skip: skipReason }, () => {
  const repo = makePackRepo();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-signed-e2e-"));
  const projectDir = path.join(tmp, "project");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "specops.config.yaml"),
    "specops_version: 1\nrequire_signed_packs: true\n",
    "utf8"
  );
  try {
    const r = cli([
      "expand",
      "--pack-repo",
      repo,
      "--pack-version",
      "v1.0.0",
      "--pack",
      "parking-management/backend",
      "--project-dir",
      projectDir,
      "--cache-dir",
      path.join(tmp, "cache"),
      "--var",
      "PROJECT_NAME=Signed Test",
      "--var",
      "PROJECT_SLUG=signed-test",
      "--var",
      "DOMAIN=testing",
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /require_signed_packs is enabled/);
    assert.match(r.stderr, /git tag -s/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
