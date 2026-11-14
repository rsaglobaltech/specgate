"use strict";

/**
 * REQ-553, REQ-554 — the studio served to a team behind a sign-in proxy: roles
 * from studio.team.yaml, and an editor's edits opened as pull requests, never
 * written to the base branch (change business-review).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const cp = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { parseTeamConfig, roleOf, teamBranch, teamGate } = require("../../scripts/lib/studio-team");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]) =>
  cp.spawnSync("git", args, { cwd: dir, encoding: "utf8" });

const QUESTIONS =
  "# Questions — pdf-invoices\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n" +
  "| Q1 | Does an unpaid invoice download too? |  |  |  | open |\n";

/** A project on `main`, pushed to a bare origin, with a change that has an open question. */
function teamProject(apiPort: number) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-team-"));
  madeDirs.push(parent);
  const init = cp.spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(
    parent,
    fs.readdirSync(parent).find((f: string) => !f.endsWith(".git"))!
  );
  fs.mkdirSync(path.join(dir, "docs/specs/changes/pdf-invoices"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs/specs/changes/pdf-invoices/questions.md"), QUESTIONS);
  fs.writeFileSync(
    path.join(dir, "studio.team.yaml"),
    "user_header: X-Forwarded-User\nbase: main\nroles:\n  ana: reader\n  luis: editor\n  boss: admin\n"
  );
  fs.writeFileSync(
    path.join(dir, "alm.config.yaml"),
    `pr:\n  provider: github\n  repo: acme/shop\n  base: main\n  token_env: SPECGATE_TEST_PR_TOKEN\n  base_url: http://127.0.0.1:${apiPort}\n`
  );
  const origin = path.join(parent, "origin.git");
  git(parent, "init", "-q", "--bare", "-b", "main", origin);
  git(dir, "init", "-q", "-b", "main");
  for (const [k, v] of [
    ["user.email", "owner@example.com"],
    ["user.name", "Owner"],
    ["commit.gpgsign", "false"],
    ["core.autocrlf", "false"],
  ]) {
    git(dir, "config", k, v);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  git(dir, "remote", "add", "origin", origin);
  git(dir, "push", "-q", "-u", "origin", "main");
  return { dir, origin };
}

/** A GitHub API that knows no pull request, and opens one. */
function fakeGitHub(): Promise<{ port: number; calls: string[]; close: () => void }> {
  const calls: string[] = [];
  const server = http.createServer(
    (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => {
      let body = "";
      req.on("data", (d: Buffer) => (body += d));
      req.on("end", () => {
        calls.push(`${req.method} ${req.url} ${body}`);
        res.writeHead(req.method === "POST" ? 201 : 200, { "content-type": "application/json" });
        res.end(
          req.method === "GET"
            ? "[]"
            : JSON.stringify({ number: 7, html_url: "https://github.example/acme/shop/pull/7" })
        );
      });
    }
  );
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ port: server.address().port, calls, close: () => server.close() })
    )
  );
}

async function studio(dir: string, extra: string[]) {
  const port = 48000 + Math.floor(Math.random() * 2000);
  const child = cp.spawn(process.execPath, [CLI, "studio", "--port", String(port), ...extra], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1", SPECGATE_TEST_PR_TOKEN: "t0ken" },
    detached: process.platform !== "win32",
  });
  let err = "";
  child.stderr.on("data", (d: Buffer) => (err += d));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`studio did not start: ${err}`)), 10000);
    child.stdout.on("data", (d: Buffer) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const call = (method: string, url: string, user: string | null, body?: unknown, token?: string) =>
    new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
      const data = body === undefined ? "" : JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path: url,
          headers: {
            host: "localhost",
            ...(user ? { "x-forwarded-user": user } : {}),
            ...(data ? { "content-type": "application/json" } : {}),
            ...(token ? { "x-specgate-token": token } : {}),
          },
        },
        (res: import("node:http").IncomingMessage) => {
          let out = "";
          res.on("data", (d: Buffer) => (out += d));
          res.on("end", () => {
            let json = {};
            try {
              json = JSON.parse(out);
            } catch {
              json = { raw: out };
            }
            resolve({ status: res.statusCode || 0, json });
          });
        }
      );
      req.on("error", reject);
      req.end(data);
    });
  const stop = () => {
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
      else child.kill();
    } catch {
      /* already gone */
    }
  };
  return { call, stop, stderr: () => err };
}

// ── REQ-553 ─────────────────────────────────────────────────────────────────

test("REQ-553 SCN-553a: a reader tries to answer a question", async () => {
  const gh = await fakeGitHub();
  const { dir } = teamProject(gh.port);
  const s = await studio(dir, ["--team"]);
  try {
    assert.equal((await s.call("GET", "/api/ping", null)).status, 401, "no user, no studio");
    const ping = await s.call("GET", "/api/ping", "ana");
    assert.equal(ping.status, 200, "a reader sees every section");
    const token = String(ping.json.token);
    const r = await s.call(
      "POST",
      "/api/answer",
      "ana",
      { question: "Q1", change: "pdf-invoices", answer: "Yes" },
      token
    );
    assert.equal(r.status, 403);
    assert.equal(r.json.code, "role_forbidden");
    assert.equal(
      fs.readFileSync(path.join(dir, "docs/specs/changes/pdf-invoices/questions.md"), "utf8"),
      QUESTIONS
    );
    const build = await s.call("POST", "/api/build", "luis", { reqs: [] }, token);
    assert.equal(build.status, 403, "running things is an admin's");
  } finally {
    s.stop();
    gh.close();
  }
});

test("REQ-553: without --team, today's local studio, no sign-in", async () => {
  const gh = await fakeGitHub();
  const { dir } = teamProject(gh.port);
  const s = await studio(dir, []);
  try {
    assert.equal((await s.call("GET", "/api/ping", null)).status, 200);
  } finally {
    s.stop();
    gh.close();
  }
});

test("REQ-553: roles and the gate, without a server", () => {
  const cfg = parseTeamConfig("roles:\n  Ana: reader\n  luis: editor\n");
  assert.equal(roleOf(cfg, "ana"), "reader");
  assert.equal(roleOf(cfg, "nobody"), "reader");
  assert.throws(() => parseTeamConfig("roles:\n  x: owner\n"), /reader, editor or admin/);
  const gate = (
    o: Partial<{ user: string; secret: string; given: string; url: string; write: boolean }>
  ) =>
    teamGate(cfg, {
      user: "luis",
      secret: "",
      given: "",
      method: "POST",
      url: "/api/answer",
      write: true,
      ...o,
    });
  assert.equal(gate({}).role, "editor");
  assert.equal(gate({ user: "" }).code, "sign_in_required");
  assert.equal(gate({ user: "luis\nX" }).code, "sign_in_required");
  assert.equal(gate({ secret: "s3cret", given: "nope" }).code, "proxy_required");
  assert.equal(gate({ secret: "s3cret", given: "s3cret" }).role, "editor");
  assert.equal(gate({ url: "/api/agent" }).code, "role_forbidden");
  assert.equal(teamBranch("Luis M", "pdf-invoices"), "studio/luis-m/pdf-invoices");
});

// ── REQ-554 ─────────────────────────────────────────────────────────────────

test("REQ-554 SCN-554a: an editor answers a question", async () => {
  const gh = await fakeGitHub();
  const { dir, origin } = teamProject(gh.port);
  const before = git(dir, "rev-parse", "main").stdout.trim();
  const s = await studio(dir, ["--team"]);
  try {
    const token = String((await s.call("GET", "/api/ping", "luis")).json.token);
    const r = await s.call(
      "POST",
      "/api/answer",
      "luis",
      { question: "Q1", change: "pdf-invoices", answer: "Yes, marked unpaid" },
      token
    );
    assert.equal(r.status, 200, `${JSON.stringify(r.json)} ${s.stderr()}`);
    assert.equal(r.json.pullRequest, "https://github.example/acme/shop/pull/7");
    assert.equal(r.json.branch, "studio/luis/pdf-invoices");

    const author = git(
      origin,
      "log",
      "-1",
      "--format=%an",
      "studio/luis/pdf-invoices"
    ).stdout.trim();
    assert.equal(author, "luis");
    const onBranch = git(
      origin,
      "show",
      "studio/luis/pdf-invoices:docs/specs/changes/pdf-invoices/questions.md"
    );
    assert.match(onBranch.stdout, /Yes, marked unpaid/);
    assert.equal(
      git(origin, "rev-parse", "main").stdout.trim(),
      before,
      "the base branch has no new commit"
    );
    assert.equal(git(dir, "rev-parse", "main").stdout.trim(), before);
    assert.equal(
      fs.readFileSync(path.join(dir, "docs/specs/changes/pdf-invoices/questions.md"), "utf8"),
      QUESTIONS,
      "the studio's own working copy is not written"
    );
    const opened = gh.calls.find((c) => c.startsWith("POST /repos/acme/shop/pulls"));
    assert.ok(opened, gh.calls.join("\n"));
    assert.match(opened!, /"head":"studio\/luis\/pdf-invoices"/);
    assert.match(opened!, /"base":"main"/);
  } finally {
    s.stop();
    gh.close();
  }
});
