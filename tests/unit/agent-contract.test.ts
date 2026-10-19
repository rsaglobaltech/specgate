"use strict";

/**
 * The agent contract, verified rather than asserted.
 *
 * ADR-0017 promised "a snapshot test per command shape … so the published
 * document cannot silently drift". Two things are checked here: that the
 * committed document matches what the generator produces, and that every
 * command it lists actually behaves the way it claims when run.
 *
 * The second half is the one that matters. A generated document is only honest
 * if something confirms the commands still do what it says.
 */

import { test } from "node:test";
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import { spawnSync } from "node:child_process";
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { render, harvestCodes, OUTPUT, COMMANDS } = require("../../scripts/gen_agent_contract");
const { EXIT } = require("../../scripts/lib/agent");

function cli(args: string[], cwd?: string): CliResult {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: cwd || ROOT_DIR,
  });
}

function scratchProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-contract-"));
  const r = cli([
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git",
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { root, dir: path.join(root, "acme-energy-hub") };
}

test("the committed contract document is not stale", () => {
  const committed = fs.readFileSync(OUTPUT, "utf8");
  assert.equal(
    committed,
    render(),
    "docs/specs/agent-contract.md is out of date — run: npm run docs:agent-contract"
  );
});

test("the code catalogue is harvested from real call sites", () => {
  const codes = harvestCodes();
  const all = [...codes.values()].flat();
  // Codes this repository has been burned by, so they are worth pinning.
  for (const code of ["missing_required_file", "no_rfc2119_keyword", "scenario_not_gherkin"]) {
    assert.ok(all.includes(code), `${code} should appear in the catalogue`);
  }
  assert.ok(all.length > 20, `expected a substantial catalogue, found ${all.length}`);
});

// ── The rules, checked against the commands themselves ────────────────────────

test("rule 1: --json puts exactly one JSON document on stdout, prose on stderr", () => {
  const { root, dir } = scratchProject();
  try {
    for (const args of [
      ["validate", dir, "--json"],
      ["plan", "--project-dir", dir, "--json"],
      ["status", "--project-dir", dir, "--json"],
      ["doctor", "--project-dir", dir, "--json"],
      ["change", "list", "--project-dir", dir, "--json"],
    ]) {
      const r = cli(args);
      // Parses on its own — nothing else is allowed on stdout.
      const doc = JSON.parse(r.stdout);
      assert.ok(doc && typeof doc === "object", `${args[0]} should emit an object`);
      assert.ok(Array.isArray(doc.status), `${args[0]} should carry a status array`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rule 3: a failure carries the null-shape, not bare stderr", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "agent-contract-empty-"));
  try {
    const r = cli(["validate", empty, "--json"]);
    assert.equal(r.status, EXIT.FAILURE);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.validation, null, "the document key is null on failure");
    assert.ok(doc.status.length > 0);
    assert.equal(doc.status[0].severity, "error");
    assert.ok(doc.status[0].code, "a diagnostic without a code is not actionable");
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("every diagnostic an error path emits carries a fix", () => {
  // A check that cannot say what to do about its own finding is not finished.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "agent-contract-fix-"));
  try {
    const doc = JSON.parse(cli(["validate", empty, "--json"]).stdout);
    for (const d of doc.status) {
      if (d.severity === "error") assert.ok(d.fix, `${d.code} should carry a fix`);
    }
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("rule 4: command output is camelCase, on-disk formats are not", () => {
  const { root, dir } = scratchProject();
  try {
    for (const args of [
      ["plan", "--project-dir", dir, "--json"],
      ["status", "--project-dir", dir, "--json"],
      ["validate", dir, "--json"],
    ]) {
      const keys = Object.keys(JSON.parse(cli(args).stdout));
      for (const key of keys) {
        assert.ok(!key.includes("_"), `${args[0]} emits snake_case key: ${key}`);
      }
    }
    // The lockfile is a file schema, not command output — it keeps snake_case.
    const lockKeys = ["specops_version", "pack_id"];
    const lockSource = fs.readFileSync(path.join(ROOT_DIR, "scripts/specops/lock.ts"), "utf8");
    for (const key of lockKeys) assert.match(lockSource, new RegExp(key));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rule 5: --json and --format json mean the same thing", () => {
  const { root, dir } = scratchProject();
  try {
    const a = JSON.parse(cli(["plan", "--project-dir", dir, "--json"]).stdout);
    const b = JSON.parse(cli(["plan", "--project-dir", dir, "--format", "json"]).stdout);
    assert.deepEqual(Object.keys(a), Object.keys(b));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("usage errors exit 2, gate failures exit 1", () => {
  const { root, dir } = scratchProject();
  try {
    const usage = cli(["change", "instructions", "nonsense", "--project-dir", dir, "--json"]);
    assert.equal(usage.status, EXIT.USAGE, "an unknown artefact is a usage error");

    const missing = cli(["done", "REQ-999", "--project-dir", dir, "--json"]);
    assert.equal(missing.status, EXIT.FAILURE, "a missing requirement is a command failure");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("H18: every command in the contract emits parseable JSON on stdout", async (t) => {
  const { root, dir } = scratchProject();
  try {
    for (const { command } of COMMANDS) {
      await t.test(`Command: ${command}`, () => {
        let cmdStr = command.replace("<dir>", dir);
        cmdStr = cmdStr.replace("<REQ>", "REQ-999");
        cmdStr = cmdStr.replace("<id>", "MISSING-ID");
        cmdStr = cmdStr.replace("<artifact>", "specs");

        const args = cmdStr.split(" ");
        const r = cli(args, dir);

        try {
          const doc = JSON.parse(r.stdout);
          assert.ok(
            doc && typeof doc === "object",
            `${command} should emit a JSON object, got ${r.stdout}`
          );
        } catch {
          assert.fail(
            `Command ${command} failed to emit parseable JSON. stdout:\n${r.stdout}\nstderr:\n${r.stderr}`
          );
        }
      });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
