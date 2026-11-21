/**
 * Characterisation of one requirement's attempts in `harness run`: what each
 * way an attempt can end is recorded as, how many attempts are spent, and what
 * the events file says, as the harness does it today. These pin behaviour
 * while `attemptRequirement` is taken apart; a change here is a change of
 * behaviour and needs its own requirement.
 */
import { test, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

const made: string[] = [];
after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const git = (dir: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}\n${r.stdout}${r.stderr}`);
  return r.stdout;
};

/** What the scripted agent does on one attempt. */
type Move = "implement" | "break" | "nothing" | "exit" | "sleep" | "scenario";

/** A project with one requirement, REQ-001, and a gate that fails while `BREAK` exists. */
function fixture(moves: Move[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-attempt-"));
  made.push(root);
  const dir = path.join(root, "project");
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## REQ-001 — Health endpoint\n\nExpose a health check.\n");
  w("AI_RULES.md", "# AI Rules\n\nStack: Node 20.\n");
  w("README.md", "# Fixture\n");
  w("docs/specs/adr/README.md", "# ADRs\n");
  w(
    "features/health.feature",
    "Feature: Health\n  Scenario: The health endpoint reports the service as up\n    Given the service is up\n    When a client requests /health\n    Then /health returns 200\n"
  );
  w(
    "docs/specs/traceability.md",
    [
      "# Traceability Matrix",
      "",
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
      "|---|---|---|---|---|---|---|---|---|---|",
      "| REQ-001 | SCN-001 | `features/health.feature` | UC-001 | CMD-001 | AGG-001 | EVT-001 | `src/health.js` | `test/health.test.js` | Draft |",
      "",
    ].join("\n")
  );
  git(dir, "init", "-q", "--initial-branch=main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "initial");

  const agent = path.join(root, "agent.js");
  fs.writeFileSync(
    agent,
    [
      "const fs = require('node:fs');",
      `const moves = ${JSON.stringify(moves)};`,
      "const move = moves[Math.min(Number(process.env.SPECGATE_ATTEMPT) - 1, moves.length - 1)];",
      "const write = (rel, text) => { fs.mkdirSync(require('node:path').dirname(rel), { recursive: true }); fs.writeFileSync(rel, text); };",
      "const implement = () => { write('test/health.test.js', '// REQ-001\\n'); write('src/health.js', '// health\\n'); };",
      "if (move === 'implement') { implement(); fs.rmSync('BREAK', { force: true }); }",
      "if (move === 'break') { implement(); write('BREAK', 'x'); }",
      "if (move === 'scenario') { implement(); fs.appendFileSync('features/health.feature', '    And nothing else\\n'); }",
      "if (move === 'exit') { console.error('the agent broke'); process.exit(3); }",
      "if (move === 'sleep') { const until = Date.now() + 20000; while (Date.now() < until) {} }",
      "",
    ].join("\n")
  );
  const gate = path.join(root, "gate.js");
  fs.writeFileSync(gate, "process.exit(require('node:fs').existsSync('BREAK') ? 1 : 0);\n");
  return {
    dir,
    agent: `node "${agent}" {prompt_file}`,
    gate: `node "${gate}"`,
  };
}

interface Attempt {
  attempt: number;
  endedAt: string;
  gateStage?: string;
}

function run(moves: Move[], ...extra: string[]) {
  const f = fixture(moves);
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      f.dir,
      "--agent",
      f.agent,
      "--test-cmd",
      f.gate,
      "--format",
      "json",
      ...extra,
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  const report = JSON.parse(r.stdout);
  const result = report.results[0];
  const events = fs
    .readFileSync(path.join(f.dir, ".harness", "events", "REQ-001.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  return {
    ...f,
    status: r.status,
    result,
    ended: (result.attemptLog as Attempt[]).map((a) =>
      a.gateStage ? `${a.endedAt}@${a.gateStage}` : a.endedAt
    ),
    /** `attempt` events only: where each started and how it ended. */
    attemptEvents: events
      .filter((e) => e.type === "attempt")
      .map((e) => [e.attempt, e.state, e.result, e.stage].filter((x) => x !== undefined).join(" ")),
    branchSubject: () => git(f.dir, "log", "-1", "--format=%s", "harness/REQ-001").trim(),
    branchFiles: () =>
      git(f.dir, "diff", "--name-only", "main...harness/REQ-001").trim().split("\n").sort(),
  };
}

const PASSED = "feat(REQ-001): implement via specgate harness";
const FAILED = "chore(REQ-001): attempt FAILED the gate — do not merge as is";
const prompts = (files: string[]) =>
  files.filter((f) => f.startsWith(".specops/harness-prompts/")).length;
const work = (files: string[]) => files.filter((f) => !f.startsWith(".specops/"));

test("an attempt that passes the gate ends as pass, on a branch with one commit", () => {
  const r = run(["implement"]);
  assert.equal(r.status, 0);
  assert.equal(r.result.result, "pass");
  assert.equal(r.result.attempts, 1);
  assert.deepEqual(r.ended, ["pass"]);
  assert.deepEqual(r.attemptEvents, ["1 start", "1 end pass"]);
  assert.equal(r.branchSubject(), PASSED);
  assert.deepEqual(work(r.branchFiles()), [
    "docs/specs/traceability.md",
    "src/health.js",
    "test/health.test.js",
  ]);
  assert.equal(prompts(r.branchFiles()), 1);
  assert.equal(r.result.error, undefined);
  assert.equal(r.result.workPreserved, undefined);
});

test("a red gate is retried, and the attempt that passes is the one committed", () => {
  const r = run(["break", "implement"], "--max-attempts", "3");
  assert.equal(r.status, 0);
  assert.equal(r.result.result, "pass");
  assert.equal(r.result.attempts, 2);
  assert.deepEqual(r.ended, [`gate@test command: ${r.gate}`, "pass"]);
  assert.deepEqual(r.attemptEvents, ["1 start", "1 end fail gate", "2 start", "2 end pass"]);
  assert.equal(r.branchSubject(), PASSED);
  // The second attempt works on what the first left; both prompts are kept.
  assert.deepEqual(work(r.branchFiles()), [
    "docs/specs/traceability.md",
    "src/health.js",
    "test/health.test.js",
  ]);
  assert.equal(prompts(r.branchFiles()), 2);
});

test("every attempt red: the requirement fails and what was written is kept on the branch", () => {
  const r = run(["break"], "--max-attempts", "2");
  assert.equal(r.status, 1);
  assert.equal(r.result.result, "fail");
  assert.equal(r.result.attempts, 2);
  assert.deepEqual(r.ended, [`gate@test command: ${r.gate}`, `gate@test command: ${r.gate}`]);
  assert.deepEqual(r.attemptEvents, ["1 start", "1 end fail gate", "2 start", "2 end fail gate"]);
  assert.equal(r.result.error, `Gate failed at: test command: ${r.gate}\n\n`);
  assert.equal(r.result.workPreserved, true);
  assert.equal(r.branchSubject(), FAILED);
  // Not marked in the matrix: `done` never ran.
  assert.deepEqual(work(r.branchFiles()), ["BREAK", "src/health.js", "test/health.test.js"]);
});

test("an agent that exits non-zero is an agent-error, retried to the last attempt", () => {
  const r = run(["exit"], "--max-attempts", "2");
  assert.equal(r.status, 1);
  assert.equal(r.result.result, "fail");
  assert.equal(r.result.attempts, 2);
  assert.deepEqual(r.ended, ["agent-error", "agent-error"]);
  assert.deepEqual(r.attemptEvents, [
    "1 start",
    "1 end fail agent-error",
    "2 start",
    "2 end fail agent-error",
  ]);
  assert.match(r.result.error, /^Agent exited 3\.\r?\nthe agent broke/);
  // As today: the prompts alone are committed, and that counts as preserved work.
  assert.equal(r.result.workPreserved, true);
  assert.equal(r.branchSubject(), FAILED);
  assert.deepEqual(work(r.branchFiles()), []);
});

test("an agent past its time is an agent-timeout, and the next attempt may pass", () => {
  const r = run(["sleep", "implement"], "--max-attempts", "2", "--timeout", "2");
  assert.equal(r.status, 0);
  assert.equal(r.result.result, "pass");
  assert.equal(r.result.attempts, 2);
  assert.deepEqual(r.ended, ["agent-timeout", "pass"]);
  assert.deepEqual(r.attemptEvents, [
    "1 start",
    "1 end fail agent-timeout",
    "2 start",
    "2 end pass",
  ]);
  assert.equal(r.branchSubject(), PASSED);
});

test("an agent that writes nothing is a no-op, and is not run again", () => {
  const r = run(["nothing"], "--max-attempts", "3");
  assert.equal(r.status, 1);
  assert.equal(r.result.result, "fail");
  assert.equal(r.result.attempts, 1);
  assert.deepEqual(r.ended, ["no-op"]);
  assert.deepEqual(r.attemptEvents, ["1 start", "1 end fail no-op"]);
  assert.match(r.result.error, /^You produced no files\./);
  assert.match(r.result.error, /docs\/agent-setup\.md/);
  assert.equal(r.result.workPreserved, true);
  assert.equal(r.branchSubject(), FAILED);
});

test("an agent that edits the scenario is stopped at write-scope, before the gate", () => {
  const r = run(["scenario", "implement"], "--max-attempts", "2");
  assert.equal(r.status, 1);
  assert.equal(r.result.result, "fail");
  assert.equal(r.result.attempts, 2);
  // As today: the edit stays in the worktree, so the second attempt meets it again.
  assert.deepEqual(r.ended, ["write-scope", "write-scope"]);
  assert.deepEqual(r.attemptEvents, [
    "1 start",
    "1 end fail write-scope",
    "2 start",
    "2 end fail write-scope",
  ]);
  assert.match(r.result.error, /^agent_touched_protected_path/);
  assert.match(r.result.error, /features\/health\.feature/);
  assert.equal(r.branchSubject(), FAILED);
  assert.ok(r.branchFiles().includes("features/health.feature"));
});
