/**
 * walkthrough-fixes-2: what the second literal walkthrough of the guides met
 * on 2026-11-26.
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
const cli = (dir: string, args: string[], person = false) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1", SPECGATE_SKIP_DOCTOR: "1", SPECGATE_ASSUME_TTY: person ? "1" : "" },
  });
function project(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt2-")));
  made.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli(dir, ["adopt", "--no-ci"]).status, 0);
  return dir;
}

test("REQ-781 SCN-781a: the Claude Code plugin, generated in a project, goes under .claude/ — and the guard lets the next call through", () => {
  const dir = project();
  const r = cli(dir, ["agents", "init", "--tool", "claude-plugin"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(dir, ".claude", "specgate-plugin", "hooks", "hooks.json")));
  assert.ok(!fs.existsSync(path.join(dir, "scripts")), "nothing of the plugin at the root");
  assert.ok(!fs.existsSync(path.join(dir, "plugin.json")));
  // A change open, no test yet: the guard judges the working tree — the plugin is not part of it.
  assert.equal(cli(dir, ["propose", "export-csv", "--capability", "export"]).status, 0);
  const { decide } = require("../../scripts/plugin/guard-hook");
  const d = decide({ cwd: dir, tool_name: "Bash", tool_input: { command: "ls" } }, {});
  assert.equal(d.allow, true, d.message);
});

test("REQ-781: given a folder of its own, the plugin is written there, as before", () => {
  const out = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt2-plugin-")));
  made.push(out);
  const r = cli(out, ["agents", "init", "--tool", "claude-plugin"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(out, "hooks", "hooks.json")));
});
