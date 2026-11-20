/**
 * REQ-613: after adoption the CI job runs what `specgate check` runs here.
 * The job carried its own copy of the test command — with the build added on
 * an npm project, which the saved command lacked — and a later `config set
 * test_cmd` never reached it (first-use journey, 2026-11-20).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(dir: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function nodeProject(scripts: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-cilocal-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "shop", scripts }));
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.js"), "exports.a = 1;\n");
  fs.mkdirSync(path.join(dir, "test"));
  fs.writeFileSync(path.join(dir, "test", "a.test.js"), 'require("node:test")("a", () => {});\n');
  return dir;
}

const workflow = (dir: string) =>
  fs.readFileSync(path.join(dir, ".github/workflows/spec-gate.yml"), "utf8");
const harness = (dir: string) => fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");

test("REQ-613 SCN-613a: a project with a build script — one command, saved, and CI reads it", () => {
  const dir = nodeProject({ test: "node --test", build: "node -e 0" });
  const adopt = run(dir, "adopt");
  assert.equal(adopt.status, 0, adopt.out);
  assert.match(adopt.out, /Test command: npm test && npm run build/);
  assert.match(harness(dir), /^test_cmd: "npm test && npm run build"$/m);
  assert.match(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), /`npm test && npm run build`/);
  // The job names no test command of its own: `check .` reads the one saved.
  assert.match(workflow(dir), /specgate@\S+ check \. --base /);
  assert.doesNotMatch(workflow(dir), /--test-cmd/);
});

test("REQ-613 SCN-613b: no build script, and a command given with --var is taken as written", () => {
  const plain = nodeProject({ test: "node --test" });
  assert.equal(run(plain, "adopt").status, 0);
  assert.match(harness(plain), /^test_cmd: "npm test"$/m);
  assert.doesNotMatch(workflow(plain), /--test-cmd/);

  const given = nodeProject({ test: "node --test", build: "node -e 0" });
  assert.equal(run(given, "adopt", "--var", "TEST_CMD=npm test").status, 0);
  assert.match(harness(given), /^test_cmd: "npm test"$/m);
});

test("REQ-613 SCN-613c: a CI file that was already there is left as it is", () => {
  const dir = nodeProject({ test: "node --test" });
  const file = path.join(dir, ".github/workflows/spec-gate.yml");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# ours\n");
  assert.equal(run(dir, "adopt").status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), "# ours\n");
});

test("REQ-613 SCN-613d: adoption tells the agent's commands from the agent Build runs", () => {
  const dir = nodeProject({ test: "node --test" });
  const out = run(dir, "adopt").out;
  assert.match(out, /Agent commands: not installed/);
  assert.doesNotMatch(out, /Agent: none detected/);
});
