"use strict";

/**
 * REQ-220, REQ-221, REQ-228 — the quality checks inside the harness: run in
 * each attempt's gate after the tests, their failure fed to the agent's next
 * attempt, the end checks after the attempt ones, and the outcomes kept in
 * the run record.
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

/** A project whose gate can go green, with these checks, committed. */
function project(checks: string[]) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qh-"));
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
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    ["harness_version: 1", "checks:", ...checks, ""].join(NL)
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  git("add", "-A");
  git("commit", "-qm", "chore: seed");
  return { parent, dir };
}

/**
 * An agent that writes src/work.ts; and src/ok.ts too once its prompt says
 * the marker check failed — the way a real agent reads the gate's feedback.
 */
function learningAgent(parent: string) {
  const file = path.join(parent, "agent.js");
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      "const prompt = fs.readFileSync(process.argv[2], 'utf8');",
      'fs.mkdirSync("src", { recursive: true });',
      'fs.writeFileSync("src/work.ts", "export const work = 1;" + String.fromCharCode(10));',
      "if (prompt.includes('quality check: marker') && prompt.includes('no src/ok.ts yet'))",
      '  fs.writeFileSync("src/ok.ts", "export const ok = true;" + String.fromCharCode(10));',
      "",
    ].join(NL)
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

const marker = [
  "  - name: marker",
  `    run: "node -e \\"if(!require('fs').existsSync('src/ok.ts')){console.log('no src/ok.ts yet');process.exit(1)}\\""`,
  "    runner: local",
];
const endCheck = ["  - name: final", '    run: "node -e 0"', "    runner: local", "    when: end"];

function harness(dir: string, agent: string, attempts: number) {
  return spawnSync(
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
      agent,
      "--max-attempts",
      String(attempts),
    ],
    { encoding: "utf8" }
  );
}

test("REQ-220 SCN-220a: a failing check fails the attempt, and its output reaches the next one", () => {
  const { parent, dir } = project([...marker, ...endCheck]);
  try {
    const once = harness(dir, learningAgent(parent), 1);
    assert.match(once.stdout + once.stderr, /gate failed at quality check: marker/);
    assert.match(once.stdout + once.stderr, /0 passed · 1 failed/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10 });
  }
});

test("REQ-220 SCN-220b, REQ-221 SCN-221a, REQ-228 SCN-228a: the agent fixes it; end checks run after; the record keeps them", () => {
  const { parent, dir } = project([...marker, ...endCheck]);
  try {
    const r = harness(dir, learningAgent(parent), 2);
    assert.match(r.stdout + r.stderr, /1 passed · 0 failed/, r.stdout + r.stderr);
    const runs = path.join(dir, ".harness", "runs");
    const record = JSON.parse(
      fs.readFileSync(
        path.join(runs, fs.readdirSync(runs).filter((f: string) => f.endsWith(".json"))[0]),
        "utf8"
      )
    );
    const result = record.results.find((x: { requirement: string }) => x.requirement === "REQ-000");
    assert.equal(result.attempts, 2, "the second attempt read the check's output and passed");
    assert.deepEqual(
      result.checks.map((c: { name: string; when: string; ok: boolean }) => [c.name, c.when, c.ok]),
      [
        ["marker", "attempt", true],
        ["final", "end", true],
      ]
    );
    assert.ok(
      result.checks.every((c: { output?: string }) => c.output === undefined),
      "no output in the record"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10 });
  }
});
