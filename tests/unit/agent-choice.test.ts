/**
 * REQ-596 — the agent a project uses, not Claude for every project: Codex
 * known with the command its CLI accepts today, and chosen when the project
 * carries Codex's folder.
 */
export {};
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");
const {
  AGENT_COMMANDS,
  agentCommand,
  preferredAgent,
} = require("../../scripts/cli/commands/project/readiness");
const { presetProfiles } = require("../../scripts/lib/studio-route");

function dirWith(...entries: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-choice-"));
  for (const e of entries) {
    if (e.endsWith(".md")) fs.writeFileSync(path.join(dir, e), "# x\n");
    else fs.mkdirSync(path.join(dir, e), { recursive: true });
  }
  return dir;
}

test("REQ-596: Codex is known, with the command its CLI accepts today", () => {
  assert.equal(AGENT_COMMANDS.codex, "codex exec -s workspace-write - < {prompt_file}");
  assert.equal(agentCommand("codex"), "codex exec -s workspace-write - < {prompt_file}");
  assert.doesNotMatch(agentCommand("codex"), /--full-auto/);
  assert.match(
    agentCommand("claude"),
    /^claude .*--permission-mode acceptEdits -p < \{prompt_file\}/
  );
  for (const p of presetProfiles("codex")) assert.doesNotMatch(p.agent, /--full-auto/);
});

test("REQ-596 SCN-596a: a project with Codex's folder gets Codex, though Claude is installed too", () => {
  const both = () => true;
  const codex = dirWith(".codex");
  const claude = dirWith(".claude");
  const plain = dirWith();
  try {
    assert.equal(preferredAgent(codex, undefined, both), "codex");
    assert.equal(preferredAgent(claude, undefined, both), "claude");
    assert.equal(preferredAgent(plain, undefined, both), "claude", "no sign: the first installed");
    assert.equal(
      preferredAgent(plain, undefined, (p: string) => p === "codex"),
      "codex",
      "only Codex installed"
    );
    assert.equal(
      preferredAgent(codex, undefined, (p: string) => p === "claude"),
      "claude",
      "the project's agent not installed: one that is"
    );
    assert.equal(
      preferredAgent(plain, undefined, () => false),
      null
    );
  } finally {
    for (const d of [codex, claude, plain]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("REQ-596 SCN-596b: `agents init --tool codex` sets Codex as the agent", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agent-choice-init-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--no-agents"],
      { encoding: "utf8" }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const dir = path.join(parent, fs.readdirSync(parent)[0]);
    const cfg = path.join(dir, "harness.config.yaml");
    if (fs.existsSync(cfg)) {
      fs.writeFileSync(cfg, fs.readFileSync(cfg, "utf8").replace(/^agent:.*\n/m, ""));
    }
    const r = spawnSync(process.execPath, [CLI, "agents", "init", "--tool", "codex", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(
      fs.readFileSync(cfg, "utf8"),
      /^agent: "?codex exec -s workspace-write - < \{prompt_file\}"?$/m
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-597 SCN-597a: `agents init --tool codex` gives Codex the steps, as skills it reads", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agent-choice-skills-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--no-agents"],
      { encoding: "utf8" }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const dir = path.join(parent, fs.readdirSync(parent)[0]);
    const r = spawnSync(process.execPath, [CLI, "agents", "init", "--tool", "codex", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const skills = path.join(dir, ".agents", "skills");
    const names = fs.readdirSync(skills).sort();
    for (const step of ["specgate-apply", "specgate-check", "specgate-draft"]) {
      assert.ok(names.includes(step), `${step} in ${names.join(", ")}`);
      assert.match(fs.readFileSync(path.join(skills, step, "SKILL.md"), "utf8"), /^---\nname: /);
    }
    // Another tool alone does not get them.
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "agent-choice-cursor-"));
    try {
      fs.cpSync(dir, other, { recursive: true });
      fs.rmSync(path.join(other, ".agents"), { recursive: true, force: true });
      spawnSync(process.execPath, [CLI, "agents", "init", "--tool", "cursor", "--json"], {
        cwd: other,
        encoding: "utf8",
      });
      assert.equal(fs.existsSync(path.join(other, ".agents", "skills")), false);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-598: the prompt for each situation, with the project's next step and its agents' steps", () => {
  const { agentPrompt } = require("../../packages/core/src/domain/AgentKickoff");
  const state = {
    next: "specgate propose --from-brief bookings",
    undrafted: ["bookings", "payments"],
    installed: { claude: false, opencode: true, codex: true },
  };
  const start = agentPrompt("start", state);
  assert.match(start, /Read AGENTS\.md first/);
  assert.match(start, /Right now that is: `specgate propose --from-brief bookings`/);
  assert.match(start, /modules not drafted yet: bookings, payments/);
  assert.match(start, /OpenCode: \/specgate-draft/);
  assert.match(start, /Codex: \$specgate-draft/);
  assert.doesNotMatch(start, /Claude Code:/, "only the agents the project has");
  assert.match(start, /Never edit spec\.md, features\/ or docs\/specs\/ to make a test pass/);
  const draft = agentPrompt("draft", state, "payments");
  assert.match(draft, /`specgate propose --from-brief payments`/);
  assert.match(draft, /Stop there/);
  const build = agentPrompt("build", { ...state, undrafted: [] });
  assert.match(build, /Write its test first/);
  assert.match(build, /specgate apply <REQ>/);
});

test("REQ-598 SCN-598a: `specgate status --prompt` prints the prompt from the project, --json gives it as data", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agent-prompt-"));
  try {
    spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--no-agents"],
      {
        encoding: "utf8",
      }
    );
    const dir = path.join(parent, fs.readdirSync(parent)[0]);
    spawnSync(process.execPath, [CLI, "agents", "init", "--tool", "codex"], {
      cwd: dir,
      encoding: "utf8",
    });
    const text = spawnSync(process.execPath, [CLI, "status", "--prompt"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(text.status, 0, text.stdout + text.stderr);
    assert.match(text.stdout, /This project uses specgate/);
    assert.match(text.stdout, /Codex: \$specgate-draft/);
    const json = JSON.parse(
      spawnSync(process.execPath, [CLI, "status", "--prompt", "build", "--json"], {
        cwd: dir,
        encoding: "utf8",
      }).stdout
    );
    assert.equal(json.prompt.kind, "build");
    assert.match(json.prompt.text, /Build the next requirement/);
    // Without --prompt, status is what it was.
    const plain = spawnSync(process.execPath, [CLI, "status", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.ok(JSON.parse(plain.stdout).nextCommand);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
