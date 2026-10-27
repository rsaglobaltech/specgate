"use strict";

/**
 * REQ-182 — The live view shows the run's work queue and the agent's session.
 *
 * Watching a run, an adopter saw the same modules twice, in the sidebar and in
 * the matrix, and nothing about the agent itself: which model ran, how full its
 * context was, what it cost, and what it was told.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** Every temp folder this file makes, removed once its tests are done, with retries for Windows. */
const madeDirs: string[] = [];
function made(dir: string): string {
  madeDirs.push(dir);
  return dir;
}
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const { spawnSync } = require("node:child_process");
const { readLive } = require("../../scripts/lib/live-model");
const { livePage } = require("../../scripts/lib/live-page");
const {
  keepPrompt,
  promptFileFor,
  writeQueue,
  eventsFileFor,
} = require("../../scripts/lib/harness-events");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function tmp() {
  return made(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-live-agent-")));
}

function events(file: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l: string) => JSON.parse(l));
}

test("REQ-182 SCN-182a: the Claude adapter records the model, the context per message and the session's totals", () => {
  const dir = tmp();
  const file = path.join(dir, "REQ-007.jsonl");
  const usage = (input: number, read: number, out: number) => ({
    input_tokens: input,
    cache_read_input_tokens: read,
    cache_creation_input_tokens: 0,
    output_tokens: out,
  });
  const lines = [
    {
      type: "system",
      subtype: "init",
      model: "claude-opus-5-5[1m]",
      claude_code_version: "2.3.0",
      permissionMode: "acceptEdits",
      tools: ["Read", "Edit", "Bash"],
    },
    // One message streams as two lines repeating its usage: counted once.
    {
      type: "assistant",
      message: { id: "m1", usage: usage(10, 20000, 50), content: [{ type: "text", text: "Hi" }] },
    },
    {
      type: "assistant",
      message: { id: "m1", usage: usage(10, 20000, 50), content: [{ type: "text", text: "." }] },
    },
    {
      type: "assistant",
      message: { id: "m2", usage: usage(5, 30000, 70), content: [{ type: "text", text: "Done" }] },
    },
    {
      type: "result",
      subtype: "success",
      result: "ok",
      usage: usage(15, 50000, 120),
      total_cost_usd: 0.42,
      num_turns: 2,
      modelUsage: { "claude-opus-5-5": { contextWindow: 1000000 } },
    },
  ];
  const r = spawnSync(process.execPath, [CLI_PATH, "harness", "events", "--from", "claude"], {
    input: lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    encoding: "utf8",
    env: {
      ...process.env,
      AGENT_EVENTS_FILE: file,
      AGENT_EVENTS_REQ: "REQ-007",
      AGENT_EVENTS_ATTEMPT: "1",
    },
  });
  assert.equal(r.status, 0, r.stderr);
  const got = events(file);
  const agent = got.find((e) => e.type === "agent");
  assert.equal(agent?.model, "claude-opus-5-5[1m]");
  assert.equal(agent?.version, "2.3.0");
  assert.equal(agent?.permission, "acceptEdits");
  assert.equal(agent?.tools, 3);
  const live = got.filter((e) => e.type === "usage" && e.final !== true);
  assert.deepEqual(
    live.map((e) => [e.context, e.window, e.output]),
    [
      [20010, 1000000, 50],
      [30005, 1000000, 120],
    ]
  );
  const final = got.find((e) => e.type === "usage" && e.final === true);
  assert.equal(final?.input, 15);
  assert.equal(final?.cacheRead, 50000);
  assert.equal(final?.output, 120);
  assert.equal(final?.cost, 0.42);
  assert.equal(final?.turns, 2);
  assert.equal(final?.window, 1000000);
});

test("REQ-182 SCN-182b: the live model folds the session, keeps it out of the steps, and gives the queue and totals", () => {
  const dir = tmp();
  writeQueue(dir, ["REQ-007", "REQ-008", "REQ-009"], 100);
  const file = eventsFileFor(dir, "REQ-007");
  const put = (e: Record<string, unknown>) =>
    fs.appendFileSync(file, JSON.stringify({ req: "REQ-007", attempt: 1, ...e }) + "\n");
  put({ t: 101, type: "attempt", state: "start" });
  put({ t: 101, type: "prompt", role: "agent", chars: 4000, lines: 80 });
  put({ t: 102, type: "agent", model: "claude-opus-5-5", tools: 12 });
  put({ t: 103, type: "usage", context: 30000, window: 200000, output: 40 });
  put({ t: 104, type: "step", kind: "edit", target: "src/a.ts", result: "ok" });
  put({ t: 105, type: "usage", context: 90000, window: 200000, output: 900 });
  put({ t: 106, type: "usage", context: 60000, window: 200000, output: 1200 });

  const live = readLive(dir);
  const r = live.requirements[0];
  assert.equal(r.agent.model, "claude-opus-5-5");
  assert.equal(r.usage.context, 60000, "the context now is the last message's");
  assert.equal(r.usage.peak, 90000);
  assert.equal(r.usage.window, 200000);
  assert.equal(r.usage.output, 1200);
  assert.equal(r.usage.cost, null, "the cost is known once the session ends");
  assert.deepEqual(r.prompt, { role: "agent", chars: 4000, lines: 80, tokens: 1000 });
  assert.deepEqual(
    r.steps.map((e: { type: string }) => e.type),
    ["step"],
    "session lines are not steps"
  );
  assert.equal(r.phase, "edit");
  assert.deepEqual(live.queue, ["REQ-007", "REQ-008", "REQ-009"]);
  assert.equal(live.queueStarted, 100);

  put({
    t: 107,
    type: "usage",
    final: true,
    window: 200000,
    input: 20,
    output: 1500,
    cacheRead: 300000,
    cacheWrite: 5000,
    cost: 1.25,
    turns: 14,
  });
  put({ t: 108, type: "attempt", state: "end", result: "pass" });
  const after = readLive(dir);
  assert.equal(after.requirements[0].usage.cost, 1.25);
  assert.equal(after.requirements[0].usage.turns, 14);
  assert.deepEqual(after.totals, {
    input: 20,
    output: 1500,
    cacheRead: 300000,
    cacheWrite: 5000,
    cost: 1.25,
    turns: 14,
  });
});

test("REQ-182 SCN-182c: the prompt an attempt was given is kept for the view, beside the events", () => {
  const dir = tmp();
  keepPrompt(dir, "REQ-007", 2, "# Implement REQ-007\n");
  const file = promptFileFor(dir, "REQ-007", 2);
  assert.equal(fs.readFileSync(file, "utf8"), "# Implement REQ-007\n");
  assert.ok(
    file.startsWith(path.join(dir, ".harness", "events")),
    "kept under the git-ignored events directory"
  );
});

test("REQ-182 SCN-182d: the sidebar is a work queue and the requirement has an Agent tab", () => {
  const html = livePage("demo");
  for (const want of [
    'aria-label="Work queue"',
    'block("Now")',
    'block("Needs attention"',
    'block("Up next"',
    'block("Finished recently")',
    'data-tab="agent"',
    "paneAgent",
    "/prompt/",
  ]) {
    assert.ok(html.includes(want), `page has ${want}`);
  }
  assert.ok(!html.includes('el("details"), has'), "the module accordion left the sidebar");
  const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new Function(script));
});
