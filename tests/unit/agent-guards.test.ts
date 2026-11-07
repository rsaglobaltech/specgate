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
