/**
 * REQ-566 — a workspace's Live in the redesigned studio: each repository's
 * harness and cost, each story's parts and what they wait on, and a link to
 * each repository's own Live (change workspace-live-port).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import path = require("node:path");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const studio = require(path.join(ROOT_DIR, "dist", "studio-test", "studio.cjs"));
const { studioShell } = require("../../scripts/lib/studio-shell");

const cost = (money: number | null, minutes: number) => ({ money, minutes });

test("REQ-566 SCN-566a: the workspace's Live in the studio", () => {
  const html: string = studio.renderWorkspaceLive("en", {
    name: "truck-flote",
    repos: [
      {
        name: "tracking",
        role: "service",
        exists: true,
        queue: ["REQ-006"],
        inFlight: {
          req: "REQ-005",
          title: "A position is stored",
          attempt: 2,
          phase: "gate",
          agent: { kind: "edit", target: "src/positions.ts" },
        },
        requirements: { running: 1, pass: 3, fail: 0 },
        cost: cost(0.42, 2),
      },
      {
        name: "fleet",
        role: "web",
        exists: false,
        queue: [],
        inFlight: null,
        requirements: { running: 0, pass: 0, fail: 0 },
        cost: cost(null, 0),
      },
    ],
    stories: [
      {
        id: "ST-1",
        title: "A driver reports a position",
        done: false,
        subchanges: [
          {
            repo: "fleet",
            change: "st-1-fleet",
            state: "open",
            requirements: ["REQ-010"],
            blockedBy: ["tracking:REQ-005"],
          },
        ],
        cost: cost(0.42, 2),
      },
    ],
  });
  assert.match(html, /Workspace truck-flote — live/);
  assert.match(html, /href="\/live\/repo\/tracking\/"/);
  assert.match(html, /REQ-005 — A position is stored · attempt 2 · gate · edit src\/positions\.ts/);
  assert.match(html, /1 queued · 3 passed · 0 failed/);
  assert.match(html, /\$0\.42 · 2 min/);
  assert.match(html, /Its folder is missing\./);
  assert.match(html, /fleet: st-1-fleet · open · waits on tracking:REQ-005/);
});

test("REQ-566: the shell says which Live to open, escaped", () => {
  const ws = studioShell("truck-flote", "t0k", "live", { workspace: "truck-flote" });
  assert.match(ws, /<meta name="specgate-workspace" content="truck-flote"\/>/);
  assert.doesNotMatch(ws, /specgate-live-base/);
  const member = studioShell("tracking", "", "live", {
    workspace: "truck-flote",
    liveBase: "/live/repo/tracking",
    role: 'svc"<x>',
  });
  assert.match(member, /<meta name="specgate-live-base" content="\/live\/repo\/tracking"\/>/);
  assert.doesNotMatch(member, /svc"<x>/, "a value is escaped");
  assert.match(studioShell("shop", "t", "live"), /^(?!.*specgate-workspace)/s);
});
