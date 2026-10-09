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

test("update moves /specgate:verify to /specgate:check, keeping the team's edits", () => {
  // 0.15: `specgate verify` became the OpenSpec check (ADR-0030), so the slash
  // command that runs `check` took that name.
  const { migrateRenamedFiles } = require("../../scripts/cli/commands/project/UpdateCommand");
  const { renamedPaths } = require("../../scripts/agents/init");
  const pairs = renamedPaths().map(([a, b]: [string, string]) => `${a} -> ${b}`);
  assert.ok(
    pairs.includes(
      `${path.join(".claude", "commands", "specgate", "verify.md")} -> ${path.join(".claude", "commands", "specgate", "check.md")}`
    )
  );
  assert.ok(
    pairs.includes(
      `${path.join(".claude", "commands", "csda", "verify.md")} -> ${path.join(".claude", "commands", "specgate", "check.md")}`
    )
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-rename-verify-"));
  try {
    const old = path.join(dir, ".claude", "commands", "specgate", "verify.md");
    fs.mkdirSync(path.dirname(old), { recursive: true });
    fs.writeFileSync(old, "# team note: run it twice\n");
    const results = migrateRenamedFiles(dir, { dryRun: false });
    const moved = path.join(dir, ".claude", "commands", "specgate", "check.md");
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.readFileSync(moved, "utf8"), "# team note: run it twice\n");
    assert.ok(results.some((r: any) => r.outcome === "renamed"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── init/adopt install for the agents they find (simplification plan, phase 2) ──

function codeRepo(extra: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-init-agents-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"x","version":"1.0.0","scripts":{"test":"echo ok"}}'
  );
  fs.mkdirSync(path.join(dir, "lib"));
  fs.writeFileSync(path.join(dir, "lib", "i.js"), "module.exports = {};\n");
  for (const [rel, body] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const initIn = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [path.join(ROOT_DIR, "bin", "specgate.js"), "init", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

test("init installs the /specgate:* commands for the agent the project uses, and nothing else", () => {
  const { detectAgents } = require("../../scripts/agents/detect");
  const dir = codeRepo({ "CLAUDE.md": "# our notes\n", ".cursor/settings.json": "{}" });
  try {
    assert.deepEqual(detectAgents(dir).sort(), ["claude", "cursor"]);
    const r = initIn(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".claude", "commands", "specgate", "check.md")));
    assert.ok(fs.existsSync(path.join(dir, ".cursor", "rules", "specgate.mdc")));
    assert.equal(
      fs.existsSync(path.join(dir, ".windsurf")),
      false,
      "no files for agents nobody uses"
    );
    assert.equal(
      fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"),
      "# our notes\n",
      "never overwritten"
    );
    assert.match(r.stdout, /\/specgate:explore/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("init with no agent found says how to install, and --no-agents installs nothing", () => {
  const bare = codeRepo();
  const opted = codeRepo({ "CLAUDE.md": "# x\n" });
  try {
    const r = initIn(bare);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /none detected[\s\S]*specgate agents init --tool/);
    assert.equal(fs.existsSync(path.join(bare, ".claude")), false);

    const q = initIn(opted, "--no-agents");
    assert.equal(q.status, 0, q.stdout + q.stderr);
    assert.equal(fs.existsSync(path.join(opted, ".claude", "commands")), false);
  } finally {
    fs.rmSync(bare, { recursive: true, force: true });
    fs.rmSync(opted, { recursive: true, force: true });
  }
});

// ── AGENTS.md is the agent contract (ADR-0031) ──────────────────────────────

test("init writes one short AGENTS.md per project type, and no AI_RULES.md", () => {
  for (const type of ["backend", "frontend", "mobile"]) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `specgate-agentsmd-${type}-`));
    try {
      const cfg = path.join(tmp, "p.config");
      fs.writeFileSync(
        cfg,
        [
          `PROJECT_NAME="X"`,
          `PROJECT_SLUG="x"`,
          `PROJECT_TYPE="${type}"`,
          `DOMAIN="d"`,
          `STACK="s"`,
          `API_STYLE="a"`,
          `TESTING="t"`,
          `LANG="en"`,
        ].join("\n") + "\n"
      );
      const r = spawnSync(
        process.execPath,
        [CLI, "init", "--config", cfg, "--out", tmp, "--force", "--no-git"],
        { encoding: "utf8" }
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const agents = fs.readFileSync(path.join(tmp, "x", "AGENTS.md"), "utf8");
      const lines = agents.trimEnd().split("\n").length;
      assert.ok(lines <= 62, `${type}: ${lines} lines — 60 plus the two block markers`);
      assert.match(agents, /specgate:begin/);
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(agents), `${type}: unrendered placeholder`);
      assert.equal(fs.existsSync(path.join(tmp, "x", "AI_RULES.md")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test("update folds AI_RULES.md into AGENTS.md: verbatim, below the block, the old file gone", () => {
  const { migrateAiRules, writtenByOlderSpecgate } = require("../../scripts/agents/contract-file");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-migrate-"));
  try {
    fs.writeFileSync(
      path.join(dir, "AI_RULES.md"),
      "# AI Rules — shop\n\n- Stack: Node 22, Fastify\n- Testing: vitest\n\nNever log a card number.\n"
    );
    // What an older `agents init` wrote: replaced, not kept below the block.
    fs.writeFileSync(
      path.join(dir, "AGENTS.md"),
      "# Agent instructions\n\nThis project uses Spec-Driven Development through the `specgate` CLI.\n"
    );
    assert.equal(
      writtenByOlderSpecgate(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8")),
      true
    );

    const dry = migrateAiRules(dir, { dryRun: true });
    assert.equal(dry.moved, true);
    assert.ok(fs.existsSync(path.join(dir, "AI_RULES.md")), "a dry run moves nothing");

    const r = migrateAiRules(dir);
    assert.equal(r.agents, "replaced");
    assert.equal(fs.existsSync(path.join(dir, "AI_RULES.md")), false);
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(agents, /# AGENTS\.md — shop/);
    assert.match(agents, /Stack: Node 22, Fastify/);
    assert.match(agents, /## Project rules \(from AI_RULES\.md\)[\s\S]*Never log a card number\./);
    assert.doesNotMatch(agents, /Spec-Driven Development through the/);
    assert.equal(migrateAiRules(dir).moved, false, "nothing left to move");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a team's own AGENTS.md is kept; only Specgate's block changes", () => {
  const { mergeContract, outsideBlock } = require("../../scripts/agents/contract-file");
  const team = "# Our agent notes\n\nUse pnpm.\n";
  const once = mergeContract(team, "# Contract v1\n");
  const twice = mergeContract(once, "# Contract v2\n");
  assert.equal(outsideBlock(twice), team.trim());
  assert.match(twice, /Contract v2/);
  assert.doesNotMatch(twice, /Contract v1/);
});
