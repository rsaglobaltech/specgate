"use strict";

/**
 * REQ-234 — commit messages follow Conventional Commits 1.0.0: the grammar,
 * the built-in check on a branch, and the messages Specgate writes itself.
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

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const { parseCommit } = require("../../packages/core/src/domain/ConventionalCommit");

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

test("REQ-234 SCN-234a: a message without a type fails the check, named", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-commits-"));
  madeDirs.push(dir);
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    ["harness_version: 1", "checks:", "  - name: commits", '    run: "builtin:commits"', ""].join(
      NL
    )
  );
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: start");
  git(dir, "checkout", "-q", "-b", "feature");
  fs.writeFileSync(path.join(dir, "a.txt"), "a" + NL);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat(REQ-007): book a slot");
  fs.writeFileSync(path.join(dir, "b.txt"), "b" + NL);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Update stuff");
  // A merge commit is git's, not the person's: left out.
  git(dir, "checkout", "-q", "main");
  git(dir, "checkout", "-q", "-b", "side");
  fs.writeFileSync(path.join(dir, "c.txt"), "c" + NL);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: side");
  git(dir, "checkout", "-q", "feature");
  git(dir, "merge", "-q", "--no-ff", "side", "-m", "Merge branch 'side' into feature");

  const r = spawnSync(process.execPath, [CLI, "quality", "run", "--json", "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "main" },
  });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  const commits = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).quality.outcomes[0];
  assert.equal(commits.name, "commits");
  assert.equal(commits.ok, false);
  assert.equal(commits.runner, "local");
});

test("REQ-234 SCN-234a: the failure names the commit by hash and subject", () => {
  const { commitsOutcome } = require("../../scripts/lib/quality-run");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-commits-"));
  madeDirs.push(dir);
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "commit", "-q", "--allow-empty", "-m", "chore: start");
  const base = git(dir, "rev-parse", "HEAD").stdout.trim();
  git(dir, "commit", "-q", "--allow-empty", "-m", "feat(REQ-007): book a slot");
  git(dir, "commit", "-q", "--allow-empty", "-m", "Update stuff");
  const hash = git(dir, "log", "-1", "--format=%h").stdout.trim();
  const o = commitsOutcome(dir, base, { diffCoverage: null, mutationScore: null });
  assert.equal(o.ok, false);
  assert.equal(o.checked, 2);
  assert.match(o.output, new RegExp(`${hash} "Update stuff": no type`));
  assert.doesNotMatch(o.output, /book a slot/);
  // A team that uses another type says so once.
  git(dir, "commit", "-q", "--allow-empty", "-m", "wip: halfway");
  const typed = commitsOutcome(dir, base, {
    diffCoverage: null,
    mutationScore: null,
    commitTypes: ["wip"],
  });
  assert.doesNotMatch(typed.output, /halfway/);
});

test("REQ-234 SCN-234b: the grammar's rules", () => {
  assert.deepEqual(parseCommit("feat: x").problems, []);
  const breaking = parseCommit("fix(api)!: y");
  assert.deepEqual(breaking.problems, []);
  assert.equal(breaking.breaking, true);
  assert.equal(breaking.scope, "api");
  assert.match(parseCommit("feat:no space").problems[0], /followed by a space/);
  assert.match(parseCommit("feature: z").problems[0], /"feature" is not one of the types/);
  assert.match(parseCommit("feat(): w").problems[0], /empty scope/);
  assert.match(
    parseCommit(["feat: x", "a body without a blank line"].join(NL)).problems[0],
    /blank line/
  );
  assert.match(
    parseCommit(["feat: x", "", "body", "", "breaking change: v"].join(NL)).problems[0],
    /in capitals/
  );
  assert.equal(
    parseCommit(["feat: x", "", "BREAKING CHANGE: the API moved"].join(NL)).breaking,
    true
  );
});

test("REQ-234 SCN-234c: Specgate's own commits conform", () => {
  const { harnessCommitMessage } = require("../../scripts/lib/ticket-keys");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-commits-"));
  madeDirs.push(dir);
  const harness = harnessCommitMessage(dir, "REQ-002", 1, 3);
  const parsed = parseCommit(harness);
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.type, "feat");
  assert.equal(parsed.scope, "REQ-002");
  // The messages written elsewhere, as their sources write them.
  const sources: Array<[string, RegExp]> = [
    [
      "scripts/lib/ticket-keys.ts",
      /`feat\(\$\{requirement\}\): \$\{key\} implement via specgate harness`/,
    ],
    [
      "scripts/cli/commands/change/TicketCommand.ts",
      /`docs\(spec\): \$\{t\.key\} open the change from the ticket`/,
    ],
    ["scripts/lib/studio-app.ts", /"chore\(spec\): save the specification from the studio"/],
    ["scripts/lib/studio-route.ts", /"chore: start the project with specgate"/],
    [
      "scripts/cli/commands/harness/RunCommand.ts",
      /`chore\(\$\{req\.requirement\}\): attempt FAILED the gate/,
    ],
    [
      "scripts/cli/commands/harness/RunCommand.ts",
      /`docs\(specs\): \$\{r\.requirement\} needs clarification/,
    ],
    [
      "packages/core/src/infrastructure/GitContributionStager.ts",
      /"docs\(spec\): contribute requirements from a consuming project"/,
    ],
  ];
  for (const [file, pattern] of sources) {
    const text = fs.readFileSync(path.join(ROOT_DIR, file), "utf8");
    assert.match(text, pattern, `${file} writes a conforming message`);
  }
  for (const message of [
    "feat(REQ-002): KAN-14 implement via specgate harness",
    "docs(spec): KAN-13 open the change from the ticket",
    "chore(spec): save the specification from the studio",
    "chore: start the project with specgate",
    "chore(REQ-002): attempt FAILED the gate — do not merge as is",
    "docs(specs): REQ-002 needs clarification — Q1",
    "docs(spec): contribute requirements from a consuming project",
  ]) {
    assert.deepEqual(parseCommit(message).problems, [], message);
  }
});
