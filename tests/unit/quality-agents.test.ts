"use strict";

/**
 * REQ-227 — the review and adversary agents as end checks: a verdict or a
 * broken test fails the attempt when the check gates, advises when it does
 * not, and neither agent may change the implementer's work.
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

/** A script agent: `body` is plain JavaScript run in the worktree. */
function agent(parent: string, name: string, body: string) {
  const file = path.join(parent, `${name}.js`);
  fs.writeFileSync(file, `const fs = require("fs");${NL}${body}${NL}`);
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

/** A project whose gate can go green, with these checks and profiles, committed. */
function project(checks: string[], profiles: Record<string, string>, testCmd = "") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qa-"));
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
  fs.mkdirSync(path.join(dir, ".harness"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".harness", "profiles.yaml"),
    [
      "profiles_version: 1",
      "profiles:",
      ...Object.entries(profiles).flatMap(([n, a]) => [
        `  ${n}:`,
        `    agent: ${JSON.stringify(a)}`,
      ]),
      "",
    ].join(NL)
  );
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    [
      "harness_version: 1",
      ...(testCmd ? [`test_cmd: ${JSON.stringify(testCmd)}`] : []),
      "checks:",
      ...checks,
      "",
    ].join(NL)
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  git("add", "-A");
  git("commit", "-qm", "chore: seed");
  return { parent, dir, git };
}

function harness(dir: string, implementer: string) {
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
      implementer,
      "--max-attempts",
      "1",
    ],
    { encoding: "utf8" }
  );
}

const implementerBody =
  'fs.mkdirSync("src",{recursive:true}); fs.writeFileSync("src/work.ts", "export const work = 1;\\n");';

test("REQ-227 SCN-227a: a reviewer's FAIL advises when the check does not gate, and its edits are undone", () => {
  const parent0 = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qa-agents-"));
  const reviewer = agent(
    parent0,
    "reviewer",
    'fs.writeFileSync("src/work.ts", "export const work = 2; // the reviewer edited this\\n"); fs.writeFileSync("src/review-note.ts", "x");' +
      'console.log("VERDICT: FAIL"); console.log("- src/work.ts:1 — work should be 3");'
  );
  const { parent, dir, git } = project(
    [
      "  - name: review",
      '    run: "builtin:review"',
      "    when: end",
      "    gate: false",
      "    profile: reviewer",
    ],
    { reviewer }
  );
  try {
    const r = harness(dir, agent(parent0, "implementer", implementerBody));
    assert.match(r.stdout + r.stderr, /1 passed · 0 failed/, r.stdout + r.stderr);
    const work = git("show", "harness/REQ-000:src/work.ts").stdout;
    assert.match(work, /work = 1/, "the implementer's work is what the branch carries");
    assert.notEqual(
      git("cat-file", "-e", "harness/REQ-000:src/review-note.ts").status,
      0,
      "the reviewer's file is gone"
    );
    const runs = path.join(dir, ".harness", "runs");
    const record = JSON.parse(
      fs.readFileSync(
        path.join(runs, fs.readdirSync(runs).filter((f: string) => f.endsWith(".json"))[0]),
        "utf8"
      )
    );
    const review = record.results[0].checks.find((c: { name: string }) => c.name === "review");
    assert.equal(review.ok, false, "the verdict is kept");
    assert.equal(review.gate, false);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10 });
    fs.rmSync(parent0, { recursive: true, force: true, maxRetries: 10 });
  }
});

test("REQ-227 SCN-227b: an adversary that breaks the tests fails the attempt when it gates, and leaves no trace", () => {
  const parent0 = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qa-agents-"));
  const adversary = agent(
    parent0,
    "adversary",
    'fs.writeFileSync("breaks.txt", "the adversary found a case");'
  );
  const checkScript = path.join(parent0, "tests.js");
  fs.writeFileSync(checkScript, 'process.exit(require("fs").existsSync("breaks.txt") ? 1 : 0);');
  const { parent, dir, git } = project(
    [
      "  - name: adversary",
      '    run: "builtin:adversary"',
      "    when: end",
      "    gate: true",
      "    profile: adversary",
    ],
    { adversary },
    `"${process.execPath}" "${checkScript}"`
  );
  try {
    const r = harness(dir, agent(parent0, "implementer", implementerBody));
    assert.match(
      r.stdout + r.stderr,
      /gate failed at quality check: adversary/,
      r.stdout + r.stderr
    );
    assert.notEqual(
      git("cat-file", "-e", "harness/REQ-000:breaks.txt").status,
      0,
      "the adversary's test is gone"
    );
    assert.match(
      git("show", "harness/REQ-000:src/work.ts").stdout,
      /work = 1/,
      "the work was kept for review"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10 });
    fs.rmSync(parent0, { recursive: true, force: true, maxRetries: 10 });
  }
});

test("REQ-227 SCN-227c: outside the harness an agent check is skipped, and says why", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-qa-"));
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      [
        "harness_version: 1",
        "checks:",
        "  - name: review",
        '    run: "builtin:review"',
        "    when: end",
        "",
      ].join(NL)
    );
    const r = spawnSync(process.execPath, [CLI, "quality", "run", "--json", "--project-dir", dir], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const o = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).quality.outcomes[0];
    assert.match(o.skipped, /inside the harness only/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  }
});
