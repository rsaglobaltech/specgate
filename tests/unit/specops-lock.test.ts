"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  LOCK_FILENAME,
  SPECOPS_SCHEMA_VERSION,
  readLock,
  writeLock,
  upsertPackEntry,
  newLock,
} = require("../../scripts/specops/lock");

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "specops-lock-"));
}

test("readLock returns null when lockfile is absent", () => {
  const dir = tmpProject();
  try {
    assert.equal(readLock(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readLock throws on malformed JSON", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(path.join(dir, LOCK_FILENAME), "{not-json", "utf8");
    assert.throws(() => readLock(dir), /Invalid .specops.lock/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readLock throws when root is not an object", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(path.join(dir, LOCK_FILENAME), '["not","object"]', "utf8");
    assert.throws(() => readLock(dir), /root must be an object/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("newLock produces a valid empty lock", () => {
  const lock = newLock("0.1.0");
  assert.equal(lock.specops_version, SPECOPS_SCHEMA_VERSION);
  assert.equal(lock.specgate_version, "0.1.0");
  assert.deepEqual(lock.packs, []);
});

test("upsertPackEntry inserts a new pack when none present", () => {
  const lock = newLock("0.1.0");
  const updated = upsertPackEntry(lock, {
    repo: "https://example.com/r.git",
    version: "v1.0.0",
    commit: "abc1234",
    pack_id: "backend",
    expanded_at: "2026-05-12T00:00:00.000Z",
  });
  assert.equal(updated.packs.length, 1);
  assert.equal(updated.packs[0].version, "v1.0.0");
});

test("upsertPackEntry updates an existing pack matched by repo+pack_id", () => {
  let lock = newLock("0.1.0");
  lock = upsertPackEntry(lock, { repo: "r", pack_id: "backend", version: "v1.0.0", commit: "a" });
  lock = upsertPackEntry(lock, { repo: "r", pack_id: "backend", version: "v2.0.0", commit: "b" });
  assert.equal(lock.packs.length, 1);
  assert.equal(lock.packs[0].version, "v2.0.0");
  assert.equal(lock.packs[0].commit, "b");
});

test("upsertPackEntry keeps separate entries for different pack_ids", () => {
  let lock = newLock("0.1.0");
  lock = upsertPackEntry(lock, { repo: "r", pack_id: "backend", version: "v1.0.0" });
  lock = upsertPackEntry(lock, { repo: "r", pack_id: "frontend", version: "v1.0.0" });
  assert.equal(lock.packs.length, 2);
});

test("upsertPackEntry throws when required fields are missing", () => {
  assert.throws(() => upsertPackEntry(null, { repo: "r" }), /required/);
  assert.throws(() => upsertPackEntry(null, { pack_id: "backend" }), /required/);
});

test("upsertPackEntry initialises lock when given null", () => {
  const lock = upsertPackEntry(null, { repo: "r", pack_id: "backend", version: "v1" });
  assert.equal(lock.specops_version, SPECOPS_SCHEMA_VERSION);
  assert.equal(lock.packs.length, 1);
});

test("writeLock persists JSON content to <projectDir>/.specops.lock", () => {
  const dir = tmpProject();
  try {
    const lock = upsertPackEntry(newLock("0.1.0"), {
      repo: "https://example.com/r.git",
      pack_id: "backend",
      version: "v1.0.0",
      commit: "abc",
    });
    const result = writeLock(dir, lock);
    assert.equal(result.written, true);
    assert.ok(fs.existsSync(result.path));
    const raw = fs.readFileSync(result.path, "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.specops_version, SPECOPS_SCHEMA_VERSION);
    assert.equal(parsed.packs.length, 1);
    assert.equal(parsed.packs[0].version, "v1.0.0");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeLock honours dryRun without touching the filesystem", () => {
  const dir = tmpProject();
  try {
    const lock = newLock("0.1.0");
    const result = writeLock(dir, lock, { dryRun: true });
    assert.equal(result.written, false);
    assert.equal(fs.existsSync(result.path), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("write-then-read round-trip preserves the lock", () => {
  const dir = tmpProject();
  try {
    const original = upsertPackEntry(newLock("0.2.0"), {
      repo: "r",
      pack_id: "backend",
      version: "v1.0.0",
      commit: "abc",
    });
    writeLock(dir, original);
    const reloaded = readLock(dir);
    assert.deepEqual(reloaded, original);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Forward compatibility ─────────────────────────────────────────────────────
//
// `specops_version` was written from the very first lockfile and read by
// nothing, so a lockfile from a newer CLI used to be accepted and then misread
// one field at a time. These pin the gate that now rejects it up front.

test("readLock rejects a lockfile written by a newer CLI, and names the fix", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, LOCK_FILENAME),
      JSON.stringify({ specops_version: SPECOPS_SCHEMA_VERSION + 1, packs: [] }),
      "utf8"
    );
    assert.throws(
      () => readLock(dir),
      (err) =>
        err.message.includes("newer version of this CLI") &&
        err.message.includes("Fix:") &&
        err.message.includes(`format ${SPECOPS_SCHEMA_VERSION + 1}`)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readLock accepts the current version and any older one", () => {
  const dir = tmpProject();
  try {
    for (const version of [SPECOPS_SCHEMA_VERSION, SPECOPS_SCHEMA_VERSION - 1]) {
      fs.writeFileSync(
        path.join(dir, LOCK_FILENAME),
        JSON.stringify({ specops_version: version, packs: [] }),
        "utf8"
      );
      assert.doesNotThrow(() => readLock(dir), `version ${version} should be readable`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a lockfile with no specops_version at all is still readable", () => {
  // Pre-dates the field; refusing to read it would strand existing projects.
  const dir = tmpProject();
  try {
    fs.writeFileSync(path.join(dir, LOCK_FILENAME), JSON.stringify({ packs: [] }), "utf8");
    assert.doesNotThrow(() => readLock(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
