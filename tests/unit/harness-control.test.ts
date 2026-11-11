/**
 * harness-control (REQ-490 … REQ-497): what specgate-studio needs to drive
 * `specgate harness run` from JSON alone — a run on a dirty tree, a stop after
 * the requirement in progress, an estimate per requirement, a question with
 * its id while the run goes on, and a stream of one JSON event per line.
 *
 * Every agent here is a small Node script: no real agent, nothing paid.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CLI_PATH, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";

/** A JSON document as parsed: its shape is what the assertions check. */
type Json = any;

const git = (dir: string, ...args: string[]) =>
  cp.spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** A scaffolded, committed project whose REQ-000 a one-file agent delivers. */
function project(): { parent: string; dir: string } {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-control-"));
  const init = runCli(["init", "--yes", "--out", parent, "--no-git", "--keep-matrix"]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  // The scaffold's template REQ-001 has no matrix row, which the gate refuses.
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .split("\n")
      .filter((l) => !l.includes("REQ-001"))
      .join("\n")
  );
  fs.writeFileSync(path.join(dir, "README.md"), "# Shop\n");
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "control@example.com");
  git(dir, "config", "user.name", "Control");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { parent, dir };
}

/** The same project with REQ-001 and REQ-002 beside REQ-000, each its own feature. */
function threeRequirements(): { parent: string; dir: string } {
  const p = project();
  const matrixPath = path.join(p.dir, "docs/specs/traceability.md");
  const matrix = fs.readFileSync(matrixPath, "utf8");
  const row = matrix.split("\n").find((l) => l.startsWith("| REQ-000"));
  assert.ok(row, "the scaffolded matrix has a REQ-000 row");
  const extra = ["001", "002"].map((n) =>
    row
      .replace("REQ-000", `REQ-${n}`)
      .replace("SCN-000", `SCN-${n}`)
      .replace("features/core/health.feature", `features/core/f${n}.feature`)
  );
  fs.writeFileSync(matrixPath, matrix.replace(row, [row, ...extra].join("\n")));
  const health = fs.readFileSync(path.join(p.dir, "features/core/health.feature"), "utf8");
  for (const n of ["001", "002"]) {
    fs.writeFileSync(
      path.join(p.dir, `features/core/f${n}.feature`),
      health.replace("@REQ-000 @SCN-000", `@REQ-${n} @SCN-${n}`)
    );
  }
  git(p.dir, "add", "-A");
  git(p.dir, "commit", "-qm", "three");
  return p;
}

let seq = 0;
/** An agent: a Node script, its body given; it always writes one file so it is not a no-op. */
function agent(parent: string, body: string[]): string {
  const file = path.join(parent, `agent-${(seq += 1)}.js`);
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const cp = require("node:child_process");',
      `const CLI = ${JSON.stringify(CLI_PATH)};`,
      'fs.writeFileSync(path.join(process.cwd(), `src-${process.env.SPECGATE_REQ}.ts`), "export const x = 1;\\n");',
      ...body,
      "",
    ].join("\n")
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

function harness(dir: string, agentCmd: string, extra: string[]) {
  return runCli(
    ["harness", "run", "--project-dir", dir, "--agent", agentCmd, "--max-attempts", "1", ...extra],
    { env: { ...process.env, NO_COLOR: "1", AGENT_EVENTS_FILE: "", AGENT_EVENTS_REQ: "" } }
  );
}

const parsed = (r: { stdout: string; stderr: string }): Json => {
  try {
    return JSON.parse(r.stdout) as Json;
  } catch {
    assert.fail(`not one JSON document:\n${r.stdout}\n--- stderr\n${r.stderr}`);
  }
};

const lines = (r: { stdout: string; stderr: string }): Json[] =>
  r.stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      try {
        return JSON.parse(l) as Json;
      } catch {
        return assert.fail(
          `a stdout line is not JSON: ${l.slice(0, 200)}\n--- stderr\n${r.stderr}`
        );
      }
    });

const cleanup = (parent: string) =>
  fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });

// ── REQ-490: --allow-dirty ──────────────────────────────────────────────────

test("REQ-490 SCN-490a: an uncommitted note stays out of the run, and the JSON says what was left out", () => {
  const p = project();
  try {
    fs.writeFileSync(path.join(p.dir, "notes.md"), "my notes\n");
    fs.writeFileSync(path.join(p.dir, "README.md"), "# Shop, edited\n");
    const r = harness(p.dir, agent(p.parent, []), [
      "--req",
      "REQ-000",
      "--allow-dirty",
      "--format",
      "json",
    ]);
    const doc = parsed(r);
    assert.equal(doc.results[0].result, "pass", r.stderr);
    assert.deepEqual(doc.dirty, { allowed: true, leftOut: ["README.md", "notes.md"] });
    const onBranch = git(p.dir, "ls-tree", "-r", "--name-only", "harness/REQ-000").stdout.split(
      "\n"
    );
    assert.ok(onBranch.includes("src-REQ-000.ts"), "the agent's work is on the branch");
    assert.ok(!onBranch.includes("notes.md"), "the untracked note is not");
    assert.equal(git(p.dir, "show", "harness/REQ-000:README.md").stdout, "# Shop\n");
    assert.equal(fs.readFileSync(path.join(p.dir, "notes.md"), "utf8"), "my notes\n");
    assert.equal(fs.readFileSync(path.join(p.dir, "README.md"), "utf8"), "# Shop, edited\n");
  } finally {
    cleanup(p.parent);
  }
});

test("REQ-490 SCN-490b: without --allow-dirty a dirty tree is refused naming the flag; with --chain it is refused", () => {
  const p = project();
  try {
    fs.writeFileSync(path.join(p.dir, "notes.md"), "my notes\n");
    const plain = harness(p.dir, agent(p.parent, []), ["--req", "REQ-000", "--format", "json"]);
    assert.notEqual(plain.status, 0);
    const refused = parsed(plain).status[0];
    assert.equal(refused.code, "harness_run_error");
    assert.match(String(refused.message), /--allow-dirty/);

    const chain = harness(p.dir, agent(p.parent, []), [
      "--req",
      "REQ-000",
      "--allow-dirty",
      "--chain",
      "--format",
      "json",
    ]);
    assert.notEqual(chain.status, 0);
    assert.match(String(parsed(chain).status[0].message), /--chain/);
    assert.equal(git(p.dir, "branch", "--list", "harness/*").stdout.trim(), "", "nothing ran");
  } finally {
    cleanup(p.parent);
  }
});

// ── REQ-491 / REQ-492: stop after the requirement in progress ───────────────

test("REQ-491 SCN-491a: `harness stop --after-current` during REQ-000 leaves REQ-001 and REQ-002 unattempted, and the JSON says it was asked", () => {
  const p = threeRequirements();
  try {
    const answer = path.join(p.parent, "stop-answer.json");
    const stopper = agent(p.parent, [
      'if (process.env.SPECGATE_REQ === "REQ-000") {',
      `  const r = cp.spawnSync(process.execPath, [CLI, "harness", "stop", "--after-current", "--json", "--project-dir", ${JSON.stringify(p.dir)}], { encoding: "utf8" });`,
      `  fs.writeFileSync(${JSON.stringify(answer)}, r.stdout);`,
      "}",
    ]);
    const r = harness(p.dir, stopper, [
      "--req",
      "REQ-000",
      "--req",
      "REQ-001",
      "--req",
      "REQ-002",
      "--skip-baseline",
      "--format",
      "json",
    ]);
    const stop = JSON.parse(fs.readFileSync(answer, "utf8"));
    assert.equal(stop.stop.requested, true);
    assert.equal(typeof stop.stop.run.pid, "number");
    assert.deepEqual(stop.stop.run.requirements, ["REQ-000", "REQ-001", "REQ-002"]);
    const doc = parsed(r);
    const byId = new Map<string, Json>(doc.results.map((x: Json) => [x.requirement, x]));
    assert.equal(byId.get("REQ-000").result, "pass", r.stderr);
    assert.equal(byId.get("REQ-001").result, "skipped");
    assert.equal(byId.get("REQ-002").result, "skipped");
    assert.deepEqual(doc.stopped, {
      by: "request",
      code: "stop_asked",
      reason: "a stop was asked",
      notAttempted: ["REQ-001", "REQ-002"],
    });
  } finally {
    cleanup(p.parent);
  }
});

test("REQ-491 SCN-491b: with no run there is nothing to stop; without --after-current it is a usage error", () => {
  const p = project();
  try {
    const r = runCli(["harness", "stop", "--after-current", "--json", "--project-dir", p.dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const doc = parsed(r);
    assert.deepEqual(doc.stop, { requested: false, run: null });
    assert.equal(doc.status[0].code, "harness_not_running");
    assert.equal(doc.status[0].severity, "warning");
    assert.equal(fs.existsSync(path.join(p.dir, ".harness", "events", "stop")), false);

    const bare = runCli(["harness", "stop", "--json", "--project-dir", p.dir]);
    assert.equal(bare.status, 2);
    assert.match(String(parsed(bare).status[0].fix), /--after-current/);
  } finally {
    cleanup(p.parent);
  }
});

test("REQ-492 SCN-492a: harnessStop(dir) answers what `harness stop --after-current --json` prints", async () => {
  const p = project();
  try {
    const events = path.join(p.dir, ".harness", "events");
    fs.mkdirSync(events, { recursive: true });
    const lock = path.join(events, "run.lock");
    // This test's own process stands for the run: it is alive.
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, started: 1, reqs: ["REQ-000"] }));
    const asked = await api.harnessStop(p.dir, { afterCurrent: true });
    assert.equal(asked.stop.requested, true);
    assert.deepEqual(asked.stop.run, { pid: process.pid, requirements: ["REQ-000"], startedAt: 1 });
    assert.ok(fs.existsSync(path.join(events, "stop")), "the stop request is written");

    fs.rmSync(lock);
    fs.rmSync(path.join(events, "stop"));
    const inProcess = await api.harnessStop(p.dir, { afterCurrent: true });
    const printed = parsed(
      runCli(["harness", "stop", "--after-current", "--json", "--project-dir", p.dir])
    );
    assert.deepEqual(inProcess, printed);
    assert.equal(inProcess.stop.requested, false);

    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "sg-control-empty-"));
    try {
      await assert.rejects(api.harnessStop(empty, { afterCurrent: true }), {
        code: "not_a_project",
      });
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  } finally {
    cleanup(p.parent);
  }
});

// ── REQ-493: an estimate per pending requirement ────────────────────────────

/** A feature for one requirement with `steps` steps in its one scenario. */
function feature(req: string, scn: string, steps: number): string {
  const kw = ["Given", "When", "Then"];
  return [
    `Feature: ${req}`,
    "",
    `  @${req} @${scn}`,
    `  Scenario: ${req} works`,
    ...Array.from({ length: steps }, (_, i) => `    ${kw[Math.min(i, 2)]} step ${i + 1}`),
    "",
  ].join("\n");
}

test("REQ-493 SCN-493a: plan --json estimates each pending requirement from its history, its size, or says there is nothing", () => {
  const p = threeRequirements();
  try {
    const w = (rel: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(p.dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(p.dir, rel), text);
    };
    w("features/core/health.feature", feature("REQ-000", "SCN-000", 3));
    w("features/core/f001.feature", feature("REQ-001", "SCN-001", 2));
    w("features/core/f002.feature", feature("REQ-002", "SCN-002", 6));
    w(
      ".harness/profiles.yaml",
      [
        "profiles:",
        "  fast:",
        '    agent: "x {prompt_file}"',
        "    cost_per_run_hint: 0.5",
        "",
      ].join("\n")
    );
    const attempt = (endedAt: string) => [{ attempt: 1, endedAt, profiles: ["fast"] }];
    w(
      ".harness/runs/2026-11-01T10-00-00-000Z.json",
      JSON.stringify({
        schemaVersion: 1,
        startedAt: "2026-11-01T10:00:00.000Z",
        finishedAt: "2026-11-01T10:03:00.000Z",
        maxAttempts: 1,
        results: [
          {
            requirement: "REQ-000",
            result: "pass",
            attempts: 1,
            durationMs: 60000,
            attemptLog: attempt("pass"),
          },
          {
            requirement: "REQ-001",
            result: "fail",
            attempts: 1,
            durationMs: 90000,
            attemptLog: attempt("gate"),
          },
        ],
      })
    );
    const doc = parsed(runCli(["plan", "--json", "--project-dir", p.dir]));
    const estimates: Json[] = doc.estimates;
    const of = (id: string): Json => estimates.find((e) => e.requirement === id);
    assert.deepEqual(
      estimates.map((e) => e.requirement),
      ["REQ-000", "REQ-001", "REQ-002"],
      "one per pending requirement"
    );
    assert.deepEqual(of("REQ-001").time, {
      ms: 90000,
      basis: "history",
      samples: 1,
      detail: of("REQ-001").time.detail,
    });
    assert.equal(of("REQ-001").cost.amount, 0.5);
    assert.equal(of("REQ-001").cost.basis, "history");
    assert.equal(of("REQ-002").steps, 6);
    assert.equal(of("REQ-002").time.ms, 120000);
    assert.equal(of("REQ-002").time.basis, "size");
    assert.equal(of("REQ-002").cost.amount, 1);
    assert.equal(of("REQ-002").cost.basis, "size");
    for (const e of estimates)
      assert.equal(typeof e.time.detail, "string", "it says its basis in words");

    fs.rmSync(path.join(p.dir, ".harness", "runs"), { recursive: true });
    const none = parsed(runCli(["plan", "--json", "--project-dir", p.dir])).estimates as Json[];
    for (const e of none) {
      assert.equal(e.time.ms, null);
      assert.equal(e.time.basis, "none");
      assert.equal(e.cost.amount, null);
      assert.equal(e.cost.basis, "none");
    }
    fs.rmSync(path.join(p.dir, ".harness", "profiles.yaml"));
    const unpriced = parsed(runCli(["plan", "--json", "--project-dir", p.dir])).estimates as Json[];
    assert.equal(unpriced[0].cost, null, "no profile declares a price: no cost at all");
  } finally {
    cleanup(p.parent);
  }
});

// ── REQ-494 / REQ-495: a question while the run goes on ─────────────────────

test("REQ-494 SCN-494a: the question is in the project, with its id, while the agent still runs", () => {
  const p = project();
  try {
    const seen = path.join(p.parent, "seen.txt");
    const asker = agent(p.parent, [
      'cp.spawnSync(process.execPath, [CLI, "ask", "REQ-000", "Which currency?"], { stdio: "ignore" });',
      "const until = Date.now() + 30000;",
      "let found = false;",
      "while (!found && Date.now() < until) {",
      `  const r = cp.spawnSync(process.execPath, [CLI, "questions", "--json", "--project-dir", ${JSON.stringify(p.dir)}], { encoding: "utf8" });`,
      '  try { found = JSON.parse(r.stdout).questions.open.some((q) => q.id === "Q1"); } catch {}',
      "}",
      `fs.writeFileSync(${JSON.stringify(seen)}, found ? "Q1" : "not seen");`,
    ]);
    const r = harness(p.dir, asker, ["--req", "REQ-000", "--format", "json"]);
    assert.equal(fs.readFileSync(seen, "utf8"), "Q1", r.stderr);
    const events = fs
      .readFileSync(path.join(p.dir, ".harness", "events", "REQ-000.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const asked = events.find((e) => e.type === "question" && e.id === "Q1");
    assert.ok(asked, JSON.stringify(events));
    assert.equal(asked.text, "Which currency?");
    assert.equal(typeof asked.file, "string");
    assert.equal(asked.change, "project");
    assert.match(git(p.dir, "log", "--format=%s").stdout, /REQ-000 needs clarification — Q1/);
    assert.equal(
      git(p.dir, "status", "--porcelain").stdout.trim(),
      "",
      "the question is committed"
    );
  } finally {
    cleanup(p.parent);
  }
});

test("REQ-495 SCN-495a: the requirement ends as a question, with waitingForAnswer naming Q1 and the command that answers it", () => {
  const p = project();
  try {
    const asker = agent(p.parent, [
      'cp.spawnSync(process.execPath, [CLI, "ask", "REQ-000", "Which currency?"], { stdio: "ignore" });',
    ]);
    const r = harness(p.dir, asker, [
      "--req",
      "REQ-000",
      "--max-attempts",
      "3",
      "--format",
      "json",
    ]);
    const one = parsed(r).results[0];
    assert.equal(one.result, "question", r.stderr);
    assert.equal(one.attempts, 1);
    assert.equal(one.waitingForAnswer.id, "Q1");
    assert.equal(one.waitingForAnswer.text, "Which currency?");
    assert.equal(one.waitingForAnswer.change, "project");
    assert.match(one.waitingForAnswer.answer, /^specgate answer Q1 /);
    assert.equal(typeof one.waitingForAnswer.file, "string");
    assert.equal(
      git(p.dir, "log", "--format=%s").stdout.match(/needs clarification — Q1/g)?.length,
      1,
      "recorded once, not again at the end of the run"
    );
  } finally {
    cleanup(p.parent);
  }
});

// ── REQ-496 / REQ-497: --format jsonl ───────────────────────────────────────

test("REQ-496 SCN-496a: --format jsonl writes one JSON event per line, from run-start to run-end", () => {
  const p = project();
  try {
    const talker = agent(p.parent, [
      'process.stdout.write("working on it\\n");',
      'fs.appendFileSync(process.env.AGENT_EVENTS_FILE, JSON.stringify({ t: Math.floor(Date.now() / 1000), req: process.env.AGENT_EVENTS_REQ, attempt: Number(process.env.AGENT_EVENTS_ATTEMPT), type: "usage", final: true, input: 10, output: 5, cost: 0.01 }) + "\\n");',
    ]);
    const r = harness(p.dir, talker, ["--req", "REQ-000", "--format", "jsonl"]);
    const events = lines(r);
    const types = events.map((e) => e.type);
    assert.equal(types[0], "run-start", types.join(" "));
    assert.equal(types[types.length - 1], "run-end");
    assert.equal(types.filter((t) => t === "run-end").length, 1);
    assert.deepEqual(events[0].queue, ["REQ-000"]);
    assert.ok(types.includes("attempt"));
    const start = types.indexOf("agent-start");
    const end = types.indexOf("agent-end");
    const said = events.findIndex(
      (e) => e.type === "output" && /working on it/.test(String(e.text))
    );
    assert.ok(start >= 0 && start < said && said < end, types.join(" "));
    assert.equal(events[said].req, "REQ-000");
    assert.equal(events[said].stream, "stdout");
    const usage = events.find((e) => e.type === "usage");
    assert.equal(usage && usage.cost, 0.01);
    assert.ok(types.includes("gate"));
    const result = events.find((e) => e.type === "result");
    assert.equal(result.req, "REQ-000");
    const report = events[events.length - 1].report;
    assert.equal(report.schemaVersion, 1);
    assert.deepEqual(report.results, [result.result]);
    assert.equal(result.result.result, "pass", r.stderr);
    // The events file keeps what it always had: no agent output in it.
    const file = fs.readFileSync(path.join(p.dir, ".harness", "events", "REQ-000.jsonl"), "utf8");
    assert.doesNotMatch(file, /working on it/);
    assert.doesNotMatch(file, /"type":"output"/);
  } finally {
    cleanup(p.parent);
  }
});

test("REQ-497 SCN-497a: with --concurrency 2 every worker's events reach stdout whole, and one run-end closes the run", () => {
  const p = threeRequirements();
  try {
    const long = agent(p.parent, ['process.stdout.write("x".repeat(70000) + "\\n");']);
    const r = harness(p.dir, long, [
      "--req",
      "REQ-001",
      "--req",
      "REQ-002",
      "--concurrency",
      "2",
      "--skip-baseline",
      "--format",
      "jsonl",
    ]);
    const events = lines(r);
    for (const req of ["REQ-001", "REQ-002"]) {
      assert.ok(
        events.some((e) => e.type === "output" && e.req === req),
        `${req} output streamed\n${r.stderr}`
      );
      const result = events.find((e) => e.type === "result" && e.req === req);
      assert.ok(result, `${req} has a result`);
      assert.equal(result.result.result, "pass", r.stderr);
    }
    const said = events
      .filter((e) => e.type === "output" && e.req === "REQ-001")
      .map((e) => String(e.text))
      .join("");
    assert.equal(said, `${"x".repeat(70000)}\n`, "the output arrives whole, in order");
    assert.equal(events.filter((e) => e.type === "run-end").length, 1);
    assert.equal(events[events.length - 1].type, "run-end");
  } finally {
    cleanup(p.parent);
  }
});
