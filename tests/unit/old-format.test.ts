"use strict";

/**
 * ADR-0032: Specgate no longer reads the old `csda:` markers. A project still
 * on them must not pass `validate` silently with every trace lost.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const OLD = "csda";

function cli(args: string[], cwd?: string): CliResult {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: cwd || ROOT_DIR });
}

function withProject(fn: (dir: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-old-format-"));
  try {
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
    fn(path.join(root, "acme-energy-hub"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("a project on the current format passes", () => {
  withProject((dir: string) => {
    const r = cli(["validate", dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test("old-format markers fail validate and say how to migrate", () => {
  withProject((dir: string) => {
    const spec = path.join(dir, "spec.md");
    fs.appendFileSync(spec, `\n<!-- ${OLD}:trace REQ-999 -->\n`);
    const r = cli(["validate", dir, "--json"]);
    assert.notEqual(r.status, 0);
    const doc = JSON.parse(r.stdout);
    const d = doc.status.find((s: { code: string }) => s.code === "old_format");
    assert.ok(d, JSON.stringify(doc.status));
    assert.match(d.message, /spec\.md/);
    assert.match(d.fix, /git grep -lI/);
  });
});

test("an old config directory alone is enough to fail", () => {
  withProject((dir: string) => {
    fs.mkdirSync(path.join(dir, `.${OLD}`));
    const r = cli(["validate", dir, "--json"]);
    assert.notEqual(r.status, 0);
    assert.ok(JSON.parse(r.stdout).status.some((s: { code: string }) => s.code === "old_format"));
  });
});
