/**
 * REQ-375..376: a tick in tasks.md is not an edit of the contract, and the
 * stories table prints a story's title as written (truck-flote microservices
 * run 3, MS3-4 and MS3-1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI = path.resolve(__dirname, "..", "..", "bin", "specgate.js");

const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;

const CHANGE = "docs/specs/changes/track-fleet";

const TASKS = [
  "# Tasks",
  "",
  "> Owner: developer — each task names its requirement.",
  "",
  "## 1. Specification",
  "",
  "- [x] 1.1 Write the delta spec",
  "",
  "## 2. Implementation",
  "",
  "- [ ] 2.1 REQ-002 — show every truck on the map",
  "- [ ] 2.2 REQ-003 — show each truck's readings",
  "",
].join("\n");

const scenario = (id: string, n: string, title: string) =>
  [
    `### Requirement: ${id} — ${title}`,
    "",
    `The system SHALL let the dispatcher ${title.toLowerCase()}.`,
    "",
    `#### Scenario: SCN-${n} — ${title}`,
    "",
    '- GIVEN truck "1234-BCD" reported a position',
    '- WHEN the dispatcher opens "Flota"',
    '- THEN they see "1234-BCD"',
    "",
    "<!-- specgate:trace actor=Dispatcher kind=functional -->",
    "",
  ].join("\n");

/**
 * A project holding an approved layered change of two requirements, and an
 * agent script given what it writes into tasks.md.
 */
function project(agentEdit: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-rc4-"));
  madeDirs.push(parent);
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  w(
    dir,
    `${CHANGE}/change.yaml`,
    "specgate_change_version: 1\nschema: layered\nreq_range: [REQ-002, REQ-004]\n"
  );
  w(
    dir,
    `${CHANGE}/discover.md`,
    [
      "# Discover: track-fleet",
      "",
      "> Owner: product — what the business needs and why.",
      "",
      "## Context",
      "",
      "Dispatchers phone drivers to know where each truck is.",
      "",
      "## Use case",
      "",
      "1. The dispatcher opens the fleet.",
      "",
      "## Acceptance criteria",
      "",
      "- AC-1: The dispatcher sees every truck and its readings.",
      "",
    ].join("\n")
  );
  w(
    dir,
    `${CHANGE}/design.md`,
    "# Design: track-fleet\n\n> Owner: architect\n\n## Mechanisms\n\n- AC-1 — a map and a panel.\n"
  );
  w(dir, `${CHANGE}/tasks.md`, TASKS);
  w(
    dir,
    `${CHANGE}/specs/fleet/spec.md`,
    [
      "# Delta — fleet",
      "",
      "## ADDED Requirements",
      "",
      scenario("REQ-002", "002", "See every truck on the map"),
      scenario("REQ-003", "003", "See each truck's readings"),
    ].join("\n")
  );
  // The agent works in the harness's worktree, its current directory.
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(
    agent,
    [
      'const fs = require("fs");',
      `const file = ${JSON.stringify(`${CHANGE}/tasks.md`)};`,
      'const text = fs.readFileSync(file, "utf8");',
      `fs.writeFileSync(file, ${agentEdit});`,
      'fs.mkdirSync("src", { recursive: true });',
      'fs.writeFileSync("src/fleet.js", "// REQ-002\\nmodule.exports = () => [];\\n");',
      "",
    ].join("\n")
  );
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  const approve = cli(dir, "change", "approve", "track-fleet");
  assert.equal(approve.status, 0, out(approve));
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "approved");
  return { dir, agent };
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function harness(dir: string, agent: string) {
  return cli(
    dir,
    "harness",
    "run",
    "--req",
    "REQ-002",
    "--agent",
    `node "${agent}" {prompt_file}`,
    "--max-attempts",
    "1",
    "--setup-cmd",
    "none",
    "--skip-baseline",
    "--format",
    "json"
  );
}

// ── REQ-375 ──────────────────────────────────────────────────────────────────

test("REQ-375 SCN-375a: the agent ticks the task it delivered", () => {
  const { dir, agent } = project('text.replace("- [ ] 2.1 REQ-002", "- [x] 2.1 REQ-002")');
  const r = harness(dir, agent);
  assert.doesNotMatch(out(r), /agent_touched_protected_path/, out(r));
  assert.doesNotMatch(out(r), /protected path\(s\) modified/, out(r));
});

test("REQ-375 SCN-375b: the agent rewrites a task", () => {
  const { dir, agent } = project(
    'text.replace("show every truck on the map", "show the trucks it can")'
  );
  const r = harness(dir, agent);
  assert.match(out(r), /agent_touched_protected_path/, out(r));
  assert.match(out(r), /tasks\.md/);
});

test("REQ-375: only the box of a task may change", () => {
  const { onlyTaskTicksChanged } = require("../../packages/core/src/domain/WriteScope");
  const diff = (before: string, after: string) =>
    ["@@ -11 +11 @@", `-${before}`, `+${after}`].join("\n");
  assert.equal(
    onlyTaskTicksChanged(diff("- [ ] 2.1 REQ-002 — map", "- [x] 2.1 REQ-002 — map")),
    true
  );
  assert.equal(
    onlyTaskTicksChanged(diff("- [ ] 2.1 REQ-002 — map", "- [X] 2.1 REQ-002 — map")),
    true
  );
  assert.equal(
    onlyTaskTicksChanged(diff("- [x] 2.1 REQ-002 — map", "- [ ] 2.1 REQ-002 — map")),
    true
  );
  assert.equal(
    onlyTaskTicksChanged(diff("- [ ] 2.1 REQ-002 — map", "- [x] 2.1 REQ-002 — a map")),
    false
  );
  assert.equal(onlyTaskTicksChanged("@@ -11,0 +12 @@\n+- [ ] 2.3 REQ-004 — more"), false);
});

test("REQ-375: the implementing prompt says the harness ticks the tasks", () => {
  const { dir } = project("text");
  const r = cli(dir, "harness", "prompt", "REQ-002");
  assert.equal(r.status, 0, out(r));
  assert.match(out(r), /harness ticks/i, out(r));
});

// ── REQ-376 ──────────────────────────────────────────────────────────────────

test("REQ-376 SCN-376a: a quoted story title in the stories table", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-rc4-ws-"));
  madeDirs.push(root);
  const ws = path.join(root, "product");
  w(
    ws,
    "specgate.workspace.yaml",
    "workspace_version: 1\nname: shop\nrepos:\n  - name: fleet\n    path: ../fleet\n    role: service\n"
  );
  w(
    ws,
    "docs/brief.md",
    [
      "---",
      "product: shop",
      "stories:",
      '  - { id: plan-route, title: "Optimización de rutas, con restricciones de vehículo pesado", repos: [fleet] }',
      "---",
      "# Brief",
      "",
      "Rutas.",
      "",
    ].join("\n")
  );
  const r = spawnSync(process.execPath, [CLI, "workspace", "draft"], {
    cwd: ws,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const line = out(r)
    .split("\n")
    .find((l) => l.includes("plan-route"));
  assert.ok(line, out(r));
  assert.doesNotMatch(line, /"/, line);
  assert.match(line, /Optimización de rutas/);
});
