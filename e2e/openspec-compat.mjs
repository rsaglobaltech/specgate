#!/usr/bin/env node
/**
 * Does `specgate verify` still read what the current OpenSpec writes?
 * (ADR-0030, docs/specs/verify-foreign-specs.md §7)
 *
 * OpenSpec releases weekly, and a format change that the reader does not
 * understand would show up as zero scenarios — every claim green. So this
 * runs OpenSpec itself, at a given version (default: latest):
 *
 *   1. `openspec init`, a change with a nested capability, `openspec archive`
 *      — the files are whatever that OpenSpec version writes;
 *   2. `specgate verify` must fail naming the archived scenario, then pass
 *      once a test names it;
 *   3. OpenSpec's own repository, the format's widest real use, must read
 *      with no V5 (unreadable) error.
 *
 *   node e2e/openspec-compat.mjs [--version 1.14.1] [--skip-repo]
 *
 * Exit 1 on any mismatch; the message says which step.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "bin", "specgate.js");
const args = process.argv.slice(2);
const at = args.indexOf("--version");
const VERSION = at !== -1 ? args[at + 1] : "latest";
const SKIP_REPO = args.includes("--skip-repo");

const run = (cmd, argv, cwd) =>
  spawnSync(cmd, argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const fail = (step, detail) => {
  process.stderr.write(`✖ ${step}\n${detail || ""}\n`);
  process.exit(1);
};
const ok = (step) => process.stdout.write(`✔ ${step}\n`);
const verify = (cwd, ...more) => {
  const r = run(process.execPath, [CLI, "verify", "--json", ...more], cwd);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return { status: r.status, doc, raw: r.stdout + r.stderr };
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-compat-"));
try {
  // OpenSpec, installed at the version under test.
  const tool = path.join(root, "tool");
  fs.mkdirSync(tool);
  const install = run(
    "npm",
    ["install", "--silent", "--no-audit", "--no-fund", `@fission-ai/openspec@${VERSION}`],
    tool
  );
  if (install.status !== 0) fail(`install @fission-ai/openspec@${VERSION}`, install.stderr);
  const openspec = path.join(tool, "node_modules", ".bin", "openspec");
  const installed = run(openspec, ["--version"], tool).stdout.trim();
  ok(`OpenSpec ${installed}`);

  // 1. A project and an archived change, written by OpenSpec itself.
  const app = path.join(root, "app");
  fs.mkdirSync(app);
  run("git", ["init", "--quiet"], app);
  const init = run(openspec, ["init", "--tools", "none", "--no-animation"], app);
  if (init.status !== 0 || !fs.existsSync(path.join(app, "openspec")))
    fail("openspec init", init.stdout + init.stderr);
  const change = path.join(app, "openspec", "changes", "add-clock-in");
  const cap = path.join(change, "specs", "time-attendance", "clock-punches");
  fs.mkdirSync(cap, { recursive: true });
  fs.writeFileSync(
    path.join(change, "proposal.md"),
    "## Why\nWorkers clock in on site.\n\n## What Changes\n- Clock in inside the geofence.\n"
  );
  fs.writeFileSync(
    path.join(change, "tasks.md"),
    "## 1. Clock in\n\n- [x] 1.1 Accept a clock in inside the geofence\n"
  );
  fs.writeFileSync(
    path.join(cap, "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Clock in inside the geofence\nThe system SHALL accept a clock in whose fix lies inside an assigned geofence.\n\n#### Scenario: Inside the geofence\n- **WHEN** a worker clocks in 40 m from the center of a 100 m geofence\n- **THEN** the punch is accepted\n"
  );
  const archive = run(openspec, ["archive", "add-clock-in", "--yes"], app);
  if (archive.status !== 0) fail("openspec archive", archive.stdout + archive.stderr);
  if (
    !fs.existsSync(
      path.join(app, "openspec", "specs", "time-attendance", "clock-punches", "spec.md")
    )
  ) {
    fail(
      "openspec archive wrote no main spec where verify reads it",
      fs.readdirSync(path.join(app, "openspec", "specs")).join(", ")
    );
  }
  ok("OpenSpec archived the change");

  // 2. Verify reads it: red without a test, green with one.
  const id =
    "openspec:time-attendance/clock-punches/clock-in-inside-the-geofence/inside-the-geofence";
  const red = verify(app);
  if (
    red.status !== 1 ||
    !red.doc.status.some((d) => d.code === "V1_unproved_claim" && d.target === id)
  ) {
    fail(`verify must fail on ${id} with no test`, red.raw);
  }
  ok("verify fails the archived scenario that no test names");
  fs.mkdirSync(path.join(app, "test"));
  fs.writeFileSync(path.join(app, "test", "clock.test.js"), `// ${id}\n`);
  const green = verify(app);
  if (green.status !== 0) fail("verify must pass once a test names the scenario", green.raw);
  ok("verify passes once a test names it");

  // 3. OpenSpec's own repository reads with no unreadable file.
  if (!SKIP_REPO) {
    const repo = path.join(root, "repo");
    const clone = run(
      "git",
      ["clone", "--quiet", "--depth", "1", "https://github.com/Fission-AI/OpenSpec.git", repo],
      root
    );
    if (clone.status !== 0) fail("clone Fission-AI/OpenSpec", clone.stderr);
    const own = verify(repo);
    const unreadable = own.doc.status.filter((d) => d.code === "V5_unreadable");
    if (unreadable.length > 0)
      fail(
        "OpenSpec's own repository has files verify cannot read",
        unreadable.map((d) => d.message).join("\n")
      );
    const { named, total } = own.doc.verify.coverage;
    if (total === 0)
      fail("OpenSpec's own repository read as zero scenarios", own.raw.slice(0, 2000));
    ok(
      `OpenSpec's own repository: ${total} scenarios, ${own.doc.verify.claims.length} claims, nothing unreadable (named: ${named})`
    );
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
