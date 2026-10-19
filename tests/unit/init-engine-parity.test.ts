"use strict";

/**
 * Init engine integration tests.
 *
 * Historically these compared the Node and Bash engines side-by-side. After
 * P3-01 removed the Bash engine, the suite asserts the Node engine produces
 * validate-passing output and rejects --engine=shell.
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
    timeout: 30000,
  });
}

test("init produces output that passes validate", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-init-"));
  try {
    const r = cli("init", "--config", CONFIG, "--out", tmp, "--no-git", "--force");
    assert.equal(r.status, 0, `init failed:\n${r.stdout}\n${r.stderr}`);
    const projectDir = path.join(tmp, "acme-energy-hub");
    assert.ok(fs.existsSync(projectDir), "project directory should exist");
    const v = cli("validate", projectDir);
    assert.equal(v.status, 0, `validate failed:\n${v.stdout}\n${v.stderr}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init generates spec.md with project name interpolated", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-spec-"));
  try {
    cli("init", "--config", CONFIG, "--out", tmp, "--no-git", "--force");
    const specFile = path.join(tmp, "acme-energy-hub", "spec.md");
    assert.ok(fs.existsSync(specFile), "spec.md should exist");
    const content = fs.readFileSync(specFile, "utf8");
    assert.ok(content.includes("Acme Energy Hub"), "spec.md should contain project name");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init generates traceability.md", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-trace-"));
  try {
    cli("init", "--config", CONFIG, "--out", tmp, "--no-git", "--force");
    const traceFile = path.join(tmp, "acme-energy-hub", "docs/specs/traceability.md");
    assert.ok(fs.existsSync(traceFile), "traceability.md should exist");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init --dry-run does not write files", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-dry-"));
  try {
    const r = cli("init", "--config", CONFIG, "--out", tmp, "--no-git", "--dry-run");
    assert.equal(r.status, 0, r.stderr);
    const projectDir = path.join(tmp, "acme-energy-hub");
    assert.ok(!fs.existsSync(projectDir), "dry-run should not create project directory");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init fails on missing required config key", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-missing-"));
  try {
    const cfgPath = path.join(tmp, "partial.config");
    fs.writeFileSync(cfgPath, 'PROJECT_NAME="Test"\nPROJECT_SLUG="test"\n');
    const r = cli("init", "--config", cfgPath, "--out", tmp, "--no-git");
    assert.notEqual(r.status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init --engine=shell is rejected with exit code 2", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-shell-rej-"));
  try {
    const r = cli(
      "init",
      "--engine=shell",
      "--config",
      CONFIG,
      "--out",
      tmp,
      "--no-git",
      "--force"
    );
    assert.equal(r.status, 2, `expected exit=2, got ${r.status}`);
    assert.ok(
      (r.stderr + r.stdout).includes("--engine=shell"),
      `expected error to mention --engine=shell, got: ${r.stderr}`
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("init --engine=node is silently accepted (no-op flag)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-node-flag-"));
  try {
    const r = cli("init", "--engine=node", "--config", CONFIG, "--out", tmp, "--no-git", "--force");
    assert.equal(r.status, 0, `init failed:\n${r.stdout}\n${r.stderr}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
