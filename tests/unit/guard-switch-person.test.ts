/**
 * guard-switch-person: switching the guard off takes a person at a terminal
 * (REQ-768), and an MCP tool passes only the arguments it declares (REQ-769).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function project(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-guard-switch-")));
  made.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  const r = spawnSync(process.execPath, [CLI, "adopt", "--no-ci", "--project-dir", dir], {
    cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", SPECGATE_SKIP_DOCTOR: "1" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return dir;
}
const guard = (dir: string): string => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, ".specgate", "config.json"), "utf8")).agent_guard ?? "on";
  } catch {
    return "on";
  }
};
const set = (dir: string, value: string, person: boolean) =>
  spawnSync(process.execPath, [CLI, "config", "set", "agent_guard", value, "--project-dir", dir, "--json"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: person ? "1" : "" },
  });

test("REQ-768 SCN-768a: an agent's call — no terminal, the guard stays on", () => {
  const dir = project();
  const r = set(dir, "off", false);
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /guard_needs_person/);
  assert.equal(guard(dir), "on");
});

test("REQ-768 SCN-768b: a person at a terminal switches it off; on is open to anyone", () => {
  const dir = project();
  assert.equal(set(dir, "off", true).status, 0);
  assert.equal(guard(dir), "off");
  const on = set(dir, "on", false);
  assert.equal(on.status, 0, on.stdout);
  assert.equal(guard(dir), "on");
});

test("REQ-769 SCN-769a: an undeclared argument does not reach the CLI", () => {
  const dir = project();
  const { TOOLS } = require("../../packages/mcp-spec-driven/src/tools");
  const tool = TOOLS["specgate_config_set"];
  assert.ok(tool, "the tool exists");
  const prev = process.env.SPECGATE_ASSUME_TTY;
  process.env.SPECGATE_ASSUME_TTY = "1"; // even where a terminal is assumed, the words never arrive
  try {
    tool.handler({ projectDir: dir, cliPath: CLI, a: "agent_guard", b: "off" });
  } finally {
    if (prev === undefined) delete process.env.SPECGATE_ASSUME_TTY;
    else process.env.SPECGATE_ASSUME_TTY = prev;
  }
  assert.equal(guard(dir), "on");
});
