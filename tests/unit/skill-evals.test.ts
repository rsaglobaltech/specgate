/**
 * skill-evals (trust curve, phase 5): a skill examined — correct by the gate,
 * good by the review (REQ-686) — and each exam kept per version of the skill,
 * compared with the previous one (REQ-687). The agent is a script: no tokens.
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
const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

/** A task's fixture: an `init` project whose tests pass once `done.txt` exists. */
function fixture(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(sg(dir, "init").status, 0);
  w(dir, "test.js", 'process.exit(require("fs").existsSync("done.txt") ? 0 : 1);\n');
  assert.equal(sg(dir, "config", "set", "test_cmd", "node test.js").status, 0);
  fs.rmSync(path.join(dir, ".git"), { recursive: true, force: true });
}

/**
 * A project with the exam of the skill `orders`: tasks cancel and pay. The
 * agent finishes a task when the skill says GOOD — pay only when it also says BOTH.
 */
function project(skill: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-eval-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(sg(dir, "init").status, 0);
  const exam = "evals/orders";
  fixture(path.join(dir, exam, "tasks/cancel"));
  fixture(path.join(dir, exam, "tasks/pay"));
  w(dir, ".claude/skills/orders/SKILL.md", skill);
  w(
    dir,
    "agent.js",
    [
      'const fs = require("fs");',
      "const p = fs.readFileSync(process.argv[2], 'utf8');",
      "const good = p.includes('GOOD');",
      "const pay = p.includes('TASK pay');",
      "if (good && (!pay || p.includes('BOTH'))) fs.writeFileSync('done.txt', 'ok');",
      "",
    ].join("\n")
  );
  w(dir, "reviewer.js", "console.log('8');\n");
  w(
    dir,
    `${exam}/eval.yaml`,
    [
      "skill: .claude/skills/orders/SKILL.md",
      `agent: "node ${path.join(dir, "agent.js")} {prompt_file}"`,
      "runs: 3",
      `reviewer: "node ${path.join(dir, "reviewer.js")} {dir}"`,
      "tasks:",
      "  - id: cancel",
      "    fixture: tasks/cancel",
      '    prompt: "TASK cancel: let the customer cancel an order"',
      "  - id: pay",
      "    fixture: tasks/pay",
      '    prompt: "TASK pay: let the customer pay an order"',
      "",
    ].join("\n")
  );
  return dir;
}

const evalOf = (dir: string) => {
  const r = sg(dir, "eval", "orders", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).eval;
};

test("REQ-686 SCN-686a: two tasks, three runs each — correct by the gate, good with the reviewer", () => {
  const dir = project("Orders skill. GOOD.");
  const e = evalOf(dir);
  const task = (id: string) => e.tasks.find((t: { id: string }) => t.id === id);
  assert.equal(task("cancel").correct, 3);
  assert.equal(task("pay").correct, 0);
  assert.equal(task("cancel").runs, 3);
  assert.equal(e.correct, 0.5);
  for (const t of e.tasks) for (const r of t.results) assert.equal(r.reviewer, 0.8);
  assert.equal(typeof e.good, "number");
  // The copies are gone.
  for (const t of e.tasks) for (const r of t.results) assert.equal(fs.existsSync(r.dir), false);
  assert.match(sg(dir, "eval", "orders").stdout, /cancel\s+3\/3/);
});

test("REQ-686 SCN-686b: no exam, refused with the file to write", () => {
  const dir = project("x");
  const r = sg(dir, "eval", "missing", "--json");
  assert.notEqual(r.status, 0);
  const s = JSON.parse(r.stdout).status[0];
  assert.equal(s.code, "eval_not_found");
  assert.match(s.fix, /evals\/missing\/eval\.yaml/);
});

test("REQ-687 SCN-687a: a new version of the skill that does worse", () => {
  const dir = project("Orders skill. GOOD. BOTH.");
  const first = evalOf(dir);
  assert.equal(first.correct, 1);
  assert.equal(first.compared, null);
  w(dir, ".claude/skills/orders/SKILL.md", "Orders skill. GOOD.");
  const second = evalOf(dir);
  assert.notEqual(second.version, first.version);
  assert.match(second.version, /^[0-9a-f]{12}$/);
  assert.equal(second.compared.version, first.version);
  assert.equal(second.compared.correct, "worse");
  assert.equal(second.compared.from, 1);
  assert.equal(second.correct, 0.5);
  const history = read(dir, "evals/orders/history.jsonl").trim().split("\n").map((l: string) => JSON.parse(l));
  assert.deepEqual(history.map((h: { version: string }) => h.version), [first.version, second.version]);
});

test("REQ-697 SCN-697a: a hidden check fails — not correct, and unseen while the agent worked", () => {
  const dir = project("Orders skill. GOOD.");
  const exam = path.join(dir, "evals/orders");
  w(exam, "hidden/fee.test.js", "process.exit(1);\n");
  // The agent notes whether the hidden test is in its copy while it works.
  const agent = read(dir, "agent.js");
  w(
    dir,
    "agent.js",
    `require("fs").appendFileSync(${JSON.stringify(path.join(dir, "saw.log"))}, String(require("fs").existsSync("hidden")) + "\\n");\n` +
      agent
  );
  const yaml = read(exam, "eval.yaml").replace(
    '    prompt: "TASK cancel: let the customer cancel an order"\n',
    '    prompt: "TASK cancel: let the customer cancel an order"\n' +
      '    check: "node hidden/fee.test.js"\n' +
      "    check_files: [hidden/fee.test.js]\n"
  );
  w(exam, "eval.yaml", yaml.replace("runs: 3", "runs: 1"));
  const e = evalOf(dir);
  const cancel = e.tasks.find((t: { id: string }) => t.id === "cancel");
  assert.equal(cancel.correct, 0, "specgate check passes, the hidden test does not");
  assert.ok(!read(dir, "saw.log").includes("true"), "hidden/ was not in the copy while the agent worked");
  const prompt = read(dir, ".claude/skills/orders/SKILL.md") + yaml;
  assert.ok(prompt.includes("check:"), "the control: the exam declares it");

  // The same hidden check passing: correct again.
  w(exam, "hidden/fee.test.js", "process.exit(0);\n");
  assert.equal(evalOf(dir).tasks.find((t: { id: string }) => t.id === "cancel").correct, 1);
});
