/**
 * The workspace after the first microservices run of 1.0.0-rc.1
 * (REQ-339..349): from the client's brief to stories, a story carried into
 * every repository, dependency order, and what the live view shows.
 *
 * Every test builds real repositories in a temp folder, each with its own git
 * identity (CI runners have none), and drives the CLI the way a person would.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "specgate-rc2-"): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

function sg(cwd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function gitRepo(dir: string) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
}

function commit(dir: string, msg = "work") {
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", msg);
}

/** A member repository: a Specgate project with git and its own identity. */
function member(root: string, folder: string): string {
  const out = path.join(root, `.init-${folder}`);
  const r = sg(root, ["init", "--yes", "--out", out, "--no-git", "--keep-matrix"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, folder);
  fs.renameSync(path.join(out, "my-spec-driven-app"), dir);
  fs.rmSync(out, { recursive: true, force: true });
  gitRepo(dir);
  commit(dir, "seed");
  return dir;
}

const BRIEF = [
  "# Proyecto: control de flota",
  "",
  "El cliente quiere un Panel del Cliente donde ver su envío en tiempo real.",
  "",
].join("\n");

const STORIES_FM =
  "stories:\n  - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }\n";

/** fleet and tracking, and a workspace repository holding the client's brief. */
function product(): { root: string; ws: string; fleet: string; tracking: string } {
  const root = tmp();
  const fleet = member(root, "fleet");
  const tracking = member(root, "tracking");
  const ws = path.join(root, "ws");
  fs.mkdirSync(ws);
  gitRepo(ws);
  fs.writeFileSync(path.join(ws, "brief.md"), BRIEF, "utf8");
  const r = sg(ws, ["workspace", "init", "--name", "truck-flote"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  commit(ws, "the brief and the workspace");
  return { root, ws, fleet, tracking };
}

/** The brief's front matter with follow-shipment, and its story drafted by hand. */
function drafted(ws: string) {
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  const file = path.join(ws, "docs", "brief.md");
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text.replace(/^stories:.*$/m, STORIES_FM.trimEnd()), "utf8");
  const r = sg(ws, ["workspace", "draft", "follow-shipment"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const story = path.join(ws, "docs", "stories", "follow-shipment", "story.md");
  const s = fs.readFileSync(story, "utf8");
  fs.writeFileSync(
    story,
    s
      .replace(/## Intent\n\n<!--[^]*?-->\n/, "## Intent\n\nEl cliente ve dónde está su envío.\n")
      .replace(
        /## Acceptance criteria\n\n<!--[^]*?-->\n(- AC-1:\n)?/,
        "## Acceptance criteria\n\n- AC-1: El cliente ve el camión que lleva su envío.\n"
      ),
    "utf8"
  );
  commit(ws, "the story drafted");
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

/** follow-shipment split across fleet (REQ-003) and tracking (REQ-005, waiting on fleet's). */
function split() {
  const p = product();
  drafted(p.ws);
  const r = sg(p.ws, ["workspace", "propose", "follow-shipment"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  delta(p.fleet, "follow-shipment", "REQ-003");
  delta(p.tracking, "follow-shipment", "REQ-005", " depends=fleet:REQ-003");
  for (const d of [p.fleet, p.tracking, p.ws]) commit(d, "follow-shipment");
  return p;
}

const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;
const discover = (dir: string) =>
  fs.readFileSync(
    path.join(dir, "docs", "specs", "changes", "follow-shipment", "discover.md"),
    "utf8"
  );

// ── REQ-339 ──────────────────────────────────────────────────────────────────

test("REQ-339 SCN-339a: the brief saved at the root", () => {
  const { ws } = product();
  const first = sg(ws, ["workspace", "draft"]);
  assert.equal(first.status, 0, out(first));
  const brief = fs.readFileSync(path.join(ws, "docs", "brief.md"), "utf8");
  assert.match(brief, /^---\n[^]*stories:[^]*\n---\n/);
  assert.match(brief, /Panel del Cliente/, "the client's text, kept");

  fs.writeFileSync(
    path.join(ws, "docs", "brief.md"),
    brief.replace(/^stories:.*$/m, STORIES_FM.trimEnd()),
    "utf8"
  );
  const second = sg(ws, ["workspace", "draft", "--json"]);
  assert.equal(second.status, 0, out(second));
  const stories = JSON.parse(second.stdout).workspace.stories;
  assert.deepEqual(stories[0].id, "follow-shipment");
  assert.deepEqual(stories[0].repos, ["fleet", "tracking"]);
  assert.equal(stories[0].title, "El cliente sigue su envío");
});

// ── REQ-340 ──────────────────────────────────────────────────────────────────

test("REQ-340 SCN-340a: the agent writes the story and touches the brief", () => {
  const { root, ws } = product();
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  const file = path.join(ws, "docs", "brief.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace(/^stories:.*$/m, STORIES_FM.trimEnd()),
    "utf8"
  );
  commit(ws, "stories named");
  const briefBefore = fs.readFileSync(file, "utf8");

  const agents = path.join(root, "agents");
  fs.mkdirSync(agents);
  fs.writeFileSync(
    path.join(agents, "story.js"),
    [
      "const fs = require('fs');",
      "const prompt = fs.readFileSync(process.argv[2], 'utf8');",
      "const saw = prompt.includes('Panel del Cliente') ? 'SAW_BRIEF' : 'NO_BRIEF';",
      "fs.writeFileSync('docs/stories/follow-shipment/story.md',",
      "  '# Story: El cliente sigue su envío\\n\\n## Intent\\n\\n' + saw + '\\n\\n## Acceptance criteria\\n\\n- AC-1: El cliente ve el camión.\\n');",
      "fs.appendFileSync('docs/brief.md', 'rewritten by the agent\\n');",
      "",
    ].join("\n")
  );
  const r = sg(ws, [
    "workspace",
    "draft",
    "follow-shipment",
    "--agent",
    `node "${path.join(agents, "story.js")}" {prompt_file}`,
  ]);
  assert.equal(r.status, 0, out(r));
  const story = fs.readFileSync(
    path.join(ws, "docs", "stories", "follow-shipment", "story.md"),
    "utf8"
  );
  assert.match(story, /SAW_BRIEF/, "the prompt carried the brief");
  assert.match(story, /AC-1: El cliente ve el camión/);
  // Put back from git, whose line endings follow the platform's settings.
  const lf = (t: string) => t.replace(/\r\n/g, "\n");
  assert.equal(lf(fs.readFileSync(file, "utf8")), lf(briefBefore), "the brief is put back");
});

// ── REQ-341 ──────────────────────────────────────────────────────────────────

test("REQ-341 SCN-341a: a workspace with its brief and no story", () => {
  const { ws } = product();
  const r = sg(ws, ["status"]);
  assert.equal(r.status, 0, out(r));
  assert.match(out(r), /truck-flote/);
  assert.match(out(r), /fleet/);
  assert.match(out(r), /specgate workspace draft/);
});

// ── REQ-342 / REQ-344 ────────────────────────────────────────────────────────

test("REQ-342 SCN-342a: follow-shipment, drafted, split", () => {
  const { fleet, tracking } = split();
  for (const d of [fleet, tracking]) {
    const text = discover(d);
    assert.match(text, /El cliente ve dónde está su envío/);
    assert.match(text, /AC-1: El cliente ve el camión que lleva su envío/);
    assert.match(text, /truck-flote:follow-shipment/);
    assert.doesNotMatch(text, /in the workspace repository/);
  }
});

test("REQ-344 SCN-344a: tracking is told of fleet", () => {
  const { ws, tracking } = split();
  const text = discover(tracking);
  assert.match(text, /`fleet`/);
  // REQ-365: the guidance is the design's, not the Discover's.
  const design = fs.readFileSync(
    path.join(tracking, "docs", "specs", "changes", "follow-shipment", "design.md"),
    "utf8"
  );
  assert.match(design, /depends=fleet:REQ-NNN/);

  const r = sg(ws, [
    "workspace",
    "harness",
    "run",
    "--story",
    "follow-shipment",
    "--dry-run",
    "--json",
  ]);
  assert.equal(r.status, 0, out(r));
  const run = JSON.parse(r.stdout).harness.runs.find(
    (x: { repo: string }) => x.repo === "tracking"
  );
  assert.ok(run.context, r.stdout);
  const context = fs.readFileSync(path.join(ws, run.context), "utf8");
  assert.match(context, /fleet:REQ-003/);

  const prompt = sg(tracking, ["harness", "prompt", "REQ-005"], {
    SPECGATE_STORY_CONTEXT: path.join(ws, run.context),
  });
  assert.equal(prompt.status, 0, out(prompt));
  assert.match(prompt.stdout, /fleet:REQ-003/);
});

// ── REQ-343 ──────────────────────────────────────────────────────────────────

test("REQ-343 SCN-343a: fleet rewrites AC-1", () => {
  const { ws, fleet } = split();
  const file = path.join(fleet, "docs", "specs", "changes", "follow-shipment", "discover.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace("AC-1: El cliente ve el camión", "AC-1: Otra cosa"),
    "utf8"
  );
  commit(fleet, "a reworded criterion");
  const r = sg(ws, ["workspace", "check", "--json"]);
  const doc = JSON.parse(r.stdout);
  const diverged = (doc.workspace.warnings || doc.status || []).filter(
    (d: { code: string }) => d.code === "workspace_story_diverged"
  );
  assert.equal(diverged.length, 1, r.stdout);
  assert.equal(diverged[0].target, "fleet");
});

// ── REQ-345 ──────────────────────────────────────────────────────────────────

test("REQ-345 SCN-345a: tracking waits on fleet", () => {
  const { ws } = split();
  const r = sg(ws, [
    "workspace",
    "harness",
    "run",
    "--story",
    "follow-shipment",
    "--dry-run",
    "--json",
  ]);
  assert.equal(r.status, 0, out(r));
  const runs = JSON.parse(r.stdout).harness.runs;
  const level = (n: string) => runs.find((x: { repo: string }) => x.repo === n).level;
  assert.equal(level("fleet"), 1);
  assert.equal(level("tracking"), 2);
  const text = sg(ws, ["workspace", "harness", "run", "--story", "follow-shipment", "--dry-run"]);
  assert.match(text.stdout, /1\b[^\n]*fleet/);
  assert.match(text.stdout, /2\b[^\n]*tracking/);
});

// ── REQ-346 ──────────────────────────────────────────────────────────────────

function get(port: number, urlPath: string) {
  return new Promise<{ type: string; body: string }>((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: urlPath, headers: { host: `127.0.0.1:${port}` } },
      (res: {
        headers: Record<string, string>;
        on: (e: string, f: (d?: Buffer) => void) => void;
      }) => {
        const chunks: Buffer[] = [];
        res.on("data", (d?: Buffer) => d && chunks.push(d));
        res.on("end", () =>
          resolve({
            type: String(res.headers["content-type"] || ""),
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
  });
}

test("REQ-346 SCN-346a: a title with an accent", async () => {
  const { ws } = split();
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
    const r = await get(port, "/live.json");
    assert.match(r.type, /charset=utf-8/i);
    const story = JSON.parse(r.body).live.stories[0];
    assert.equal(story.title, "El cliente sigue su envío");
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

// ── REQ-347 ──────────────────────────────────────────────────────────────────

test("REQ-347 SCN-347a: fleet's part archived after two minutes", () => {
  const { ws, fleet } = split();
  const changes = path.join(fleet, "docs", "specs", "changes");
  fs.mkdirSync(path.join(changes, "archive"), { recursive: true });
  fs.renameSync(
    path.join(changes, "follow-shipment"),
    path.join(changes, "archive", "2026-10-30-follow-shipment")
  );
  const runs = path.join(fleet, ".harness", "runs");
  fs.mkdirSync(runs, { recursive: true });
  fs.writeFileSync(
    path.join(runs, "2026-10-30T10-00-00-000Z.json"),
    JSON.stringify({
      startedAt: "2026-10-30T10:00:00.000Z",
      results: [{ requirement: "REQ-003", result: "pass", attempts: 1, durationMs: 120000 }],
    })
  );
  const r = sg(ws, ["workspace", "live", "--json"]);
  assert.equal(r.status, 0, out(r));
  const story = JSON.parse(r.stdout).live.stories[0];
  assert.equal(story.cost.minutes, 2, r.stdout);
});

// ── REQ-348 / REQ-349 ────────────────────────────────────────────────────────

test("REQ-348 SCN-348a: truck-flote-fleet and truck-flote-web", () => {
  const root = tmp();
  member(root, "truck-flote-fleet");
  member(root, "truck-flote-web");
  const ws = path.join(root, "truck-flote-workspace");
  fs.mkdirSync(ws);
  const r = sg(ws, ["workspace", "init", "--json"]);
  assert.equal(r.status, 0, out(r));
  const repos = JSON.parse(r.stdout).workspace.repos;
  assert.deepEqual(
    repos.map((x: { name: string; path: string }) => [x.name, x.path]),
    [
      ["fleet", "../truck-flote-fleet"],
      ["web", "../truck-flote-web"],
    ]
  );
  const ws2 = path.join(root, "again");
  fs.mkdirSync(ws2);
  const text = sg(ws2, ["workspace", "init"]);
  assert.match(text.stdout, /fleet\s{2,}\.\.\/truck-flote-fleet/);
});

test("REQ-349 SCN-349a: after init", () => {
  const { ws } = product();
  assert.match(
    fs.readFileSync(path.join(ws, ".gitignore"), "utf8"),
    /\.specgate\/workspace-runs\//
  );
});
