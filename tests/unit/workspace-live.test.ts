/**
 * The workspace's live view (REQ-320..324): every repository's harness, each
 * story's parts and what they cost, seen from the workspace repository.
 *
 * Real repositories in a temp folder, each with git and its own identity (CI
 * runners have none); the harness's events and ledger are written as the
 * harness writes them.
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

function live(ws: string) {
  const r = sg(ws, "workspace", "live", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).live;
}

test("REQ-320 SCN-320a: tracking is on a quality check, fleet is idle", () => {
  const { ws, tracking } = story();
  trackingAtWork(tracking);
  const model = live(ws);
  const panel = (n: string) => model.repos.find((r: { name: string }) => r.name === n);
  const t = panel("tracking");
  assert.deepEqual(t.queue, ["REQ-005"]);
  assert.equal(t.inFlight.req, "REQ-005");
  assert.equal(t.inFlight.attempt, 1);
  assert.equal(t.inFlight.running.stage, "quality: semgrep");
  assert.equal(t.inFlight.running.runner, "docker");
  assert.equal(t.inFlight.running.since, 103);
  assert.deepEqual(t.inFlight.agent, { kind: "edit", target: "src/TrackingController.java" });
  assert.equal(panel("fleet").inFlight, null);
});

test("REQ-321 SCN-321a: tracking builds, and waits on fleet", () => {
  const { ws, tracking } = story();
  trackingAtWork(tracking);
  const s = live(ws).stories.find((x: { id: string }) => x.id === "follow-shipment");
  const part = (n: string) => s.subchanges.find((x: { repo: string }) => x.repo === n);
  assert.equal(part("tracking").state, "building");
  assert.deepEqual(part("tracking").blockedBy, ["fleet:REQ-000"]);
  assert.equal(part("fleet").state, "open");
  assert.deepEqual(part("fleet").blockedBy, []);
  assert.deepEqual(part("tracking").requirements, ["REQ-005"]);
});

test("REQ-322 SCN-322a: tracking's REQ-005 cost 0.42 and 2 minutes", () => {
  const { ws, tracking } = story();
  trackingAtWork(tracking);
  const model = live(ws);
  const t = model.repos.find((r: { name: string }) => r.name === "tracking");
  assert.deepEqual(t.cost, { money: 0.42, minutes: 2 });
  assert.deepEqual(model.repos.find((r: { name: string }) => r.name === "fleet").cost, {
    money: null,
    minutes: 0,
  });
  const s = model.stories.find((x: { id: string }) => x.id === "follow-shipment");
  assert.deepEqual(s.cost, { money: 0.42, minutes: 2 });
});

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

test("REQ-323 SCN-323a: studio in the workspace repository", async () => {
  const { ws } = story();
  const port = 43000 + Math.floor(Math.random() * 2000);
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
    const model = JSON.parse((await get(port, "/live.json")).body);
    assert.equal(model.live.name, "truck-flote");
    assert.deepEqual(
      model.live.repos.map((r: { name: string }) => r.name),
      ["fleet", "tracking"]
    );
    const page = await get(port, "/live");
    assert.equal(page.status, 200);
    assert.match(page.body, /Workspace live/);
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
});

test("REQ-324 SCN-324a: a dry run names each repository's harness", () => {
  const { ws, fleet, tracking } = story();
  const r = sg(
    ws,
    "workspace",
    "harness",
    "run",
    "--story",
    "follow-shipment",
    "--dry-run",
    "--json"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const runs = JSON.parse(r.stdout).harness.runs;
  const of = (n: string) => runs.find((x: { repo: string }) => x.repo === n);
  assert.deepEqual(of("fleet").requirements, ["REQ-003"]);
  assert.deepEqual(of("tracking").requirements, ["REQ-005"]);
  assert.ok(of("fleet").command.includes("--req REQ-003"), of("fleet").command);
  for (const d of [fleet, tracking]) {
    assert.equal(fs.existsSync(path.join(d, ".harness", "runs")), false, "nothing started");
  }
});

test("REQ-324 SCN-324b: one red base, no harness", () => {
  const { ws, fleet, tracking } = story();
  const matrix = path.join(fleet, "docs", "specs", "traceability.md");
  fs.writeFileSync(
    matrix,
    fs.readFileSync(matrix, "utf8").replace(/(\| REQ-000 \|.*\| )Draft( \|)/, "$1Implemented$2")
  );
  git(fleet, "commit", "-qam", "REQ-000 marked Implemented");
  const r = sg(ws, "workspace", "harness", "run", "--story", "follow-shipment", "--json");
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /fleet/);
  const logs = path.join(ws, ".specgate", "workspace-runs", "follow-shipment");
  assert.equal(fs.existsSync(logs), false, "no harness started");
  for (const d of [fleet, tracking]) {
    assert.equal(fs.existsSync(path.join(d, ".harness", "runs")), false);
  }
});
