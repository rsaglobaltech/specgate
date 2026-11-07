/**
 * The agent guards (change agent-guards): what a session is told when it
 * starts, the edit that waits for its test, and the same for OpenCode.
 *
 * Every hook here shares one rule with the gate hook: anything unexpected
 * lets the agent through. A guard that breaks a session over a missing file
 * is worse than none.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const { openChanges } = require("../../scripts/plugin/project-state");
const session = require("../../scripts/plugin/session-hook");
const { TOOLS } = require("../../scripts/agents/init");

interface Req {
  id: string;
  status: string;
}

/** A spec-driven project with the given open changes, and an archived one that must not count. */
function project(changes: Record<string, Req[]>, opts: { spec?: boolean } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-guards-"));
  if (opts.spec !== false) fs.writeFileSync(path.join(root, "spec.md"), "# Spec\n");
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  const delta = (reqs: Req[]) =>
    "# Delta — x\n\n## ADDED Requirements\n\n" +
    reqs
      .map(
        (r) =>
          `### Requirement: ${r.id} — something\n\nThe system SHALL do it.\n\n` +
          `#### Scenario: it\n\n- GIVEN a\n- WHEN b\n- THEN c\n\n` +
          `<!-- specgate:trace status=${r.status} actor=Developer kind=functional -->\n`
      )
      .join("\n");
  for (const [id, reqs] of Object.entries(changes)) {
    write(`docs/specs/changes/${id}/change.yaml`, "specgate_change_version: 1\n");
    write(`docs/specs/changes/${id}/specs/x/spec.md`, delta(reqs));
  }
  write(
    "docs/specs/changes/archive/2026-01-01-old/specs/x/spec.md",
    delta([{ id: "REQ-001", status: "Draft" }])
  );
  return root;
}

const MODULE_MAP = {
  "module-map": [
    { id: "REQ-311", status: "Implemented" },
    { id: "REQ-312", status: "Draft" },
    { id: "REQ-313", status: "Draft" },
  ],
};

test("REQ-420: open changes and their requirements, read from docs/specs/changes", () => {
  const root = project(MODULE_MAP);
  assert.deepEqual(openChanges(root), [
    {
      id: "module-map",
      requirements: ["REQ-311", "REQ-312", "REQ-313"],
      pending: ["REQ-312", "REQ-313"],
    },
  ]);
});

test("REQ-420 SCN-420a: a new session is told the project is spec-driven, the open change and what comes next", () => {
  const root = project(MODULE_MAP);
  const text: string = session.sessionContext(root);
  assert.match(text, /spec-driven/);
  assert.match(text, /`spec\.md`, `features\/` and `docs\/specs\/`/);
  assert.match(text, /module-map/);
  assert.match(text, /REQ-312, REQ-313/);
  assert.match(text, /Next: REQ-312/);
  assert.match(text, /specgate apply REQ-312/);
  assert.match(text, /write the test first/i);
  assert.match(text, /never archive/i);
  assert.ok(text.length < 2000, `${text.length} characters`);
});

test("REQ-420: no open change says how to open one", () => {
  const text: string = session.sessionContext(project({}));
  assert.match(text, /No change is open/);
  assert.match(text, /specgate propose <change-id>/);
});

test("REQ-420: a folder without spec.md, or any error, adds nothing", () => {
  assert.equal(session.sessionContext(project(MODULE_MAP, { spec: false })), "");
  assert.equal(session.sessionContext(path.join(os.tmpdir(), "no-such-folder-agent-guards")), "");
  // The hook's own entry: bad stdin is not a reason to break a session.
  assert.equal(session.main("not json"), 0);
});

test("REQ-420: the plugin registers the SessionStart hook and ships its scripts", () => {
  const files = TOOLS["claude-plugin"].files();
  const hooks = JSON.parse(files.find((f: { path: string }) => f.path.endsWith("hooks.json")).contents);
  const command = hooks.hooks.SessionStart[0].hooks[0].command;
  assert.equal(command, 'node "${CLAUDE_PLUGIN_ROOT}/scripts/session-hook.js"');
  const paths = files.map((f: { path: string }) => f.path.split(path.sep).join("/"));
  assert.ok(paths.includes("scripts/session-hook.js"), paths.join("\n"));
  assert.ok(paths.includes("scripts/project-state.js"), "the hook's helper travels with it");
});

// ── REQ-421: an edit to source code waits for a test that names the requirement ──

const guard = require("../../scripts/plugin/guard-hook");
const { spawnSync } = require("node:child_process");

/** The project as a git repository with one commit, so the working tree has a baseline. */
function gitProject(changes: Record<string, Req[]>): string {
  const root = project(changes);
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export {};\n");
  const g = (...a: string[]) =>
    spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", ...a], {
      cwd: root,
      encoding: "utf8",
    });
  g("init", "-q");
  g("add", "-A");
  g("commit", "-qm", "init");
  return root;
}

const ALL_PENDING = {
  "module-map": ["REQ-311", "REQ-312", "REQ-318"].map((id) => ({ id, status: "Draft" })),
};

/** What the guard says to a Write of `rel` in `root`. */
function edit(root: string, rel: string, env: Record<string, string | undefined> = {}) {
  return guard.decide(
    { cwd: root, tool_name: "Write", tool_input: { file_path: path.join(root, rel) } },
    env
  );
}

test("REQ-421 SCN-421a: code before its test is refused, allowed once a test names the requirement", () => {
  const root = gitProject(ALL_PENDING);
  const denied = edit(root, "src/core/map/scan.ts");
  assert.equal(denied.allow, false);
  assert.match(denied.message, /write the test for REQ-311 first/);
  assert.match(denied.message, /module-map/);

  // The test itself is never refused.
  assert.equal(edit(root, "test/module-map.test.ts").allow, true);
  fs.mkdirSync(path.join(root, "test"));
  fs.writeFileSync(path.join(root, "test", "module-map.test.ts"), "test('REQ-311: a map', () => {});\n");
  assert.equal(edit(root, "src/core/map/scan.ts").allow, true);
});

test("REQ-421: a test that names no requirement of an open change does not count", () => {
  const root = gitProject(ALL_PENDING);
  fs.writeFileSync(path.join(root, "src", "other.test.ts"), "test('REQ-001 elsewhere', () => {});\n");
  assert.equal(edit(root, "src/core/map/scan.ts").allow, false);
  // A committed test is not new work: only new or modified files count.
  assert.equal(edit(root, "src/index.ts").allow, false);
});

test("REQ-421: with no open change, code waits for one", () => {
  const root = gitProject({});
  const d = edit(root, "src/index.ts");
  assert.equal(d.allow, false);
  assert.match(d.message, /No change is open/);
  assert.match(d.message, /specgate propose <change-id>/);
});

test("REQ-421: specs, features, docs, configuration and Markdown are never refused", () => {
  const root = gitProject({});
  for (const rel of [
    "spec.md",
    "features/x/REQ-1.feature",
    "docs/specs/changes/a/specs/x/spec.md",
    "README.md",
    "package.json",
    "tsconfig.json",
    "pom.xml",
    ".github/workflows/ci.yml",
    "src/test/java/com/x/InvoiceTest.java",
    "tests/unit/a.test.ts",
    "app/models/invoice_spec.rb",
    "pkg/invoice_test.go",
    "tests/test_invoice.py",
  ]) {
    assert.equal(edit(root, rel).allow, true, rel);
  }
});

test("REQ-421: off by setting or variable, and silent outside a spec-driven git project", () => {
  const root = gitProject({});
  assert.equal(edit(root, "src/index.ts", { SPECGATE_GUARD: "off" }).allow, true);
  fs.mkdirSync(path.join(root, ".specgate"));
  fs.writeFileSync(path.join(root, ".specgate", "config.json"), '{"agent_guard":"off"}\n');
  assert.equal(edit(root, "src/index.ts").allow, true);

  const plain = project({}, { spec: false });
  assert.equal(edit(plain, "src/index.ts").allow, true, "no spec.md");
  const noGit = project({});
  assert.equal(edit(noGit, "src/index.ts").allow, true, "no git: the working tree is unknown");
  const root2 = gitProject({});
  assert.equal(
    guard.decide({ cwd: root2, tool_name: "Write", tool_input: { file_path: path.join(os.tmpdir(), "x.ts") } }, {})
      .allow,
    true,
    "a file outside the project"
  );
  assert.equal(guard.decide({ cwd: root2, tool_name: "Read", tool_input: {} }, {}).allow, true);
});

test("REQ-421: the hook's exit code and message, and its place in the plugin", () => {
  const root = gitProject({});
  const raw = JSON.stringify({
    cwd: root,
    tool_name: "Edit",
    tool_input: { file_path: path.join(root, "src", "index.ts") },
  });
  assert.equal(guard.main(raw, {}), 2, "2 denies the tool call; stderr is what the agent reads");
  assert.equal(guard.main("not json", {}), 0);

  const files = TOOLS["claude-plugin"].files();
  const hooks = JSON.parse(files.find((f: { path: string }) => f.path.endsWith("hooks.json")).contents);
  assert.equal(hooks.hooks.PreToolUse[0].matcher, "Write|Edit|MultiEdit|NotebookEdit");
  assert.equal(hooks.hooks.PreToolUse[0].hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/scripts/guard-hook.js"');
  const { KEYS } = require("../../scripts/config_set");
  assert.deepEqual(KEYS.agent_guard.values, ["on", "off"]);
});

// ── REQ-422: OpenCode gets the same three guards ──

const bridge = require("../../scripts/plugin/opencode-bridge");

/** A stand-in for OpenCode's client: records what the plugin sends back to a session. */
function fakeClient() {
  const sent: { id: string; text: string }[] = [];
  return {
    sent,
    session: {
      prompt: async (o: { path: { id: string }; body: { parts: { text: string }[] } }) => {
        sent.push({ id: o.path.id, text: o.body.parts.map((p) => p.text).join("") });
      },
    },
  };
}

test("REQ-422 SCN-422a: OpenCode refuses code before its test, and a new session hears the open change", async () => {
  const root = gitProject(ALL_PENDING);
  const client = fakeClient();
  const hooks = bridge.createHooks({ directory: root, client }, { env: {} });

  await assert.rejects(
    hooks["tool.execute.before"]({ tool: "write", sessionID: "s", callID: "c" }, { args: { filePath: path.join(root, "src/core/map/scan.ts") } }),
    /write the test for REQ-311 first/
  );
  await assert.rejects(
    hooks["tool.execute.before"](
      { tool: "apply_patch", sessionID: "s", callID: "c" },
      { args: { patchText: "*** Begin Patch\n*** Add File: src/core/map/scan.ts\n+x\n*** End Patch" } }
    ),
    /write the test for REQ-311 first/
  );
  // A test, and anything that is not a write, goes through.
  await hooks["tool.execute.before"]({ tool: "edit", sessionID: "s", callID: "c" }, { args: { filePath: "test/module-map.test.ts" } });
  await hooks["tool.execute.before"]({ tool: "read", sessionID: "s", callID: "c" }, { args: { filePath: "src/core/map/scan.ts" } });

  const system = { system: [] as string[] };
  await hooks["experimental.chat.system.transform"]({ sessionID: "s" }, system);
  assert.match(system.system.join("\n"), /module-map/);
  assert.match(system.system.join("\n"), /REQ-311/);
});

test("REQ-422: a red gate is sent back once per user message when the session goes idle", async () => {
  const root = gitProject(ALL_PENDING);
  const client = fakeClient();
  let red = true;
  const hooks = bridge.createHooks(
    { directory: root, client },
    {
      env: {},
      runValidate: () =>
        red
          ? { ok: false, diagnostics: [{ code: "TDD-1", message: "REQ-311 has no test", fix: "write it" }] }
          : { ok: true, diagnostics: [] },
    }
  );
  const idle = () => hooks.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } });
  await hooks["chat.message"]({ sessionID: "s1", messageID: "m1" }, { message: {}, parts: [] });
  await idle();
  assert.equal(client.sent.length, 1);
  assert.match(client.sent[0].text, /TDD-1/);
  await idle();
  assert.equal(client.sent.length, 1, "told once per user message, never looped");
  await hooks["chat.message"]({ sessionID: "s1", messageID: "m2" }, { message: {}, parts: [] });
  red = false;
  await idle();
  assert.equal(client.sent.length, 1, "a green gate says nothing");
});

test("REQ-422: outside a spec-driven project the plugin does nothing", async () => {
  const root = project({}, { spec: false });
  const client = fakeClient();
  const hooks = bridge.createHooks(
    { directory: root, client },
    { env: {}, runValidate: () => ({ ok: false, diagnostics: [{ code: "x" }] }) }
  );
  await hooks["tool.execute.before"]({ tool: "write", sessionID: "s", callID: "c" }, { args: { filePath: "src/a.ts" } });
  const system = { system: [] as string[] };
  await hooks["experimental.chat.system.transform"]({ sessionID: "s" }, system);
  assert.deepEqual(system.system, []);
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: "s" } } });
  assert.equal(client.sent.length, 0);
});

test("REQ-422: agents init --tool opencode-plugin writes the plugin and the scripts it loads", () => {
  const files = TOOLS["opencode-plugin"].files();
  const paths = files.map((f: { path: string }) => f.path.split(path.sep).join("/"));
  for (const p of [
    ".opencode/plugin/specgate.js",
    ".opencode/specgate/opencode-bridge.cjs",
    ".opencode/specgate/guard-hook.cjs",
    ".opencode/specgate/session-hook.cjs",
    ".opencode/specgate/gate-hook.cjs",
    ".opencode/specgate/project-state.cjs",
  ]) {
    assert.ok(paths.includes(p), `${p} missing:\n${paths.join("\n")}`);
  }
  const plugin = files.find((f: { path: string }) => f.path.endsWith("specgate.js")).contents;
  assert.match(plugin, /createRequire\(import\.meta\.url\)/);
  assert.match(plugin, /\.\.\/specgate\/opencode-bridge\.cjs/);
  assert.match(plugin, /export const Specgate = async/);
  // The copies load each other by their .cjs names, whatever package.json says about modules.
  for (const f of files.filter((x: { path: string }) => x.path.endsWith(".cjs"))) {
    assert.doesNotMatch(f.contents, /require\("\.\/[\w-]+"\)/, f.path);
  }
  assert.equal(TOOLS["opencode-plugin"].optIn, true);
});

// ── REQ-423: installed once per user, quiet where there are no specs ──

import { runCli, ROOT_DIR } from "../helpers/cli";

/** A home folder of its own, so a test never writes into the developer's. */
function home(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-guards-home-"));
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, XDG_CONFIG_HOME: path.join(dir, ".config") };
  return { dir, env };
}

test("REQ-423 SCN-423a: one install for every repository; a second run changes nothing", () => {
  const { dir, env } = home();
  const first = runCli(["agents", "install", "--global"], { cwd: dir, env });
  assert.equal(first.status, 0, first.stderr);
  const pluginDir = path.join(dir, ".config", "opencode");
  assert.ok(fs.existsSync(path.join(pluginDir, "plugin", "specgate.js")), first.stdout);
  assert.ok(fs.existsSync(path.join(pluginDir, "specgate", "guard-hook.cjs")));
  // Claude Code installs plugins itself: the two commands, from this repository's marketplace.
  assert.match(first.stdout, /\/plugin marketplace add rsaglobaltech\/specgate/);
  assert.match(first.stdout, /\/plugin install specgate@specgate/);

  const again = runCli(["agents", "install", "--global", "--json"], { cwd: dir, env });
  assert.equal(again.status, 0, again.stderr);
  const files = JSON.parse(again.stdout).files as { path: string; action: string }[];
  assert.ok(files.length > 0);
  assert.deepEqual([...new Set(files.map((f) => f.action))], ["unchanged"]);
});

test("REQ-423: --tool limits the install to one tool; without --global it says what it does", () => {
  const { dir, env } = home();
  const claude = runCli(["agents", "install", "--global", "--tool", "claude-plugin"], { cwd: dir, env });
  assert.equal(claude.status, 0, claude.stderr);
  assert.ok(!fs.existsSync(path.join(dir, ".config", "opencode")), "OpenCode left alone");
  const local = runCli(["agents", "install"], { cwd: dir, env });
  assert.notEqual(local.status, 0);
  assert.match(local.stderr + local.stdout, /--global/);
  assert.match(local.stderr + local.stdout, /agents init --tool opencode-plugin/);
});

test("REQ-423: the repository is a Claude Code marketplace for its plugin", () => {
  const market = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, ".claude-plugin", "marketplace.json"), "utf8"));
  assert.equal(market.name, "specgate");
  const entry = market.plugins.find((p: { name: string }) => p.name === "specgate");
  assert.equal(entry.source, "./packages/claude-plugin");
  assert.ok(fs.existsSync(path.join(ROOT_DIR, "packages", "claude-plugin", ".claude-plugin", "plugin.json")));
});
