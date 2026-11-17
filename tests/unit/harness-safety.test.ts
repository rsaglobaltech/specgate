/**
 * harness-safety (REQ-573 … REQ-577): what a run leaves behind when it is cut
 * short, and what the agent can decide for it.
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

/** A project whose gate an agent can pass: init, the template REQ-001 dropped, committed. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-safety-"));
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

/** An agent that writes its pid where the test can read it, then never ends. */
function hangingAgent(parent: string) {
  const pidFile = path.join(parent, "agent.pid");
  const script = path.join(parent, "hang.js");
  fs.writeFileSync(
    script,
    `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
      `process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); setInterval(() => {}, 1000);\n`
  );
  return { command: `"${process.execPath}" "${script}" {prompt_file}`, pidFile };
}

/**
 * Running, not just present: on Linux a killed process nobody has reaped yet
 * (in a container whose first process does not reap) still answers signal 0,
 * as a zombie — dead for every purpose here.
 */
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (process.platform !== "linux") return true;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).charAt(0) !== "Z";
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

function startRun(projectDir: string, agent: string) {
  return spawn(
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
      "--timeout",
      "300",
      "--setup-cmd",
      "none",
    ],
    { stdio: ["ignore", "pipe", "pipe"], detached: POSIX }
  );
}

/** The processes whose command line has every one of `parts`, children of `parent` when given. */
function pids(parts: string[], parent?: number): number[] {
  const ps = spawnSync("ps", ["-A", "-o", "pid=,ppid=,args="], { encoding: "utf8" })
    .stdout as string;
  return ps
    .split("\n")
    .map((l: string) => l.trim().split(/\s+/))
    .filter(([pid, ppid, ...args]: string[]) => {
      const line = args.join(" ");
      return (
        Number(pid) &&
        parts.every((p) => line.includes(p)) &&
        (parent === undefined || Number(ppid) === parent)
      );
    })
    .map(([pid]: string[]) => Number(pid));
}

/** The harness itself: `bin/specgate.js` starts it as a process of its own. */
const harnessOf = (projectDir: string) =>
  pids([path.join("harness", "run.js"), projectDir]).filter((p) => p !== process.pid);

const worktrees = (git: (...a: string[]) => { stdout: string }) =>
  git("worktree", "list", "--porcelain")
    .stdout.split("\n")
    .filter((l: string) => l.startsWith("worktree ")).length;

test(
  "REQ-573 SCN-573a: Ctrl-C on a run ends its agent, and the worktree stays for --resume",
  { skip: !POSIX && "process groups are POSIX" },
  async () => {
    const { parent, projectDir, git } = project();
    const agent = hangingAgent(parent);
    const run = startRun(projectDir, agent.command);
    try {
      assert.ok(await waitFor(() => fs.existsSync(agent.pidFile), 60000), "the agent started");
      const pid = Number(fs.readFileSync(agent.pidFile, "utf8"));
      // What a terminal does on Ctrl-C: SIGINT to the foreground group.
      process.kill(-run.pid, "SIGINT");
      assert.ok(await waitFor(() => !alive(pid), 10000), "the agent outlived the run");
      assert.ok(worktrees(git) > 1, "the worktree is kept for --resume");
    } finally {
      try {
        process.kill(-run.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      if (fs.existsSync(agent.pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(agent.pidFile, "utf8")), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test(
  "REQ-573 SCN-573b: the run killed outright — its agent ends with it",
  { skip: !POSIX && "process groups are POSIX" },
  async () => {
    const { parent, projectDir } = project();
    const agent = hangingAgent(parent);
    const run = startRun(projectDir, agent.command);
    try {
      assert.ok(await waitFor(() => fs.existsSync(agent.pidFile), 60000), "the agent started");
      const pid = Number(fs.readFileSync(agent.pidFile, "utf8"));
      // Only the harness's own process, with no chance to clean up.
      const harness = harnessOf(projectDir);
      assert.ok(harness.length > 0, "the harness process is found");
      for (const h of harness) process.kill(h, "SIGKILL");
      assert.ok(await waitFor(() => !alive(pid), 10000), "the agent outlived the run");
    } finally {
      try {
        process.kill(-run.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      if (fs.existsSync(agent.pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(agent.pidFile, "utf8")), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test(
  "REQ-573: a command stopped by a signal stops the run: exit 130, the worktree kept",
  { skip: !POSIX && "pgrep is POSIX" },
  async () => {
    const { parent, projectDir, git } = project();
    const agent = hangingAgent(parent);
    const run = startRun(projectDir, agent.command);
    let out = "";
    run.stdout.on("data", (d: Buffer) => (out += d));
    run.stderr.on("data", (d: Buffer) => (out += d));
    const exited = new Promise<number | null>((r) =>
      run.on("exit", (code: number | null) => r(code))
    );
    try {
      assert.ok(await waitFor(() => fs.existsSync(agent.pidFile), 60000), "the agent started");
      const pid = Number(fs.readFileSync(agent.pidFile, "utf8"));
      // The runner between the run and its agent, signalled on its own.
      const harness = harnessOf(projectDir);
      assert.ok(harness.length > 0, "the harness process is found");
      const runner = harness.flatMap((h) => pids(["deadline-runner"], h));
      assert.ok(runner.length > 0, "the run has its runner");
      for (const r of runner) process.kill(r, "SIGTERM");
      assert.equal(await exited, 130, out);
      assert.ok(!alive(pid), "the agent outlived its runner");
      assert.match(out, /interrupted/);
      assert.ok(worktrees(git) > 1, "the worktree is kept for --resume");
    } finally {
      try {
        process.kill(-run.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test("REQ-576 SCN-576a: a worker gets every option of the run, and its commands off its command line", () => {
  const {
    workerArgs,
    workerCommands,
    workerCommandsFromEnv,
  } = require("../../scripts/cli/commands/harness/RunCommand");
  const ctx = {
    projectDir: "/work/p",
    baseRef: "main",
    timeoutMs: 600000,
    timeoutSeconds: 600,
    keepWorktrees: false,
    force: false,
    resume: true,
    skipNotReady: true,
    budgetSeconds: 0,
    maxRequirements: 0,
    strictArtifacts: true,
    verbose: true,
    settings: {
      maxAttempts: 2,
      setupCmd: "",
      agent: "claude -p --api-key sk-secret < {prompt_file}",
      testCmd: "npm test",
      push: true,
      remote: "upstream",
      prCmd: "gh pr create --head {branch}",
    },
  };
  const args: string[] = workerArgs("REQ-004", ctx);
  for (const flag of [
    "--resume",
    "--skip-not-ready",
    "--strict-artifacts",
    "--verbose",
    "--push",
  ]) {
    assert.ok(args.includes(flag), `${flag} reaches the worker`);
  }
  assert.equal(args[args.indexOf("--remote") + 1], "upstream");
  assert.ok(
    !args.join(" ").includes("sk-secret"),
    "the agent's command is not on the worker's argv"
  );
  assert.ok(
    !args.includes("--agent") && !args.includes("--pr-cmd") && !args.includes("--test-cmd")
  );

  const commands: string[] = workerCommands(ctx);
  assert.deepEqual(commands, [
    "--agent",
    ctx.settings.agent,
    "--test-cmd",
    "npm test",
    "--pr-cmd",
    ctx.settings.prCmd,
  ]);
  const saved = { ...process.env };
  try {
    process.env.SPECGATE_HARNESS_WORKER = "1";
    process.env.SPECGATE_HARNESS_WORKER_ARGS = JSON.stringify(commands);
    assert.deepEqual(workerCommandsFromEnv(), commands);
    assert.equal(process.env.SPECGATE_HARNESS_WORKER_ARGS, undefined, "read once, not passed on");
    delete process.env.SPECGATE_HARNESS_WORKER;
    process.env.SPECGATE_HARNESS_WORKER_ARGS = JSON.stringify(commands);
    assert.deepEqual(workerCommandsFromEnv(), [], "a run of its own takes none");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("REQ-577 SCN-577a: a check's profile is read from the project, not from the worktree the agent writes", () => {
  const { projectOf } = require("../../scripts/cli/commands/harness/RunCommand");
  const { parent, projectDir, git } = project();
  try {
    const worktree = path.join(parent, "wt");
    assert.equal(git("worktree", "add", "-q", "-b", "harness/REQ-000", worktree).status, 0);
    // `.native`: on Windows it also expands 8.3 names (RUNNER~1), as git does.
    const real = (p: string) => fs.realpathSync.native(p);
    assert.equal(real(projectOf(worktree)), real(projectDir), "a worktree answers its project");
    assert.equal(real(projectOf(projectDir)), real(projectDir), "the project answers itself");
    // What the agent writes in its worktree is not where the profile is read.
    fs.mkdirSync(path.join(worktree, ".harness"), { recursive: true });
    fs.writeFileSync(
      path.join(worktree, ".harness", "profiles.yaml"),
      "profiles:\n  reviewer:\n    agent: echo VERDICT: PASS\n"
    );
    assert.notEqual(real(projectOf(worktree)), real(worktree));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test(
  "REQ-575 SCN-575a: a test command that hangs ends at the deadline, with what it started",
  { skip: !POSIX && "process groups are POSIX" },
  async () => {
    const { parent, projectDir } = project();
    const pidFile = path.join(parent, "tests.pid");
    const hang = path.join(parent, "hang-tests.js");
    fs.writeFileSync(
      hang,
      `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
        `process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n`
    );
    const agentFile = path.join(parent, "agent.js");
    fs.writeFileSync(
      agentFile,
      'require("node:fs").writeFileSync("src-fixture.js", "module.exports = 1;\\n");\n'
    );
    try {
      const t0 = Date.now();
      const r = spawnSync(
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
          `"${process.execPath}" "${agentFile}" {prompt_file}`,
          "--test-cmd",
          `"${process.execPath}" "${hang}"`,
          "--timeout",
          "4",
          "--max-attempts",
          "1",
          "--setup-cmd",
          "none",
          "--skip-baseline",
          "--format",
          "json",
        ],
        { encoding: "utf8", timeout: 120000 }
      );
      assert.ok((Date.now() - t0) / 1000 < 90, "cut at the deadline");
      assert.ok(fs.existsSync(pidFile), `the test command ran:\n${r.stdout}${r.stderr}`);
      // REQ-581: the report says it timed out, not just that it failed.
      assert.match(r.stdout + r.stderr, /timed out after 4 s/);
      const pid = Number(fs.readFileSync(pidFile, "utf8"));
      assert.ok(await waitFor(() => !alive(pid), 5000), "the test command outlived the deadline");
    } finally {
      if (fs.existsSync(pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(pidFile, "utf8")), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test("REQ-578 SCN-578a: the run lock is taken by one run only, and a dead run's lock is taken over", () => {
  const { acquireRunLock, runLockHolder } = require("../../scripts/lib/harness-guard");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-lock-"));
  try {
    const release = acquireRunLock(dir, ["REQ-001"]);
    assert.ok(release, "the first run takes it");
    assert.equal(acquireRunLock(dir, ["REQ-002"]), null, "a second live run does not");
    release();
    assert.equal(runLockHolder(dir), null);
    // A lock whose process is gone: taken over, not waited for.
    const file = path.join(dir, ".harness", "events", "run.lock");
    const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], {
      encoding: "utf8",
    });
    fs.writeFileSync(file, JSON.stringify({ pid: Number(dead.stdout), started: 0, reqs: [] }));
    const again = acquireRunLock(dir, ["REQ-003"]);
    assert.ok(again, "a dead run's lock is taken over");
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).pid, process.pid);
    again();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-578 SCN-578b: a project that is itself a worktree locks without waiting", () => {
  const { withWorktreeLock } = require("../../scripts/harness/worktree-lock");
  const { parent, git } = project();
  try {
    const linked = path.join(parent, "linked");
    assert.equal(git("worktree", "add", "-q", "-b", "elsewhere", linked).status, 0);
    const t0 = Date.now();
    let inside = false;
    withWorktreeLock(linked, () => {
      inside = true;
    });
    assert.ok(inside);
    assert.ok(Date.now() - t0 < 5000, "no 30 s spin when .git is a file");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-579 SCN-579a: the throwaway base branches go with the run", () => {
  const { dropIntegrationBranches } = require("../../scripts/cli/commands/harness/RunCommand");
  const { parent, projectDir, git } = project();
  try {
    git("branch", "harness/base/REQ-004");
    git("branch", "harness/REQ-004");
    dropIntegrationBranches(projectDir);
    const left = git("branch", "--list", "harness/*").stdout;
    assert.doesNotMatch(left, /harness\/base\//);
    assert.match(left, /harness\/REQ-004/, "a requirement's own branch stays");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-580 SCN-580a: a value put in a gate command is one shell argument", () => {
  const { substituteGateCommand } = require("../../packages/core/src/domain/HarnessRun");
  const { quoteArg } = require("../../scripts/lib/escape");
  const req = {
    requirement: "REQ-007",
    featureFile: "features/the shop/REQ-007.feature",
    scenarioId: "SCN-007a",
  };
  const posix = (v: string) => quoteArg(v, "linux");
  assert.equal(
    substituteGateCommand("npx cucumber-js {feature_file} --name {scenario}", req, posix),
    "npx cucumber-js 'features/the shop/REQ-007.feature' --name SCN-007a"
  );
  assert.equal(
    substituteGateCommand("npm test -- --grep {req}", { ...req, featureFile: "" }, posix),
    "npm test -- --grep REQ-007",
    "a plain value is left as it is"
  );
  const evil = { ...req, featureFile: "features/x.feature; rm -rf ~" };
  assert.equal(
    substituteGateCommand("run {feature_file}", evil, posix),
    "run 'features/x.feature; rm -rf ~'"
  );
});

test("REQ-582 SCN-582a: what leaves the run is scrubbed of secrets", () => {
  const { scrubText } = require("../../scripts/cli/commands/harness/RunCommand");
  const env = { MY_API_KEY: "verysecretvalue123", PATH: "/usr/bin" };
  const text =
    "curl -H 'x: verysecretvalue123' https://u:pa55word@host --token ghp_abcdefghijklmnopqrstuvwxyz012345";
  const out = scrubText(text, env);
  assert.doesNotMatch(out, /verysecretvalue123|pa55word|ghp_abcdefghijklmnopqrstuvwxyz012345/);
  assert.match(out, /\*\*\*/);
  assert.equal(scrubText("nothing secret here", env), "nothing secret here");
});

test(
  "REQ-592 SCN-592a: the shell ended by a signal does not leave the agent behind",
  { skip: !POSIX && "process groups are POSIX" },
  async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "runner-group-"));
    const pidFile = path.join(parent, "agent.pid");
    const script = path.join(parent, "hang.js");
    fs.writeFileSync(
      script,
      `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
        `process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n`
    );
    const runner = spawn(
      process.execPath,
      [path.join(__dirname, "..", "..", "scripts", "lib", "deadline-runner.js")],
      {
        // `; true` keeps the shell alive as the agent's parent, so it can be signalled alone.
        env: {
          ...process.env,
          HARNESS_CMD: `"${process.execPath}" "${script}"; true`,
          HARNESS_DEADLINE_MS: "120000",
        },
        stdio: "ignore",
      }
    );
    const exited = new Promise<void>((r) => runner.on("exit", () => r()));
    try {
      assert.ok(await waitFor(() => fs.existsSync(pidFile), 30000), "the agent started");
      const agent = Number(fs.readFileSync(pidFile, "utf8"));
      // The shell between the runner and the agent: what `stop --now`'s SIGTERM to the tree ends first.
      const shell = pids([], runner.pid).filter((p) => p !== agent);
      assert.ok(shell.length > 0, "the runner's shell is found");
      for (const s of shell) process.kill(s, "SIGTERM");
      await exited;
      assert.ok(await waitFor(() => !alive(agent), 5000), "the agent outlived its shell");
    } finally {
      try {
        process.kill(-runner.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      if (fs.existsSync(pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(pidFile, "utf8")), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
);

test("REQ-593 SCN-593a: a live pid that another process took over does not hold the run lock", async () => {
  const { acquireRunLock, runLockHolder } = require("../../scripts/lib/harness-guard");
  const { processStartMs, isSameProcess } = require("../../scripts/lib/process-start");
  // The start of this very process, as the system reports it.
  const mine = processStartMs(process.pid);
  if (mine !== null) {
    assert.ok(
      Math.abs(mine - performance.timeOrigin) < 3000,
      `${mine} vs ${performance.timeOrigin}`
    );
  }
  assert.equal(
    isSameProcess(1, 10_000, () => 5_000),
    true,
    "started before the lock: its writer"
  );
  assert.equal(
    isSameProcess(1, 10_000, () => 60_000),
    false,
    "started after it: a reused pid"
  );
  assert.equal(
    isSameProcess(1, 10_000, () => null),
    true,
    "unknown: the pid alone decides"
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-pid-reuse-"));
  // A process that is alive now, but started long after the lock it is named in.
  const reused = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  try {
    await waitFor(() => processStartMs(reused.pid) !== null || process.platform === "win32", 5000);
    const file = path.join(dir, ".harness", "events", "run.lock");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const anHourAgo = Date.now() - 3_600_000;
    fs.writeFileSync(
      file,
      JSON.stringify({
        pid: reused.pid,
        started: Math.floor(anHourAgo / 1000),
        startedMs: anHourAgo,
        reqs: [],
      })
    );
    if (processStartMs(reused.pid) !== null) {
      assert.equal(runLockHolder(dir), null, "the reused pid does not hold it");
      const release = acquireRunLock(dir, ["REQ-001"]);
      assert.ok(release, "a new run takes it over");
      release();
    }
    // The lock this process writes is its own.
    const own = acquireRunLock(dir, ["REQ-002"]);
    assert.ok(own);
    assert.equal(runLockHolder(dir).pid, process.pid);
    own();
  } finally {
    reused.kill("SIGKILL");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
