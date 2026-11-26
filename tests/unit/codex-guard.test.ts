/**
 * codex-guard REQ-751: Codex runs Specgate's guards, through its project hooks
 * in Claude Code's shape — measured on Codex 0.154: `PreToolUse` with `Bash`
 * and `apply_patch` (the patch in `tool_input.command`), `Stop`, and a refusal
 * by exit code 2.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const run = (dir: string, args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

/** The exam's own fixture: draft-fees open with REQ-002, approved, and no test that names it. */
function feesProject(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-codex-guard-")));
  made.push(dir);
  fs.cpSync(path.join(ROOT_DIR, "compat", "tasks", "deliver", "fixture"), dir, { recursive: true });
  const git = (...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-qm", "given");
  return dir;
}

test("REQ-751 SCN-751a: the hooks are written, and the scripts they run", () => {
  const dir = feesProject();
  const r = run(dir, ["agents", "init", "--tool", "codex-hooks"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, ".codex", "hooks.json"), "utf8"));
  const commands = (event: string) =>
    doc.hooks[event].flatMap((h: { hooks: { command: string }[] }) =>
      h.hooks.map((x) => x.command)
    );
  assert.deepEqual(commands("SessionStart"), ["node .codex/specgate/session-hook.cjs"]);
  assert.deepEqual(commands("PreToolUse"), ["node .codex/specgate/guard-hook.cjs"]);
  assert.equal(doc.hooks.PreToolUse[0].matcher, "Bash|apply_patch");
  assert.deepEqual(commands("Stop"), ["node .codex/specgate/gate-hook.cjs"]);
  for (const s of ["session-hook", "guard-hook", "gate-hook", "project-state", "person-acts"])
    assert.ok(fs.existsSync(path.join(dir, ".codex", "specgate", `${s}.cjs`)), s);
  // Not among the files a plain `agents init` writes: Codex asks the person to trust it.
  const plain = feesProject();
  run(plain, ["agents", "init"]);
  assert.equal(fs.existsSync(path.join(plain, ".codex", "hooks.json")), false);
});

/** The guard as Codex runs it: the hook's command, from the project, with Codex's input on stdin. */
const guard = (dir: string, input: object) =>
  spawnSync("node", [".codex/specgate/guard-hook.cjs"], {
    cwd: dir,
    input: JSON.stringify({ cwd: dir, hook_event_name: "PreToolUse", ...input }),
    encoding: "utf8",
    env: { ...process.env, SPECGATE_GUARD: "", SPECGATE_HOOK_LOG: "" },
  });

const patch = (dir: string, rel: string, body: string) =>
  `*** Begin Patch\n*** Add File: ${path.join(dir, rel)}\n${body
    .split("\n")
    .map((l) => `+${l}`)
    .join("\n")}\n*** End Patch`;

test("REQ-751 SCN-751b: a patch to source code before its test is refused, exit code 2", () => {
  const dir = feesProject();
  assert.equal(run(dir, ["agents", "init", "--tool", "codex-hooks"]).status, 0);
  const code = guard(dir, {
    tool_name: "apply_patch",
    tool_input: { command: patch(dir, "src/fees.js", "exports.lateFee = () => 0;") },
  });
  assert.equal(code.status, 2, code.stdout + code.stderr);
  assert.match(code.stderr, /write the test for REQ-002 first/);

  // The test first is let through, and then the code.
  const t = guard(dir, {
    tool_name: "apply_patch",
    tool_input: { command: patch(dir, "test/fees.test.js", "// REQ-002 SCN-002a") },
  });
  assert.equal(t.status, 0, t.stderr);
  fs.writeFileSync(path.join(dir, "test", "fees.test.js"), "// REQ-002 SCN-002a\n");
  const after = guard(dir, {
    tool_name: "apply_patch",
    tool_input: { command: patch(dir, "src/fees.js", "exports.lateFee = () => 0;") },
  });
  assert.equal(after.status, 0, after.stderr);

  // A person's act in Codex's shell is refused as in Claude Code's.
  const approve = guard(dir, {
    tool_name: "Bash",
    tool_input: { command: "specgate change approve draft-fees" },
  });
  assert.equal(approve.status, 2);
  assert.match(approve.stderr, /person's/);
});

test("REQ-751 SCN-751c: hooks a person wrote are kept, --force or not", () => {
  const dir = feesProject();
  const theirs = '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"./mine.sh"}]}]}}\n';
  fs.mkdirSync(path.join(dir, ".codex"));
  fs.writeFileSync(path.join(dir, ".codex", "hooks.json"), theirs);
  const r = run(dir, ["agents", "init", "--tool", "codex-hooks", "--force", "--json"]);
  assert.equal(fs.readFileSync(path.join(dir, ".codex", "hooks.json"), "utf8"), theirs);
  assert.match(r.stdout, /codex_hooks_kept/);
  // One Specgate wrote is its own to write again.
  fs.rmSync(path.join(dir, ".codex", "hooks.json"));
  run(dir, ["agents", "init", "--tool", "codex-hooks"]);
  const again = run(dir, ["agents", "init", "--tool", "codex-hooks", "--force", "--json"]);
  assert.doesNotMatch(again.stdout, /codex_hooks_kept/);
});
