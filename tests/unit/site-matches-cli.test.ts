"use strict";

/**
 * Fase 2.4 — the site and the CLI disagreeing.
 *
 * A cold evaluator hit this twice: the landing page advertised CircleCI, which
 * `ci init` rejects, and `validate --help` answered "expects exactly one
 * positional argument" instead of explaining itself. Both are the same defect
 * in different clothes — the tool telling a user one thing and doing another —
 * and a sceptical evaluator loses confidence faster on a contradiction than on
 * a missing feature.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const { PROVIDERS } = require("../../scripts/cli/commands/config/CiInitCommand");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

test("the site names no CI provider the CLI would reject", () => {
  const supported = Object.keys(PROVIDERS).map((p) => p.toLowerCase());
  const page = fs.readFileSync(path.join(ROOT_DIR, "docs/index.html"), "utf8");

  // The ones a reader would recognise as a claim, in the spellings a page would
  // actually use. Adding a provider to the CLI is what makes it legal here.
  const knownProviders = [
    ["circleci", "circle ci"],
    ["travis"],
    ["bitbucket"],
    ["teamcity", "team city"],
    ["buildkite"],
    ["drone"],
    ["appveyor"],
  ];
  const lower = page.toLowerCase();
  for (const spellings of knownProviders) {
    if (supported.includes(spellings[0])) continue;
    for (const spelling of spellings) {
      assert.ok(
        !lower.includes(spelling),
        `docs/index.html advertises ${spelling}, which \`ci init\` does not support`
      );
    }
  }
});

test("every provider the CLI supports actually writes a file", () => {
  for (const provider of Object.keys(PROVIDERS)) {
    const r = cli("ci", "init", "--provider", provider, "--help");
    assert.notEqual(r.status, 2, `${provider} should be a known provider`);
  }
});

test("asking a command what it does is never a usage error", () => {
  // Three commands answered `--help` with "argument required", while two help
  // texts tell the user to run `<command> --help`.
  for (const argv of [
    ["validate", "--help"],
    ["req", "add", "--help"],
    ["req", "link", "--help"],
    ["done", "--help"],
    ["adopt", "--help"],
    ["plan", "--help"],
    ["harness", "run", "--help"],
  ]) {
    const r = cli(...argv);
    assert.equal(r.status, 0, `\`specgate ${argv.join(" ")}\` should exit 0, got ${r.status}`);
  }
});

test("req <subcommand> --help is the subcommand's help, not the parent's", () => {
  // `req --help` says "Run specgate req <subcommand> --help for a subcommand's
  // own flags", and every subcommand answered with that same sentence again.
  const cases: Array<[string, string[]]> = [
    ["add", ["specgate req add", "--status"]],
    ["link", ["specgate req link", "--feature", "--test", "--code"]],
    ["rm", ["specgate req rm", "--dry-run", "--force"]],
    ["done", ["specgate done", "--status"]],
  ];
  for (const [sub, expected] of cases) {
    const r = cli("req", sub, "--help");
    assert.equal(r.status, 0, `req ${sub} --help should exit 0`);
    for (const s of expected) {
      assert.ok(r.stdout.includes(s), `req ${sub} --help should mention ${s}`);
    }
    assert.ok(
      !r.stdout.includes("for a subcommand's own flags"),
      `req ${sub} --help printed the parent usage`
    );
  }
});

test("the one gate is the one the CLI recommends", () => {
  // `--strict` is the gate (ADR-0026, #174). The top-level help still sold
  // `--strict-tdd`, which passes an Implemented row whose test file is gone.
  const all = cli("--help", "--all").stdout;
  assert.ok(!all.includes("--strict-tdd"), "`--help --all` should not recommend --strict-tdd");
  assert.ok(all.includes("--strict"), "`--help --all` should name --strict");
});

test("validate --help names every strict flag it accepts", () => {
  // `--strict-links` existed, worked, and appeared in no help text — so the
  // gate that would have caught half of what an evaluator broke was invisible.
  const help = cli("validate", "--help").stdout;
  for (const flag of [
    "--strict-tdd",
    "--strict-scenarios",
    "--strict-requirements",
    "--strict-links",
    "--strict-coverage",
  ]) {
    // A literal substring, not a regex built from the flag: hand-escaping a
    // string into a pattern is how the last two CodeQL findings in this repo
    // happened, and a plain `includes` is what this actually needs.
    assert.ok(help.includes(flag), `--help should name ${flag}`);
  }
});

test("validate --help does not leak the internal script name", () => {
  assert.doesNotMatch(cli("validate", "--help").stdout, /validate_specs\.js/);
});
