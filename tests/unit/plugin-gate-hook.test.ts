/**
 * The `Stop` hook, and the one thing it must never do.
 *
 * A hook that blocks whenever the gate is red can trap a session forever: the
 * agent tries, fails, is blocked, tries again. Every test here that looks like
 * it is about bookkeeping is really about that.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const { decide, renderFindings } = require("../../scripts/plugin/gate-hook");

const RED = () => ({
  ok: false,
  diagnostics: [{ code: "strict_tdd_1", message: "no test", fix: "write it" }],
});
const GREEN = () => ({ ok: true, diagnostics: [] });
const never = () => false;
const always = () => true;

test("a green gate says nothing and blocks nothing", () => {
  const d = decide({ cwd: "/p", prompt_id: "a" }, GREEN, never);
  assert.equal(d.block, false);
  assert.equal(d.message, "");
});

test("a red gate blocks the stop, with the finding and its fix", () => {
  const d = decide({ cwd: "/p", prompt_id: "a" }, RED, never);
  assert.equal(d.block, true);
  assert.match(d.message, /strict_tdd_1/);
  assert.match(d.message, /fix: write it/, "a finding without its fix is not actionable");
});

test("the same prompt is never blocked twice", () => {
  // The anti-trap rule. The agent has been told; a human needs the answer more
  // than the loop needs another turn.
  const d = decide({ cwd: "/p", prompt_id: "a" }, RED, always);
  assert.equal(d.block, false);
  assert.match(d.message, /strict_tdd_1/, "it still reports, it just stops blocking");
});

test("a project the gate cannot run in is left alone", () => {
  // No spec.md, or no specgate on PATH. Breaking a session over that would be
  // worse than saying nothing.
  const d = decide(
    { cwd: "/p", prompt_id: "a" },
    () => {
      throw new Error("not a spec-driven project");
    },
    never
  );
  assert.equal(d.block, false);
  assert.equal(d.message, "");
});

test("a hook input with no prompt id still works", () => {
  const d = decide({ cwd: "/p" }, RED, never);
  assert.equal(d.block, true);
});

test("findings are capped so the agent gets a message it can read", () => {
  const many = {
    ok: false,
    diagnostics: Array.from({ length: 25 }, (_, i) => ({ code: `c${i}`, message: `m${i}` })),
  };
  const message = renderFindings(many.diagnostics);
  assert.match(message, /… and 15 more\./);
  assert.equal(message.includes("c10"), false, "the eleventh finding is not listed");
});

// ── The plugin the generator produces ─────────────────────────────────────────

const PLUGIN = path.resolve(__dirname, "../../../packages/claude-plugin");

test("the plugin's hook command names a file the plugin actually contains", () => {
  // The failure this guards is the one this repository cares about most: a
  // manifest that points at something that is not there. It shipped once
  // during development — the hook was declared before it was bundled.
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, "hooks", "hooks.json"), "utf8"));
  const commands = hooks.hooks.Stop.flatMap((entry: any) => entry.hooks.map((h: any) => h.command));
  assert.ok(commands.length > 0, "the plugin declares no Stop hook");

  for (const command of commands) {
    const rel = command
      .replace(/^node\s+/, "")
      .replace(/"/g, "")
      .replace("${CLAUDE_PLUGIN_ROOT}/", "");
    assert.ok(
      fs.existsSync(path.join(PLUGIN, rel)),
      `hooks.json runs ${rel}, which the plugin does not contain`
    );
  }
});

test("the manifest sits where the plugin reference says, and names itself", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")
  );
  assert.equal(manifest.name, "specgate");
  assert.match(manifest.version, /^\d+\.\d+\.\d+/);
});

test("every component directory is at the plugin root, not inside .claude-plugin", () => {
  // The one hard constraint of the plugin layout.
  const inside = fs.readdirSync(path.join(PLUGIN, ".claude-plugin"));
  assert.deepEqual(inside, ["plugin.json"]);
  for (const dir of ["commands", "hooks", "scripts"]) {
    assert.ok(fs.existsSync(path.join(PLUGIN, dir)), `${dir}/ must be at the plugin root`);
  }
});

test("the plugin ships one command per step of the loop", () => {
  const { STEPS } = require("../../scripts/agents/commands");
  const shipped = fs
    .readdirSync(path.join(PLUGIN, "commands", "specgate"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
  assert.deepEqual(
    shipped,
    STEPS.map((s: any) => s.name).sort(),
    "the plugin's commands have drifted from the definition every other tool uses"
  );
});
