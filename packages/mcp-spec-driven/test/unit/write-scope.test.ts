"use strict";

/**
 * C10-04 — the write-scope contract on the MCP surface.
 *
 * The prompt has always told the agent not to rewrite the specification it is
 * being measured against. Nothing over MCP enforced it, and an agent that
 * cannot make a scenario pass can otherwise relax the scenario: the gate then
 * approves, which is the exact failure this product exists to prevent.
 *
 * The harness has verified this since 0.7.0 by diffing the worktree afterwards.
 * MCP cannot do that — a tool call has already written by the time it returns —
 * so it refuses beforehand instead.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  hasOpenChange,
  contractEditsAllowed,
  assertContractEditable,
} = require("../../src/native-tools");
const { TOOLS } = require("../../src/tools");

/** A project directory, optionally with an open change or the escape hatch. */
function project(options: { change?: string; allow?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-scope-"));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  fs.mkdirSync(path.join(dir, "docs", "specs", "changes", "archive"), { recursive: true });
  if (options.change) {
    fs.mkdirSync(path.join(dir, "docs", "specs", "changes", options.change), { recursive: true });
  }
  if (options.allow) {
    fs.mkdirSync(path.join(dir, ".csda"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".csda", "config.json"),
      JSON.stringify({ mcpAllowContractEdits: true }),
      "utf8"
    );
  }
  return dir;
}

const clean = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });

// ── what counts as an open change ────────────────────────────────────────────

test("an archive is not an open change", () => {
  // The archive always exists once anything has been archived. Counting it
  // would leave the guard permanently open on any mature project.
  const dir = project();
  try {
    assert.equal(hasOpenChange(dir), false);
  } finally {
    clean(dir);
  }
});

test("a change directory is an open change", () => {
  const dir = project({ change: "add-billing" });
  try {
    assert.equal(hasOpenChange(dir), true);
  } finally {
    clean(dir);
  }
});

test("a project with no changes directory at all is not open", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-scope-bare-"));
  try {
    assert.equal(hasOpenChange(dir), false);
  } finally {
    clean(dir);
  }
});

// ── the escape hatch ─────────────────────────────────────────────────────────

test("the escape hatch lives in the repository, not in the call", () => {
  const off = project();
  const on = project({ allow: true });
  try {
    assert.equal(contractEditsAllowed(off), false);
    assert.equal(contractEditsAllowed(on), true);
  } finally {
    clean(off);
    clean(on);
  }
});

test("a malformed config is not permission", () => {
  // A truncated or hand-broken config must fail closed. Reading `undefined`
  // from a parse error and treating it as consent is how a guard becomes
  // decoration.
  const dir = project();
  fs.mkdirSync(path.join(dir, ".csda"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".csda", "config.json"), "{ not json", "utf8");
  try {
    assert.equal(contractEditsAllowed(dir), false);
  } finally {
    clean(dir);
  }
});

test("any value other than true is not permission", () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, ".csda"), { recursive: true });
  for (const value of ["true", 1, "yes", null]) {
    fs.writeFileSync(
      path.join(dir, ".csda", "config.json"),
      JSON.stringify({ mcpAllowContractEdits: value }),
      "utf8"
    );
    assert.equal(contractEditsAllowed(dir), false, `${JSON.stringify(value)} was accepted`);
  }
  clean(dir);
});

// ── the refusal ──────────────────────────────────────────────────────────────

test("the refusal says what to do about it", () => {
  const dir = project();
  try {
    assert.throws(
      () => assertContractEditable("specgate_req_add", dir),
      (error: Error) => {
        assert.match(error.message, /specgate_req_add/, "does not name the tool");
        assert.match(error.message, /specgate change new/, "does not name the way forward");
        assert.match(error.message, /mcpAllowContractEdits/, "does not name the escape hatch");
        return true;
      }
    );
  } finally {
    clean(dir);
  }
});

test("an open change lets the edit through", () => {
  const dir = project({ change: "add-billing" });
  try {
    assert.doesNotThrow(() => assertContractEditable("specgate_req_add", dir));
  } finally {
    clean(dir);
  }
});

// ── which tools carry it ─────────────────────────────────────────────────────

test("the tools that write the contract are guarded, and the change cycle is not", () => {
  // `change *` is how a specification is edited on purpose. Guarding it would
  // leave no way to open the change the refusal asks for.
  for (const name of [
    "specgate_req_add",
    "specgate_req_link",
    "specgate_fix",
    "specgate_specops_sync",
  ]) {
    assert.equal(TOOLS[name] && TOOLS[name].editsContract, true, `${name} is not guarded`);
  }
  for (const name of Object.keys(TOOLS)) {
    if (!name.startsWith("csda_change_")) continue;
    assert.notEqual(TOOLS[name].editsContract, true, `${name} must stay usable`);
  }
});

test("append-only tools are not guarded either", () => {
  // `update_traceability` adds a row and refuses to touch one that exists, so
  // it can only add a term to the contract — never relax one. `WriteScope`
  // exempts newly created files for exactly this reason.
  assert.notEqual(TOOLS["update_traceability"].editsContract, true);
});

test("read-only tools are never guarded", () => {
  // A guard on a reading tool would be a bug that only shows up as an agent
  // mysteriously unable to look at anything.
  for (const name of ["specgate_status", "csda_plan", "validate_project", "read_spec"]) {
    const tool = TOOLS[name];
    if (!tool) continue;
    assert.notEqual(tool.editsContract, true, `${name} is read-only and must not be guarded`);
  }
});

test("a guarded tool refuses before it runs anything", () => {
  // The point of doing this before the spawn: by the time a CLI call returns,
  // the file is already written and there is nothing to refuse.
  const dir = project();
  try {
    assert.throws(
      () => TOOLS["specgate_req_add"].handler({ projectDir: dir }),
      /no change is open/
    );
  } finally {
    clean(dir);
  }
});
