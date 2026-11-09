"use strict";

/**
 * REQ-278 — the Claude Code agent kept by `config set agent` is streamed into
 * the live view. The command `status` suggested left /live with the gate and
 * nothing of the agent (truck-flote, S62).
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
const { withLiveStream } = require("../../scripts/lib/agent-permission");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function tmp(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}

test("REQ-278 SCN-278a: the command status suggests", () => {
  const dir = tmp("specgate-agent-stream-");
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", dir, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const set = spawnSync(
    process.execPath,
    [CLI, "config", "set", "agent", "claude -p < {prompt_file}", "--project-dir", dir],
    { encoding: "utf8" }
  );
  assert.equal(set.status, 0, set.stdout + set.stderr);
  const config = fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
  assert.match(
    config,
    /^agent: "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < \{prompt_file\} \| specgate harness events --from claude"$/m
  );
});

test("REQ-278 SCN-278b: a command that already streams or pipes", () => {
  for (const command of [
    "claude -p --output-format json < {prompt_file}",
    "claude -p < {prompt_file} | tee agent.log",
    "aider --yes --message-file {prompt_file}",
  ]) {
    assert.equal(withLiveStream(command), command);
  }
});
