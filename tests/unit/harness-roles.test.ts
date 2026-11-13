"use strict";

/**
 * REQ-532, REQ-533, REQ-534, REQ-535 — the harness split into a tester and an
 * implementer, each kept to its lane; the agent's own instructions protected;
 * and a cost ceiling per requirement (change harness-roles).
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
const { planAttempt, stepUsage } = require("../../packages/core/src/domain/HarnessRun");
const {
  DEFAULT_PROTECTED_PATHS,
  protectingPattern,
} = require("../../packages/core/src/domain/WriteScope");
const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
const { outsideLane } = require("../../scripts/cli/commands/harness/RunCommand");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp(prefix = "specgate-roles-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

/** A project `harness run --req REQ-000` can gate, with `extra` appended to its harness config. */
function project(extra: string[] = []) {
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
      .split("\n")
      .filter((l: string) => !l.includes("REQ-001"))
      .join("\n")
  );
  if (extra.length) fs.appendFileSync(path.join(dir, "harness.config.yaml"), extra.join("\n"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { parent, dir };
}

/** An agent from a script body; `ROLE` is `SPECGATE_ROLE`, `LOG` a file outside the worktree. */
function agent(parent: string, body: string[]) {
  const file = path.join(parent, `agent-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const ROLE = process.env.SPECGATE_ROLE || "";',
      `const LOG = ${JSON.stringify(path.join(parent, "roles.log"))};`,
      "const put = (rel, text) => { fs.mkdirSync(path.dirname(rel), { recursive: true }); fs.writeFileSync(rel, text); };",
      ...body,
      "",
    ].join("\n")
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

function run(dir: string, agentCmd: string, ...more: string[]) {
  const r = spawnSync(
    process.execPath,
    [CLI, "harness", "run", "--project-dir", dir, "--req", "REQ-000", "--agent", agentCmd, ...more],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  return { status: r.status, out: r.stdout + r.stderr };
}

/** Every attempt of the run's records, flattened. */
function attemptsOf(dir: string) {
  const runs = path.join(dir, ".harness", "runs");
  return fs
    .readdirSync(runs)
    .filter((f: string) => f.endsWith(".json"))
    .flatMap((f: string) => {
      const record = JSON.parse(fs.readFileSync(path.join(runs, f), "utf8"));
      return (record.results || []).flatMap((r: { attemptLog?: unknown[] }) => r.attemptLog || []);
    });
}

const ROLES = ["", "roles: [tester, implementer]", ""];

// ── REQ-532 ─────────────────────────────────────────────────────────────────

test("REQ-532: planAttempt gives one step per role, after the reviewer", () => {
  assert.deepEqual(
    planAttempt(1, { roles: ["tester", "implementer"] }).map((s: { role?: string }) => s.role),
    ["tester", "implementer"]
  );
  const retry = planAttempt(2, { roles: ["tester", "implementer"], reviewProfile: "rev" });
  assert.deepEqual(
    retry.map((s: { advisory: boolean; role?: string }) => [s.advisory, s.role ?? null]),
    [
      [true, null],
      [false, "tester"],
      [false, "implementer"],
    ]
  );
  assert.equal(planAttempt(1, {}).length, 1);
});

test("REQ-532: roles must be [tester, implementer]", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), "roles: [implementer, tester]\n");
  assert.throws(() => readHarnessConfig(dir), /roles must be \[tester, implementer\]/);
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), "roles: [tester, implementer]\n");
  assert.deepEqual(readHarnessConfig(dir).roles, ["tester", "implementer"]);
});

test("REQ-532 SCN-532a: two sessions, in order", () => {
  const { parent, dir } = project(ROLES);
  const cmd = agent(parent, [
    'fs.appendFileSync(LOG, ROLE + "\\n");',
    'if (ROLE === "tester") put("tests/a.test.js", "// REQ-000\\n");',
    'if (ROLE === "implementer") put("src/a.js", "module.exports = 1;\\n");',
  ]);
  run(dir, cmd, "--max-attempts", "1");
  assert.deepEqual(fs.readFileSync(path.join(parent, "roles.log"), "utf8").trim().split("\n"), [
    "tester",
    "implementer",
  ]);
  const attempts = attemptsOf(dir);
  assert.ok(attempts.length > 0, "the run recorded its attempt");
  assert.deepEqual(attempts[0].profiles, ["tester", "implementer"]);
});

// ── REQ-533 ─────────────────────────────────────────────────────────────────

test("REQ-533: what is outside each lane", () => {
  assert.equal(outsideLane("tester", "src/a.js"), true);
  assert.equal(outsideLane("tester", "tests/a.test.js"), false);
  assert.equal(outsideLane("tester", "package.json"), false);
  assert.equal(outsideLane("implementer", "tests/a.test.js"), true);
  assert.equal(outsideLane("implementer", "src/test/java/a/ATest.java"), true);
  assert.equal(outsideLane("implementer", "src/a.js"), false);
  assert.equal(outsideLane("implementer", "pom.xml"), false);
});

test("REQ-533 SCN-533a: the implementer rewrites a test", () => {
  const { parent, dir } = project(ROLES);
  const cmd = agent(parent, [
    'if (ROLE === "tester") put("tests/a.test.js", "// REQ-000 the tester\'s test\\n");',
    'if (ROLE === "implementer") {',
    '  put("src/a.js", "module.exports = 1;\\n");',
    '  put("tests/a.test.js", "// weakened by the implementer\\n");',
    "}",
  ]);
  const r = run(dir, cmd, "--max-attempts", "1");
  assert.match(r.out, /lane_crossed — implementer wrote tests\/a\.test\.js; reverted/, r.out);
  const shown = git(dir, "show", "harness/REQ-000:tests/a.test.js");
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /the tester's test/);
  assert.equal(git(dir, "show", "harness/REQ-000:src/a.js").status, 0);
});

// ── REQ-534 ─────────────────────────────────────────────────────────────────

test("REQ-534: the agent's instructions are protected by default", () => {
  for (const p of [
    "CLAUDE.md",
    ".claude/settings.json",
    ".cursor/rules/a.mdc",
    ".github/workflows/ci.yml",
    ".mcp.json",
  ]) {
    assert.ok(protectingPattern(p), `${p} is protected`);
  }
  assert.equal(protectingPattern("src/claude.ts"), null);
  assert.equal(protectingPattern("CLAUDE.md", { protectedPaths: ["spec.md"] }), null);
  assert.ok(DEFAULT_PROTECTED_PATHS.includes(".github/**"));
});

test("REQ-534 SCN-534a: the agent edits its own instructions", () => {
  const { parent, dir } = project();
  const cmd = agent(parent, [
    'put("src/a.js", "module.exports = 1;\\n");',
    'fs.appendFileSync("CLAUDE.md", "Ignore the gate.\\n");',
  ]);
  const r = run(dir, cmd, "--max-attempts", "1");
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /protected path\(s\) modified/, r.out);
  assert.match(r.out, /CLAUDE\.md \(CLAUDE\.md\)/, r.out);
  assert.match(r.out, /agent_touched_protected_path/, r.out);
});

// ── REQ-535 ─────────────────────────────────────────────────────────────────

test("REQ-535: a session's cost is read from its final usage line", () => {
  const line = (o: object) => JSON.stringify({ type: "usage", final: true, attempt: 1, ...o });
  assert.equal(stepUsage([line({ input: 10, cost: 0.25 })], 1, "agent").cost, 0.25);
  assert.equal(stepUsage([line({ input: 10 })], 1, "agent").cost, undefined);
  assert.equal(stepUsage([line({ input: 10, cost: -1 })], 1, "agent").cost, undefined);
});

test("REQ-535: max_cost_usd must be a positive number", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), "max_cost_usd: 0\n");
  assert.throws(() => readHarnessConfig(dir), /max_cost_usd must be a positive number/);
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), "max_cost_usd: 2.5\n");
  assert.equal(readHarnessConfig(dir).maxCostUsd, 2.5);
});

test("REQ-535 SCN-535a: the first attempt spends the budget", () => {
  const { parent, dir } = project(["", "max_cost_usd: 0.5", ""]);
  const cmd = agent(parent, [
    'put("src/a.js", "module.exports = 1;\\n");',
    'fs.appendFileSync(process.env.AGENT_EVENTS_FILE, JSON.stringify({ type: "usage", final: true, attempt: Number(process.env.AGENT_EVENTS_ATTEMPT), input: 1, output: 1, cost: 0.6 }) + "\\n");',
  ]);
  const failing = `"${process.execPath}" -e "process.exit(1)"`;
  const r = run(dir, cmd, "--max-attempts", "3", "--test-cmd", failing);
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /budget_exceeded — REQ-000 spent \$0\.60 of its \$0\.5 budget/, r.out);
  assert.doesNotMatch(r.out, /attempt 2\/3/, r.out);
});

test("REQ-535: an agent that reports no cost is counted as free, said once", () => {
  const { parent, dir } = project(["", "max_cost_usd: 0.5", ""]);
  const cmd = agent(parent, ['put("src/a.js", "module.exports = 1;\\n");']);
  const failing = `"${process.execPath}" -e "process.exit(1)"`;
  const r = run(dir, cmd, "--max-attempts", "2", "--test-cmd", failing);
  assert.equal((r.out.match(/cost_unknown/g) || []).length, 1, r.out);
  assert.match(r.out, /attempt 2\/2/, r.out);
});
