/**
 * studio-phase3-json: the run ledger records the tokens each agent step
 * reported, and `harness report --json` gives, per profile, the cost measured
 * from them beside the estimate (REQ-509).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { costByProfile } from "../../packages/core/src/domain/RunBudget";
import { stepUsage } from "../../packages/core/src/domain/HarnessRun";
import { cliJson, git, newProject, removeProject, write } from "../helpers/project";
import { runCli } from "../helpers/cli";

const PROFILES =
  "profiles:\n" +
  "  fast:\n" +
  '    agent: "fast-agent {prompt_file}"\n' +
  "    price_per_input_token: 0.000001\n" +
  "    price_per_output_token: 0.000005\n" +
  "  cheap:\n" +
  '    agent: "cheap-agent {prompt_file}"\n' +
  "    cost_per_run_hint: 0.2\n";

test("REQ-509 SCN-509a: fast is measured from its tokens, cheap only estimated from its hint", () => {
  const dir = newProject("sg-cost-");
  try {
    write(dir, ".harness/profiles.yaml", PROFILES);
    write(
      dir,
      ".harness/runs/2026-11-11T10-00-00.json",
      JSON.stringify({
        startedAt: "2026-11-11T10:00:00.000Z",
        finishedAt: "2026-11-11T10:05:00.000Z",
        maxAttempts: 2,
        results: [
          {
            requirement: "REQ-000",
            result: "pass",
            attempts: 2,
            durationMs: 1000,
            attemptLog: [
              { attempt: 1, endedAt: "gate", agentMs: 1, totalMs: 1, profiles: ["cheap"] },
              {
                attempt: 2,
                endedAt: "pass",
                agentMs: 1,
                totalMs: 1,
                profiles: ["fast"],
                usage: [{ profile: "fast", input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 }],
              },
            ],
          },
        ],
      })
    );
    const { status, doc } = cliJson(dir, "harness", "report");
    assert.equal(status, 0, JSON.stringify(doc));
    const of = (p: string) =>
      doc.report.costByProfile.find((x: { profile: string }) => x.profile === p);
    assert.equal(of("fast").measured, 0.002);
    assert.equal(of("fast").basis, "measured");
    assert.deepEqual(of("fast").tokens, { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 });
    assert.equal(of("cheap").estimated, 0.2);
    assert.equal(of("cheap").measured, null);
    assert.equal(of("cheap").basis, "estimated");
    assert.deepEqual(doc.report.measuredCost, { total: 0.002, covered: 1, uncovered: 1 });
  } finally {
    removeProject(dir);
  }
});

test("REQ-509: cache tokens cost the input price unless the profile says; no tokens and no prices is neither", () => {
  const { byProfile, measured } = costByProfile(
    [["fast"], ["fast"], ["agent"]],
    [[{ profile: "fast", input: 10, output: 1, cacheRead: 100, cacheWrite: 0 }], [], []],
    {},
    { fast: { input: 0.01, output: 0.1, cacheRead: 0.001, cacheWrite: 0.01 } }
  );
  const fast = byProfile.find((p) => p.profile === "fast");
  assert.equal(fast?.attempts, 2);
  assert.equal(fast?.measuredAttempts, 1);
  assert.equal(fast?.measured, 0.3);
  assert.equal(byProfile.find((p) => p.profile === "agent")?.basis, null);
  assert.deepEqual(measured, { total: 0.3, covered: 1, uncovered: 2 });

  // The last final usage line of the attempt; other attempts and partial lines ignored.
  const lines = [
    '{"type":"usage","context":5,"output":1}',
    '{"type":"usage","final":true,"attempt":1,"input":1,"output":1}',
    '{"type":"usage","final":true,"attempt":2,"input":7,"output":3,"cacheRead":2}',
    "not json",
  ];
  assert.deepEqual(stepUsage(lines, 2, "fast"), {
    profile: "fast",
    input: 7,
    output: 3,
    cacheRead: 2,
    cacheWrite: 0,
  });
  assert.equal(stepUsage(lines.slice(0, 1), 1, "fast"), null);
});

test("REQ-509: harness run records the tokens the agent's stream reported, under the profile it ran as", () => {
  const dir = newProject("sg-cost-run-");
  try {
    const agent = path.join(path.dirname(dir), "agent.js");
    fs.writeFileSync(
      agent,
      [
        'const fs = require("node:fs");',
        "fs.appendFileSync(process.env.AGENT_EVENTS_FILE, JSON.stringify({",
        '  type: "usage", final: true, attempt: Number(process.env.SPECGATE_ATTEMPT),',
        "  input: 1000, output: 200, cacheRead: 0, cacheWrite: 0,",
        '}) + "\\n");',
        'fs.writeFileSync("written.js", "// REQ-000\\n");',
        "",
      ].join("\n")
    );
    write(
      dir,
      ".harness/profiles.yaml",
      "profiles:\n  fast:\n" +
        `    agent: '"${process.execPath}" "${agent}" {prompt_file}'\n` +
        "    price_per_input_token: 0.000001\n    price_per_output_token: 0.000005\n"
    );
    assert.equal(git(dir, "init", "-q").status, 0);
    git(dir, "config", "user.email", "t@t");
    git(dir, "config", "user.name", "t");
    git(dir, "add", "-A");
    assert.equal(git(dir, "commit", "-qm", "seed").status, 0);

    const r = runCli([
      "harness",
      "run",
      "--project-dir",
      dir,
      "--req",
      "REQ-000",
      "--profile",
      "fast",
      "--max-attempts",
      "1",
      "--setup-cmd",
      "none",
    ]);
    const runs = path.join(dir, ".harness", "runs");
    assert.ok(fs.existsSync(runs), r.stdout + r.stderr);
    const ledger = fs.readdirSync(runs).filter((f) => f.endsWith(".json"));
    assert.equal(ledger.length, 1, r.stdout + r.stderr);
    const record = JSON.parse(fs.readFileSync(path.join(runs, ledger[0]), "utf8"));
    const attempt = record.results[0].attemptLog[0];
    assert.deepEqual(attempt.profiles, ["fast"]);
    assert.deepEqual(attempt.usage, [
      { profile: "fast", input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 },
    ]);
    const fast = cliJson(dir, "harness", "report").doc.report.costByProfile[0];
    assert.equal(fast.profile, "fast");
    assert.equal(fast.measured, 0.002);
  } finally {
    removeProject(dir);
  }
});
