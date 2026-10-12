"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  readAlmConfig,
  lintAlmConfig,
  readAlmMap,
  writeAlmMap,
  extractRequirements,
  syncRequirements,
} = require("../../scripts/alm/core");
const { jiraClient, azureClient } = require("../../scripts/alm/clients");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";

function makeProject(tmp) {
  const dir = path.join(tmp, "project");
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    "# Spec\n\n## REQ-001 — Patient CRUD\n\n## REQ-002 — SMART scopes\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [
      "# Matrix",
      "",
      RICH_HEADER,
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| REQ-001 | SCN-001 | `features/a.feature` | UC-1 | - | - | - | - | t | Implemented |",
      "| REQ-002 | SCN-002 | `features/b.feature` | UC-2 | - | - | - | - | TBD | Draft |",
      "",
    ].join("\n"),
    "utf8"
  );
  return dir;
}

function withProject(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-alm-"));
  try {
    return fn(makeProject(tmp), tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** In-memory ALM double implementing the client interface. */
function fakeClient(initialIssues = {}) {
  const issues = { ...initialIssues };
  let counter = 100;
  const calls = [];
  return {
    issues,
    calls,
    async createIssue(reqId, title) {
      const key = `FAKE-${counter++}`;
      issues[key] = { title: `${reqId} — ${title}`, status: "open" };
      calls.push(["create", reqId, key]);
      return { key, url: `https://fake/${key}` };
    },
    async getIssueStatus(key) {
      calls.push(["status", key]);
      return issues[key] ? issues[key].status : "open";
    },
    async closeIssue(key) {
      calls.push(["close", key]);
      issues[key].status = "done";
    },
  };
}

// ── extractRequirements ───────────────────────────────────────────────────────

test("extractRequirements aggregates status per REQ with titles from spec.md", () => {
  withProject((dir) => {
    const reqs = extractRequirements(dir);
    assert.deepEqual(reqs, [
      { id: "REQ-001", title: "Patient CRUD", status: "done" },
      { id: "REQ-002", title: "SMART scopes", status: "open" },
    ]);
  });
});

// ── syncRequirements ──────────────────────────────────────────────────────────

test("sync creates issues for unlinked REQs and persists the mapping", async () => {
  await withProject(async (dir) => {
    const client = fakeClient();
    const map = {};
    const actions = await syncRequirements(extractRequirements(dir), map, client, {});
    assert.deepEqual(
      actions.map((a) => a.action),
      ["created", "created"]
    );
    assert.ok(map["REQ-001"].issue.startsWith("FAKE-"));

    writeAlmMap(dir, map, false);
    assert.deepEqual(readAlmMap(dir), map);
  });
});

test("sync closes the issue when its REQ is Implemented", async () => {
  await withProject(async (dir) => {
    const client = fakeClient({ "JIRA-1": { status: "open" }, "JIRA-2": { status: "open" } });
    const map = { "REQ-001": { issue: "JIRA-1" }, "REQ-002": { issue: "JIRA-2" } };
    const actions = await syncRequirements(extractRequirements(dir), map, client, {});
    assert.deepEqual(
      actions.map((a) => [a.req, a.action]),
      [
        ["REQ-001", "closed"],
        ["REQ-002", "in-sync"],
      ]
    );
    assert.equal(client.issues["JIRA-1"].status, "done");
    assert.equal(client.issues["JIRA-2"].status, "open");
  });
});

test("sync reports drift when the issue is done but the REQ is open", async () => {
  await withProject(async (dir) => {
    const client = fakeClient({ "JIRA-1": { status: "done" }, "JIRA-2": { status: "done" } });
    const map = { "REQ-001": { issue: "JIRA-1" }, "REQ-002": { issue: "JIRA-2" } };
    const actions = await syncRequirements(extractRequirements(dir), map, client, {});
    const req2 = actions.find((a) => a.req === "REQ-002");
    assert.equal(req2.action, "drift");
    assert.match(req2.detail, /done in the ALM but REQ-002 is not Implemented/);
  });
});

test("sync --dry-run plans without touching the ALM or the mapping", async () => {
  await withProject(async (dir) => {
    const client = fakeClient();
    const map = {};
    const actions = await syncRequirements(extractRequirements(dir), map, client, {
      dryRun: true,
    });
    assert.deepEqual(
      actions.map((a) => a.action),
      ["would-create", "would-create"]
    );
    assert.deepEqual(map, {});
    assert.equal(client.calls.filter(([op]) => op === "create").length, 0);
  });
});

// ── readAlmConfig ─────────────────────────────────────────────────────────────

test("readAlmConfig validates required keys and provider", () => {
  withProject((dir) => {
    assert.throws(() => readAlmConfig(dir), /alm\.config\.yaml not found/);

    fs.writeFileSync(
      path.join(dir, "alm.config.yaml"),
      "alm_version: 1\nprovider: rally\nbase_url: https://x\nproject_key: P\ntoken_env: T\n",
      "utf8"
    );
    assert.throws(() => readAlmConfig(dir), /Unknown ALM provider 'rally'. Available: jira, azure/);

    fs.writeFileSync(
      path.join(dir, "alm.config.yaml"),
      "alm_version: 1\nprovider: jira\nbase_url: https://x\nproject_key: P\ntoken_env: T\n",
      "utf8"
    );
    assert.equal(readAlmConfig(dir).provider, "jira");
  });
});

test("readAlmConfig asks the provider which keys it requires", () => {
  withProject((dir) => {
    fs.writeFileSync(
      path.join(dir, "alm.config.yaml"),
      "alm_version: 1\nprovider: azure\nbase_url: https://x\ntoken_env: T\n",
      "utf8"
    );
    assert.throws(
      () => readAlmConfig(dir),
      /missing required key 'project_key' for provider 'azure'/
    );
  });
});

test("lintAlmConfig names the keys nothing will read, and who would have", () => {
  // The three findings this port exists for: a key only another provider
  // reads, and a key no provider reads at all.
  const cfg = {
    alm_version: 1,
    provider: "jira",
    base_url: "https://x",
    project_key: "P",
    token_env: "T",
    done_state: "Resolved",
    nonsense_key: 42,
  };
  const diags = lintAlmConfig(cfg);
  assert.equal(diags.length, 2);

  const byTarget = Object.fromEntries(diags.map((d) => [d.target, d]));
  assert.equal(byTarget.done_state.severity, "warning");
  assert.equal(byTarget.done_state.code, "alm_config_unread_key");
  assert.match(byTarget.done_state.message, /read by azure, not by jira/);
  assert.ok(byTarget.done_state.fix, "a warning without a fix is not actionable");
  assert.match(byTarget.nonsense_key.message, /read by no ALM provider/);
});

test("lintAlmConfig is silent when every key is read", () => {
  assert.deepEqual(
    lintAlmConfig({
      alm_version: 1,
      provider: "azure",
      base_url: "https://x",
      project_key: "P",
      token_env: "T",
      done_state: "Closed",
      issue_type: "User Story",
    }),
    []
  );
});

test("sync reports a requirement it cannot close instead of throwing", async () => {
  // A provider that declares close:false must not take the whole run down.
  const client = {
    capabilities: { create: true, readStatus: true, close: false },
    async createIssue() {
      throw new Error("not reached");
    },
    async getIssueStatus() {
      return "open";
    },
    async closeIssue() {
      throw new Error("closeIssue must not be called when close is false");
    },
  };
  const map = { "REQ-001": { issue: "X-1" } };
  const actions = await syncRequirements(
    [{ id: "REQ-001", title: "t", status: "done" }],
    map,
    client,
    {}
  );
  assert.equal(actions[0].action, "close-unsupported");
  assert.match(actions[0].detail, /cannot close X-1/);
});

// ── Provider clients over an injected fetch ───────────────────────────────────

function fakeFetch(routes) {
  const seen = [];
  const impl = async (url, init: any = {}) => {
    seen.push({ url: String(url), method: init.method || "GET", body: init.body });
    for (const [matcher, responder] of routes) {
      if (
        String(url).includes(matcher) &&
        (!responder.method || responder.method === (init.method || "GET"))
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => responder.json,
          text: async () => JSON.stringify(responder.json),
        };
      }
    }
    return { ok: false, status: 404, text: async () => "not found" };
  };
  impl.seen = seen;
  return impl;
}

test("jiraClient maps the REST API to the client interface", async () => {
  process.env.T_TOKEN = "tok";
  process.env.T_USER = "user@example.com";
  const cfg = {
    provider: "jira",
    base_url: "https://acme.atlassian.net",
    project_key: "HIE",
    token_env: "T_TOKEN",
    user_env: "T_USER",
  };
  const routes = [
    [
      "/rest/api/3/issue/HIE-7/transitions",
      { json: { transitions: [{ id: "31", to: { statusCategory: { key: "done" } } }] } },
    ],
    [
      "/rest/api/3/issue/HIE-7",
      { json: { fields: { status: { statusCategory: { key: "indeterminate" } } } } },
    ],
    ["/rest/api/3/issue", { method: "POST", json: { key: "HIE-9" } }],
  ];
  const f = fakeFetch(routes);
  const client = jiraClient(cfg, f);

  const created = await client.createIssue("REQ-001", "Patient CRUD");
  assert.equal(created.key, "HIE-9");
  assert.match(created.url, /browse\/HIE-9/);

  assert.equal(await client.getIssueStatus("HIE-7"), "open");
  await client.closeIssue("HIE-7");
  const transitionPost = f.seen.find(
    (s) => s.url.includes("HIE-7/transitions") && s.method === "POST"
  );
  assert.ok(transitionPost, "should POST the done transition");
  delete process.env.T_TOKEN;
  delete process.env.T_USER;
});

test("azureClient maps work items to the client interface", async () => {
  process.env.T_TOKEN = "pat";
  const cfg = {
    provider: "azure",
    base_url: "https://dev.azure.com/acme",
    project_key: "HIE",
    token_env: "T_TOKEN",
  };
  const routes = [
    [
      "workitems/$Task",
      { method: "POST", json: { id: 42, _links: { html: { href: "https://x/42" } } } },
    ],
    ["workitems/42?fields", { json: { fields: { "System.State": "Done" } } }],
    ["workitems/42?api-version", { method: "PATCH", json: {} }],
  ];
  const f = fakeFetch(routes);
  const client = azureClient(cfg, f);

  const created = await client.createIssue("REQ-002", "SMART scopes");
  assert.equal(created.key, "42");
  assert.equal(await client.getIssueStatus("42"), "done");
  await client.closeIssue("42");
  assert.ok(f.seen.some((s) => s.method === "PATCH"));
  delete process.env.T_TOKEN;
});

// ── CLI surface ───────────────────────────────────────────────────────────────

test("alm link and alm status work end-to-end without network", () => {
  withProject((dir) => {
    const link = spawnSync(
      process.execPath,
      [CLI_PATH, "alm", "link", "REQ-001", "HIE-42", "--project-dir", dir],
      { encoding: "utf8", cwd: ROOT_DIR }
    );
    assert.equal(link.status, 0, link.stdout + link.stderr);
    assert.match(link.stdout, /Linked REQ-001 → HIE-42/);

    const status = spawnSync(process.execPath, [CLI_PATH, "alm", "status", "--project-dir", dir], {
      encoding: "utf8",
      cwd: ROOT_DIR,
    });
    assert.equal(status.status, 0);
    assert.match(status.stdout, /REQ-001\s+\[done\]\s+→\s+HIE-42/);
    assert.match(status.stdout, /REQ-002\s+\[open\]\s+→\s+\(unlinked\)/);
  });
});

test("alm sync without config fails with the config template", () => {
  withProject((dir) => {
    const r = spawnSync(process.execPath, [CLI_PATH, "alm", "sync", "--project-dir", dir], {
      encoding: "utf8",
      cwd: ROOT_DIR,
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /alm\.config\.yaml not found/);
    assert.match(r.stderr, /token_env/);
  });
});
