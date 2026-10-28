"use strict";

/**
 * REQ-211..217 — the studio's route: the agent chosen per run, the seven
 * steps, a project from an empty folder, the brief as a form and from a
 * client's text, drafting each module, and the report.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const lib = () => require("../../scripts/lib/studio-route");

function tmp(prefix = "specgate-studio-route-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}

function writer(dir: string) {
  return (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

/** Kill a background job's whole tree before its folder is removed. */
function kill(pid: number) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"]);
  else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 500)"]);
}

const BRIEF = [
  "---",
  "product: Bookings for a driving school",
  "surfaces: [web]",
  "actors:",
  "  # The learner books from the phone.",
  "  - { name: Learner, surfaces: [web] }",
  "modules: [reservas, examen, pagos]",
  "---",
  "",
  "# The brief",
  "",
  "A school in Dresden wants its learners to book lessons.",
  "",
  "## Module: reservas",
  "",
  "Learners book a 90-minute slot with a teacher.",
  "",
  "Rules",
  "",
  "- A slot is booked by one learner at a time.",
  "",
  "Examples",
  "",
  "- The one where Ana books Tuesday at 10:00.",
  "",
  "## Module: examen",
  "",
  "Rules",
  "",
  "- An exam is booked once the card is complete.",
  "",
  "Examples",
  "",
  "- The one where Ben books his exam after his last lesson.",
  "",
  "## Module: pagos",
  "",
  "Rules",
  "",
  "- A lesson is paid before it starts.",
  "",
  "Examples",
  "",
  "- The one where Ana pays 55 euros for Tuesday.",
  "",
].join("\n");

/** A specgate project with the brief above, its profiles, and a first commit. */
function project(withGit = false) {
  const dir = tmp();
  const w = writer(dir);
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w("docs/brief.md", BRIEF);
  if (withGit) {
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init");
  }
  return dir;
}

/** Profiles `fast` (streams) and `deep`, with `fast` the configured one. */
function withProfiles(dir: string, fastAgent = "node -e 0 {prompt_file}") {
  const w = writer(dir);
  w(
    ".harness/profiles.yaml",
    [
      "profiles_version: 1",
      "profiles:",
      "  fast:",
      `    agent: ${JSON.stringify(fastAgent + " | specgate harness events --from claude")}`,
      "  deep:",
      '    agent: "deep-agent < {prompt_file}"',
      "    cost_per_run_hint: 1.9",
      "",
    ].join("\n")
  );
  w("harness.config.yaml", "harness_version: 1\nagent_profile: fast\n");
}

// ── REQ-211 ─────────────────────────────────────────────────────────────────

test("REQ-211 SCN-211c: the studio lists the profiles", () => {
  const dir = project();
  withProfiles(dir);
  const profiles = lib().profilesView(dir);
  const fast = profiles.find((p: { name: string }) => p.name === "fast");
  const deep = profiles.find((p: { name: string }) => p.name === "deep");
  assert.equal(fast.default, true);
  assert.equal(fast.streams, true);
  assert.equal(deep.default, false);
  assert.equal(deep.streams, false);
  assert.equal(deep.costHint, 1.9);
});

test("REQ-211 SCN-211a: a run with a chosen profile runs that profile's agent", () => {
  const dir = project();
  withProfiles(dir);
  writer(dir)(
    "docs/specs/capabilities/reservas/spec.md",
    "# reservas\n\n### Requirement: REQ-002 — Book a slot\n\n<!-- specgate:trace status=Draft -->\n\nThe system SHALL book a slot.\n\n#### Scenario: SCN-002 — Ana books\n\n- GIVEN a free slot\n- WHEN Ana books it\n- THEN it is hers\n"
  );
  writer(dir)(
    "docs/specs/traceability.md",
    "# Traceability\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n| REQ-002 | SCN-002 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Draft |\n"
  );
  const r = cli(dir, "harness", "run", "--req", "REQ-002", "--profile", "deep", "--dry-run");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Agent\s+deep-agent < \{prompt_file\}/);
});

test("REQ-211 SCN-211b: an unknown profile is refused, naming the ones declared", () => {
  const dir = project();
  withProfiles(dir);
  const r = cli(dir, "harness", "run", "--req", "REQ-002", "--profile", "other", "--dry-run");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /fast, deep/);
  const d = cli(dir, "propose", "--from-brief", "reservas", "--profile", "other");
  assert.notEqual(d.status, 0);
  assert.match(d.stdout + d.stderr, /fast, deep/);
});

// ── REQ-212 ─────────────────────────────────────────────────────────────────

test("REQ-212 SCN-212a: a project with a brief and no draft is at Drafts", () => {
  const dir = project();
  const r = lib().route(dir);
  const by = Object.fromEntries(r.steps.map((s: { key: string }) => [s.key, s]));
  assert.equal(by.project.state, "done");
  assert.equal(by.brief.state, "done", JSON.stringify(lib().briefForm(dir).findings));
  assert.equal(by.drafts.state, "current");
  assert.deepEqual(by.drafts.counts, { done: 0, total: 3 });
  assert.equal(by.build.state, "locked");
  assert.equal(by.report.state, "locked");
  assert.equal(r.next, "drafts");
});

test("REQ-212: the page shows the seven steps and reads the route's APIs", () => {
  const { studioAppPage } = require("../../scripts/lib/studio-app-page");
  const html = studioAppPage("demo", "abc123");
  for (const want of [
    'project:"Proyecto"',
    'brief:"Brief"',
    'drafts:"Borradores"',
    'report:"Informe"',
    'project:"Project"',
    '"api/route"',
    '"api/profiles"',
    '"api/brief"',
    '"api/brief/fill"',
    '"api/modules"',
    '"api/draft"',
    '"api/project"',
    '"api/report"',
    '"report.html"',
  ]) {
    assert.ok(html.includes(want), want);
  }
  const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new Function(script));
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|outerHTML/);
});

test("REQ-212 SCN-212b: a folder that is not a project starts at Project", () => {
  const dir = tmp();
  const r = lib().route(dir);
  assert.equal(r.isProject, false);
  assert.equal(r.empty, true);
  assert.equal(r.steps[0].state, "current");
  assert.ok(r.steps.slice(1).every((s: { state: string }) => s.state === "locked"));
});

// ── REQ-213 ─────────────────────────────────────────────────────────────────

test("REQ-213 SCN-213b: a folder with files is not overwritten", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "README.md"), "mine\n");
  const r = lib().createProject(dir, {
    name: "Autoescuela",
    kind: "web",
    stack: "node-react",
    agent: "claude",
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /specgate init/);
  assert.equal(read(dir, "README.md"), "mine\n");
  assert.deepEqual(fs.readdirSync(dir), ["README.md"]);
});

test("REQ-213 SCN-213a: a project is created in an empty folder", () => {
  const dir = tmp();
  const r = lib().createProject(dir, {
    name: "Autoescuela",
    kind: "web",
    stack: "node-react",
    agent: "claude",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(fs.existsSync(path.join(dir, "spec.md")));
  assert.ok(fs.existsSync(path.join(dir, "docs/brief.md")), "a brief to fill");
  assert.match(read(dir, "harness.config.yaml"), /^agent_profile: claude-sonnet$/m);
  assert.match(
    read(dir, ".harness/profiles.yaml"),
    /claude-sonnet:\n\s+agent: "claude -p --model sonnet/
  );
  assert.equal(lib().route(dir).steps[0].state, "done");
});

test("REQ-213 SCN-213a: the studio stays up in an empty folder", async () => {
  const dir = tmp();
  const http = require("node:http");
  const port = 47000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("studio did not start")), 8000);
      child.stdout.on("data", (d: Buffer) => {
        if (String(d).includes("http://")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const get = (url: string) =>
      new Promise<number>((resolve, reject) => {
        http
          .get(
            { host: "127.0.0.1", port, path: url, headers: { host: "localhost" } },
            (res: any) => {
              res.resume();
              res.on("end", () => resolve(res.statusCode || 0));
            }
          )
          .on("error", reject);
      });
    assert.equal(await get("/"), 200);
    // The browser asks for these by itself; the folder has no matrix yet.
    assert.equal(await get("/favicon.ico"), 404);
    assert.equal(await get("/status.json"), 404);
    assert.equal(await get("/api/route"), 200, "still serving the new-project step");
    assert.equal(child.exitCode, null);
  } finally {
    child.kill();
  }
});

// ── REQ-214 ─────────────────────────────────────────────────────────────────

test("REQ-214 SCN-214a: the brief round-trips through the form", () => {
  const dir = project();
  const form = lib().briefForm(dir);
  assert.equal(form.product, "Bookings for a driving school");
  assert.deepEqual(form.actors, [{ name: "Learner", surfaces: ["web"] }]);
  assert.deepEqual(
    form.modules.map((m: { key: string }) => m.key),
    ["reservas", "examen", "pagos"]
  );
  const reservas = form.modules.find((m: { key: string }) => m.key === "reservas");
  assert.match(reservas.prose, /90-minute slot/);
  reservas.rules.push("A slot can be cancelled free until 24 hours before.");
  lib().saveBriefForm(dir, form);
  const text = read(dir, "docs/brief.md");
  assert.match(text, /- A slot can be cancelled free until 24 hours before\./);
  assert.match(text, /Learners book a 90-minute slot with a teacher\./, "the prose is kept");
  assert.match(text, /- The one where Ben books his exam after his last lesson\./);
  assert.match(text, /# The learner books from the phone\./, "the front matter's notes are kept");
  assert.match(text, /^modules: \[reservas, examen, pagos\]$/m);
  assert.match(text, /A school in Dresden wants its learners to book lessons\./);
});

test("REQ-214 SCN-214b: the findings come back with the save", () => {
  const dir = project();
  const form = lib().briefForm(dir);
  form.modules.find((m: { key: string }) => m.key === "pagos").examples = [];
  const saved = lib().saveBriefForm(dir, form);
  const about = saved.findings.filter((f: { message: string }) => /pagos/.test(f.message));
  assert.ok(about.length > 0, JSON.stringify(saved.findings));
});

// ── REQ-215 ─────────────────────────────────────────────────────────────────

test("REQ-215 SCN-215b: an existing brief is kept", () => {
  const dir = project();
  withProfiles(dir);
  const r = lib().fillBrief(dir, "Another client's text", "fast");
  assert.equal(r.ok, false);
  assert.equal(r.code, "brief_exists");
  assert.equal(read(dir, "docs/brief.md"), BRIEF);
});

test("REQ-215 SCN-215a: a pasted text becomes the brief, and the agent starts on it", () => {
  const dir = project(true);
  fs.rmSync(path.join(dir, "docs/brief.md"));
  withProfiles(dir);
  const r = lib().fillBrief(dir, "La autoescuela quiere reservas online.", "fast");
  try {
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(read(dir, "docs/brief.md"), "La autoescuela quiere reservas online.");
    assert.equal(r.job.kind, "brief");
    assert.equal(r.job.profile, "fast");
  } finally {
    kill(r.ok ? r.job.pid : 0);
  }
});

// ── REQ-216 ─────────────────────────────────────────────────────────────────

test("REQ-216 SCN-216a, SCN-216b: a module is drafted in the background, one at a time", () => {
  const dir = project(true);
  const sleeper = path.join(tmp(), "sleep.js");
  fs.writeFileSync(sleeper, "setTimeout(() => {}, 20000);\n");
  withProfiles(dir, `node ${sleeper.split(path.sep).join("/")}`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "profiles");
  const r = lib().startDraft(dir, "reservas", "fast");
  try {
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.job.module, "reservas");
    const view = lib().draftsRoute(dir);
    assert.equal(view.job.module, "reservas");
    const reservas = view.modules.find((m: { key: string }) => m.key === "reservas");
    assert.equal(reservas.stage, "drafting");
    assert.ok(reservas.progress, "progress while drafting");
    const second = lib().startDraft(dir, "examen", "fast");
    assert.equal(second.ok, false);
    assert.match(second.message, /reservas/);
    assert.equal(lib().stopJob(dir).ok, true);
  } finally {
    kill(r.ok ? r.job.pid : 0);
  }
});

// ── REQ-217 ─────────────────────────────────────────────────────────────────

function halfBuilt() {
  const dir = project();
  const w = writer(dir);
  const req = (id: number, title: string, status: string) =>
    `### Requirement: REQ-00${id} — ${title}\n\n<!-- specgate:trace status=${status.includes(" ") ? `"${status}"` : status} -->\n\nThe system SHALL ${title.toLowerCase()}.\n\n#### Scenario: SCN-00${id} — Proof of ${title.toLowerCase()}\n\n- GIVEN a\n- WHEN b\n- THEN c\n`;
  w(
    "docs/specs/capabilities/reservas/spec.md",
    `# reservas\n\n${req(2, "Book a slot", "Implemented")}\n${req(3, "Cancel a slot", "Implemented")}\n${req(4, "Book two slots", "Needs Clarification")}`
  );
  w(
    "docs/specs/questions.md",
    "# Questions — project\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q1 | Can a learner book two slots in a row? | REQ-004 |  |  | open |\n"
  );
  return dir;
}

test("REQ-217 SCN-217a: the report of a project half built", () => {
  const dir = halfBuilt();
  const r = lib().report(dir, false);
  assert.equal(r.built, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(
    r.delivered.map((d: { id: string; scenarios: Array<{ title: string }> }) => [
      d.id,
      d.scenarios[0].title,
    ]),
    [
      ["REQ-002", "Proof of book a slot"],
      ["REQ-003", "Proof of cancel a slot"],
    ]
  );
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].id, "REQ-004");
  assert.equal(r.missing[0].why, "waiting");
  assert.match(r.missing[0].question, /two slots in a row/);
});

test("REQ-217 SCN-217b: the report downloads as one HTML page; writes need the token", async () => {
  const dir = halfBuilt();
  const port = 42000 + Math.floor(Math.random() * 2000);
  const child = spawn(
    process.execPath,
    [CLI, "studio", "--project-dir", dir, "--port", String(port)],
    { stdio: "ignore", detached: process.platform !== "win32" }
  );
  const http = require("node:http");
  try {
    const call = (method: string, url: string, headers = {}, body = "") =>
      new Promise<{ status: number; body: string; headers: Record<string, string> }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: "127.0.0.1",
              port,
              method,
              path: url,
              headers: { host: "localhost", ...headers },
            },
            (res: import("node:http").IncomingMessage) => {
              let data = "";
              res.on("data", (d: Buffer) => (data += d));
              res.on("end", () =>
                resolve({
                  status: res.statusCode || 0,
                  body: data,
                  headers: res.headers as Record<string, string>,
                })
              );
            }
          );
          req.on("error", reject);
          req.end(body);
        }
      );
    let page = { status: 0, body: "", headers: {} as Record<string, string> };
    for (let i = 0; i < 50 && page.status !== 200; i += 1) {
      try {
        page = await call("GET", "/");
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const report = await call("GET", "/report.html");
    assert.equal(report.status, 200);
    assert.match(report.headers["content-disposition"], /attachment/);
    assert.match(report.body, new RegExp(path.basename(dir)));
    assert.match(report.body, /Book a slot/);
    assert.doesNotMatch(report.body, /<script|<link /, "nothing else to open it");
    const refused = await call(
      "POST",
      "/api/draft",
      { "content-type": "application/json" },
      JSON.stringify({ module: "reservas" })
    );
    assert.equal(refused.status, 403);
    const routeView = JSON.parse((await call("GET", "/api/route")).body);
    assert.equal(routeView.isProject, true);
  } finally {
    const exited = new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill();
      }
    }
    await exited;
  }
});
