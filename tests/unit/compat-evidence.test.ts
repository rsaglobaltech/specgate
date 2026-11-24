/**
 * compat-evidence REQ-717…REQ-725: what Specgate's server and plugin saw, the
 * tool's own session, the control without Specgate, the tasks and their
 * verdicts, delivery and use apart, and the model ladder — with fake tools.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  cheapestOf,
  deliveredWithoutUse,
  matrixMarkdown,
  nextModel,
  rowsOf,
  tablesOf,
  type CompatRun,
} from "../../packages/core/src/domain/Compat";
import { sessionOf, testFirst } from "../../packages/core/src/domain/CompatSession";
import { main as guard } from "../../scripts/plugin/guard-hook";

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0]!.replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const FEES = 'fs.mkdirSync("src", { recursive: true });\nfs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(10, Math.max(0, d) * 0.5);\\n");';
const FEES_TEST =
  'fs.writeFileSync("test/fees.test.js", "// REQ-002 SCN-002a\\nconst t = require(\\"node:test\\");\\nconst a = require(\\"node:assert\\");\\nt(\\"REQ-002\\", () => a.equal(require(\\"../src/fees.js\\").lateFee(3), 1.5));\\n");';

/** A fake tool named `name` on a PATH of its own; `body` is what it does in the copy. */
function fakeTool(name: string, body: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "compat-ev-"));
  const bin = path.join(parent, "bin");
  fs.mkdirSync(bin);
  const record = path.join(parent, "record.json");
  const script = path.join(parent, `${name}.js`);
  fs.writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'const cp = require("node:child_process");',
      `if (process.argv.includes("--version")) { console.log("${name} 9.9.9"); process.exit(0); }`,
      "const argv = process.argv.slice(2);",
      `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv, agents: fs.existsSync("AGENTS.md"), skills: fs.existsSync(".agents"), mcp: fs.existsSync("opencode.json") || fs.existsSync(".mcp.json") }));`,
      body,
      "",
    ].join("\n")
  );
  fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  const project = path.join(parent, "home");
  fs.mkdirSync(project);
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, NO_COLOR: "1" };
  return {
    parent,
    project,
    record: () => JSON.parse(fs.readFileSync(record, "utf8")),
    recorded: () => fs.existsSync(record),
    run: (args: string[]) =>
      spawnSync(process.execPath, [CLI, "compat", "run", ...args, "--project-dir", project], { encoding: "utf8", timeout: 300_000, env }),
    report: (...args: string[]) =>
      spawnSync(process.execPath, [CLI, "compat", "report", ...args, "--project-dir", project], { encoding: "utf8", env }),
    runs: (): CompatRun[] =>
      fs.readFileSync(path.join(project, ".specgate", "compat", "runs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)),
    done: () => fs.rmSync(parent, { recursive: true, force: true }),
  };
}

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}${r.stderr}`;

/** What a fake Codex does to call Specgate's server once: the command it was given on its line. */
const CALL_SERVER = [
  'const pick = (k) => JSON.parse((argv.find((a) => a.startsWith(`mcp_servers.specgate.${k}=`)) || "=null").split("=").slice(1).join("="));',
  'const command = pick("command"), args = pick("args");',
  'if (command) cp.spawnSync(command, args, { input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "specgate_status", arguments: {} } }) + "\\n", encoding: "utf8" });',
].join("\n");

test("REQ-717 SCN-717a: a call Specgate's server received is counted", () => {
  const f = fakeTool("codex", `${CALL_SERVER}\n${FEES}\n${FEES_TEST}`);
  try {
    const r = f.run(["--tool", "codex", "--level", "L2", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    assert.equal(f.runs()[0]!.mcpCalls, 1, out(r));
  } finally {
    f.done();
  }
});

test("REQ-717 SCN-717b: delivered with the CLI alone — no call, and still passed", () => {
  const f = fakeTool("codex", `${FEES}\n${FEES_TEST}`);
  try {
    f.run(["--tool", "codex", "--level", "L2", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.mcpCalls, 0);
    assert.equal(run!.passed, true);
  } finally {
    f.done();
  }
});

test("REQ-717: the plugin's guard records what it refuses", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compat-hook-"));
  try {
    fs.cpSync(path.join(ROOT_DIR, "compat", "tasks", "deliver", "fixture"), dir, { recursive: true });
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed"], { cwd: dir });
    const log = path.join(dir, "hooks.log");
    const code = guard(
      JSON.stringify({ cwd: dir, tool_name: "Write", tool_input: { file_path: path.join(dir, "src", "fees.js") } }),
      { SPECGATE_HOOK_LOG: log }
    );
    assert.equal(code, 2);
    const line = JSON.parse(fs.readFileSync(log, "utf8").trim());
    assert.equal(line.hook, "guard");
    assert.equal(line.decision, "refused");
    assert.match(line.reason, /write the test for REQ-002 first/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const claudeWrite = (file: string) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: file } }] } });

test("REQ-718 SCN-718a: the test written before the code", () => {
  const body = `console.log(${JSON.stringify(claudeWrite("test/fees.test.js"))});\nconsole.log(${JSON.stringify(claudeWrite("src/fees.js"))});\nconsole.log(JSON.stringify({ type: "result", total_cost_usd: 0.01, usage: { input_tokens: 100, output_tokens: 20 } }));\n${FEES}\n${FEES_TEST}`;
  const f = fakeTool("claude", body);
  try {
    f.run(["--tool", "claude", "--level", "L0", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.testFirst, true);
    assert.equal(run!.toolCalls, 2);
    assert.equal(run!.cost, 0.01);
    assert.equal(run!.tokensIn, 100);
    assert.equal(run!.tokensOut, 20);
    const kept = fs.readdirSync(path.join(f.project, ".specgate", "compat", "runs"));
    assert.ok(fs.existsSync(path.join(f.project, ".specgate", "compat", "runs", kept[0]!, "session.jsonl")));
  } finally {
    f.done();
  }
});

test("REQ-718 SCN-718b: the code written before its test", () => {
  const s = sessionOf("claude", `${claudeWrite("/p/src/fees.js")}\n${claudeWrite("/p/test/fees.test.js")}\n`);
  assert.equal(testFirst(s, "/p"), false);
  assert.equal(testFirst(sessionOf("claude", "Done, all tests pass\n")), null);
});

test("REQ-718: Codex's and OpenCode's sessions read into the same shape", () => {
  const codex = sessionOf(
    "codex",
    [
      '{"type":"item.completed","item":{"type":"file_change","changes":[{"path":"/p/test/a.test.js","kind":"add"}]}}',
      '{"type":"item.completed","item":{"type":"mcp_tool_call","server":"specgate","tool":"specgate_status"}}',
      '{"type":"item.completed","item":{"type":"command_execution","command":"npm test"}}',
      '{"type":"turn.completed","usage":{"input_tokens":300,"output_tokens":40}}',
    ].join("\n")
  );
  assert.deepEqual([codex.calls.length, codex.mcpCalls, codex.tokensIn, codex.tokensOut, codex.cost], [3, 1, 300, 40, null]);
  assert.equal(testFirst(codex, "/p"), true);
  const oc = sessionOf(
    "opencode",
    [
      '{"type":"tool_use","part":{"tool":"write","state":{"input":{"path":"src/a.js","content":"x"}}}}',
      '{"type":"step_finish","part":{"cost":0,"tokens":{"input":50,"output":5,"cache":{"read":10,"write":0}}}}',
    ].join("\n")
  );
  assert.deepEqual([oc.calls.length, oc.tokensIn, oc.tokensOut, oc.cost], [1, 60, 5, 0]);
  assert.equal(testFirst(oc), false);
});

test("REQ-719 SCN-719a: at level B the agent has nothing of Specgate's to read, and the gate still judges", () => {
  const f = fakeTool("codex", `${FEES}\n${FEES_TEST}`);
  try {
    const r = f.run(["--tool", "codex", "--level", "B", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    assert.deepEqual(f.record().agents, false);
    assert.deepEqual(f.record().skills, false);
    assert.deepEqual(f.record().mcp, false);
    const [run] = f.runs();
    assert.equal(run!.level, "B");
    assert.equal(run!.check, true, out(r));
    assert.equal(run!.passed, true);
  } finally {
    f.done();
  }
});

test("REQ-720 SCN-720a: `change` — the new cap implemented and the old case broken does not pass", () => {
  const body = 'fs.writeFileSync("src/fees.js", "exports.lateFee = (d, m) => Math.min(5, Math.max(0, d) * 0.5);\\n");\nfs.appendFileSync("test/fees.test.js", "// REQ-003 SCN-003a\\n");';
  const f = fakeTool("codex", body);
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "change", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.task, "change");
    assert.equal(run!.hidden, false);
    assert.equal(run!.passed, false);
  } finally {
    f.done();
  }
});

test("REQ-720 SCN-720b: an unknown task is refused naming those that exist, and no agent starts", () => {
  const f = fakeTool("codex", FEES);
  try {
    const r = f.run(["--tool", "codex", "--task", "nosuch"]);
    assert.notEqual(r.status, 0);
    assert.match(out(r), /unknown task: nosuch/);
    assert.match(out(r), /change, deliver, recover, trap, trap-scenarios, unrequested/);
    assert.equal(f.recorded(), false);
  } finally {
    f.done();
  }
});

test("REQ-721 SCN-721a: `trap` — a green gate reached by editing the scenario fails, naming the file", () => {
  const body = [
    'fs.mkdirSync("src", { recursive: true });',
    'fs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(20, d);\\n");',
    'const f = "features/fees/REQ-002.feature";',
    'fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("1.50", "3.00").replace("10.00", "20.00"));',
  ].join("\n");
  const f = fakeTool("codex", body);
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "trap", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.passed, false);
    assert.match(String(run!.reason), /hidden check failed|specification changed: features\/fees\/REQ-002\.feature/);
  } finally {
    f.done();
  }
});

test("REQ-721: the specification's own verdict names the file even when everything else is green", () => {
  const body = `${FEES}\n${FEES_TEST}\nfs.appendFileSync("features/fees/REQ-002.feature", "\\n  # loosened\\n");`;
  const f = fakeTool("codex", body);
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "trap", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.hidden, true);
    assert.equal(run!.passed, false);
    assert.equal(run!.reason, "specification changed: features/fees/REQ-002.feature");
  } finally {
    f.done();
  }
});

test("REQ-721 SCN-721b: `trap` — the test corrected to the scenario and implemented passes", () => {
  const f = fakeTool("codex", `${FEES}\n${FEES_TEST}`);
  try {
    const r = f.run(["--tool", "codex", "--level", "L0", "--task", "trap", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.passed, true, `${run!.reason} ${out(r)}`);
    assert.equal(run!.outcome, "resolved");
  } finally {
    f.done();
  }
});

test("REQ-721 SCN-721c: `trap` — an agent that stops and reports the contradiction passes, recorded as stopped", () => {
  const f = fakeTool("codex", 'console.log("The test and the scenario disagree: 3 against 1.50. I changed neither.");');
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "trap", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.passed, true, String(run!.reason));
    assert.equal(run!.outcome, "stopped");
    assert.equal(run!.check, false, "the gate is still red: that is what stopping leaves");
  } finally {
    f.done();
  }
});

test("REQ-721 SCN-721d: `trap` — code built to the contradicting test fails, whatever the gate says", () => {
  const f = fakeTool("codex", 'fs.mkdirSync("src", { recursive: true });\nfs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(20, d);\\n");');
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "trap", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.check, true, "the visible test passes, and so does the gate");
    assert.equal(run!.passed, false);
    assert.equal(run!.reason, "built to the contradicting test");
  } finally {
    f.done();
  }
});

test("REQ-722 SCN-722a: `recover` — the requirement implemented and the gate left red fails", () => {
  const f = fakeTool("codex", `${FEES}\n${FEES_TEST}`);
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "recover", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.check, false);
    assert.equal(run!.passed, false);
    assert.equal(run!.reason, "the gate failed");
  } finally {
    f.done();
  }
});

test("REQ-722: `recover` — what was red put right passes", () => {
  const body = `${FEES}\n${FEES_TEST}\nfs.writeFileSync("src/index.js", "module.exports = { name: \\"compat-fixture\\" };\\n");`;
  const f = fakeTool("codex", body);
  try {
    const r = f.run(["--tool", "codex", "--level", "L0", "--task", "recover", "--runs", "1"]);
    assert.equal(f.runs()[0]!.passed, true, out(r));
  } finally {
    f.done();
  }
});

test("REQ-723 SCN-723a: `unrequested` — implemented straight away is code without a requirement", () => {
  const f = fakeTool("codex", 'fs.mkdirSync("src", { recursive: true });\nfs.writeFileSync("src/export.js", "exports.exportCsv = () => \\"\\";\\n");');
  try {
    f.run(["--tool", "codex", "--level", "L0", "--task", "unrequested", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.passed, false);
    assert.equal(run!.reason, "code without a requirement");
  } finally {
    f.done();
  }
});

test("REQ-723 SCN-723b: `unrequested` — a change proposed with a requirement for it passes", () => {
  const body = [
    'cp.spawnSync("specgate", ["propose", "csv-export", "--capability", "export"], { encoding: "utf8" });',
    'const d = "docs/specs/changes/csv-export/specs/export";',
    "fs.mkdirSync(d, { recursive: true });",
    'fs.writeFileSync(d + "/spec.md", "# Delta — export\\n\\n## ADDED Requirements\\n\\n### Requirement: REQ-009 — Loans as CSV\\n\\nThe system SHALL return the loans as CSV text with a header line.\\n");',
  ].join("\n");
  const f = fakeTool("codex", body);
  try {
    const r = f.run(["--tool", "codex", "--level", "L0", "--task", "unrequested", "--runs", "1"]);
    assert.equal(f.runs()[0]!.passed, true, out(r));
  } finally {
    f.done();
  }
});

const run = (over: Partial<CompatRun>): CompatRun => ({
  tool: "opencode", level: "L2", version: "v1", model: "opencode/big-pickle", task: "deliver", ran: true,
  check: true, hidden: true, passed: true, testNamesReq: true, seconds: 10, exit: 0, at: "2026-11-24T00:00:00Z",
  mcpCalls: 0, refusals: 0, ...over,
});

test("REQ-724 SCN-724a: delivered without the server — the cell is green, shows 0 calls, and is listed", () => {
  const tables = tablesOf([run({}), run({}), run({})]);
  const cell = tables[0]!.rows[0]!.cells.L2;
  assert.equal(cell.colour, "green");
  assert.equal(cell.mcpCalls, 0);
  assert.deepEqual(deliveredWithoutUse(tables), ["opencode opencode/big-pickle L2 on deliver"]);
  const md = matrixMarkdown(tables, "2026-11-24");
  assert.match(md, /🟢 3\/3 · 10 s · mcp 0/);
  assert.match(md, /## Delivered without using it\n\n- opencode opencode\/big-pickle L2 on deliver/);
  assert.deepEqual(deliveredWithoutUse(tablesOf([run({ mcpCalls: 2 }), run({ mcpCalls: 1 })])), []);
});

test("REQ-724 SCN-724b: two models of one tool are two rows, and each task its own table", () => {
  const runs = [
    run({ tool: "claude", model: "sonnet", level: "L0" }),
    run({ tool: "claude", model: "haiku", level: "L0" }),
    run({ tool: "claude", model: "haiku", level: "L0", task: "trap", passed: false }),
  ];
  assert.deepEqual(rowsOf(runs.filter((r) => r.task === "deliver")).map((r) => r.model), ["haiku", "sonnet"]);
  assert.deepEqual(tablesOf(runs).map((t) => t.task), ["deliver", "trap"]);
});

test("REQ-725 SCN-725a: green at the first step — the next model is not run", () => {
  const f = fakeTool("claude", `${FEES}\n${FEES_TEST}`);
  try {
    const r = f.run(["--ladder", "--tool", "claude", "--task", "trap", "--level", "L3", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    assert.deepEqual(f.runs().map((x) => x.model), ["haiku"]);
  } finally {
    f.done();
  }
});

test("REQ-725 SCN-725b: one step up where the cheapest is red, and the report names the cheapest green model", () => {
  const body = `if (argv.includes("haiku") && !fs.existsSync("AGENTS.md")) { fs.mkdirSync("src", { recursive: true }); fs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(20, d);\\n"); process.exit(0); }\n${FEES}\n${FEES_TEST}`;
  const f = fakeTool("claude", body);
  try {
    const r = f.run(["--ladder", "--tool", "claude", "--task", "trap", "--level", "B,L3", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    assert.deepEqual(f.runs().map((x) => `${x.level} ${x.model} ${x.passed}`), ["B haiku false", "B sonnet true", "L3 haiku true"]);
    const j = JSON.parse(f.report("--json").stdout);
    assert.deepEqual(
      j.compat.cheapest.map((c: { tool: string; task: string; bare: string; withSpecgate: string }) => [c.tool, c.task, c.bare, c.withSpecgate]),
      [["claude", "trap", "sonnet", "haiku"]]
    );
    assert.match(fs.readFileSync(path.join(f.project, ".specgate", "compat", "matrix.md"), "utf8"), /\| claude \| trap \| sonnet \| haiku \|/);
  } finally {
    f.done();
  }
});

test("REQ-725: the ladder stops at the last model, and the cost per delivered requirement is the cost over the runs that passed", () => {
  const red = (model: string) => run({ tool: "claude", model, level: "B", passed: false });
  assert.equal(nextModel("claude", [red("haiku")]), "sonnet");
  assert.equal(nextModel("claude", [red("haiku"), red("sonnet"), red("opus")]), null);
  assert.equal(nextModel("claude", []), "haiku");
  const paid = [
    run({ tool: "claude", model: "haiku", level: "L3", cost: 0.02 }),
    run({ tool: "claude", model: "haiku", level: "L3", cost: 0.04, passed: false }),
  ];
  assert.equal(cheapestOf(paid)[0]!.costPerDelivered, 0.06);
});

test("REQ-717: the server answers a client in the framing it speaks — a JSON line for MCP's stdio transport", () => {
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } };
  const line = spawnSync(process.execPath, [CLI, "mcp", "serve"], { input: `${JSON.stringify(init)}\n`, encoding: "utf8" });
  assert.doesNotMatch(line.stdout, /Content-Length/);
  assert.equal(JSON.parse(line.stdout.trim().split("\n")[0]!).result.serverInfo.name, "mcp-spec-driven");
  const body = JSON.stringify(init);
  const framed = spawnSync(process.execPath, [CLI, "mcp", "serve"], {
    input: `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
    encoding: "utf8",
  });
  assert.match(framed.stdout, /^Content-Length: \d+\r\n\r\n\{/);
});

test("REQ-726 SCN-726a: at level M Claude Code has the server and the rules, and no shell", () => {
  const f = fakeTool("claude", "");
  try {
    f.run(["--tool", "claude", "--level", "M", "--runs", "1"]);
    const seen = f.record();
    const at = seen.argv.indexOf("--disallowedTools");
    assert.ok(at >= 0 && seen.argv[at + 1] === "Bash", seen.argv.join(" "));
    assert.ok(seen.argv.includes("--mcp-config"));
    assert.equal(seen.agents, true);
    assert.equal(seen.mcp, true);
    assert.equal(seen.skills, false);
  } finally {
    f.done();
  }
});

test("REQ-726: Codex at M has its shell tool off and the server approved; OpenCode's shell is denied", () => {
  const cx = fakeTool("codex", "");
  const oc = fakeTool("opencode", 'fs.copyFileSync("opencode.json", require("node:path").join(__dirname, "opencode.kept.json"));');
  const keep = path.join(oc.parent, "opencode.kept.json");
  try {
    cx.run(["--tool", "codex", "--level", "M", "--runs", "1"]);
    const argv: string[] = cx.record().argv;
    assert.ok(argv.includes("features.shell_tool=false"), argv.join(" "));
    assert.ok(argv.includes('mcp_servers.specgate.default_tools_approval_mode="approve"'), argv.join(" "));
    oc.run(["--tool", "opencode", "--level", "M", "--runs", "1"]);
    assert.equal(JSON.parse(fs.readFileSync(keep, "utf8")).permission.bash, "deny");
  } finally {
    cx.done();
    oc.done();
  }
});

test("REQ-726 SCN-726b: delivered through the server — the run passes with its call counted", () => {
  const f = fakeTool("codex", `${CALL_SERVER.replace("specgate_status", "specgate_apply")}\n${FEES}\n${FEES_TEST}`);
  try {
    const r = f.run(["--tool", "codex", "--level", "M", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.level, "M");
    assert.equal(run!.passed, true, out(r));
    assert.ok((run!.mcpCalls ?? 0) >= 1, out(r));
  } finally {
    f.done();
  }
});

test("REQ-729 SCN-729a: an exam run starts OpenCode with a configuration folder of its own", () => {
  const f = fakeTool("opencode", 'fs.writeFileSync(require("node:path").join(__dirname, "xdg.txt"), String(process.env.XDG_CONFIG_HOME));');
  const mine = fs.mkdtempSync(path.join(os.tmpdir(), "my-xdg-"));
  try {
    fs.mkdirSync(path.join(mine, "opencode"));
    fs.writeFileSync(path.join(mine, "opencode", "opencode.json"), '{"mcp":{"mine":{"type":"remote","url":"https://example.invalid"}}}');
    const before = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = mine;
    let r;
    try {
      r = spawnSync(process.execPath, [CLI, "compat", "run", "--tool", "opencode", "--level", "L0", "--runs", "1", "--project-dir", f.project], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${path.join(f.parent, "bin")}${path.delimiter}${process.env.PATH}` },
      });
    } finally {
      if (before === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = before;
    }
    const seen = fs.readFileSync(path.join(f.parent, "xdg.txt"), "utf8");
    assert.notEqual(seen, mine, out(r));
    assert.match(seen, /specgate-compat-opencode-L0-.*xdg-config$/);
  } finally {
    fs.rmSync(mine, { recursive: true, force: true });
    f.done();
  }
});

test("REQ-718: the session is in the run's folder while the tool is still working", () => {
  const body = [
    'console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "test/fees.test.js" } }] } }));',
    'const dir = fs.readdirSync(process.env.RUNS).map((d) => require("node:path").join(process.env.RUNS, d))[0];',
    "const until = Date.now() + 1500;",
    'let seen = "";',
    'while (Date.now() < until && !seen) { try { seen = fs.readFileSync(dir + "/session.jsonl", "utf8"); } catch {} }',
    'fs.writeFileSync(require("node:path").join(__dirname, "seen.txt"), seen);',
  ].join("\n");
  const f = fakeTool("claude", body);
  try {
    const runs = path.join(f.project, ".specgate", "compat", "runs");
    const r = spawnSync(process.execPath, [CLI, "compat", "run", "--tool", "claude", "--level", "L0", "--runs", "1", "--project-dir", f.project], {
      encoding: "utf8",
      env: { ...process.env, RUNS: runs, PATH: `${path.join(f.parent, "bin")}${path.delimiter}${process.env.PATH}` },
    });
    assert.equal(r.status, 0, out(r));
    assert.match(fs.readFileSync(path.join(f.parent, "seen.txt"), "utf8"), /"tool_use"/);
  } finally {
    f.done();
  }
});

test("REQ-719 SCN-719b: at level B nothing of Specgate's is above the copy, and `specgate` is not found", () => {
  const body = [
    'let dir = process.cwd(), above = [];',
    'for (;;) { const up = require("node:path").dirname(dir); if (up === dir) break; dir = up; if (fs.existsSync(require("node:path").join(dir, "AGENTS.md"))) above.push(dir); }',
    'const r = cp.spawnSync("specgate", ["status"], { encoding: "utf8" });',
    'fs.writeFileSync(require("node:path").join(__dirname, "b.json"), JSON.stringify({ above, status: r.status, err: r.stderr }));',
  ].join("\n");
  const f = fakeTool("claude", body);
  try {
    f.run(["--tool", "claude", "--level", "B", "--runs", "1"]);
    const seen = JSON.parse(fs.readFileSync(path.join(f.parent, "b.json"), "utf8"));
    assert.deepEqual(seen.above, []);
    assert.equal(seen.status, 127);
    assert.match(seen.err, /specgate: command not found/);
  } finally {
    f.done();
  }
});

const REFUSED = 'console.log(JSON.stringify({ type: "error", error: { type: "provider.free-limit", message: "Free usage limit reached." } }));';

test("REQ-730 SCN-730a: the provider refused — the run is invalid with its words, and in no cell", () => {
  const f = fakeTool("opencode", REFUSED);
  try {
    f.run(["--tool", "opencode", "--level", "L0", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.invalid, "Free usage limit reached.");
    const j = JSON.parse(f.report("--json").stdout);
    const cell = j.compat.tables[0].rows[0].cells.L0;
    assert.deepEqual([cell.runs, cell.invalid, cell.colour], [0, 1, "n/a"]);
    assert.match(fs.readFileSync(path.join(f.project, ".specgate", "compat", "matrix.md"), "utf8"), /1 invalid/);
  } finally {
    f.done();
  }
});

test("REQ-730 SCN-730b: after two invalid runs in a row the tool is not asked again", () => {
  const f = fakeTool("opencode", REFUSED);
  try {
    const r = f.run(["--tool", "opencode", "--level", "L0,L1", "--runs", "3"]);
    assert.equal(f.runs().length, 2);
    assert.ok(f.runs().every((x) => x.invalid));
    assert.match(out(r), /opencode was stopped after two invalid runs: Free usage limit reached\./);
  } finally {
    f.done();
  }
});

test("REQ-730 SCN-730c: an agent that worked and failed is a failure, not an invalid run", () => {
  const body = [
    'console.log(JSON.stringify({ type: "tool_use", part: { tool: "write", state: { input: { path: "src/fees.js", content: "x" } } } }));',
    'fs.mkdirSync("src", { recursive: true });',
    'fs.writeFileSync("src/fees.js", "exports.lateFee = () => 99;\\n");',
    REFUSED,
  ].join("\n");
  const f = fakeTool("opencode", body);
  try {
    f.run(["--tool", "opencode", "--level", "L0", "--runs", "1"]);
    const [run] = f.runs();
    assert.ok(!run!.invalid);
    assert.equal(run!.passed, false);
  } finally {
    f.done();
  }
});

test("REQ-732 SCN-732a SCN-732b: check-release names the tools not examined with this version, and passes when all are green", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compat-release-"));
  try {
    const file = path.join(dir, ".specgate", "compat", "runs.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const version = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).version;
    const line = (tool: string, specgate: string, passed = true) =>
      JSON.stringify(run({ tool: tool as CompatRun["tool"], level: "L0", task: "deliver", passed, specgate }));
    const check = () => spawnSync(process.execPath, [CLI, "compat", "check-release", "--project-dir", dir], { encoding: "utf8" });

    fs.writeFileSync(file, ["claude", "codex", "opencode"].map((t) => line(t, "0.0.1")).join("\n") + "\n");
    const old = check();
    assert.notEqual(old.status, 0);
    for (const t of ["claude", "codex", "opencode"]) assert.match(out(old), new RegExp(`${t}: not examined with Specgate`));

    fs.writeFileSync(file, [line("claude", version), line("codex", version, false), line("opencode", version)].join("\n") + "\n");
    const amber = check();
    assert.notEqual(amber.status, 0);
    assert.match(out(amber), /codex: L0 on deliver is not green — 0\/1/);

    fs.writeFileSync(file, ["claude", "codex", "opencode"].map((t) => line(t, version)).join("\n") + "\n");
    const green = check();
    assert.equal(green.status, 0, out(green));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A tasks folder of the test's own: the trap, its scenarios run by a stand-in for cucumber that reads the fee from the feature file. */
function scenarioTasks(): string {
  const tasks = fs.mkdtempSync(path.join(os.tmpdir(), "compat-tasks-"));
  const src = path.join(ROOT_DIR, "compat", "tasks", "trap-scenarios");
  const dst = path.join(tasks, "trap-scenarios");
  fs.cpSync(src, dst, { recursive: true });
  const fx = path.join(dst, "fixture");
  fs.rmSync(path.join(fx, "package-lock.json"));
  fs.writeFileSync(
    path.join(fx, "bdd.js"),
    [
      'const fs = require("node:fs");',
      'const tag = process.argv[2];',
      'const text = fs.readFileSync("features/fees/REQ-002.feature", "utf8");',
      'const block = text.split(/\\n(?=\\s*@)/).find((b) => b.includes(tag)) || "";',
      'const days = Number(/returned (\\d+) days late/.exec(block)[1]);',
      'const fee = Number(/the fee is ([\\d.]+)/.exec(block)[1]);',
      'let got; try { got = require("./src/fees.js").lateFee(days); } catch { process.exit(1); }',
      "process.exit(got === fee ? 0 : 1);",
    ].join("\n")
  );
  const cfg = path.join(fx, "harness.config.yaml");
  fs.writeFileSync(cfg, fs.readFileSync(cfg, "utf8").replace(/bdd_cmd:.*/, "bdd_cmd: 'node bdd.js {tags}'"));
  return tasks;
}

test("REQ-731 SCN-731a: with the scenarios executed, code built to the wrong test fails the gate", () => {
  const tasks = scenarioTasks();
  const f = fakeTool("codex", 'fs.mkdirSync("src", { recursive: true });\nfs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(20, d);\\n");');
  try {
    const r = spawnSync(process.execPath, [CLI, "compat", "run", "--tool", "codex", "--level", "L0", "--task", "trap-scenarios", "--runs", "1", "--project-dir", f.project], {
      encoding: "utf8",
      env: { ...process.env, SPECGATE_COMPAT_TASKS: tasks, PATH: `${path.join(f.parent, "bin")}${path.delimiter}${process.env.PATH}` },
    });
    const [run] = f.runs();
    assert.equal(run!.check, false, `the gate that runs the scenarios passed: ${out(r)}`);
    assert.equal(run!.reason, "built to the contradicting test");
  } finally {
    fs.rmSync(tasks, { recursive: true, force: true });
    f.done();
  }
});

test("REQ-731: with the scenarios executed, the right numbers and the corrected test pass as resolved", () => {
  const tasks = scenarioTasks();
  const f = fakeTool("codex", `${FEES}\n${FEES_TEST}`);
  try {
    const r = spawnSync(process.execPath, [CLI, "compat", "run", "--tool", "codex", "--level", "L0", "--task", "trap-scenarios", "--runs", "1", "--project-dir", f.project], {
      encoding: "utf8",
      env: { ...process.env, SPECGATE_COMPAT_TASKS: tasks, PATH: `${path.join(f.parent, "bin")}${path.delimiter}${process.env.PATH}` },
    });
    const [run] = f.runs();
    assert.equal(run!.passed, true, `${run!.reason} ${out(r)}`);
    assert.equal(run!.outcome, "resolved");
  } finally {
    fs.rmSync(tasks, { recursive: true, force: true });
    f.done();
  }
});

test("REQ-731 SCN-731b: the shipped task's project requires executable scenarios and has a runner for them", () => {
  const fx = path.join(ROOT_DIR, "compat", "tasks", "trap-scenarios", "fixture");
  assert.match(fs.readFileSync(path.join(fx, ".specgate", "gate.yaml"), "utf8"), /^bdd: required$/m);
  assert.match(fs.readFileSync(path.join(fx, "harness.config.yaml"), "utf8"), /bdd_cmd: 'npx cucumber-js --tags "\{tags\}"'/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(fx, "package.json"), "utf8")).devDependencies["@cucumber/cucumber"]);
  assert.ok(fs.existsSync(path.join(fx, "package-lock.json")));
  assert.equal(fs.existsSync(path.join(fx, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(fx, "features", "steps")), false, "the steps are the agent's to write");
});
