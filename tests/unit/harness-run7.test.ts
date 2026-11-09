"use strict";

/**
 * REQ-279, REQ-280 — what the seventh truck-flote run met on its first
 * requirement: three attempts spent on a stopped Docker, each handed to the
 * agent as a failing test, and a report that titled a delivered scenario with
 * DRAFTING.md's template line (truck-flote S61, S63).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { dockerNeed } = require("../../scripts/lib/harness-environment");
const { scenarioTitles } = require("../../scripts/lib/studio-route");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp(prefix = "specgate-run7-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

/** A project `harness run` can gate green, with `extra` appended to its harness config. */
function greenable(extra: string[] = []) {
  const parent = tmp("specgate-run7-green-");
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .split("\n")
      .filter((l: string) => !l.includes("REQ-001"))
      .join("\n")
  );
  if (extra.length) fs.appendFileSync(path.join(dir, "harness.config.yaml"), extra.join("\n"));
  git(dir, "init", "-q");
  // The harness refuses a repository with no identity; CI has none globally.
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { parent, dir };
}

/** An agent that writes a file in its worktree and leaves `marker` behind, outside it. */
function agent(parent: string, marker: string) {
  const file = path.join(parent, "agent.js");
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      `fs.writeFileSync(${JSON.stringify(marker)}, "ran");`,
      'fs.writeFileSync("src-written.ts", "export const a = 1;\\n");',
      "",
    ].join("\n")
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

/** `harness run --req REQ-000`, with Docker's command replaced by one that is not there. */
function run(dir: string, agentCmd: string, ...more: string[]) {
  const r = spawnSync(
    process.execPath,
    [CLI, "harness", "run", "--project-dir", dir, "--req", "REQ-000", "--agent", agentCmd, ...more],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        SPECGATE_DOCKER: path.join(os.tmpdir(), "no-such-docker-here"),
      },
    }
  );
  return { status: r.status, out: r.stdout + r.stderr };
}

const DOCKER_CHECK = [
  "",
  "checks:",
  "  - name: scan",
  '    run: "true"',
  "    runner: docker",
  "    image: alpine:3.20",
  "    when: attempt",
  "",
];

// ── REQ-279 ─────────────────────────────────────────────────────────────────

test("REQ-279 SCN-279a: Docker Desktop is stopped", () => {
  const { parent, dir } = greenable(DOCKER_CHECK);
  const marker = path.join(parent, "agent-ran");
  const r = run(dir, agent(parent, marker));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /Docker is not running/, r.out);
  assert.match(r.out, /Docker Desktop/, r.out);
  assert.equal(fs.existsSync(marker), false, "the agent never ran");
  assert.doesNotMatch(r.out, /attempt 1\//, r.out);

  // Testcontainers in a build file needs Docker as much as a Docker check does.
  const java = tmp();
  w(
    java,
    "apps/api/pom.xml",
    "<project><dependencies><dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId></dependency></dependencies></project>"
  );
  assert.match(String(dockerNeed(java, null)), /Testcontainers/);
  assert.equal(dockerNeed(tmp(), null), null);
});

test("REQ-279 SCN-279b: a project that needs no Docker", () => {
  const { parent, dir } = greenable();
  const marker = path.join(parent, "agent-ran");
  const r = run(dir, agent(parent, marker), "--max-attempts", "1");
  assert.doesNotMatch(r.out, /Docker is not running/, r.out);
  assert.equal(fs.existsSync(marker), true, r.out);
});

test("REQ-279 SCN-279c: Testcontainers cannot find Docker during the tests", () => {
  const { parent, dir } = greenable();
  w(
    dir,
    "tests-need-docker.js",
    [
      'console.log("[ERROR] IllegalState ApplicationContext failure threshold (1) exceeded");',
      'console.log("Caused by: java.lang.IllegalStateException: Could not find a valid Docker environment. Please see logs and check configuration");',
      "process.exit(1);",
      "",
    ].join("\n")
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "tests that need Docker");
  const marker = path.join(parent, "agent-ran");
  const r = run(
    dir,
    agent(parent, marker),
    "--test-cmd",
    "node tests-need-docker.js",
    "--max-attempts",
    "3"
  );
  assert.match(r.out, /attempt 1\/3/, r.out);
  assert.doesNotMatch(r.out, /attempt 2\/3/, "Docker is not the agent's to start");
  assert.match(r.out, /need Docker/, r.out);
});

// ── REQ-280 ─────────────────────────────────────────────────────────────────

test("REQ-280 SCN-280a: a delivered requirement of a draft", () => {
  const dir = tmp();
  w(dir, "spec.md", "# Spec\n\n## Requirements\n");
  const change = "docs/specs/changes/draft-fleet-tracking";
  // DRAFTING.md comes first in the folder and holds the template line.
  w(
    dir,
    `${change}/DRAFTING.md`,
    "# Drafting\n\n### Requirement: REQ-002 — <short name>\n\n#### Scenario: SCN-002 — <what happens>\n"
  );
  w(
    dir,
    `${change}/specs/fleet-tracking/spec.md`,
    [
      "# Delta — fleet-tracking",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-002 — Receive a GPS position from a tracker",
      "",
      "The system SHALL store a position a registered tracker sends.",
      "",
      "#### Scenario: SCN-002 — A registered tracker reports a position",
      "",
      '- GIVEN tracker "TRK-001" is registered',
      "- WHEN it sends a position",
      "- THEN the position is stored",
      "",
    ].join("\n")
  );
  // An archived change that once named it otherwise.
  w(
    dir,
    "docs/specs/changes/archive/2026-01-01-old/specs/fleet-tracking/spec.md",
    "#### Scenario: SCN-002 — An old name\n"
  );
  assert.equal(scenarioTitles(dir).get("SCN-002"), "A registered tracker reports a position");
});
