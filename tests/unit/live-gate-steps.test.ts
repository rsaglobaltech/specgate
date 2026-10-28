"use strict";

/**
 * REQ-273..REQ-275 — every gate step is seen while it runs.
 *
 * The sixth truck-flote run watched a requirement for 19 minutes: `harness run`
 * printed `attempt 1/3` and nothing else, `/live` showed nothing, and a semgrep
 * check that hung for 15 minutes looked exactly like a gate at work (S54).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { foldRequirement } = require("../../scripts/lib/live-model");
const { livePage } = require("../../scripts/lib/live-page");
const { studioAppPage } = require("../../scripts/lib/studio-app-page");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const NL = String.fromCharCode(10);

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-gate-steps-"));
  madeDirs.push(dir);
  return dir;
}

test("REQ-273 SCN-273a: the events follow the gate as it runs", () => {
  const parent = tmp();
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
      .split(NL)
      .filter((l: string) => !l.includes("REQ-001"))
      .join(NL)
  );
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    [
      "harness_version: 1",
      "checks:",
      "  - name: marker",
      `    run: 'node -e "process.exit(0)"'`,
      "    runner: local",
      "  - name: final",
      `    run: 'node -e "process.exit(0)"'`,
      "    runner: local",
      "    when: end",
      "",
    ].join(NL)
  );
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(
    agent,
    'require("fs").mkdirSync("src",{recursive:true});require("fs").writeFileSync("src/w.ts","export const w = 1;" + String.fromCharCode(10));'
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  git("add", "-A");
  git("commit", "-qm", "chore: seed");
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      dir,
      "--req",
      "REQ-000",
      "--agent",
      `"${process.execPath}" "${agent}" {prompt_file}`,
      "--max-attempts",
      "1",
    ],
    { encoding: "utf8" }
  );
  const out = r.stdout + r.stderr;
  assert.match(out, /1 passed · 0 failed/, out);
  const events = fs
    .readFileSync(path.join(dir, ".harness", "events", "REQ-000.jsonl"), "utf8")
    .split(NL)
    .filter(Boolean)
    .map((l: string) => JSON.parse(l))
    .filter((e: { type: string }) => e.type === "gate" || e.type === "gate-start");
  const seq = events.map((e: { type: string; stage: string }) => `${e.type} ${e.stage}`);
  for (const stage of ["validate --strict", "quality: marker", "quality: final"]) {
    const start = seq.indexOf(`gate-start ${stage}`);
    const end = seq.findIndex((s: string) => s.startsWith(`gate ${stage}`));
    assert.ok(start >= 0, `no gate-start for ${stage}: ${seq.join(" | ")}`);
    assert.ok(end > start, `${stage} ends before it starts: ${seq.join(" | ")}`);
    assert.equal(typeof events[end].ms, "number", `${stage} has no ms`);
    assert.match(out, new RegExp(`started ${stage}`), out);
    assert.match(out, new RegExp(`passed ${stage}[^\\n]* in \\d`), out);
  }
  // A check's start is written before the next check starts: as it happens.
  assert.ok(
    seq.indexOf("gate quality: marker") < seq.indexOf("gate-start quality: final"),
    seq.join(" | ")
  );
  const marker = events.find(
    (e: { type: string; stage: string }) => e.type === "gate-start" && e.stage === "quality: marker"
  );
  assert.equal(marker.runner, "local");
});

test("REQ-274 SCN-274a: a check that has run for three minutes", () => {
  const now = Math.floor(Date.now() / 1000);
  const r = foldRequirement("REQ-007", [
    { type: "attempt", state: "start", attempt: 1, t: now - 600 },
    { type: "step", kind: "edit", target: "src/a.ts", attempt: 1, t: now - 500 },
    { type: "gate", stage: "validate --strict", result: "pass", ms: 900, attempt: 1, t: now - 200 },
    {
      type: "gate-start",
      stage: "quality: coverage",
      runner: "docker",
      image: "maven:3.9",
      attempt: 1,
      t: now - 180,
    },
  ]);
  assert.equal(r.state, "running");
  assert.equal(r.phase, "gate");
  assert.equal(r.running.stage, "quality: coverage");
  assert.equal(r.running.since, now - 180);
  assert.equal(r.running.image, "maven:3.9");

  const ended = foldRequirement("REQ-007", [
    { type: "attempt", state: "start", attempt: 1, t: now - 600 },
    { type: "gate-start", stage: "quality: coverage", attempt: 1, t: now - 180 },
    { type: "gate", stage: "quality: coverage 91%", result: "pass", ms: 4000, attempt: 1, t: now },
  ]);
  assert.equal(ended.running, null, "an ended step is not running");

  const page = livePage("demo");
  assert.match(page, /gate-start/);
  assert.match(page, /r\.running/);
});

test("REQ-275 SCN-275a: building while a quality check runs", () => {
  const html = studioAppPage("demo", "abc123");
  assert.match(html, /gate-start/);
  assert.match(html, /indexOf\("quality:"\)/);
  assert.match(html, /cur\.running/);
});
