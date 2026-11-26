/**
 * harness-compat REQ-711…REQ-716: the compatibility exam, with fake tools on
 * the PATH standing in for Claude Code, Codex and OpenCode.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { cellOf, type CompatRun } from "../../packages/core/src/domain/Compat";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0]!.replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

/** A fake tool named `name` on a PATH of its own; it records what it saw in `record`. */
function fakeTool(name: string, behaviour: "implement" | "claim") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "compat-test-"));
  const bin = path.join(parent, "bin");
  fs.mkdirSync(bin);
  const record = path.join(parent, "record.json");
  const script = path.join(parent, `${name}.js`);
  fs.writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'if (process.argv.includes("--version")) { console.log("' +
        name +
        ' 9.9.9"); process.exit(0); }',
      `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({`,
      "  argv: process.argv.slice(2),",
      "  sawKey: process.env.OPENCODE_API_KEY !== undefined,",
      '  agents: fs.existsSync("AGENTS.md"),',
      '  skills: fs.existsSync(".agents/skills"),',
      '  commands: fs.existsSync(".opencode/commands"),',
      '  mcp: fs.existsSync("opencode.json") || fs.existsSync(".mcp.json"),',
      '  plugin: fs.existsSync(".opencode/plugins/specgate/index.js"),',
      '  codexHooks: fs.existsSync(".codex/hooks.json") && fs.existsSync(".codex/specgate/guard-hook.cjs"),',
      "}));",
      behaviour === "implement"
        ? [
            'fs.mkdirSync("src", { recursive: true });',
            'fs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(10, Math.max(0, d) * 0.5);\\n");',
            'fs.writeFileSync("test/fees.test.js", "// REQ-002 SCN-002a\\nconst t = require(\\"node:test\\");\\nconst a = require(\\"node:assert\\");\\nt(\\"REQ-002\\", () => a.equal(require(\\"../src/fees.js\\").lateFee(3), 1.5));\\n");',
          ].join("\n")
        : 'console.log("Done, all tests pass");',
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(bin, name),
    `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    { mode: 0o755 }
  );
  const project = path.join(parent, "home");
  fs.mkdirSync(project);
  return {
    parent,
    project,
    record: () => JSON.parse(fs.readFileSync(record, "utf8")),
    recorded: () => fs.existsSync(record),
    run: (args: string[], env: Record<string, string> = {}) =>
      spawnSync(
        process.execPath,
        [CLI, "compat", "run", ...args, "--no-sandbox", "--project-dir", project],
        {
          encoding: "utf8",
          timeout: 300_000,
          env: {
            ...process.env,
            ...env,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
            NO_COLOR: "1",
          },
        }
      ),
    runs: (): CompatRun[] =>
      fs
        .readFileSync(path.join(project, ".specgate", "compat", "runs.jsonl"), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    done: () => fs.rmSync(parent, { recursive: true, force: true }),
  };
}

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}${r.stderr}`;

test("REQ-711 SCN-711a: a tool that implements the requirement passes the gate and the hidden check", () => {
  const f = fakeTool("codex", "implement");
  try {
    const r = f.run(["--tool", "codex", "--level", "L0", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    const [run] = f.runs();
    assert.equal(run!.tool, "codex");
    assert.equal(run!.level, "L0");
    assert.equal(run!.version, "codex 9.9.9");
    assert.equal(run!.model, "gpt-5.6-luna");
    assert.equal(run!.check, true, out(r));
    assert.equal(run!.hidden, true, out(r));
    assert.equal(run!.testNamesReq, true);
    assert.equal(run!.exit, 0);
  } finally {
    f.done();
  }
});

test("REQ-711 SCN-711b: a tool that only claims it did fails, whatever it printed", () => {
  const f = fakeTool("codex", "claim");
  try {
    f.run(["--tool", "codex", "--level", "L0", "--runs", "1"]);
    const [run] = f.runs();
    assert.equal(run!.ran, true);
    assert.equal(run!.hidden, false);
    assert.equal(run!.testNamesReq, false);
  } finally {
    f.done();
  }
});

test("REQ-712 SCN-712a: at L0 the copy has AGENTS.md and no skills, commands, MCP or plugin", () => {
  const f = fakeTool("opencode", "claim");
  try {
    f.run(["--tool", "opencode", "--level", "L0", "--runs", "1"]);
    const seen = f.record();
    assert.deepEqual(
      {
        agents: seen.agents,
        skills: seen.skills,
        commands: seen.commands,
        mcp: seen.mcp,
        plugin: seen.plugin,
      },
      { agents: true, skills: false, commands: false, mcp: false, plugin: false }
    );
  } finally {
    f.done();
  }
});

test("REQ-712: OpenCode at L3 has its commands, its MCP server and its plugin", () => {
  const f = fakeTool("opencode", "claim");
  try {
    f.run(["--tool", "opencode", "--level", "L3", "--runs", "1"]);
    const seen = f.record();
    assert.deepEqual(
      { commands: seen.commands, mcp: seen.mcp, plugin: seen.plugin },
      { commands: true, mcp: true, plugin: true }
    );
  } finally {
    f.done();
  }
});

test("REQ-712 SCN-712b: Codex's hooks at L3 — the copy has them, and Codex starts trusting them", () => {
  const f = fakeTool("codex", "claim");
  try {
    const r = f.run(["--tool", "codex", "--level", "L3", "--runs", "1"]);
    assert.equal(r.status, 0, out(r));
    const [run] = f.runs();
    assert.equal(run!.ran, true);
    const seen = f.record();
    assert.equal(seen.codexHooks, true);
    assert.ok(seen.argv.includes("--dangerously-bypass-hook-trust"), seen.argv.join(" "));
  } finally {
    f.done();
  }
});

test("REQ-713 SCN-713a: mcp install --client opencode adds the server and keeps the file's keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compat-oc-"));
  try {
    fs.writeFileSync(path.join(dir, "opencode.json"), '{"model":"opencode/big-pickle"}\n');
    const r = spawnSync(process.execPath, [CLI, "mcp", "install", "--client", "opencode"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, out(r));
    const doc = JSON.parse(fs.readFileSync(path.join(dir, "opencode.json"), "utf8"));
    assert.equal(doc.model, "opencode/big-pickle");
    assert.equal(doc.mcp.specgate.type, "local");
    assert.deepEqual(doc.mcp.specgate.command.slice(-2), ["mcp", "serve"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-713: mcp install --client codex runs codex mcp add and says it is the Developer's own configuration", () => {
  const f = fakeTool("codex", "claim");
  try {
    const r = spawnSync(process.execPath, [CLI, "mcp", "install", "--client", "codex"], {
      cwd: f.project,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(f.parent, "bin")}${path.delimiter}${process.env.PATH}`,
      },
    });
    assert.equal(r.status, 0, out(r));
    assert.deepEqual(f.record().argv.slice(0, 4), ["mcp", "add", "specgate", "--"]);
    assert.match(out(r), /your own Codex configuration/);
  } finally {
    f.done();
  }
});

test("REQ-713 SCN-713b: Codex at L2 gets the server on its command line, and CODEX_HOME stays empty", () => {
  const f = fakeTool("codex", "implement");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-"));
  try {
    f.run(["--tool", "codex", "--level", "L2", "--runs", "1"], { CODEX_HOME: home });
    const argv: string[] = f.record().argv;
    assert.ok(
      argv.some((a) => a.startsWith("mcp_servers.specgate.command=")),
      argv.join(" ")
    );
    assert.ok(
      argv.some((a) => a.startsWith("mcp_servers.specgate.args=")),
      argv.join(" ")
    );
    assert.deepEqual(fs.readdirSync(home), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    f.done();
  }
});

test("REQ-714 SCN-714a: the company key stays out of the run", () => {
  const f = fakeTool("opencode", "claim");
  try {
    f.run(["--tool", "opencode", "--level", "L0", "--runs", "1"], {
      OPENCODE_API_KEY: "company-key",
    });
    assert.equal(f.record().sawKey, false);
  } finally {
    f.done();
  }
});

test("REQ-714: --keep-env lets a named key through", () => {
  const f = fakeTool("opencode", "claim");
  try {
    f.run(
      ["--tool", "opencode", "--level", "L0", "--runs", "1", "--keep-env", "OPENCODE_API_KEY"],
      {
        OPENCODE_API_KEY: "mine",
      }
    );
    assert.equal(f.record().sawKey, true);
  } finally {
    f.done();
  }
});

const run = (over: Partial<CompatRun>): CompatRun => ({
  tool: "codex",
  level: "L1",
  version: "codex 1",
  model: "m",
  ran: true,
  check: true,
  hidden: true,
  testNamesReq: true,
  seconds: 10,
  exit: 0,
  at: "2026-11-24T00:00:00Z",
  ...over,
});

test("REQ-715 SCN-715a: two of three is amber", () => {
  const cell = cellOf([run({}), run({ hidden: false }), run({ seconds: 30 })]);
  assert.deepEqual([cell.colour, cell.passed, cell.runs, cell.medianSeconds], ["amber", 2, 3, 10]);
  assert.equal(cellOf([run({}), run({}), run({})]).colour, "green");
  assert.equal(cellOf([run({ check: false })]).colour, "red");
  assert.equal(cellOf([run({ ran: false })]).colour, "n/a");
});

test("REQ-716 SCN-716a: the matrix has a row per tool, four levels, today's date, and docs/ untouched", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compat-report-"));
  try {
    fs.mkdirSync(path.join(dir, "docs"));
    fs.writeFileSync(path.join(dir, "docs", "index.md"), "# Docs\n");
    fs.mkdirSync(path.join(dir, ".specgate", "compat"), { recursive: true });
    const lines = [
      run({ tool: "claude", version: "2.1.331", model: "haiku", level: "L0" }),
      run({ tool: "codex", version: "codex-cli 0.154.0", model: "gpt-5.6-luna", level: "L0" }),
      run({
        tool: "codex",
        version: "codex-cli 0.154.0",
        model: "gpt-5.6-luna",
        level: "L3",
        ran: false,
      }),
      run({
        tool: "opencode",
        version: "v2.3.2",
        model: "opencode/big-pickle",
        level: "L2",
        hidden: false,
      }),
    ];
    fs.writeFileSync(
      path.join(dir, ".specgate", "compat", "runs.jsonl"),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
    );
    const r = spawnSync(process.execPath, [CLI, "compat", "report", "--project-dir", dir], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, out(r));
    const md = fs.readFileSync(path.join(dir, ".specgate", "compat", "matrix.md"), "utf8");
    assert.match(md, /\| claude \| 2\.1\.331 \| haiku \|/);
    assert.match(md, /\| codex \| codex-cli 0\.154\.0 \| gpt-5\.6-luna \|/);
    assert.match(md, /\| opencode \| v2\.3\.2 \| opencode\/big-pickle \|/);
    assert.match(md, /\| L0 \| L1 \| L2 \| L3 \|/);
    assert.match(md, new RegExp(`Measured ${new Date().toISOString().slice(0, 10)}`));
    assert.deepEqual(fs.readdirSync(path.join(dir, "docs")), ["index.md"]);
    const j = spawnSync(
      process.execPath,
      [CLI, "compat", "report", "--json", "--project-dir", dir],
      { encoding: "utf8" }
    );
    assert.equal(JSON.parse(j.stdout).compat.rows.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
