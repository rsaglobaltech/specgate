/**
 * harness-extras (REQ-588 … REQ-591): the agent in a container, one download
 * cache for every worktree, the run as an OpenTelemetry trace, and a pause
 * between attempts.
 */
export {};
const { test } = require("node:test");
const assert = require("node:assert/strict");

// ── REQ-588 ─────────────────────────────────────────────────────────────

test("REQ-588 SCN-588a: the agent runs in a container that sees its worktree, no network, named variables only", () => {
  const { sandboxCommand, readSandbox } = require("../../packages/core/src/domain/Sandbox");
  const config = readSandbox({ image: "ghcr.io/acme/agent:1" });
  assert.deepEqual(config, { image: "ghcr.io/acme/agent:1", network: "none", engine: "docker" });
  const cmd = sandboxCommand("claude -p < /tmp/p/prompt.md", config, {
    worktree: "/work/wt/REQ-007",
    mounts: ["/tmp/p", "/work/proj/.harness/events", "/tmp/p"],
    env: ["SPECGATE_REQ", "ANTHROPIC_API_KEY", "SPECGATE_REQ"],
    user: "501:20",
  });
  assert.equal(
    cmd,
    "docker run --rm -i --network none --user 501:20 " +
      "-v /work/wt/REQ-007:/work/wt/REQ-007 -v /tmp/p:/tmp/p " +
      "-v /work/proj/.harness/events:/work/proj/.harness/events " +
      "-w /work/wt/REQ-007 -e ANTHROPIC_API_KEY -e SPECGATE_REQ " +
      "ghcr.io/acme/agent:1 sh -c 'claude -p < /tmp/p/prompt.md'"
  );
  assert.equal(readSandbox("img:1").network, "none", "an image name alone");
  assert.equal(readSandbox({ image: "i", network: "default", engine: "podman" }).engine, "podman");
  assert.throws(() => readSandbox({ network: "none" }), /sandbox\.image is required/);
  assert.throws(() => readSandbox({ image: "i", network: "host" }), /none or default/);
});

// ── REQ-589 ─────────────────────────────────────────────────────────────

test("REQ-589 SCN-589a: every package manager's download cache points at one folder of the project", () => {
  const { cacheEnvironment } = require("../../packages/core/src/domain/DependencyCache");
  const env = cacheEnvironment("/work/proj/.harness/cache/", { PIP_CACHE_DIR: "/mine" });
  assert.equal(env.npm_config_cache, "/work/proj/.harness/cache/npm");
  assert.equal(env.YARN_CACHE_FOLDER, "/work/proj/.harness/cache/yarn");
  assert.equal(env.GOMODCACHE, "/work/proj/.harness/cache/go/mod");
  assert.equal(env.PIP_CACHE_DIR, undefined, "a variable the person set is left alone");
  assert.ok(!Object.values(env).some((v: unknown) => String(v).includes("node_modules")));
});

// ── REQ-590 ─────────────────────────────────────────────────────────────

test("REQ-590 SCN-590a: a run becomes a trace — the run, each requirement, each attempt and its agent", () => {
  const { runTrace, otlpTarget } = require("../../packages/core/src/domain/RunTrace");
  let n = 0;
  const ids = { hex: (bytes: number) => String(++n).padStart(bytes * 2, "0") };
  const trace = runTrace(
    {
      startedAt: "2026-11-16T10:00:00.000Z",
      finishedAt: "2026-11-16T10:10:00.000Z",
      baseRef: "main",
      results: [
        {
          requirement: "REQ-007",
          result: "pass",
          attempts: 2,
          durationMs: 300000,
          attemptLog: [
            {
              attempt: 1,
              endedAt: "gate",
              gateStage: "test command",
              agentMs: 100000,
              totalMs: 120000,
              usage: [{ profile: "claude", input: 1000, output: 200, cost: 0.4 }],
            },
            {
              attempt: 2,
              endedAt: "pass",
              agentMs: 90000,
              totalMs: 110000,
              usage: [{ profile: "claude", input: 800, output: 100, cost: 0.3 }],
            },
          ],
        },
      ],
    },
    ids
  );
  const spans = trace.resourceSpans[0].scopeSpans[0].spans;
  assert.deepEqual(
    spans.map((s: { name: string }) => s.name),
    ["harness run", "REQ-007", "attempt 1", "agent", "attempt 2", "agent"]
  );
  const [run, req, a1, agent1, a2] = spans;
  assert.equal(req.parentSpanId, run.spanId);
  assert.equal(a1.parentSpanId, req.spanId);
  assert.equal(agent1.parentSpanId, a1.spanId);
  assert.equal(a1.status.code, 2, "the failed attempt is an error");
  assert.equal(a1.status.message, "test command");
  assert.equal(a2.status.code, 1);
  assert.equal(a2.startTimeUnixNano, a1.endTimeUnixNano, "attempts follow each other");
  const cost = req.attributes.find((a: { key: string }) => a.key === "specgate.cost_usd");
  assert.ok(Math.abs(cost.value.doubleValue - 0.7) < 1e-9);
  assert.equal(new Set(spans.map((s: { traceId: string }) => s.traceId)).size, 1);

  assert.equal(otlpTarget({}), null, "nothing is sent without an endpoint");
  assert.deepEqual(
    otlpTarget({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318/",
      OTEL_EXPORTER_OTLP_HEADERS: "x-api-key=abc%3D,tenant=t1",
      OTEL_SERVICE_NAME: "ci-harness",
    }),
    {
      url: "http://collector:4318/v1/traces",
      headers: { "content-type": "application/json", "x-api-key": "abc=", tenant: "t1" },
      service: "ci-harness",
    }
  );
});

// ── wired into the run ──────────────────────────────────────────────────

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");
const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");

function project(config = "") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-extras-"));
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
  if (config) fs.appendFileSync(path.join(projectDir, "harness.config.yaml"), config);
  const git = (...args: string[]) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "harness-test@example.com");
  git("config", "user.name", "Harness Test");
  git("add", "-A");
  git("commit", "-qm", "seed");
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(
    agent,
    'require("node:fs").writeFileSync("src-fixture.js", "module.exports = 1;\\n");\n'
  );
  return { parent, projectDir, agent: `"${process.execPath}" "${agent}" {prompt_file}` };
}

function runAsync(
  args: string[],
  env = process.env
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d));
    child.stderr.on("data", (d: Buffer) => (out += d));
    child.on("close", (code: number | null) => resolve({ code, out }));
  });
}

test("REQ-588: the agent's command line goes into the container when sandbox: names one", () => {
  const { agentLine } = require("../../scripts/harness/run/gate");
  const plain = agentLine("claude -p < {prompt_file}", "/tmp/p.md", "/w/wt", {});
  assert.equal(plain, "claude -p < /tmp/p.md");
  const boxed = agentLine(
    "claude -p < {prompt_file}",
    "/tmp/p.md",
    "/w/wt",
    {
      sandbox: { image: "agent:1", network: "none", engine: "docker" },
      agentEnv: ["ANTHROPIC_API_KEY"],
    },
    { env: ["SPECGATE_REQ"], mounts: ["/w/proj/.harness/events"] }
  );
  assert.match(boxed, /^docker run --rm -i --network none /);
  assert.match(boxed, /-v \/tmp\/p\.md:\/tmp\/p\.md/);
  assert.match(
    boxed,
    /-e ANTHROPIC_API_KEY -e SPECGATE_REQ agent:1 sh -c 'claude -p < \/tmp\/p\.md'$/
  );
});

test("REQ-589 SCN-589b: with dependency_cache, the setup of each worktree uses the project's cache", () => {
  const p = project("dependency_cache: true\n");
  try {
    const seen = path.join(p.parent, "cache-seen.txt");
    const setup = path.join(p.parent, "setup.js");
    fs.writeFileSync(
      setup,
      `require("node:fs").writeFileSync(${JSON.stringify(seen)}, String(process.env.npm_config_cache));\n`
    );
    spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        p.projectDir,
        "--req",
        "REQ-000",
        "--agent",
        p.agent,
        "--max-attempts",
        "1",
        "--setup-cmd",
        `"${process.execPath}" "${setup}"`,
        "--skip-baseline",
      ],
      {
        encoding: "utf8",
        timeout: 180000,
        // `npm run` sets npm_config_cache itself; started as a person would, it is unset.
        env: Object.fromEntries(
          Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "npm_config_cache")
        ),
      }
    );
    const value = fs.readFileSync(seen, "utf8");
    assert.equal(
      fs.realpathSync.native(path.dirname(value)),
      fs.realpathSync.native(path.join(p.projectDir, ".harness", "cache")),
      value
    );
    assert.ok(value.endsWith("npm"));
    const status = spawnSync("git", ["status", "--porcelain"], {
      cwd: p.projectDir,
      encoding: "utf8",
    });
    assert.doesNotMatch(status.stdout, /\.harness\/cache/, "the cache is ignored by git");
  } finally {
    fs.rmSync(p.parent, { recursive: true, force: true });
  }
});

test("REQ-590 SCN-590b: a finished run is sent to the collector OTEL_EXPORTER_OTLP_ENDPOINT names", async () => {
  const p = project();
  const got: Array<{ url: string; body: string }> = [];
  const server = http.createServer((req: any, res: any) => {
    let body = "";
    req.on("data", (d: Buffer) => (body += d));
    req.on("end", () => {
      got.push({ url: req.url, body });
      res.writeHead(200);
      res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const { port } = server.address();
    const r = await runAsync(
      [
        "harness",
        "run",
        "--project-dir",
        p.projectDir,
        "--req",
        "REQ-000",
        "--agent",
        p.agent,
        "--max-attempts",
        "1",
        "--setup-cmd",
        "none",
        "--skip-baseline",
      ],
      {
        ...process.env,
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}`,
        OTEL_SERVICE_NAME: "test-harness",
      }
    );
    assert.equal(got.length, 1, r.out);
    assert.equal(got[0].url, "/v1/traces");
    const trace = JSON.parse(got[0].body);
    const names = trace.resourceSpans[0].scopeSpans[0].spans.map((s: { name: string }) => s.name);
    assert.ok(names.includes("harness run") && names.includes("REQ-000"), names.join(","));
    assert.match(r.out, /trace sent to http:\/\/127\.0\.0\.1/);
  } finally {
    server.close();
    fs.rmSync(p.parent, { recursive: true, force: true });
  }
});

test("REQ-591 SCN-591a: paused after a failed attempt, `harness continue --stop` ends it without a retry", async () => {
  const p = project();
  try {
    const run = runAsync([
      "harness",
      "run",
      "--project-dir",
      p.projectDir,
      "--req",
      "REQ-000",
      "--agent",
      p.agent,
      "--max-attempts",
      "3",
      "--setup-cmd",
      "none",
      "--skip-baseline",
      "--test-cmd",
      `"${process.execPath}" -e "process.exit(1)"`,
      "--pause-between-attempts",
      "--format",
      "json",
    ]);
    const paused = path.join(p.projectDir, ".harness", "events", "paused.json");
    const until = Date.now() + 120000;
    while (!fs.existsSync(paused) && Date.now() < until)
      await new Promise((r) => setTimeout(r, 200));
    assert.ok(fs.existsSync(paused), "the run paused");
    assert.equal(JSON.parse(fs.readFileSync(paused, "utf8")).attempt, 1);
    const answer = spawnSync(
      process.execPath,
      [CLI, "harness", "continue", "--stop", "--project-dir", p.projectDir, "--json"],
      { encoding: "utf8" }
    );
    assert.equal(answer.status, 0, answer.stdout + answer.stderr);
    assert.equal(JSON.parse(answer.stdout).pause.answer, "stop");
    const r = await run;
    const result = JSON.parse(r.out.slice(r.out.indexOf("{"))).results[0];
    assert.equal(result.result, "fail");
    assert.equal(result.attempts, 1, "no retry after --stop");
    const idle = spawnSync(
      process.execPath,
      [CLI, "harness", "continue", "--project-dir", p.projectDir, "--json"],
      { encoding: "utf8" }
    );
    assert.equal(JSON.parse(idle.stdout).status[0].code, "harness_not_paused");
  } finally {
    fs.rmSync(p.parent, { recursive: true, force: true });
  }
});
