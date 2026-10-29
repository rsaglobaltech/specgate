"use strict";

/**
 * REQ-316..318 (ADR-0043) — a role's constraints, written once in
 * `harness/<role>.md`, reach the requirements they concern; the report and the
 * live view say which were used; the review advises on each.
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
const packages = () => require("../../scripts/lib/role-packages");

const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

const capability = (name: string, id: string, title: string) =>
  [
    `# ${name}`,
    "",
    "## Requirements",
    "",
    `### Requirement: ${id} — ${title}`,
    "",
    `The system SHALL ${title.toLowerCase()}.`,
    "",
    `#### Scenario: SCN-${id.slice(4)} — It happens`,
    "",
    "- GIVEN a dispatcher",
    `- WHEN they ${title.toLowerCase()}`,
    "- THEN it is done",
    "",
    "<!-- specgate:trace status=Approved actor=Dispatcher kind=functional tags=pii -->",
    "",
  ].join("\n");

const SECURITY = [
  "---",
  "role: security",
  "owner: sec@acme.eu",
  "version: 2",
  "applies-to:",
  "  capability: [payments]",
  "---",
  "",
  "Never log a card number. Validate every amount on the server.",
  "",
].join("\n");

const PERFORMANCE = [
  "---",
  "role: performance",
  "owner: perf@acme.eu",
  "version: 1",
  "applies-to:",
  "  kind: [functional]",
  "  tag: [pii]",
  "---",
  "",
  "A list endpoint pages its results.",
  "",
].join("\n");

/** A project `init` wrote, with two capabilities and two role packages. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-packages-"));
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
    "docs/specs/capabilities/payments/spec.md",
    capability("Payments", "REQ-002", "Charge a card")
  );
  w(
    dir,
    "docs/specs/capabilities/fleet/spec.md",
    capability("Fleet", "REQ-003", "Register a truck")
  );
  w(dir, "harness/security.md", SECURITY);
  w(dir, "harness/performance.md", PERFORMANCE);
  return dir;
}

test("REQ-316 SCN-316a: security constraints on a payment requirement", () => {
  const dir = project();
  const used = (id: string) =>
    packages()
      .packagesFor(dir, id)
      .map((p: { id: string }) => p.id);
  assert.deepEqual(used("REQ-002").sort(), ["performance@1", "security@2"]);
  assert.deepEqual(used("REQ-003"), ["performance@1"], "security applies to payments only");

  const { buildPrompt } = require("../../scripts/harness/prompt");
  const p2 = buildPrompt({ requirement: "REQ-002", scenarioId: "SCN-002" }, dir);
  assert.match(p2, /## Role constraints/);
  assert.match(p2, /security · v2 · owner sec@acme\.eu/);
  assert.match(p2, /Never log a card number/);

  fs.rmSync(path.join(dir, "harness", "performance.md"));
  const p3 = buildPrompt({ requirement: "REQ-003", scenarioId: "SCN-003" }, dir);
  assert.doesNotMatch(p3, /Role constraints/);
});

test("REQ-317 SCN-317a: two runs with the security package", () => {
  const dir = project();
  const run = (name: string, results: unknown[]) =>
    w(
      dir,
      `.harness/runs/${name}.json`,
      JSON.stringify({ startedAt: name, finishedAt: name, results })
    );
  run("2026-10-29T10-00-00-000Z", [
    {
      requirement: "REQ-002",
      result: "pass",
      attempts: 1,
      packages: ["security@2", "performance@1"],
    },
  ]);
  run("2026-10-29T11-00-00-000Z", [
    { requirement: "REQ-004", result: "pass", attempts: 1, packages: ["security@2"] },
  ]);
  const r = spawnSync(
    process.execPath,
    [CLI, "harness", "report", "--json", "--project-dir", dir],
    { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).report;
  assert.deepEqual(report.packages, [
    { id: "security@2", requirements: 2 },
    { id: "performance@1", requirements: 1 },
  ]);

  const { foldRequirement } = require("../../scripts/lib/live-model");
  const live = foldRequirement("REQ-002", [
    { t: 1, type: "attempt", state: "start", attempt: 1 },
    { t: 2, type: "prompt", role: "agent", chars: 100, lines: 5, packages: ["security@2"] },
  ]);
  assert.deepEqual(live.packages, ["security@2"]);
});

test("REQ-318 SCN-318a: the review instruction names each package", () => {
  const dir = project();
  const text = packages().reviewAdvice(packages().packagesFor(dir, "REQ-002"));
  assert.match(text, /- security: OK/);
  assert.match(text, /- performance: OK/);
  assert.match(text, /ADVICE/);
  assert.match(text, /does not decide the verdict/);
  assert.equal(packages().reviewAdvice([]), "");
});
