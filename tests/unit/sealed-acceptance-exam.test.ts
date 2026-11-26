/**
 * sealed-acceptance REQ-761: the exam proves sealed acceptance holds — the
 * recorded two-function attack replayed with no model, and the level L3a whose
 * writer sees no source.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { twoFunctionAttack } = require("../../scripts/lib/attack");
const { writerCopy, takeAcceptance, WRITER_PATHS } = require("../../scripts/lib/acceptance-writer");
const { readAcceptanceSeals } = require("../../scripts/lib/acceptance");
const { integrationOf, COMPAT_LEVELS } = require("../../packages/core/src/domain/Compat");

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const FIXTURE = path.join(ROOT_DIR, "compat", "tasks", "trap-scenarios", "fixture");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const tmp = (p: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), p));
  made.push(d);
  return fs.realpathSync(d);
};

test("REQ-761 SCN-761a: the attack replayed — every road refused by the guard or reported by the judge", () => {
  const r = twoFunctionAttack(FIXTURE);
  assert.equal(r.passed, true, JSON.stringify(r.roads, null, 2));
  const by = Object.fromEntries(r.roads.map((x: { road: string; outcome: string }) => [x.road, x.outcome]));
  for (const road of ["write tool", "edit tool", "apply_patch", "shell heredoc", "shell sed -i", "shell node -e", "git checkout"])
    assert.equal(by[road], "refused", road);
  // The road no hook sees is the judge's.
  assert.equal(by["unhooked process"], "reported");
});

test("REQ-761: with nothing sealed the same attack gets through — the test can fail", () => {
  const r = twoFunctionAttack(FIXTURE, false);
  assert.equal(r.passed, false);
  assert.ok(r.roads.some((x: { outcome: string }) => x.outcome === "missed"));
});

test("REQ-761 SCN-761a: specgate compat attack two-function passes", () => {
  const dir = tmp("specgate-attack-cli-");
  const run = spawnSync(process.execPath, [CLI, "compat", "attack", "two-function", "--json", "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const doc = JSON.parse(run.stdout.slice(run.stdout.indexOf("{")));
  const compat = doc.compat ?? doc.data?.compat ?? doc;
  assert.equal(compat.passed, true, run.stdout);
  assert.equal(compat.roads.length, 8);
});

test("REQ-761 SCN-761b: the writer sees no source — spec, features and design, no src/ or test/", () => {
  const writer = path.join(tmp("specgate-writer-"), "writer");
  writerCopy(FIXTURE, writer);
  assert.ok(fs.existsSync(path.join(writer, "spec.md")));
  assert.ok(fs.existsSync(path.join(writer, "features", "fees", "REQ-002.feature")));
  assert.ok(fs.existsSync(path.join(writer, "docs", "specs", "changes", "draft-fees", "design.md")));
  assert.ok(!fs.existsSync(path.join(writer, "src")));
  assert.ok(!fs.existsSync(path.join(writer, "test")));
  assert.ok(!WRITER_PATHS.some((p: string) => /^(src|test|tests)\b/.test(p)));
});

test("REQ-761: what the writer lists comes back sealed; a listed src/ file is refused", () => {
  const root = tmp("specgate-writer-take-");
  const project = path.join(root, "project");
  fs.cpSync(FIXTURE, project, { recursive: true });
  const writer = path.join(root, "writer");
  writerCopy(project, writer);
  const steps = "features/step_definitions/fees.steps.js";
  fs.mkdirSync(path.join(writer, "features", "step_definitions"), { recursive: true });
  fs.writeFileSync(path.join(writer, steps), "// the writer's steps\n");
  const list = path.join(writer, "docs", "specs", "changes", "draft-fees", "acceptance-tests.md");
  fs.writeFileSync(list, `- ${steps} — SCN-002a, SCN-002b\n`);
  const r = takeAcceptance(writer, project, "2026-11-26");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(fs.existsSync(path.join(project, steps)));
  assert.deepEqual(Object.keys(readAcceptanceSeals(project, "draft-fees").seals), [steps]);

  fs.writeFileSync(path.join(writer, "src.js"), "");
  fs.writeFileSync(list, `- src/fees.js — SCN-002a\n`);
  fs.mkdirSync(path.join(writer, "src"), { recursive: true });
  fs.writeFileSync(path.join(writer, "src", "fees.js"), "module.exports = {}\n");
  const bad = takeAcceptance(writer, project, "2026-11-26");
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /src\/fees\.js/);
});

test("REQ-761: L3a is a level, wired as L3", () => {
  assert.ok(COMPAT_LEVELS.includes("L3a"));
  for (const tool of ["claude", "codex", "opencode"]) assert.deepEqual(integrationOf(tool, "L3a"), integrationOf(tool, "L3"));
  for (const id of ["trap", "trap-scenarios"]) {
    const task = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "compat", "tasks", id, "task.json"), "utf8"));
    assert.ok(task.acceptance?.kind && task.acceptance?.cmd, id);
  }
  assert.ok(fs.readFileSync(path.join(ROOT_DIR, "compat", "writer-prompt.md"), "utf8").includes("{kind}"));
});
