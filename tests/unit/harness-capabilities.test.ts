/**
 * harness-capabilities (REQ-583 … REQ-587): stop now, a time limit per kind of
 * command, the run's budget, falling back to another agent, and the agent's
 * environment.
 */
export {};
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");
const POSIX = process.platform !== "win32";

function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-cap-"));
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const projectDir = path.join(parent, fs.readdirSync(parent)[0]);
  const specPath = path.join(projectDir, "spec.md");
  fs.writeFileSync(
    specPath,
    fs
      .readFileSync(specPath, "utf8")
      .split("\n")
      .filter((l: string) => !l.includes("REQ-001"))
      .join("\n")
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "harness-test@example.com");
  git("config", "user.name", "Harness Test");
  git("add", "-A");
  git("commit", "-qm", "seed");
  return { parent, projectDir, git };
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function waitFor(what: () => boolean, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (what()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return what();
}

function run(projectDir: string, agent: string, extra: string[] = [], env = process.env) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      projectDir,
      "--req",
      "REQ-000",
      "--agent",
      agent,
      "--max-attempts",
      "1",
      "--setup-cmd",
      "none",
      ...extra,
    ],
    { encoding: "utf8", env, timeout: 180000 }
  );
}

// ── REQ-583 ─────────────────────────────────────────────────────────────

test(
  "REQ-583 SCN-583a: harness stop --now ends the run and its agent, and keeps the worktree",
  { skip: !POSIX && "process groups are POSIX" },
  async () => {
    const { parent, projectDir, git } = project();
    const pidFile = path.join(parent, "agent.pid");
    const script = path.join(parent, "hang.js");
    fs.writeFileSync(
      script,
      `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
        `process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n`
    );
    const harness = spawn(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        projectDir,
        "--req",
        "REQ-000",
        "--agent",
        `"${process.execPath}" "${script}" {prompt_file}`,
        "--max-attempts",
        "1",
        "--setup-cmd",
        "none",
      ],
      { stdio: "ignore", detached: true }
    );
    try {
      assert.ok(await waitFor(() => fs.existsSync(pidFile), 60000), "the agent started");
      const pid = Number(fs.readFileSync(pidFile, "utf8"));
      const stop = spawnSync(
        process.execPath,
        [CLI, "harness", "stop", "--now", "--project-dir", projectDir, "--json"],
        { encoding: "utf8" }
      );
      assert.equal(stop.status, 0, stop.stdout + stop.stderr);
      const answer = JSON.parse(stop.stdout);
      assert.equal(answer.stop.now, true);
      assert.ok(answer.stop.run && answer.stop.run.pid > 0);
      assert.ok(await waitFor(() => !alive(pid), 10000), "the agent outlived stop --now");
      const worktrees = git("worktree", "list", "--porcelain")
        .stdout.split("\n")
        .filter((l: string) => l.startsWith("worktree ")).length;
      assert.ok(worktrees > 1, "the worktree is kept for --resume");
    } finally {
      try {
        process.kill(-harness.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test("REQ-583: stop needs --after-current or --now, not both", () => {
  const { parent, projectDir } = project();
  try {
    const both = spawnSync(
      process.execPath,
      [CLI, "harness", "stop", "--now", "--after-current", "--project-dir", projectDir, "--json"],
      { encoding: "utf8" }
    );
    assert.equal(both.status, 2, both.stdout + both.stderr);
    const idle = spawnSync(
      process.execPath,
      [CLI, "harness", "stop", "--now", "--project-dir", projectDir, "--json"],
      { encoding: "utf8" }
    );
    assert.equal(JSON.parse(idle.stdout).stop.requested, false, "nothing running: nothing ended");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-584 ─────────────────────────────────────────────────────────────

test("REQ-584 SCN-584a: timeouts: gives each kind of command its own limit, --timeout the rest", () => {
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const { limitFor } = require("../../scripts/cli/commands/harness/RunCommand");
  const { parent, projectDir } = project();
  try {
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "harness_version: 1\ntimeouts:\n  agent: 1800\n  tests: 300\n"
    );
    const config = readHarnessConfig(projectDir);
    assert.deepEqual(config.timeouts, { agent: 1800, tests: 300 });
    assert.equal(limitFor(config, "agent", 1200_000), 1800_000);
    assert.equal(limitFor(config, "tests", 1200_000), 300_000);
    assert.equal(limitFor(config, "setup", 1200_000), 1200_000, "unset: the run's --timeout");
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "harness_version: 1\ntimeouts:\n  lint: 30\n"
    );
    assert.throws(
      () => readHarnessConfig(projectDir),
      /timeouts\.lint is not one of agent, setup, tests, review/
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-585 ─────────────────────────────────────────────────────────────

test("REQ-585 SCN-585a: the run's cost ceiling stops starting requirements once it is reached", () => {
  const {
    budgetVerdict,
    hasBudget,
    reportedCost,
    BUDGET_CODES,
  } = require("../../packages/core/src/domain/RunBudget");
  const limits = { maxRunCostUsd: 5 };
  assert.equal(hasBudget(limits), true);
  assert.equal(budgetVerdict(limits, { startedAt: 0, started: 2, spentUsd: 4.99 }, 0).stop, false);
  const v = budgetVerdict(limits, { startedAt: 0, started: 3, spentUsd: 5.2 }, 0);
  assert.equal(v.stop, true);
  assert.equal(v.code, BUDGET_CODES.COST);
  assert.match(v.reason, /max_run_cost_usd 5 reached: the run's agents reported \$5\.20/);
  assert.equal(
    reportedCost([{ usage: [{ cost: 1.5 }, {}] }, { usage: [{ cost: 0.25 }] }, {}]),
    1.75
  );
});

test("REQ-585 SCN-585b: require_known_cost fails a session that reports no cost, rather than count it free", () => {
  const { parent, projectDir, git } = project();
  try {
    fs.appendFileSync(path.join(projectDir, "harness.config.yaml"), "require_known_cost: true\n");
    git("add", "-A");
    git("commit", "-qm", "known cost");
    const agent = path.join(parent, "agent.js");
    fs.writeFileSync(
      agent,
      'require("node:fs").writeFileSync("src-fixture.js", "module.exports = 1;\\n");\n'
    );
    const r = run(projectDir, `"${process.execPath}" "${agent}" {prompt_file}`, [
      "--skip-baseline",
    ]);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /cost_unknown — the .* session of REQ-000 reported no cost/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-585: max_run_cost_usd, max_tokens and require_known_cost are read from the file", () => {
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const { parent, projectDir } = project();
  try {
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "harness_version: 1\nmax_run_cost_usd: 20\nmax_tokens: 500000\nrequire_known_cost: true\n"
    );
    const c = readHarnessConfig(projectDir);
    assert.equal(c.maxRunCostUsd, 20);
    assert.equal(c.maxTokens, 500000);
    assert.equal(c.requireKnownCost, true);
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "harness_version: 1\nmax_tokens: -3\n"
    );
    assert.throws(
      () => readHarnessConfig(projectDir),
      /max_tokens must be a positive whole number/
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-586 ─────────────────────────────────────────────────────────────

test("REQ-586 SCN-586a: an agent out of quota falls back to the next profile of the ladder", () => {
  const { fallbackAttempt } = require("../../packages/core/src/domain/HarnessRun");
  // claude out of quota on attempt 1: codex is the next rung.
  assert.deepEqual(fallbackAttempt(1, 3, ["claude", "codex"]), { attempt: 2, profile: "codex" });
  // The same profile above it would meet the same wall: skip to the next that differs.
  assert.deepEqual(fallbackAttempt(1, 4, ["claude", "claude", "codex"]), {
    attempt: 3,
    profile: "codex",
  });
  assert.equal(
    fallbackAttempt(2, 3, ["claude", "codex"]),
    null,
    "the last rung repeats: none left"
  );
  assert.equal(fallbackAttempt(1, 3, []), null, "no ladder: nothing to fall back to");
  assert.equal(fallbackAttempt(1, 1, ["claude", "codex"]), null, "no attempt left");
});

// ── REQ-587 ─────────────────────────────────────────────────────────────

test("REQ-587 SCN-587a: agent_env: is what the agent gets, besides what every process needs", () => {
  const { parent, projectDir, git } = project();
  try {
    fs.appendFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "agent_env: [ANTHROPIC_API_KEY]\n"
    );
    git("add", "-A");
    git("commit", "-qm", "agent env");
    const seen = path.join(parent, "env.json");
    const agent = path.join(parent, "agent.js");
    fs.writeFileSync(
      agent,
      `const fs = require("node:fs");\n` +
        `fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify(Object.keys(process.env)));\n` +
        `fs.writeFileSync("src-fixture.js", "module.exports = 1;\\n");\n`
    );
    run(projectDir, `"${process.execPath}" "${agent}" {prompt_file}`, ["--skip-baseline"], {
      ...process.env,
      ANTHROPIC_API_KEY: "sk-ant-kept",
      AWS_SECRET_ACCESS_KEY: "not-for-the-agent",
    });
    const names: string[] = JSON.parse(fs.readFileSync(seen, "utf8"));
    assert.ok(names.includes("ANTHROPIC_API_KEY"), "the variable agent_env names");
    assert.ok(!names.includes("AWS_SECRET_ACCESS_KEY"), "a variable it does not name");
    assert.ok(names.includes("SPECGATE_REQ"), "the harness's own");
    assert.ok(
      names.some((n) => n === "PATH" || n === "Path"),
      "what every process needs"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-587: without agent_env:, the run names the secret-looking variables the agent inherits", () => {
  const { secretNames } = require("../../packages/core/src/domain/HarnessEvents");
  assert.deepEqual(
    secretNames({ GITHUB_TOKEN: "x", PATH: "/bin", DB_PASSWORD: "y", EMPTY_TOKEN: "" }),
    ["DB_PASSWORD", "GITHUB_TOKEN"]
  );
});
