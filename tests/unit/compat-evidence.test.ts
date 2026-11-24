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
    assert.match(out(r), /change, deliver, recover, trap, unrequested/);
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
  const body = `if (argv.includes("haiku") && !fs.existsSync("AGENTS.md")) { console.log("Done"); process.exit(0); }\n${FEES}\n${FEES_TEST}`;
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
