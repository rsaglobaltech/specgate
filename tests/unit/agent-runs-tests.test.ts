/**
 * REQ-614: the agent can run the project's test command. With
 * `--permission-mode acceptEdits` alone Claude Code was refused every shell
 * command, so it wrote test and code without running either and the gate was
 * the first thing to run them (real run on a Spring service and a TypeScript
 * project, 2026-11-20).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  testCommandParts,
  withAgentPermission,
  withTestPermission,
} from "../../scripts/lib/agent-permission";

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

function adopted(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-agenttests-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", scripts: { test: "node --test", build: "node -e 0" } })
  );
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.js"), "exports.a = 1;\n");
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  assert.equal(run(dir, "adopt").status, 0);
  assert.equal(run(dir, "new", "Orders over a hundred get a discount").status, 0);
  git("add", "-A");
  git("commit", "-qm", "seed");
  return dir;
}

const DOCUMENTED = "claude -p < {prompt_file}";

test("REQ-614 SCN-614a: the documented command and a two-part test command", () => {
  const permitted = withAgentPermission(DOCUMENTED).command;
  assert.deepEqual(withTestPermission(permitted, "npm test && npm run build"), {
    command:
      'claude --permission-mode acceptEdits --allowedTools "Bash(npm test:*)" "Bash(npm run build:*)" -p < {prompt_file}',
    allowed: ["npm test", "npm run build"],
  });
  // The flag `harness init` writes sits after `-p`; the rules follow it there.
  const written =
    "claude -p --output-format stream-json --verbose --permission-mode acceptEdits < {prompt_file} | specgate harness events --from claude";
  assert.equal(
    withTestPermission(written, "mvn -B test").command,
    'claude -p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Bash(mvn -B test:*)" < {prompt_file} | specgate harness events --from claude'
  );

  const dir = adopted();
  const dry = run(dir, "harness", "run", "--dry-run", "--agent", DOCUMENTED);
  assert.equal(dry.status, 0, dry.out);
  assert.match(
    dry.out,
    /Claude Code may run the test command and no other: `npm test`, `npm run build`\./
  );
  assert.match(dry.out, /--allowedTools "Bash\(npm test:\*\)" "Bash\(npm run build:\*\)"/);
});

test("REQ-614 SCN-614b: permissions the person chose are kept as written", () => {
  for (const [command, testCmd] of [
    [
      "claude -p --permission-mode acceptEdits --allowedTools Read Write < {prompt_file}",
      "npm test",
    ],
    ["claude -p --dangerously-skip-permissions < {prompt_file}", "npm test"],
    ["claude -p --permission-mode plan < {prompt_file}", "npm test"],
    ["aider --yes --message-file {prompt_file}", "npm test"],
    ["claude --permission-mode acceptEdits -p < {prompt_file}", ""],
  ]) {
    assert.deepEqual(withTestPermission(command, testCmd), { command, allowed: [] }, command);
  }
});

test("REQ-614 SCN-614c: a part a rule cannot carry is left out", () => {
  const testCmd = 'mvn -B test && sh -c "echo $HOME" ; npx cucumber-js --tags {req}';
  assert.deepEqual(testCommandParts(testCmd), ["mvn -B test"]);
  assert.deepEqual(testCommandParts("npm test | tee out.log"), []);
  assert.deepEqual(testCommandParts("npm test && npm test"), ["npm test"]);
});

test("REQ-614 SCN-614d: the prompt names the command to run", () => {
  const dir = adopted();
  const dry = run(dir, "harness", "run", "--dry-run", "--test-cmd", "mvn -B test");
  assert.equal(dry.status, 0, dry.out);
  assert.match(dry.out, /Run the tests with `mvn -B test`, written exactly so/);
  assert.match(dry.out, /See the new test fail\s+before you write the code/);
});
