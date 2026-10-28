"use strict";

/**
 * Gato, the cat that keeps the gate: its state is the project's, so these
 * tests are about the mapping — which facts make which cat — and about where
 * it may appear (a terminal, never a log or CI).
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";
import type { CliResult } from "../helpers/cli";
const { petView, nextStreak, recordCheck, readPetState } = require("../../scripts/pet/pet");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const NOW = new Date("2026-10-12T12:00:00");
const GREEN = {
  lastCheck: { ok: true, at: "2026-10-12T09:00:00" },
  streak: { days: 3, lastGreenDay: "2026-10-12" },
};
const RED = { lastCheck: { ok: false, at: "2026-10-12T09:00:00" } };
const view = (over: Record<string, unknown>) =>
  petView({
    total: 4,
    done: 1,
    readyToClose: 0,
    waiting: 0,
    state: GREEN,
    now: NOW,
    next: "specgate status",
    reason: "",
    ...over,
  });

test("it grows with the share of requirements closed, and wears a crown only on a green gate", () => {
  assert.equal(view({ done: 0 }).stage, "egg");
  assert.equal(view({ done: 1 }).stage, "kitten");
  assert.equal(view({ done: 2 }).stage, "cat");
  assert.equal(view({ done: 4 }).stage, "legend");
  assert.equal(view({ done: 4, state: RED }).stage, "cat", "a red gate is no legend");
});

test("one mood, the most urgent first", () => {
  assert.equal(view({ state: RED, waiting: 2 }).mood, "sick", "a red gate outweighs everything");
  assert.equal(view({ waiting: 1 }).mood, "worried");
  assert.equal(view({ readyToClose: 1 }).mood, "content");
  assert.equal(view({}).mood, "hungry");
  assert.equal(view({ done: 4 }).mood, "happy");
  assert.equal(view({ state: {} }).mood, "curious", "the gate has never run");
  const stale = { lastCheck: { ok: true, at: "2026-09-30T09:00:00" } };
  assert.equal(view({ state: stale }).mood, "sleepy");
});

test("what it says ends where status would send you — or at check when it has never seen the gate", () => {
  assert.equal(view({}).next, "specgate status");
  assert.equal(view({ state: {} }).next, "specgate check");
  assert.match(view({ readyToClose: 1 }).phrase, /1 requirement has its test/);
  assert.match(view({ readyToClose: 2 }).phrase, /2 requirements have their test/);
});

test("the streak counts green days in a row, and a red check or a gap ends it", () => {
  const d1 = nextStreak(undefined, true, new Date("2026-10-10T10:00:00"));
  const d2 = nextStreak(d1, true, new Date("2026-10-11T10:00:00"));
  const again = nextStreak(d2, true, new Date("2026-10-11T18:00:00"));
  assert.deepEqual([d1.days, d2.days, again.days], [1, 2, 2]);
  assert.equal(nextStreak(d2, false, new Date("2026-10-11T19:00:00")).days, 0);
  assert.equal(nextStreak(d2, true, new Date("2026-10-14T10:00:00")).days, 1, "a gap restarts it");
  const old = {
    lastCheck: { ok: true, at: "2026-10-01T09:00:00" },
    streak: { days: 5, lastGreenDay: "2026-10-01" },
  };
  assert.equal(view({ state: old }).streak, 0, "a streak whose last green day is old is over");
});

test("check records what the cat needs, and the file stays out of git", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pet-"));
  try {
    recordCheck(dir, true, NOW);
    const state = readPetState(dir);
    assert.equal(state.lastCheck.ok, true);
    assert.equal(state.streak.days, 1);
    recordCheck(dir, true, NOW);
    const ignore = fs.readFileSync(path.join(dir, ".specgate", ".gitignore"), "utf8");
    assert.equal(ignore, "pet.json\n", "ignored once, and nothing else of .specgate/ with it");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-256 SCN-256a: a check in a clean repository", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pet-git-"));
  try {
    const git = (...a: string[]) =>
      require("node:child_process").spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    fs.writeFileSync(path.join(dir, "README.md"), "x\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
    recordCheck(dir, true, NOW);
    assert.equal(git("status", "--porcelain").stdout, "", "nothing new in the working tree");
    assert.equal(readPetState(dir).lastCheck.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pet-proj-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  const cli = (args: string[], env: Record<string, string> = {}): CliResult =>
    spawnSync(process.execPath, [CLI, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  assert.equal(cli(["init", "--no-capabilities"]).status, 0);
  return { dir, cli };
}

test("status shows the cat on a terminal only, and config set pet off hides it", (t: TestContext) => {
  const { cli } = project(t);
  assert.doesNotMatch(cli(["status"]).stdout, /Gato/, "not in a pipe or a log");
  assert.match(cli(["status"], { SPECGATE_PET: "1" }).stdout, /Gato is curious/);
  assert.equal(cli(["config", "set", "pet", "off"]).status, 0);
  assert.doesNotMatch(cli(["status"], { SPECGATE_PET: "1" }).stdout, /Gato/);
});

test("specgate pet draws the whole cat, and --json carries the same view", (t: TestContext) => {
  const { cli } = project(t);
  const r = cli(["pet"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Gato {2}egg · curious/);
  assert.match(r.stdout, /health .*the gate has never run/);
  const doc = JSON.parse(cli(["pet", "--json"]).stdout);
  assert.equal(doc.pet.stage, "egg");
  assert.equal(doc.pet.next, "specgate check");
});
