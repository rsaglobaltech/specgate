/**
 * ticket-source — a Jira ticket as source text (ADR-0039, REQ-143…REQ-150).
 *
 * Jira is faked at the `fetch` boundary, from a routes file the shim reads, so
 * every scenario runs offline and the requests it made can be inspected.
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

/** One canned answer: the first route whose `match` the URL contains wins. */
interface Route {
  match: string;
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
}

/** What the fake Jira saw. */
interface Seen {
  url: string;
  method: string;
  authorization: boolean;
}

/** A Specgate project with an `alm.config.yaml`. */
function project(config: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ticket-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Status |\n|---|---|\n",
    "utf8"
  );
  fs.writeFileSync(path.join(dir, "alm.config.yaml"), config, "utf8");
  return dir;
}

const JIRA = [
  "alm_version: 1",
  "provider: jira",
  "base_url: https://specgatedemo.atlassian.net",
  "project_key: KAN",
  "token_env: TICKET_TEST_TOKEN",
  "user_env: TICKET_TEST_USER",
  "",
].join("\n");

/** Run a CLI with `fetch` answering from `routes`; returns the run and what was requested. */
function runWithJira(dir: string, cli: string, args: string[], routes: Route[]) {
  const shim = path.join(dir, "shim.js");
  const routesFile = path.join(dir, "routes.json");
  const seenFile = path.join(dir, "seen.json");
  fs.writeFileSync(routesFile, JSON.stringify(routes), "utf8");
  fs.writeFileSync(
    shim,
    [
      `const fs = require("node:fs");`,
      `const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));`,
      `const seenFile = process.argv[3];`,
      `const seen = [];`,
      `globalThis.fetch = async (url, init = {}) => {`,
      `  const headers = init.headers || {};`,
      `  seen.push({ url: String(url), method: init.method || "GET", authorization: Boolean(headers.Authorization) });`,
      `  fs.writeFileSync(seenFile, JSON.stringify(seen));`,
      `  const r = routes.find((x) => String(url).includes(x.match));`,
      `  const status = r ? (r.status || 200) : 404;`,
      `  const body = r && r.json !== undefined ? JSON.stringify(r.json) : "not found";`,
      `  const h = new Map(Object.entries((r && r.headers) || {}).map(([k, v]) => [k.toLowerCase(), v]));`,
      `  return { ok: status < 400, status, headers: { get: (n) => h.get(n.toLowerCase()) ?? null },`,
      `    json: async () => JSON.parse(body), text: async () => body };`,
      `};`,
      `const target = process.argv[4];`,
      `process.argv = [process.argv[0], target, ...process.argv.slice(5)];`,
      `require(target);`,
    ].join("\n"),
    "utf8"
  );
  const run = spawnSync(process.execPath, [shim, routesFile, seenFile, cli, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      TICKET_TEST_TOKEN: "secret-token",
      TICKET_TEST_USER: "ba@example.com",
    },
  });
  const seen: Seen[] = fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, "utf8")) : [];
  return { ...run, seen };
}

/** A Jira issue as `/search/jql` returns it. */
function issue(key: string, summary: string) {
  return {
    key,
    fields: {
      summary,
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: summary }] }],
      },
    },
  };
}

// ── REQ-143 ──────────────────────────────────────────────────────────────────

test("REQ-143 SCN-143a: alm pull searches /search/jql and follows nextPageToken", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [
        { match: "/rest/api/3/search?", status: 410, json: { errorMessages: ["removed"] } },
        {
          match: "nextPageToken=page-2",
          json: { issues: [issue("KAN-16", "Register vehicle exit")], isLast: true },
        },
        {
          match: "/rest/api/3/search/jql",
          json: { issues: [issue("KAN-13", "Register vehicle entry")], nextPageToken: "page-2" },
        },
      ]
    );
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.match(run.stdout, /KAN-13/);
    assert.match(run.stdout, /KAN-16/);
    assert.ok(
      !run.seen.some((s) => s.url.includes("/rest/api/3/search?")),
      "nothing may go to the removed search endpoint"
    );
    const first = run.seen.find((s) => s.url.includes("/search/jql"))!;
    assert.match(first.url, /maxResults=100/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-144 ──────────────────────────────────────────────────────────────────

test("REQ-144 SCN-144a: cloud_id auto sends the API to the gateway, links keep the site", () => {
  const dir = project(JIRA + "cloud_id: auto\n");
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--json", "--project-dir", dir],
      [
        { match: "/_edge/tenant_info", json: { cloudId: "9e49" } },
        {
          match: "api.atlassian.com/ex/jira/9e49/rest/api/3/search/jql",
          json: { issues: [issue("KAN-13", "Register vehicle entry")], isLast: true },
        },
      ]
    );
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const tenant = run.seen.find((s) => s.url.includes("tenant_info"))!;
    assert.equal(tenant.url, "https://specgatedemo.atlassian.net/_edge/tenant_info");
    assert.equal(tenant.authorization, false, "tenant_info must carry no credential");
    const search = run.seen.find((s) => s.url.includes("/search/jql"))!;
    assert.match(
      search.url,
      /^https:\/\/api\.atlassian\.com\/ex\/jira\/9e49\/rest\/api\/3\/search\/jql/
    );
    assert.equal(search.authorization, true);
    const out = JSON.parse(run.stdout) as { pulled: Array<{ issue: string; url: string }> };
    assert.equal(out.pulled[0].url, "https://specgatedemo.atlassian.net/browse/KAN-13");
    assert.ok(!run.stdout.includes("secret-token") && !run.stderr.includes("secret-token"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-144 SCN-144b: a 401 from the site names cloud_id: auto in the fix", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [{ match: "specgatedemo.atlassian.net", status: 401, json: { message: "Unauthorized" } }]
    );
    assert.equal(run.status, 1);
    assert.match(run.stderr + run.stdout, /cloud_id: auto/);
    assert.match(run.stderr + run.stdout, /scope/i);
    assert.ok(!(run.stdout + run.stderr).includes("secret-token"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-144 SCN-144c: a search answered as anonymous fails instead of finding nothing", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [
        {
          match: "/rest/api/3/search/jql",
          json: { issues: [], isLast: true },
          headers: { "X-Seraph-LoginReason": "AUTHENTICATED_FAILED" },
        },
      ]
    );
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr + run.stdout, /cloud_id: auto/);
    assert.doesNotMatch(run.stdout, /No open issues/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
