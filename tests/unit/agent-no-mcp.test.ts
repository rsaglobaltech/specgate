/**
 * REQ-650: the agent that drafts, builds or answers runs without the person's
 * MCP servers, and may run the gate's architecture check besides its tests.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { withoutMcp, withTestPermission } = require("../../scripts/lib/agent-permission");
const { withWritePermission } = require("../../scripts/draft/confined-agent");

test("REQ-650 SCN-650a: claude in print mode loads no MCP server — the harness's agent, a drafting agent, one with its own permission; a command with its own MCP configuration is kept", () => {
  const harness =
    "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude";
  assert.equal(
    withoutMcp(harness),
    "claude --strict-mcp-config --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude"
  );
  assert.match(withWritePermission("claude -p").command, /^claude --strict-mcp-config /);
  assert.equal(withoutMcp(withoutMcp("claude -p")), "claude --strict-mcp-config -p", "once");
  assert.equal(
    withoutMcp("claude -p --mcp-config tools.json"),
    "claude -p --mcp-config tools.json"
  );
  assert.equal(withoutMcp("codex exec -"), "codex exec -");
  assert.equal(withoutMcp("claude"), "claude", "not in print mode");
});

test("REQ-650 SCN-650b: the agent may run the test command and the architecture check, and no other command", () => {
  const r = withTestPermission(
    "claude --permission-mode acceptEdits -p",
    "npm test",
    "npm run arch"
  );
  assert.deepEqual(r.allowed, ["npm test", "npm run arch"]);
  assert.match(r.command, /--allowedTools "Bash\(npm test:\*\)" "Bash\(npm run arch:\*\)"/);
  assert.deepEqual(
    withTestPermission("claude --permission-mode acceptEdits -p", "", "").allowed,
    []
  );
});
