/**
 * change_overlap — two open changes that rewrite the same requirement
 * (REQ-160). Real git repositories: the overlap lives on other branches.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { changeOverlaps } = require("../../scripts/lib/change-overlap");

function git(dir: string, ...args: string[]) {
  const r = spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=T", ...args],
    {
      encoding: "utf8",
    }
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

/** A change whose delta modifies the given requirements. */
function writeChange(dir: string, id: string, modifies: string[], added: string[] = []) {
  const delta = path.join(dir, "docs", "specs", "changes", id, "specs", "parking", "spec.md");
  fs.mkdirSync(path.dirname(delta), { recursive: true });
  const block = (req: string) => [
    `### Requirement: ${req} — Something`,
    "",
    "The system SHALL do it.",
    "",
  ];
  fs.writeFileSync(
    delta,
    [
      "# Delta — parking",
      "",
      ...(added.length ? ["## ADDED Requirements", "", ...added.flatMap(block)] : []),
      ...(modifies.length ? ["## MODIFIED Requirements", "", ...modifies.flatMap(block)] : []),
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "changes", id, "change.yaml"),
    "specgate_change_version: 1\n"
  );
}

function repo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-overlap-"));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}

test("REQ-160 SCN-160a: two tickets rewrite REQ-012 on two branches", () => {
  const dir = repo();
  try {
    git(dir, "checkout", "-q", "-b", "feature/KAN-16-exit");
    writeChange(dir, "kan-16-exit", ["REQ-012"]);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-16 draft");
    git(dir, "checkout", "-q", "develop");
    git(dir, "checkout", "-q", "-b", "feature/KAN-13-entry");
    writeChange(dir, "kan-13-entry", ["REQ-012", "REQ-020"], ["REQ-030"]);

    const found = changeOverlaps(dir) as Array<{ code: string; target: string; message: string }>;
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].code, "change_overlap");
    assert.equal(found[0].target, "REQ-012");
    assert.match(found[0].message, /kan-16-exit/);
    assert.match(found[0].message, /feature\/KAN-16-exit/);

    const check = spawnSync(process.execPath, [CLI, "check", dir, "--json"], { encoding: "utf8" });
    const doc = JSON.parse(check.stdout) as { status: Array<{ code: string; target?: string }> };
    assert.ok(
      doc.status.some((d) => d.code === "change_overlap" && d.target === "REQ-012"),
      check.stdout
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-160 SCN-160b: a branch already merged is not an overlap", () => {
  const dir = repo();
  try {
    git(dir, "checkout", "-q", "-b", "feature/KAN-16-exit");
    writeChange(dir, "kan-16-exit", ["REQ-012"]);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-16 draft");
    // Delivered: the change is archived on its branch, then merged.
    const changes = path.join(dir, "docs", "specs", "changes");
    fs.mkdirSync(path.join(changes, "archive"), { recursive: true });
    fs.renameSync(
      path.join(changes, "kan-16-exit"),
      path.join(changes, "archive", "2026-10-20-kan-16-exit")
    );
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-16 archive");
    git(dir, "checkout", "-q", "develop");
    git(dir, "merge", "-q", "--no-ff", "-m", "merge KAN-16", "feature/KAN-16-exit");
    git(dir, "checkout", "-q", "-b", "feature/KAN-13-entry");
    writeChange(dir, "kan-13-entry", ["REQ-012"]);
    assert.deepEqual(changeOverlaps(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-160: the same change on its own pushed branch is not an overlap", () => {
  const dir = repo();
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-overlap-origin-"));
  try {
    git(origin, "init", "-q", "--bare");
    git(dir, "remote", "add", "origin", origin);
    git(dir, "checkout", "-q", "-b", "feature/KAN-13-entry");
    writeChange(dir, "kan-13-entry", ["REQ-012"]);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-13 draft");
    git(dir, "push", "-q", "-u", "origin", "feature/KAN-13-entry");
    // A later edit, not pushed: the remote copy is older, but it is the same change.
    writeChange(dir, "kan-13-entry", ["REQ-012", "REQ-013"]);
    assert.deepEqual(changeOverlaps(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-160: two open changes on the same branch rewriting one requirement", () => {
  const dir = repo();
  try {
    writeChange(dir, "kan-13-entry", ["REQ-012"]);
    writeChange(dir, "kan-16-exit", ["REQ-012"]);
    const found = changeOverlaps(dir) as Array<{ target: string; message: string }>;
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].target, "REQ-012");
    assert.match(found[0].message, /this branch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-160: outside git, only the working tree is read", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-overlap-nogit-"));
  try {
    writeChange(dir, "a", ["REQ-001"]);
    writeChange(dir, "b", ["REQ-002"]);
    assert.deepEqual(changeOverlaps(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
