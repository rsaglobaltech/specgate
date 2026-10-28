"use strict";

/**
 * REQ-229 — the quality the checks measured, shown in `harness report`, the
 * studio's report and project page, `/live`, and chosen in the new-project
 * step.
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
const NL = String.fromCharCode(10);

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qv-"));
  madeDirs.push(dir);
  return dir;
}
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

const passed = (req: string, coverage: number, mutation: number) => ({
  requirement: req,
  result: "pass",
  attempts: 1,
  durationMs: 60000,
  checks: [
    {
      name: "secrets",
      when: "attempt",
      ok: true,
      findings: { freshCount: 0, baselined: 2, total: 2 },
    },
    {
      name: "coverage",
      when: "attempt",
      ok: true,
      measure: { kind: "coverage", value: coverage, threshold: 70 },
    },
    {
      name: "mutation",
      when: "end",
      ok: true,
      measure: { kind: "mutation", value: mutation, threshold: 50 },
    },
  ],
});

/** A project with two delivered requirements and the run records of their checks. */
function measuredProject() {
  const dir = tmp();
  const req = (n: number, title: string) =>
    `### Requirement: REQ-00${n} — ${title}${NL}${NL}<!-- specgate:trace status=Implemented -->${NL}${NL}The system SHALL ${title.toLowerCase()}.${NL}${NL}#### Scenario: SCN-00${n} — ${title}${NL}${NL}- GIVEN a${NL}- WHEN b${NL}- THEN c${NL}`;
  w(dir, "spec.md", "# Spec" + NL);
  w(
    dir,
    "docs/specs/capabilities/shop/spec.md",
    ["# shop", "", req(2, "Book"), req(3, "Pay")].join(NL)
  );
  w(
    dir,
    ".harness/runs/2026-10-28T10-00-00-000Z.json",
    JSON.stringify({
      startedAt: "2026-10-28T10:00:00Z",
      results: [passed("REQ-002", 90, 80), passed("REQ-003", 70, 60)],
    })
  );
  return dir;
}

test("REQ-229 SCN-229a: the harness report sums the quality up", () => {
  const dir = measuredProject();
  const r = spawnSync(
    process.execPath,
    [CLI, "harness", "report", "--json", "--project-dir", dir],
    {
      encoding: "utf8",
    }
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const q = (doc.report || doc).quality;
  assert.equal(q.measured, 2);
  assert.equal(q.coverage, 80);
  assert.equal(q.mutation, 70);
  assert.deepEqual(
    q.checks.map((c: { name: string; ran: number }) => [c.name, c.ran]),
    [
      ["secrets", 2],
      ["coverage", 2],
      ["mutation", 2],
    ]
  );
});

test("REQ-229 SCN-229b: the studio's report shows each requirement's figures", () => {
  const dir = measuredProject();
  const { report, reportHtml } = require("../../scripts/lib/studio-route");
  const r = report(dir, false);
  const req2 = r.delivered.find((d: { id: string }) => d.id === "REQ-002");
  assert.deepEqual(req2.quality, { coverage: 90, mutation: 80 });
  assert.equal(r.quality.coverage, 80);
  assert.equal(r.quality.mutation, 70);
  assert.match(reportHtml(r), /Quality of the code/);
});

test("REQ-229 SCN-229c: a new project with a quality level, and turning it up later", () => {
  const dir = tmp();
  const route = require("../../scripts/lib/studio-route");
  const made = route.createProject(dir, {
    name: "Shop",
    kind: "web",
    stack: "node-react",
    agent: "none",
    quality: "basic",
  });
  assert.equal(made.ok, true, JSON.stringify(made));
  const config = fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
  assert.match(config, /^quality: basic$/m);
  const view = route.qualityView(dir);
  assert.equal(view.level, "basic");
  assert.ok(view.checks.some((c: { name: string }) => c.name === "commits"));
  assert.ok(view.checks.some((c: { name: string }) => c.name === "secrets"));
  const up = route.initQuality(dir, "strict");
  assert.equal(up.ok, true);
  assert.equal(up.view.level, "strict");
  assert.equal(route.initQuality(dir, "extreme").ok, false);
});

test("REQ-229 SCN-229d: /live sees each check", () => {
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
  w(
    dir,
    "harness.config.yaml",
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
  assert.match(r.stdout + r.stderr, /1 passed · 0 failed/, r.stdout + r.stderr);
  const events = fs.readFileSync(path.join(dir, ".harness", "events", "REQ-000.jsonl"), "utf8");
  const stages = events
    .split(NL)
    .filter(Boolean)
    .map((l: string) => JSON.parse(l))
    .filter((e: { type: string }) => e.type === "gate")
    .map((e: { stage: string }) => e.stage);
  assert.ok(stages.includes("quality: marker"), stages.join(" | "));
  assert.ok(stages.includes("quality: final"), stages.join(" | "));
});
