"use strict";

/**
 * `specgate agents init` — the generated instruction files.
 *
 * The property worth protecting is that these files stay thin. They point at
 * `specgate change instructions`; they do not copy the delta grammar into markdown,
 * because a copy is stale the moment the grammar moves.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { TOOLS, ALL_TOOLS, DEFAULT_TOOLS, parseArgs } = require("../../scripts/agents/init");
const { STEPS } = require("../../scripts/agents/commands");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agents-init-"));
  const r = cli(
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  try {
    fn(path.join(root, "acme-energy-hub"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("--dry-run writes nothing", () => {
  withProject((dir) => {
    const r = cli("agents", "init", "--project-dir", dir, "--dry-run", "--json");
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.agents.dryRun, true);
    assert.ok(doc.agents.written.length > 0, "it still reports what it would write");
    for (const w of doc.agents.written) {
      assert.ok(!fs.existsSync(path.join(dir, w.path)), `${w.path} should not exist`);
    }
  });
});

test("a shared destination is written once, credited to both tools", () => {
  // Claude and Codex both read AGENTS.md; it used to appear twice.
  withProject((dir) => {
    const r = cli(
      "agents",
      "init",
      "--project-dir",
      dir,
      "--tool",
      "claude,codex",
      "--dry-run",
      "--json"
    );
    const doc = JSON.parse(r.stdout);
    // `specgate init` already generates AGENTS.md, so here it lands in `skipped` —
    // what matters is that it appears exactly once, whichever list it is in.
    const planned = [...doc.agents.written, ...doc.agents.skipped].filter(
      (w) => w.path === "AGENTS.md"
    );
    assert.equal(planned.length, 1, "AGENTS.md should be planned once, not per tool");
    assert.equal(planned[0].tool, "claude+codex");
  });
});

test("existing files are never overwritten without --force", () => {
  withProject((dir) => {
    const target = path.join(dir, "CONVENTIONS.md");
    fs.writeFileSync(target, "hand-written, do not clobber\n", "utf8");

    const r = cli("agents", "init", "--project-dir", dir, "--tool", "aider", "--json");
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.agents.skipped.length, 1);
    assert.equal(fs.readFileSync(target, "utf8"), "hand-written, do not clobber\n");
    // And it says so, with the way out.
    assert.equal(doc.status[0].code, "agent_file_exists");
    assert.match(doc.status[0].fix, /--force/);

    const forced = cli(
      "agents",
      "init",
      "--project-dir",
      dir,
      "--tool",
      "aider",
      "--force",
      "--json"
    );
    assert.equal(JSON.parse(forced.stdout).agents.written.length, 1);
    assert.match(fs.readFileSync(target, "utf8"), /Spec-Driven Development/);
  });
});

test("every step becomes a slash command that calls the engine", () => {
  withProject((dir) => {
    assert.equal(
      cli("agents", "init", "--project-dir", dir, "--tool", "claude", "--force").status,
      0
    );
    for (const step of STEPS) {
      const file = path.join(dir, ".claude/commands/specgate", `${step.name}.md`);
      assert.ok(fs.existsSync(file), `${step.name} should have a slash command`);
      const body = fs.readFileSync(file, "utf8");
      assert.match(body, new RegExp(`# /specgate:${step.name}`));
      // Thin by design: it defers to the engine rather than restating rules.
      assert.match(body, /specgate change instructions/);
    }
  });
});

test("an unknown tool is a usage error listing the supported ones", () => {
  withProject((dir) => {
    const r = cli("agents", "init", "--project-dir", dir, "--tool", "clippy", "--json");
    assert.equal(r.status, 2);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.agents, null);
    assert.equal(doc.status[0].code, "tool_unknown");
    assert.match(doc.status[0].fix, /claude/);
  });
});

test("--tool defaults to every tool that belongs inside a project", () => {
  // Not quite every tool: `claude-plugin` produces an installable artefact,
  // and scattering one into every project that ran `agents init` is not what
  // anybody asked for. It is opt-in, and still selectable by name.
  assert.deepEqual(parseArgs([]).tools, DEFAULT_TOOLS);
  assert.ok(DEFAULT_TOOLS.length > 0);
  assert.deepEqual(
    ALL_TOOLS.filter((t: string) => !DEFAULT_TOOLS.includes(t)),
    ["claude-plugin"]
  );
  assert.deepEqual(parseArgs(["--tool", "claude, cursor"]).tools, ["claude", "cursor"]);
  assert.deepEqual(parseArgs(["--tool", "claude-plugin"]).tools, ["claude-plugin"]);
});

test("no generated file copies the delta grammar", () => {
  // The failure this guards against: a markdown file that restates the format
  // and then rots. Rules live in the engine; these files point at it.
  for (const tool of ALL_TOOLS) {
    for (const file of TOOLS[tool].files()) {
      assert.doesNotMatch(
        file.contents,
        /## ADDED Requirements[\s\S]*#### Scenario/,
        `${tool}:${file.path} should not inline a delta template`
      );
    }
  }
});

// ── Antigravity (E1-07) ──────────────────────────────────────────────────────
//
// Its extension format was verified against Google's own documentation before
// any of this was written, because committing to a guessed format is the
// cheapest way to produce work that does not load. What the docs state, and
// what these tests pin:
//
//   - workspace rules live in `.agents/rules/` — it still accepts the older
//     singular `.agent/rules`, so the plural is deliberate, not a typo;
//   - MCP servers are configured in `.agents/mcp_config.json`, discovered by
//     both the IDE and the CLI, in the same `mcpServers` shape Claude Code uses;
//   - a rule file is capped at 12,000 characters.
//
// Its own `GEMINI.md` is already covered by the `gemini` row. Third-party
// guides also claim it reads `AGENTS.md`; its documentation does not say so, so
// nothing here relies on it.

test("antigravity is registered and writes to the paths its docs state", () => {
  assert.ok(ALL_TOOLS.includes("antigravity"));
  assert.ok(
    DEFAULT_TOOLS.includes("antigravity"),
    "it belongs inside a project, so it is not opt-in"
  );

  const paths = TOOLS.antigravity.files().map((f: any) => f.path.split(path.sep).join("/"));
  assert.deepEqual(paths.sort(), [".agents/mcp_config.json", ".agents/rules/specgate.md"]);
});

test("antigravity's MCP config is the same server Claude Code is given", () => {
  // One definition, two hosts. Two copies would drift into describing
  // different servers, and only one of them would be the real one.
  const config = TOOLS.antigravity.files().find((f: any) => f.path.endsWith("mcp_config.json"));
  const parsed = JSON.parse(config.contents);

  assert.ok(parsed.mcpServers["spec-driven"], "the csda server must be declared");
  assert.equal(parsed.mcpServers["spec-driven"].command, "npx");

  const plugin = TOOLS["claude-plugin"].files().find((f: any) => f.path.endsWith(".mcp.json"));
  assert.deepEqual(
    parsed.mcpServers,
    JSON.parse(plugin.contents).mcpServers,
    "the two hosts must be pointed at the same server"
  );
});

test("every rule file stays under Antigravity's 12,000 character limit", () => {
  // A documented hard limit, so it is worth a check rather than a hope: a rule
  // file over it is silently truncated, and a truncated rulebook is worse than
  // none because it looks complete.
  for (const file of TOOLS.antigravity.files()) {
    assert.ok(
      file.contents.length < 12000,
      `${file.path} is ${file.contents.length} characters, over Antigravity's limit`
    );
  }
});
