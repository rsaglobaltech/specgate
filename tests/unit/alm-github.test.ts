/**
 * What the conformance kit cannot check about GitHub.
 *
 * The kit asserts every provider behaves the same; these are the places where
 * GitHub is deliberately different, and each one is a way the connector could
 * lie to `traceability.md` if it got it wrong.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

const { githubClient } = require("../../scripts/alm/clients");

const CONFIG = {
  alm_version: 1,
  provider: "github",
  repo: "acme/widgets",
  token_env: "SPECGATE_GH_TEST_TOKEN",
};

/** Replays one response for every request, and records what was asked. */
function fakeFetch(json: unknown) {
  const seen: any[] = [];
  const impl: any = async (url: string, init: any = {}) => {
    seen.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body,
      headers: init.headers,
    });
    return {
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  };
  impl.seen = seen;
  return impl;
}

function withToken<T>(fn: () => T): T {
  process.env.SPECGATE_GH_TEST_TOKEN = "tok";
  try {
    return fn();
  } finally {
    delete process.env.SPECGATE_GH_TEST_TOKEN;
  }
}

test("an issue closed as not planned is not done", async () => {
  // The distinction that matters: "we decided against this" must never read as
  // "this was delivered", or the matrix records work that never happened.
  await withToken(async () => {
    const client = githubClient(
      CONFIG,
      fakeFetch({ number: 9, state: "closed", state_reason: "not_planned" })
    );
    assert.equal(await client.getIssueStatus("9"), "open");
  });
});

test("an issue closed as completed is done", async () => {
  await withToken(async () => {
    const client = githubClient(
      CONFIG,
      fakeFetch({ number: 8, state: "closed", state_reason: "completed" })
    );
    assert.equal(await client.getIssueStatus("8"), "done");
  });
});

test("a closed issue with no reason recorded is done", async () => {
  // Issues closed before GitHub tracked a reason carry none. Treating that as
  // not-done would reopen years of history on the first sync.
  await withToken(async () => {
    const client = githubClient(CONFIG, fakeFetch({ number: 5, state: "closed" }));
    assert.equal(await client.getIssueStatus("5"), "done");
  });
});

test("closing states the reason, so reading it back agrees", async () => {
  await withToken(async () => {
    const fetchImpl = fakeFetch({ number: 7, state: "closed", state_reason: "completed" });
    const client = githubClient(CONFIG, fetchImpl);
    await client.closeIssue("7");

    const [call] = fetchImpl.seen;
    assert.equal(call.method, "PATCH");
    assert.match(call.url, /\/repos\/acme\/widgets\/issues\/7$/);
    const body = JSON.parse(call.body);
    assert.equal(body.state, "closed");
    assert.equal(
      body.state_reason,
      "completed",
      "without a reason GitHub may record not_planned, which reads back as open"
    );
  });
});

test("github.com needs no base_url", async () => {
  await withToken(async () => {
    const fetchImpl = fakeFetch({
      number: 1,
      html_url: "https://github.com/acme/widgets/issues/1",
    });
    const client = githubClient(CONFIG, fetchImpl);
    await client.createIssue("REQ-001", "Health endpoint");
    assert.match(
      fetchImpl.seen[0].url,
      /^https:\/\/api\.github\.com\/repos\/acme\/widgets\/issues$/
    );
  });
});

test("a repo that is not owner/name is refused before any request", () => {
  // A bare name builds /repos/widgets/issues, which GitHub answers with a 404
  // that says nothing about the actual mistake.
  withToken(() => {
    for (const repo of ["widgets", "acme/widgets/extra", "", "acme /widgets"]) {
      assert.throws(
        () => githubClient({ ...CONFIG, repo }, fakeFetch({})),
        /is not in owner\/name form/,
        `repo '${repo}' should have been refused`
      );
    }
    assert.doesNotThrow(() => githubClient({ ...CONFIG, repo: "acme/widgets" }, fakeFetch({})));
  });
});

test("the created issue carries the requirement id as a label and in the title", async () => {
  await withToken(async () => {
    const fetchImpl = fakeFetch({
      number: 42,
      html_url: "https://github.com/acme/widgets/issues/42",
    });
    const client = githubClient(CONFIG, fetchImpl);
    const ref = await client.createIssue("REQ-007", "Patient CRUD");

    assert.equal(ref.key, "42", "the key is the number, since the repo comes from config");
    const body = JSON.parse(fetchImpl.seen[0].body);
    assert.equal(body.title, "REQ-007 — Patient CRUD");
    assert.deepEqual(body.labels, ["spec-driven", "REQ-007"]);
  });
});

test("requests are authenticated and pin the API version", async () => {
  await withToken(async () => {
    const fetchImpl = fakeFetch({ number: 1 });
    await githubClient(CONFIG, fetchImpl).createIssue("REQ-001", "t");
    const { headers } = fetchImpl.seen[0];
    assert.equal(headers.Authorization, "Bearer tok");
    assert.equal(headers.Accept, "application/vnd.github+json");
    assert.ok(
      headers["X-GitHub-Api-Version"],
      "an unpinned version can change under the connector"
    );
  });
});

// ── through the CLI, not just the class ──────────────────────────────────────

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

/** A project with one open requirement and a github ALM config. */
function withGithubProject(config: string, fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-alm-gh-"));
  try {
    fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs", "specs", "traceability.md"),
      [
        "# Traceability Matrix",
        "",
        "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
        "|---|---|---|---|---|---|---|---|---|---|",
        "| REQ-001 | SCN-001 | `features/a.feature` | UC-001 | C | A | E | `src/a.ts` | `test/a.ts` | Draft |",
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), config, "utf8");
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const GH_CONFIG = [
  "alm_version: 1",
  "provider: github",
  "repo: acme/widgets",
  "token_env: SPECGATE_GH_E2E",
  "",
].join("\n");

test("specgate alm sync reaches the github provider and plans without touching the network", () => {
  withGithubProject(GH_CONFIG, (dir) => {
    const r = spawnSync(
      process.execPath,
      [CLI_PATH, "alm", "sync", "--project-dir", dir, "--dry-run"],
      {
        encoding: "utf8",
        cwd: ROOT_DIR,
        env: { ...process.env, SPECGATE_GH_E2E: "tok" },
      }
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout + r.stderr, /REQ-001/);
    // Dry run: nothing was created, so no map was written.
    assert.equal(fs.existsSync(path.join(dir, ".specops", "alm-map.json")), false);
  });
});

test("a github config that names project_key is told which provider reads it", () => {
  // The A2 defect class: a key nobody reads is worse than one that is missing,
  // because the file looks configured.
  const wrong = GH_CONFIG + "project_key: WIDGETS\n";
  withGithubProject(wrong, (dir) => {
    const r = spawnSync(
      process.execPath,
      [CLI_PATH, "alm", "sync", "--project-dir", dir, "--dry-run"],
      {
        encoding: "utf8",
        cwd: ROOT_DIR,
        env: { ...process.env, SPECGATE_GH_E2E: "tok" },
      }
    );
    const output = r.stdout + r.stderr;
    assert.match(output, /project_key/);
    assert.match(output, /jira|azure/, "the warning should name the providers that do read it");
  });
});

test("a github config missing repo fails before any request, naming the key", () => {
  const missing = ["alm_version: 1", "provider: github", "token_env: SPECGATE_GH_E2E", ""].join(
    "\n"
  );
  withGithubProject(missing, (dir) => {
    const r = spawnSync(
      process.execPath,
      [CLI_PATH, "alm", "sync", "--project-dir", dir, "--dry-run"],
      {
        encoding: "utf8",
        cwd: ROOT_DIR,
        env: { ...process.env, SPECGATE_GH_E2E: "tok" },
      }
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /missing required key 'repo'/);
    assert.match(r.stderr, /GitHub Issues requires: repo, token_env/);
  });
});
