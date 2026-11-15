/**
 * The board follows the change (REQ-305..309): phases, notes back from the
 * ticket, sub-issues per repository, and the MCP tools that read and move a
 * phase. The board is faked at the `fetch` boundary in a child process, the
 * same seam the conformance kit and `alm pull`'s tests use.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const ALM_CLI = path.join(ROOT_DIR, "dist", "scripts", "alm", "cli.js");
const { TOOLS } = require("../../packages/mcp-spec-driven/src/tools");
const { getProvider } = require("../../scripts/alm/providers");

const MATRIX = [
  "# Traceability Matrix",
  "",
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
  "|---|---|---|---|---|---|---|---|---|---|",
  "| REQ-001 | SCN-001 | `features/f.feature` | U | C | A | E | `s.ts` | `t.ts` | Draft |",
  "",
].join("\n");

const JIRA_CONFIG = [
  "alm_version: 1",
  "provider: jira",
  "base_url: https://acme.atlassian.net",
  "project_key: FLEET",
  "token_env: SPECGATE_PHASE_TOK",
  "user_env: SPECGATE_PHASE_USER",
  "mirror: false",
];

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** A project with one open change on a ticket, and its requirement's harness branch. */
function makeProject(configExtra: string[] = []): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-phases-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "specs", "traceability.md"), MATRIX, "utf8");
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "alm.config.yaml"),
    [...JIRA_CONFIG, ...configExtra, ""].join("\n"),
    "utf8"
  );
  addChange(dir, "alerts", ["ticket: FLEET-12"], "REQ-040", "Alert on a stopped truck");
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return dir;
}

function addChange(dir: string, id: string, yaml: string[], req: string, title: string) {
  const change = path.join(dir, "docs", "specs", "changes", id);
  fs.mkdirSync(path.join(change, "specs", "fleet"), { recursive: true });
  fs.writeFileSync(
    path.join(change, "change.yaml"),
    ["specgate_change_version: 1", "schema: spec-driven", ...yaml, ""].join("\n"),
    "utf8"
  );
  fs.writeFileSync(path.join(change, "proposal.md"), `# Proposal: ${id}\n`, "utf8");
  fs.writeFileSync(
    path.join(change, "specs", "fleet", "spec.md"),
    [
      "# Delta — fleet",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${req} — ${title}`,
      "",
      "The system SHALL do it.",
      "",
    ].join("\n"),
    "utf8"
  );
}

interface Route {
  match: string;
  method?: string;
  json?: unknown;
  seq?: unknown[];
}

/**
 * Run the ALM CLI with `fetch` replaced by recorded routes. Every request is
 * appended to `calls.jsonl`, so a test can say what reached the board.
 */
function shimFiles(dir: string, routes: Route[]) {
  const shim = path.join(dir, "shim.js");
  const routesFile = path.join(dir, "routes.json");
  const calls = path.join(dir, "calls.jsonl");
  fs.writeFileSync(routesFile, JSON.stringify(routes), "utf8");
  fs.writeFileSync(
    shim,
    [
      `const fs = require("node:fs");`,
      `const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));`,
      `const calls = process.argv[3];`,
      `const used = new Map();`,
      `globalThis.fetch = async (url, init = {}) => {`,
      `  const method = init.method || "GET";`,
      `  fs.appendFileSync(calls, JSON.stringify({ url: String(url), method, body: init.body || null }) + "\\n");`,
      `  const route = routes.find((r) => String(url).includes(r.match) && (r.method || "GET") === method);`,
      `  if (!route) return { ok: false, status: 404, json: async () => ({}), text: async () => "no route " + method + " " + url };`,
      `  let json = route.json;`,
      `  if (route.seq) { const n = used.get(route) || 0; used.set(route, n + 1); json = route.seq[Math.min(n, route.seq.length - 1)]; }`,
      `  return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };`,
      `};`,
      `const target = process.argv[4];`,
      `process.argv = [process.argv[0], target, ...process.argv.slice(5)];`,
      `require(target);`,
    ].join("\n"),
    "utf8"
  );
  return { shim, routesFile, calls };
}

const ENV = { ...process.env, SPECGATE_PHASE_TOK: "tok", SPECGATE_PHASE_USER: "me@acme.example" };

function runAlm(dir: string, routes: Route[], args: string[]) {
  const { shim, routesFile, calls } = shimFiles(dir, routes);
  const r = spawnSync(
    process.execPath,
    [shim, routesFile, calls, ALM_CLI, ...args, "--project-dir", dir],
    { encoding: "utf8", env: ENV }
  );
  return { ...r, calls: readCalls(calls) };
}

function readCalls(file: string): { url: string; method: string; body: string | null }[] {
  if (!fs.existsSync(file)) return [];
  const out = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  fs.rmSync(file);
  return out;
}

const TRANSITIONS: Route[] = [
  {
    match: "?fields=status",
    method: "GET",
    json: { fields: { status: { name: "To Do", statusCategory: { key: "new" } } } },
  },
  {
    match: "/transitions",
    method: "GET",
    json: {
      transitions: [
        { id: "11", name: "Back", to: { name: "To Do", statusCategory: { key: "new" } } },
        {
          id: "21",
          name: "Start",
          to: { name: "In Progress", statusCategory: { key: "indeterminate" } },
        },
        {
          id: "31",
          name: "Doing",
          to: { name: "Doing", statusCategory: { key: "indeterminate" } },
        },
        { id: "41", name: "Finish", to: { name: "Done", statusCategory: { key: "done" } } },
      ],
    },
  },
  { match: "/transitions", method: "POST", json: {} },
];

type Call = { url: string; method: string; body: string | null };
const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET");

test("REQ-305 SCN-305a: a change whose first requirement is being built", () => {
  const dir = makeProject();
  try {
    git(dir, "branch", "harness/REQ-040");
    const first = runAlm(dir, TRANSITIONS, ["sync"]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /moved alerts FLEET-12 → In Progress/);
    const moved = writes(first.calls);
    assert.equal(moved.length, 1, JSON.stringify(first.calls));
    assert.match(moved[0].url, /FLEET-12\/transitions/);
    assert.equal(JSON.parse(String(moved[0].body)).transition.id, "21");
    // No issue per requirement: `mirror: false` (the ticket is the source).
    assert.ok(!first.calls.some((c) => /\/rest\/api\/3\/issue$/.test(c.url)));

    const second = runAlm(dir, TRANSITIONS, ["sync"]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.doesNotMatch(second.stdout, /moved/);
    assert.equal(second.calls.length, 0, "a move already made sends nothing");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-305 SCN-305b: a board with its own states", () => {
  const dir = makeProject(["phases:", "  building: Doing"]);
  try {
    git(dir, "branch", "harness/REQ-040");
    const r = runAlm(dir, TRANSITIONS, ["sync", "--dry-run"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /would-move alerts FLEET-12 → Doing/);
    assert.equal(r.calls.length, 0, "a dry run sends nothing to the board");
    assert.ok(!fs.existsSync(path.join(dir, ".specops", "alm-phases.json")));

    // And for real, the named state's transition is the one taken.
    const real = runAlm(dir, TRANSITIONS, ["sync"]);
    assert.equal(real.status, 0, real.stdout + real.stderr);
    assert.equal(JSON.parse(String(writes(real.calls)[0].body)).transition.id, "31");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** The ticket as Jira answers it: a description, and comments. */
function ticketRoutes(description: string, comments: { id: string; text: string }[]): Route[] {
  const adf = (text: string) => ({
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  return [
    { match: "/search/jql", method: "GET", json: { issues: [], isLast: true } },
    {
      match: "/issue/FLEET-12/comment",
      method: "GET",
      json: {
        comments: comments.map((c) => ({
          id: c.id,
          author: { displayName: "Ana (product)" },
          body: adf(c.text),
        })),
      },
    },
    {
      match: "/issue/FLEET-12?fields=summary,description",
      method: "GET",
      json: { key: "FLEET-12", fields: { summary: "Alerts", description: adf(description) } },
    },
  ];
}

test("REQ-306 SCN-306a: a comment and a new description", () => {
  const dir = makeProject();
  try {
    const delta = path.join(dir, "docs", "specs", "changes", "alerts", "specs", "fleet", "spec.md");
    const before = fs.readFileSync(delta, "utf8");
    const review = path.join(dir, "docs", "specs", "changes", "alerts", "review.md");

    const baseline = runAlm(dir, ticketRoutes("Alert by e-mail.", []), ["pull"]);
    assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
    assert.ok(!fs.existsSync(review), "the first pull only records where the ticket stands");

    const later = ticketRoutes("Alert by e-mail and by SMS.", [
      { id: "1001", text: "Also by SMS" },
    ]);
    const first = runAlm(dir, later, ["pull"]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const notes = fs
      .readFileSync(review, "utf8")
      .split("\n")
      .filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l));
    assert.equal(notes.length, 2, notes.join("\n"));
    assert.ok(notes.some((n) => /FLEET-12/.test(n) && /Also by SMS/.test(n) && /Ana/.test(n)));
    assert.ok(notes.some((n) => /description/i.test(n) && /by SMS\./.test(n)));

    const again = runAlm(dir, later, ["pull"]);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    const after = fs
      .readFileSync(review, "utf8")
      .split("\n")
      .filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l));
    assert.equal(after.length, 2, "a second pull adds nothing");
    assert.equal(fs.readFileSync(delta, "utf8"), before, "the delta is never rewritten");
    assert.equal(writes(first.calls).length + writes(again.calls).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-307 SCN-307a: a change across three repositories", () => {
  const dir = makeProject();
  try {
    addChange(
      dir,
      "follow-shipment",
      ["ticket: FLEET-20", "repositories: [fleet, tracking, web]"],
      "REQ-050",
      "The cliente follows their shipment"
    );
    const routes: Route[] = [
      ...TRANSITIONS,
      {
        match: "/rest/api/3/issue",
        method: "POST",
        seq: [{ key: "FLEET-21" }, { key: "FLEET-22" }, { key: "FLEET-23" }],
      },
    ];
    const first = runAlm(dir, routes, ["sync"]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const created = first.calls.filter(
      (c) => c.method === "POST" && /\/rest\/api\/3\/issue$/.test(c.url)
    );
    assert.equal(created.length, 3, JSON.stringify(first.calls));
    const bodies = created.map((c) => JSON.parse(String(c.body)).fields);
    assert.deepEqual(
      bodies.map((f) => f.parent.key),
      ["FLEET-20", "FLEET-20", "FLEET-20"]
    );
    for (const repo of ["fleet", "tracking", "web"]) {
      assert.ok(
        bodies.some((f) => f.summary.includes(repo) && f.summary.includes("FLEET-20")),
        repo
      );
    }
    const map = JSON.parse(fs.readFileSync(path.join(dir, ".specops", "alm-phases.json"), "utf8"));
    assert.deepEqual(map["follow-shipment"].children, {
      fleet: "FLEET-21",
      tracking: "FLEET-22",
      web: "FLEET-23",
    });

    const second = runAlm(dir, routes, ["sync"]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(
      second.calls.filter((c) => c.method === "POST" && /\/rest\/api\/3\/issue$/.test(c.url))
        .length,
      0,
      "no sub-issue is created twice"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-308 SCN-308a: a cancelled Linear issue is not done", async () => {
  const previous = process.env.SPECGATE_LINEAR_TOK;
  process.env.SPECGATE_LINEAR_TOK = "lin_api_tok";
  try {
    const seen: string[] = [];
    const fetchImpl = async (_url: string, init: { body?: string } = {}) => {
      seen.push(String(init.body));
      const type = String(init.body).includes('"ENG-9"') ? "canceled" : "completed";
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { issue: { state: { type } } } }),
        text: async () => "",
      };
    };
    const client = getProvider("linear").create(
      { provider: "linear", team_key: "ENG", token_env: "SPECGATE_LINEAR_TOK" },
      fetchImpl
    );
    assert.equal(await client.getIssueStatus("ENG-9"), "open");
    assert.equal(await client.getIssueStatus("ENG-8"), "done");
    assert.ok(
      seen.every((b) => !b.includes("lin_api_tok")),
      "the token travels as a header only"
    );
  } finally {
    if (previous === undefined) delete process.env.SPECGATE_LINEAR_TOK;
    else process.env.SPECGATE_LINEAR_TOK = previous;
  }
});

test("REQ-309 SCN-309a: an agent drives the board", () => {
  const dir = makeProject();
  try {
    git(dir, "branch", "harness/REQ-040");
    const { shim, routesFile, calls } = shimFiles(dir, TRANSITIONS);
    const q = (s: string) => `"${s}"`;
    const cliPath = [process.execPath, shim, routesFile, calls, ALM_CLI].map(q).join(" ");
    const saved = { ...process.env };
    Object.assign(process.env, ENV);
    try {
      // The alm CLI is called directly, so the tools' leading `alm` is dropped by
      // cli.ts the way the dispatcher does.
      const phase = TOOLS.specgate_alm_phase.handler({
        projectDir: dir,
        change: "alerts",
        cliPath,
      });
      assert.equal(phase.phase.phase, "building", JSON.stringify(phase));
      assert.equal(phase.phase.ticket, "FLEET-12");
      assert.equal(phase.phase.state, null);
      assert.equal(readCalls(calls).length, 0, "reading a phase needs no network");

      const move = TOOLS.specgate_alm_move.handler({ projectDir: dir, change: "alerts", cliPath });
      assert.equal(move.move.state, "In Progress", JSON.stringify(move));
      const sent = writes(readCalls(calls));
      assert.equal(sent.length, 1);
      assert.match(sent[0].url, /FLEET-12\/transitions/);
    } finally {
      process.env = saved;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
