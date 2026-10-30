/**
 * Each repository's live view, from the workspace (REQ-410..REQ-412, truck-flote
 * MS7-2): the workspace's studio serves a member's own live view — its queue,
 * console, attempts and gate — under `/live/repo/<name>/`, kept current, and the
 * workspace's live view leads to it.
 *
 * Real repositories in a temp folder, each with git and its own identity (CI
 * runners have none); the harness's events are written as the harness writes them.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function sg(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function member(root: string, name: string): string {
  const out = path.join(root, `.init-${name}`);
  const r = sg(root, "init", "--yes", "--out", out, "--no-git", "--keep-matrix");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, name);
  fs.renameSync(path.join(out, "my-spec-driven-app"), dir);
  fs.rmSync(out, { recursive: true, force: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return dir;
}

/** A delta adding one requirement to a member's sub-change. */
function delta(dir: string, change: string, req: string, extra = "") {
  const cap = path.join(dir, "docs", "specs", "changes", change, "specs", "shipments");
  fs.mkdirSync(cap, { recursive: true });
  const n = req.slice(4);
  fs.writeFileSync(
    path.join(cap, "spec.md"),
    [
      "# Delta — shipments",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${req} — The client follows their shipment`,
      "",
      "The system SHALL show the client the truck's last position.",
      "",
      `#### Scenario: SCN-${n} — The client opens the tracking`,
      "",
      "- GIVEN shipment ENV-1 is on truck TRK-1",
      "- WHEN the client opens its tracking",
      "- THEN they see TRK-1's last position",
      "",
      `<!-- specgate:trace actor=Client kind=functional${extra} -->`,
      "",
    ].join("\n")
  );
}

/** fleet and tracking, a workspace beside them, and the story follow-shipment. */
function story(): { ws: string; fleet: string; tracking: string } {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wsl-")));
  made.push(root);
  const fleet = member(root, "fleet");
  const tracking = member(root, "tracking");
  const ws = path.join(root, "ws");
  fs.mkdirSync(ws);
  assert.equal(sg(ws, "workspace", "init", "--name", "truck-flote").status, 0);
  const r = sg(ws, "workspace", "propose", "follow-shipment", "--repos", "fleet,tracking");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  delta(fleet, "follow-shipment", "REQ-003");
  delta(tracking, "follow-shipment", "REQ-005", " depends=fleet:REQ-000");
  for (const d of [fleet, tracking]) {
    git(d, "add", "-A");
    git(d, "commit", "-qm", "follow-shipment");
  }
  return { ws, fleet, tracking };
}

/** What `harness run` leaves for REQ-005 in tracking: on semgrep, after an edit. */
function trackingAtWork(tracking: string) {
  const events = path.join(tracking, ".harness", "events");
  fs.mkdirSync(events, { recursive: true });
  const lines = [
    { type: "attempt", state: "start", attempt: 1, t: 100 },
    { type: "step", kind: "edit", target: "src/TrackingController.java", attempt: 1, t: 101 },
    { type: "usage", final: true, cost: 0.42, input: 10, output: 5, attempt: 1, t: 102 },
    {
      type: "gate-start",
      stage: "quality: semgrep",
      runner: "docker",
      image: "semgrep/semgrep:1.99.0",
      attempt: 1,
      t: 103,
    },
  ];
  fs.writeFileSync(
    path.join(events, "REQ-005.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
  );
  fs.writeFileSync(path.join(events, "queue.json"), JSON.stringify({ t: 99, queue: ["REQ-005"] }));
  const runs = path.join(tracking, ".harness", "runs");
  fs.mkdirSync(runs, { recursive: true });
  fs.writeFileSync(
    path.join(runs, "2026-10-29T10-00-00-000Z.json"),
    JSON.stringify({
      startedAt: "2026-10-29T10:00:00.000Z",
      results: [{ requirement: "REQ-005", result: "fail", attempts: 1, durationMs: 120000 }],
    })
  );
}

function get(port: number, urlPath: string) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: urlPath, headers: { host: `127.0.0.1:${port}` } },
      (res: { statusCode?: number; on: (e: string, f: (d?: Buffer) => void) => void }) => {
        let body = "";
        res.on("data", (d?: Buffer) => (body += String(d)));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
  });
}

/** The first `live` event of a stream, then the connection closed. */
function firstEvent(port: number, urlPath: string) {
  return new Promise<{ status: number | undefined; data: string }>((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: urlPath, headers: { host: `127.0.0.1:${port}` } },
      (res: {
        statusCode?: number;
        on: (e: string, f: (d?: Buffer) => void) => void;
        destroy: () => void;
      }) => {
        let buf = "";
        res.on("data", (d?: Buffer) => {
          buf += String(d);
          const m = /event: live\ndata: (.*)\n\n/.exec(buf);
          if (m) {
            resolve({ status: res.statusCode, data: m[1] });
            req.destroy();
          }
        });
        res.on("end", () => resolve({ status: res.statusCode, data: "" }));
      }
    );
    req.on("error", (e: Error & { code?: string }) => {
      if (e.code !== "ECONNRESET") reject(e);
    });
  });
}

/** The workspace's studio, started on a free port, stopped once `body` is done. */
async function withStudio(ws: string, body: (port: number) => Promise<void>) {
  const port = 45000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: ws,
    env: { ...process.env, NO_COLOR: "1" },
    detached: process.platform !== "win32",
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("studio did not start")), 15000);
      child.stdout.on("data", (d: Buffer) => {
        if (String(d).includes("http://")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await body(port);
  } finally {
    const exited = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
    await exited;
  }
}

test("REQ-410 SCN-410a: the developer follows tracking from the workspace", async () => {
  const { ws, tracking } = story();
  trackingAtWork(tracking);
  await withStudio(ws, async (port) => {
    const moved = await get(port, "/live/repo/tracking");
    assert.equal(moved.status, 301);

    const page = await get(port, "/live/repo/tracking/");
    assert.equal(page.status, 200);
    assert.match(page.body, /Harness live/);
    assert.match(page.body, /aria-label="Work queue"/);
    assert.match(page.body, /href="\/live"/);
    assert.match(page.body, /tracking/);
    assert.match(page.body, /service/);

    const model = JSON.parse((await get(port, "/live/repo/tracking/live.json")).body);
    const r005 = model.requirements.find((r: { req: string }) => r.req === "REQ-005");
    assert.ok(r005, "REQ-005 is not in tracking's live model");
    assert.equal(r005.attempt, 1);
    assert.equal(r005.state, "running");

    const ev = await firstEvent(port, "/live/repo/tracking/live/stream");
    assert.equal(ev.status, 200);
    assert.match(ev.data, /REQ-005/);
  });
});

test("REQ-411 SCN-411a: the workspace's live view leads to each repository's", async () => {
  const { ws } = story();
  await withStudio(ws, async (port) => {
    const page = await get(port, "/live");
    assert.equal(page.status, 200);
    assert.match(page.body, /"\/live\/repo\/"/);
  });
});

test("REQ-412 SCN-412a: an unknown repository, and one whose folder is gone", async () => {
  const { ws, fleet } = story();
  fs.rmSync(fleet, { recursive: true, force: true });
  await withStudio(ws, async (port) => {
    const unknown = await get(port, "/live/repo/billing/");
    assert.equal(unknown.status, 404);
    assert.match(unknown.body, /fleet/);
    assert.match(unknown.body, /tracking/);
    const missing = await get(port, "/live/repo/fleet/live.json");
    assert.equal(missing.status, 404);
    assert.match(missing.body, /fleet/);
    assert.match(missing.body, /missing/);
  });
});
