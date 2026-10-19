"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { CliResult } from "../helpers/cli";

const ROOT = path.resolve(__dirname, "../../..");
const CLI = path.join(ROOT, "bin/specgate.js");
const PACK_ROOT = path.join(ROOT, "tests/fixtures/domain-packs");

function cli(...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: ROOT,
    timeout: 15000,
  });
}

// ── pack init ─────────────────────────────────────────────────────────────────

test("pack init --dry-run prints yaml to stdout", () => {
  const r = cli("pack", "init", "--name", "My Test Pack", "--type", "backend", "--dry-run");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("schema_version"), "should include schema_version");
  assert.ok(r.stdout.includes("My Test Pack"), "should include pack name");
  assert.ok(r.stdout.includes('project_type: "backend"'), "should include project_type");
});

test("pack init --dry-run with frontend type", () => {
  const r = cli("pack", "init", "--name", "UI Pack", "--type", "frontend", "--dry-run");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('project_type: "frontend"'));
});

test("pack init fails without --out and without --dry-run", () => {
  const r = cli("pack", "init", "--name", "No Out Pack");
  assert.notEqual(r.status, 0);
  assert.ok((r.stderr + r.stdout).toLowerCase().includes("out") || r.status !== 0);
});

test("pack init fails with invalid --type", () => {
  // `mobile` was the invalid example until it became a pack flavour.
  const r = cli("pack", "init", "--name", "Bad Type", "--type", "desktop", "--dry-run");
  assert.notEqual(r.status, 0);
  assert.ok((r.stderr + r.stdout).includes("frontend") || (r.stderr + r.stdout).includes("type"));
});

test("pack init writes file to disk", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-pack-init-"));
  try {
    const r = cli("pack", "init", "--out", tmpDir, "--name", "Written Pack", "--type", "backend");
    assert.equal(r.status, 0, r.stderr);
    const packFile = path.join(tmpDir, "written-pack/backend/pack.yaml");
    assert.ok(fs.existsSync(packFile), `Expected ${packFile} to exist`);
    const content = fs.readFileSync(packFile, "utf8");
    assert.ok(content.includes("Written Pack"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("pack init refuses to overwrite existing pack.yaml", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-pack-init-"));
  try {
    const r1 = cli("pack", "init", "--out", tmpDir, "--name", "Dup Pack", "--type", "backend");
    assert.equal(r1.status, 0, r1.stderr);
    const r2 = cli("pack", "init", "--out", tmpDir, "--name", "Dup Pack", "--type", "backend");
    assert.notEqual(r2.status, 0);
    assert.ok((r2.stderr + r2.stdout).includes("already exists"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── pack lint ─────────────────────────────────────────────────────────────────

test("pack lint passes on the parking-management fixture", () => {
  const r = cli("pack", "lint", "--pack-root", PACK_ROOT, "--pack", "parking-management/backend");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok((r.stdout + r.stderr).includes("passed all lint checks"));
});

test("pack lint fails when --pack-root is missing", () => {
  const r = cli("pack", "lint", "--pack", "parking-management/backend");
  assert.notEqual(r.status, 0);
  assert.ok((r.stderr + r.stdout).includes("pack-root"));
});

test("pack lint fails when --pack is missing", () => {
  const r = cli("pack", "lint", "--pack-root", PACK_ROOT);
  assert.notEqual(r.status, 0);
  assert.ok((r.stderr + r.stdout).includes("pack"));
});

test("pack lint fails on a pack with TODO placeholders", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-lint-todo-"));
  try {
    // generate a skeleton (full of TODOs) and lint it
    const initR = cli("pack", "init", "--out", tmpDir, "--name", "Todo Pack", "--type", "backend");
    assert.equal(initR.status, 0, initR.stderr);
    const r = cli("pack", "lint", "--pack-root", tmpDir, "--pack", "todo-pack/backend");
    // TODOs are warnings, not errors, so exit 0 but with a warning message
    assert.equal(r.status, 0, r.stderr);
    assert.ok((r.stdout + r.stderr).includes("TODO") || (r.stdout + r.stderr).includes("warning"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("pack lint fails on unknown pack id", () => {
  const r = cli("pack", "lint", "--pack-root", PACK_ROOT, "--pack", "does-not-exist/backend");
  assert.notEqual(r.status, 0);
});

// ── CLI dispatcher ────────────────────────────────────────────────────────────

test("pack with unknown sub-command exits non-zero", () => {
  const r = cli("pack", "unknown-sub");
  assert.notEqual(r.status, 0);
  assert.ok(
    (r.stderr + r.stdout).includes("unknown-sub") || (r.stderr + r.stdout).includes("Unknown")
  );
});

// ── The scaffold's own Gherkin (H14, second half) ─────────────────────────────
//
// F2 fixed the Gherkin already written in `packs/**`. It did not fix the file
// that writes new Gherkin: `pack init` still scaffolded `GIVEN / WHEN / THEN`,
// so every pack created from that day on started with an example scenario that
// Cucumber saw as empty — and an empty scenario passes. The defect was fixed in
// the packs and left alive in the generator that produces them.
//
// This runs the real CLI for every project type it offers and reads the result
// with Cucumber's own parser, because that is the parser that decides whether a
// step exists.

test("every project type scaffolds Gherkin that Cucumber sees steps in", () => {
  const { Parser, AstBuilder, GherkinClassicTokenMatcher } = require("@cucumber/gherkin");
  const { IdGenerator } = require("@cucumber/messages");
  const { PACK_PROJECT_TYPES } = require("../../packages/core/src/domain/PackSpec");

  assert.ok(PACK_PROJECT_TYPES.length >= 4, "the type list looks wrong");

  for (const type of PACK_PROJECT_TYPES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-scaffold-${type}-`));
    try {
      const init = cli("pack", "init", "--out", dir, "--name", "Scaffold Check", "--type", type);
      assert.equal(init.status, 0, `pack init --type ${type}: ${init.stdout}${init.stderr}`);

      const lint = cli("pack", "lint", "--pack-root", dir, "--pack", `scaffold-check/${type}`);
      assert.equal(
        lint.status,
        0,
        `a freshly scaffolded ${type} pack must lint clean, otherwise the tool ` +
          `hands people a pack it rejects:\n${lint.stdout}${lint.stderr}`
      );

      // Whatever Gherkin it wrote, Cucumber must find steps in it.
      const features: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name.endsWith(".feature") || e.name.endsWith(".feature.tpl"))
            features.push(full);
        }
      };
      walk(dir);

      for (const file of features) {
        const parser = new Parser(
          new AstBuilder(IdGenerator.uuid()),
          new GherkinClassicTokenMatcher()
        );
        const doc = parser.parse(fs.readFileSync(file, "utf8"));
        for (const child of doc.feature?.children || []) {
          if (!child.scenario) continue;
          assert.ok(
            (child.scenario.steps || []).length > 0,
            `${type}: scaffolded scenario "${child.scenario.name}" has no steps for ` +
              `Cucumber, so it passes without running anything. Check the keyword ` +
              `case in the scaffold — Gherkin is case-sensitive.`
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});
