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
  const history = read(dir, "evals/orders/history.jsonl")
    .trim()
    .split("\n")
    .map((l: string) => JSON.parse(l));
  assert.deepEqual(
    history.map((h: { version: string }) => h.version),
    [first.version, second.version]
  );
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
  assert.ok(
    !read(dir, "saw.log").includes("true"),
    "hidden/ was not in the copy while the agent worked"
  );
  const prompt = read(dir, ".claude/skills/orders/SKILL.md") + yaml;
  assert.ok(prompt.includes("check:"), "the control: the exam declares it");

  // The same hidden check passing: correct again.
  w(exam, "hidden/fee.test.js", "process.exit(0);\n");
  assert.equal(evalOf(dir).tasks.find((t: { id: string }) => t.id === "cancel").correct, 1);
});

// ── eval-list: REQ-702, REQ-703, REQ-704 ────────────────────────────────────
const { spawn } = require("node:child_process");
const listOf = (dir: string) => {
  const r = sg(dir, "eval", "--list", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).evals.exams;
};
const waitFor = async (what: () => boolean, ms = 20_000) => {
  const until = Date.now() + ms;
  while (!what()) {
    if (Date.now() > until) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 100));
  }
};

test("REQ-702 SCN-702a: two versions of a skill — the task marked hidden, two history rows, b2 against a1", () => {
  const dir = project("Orders skill. GOOD.");
  const exam = path.join(dir, "evals/orders");
  const yaml = read(exam, "eval.yaml").replace(
    '    prompt: "TASK cancel: let the customer cancel an order"\n',
    '    prompt: "TASK cancel: let the customer cancel an order"\n    check: "node hidden/ok.js"\n    check_files: [hidden/ok.js]\n'
  );
  w(exam, "eval.yaml", yaml);
  w(exam, "hidden/ok.js", "process.exit(0);\n");
  const row = (version: string, correct: number, good: number) =>
    JSON.stringify({
      at: `2026-11-23T10:0${version === "a1" ? 0 : 1}:00Z`,
      version,
      runs: 3,
      correct,
      good,
      tasks: [],
    });
  w(exam, "history.jsonl", `${row("a1", 1, 0.8)}\n${row("b2", 2 / 3, 0.8)}\n`);
  const [e] = listOf(dir);
  assert.equal(e.skill, "orders");
  assert.deepEqual(
    e.tasks.map((t: { id: string; hidden: boolean }) => [t.id, t.hidden]),
    [
      ["cancel", true],
      ["pay", false],
    ]
  );
  assert.equal(e.history.length, 2);
  const b2 = e.versions.find((v: { version: string }) => v.version === "b2");
  assert.deepEqual(b2.vsPrevious, { correct: "worse", good: "same" });
  assert.match(e.version, /^[0-9a-f]{12}$/);
});

test("REQ-703 SCN-703a: half way through — running with its runs, ended and correct; gone once it ends", async () => {
  const dir = project("Orders skill. GOOD.");
  const exam = path.join(dir, "evals/orders");
  // Each run waits a little: the list is read while the exam works.
  const agent = read(dir, "agent.js");
  w(dir, "agent.js", `const until = Date.now() + 700; while (Date.now() < until) {}\n${agent}`);
  w(exam, "eval.yaml", read(exam, "eval.yaml").replace("runs: 3", "runs: 2\nconcurrency: 1"));
  const child = spawn(process.execPath, [CLI, "eval", "orders", "--json"], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const exited = new Promise((r) => child.on("close", r));
  await waitFor(() => {
    const e = listOf(dir)[0];
    return Boolean(e.running && e.running.ended >= 1);
  });
  const e = listOf(dir)[0];
  assert.equal(e.running.runs, 4);
  assert.ok(e.running.ended >= 1 && e.running.ended < 4, JSON.stringify(e.running));
  assert.equal(typeof e.running.correct, "number");
  await exited;
  assert.equal(listOf(dir)[0].running, null);
  assert.equal(fs.existsSync(path.join(exam, "running.json")), false);
});

test("REQ-704 SCN-704a: a run read while it works — its start and output, no end yet, and its prompt", async () => {
  const dir = project("Orders skill. GOOD.");
  const exam = path.join(dir, "evals/orders");
  const go = path.join(dir, "go");
  w(
    dir,
    "agent.js",
    `console.log("writing src/ausleihe.js");\nconst fs = require("fs");\nconst until = Date.now() + 20000;\nwhile (!fs.existsSync(${JSON.stringify(go)}) && Date.now() < until) {}\nfs.writeFileSync("done.txt", "ok");\n`
  );
  w(
    exam,
    "eval.yaml",
    read(exam, "eval.yaml")
      .replace("runs: 3", "runs: 1")
      .replace(/ {2}- id: pay[\s\S]*$/, "")
  );
  const child = spawn(process.execPath, [CLI, "eval", "orders", "--json"], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const exited = new Promise((r) => child.on("close", r));
  const runFolder = () => {
    const runs = path.join(exam, "runs");
    if (!fs.existsSync(runs)) return null;
    const [stamp] = fs.readdirSync(runs);
    return stamp ? path.join(runs, stamp, "cancel-1") : null;
  };
  await waitFor(() => {
    const f = runFolder();
    return Boolean(
      f &&
      fs.existsSync(path.join(f, "log.jsonl")) &&
      /writing src\/ausleihe\.js/.test(fs.readFileSync(path.join(f, "log.jsonl"), "utf8"))
    );
  });
  const folder = runFolder()!;
  const events = fs
    .readFileSync(path.join(folder, "log.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l: string) => JSON.parse(l));
  assert.equal(events[0].type, "start");
  assert.ok(
    events.some(
      (e: { type: string; text?: string }) =>
        e.type === "output" && /writing src\/ausleihe\.js/.test(e.text || "")
    )
  );
  assert.ok(!events.some((e: { type: string }) => e.type === "end"), "no end yet");
  const prompt = fs.readFileSync(path.join(folder, "prompt.md"), "utf8");
  assert.match(prompt, /Orders skill\. GOOD\./);
  assert.match(prompt, /TASK cancel/);
  fs.writeFileSync(go, "");
  await exited;
  const after = fs.readFileSync(path.join(folder, "log.jsonl"), "utf8");
  assert.match(after, /"type":"end"/);
});

test("REQ-704 SCN-704b: the list names the texts and the last exam's runs", () => {
  const dir = project("Orders skill. GOOD.");
  const exam = path.join(dir, "evals/orders");
  w(exam, "hidden/fails.js", "process.exit(3);\n");
  w(
    exam,
    "eval.yaml",
    read(exam, "eval.yaml")
      .replace("runs: 3", "runs: 1")
      .replace(
        '    prompt: "TASK cancel: let the customer cancel an order"\n',
        '    prompt: "TASK cancel: let the customer cancel an order"\n    check: "node hidden/fails.js"\n    check_files: [hidden/fails.js]\n'
      )
  );
  evalOf(dir);
  const [e] = listOf(dir);
  assert.match(e.skillText, /Orders skill\. GOOD\./);
  assert.match(e.examText, /check: "node hidden\/fails\.js"/);
  const cancel = e.tasks.find((t: { id: string }) => t.id === "cancel");
  assert.equal(cancel.prompt, "TASK cancel: let the customer cancel an order");
  assert.equal(cancel.check, "node hidden/fails.js");
  const run = e.lastRuns.find((r: { task: string }) => r.task === "cancel");
  assert.equal(run.state, "ended");
  assert.equal(run.correct, false);
  assert.equal(run.hiddenExit, 3);
  assert.ok(fs.existsSync(path.join(dir, run.folder, "prompt.md")));
});
