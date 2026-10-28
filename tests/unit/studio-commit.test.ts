"use strict";

/**
 * REQ-233 — the studio commits the specification it wrote before a build, and
 * refuses when other work is uncommitted.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** A committed project with a brief, an open change and some code. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-studio-commit-"));
  madeDirs.push(dir);
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n");
  w("docs/brief.md", "---\nproduct: x\n---\n");
  w("docs/specs/changes/draft-x/change.yaml", "specgate_change_version: 1\n");
  w("src/app.ts", "export const a = 1;\n");
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  return { dir, w };
}

const { saveSpecification } = require("../../scripts/lib/studio-app");

test("REQ-233 SCN-233a: the brief and a change edited in the studio are committed", () => {
  const { dir, w } = project();
  w("docs/brief.md", "---\nproduct: y\n---\n");
  w("docs/specs/changes/draft-x/change.yaml", "specgate_change_version: 1\napproved: 2026-10-28\n");
  w("docs/specs/changes/draft-x/questions.md", "# Questions\n");
  const r = saveSpecification(dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([...r.committed].sort(), [
    "docs/brief.md",
    "docs/specs/changes/draft-x/change.yaml",
    "docs/specs/changes/draft-x/questions.md",
  ]);
  assert.equal(git(dir, "status", "--porcelain").stdout.trim(), "", "the tree is clean");
  assert.match(git(dir, "log", "-1", "--format=%s").stdout, /from the studio/);
  assert.equal(git(dir, "log", "-1", "--format=%ae").stdout.trim(), "t@example.com");
  assert.deepEqual(saveSpecification(dir), { ok: true, committed: [] }, "nothing left to save");
});

test("REQ-233 SCN-233b: code left uncommitted stops the build, and nothing is committed", () => {
  const { dir, w } = project();
  w("docs/brief.md", "---\nproduct: y\n---\n");
  w("src/app.ts", "export const a = 2;\n");
  const head = git(dir, "rev-parse", "HEAD").stdout;
  const r = saveSpecification(dir);
  assert.equal(r.ok, false);
  assert.equal(r.code, "build_uncommitted");
  assert.match(r.message, /src\/app\.ts/);
  assert.doesNotMatch(r.message, /brief/);
  assert.equal(git(dir, "rev-parse", "HEAD").stdout, head, "no commit");
});
