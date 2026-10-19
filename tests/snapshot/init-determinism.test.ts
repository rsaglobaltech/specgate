"use strict";

/**
 * Determinism tests for generated project output.
 *
 * Strategy: generate the project twice from the same config and assert
 * the file tree and key file contents are byte-identical between runs.
 *
 * NOTE: We intentionally do NOT compare against committed golden files.
 * Golden snapshots proved brittle across platforms (filesystem ordering,
 * line endings, locale) and the value they added — catching unintended
 * template drift — is already covered by:
 *   - the E2E suite (`tests/cli.test.js`)
 *   - the BDD scenarios (`features/`)
 *   - the determinism asserts below
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { CliResult } from "../helpers/cli";

const ROOT = path.resolve(__dirname, "../../..");
const CLI = path.join(ROOT, "bin/specgate.js");
const CONFIG = path.join(ROOT, "examples/project.config.example");

function cli(...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: ROOT,
    timeout: 30_000,
  });
}

/**
 * Recursively walk `dir` and return all file paths relative to `dir`,
 * sorted lexicographically. Excludes `.git/`.
 */
function walkFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") continue;
        walk(full);
      } else {
        results.push(path.relative(dir, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}

function generateProject(outDir: string) {
  const r = cli("init", "--config", CONFIG, "--out", outDir, "--no-git", "--force");
  assert.equal(r.status, 0, `init failed:\n${r.stdout}\n${r.stderr}`);
  return path.join(outDir, "acme-energy-hub");
}

test("two consecutive init runs produce the same file list", () => {
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-a-"));
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-b-"));
  try {
    const proj1 = generateProject(tmp1);
    const proj2 = generateProject(tmp2);
    const files1 = walkFiles(proj1);
    const files2 = walkFiles(proj2);
    assert.deepEqual(files1, files2, "file lists differ between runs");
    assert.ok(files1.length > 0, "expected at least one generated file");
  } finally {
    fs.rmSync(tmp1, { recursive: true, force: true });
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
});

test("two consecutive init runs produce identical spec.md content", () => {
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-spec-a-"));
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-spec-b-"));
  try {
    const proj1 = generateProject(tmp1);
    const proj2 = generateProject(tmp2);
    const s1 = fs.readFileSync(path.join(proj1, "spec.md"), "utf8");
    const s2 = fs.readFileSync(path.join(proj2, "spec.md"), "utf8");
    assert.equal(s1, s2, "spec.md content differs between runs");
  } finally {
    fs.rmSync(tmp1, { recursive: true, force: true });
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
});

test("two consecutive init runs produce identical traceability.md content", () => {
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-trace-a-"));
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-trace-b-"));
  try {
    const proj1 = generateProject(tmp1);
    const proj2 = generateProject(tmp2);
    const t1 = fs.readFileSync(path.join(proj1, "docs/specs/traceability.md"), "utf8");
    const t2 = fs.readFileSync(path.join(proj2, "docs/specs/traceability.md"), "utf8");
    assert.equal(t1, t2, "traceability.md content differs between runs");
  } finally {
    fs.rmSync(tmp1, { recursive: true, force: true });
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
});

test("two consecutive init runs produce identical README.md content", () => {
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-readme-a-"));
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-snap-readme-b-"));
  try {
    const proj1 = generateProject(tmp1);
    const proj2 = generateProject(tmp2);
    const r1 = fs.readFileSync(path.join(proj1, "README.md"), "utf8");
    const r2 = fs.readFileSync(path.join(proj2, "README.md"), "utf8");
    assert.equal(r1, r2, "README.md content differs between runs");
  } finally {
    fs.rmSync(tmp1, { recursive: true, force: true });
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
});
