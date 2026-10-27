"use strict";

/**
 * See the harness work (ADR-0037, change `live-view`): harness events, the
 * Claude Code adapter, the live view in studio, explore, and the tour.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");
import type { SpawnSyncReturns } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(
  cwd: string,
  args: string[],
  opts: { input?: string; env?: Record<string, string> } = {}
): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    input: opts.input,
    env: { ...process.env, SPECGATE_PROFILE: "", NO_COLOR: "1", ...(opts.env || {}) },
  });
}

function out(r: CliResult) {
  return `${r.stdout}${r.stderr}`;
}

function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** One line of a harness events file, as these tests read it. */
interface HarnessEvent {
  t: number;
  req: string;
  attempt: number;
  type: string;
  [field: string]: unknown;
}

function lines(file: string): HarnessEvent[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l: string) => JSON.parse(l));
}

/** A Node repository with code, adopted by plain `specgate init`. */
function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-live-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"app","version":"1.0.0","scripts":{"test":"node --test test/"}}\n'
  );
  fs.writeFileSync(path.join(dir, "lib", "index.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir, "pass.js"), "process.exit(0);\n");
  const r = cli(dir, ["init"]);
  assert.equal(r.status, 0, out(r));
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), 'test_cmd: "node pass.js"\n');
  return {
    parent,
    dir,
    // Retries: on Windows an indexer or a process just exited can hold a file a moment.
    done: () =>
      fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
  };
}

function openChange(dir: string) {
  assert.equal(cli(dir, ["propose", "pricing", "--capability", "pricing"]).status, 0);
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes/pricing/specs/pricing/spec.md"),
    "# Delta — pricing\n\n## ADDED Requirements\n\n" +
      "### Requirement: REQ-002 — Charge a peak surcharge\n\nThe system SHALL charge it.\n\n" +
      "#### Scenario: SCN-002a — A session at 18:00\n\n" +
      "- GIVEN a session started at 18:00\n- WHEN the fee is computed\n- THEN it includes a 20 % surcharge\n\n" +
      "<!-- specgate:trace kind=functional actor=Driver -->\n"
  );
}

function commitAll(dir: string) {
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.email", "live@example.com");
  git(dir, "config", "user.name", "Live Test");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
}

// ── REQ-128 ──────────────────────────────────────────────────────────────────

test("REQ-128 SCN-128a: the harness records the attempt and its gate as events", () => {
  const p = adopted();
  try {
    openChange(p.dir);
    commitAll(p.dir);
    const seen = path.join(p.parent, "seen.txt");
    const agent = path.join(p.parent, "agent.js");
    fs.writeFileSync(
      agent,
      'const fs = require("node:fs");\n' +
        `fs.writeFileSync(${JSON.stringify(seen)}, String(process.env.AGENT_EVENTS_FILE));\n` +
        'fs.mkdirSync("test", { recursive: true });\n' +
        'fs.writeFileSync("lib/fee.js", "module.exports = 1;\\n");\n' +
        'fs.writeFileSync("test/fee.test.js", "// REQ-002 SCN-002a\\n");\n'
    );
    const r = cli(p.dir, [
      "harness",
      "run",
      "--req",
      "REQ-002",
      "--agent",
      `"${process.execPath}" "${agent}" {prompt_file}`,
      "--max-attempts",
      "1",
    ]);
    assert.match(out(r), /1 passed/, out(r));

    const file = path.join(p.dir, ".harness/events/REQ-002.jsonl");
    assert.equal(fs.realpathSync(fs.readFileSync(seen, "utf8")), fs.realpathSync(file));
    const events = lines(file);
    for (const e of events) {
      assert.equal(e.req, "REQ-002");
      assert.equal(e.attempt, 1);
      assert.equal(typeof e.t, "number");
    }
    assert.deepEqual(events[0], { ...events[0], type: "attempt", state: "start" });
    const gates = events.filter((e) => e.type === "gate");
    assert.ok(gates.length >= 2, JSON.stringify(events));
    assert.ok(gates.every((g) => g.result === "pass"));
    assert.deepEqual(events[events.length - 1].result, "pass");
    assert.equal(git(p.dir, "status", "--porcelain", "--", ".harness").stdout, "");
  } finally {
    p.done();
  }
});

// ── REQ-129, REQ-130 ─────────────────────────────────────────────────────────

function stream(dir: string) {
  const call = (id: string, name: string, input: Record<string, string>) => ({
    type: "assistant",
    message: { content: [{ type: "tool_use", id, name, input }] },
  });
  const result = (id: string, content: string, isError = false) => ({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] },
  });
  return [
    { type: "system", subtype: "init" },
    { type: "assistant", message: { content: [{ type: "text", text: "Reading the module." }] } },
    call("t1", "Read", { file_path: path.join(dir, "src/a.ts") }),
    result("t1", "export const secret = 'file contents';"),
    call("t2", "Edit", {
      file_path: path.join(dir, "src/a.ts"),
      old_string: "a",
      new_string: "b\nc",
    }),
    result("t2", "ok"),
    call("t3", "Bash", { command: "npm test" }),
    result("t3", "ℹ pass 3\nℹ fail 0\nsecret body"),
    call("t4", "Bash", {
      command: "curl -H 'Authorization: Bearer abc123def456' https://api.example.com",
    }),
    result("t4", "secret body"),
    call("t5", "Bash", { command: "echo ghp_0123456789abcdefghijklmnop done" }),
    result("t5", "ghp_0123456789abcdefghijklmnop done"),
    { type: "result", subtype: "success", result: "Done." },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n");
}

test("REQ-129 SCN-129a + REQ-130 SCN-130a: Claude Code's steps become masked events", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-adapter-"));
  try {
    const file = path.join(dir, "events.jsonl");
    const r = cli(dir, ["harness", "events", "--from", "claude"], {
      input: stream(dir),
      env: {
        AGENT_EVENTS_FILE: file,
        AGENT_EVENTS_REQ: "REQ-002",
        AGENT_EVENTS_ATTEMPT: "2",
        MY_API_TOKEN: "abc123def456",
      },
    });
    assert.equal(r.status, 0, out(r));
    assert.equal(r.stdout, "Done.\n");
    const events = lines(file);
    const steps = events.filter((e) => e.type === "step");
    assert.deepEqual(
      steps.slice(0, 3).map((s) => [s.kind, s.target]),
      [
        ["read", "src/a.ts"],
        ["edit", "src/a.ts"],
        ["test", "npm test"],
      ]
    );
    assert.deepEqual([steps[1].added, steps[1].removed], [2, 1]);
    assert.deepEqual([steps[2].pass, steps[2].fail], [3, 0]);
    assert.ok(events.every((e) => e.req === "REQ-002" && e.attempt === 2));
    assert.ok(events.some((e) => e.type === "message" && e.text === "Reading the module."));

    const raw = fs.readFileSync(file, "utf8");
    assert.match(raw, /Authorization: Bearer \*\*\*/);
    for (const leaked of ["file contents", "secret body", "abc123def456", "ghp_0123456789"]) {
      assert.ok(!raw.includes(leaked), `${leaked} leaked into the events`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-131, REQ-132 ─────────────────────────────────────────────────────────

function get(port: number, urlPath: string, host = `127.0.0.1:${port}`) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: urlPath, headers: { host } },
      (res: IncomingMessage) => {
        let body = "";
        res.on("data", (d: Buffer) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
  });
}

async function studio(dir: string) {
  const port = 41000 + Math.floor(Math.random() * 2000);
  // Its own process group: the CLI runs studio as a child, and killing only the
  // CLI would leave the server holding the test open.
  const child = spawn(process.execPath, [CLI_PATH, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
    detached: true,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("studio did not start")), 8000);
    child.stdout.on("data", (d: Buffer) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return {
    port,
    // The whole tree, and only once it has exited: the CLI runs studio as a
    // grandchild, and a server left running holds the temp project open, so
    // removing it failed with EBUSY on Windows, which has no process groups.
    stop: async () => {
      const exited = new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) resolve();
        else child.once("exit", () => resolve());
      });
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      } else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill();
        }
      }
      await exited;
    },
  };
}

test("REQ-131 SCN-131a: the live view shows a requirement in progress, and pushes changes", async () => {
  const p = adopted();
  const s = await studio(p.dir);
  try {
    const file = path.join(p.dir, ".harness/events/REQ-002.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const now = Math.floor(Date.now() / 1000);
    const ev = (e: Record<string, unknown>) =>
      JSON.stringify({ t: now, req: "REQ-002", attempt: 1, ...e }) + "\n";
    fs.writeFileSync(
      file,
      ev({ type: "attempt", state: "start" }) +
        ev({ type: "step", kind: "read", target: "src/a.ts", result: "ok" }) +
        ev({ type: "step", kind: "edit", target: "src/a.ts", result: "ok", added: 2, removed: 1 }) +
        ev({ type: "step", kind: "test", target: "npm test", result: "ok", pass: 3, fail: 0 })
    );
    const model = JSON.parse((await get(s.port, "/live.json")).body);
    const r = model.requirements.find((x: { req: string }) => x.req === "REQ-002");
    assert.equal(r.attempt, 1);
    assert.equal(r.phase, "test");
    assert.deepEqual(r.files, ["src/a.ts"]);
    assert.deepEqual(r.tests, { pass: 3, fail: 0 });
    assert.equal(r.steps[0].kind, "test", "newest first");
    assert.match((await get(s.port, "/live")).body, /Harness live/);

    // The stream: the current state, then the change, without a reload.
    const pushed = await new Promise<string[]>((resolve, reject) => {
      const got: string[] = [];
      const req = http.get(
        { host: "127.0.0.1", port: s.port, path: "/live/stream", headers: { host: "localhost" } },
        (res: IncomingMessage) => {
          res.on("data", (d: Buffer) => {
            for (const m of String(d).matchAll(/^data: (.*)$/gm)) got.push(m[1]);
            if (got.length === 1) {
              fs.appendFileSync(file, ev({ type: "attempt", state: "end", result: "pass" }));
            }
            if (got.length >= 2) {
              req.destroy();
              resolve(got);
            }
          });
        }
      );
      req.on("error", reject);
      setTimeout(() => reject(new Error(`no push: ${got.length}`)), 6000);
    });
    const last = JSON.parse(pushed[1]).requirements.find(
      (x: { req: string }) => x.req === "REQ-002"
    );
    assert.equal(last.state, "pass");
  } finally {
    await s.stop();
    p.done();
  }
});

test("REQ-132 SCN-132a: studio refuses another host name and listens on loopback only", async () => {
  const p = adopted();
  const s = await studio(p.dir);
  try {
    assert.equal((await get(s.port, "/live.json", "attacker.example")).status, 403);
    assert.equal((await get(s.port, "/live.json", `localhost:${s.port}`)).status, 200);
    const { hostAllowed } = require("../../scripts/cli/commands/spec/StudioCommand");
    assert.equal(hostAllowed("127.0.0.1", "[::1]:4173"), true);
    assert.equal(hostAllowed("0.0.0.0", "attacker.example"), true, "--host opens it deliberately");
    const lsof = spawnSync("lsof", ["-nP", `-iTCP:${s.port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
    if (lsof.status === 0) assert.match(lsof.stdout, /127\.0\.0\.1:/);
  } finally {
    await s.stop();
    p.done();
  }
});

// ── REQ-133 ──────────────────────────────────────────────────────────────────

test("REQ-133 SCN-133a: explore hands the agent the project and undoes what it writes", () => {
  const p = adopted();
  try {
    openChange(p.dir);
    commitAll(p.dir);
    const before = git(p.dir, "status", "--porcelain").stdout;
    const agent = path.join(p.parent, "explorer.js");
    fs.writeFileSync(
      agent,
      'const fs = require("node:fs");\n' +
        'const brief = fs.readFileSync(process.argv[2], "utf8");\n' +
        'fs.writeFileSync("notes.md", "thinking\\n");\n' +
        'console.log(brief.includes("pricing: REQ-002") ? "ANSWER: partial refunds fit REQ-002" : "NO BRIEF");\n'
    );
    const r = cli(p.dir, [
      "explore",
      "Should refunds be partial?",
      "--agent",
      `"${process.execPath}" "${agent}" {prompt_file}`,
    ]);
    assert.equal(r.status, 0, out(r));
    assert.match(out(r), /ANSWER: partial refunds fit REQ-002/);
    assert.match(out(r), /Undone — explore writes nothing: notes\.md/);
    assert.equal(fs.existsSync(path.join(p.dir, "notes.md")), false);
    assert.equal(git(p.dir, "status", "--porcelain").stdout, before);

    const plain = cli(p.dir, ["explore", "Should refunds be partial?"]);
    assert.match(plain.stdout, /## The question\n\nShould refunds be partial\?/);
  } finally {
    p.done();
  }
});

test("explore outside a Specgate project refuses cleanly, like every other command", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "sg-explore-none-"));
  try {
    const r = cli(empty, ["explore"]);
    assert.equal(r.status, 2, out(r));
    assert.doesNotMatch(out(r), /ENOENT|at \S+ \(/);
    assert.match(out(r), /fix:/);
    const j = cli(empty, ["explore", "--project-dir", empty, "--json"]);
    assert.equal(j.status, 2, out(j));
    const doc = JSON.parse(j.stdout);
    assert.equal(doc.explore, null);
    assert.equal(doc.status[0].code, "project_not_found");
    assert.ok(doc.status[0].fix);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

// ── REQ-134 ──────────────────────────────────────────────────────────────────

function snapshot(dir: string) {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else files.push(`${path.relative(dir, f)}:${fs.readFileSync(f, "utf8")}`);
    }
  };
  walk(dir);
  return files.sort().join("\n");
}

test("REQ-134 SCN-134a: the tour runs the loop on a copy and leaves the repository untouched", () => {
  const p = adopted();
  try {
    const before = snapshot(p.dir);
    const r = cli(p.dir, ["onboard", "--tour"]);
    assert.equal(r.status, 0, out(r));
    const order = ["propose", "write", "status", "apply", "archive", "check"].map((v) =>
      r.stdout.indexOf(`  ${v}  `)
    );
    assert.ok(
      order.every((i) => i > 0),
      r.stdout
    );
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
      "in order"
    );
    assert.match(r.stdout, /temporary copy of this repository/);
    assert.match(r.stdout, /specgate propose <your-first-change>/);
    assert.equal(snapshot(p.dir), before);
  } finally {
    p.done();
  }
});
