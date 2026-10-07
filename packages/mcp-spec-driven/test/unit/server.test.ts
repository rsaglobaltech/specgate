"use strict";

/**
 * Unit tests for the MCP JSON-RPC framing and dispatch.
 * These tests exercise readMessage / handleMessage in isolation by capturing
 * stdout writes via process.stdout monkey-patching.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { handleMessage, readMessage } from "../../src/server";

function captureStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(chunk.toString());
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join("");
}

function parseFramed(output) {
  // Extract the JSON body from a Content-Length-framed message
  const match = output.match(/Content-Length: \d+\r\n\r\n(\{.*\})$/s);
  assert.ok(match, `Output is not Content-Length framed: ${output}`);
  return JSON.parse(match[1]);
}

// ── readMessage framing ──────────────────────────────────────────────────────────

test("readMessage parses a Content-Length-framed JSON message", () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });
  const framed = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
  const messages = readMessage(Buffer.from(framed));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].method, "ping");
  assert.equal(messages[0].id, 1);
});

test("readMessage parses newline-delimited JSON when no Content-Length header", () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" });
  const messages = readMessage(Buffer.from(body + "\n"));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].method, "ping");
});

// ── handleMessage: initialize ────────────────────────────────────────────────────────

test("handleMessage responds to initialize with protocolVersion and serverInfo", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
  );
  const response = parseFramed(output);
  assert.equal(response.id, 1);
  assert.ok(response.result.protocolVersion);
  assert.ok(response.result.serverInfo.name);
  assert.ok(response.result.capabilities.tools);
});

// ── handleMessage: tools/list ────────────────────────────────────────────────────────

test("handleMessage responds to tools/list with all registered tools", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  );
  const response = parseFramed(output);
  assert.equal(response.id, 2);
  assert.ok(Array.isArray(response.result.tools));
  assert.ok(response.result.tools.length >= 5, "expected at least 5 tools");
  const names = response.result.tools.map((t) => t.name);
  assert.ok(names.includes("read_spec"));
  assert.ok(names.includes("validate_project"));
  assert.ok(names.includes("plan"));
  assert.ok(names.includes("mark_requirement_done"));
});

// ── handleMessage: tools/call ────────────────────────────────────────────────────────

test("handleMessage returns isError=true for failing tool call", () => {
  const output = captureStdout(() =>
    handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "read_spec", arguments: { projectDir: "/no/such/dir" } },
    })
  );
  const response = parseFramed(output);
  assert.equal(response.id, 3);
  assert.equal(response.result.isError, true);
  assert.ok(response.result.content[0].text.includes("Error"));
});

test("handleMessage returns -32601 for unknown tool", () => {
  const output = captureStdout(() =>
    handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "nonexistent_tool", arguments: {} },
    })
  );
  const response = parseFramed(output);
  assert.equal(response.id, 4);
  assert.equal(response.error.code, -32601);
});

test("handleMessage returns -32601 for unknown method", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", id: 5, method: "unknown/method" })
  );
  const response = parseFramed(output);
  assert.equal(response.id, 5);
  assert.equal(response.error.code, -32601);
});

// ── handleMessage: ping ────────────────────────────────────────────────────────────────────

test("handleMessage responds to ping with empty result", () => {
  const output = captureStdout(() => handleMessage({ jsonrpc: "2.0", id: 6, method: "ping" }));
  const response = parseFramed(output);
  assert.equal(response.id, 6);
  assert.deepEqual(response.result, {});
});

// ── handleMessage: notifications produce no output ───────────────────────

test("handleMessage notification (no id) produces no output for unknown method", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", method: "unknown/notification" })
  );
  assert.equal(output, "");
});

test("handleMessage notifications/initialized produces no output", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" })
  );
  assert.equal(output, "");
});

test("the server reports its real version, in either build layout", () => {
  // This file compiles into two places: the repository's root dist/ for tests
  // and the package's own dist/ for publishing. A fixed relative path to
  // package.json resolved in one and not the other, and the server silently
  // announced 0.0.0 over the wire.
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../../../../packages/mcp-spec-driven/package.json"),
      "utf8"
    )
  );
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", id: 99, method: "initialize", params: {} })
  );
  const response = parseFramed(output);
  assert.equal(response.result.serverInfo.version, pkg.version);
  assert.notEqual(response.result.serverInfo.version, "0.0.0");
});

// ── The csda_* → specgate_* rename ──────────────────────────────────────────────

test("tools are listed as specgate_*, never csda_*", () => {
  const output = captureStdout(() =>
    handleMessage({ jsonrpc: "2.0", id: 20, method: "tools/list", params: {} })
  );
  const names = parseFramed(output).result.tools.map((t) => t.name);
  assert.ok(names.includes("specgate_status"), names.join(", "));
  assert.ok(!names.some((n) => n.startsWith("csda_")), "no csda_ names in the listing");
});

test("a csda_* name from an older agent config still reaches the tool", () => {
  const call = (name) =>
    parseFramed(
      captureStdout(() =>
        handleMessage({
          jsonrpc: "2.0",
          id: 21,
          method: "tools/call",
          params: { name, arguments: { projectDir: "/definitely/not/a/project" } },
        })
      )
    );
  const legacy = call("csda_status");
  const current = call("specgate_status");
  assert.equal(legacy.error, undefined, "the old name resolves");
  assert.deepEqual(legacy.result, current.result, "to the same tool");
});
