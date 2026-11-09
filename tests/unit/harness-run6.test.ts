"use strict";

/**
 * REQ-264, REQ-268, REQ-269, REQ-271 — what the sixth truck-flote run lost to
 * the harness itself: an agent that could not write, a reviewer told the
 * requirement had no text, a report that counted one requirement twice, and an
 * agent nobody could keep (truck-flote S50, S53, S55, S58).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { withAgentPermission } = require("../../scripts/lib/agent-permission");
const { promptInFlight } = require("../../scripts/cli/commands/harness/RunCommand");
const { buildPrompt } = require("../../scripts/harness/prompt");
const { summariseRuns } = require("../../packages/core/src/domain/HarnessReport");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp(prefix = "specgate-run6-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

/** A project `harness run` can gate green: `specgate init`, its REQ-000 left to do. */
function greenable() {
  const parent = tmp("specgate-run6-green-");
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
  git(dir, "init", "-q");
  // The harness refuses a repository with no identity; CI has none globally.
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { parent, dir };
}

/** An agent: a Node script writing `writes` in its working directory. */
function agent(parent: string, writes: Array<[string, string]>, sleepMs = 0) {
  const file = path.join(parent, `agent-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      'const p = require("node:path");',
      `for (const [rel, content] of ${JSON.stringify(writes)}) {`,
      "  fs.mkdirSync(p.dirname(p.join(process.cwd(), rel)), { recursive: true });",
      "  fs.writeFileSync(p.join(process.cwd(), rel), content);",
      "}",
      sleepMs ? `const until = Date.now() + ${sleepMs}; while (Date.now() < until) {}` : "",
      "",
    ].join("\n")
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

/** A project whose REQ-005 is written only in the open change `draft-flota`. */
function withDraft() {
  const dir = tmp();
  w(dir, "spec.md", "# Spec\n\n## Requirements\n");
  w(dir, "docs/specs/traceability.md", "# Traceability\n");
  w(
    dir,
    "docs/specs/changes/draft-flota/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-10-28\nrigor: lite\nskip_specs: false\nretire_capabilities: false\n"
  );
  w(
    dir,
    "docs/specs/changes/draft-flota/proposal.md",
    "# Proposal: draft-flota\n\n## Intent\n\nThe fleet.\n"
  );
  w(dir, "docs/specs/changes/draft-flota/tasks.md", "# Tasks\n\n- [ ] 1.1 REQ-005\n");
  w(
    dir,
    "docs/specs/changes/draft-flota/specs/flota/spec.md",
    [
      "# Delta — flota",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-005 — Vehículo frigorífico",
      "",
      "The system SHALL let the Despachador mark a vehicle as frigorífico.",
      "",
      "#### Scenario: SCN-005 — Marcar un frigorífico",
      "",
      '- GIVEN the vehicle "1234-BCD" is not frigorífico',
      '- WHEN the Despachador ticks "Frigorífico"',
      '- THEN they see the label "Frigorífico" next to "1234-BCD"',
      "",
      "<!-- specgate:trace actor=Despachador kind=functional -->",
      "",
    ].join("\n")
  );
  git(dir, "init", "-q");
  // The harness refuses a repository with no identity; CI has none globally.
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return dir;
}

// ── REQ-264 ─────────────────────────────────────────────────────────────────

test("REQ-264 SCN-264a: the documented Claude Code command", () => {
  const piped = "claude -p < {prompt_file} | specgate harness events --from claude";
  assert.deepEqual(withAgentPermission(piped), {
    command:
      "claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude",
    added: true,
  });
  assert.equal(withAgentPermission("claude --print < {prompt_file}").added, true);
  for (const own of [
    "claude -p --allowedTools Read Write < {prompt_file}",
    "claude -p --permission-mode plan < {prompt_file}",
    "claude -p --dangerously-skip-permissions < {prompt_file}",
    "aider --yes --message-file {prompt_file}",
    "claude < {prompt_file}",
  ]) {
    assert.deepEqual(withAgentPermission(own), { command: own, added: false }, own);
  }
});

test("REQ-264 SCN-264b: an agent that writes nothing", () => {
  const { parent, dir } = greenable();
  const idle = agent(parent, []);
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
      idle,
      "--max-attempts",
      "3",
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  const out = r.stdout + r.stderr;
  assert.match(out, /attempt 1\/3/, out);
  assert.doesNotMatch(
    out,
    /attempt 2\/3/,
    "the same command cannot write anything the second time"
  );
  assert.match(out, /produced no files/);
  assert.match(out, /docs\/agent-setup\.md/);
  assert.doesNotMatch(out, /docs\/automation\.md/);
});

// ── REQ-268 ─────────────────────────────────────────────────────────────────

test("REQ-268 SCN-268a: the review of a draft's requirement", () => {
  const dir = withDraft();
  const req = { requirement: "REQ-005", category: "NEEDS_EVERYTHING" };
  // What the reviewer was given before: the project as written, without the draft.
  assert.match(buildPrompt(req, dir, {}), /has no `## REQ-005` section/);
  const prompt = promptInFlight(req, dir, { hint: "Review only; change no file." });
  assert.match(prompt, /mark a vehicle as frigorífico/);
  assert.doesNotMatch(prompt, /has no `## REQ-005` section/);
});

// ── REQ-269 ─────────────────────────────────────────────────────────────────

test("REQ-269 SCN-269a: a failed run, then a passing one", () => {
  const min = 60_000;
  const s = summariseRuns([
    {
      startedAt: "2026-10-28T19:45:22.596Z",
      finishedAt: "2026-10-28T19:52:54.000Z",
      maxAttempts: 3,
      results: [
        {
          requirement: "REQ-002",
          result: "fail",
          attempts: 3,
          durationMs: 7 * min,
          attemptLog: [1, 2, 3].map((attempt) => ({ attempt, endedAt: "no-op" })),
        },
      ],
    },
    {
      startedAt: "2026-10-28T20:23:32.064Z",
      finishedAt: "2026-10-28T20:35:02.000Z",
      maxAttempts: 3,
      results: [
        {
          requirement: "REQ-002",
          result: "pass",
          attempts: 2,
          durationMs: 11 * min,
          attemptLog: [
            { attempt: 1, endedAt: "gate" },
            { attempt: 2, endedAt: "pass" },
          ],
        },
      ],
    },
  ]);
  assert.equal(s.requirementsAttempted, 1);
  assert.equal(s.passed, 1);
  assert.equal(s.failed, 0);
  assert.deepEqual(s.exhausted, []);
  assert.equal(s.msPerDelivered, 18 * min, "the cost keeps the failed run");
  assert.equal(s.firstAttemptPasses, 0);
});

test("REQ-269 SCN-269b: a run stopped by hand", async () => {
  const { parent, dir } = greenable();
  const slow = agent(parent, [["src/slow.ts", "export const slow = 1;\n"]], 20_000);
  const child = spawn(
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
      slow,
      "--max-attempts",
      "1",
    ],
    { stdio: "ignore", env: { ...process.env, NO_COLOR: "1" } }
  );
  const runs = path.join(dir, ".harness", "runs");
  const started = Date.now();
  // The ledger is written when the requirement starts, before the agent does.
  while (Date.now() - started < 15_000) {
    const files = fs.existsSync(runs)
      ? fs.readdirSync(runs).filter((f: string) => f.endsWith(".json"))
      : [];
    if (files.length > 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill("SIGKILL");
  await new Promise((r) => child.once("exit", r));
  const report = sg(dir, "harness", "report");
  assert.match(report.stdout, /REQ-000/, report.stdout + report.stderr);
  assert.match(report.stdout, /stopped/, report.stdout);
});

// ── REQ-271 ─────────────────────────────────────────────────────────────────

test("REQ-271 SCN-271a: setting the agent once", () => {
  const { dir } = greenable();
  const before = sg(dir, "status");
  assert.match(before.stdout, /specgate config set agent/, before.stdout);
  const set = sg(dir, "config", "set", "agent", "claude -p < {prompt_file}");
  assert.equal(set.status, 0, set.stdout + set.stderr);
  const config = fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
  // REQ-271 (modified by REQ-278): kept with the permission, and streamed for /live.
  assert.match(config, /^agent: "claude .*--permission-mode acceptEdits -p < \{prompt_file\}.*"$/m);
  assert.doesNotMatch(sg(dir, "status").stdout, /specgate config set agent/);
});
