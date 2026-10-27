"use strict";

/**
 * REQ-204..210 — the visual studio: approving and noting drafts from the CLI
 * the app runs, and the app's own reads and writes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const DELTA = [
  "# Delta — garaje",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-210 — Ver el horario del coche",
  "",
  "<!-- specgate:trace actor=Fahrschüler kind=functional status=Draft -->",
  "",
  "The system SHALL show when the school's car is free this week.",
  "",
  "#### Scenario: SCN-210 — El coche libre",
  "",
  "- GIVEN the car is free on Tuesday morning",
  "- WHEN the Fahrschüler opens Garaje",
  "- THEN they see Tuesday morning as free",
  "",
].join("\n");

/** A project with an open draft, draft-garaje, and an open question on it. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-studio-app-"));
  madeDirs.push(dir);
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w(
    "docs/specs/changes/draft-garaje/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\nreq_range: [REQ-210, REQ-212]\n"
  );
  w("docs/specs/changes/draft-garaje/specs/garaje/spec.md", DELTA);
  w(
    "docs/specs/changes/draft-garaje/questions.md",
    "# Questions — draft-garaje\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q1 | ¿Se reserva desde la app? | none | Solo consultar; Reservar |  | open |\n"
  );
  return dir;
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

test("REQ-206 SCN-206b: a draft with an open question is not approved", () => {
  const dir = project();
  const before = read(dir, "docs/specs/changes/draft-garaje/change.yaml");
  const r = cli(dir, "change", "approve", "draft-garaje");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Q1 is open/);
  assert.equal(read(dir, "docs/specs/changes/draft-garaje/change.yaml"), before);
});

test("REQ-206 SCN-206a: approving a ready draft records it, and the record survives a rewrite", () => {
  const dir = project();
  assert.equal(cli(dir, "answer", "Q1", "Solo consultar", "--change", "draft-garaje").status, 0);
  assert.equal(cli(dir, "answer", "Q1", "--reviewed", "--change", "draft-garaje").status, 0);
  const r = cli(dir, "change", "approve", "draft-garaje", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const today = new Date().toISOString().slice(0, 10);
  assert.match(
    read(dir, "docs/specs/changes/draft-garaje/change.yaml"),
    new RegExp(`^approved: ${today}$`, "m")
  );
  const { renderConfig } = require("../../packages/core/src/infrastructure/ChangeWorkspace");
  assert.match(renderConfig({ created: today, approved: today }), new RegExp(`approved: ${today}`));
});

test("REQ-207 SCN-207a: a note on a requirement goes to review.md", () => {
  const dir = project();
  const r = cli(
    dir,
    "change",
    "note",
    "draft-garaje",
    "Mejor",
    "2",
    "horas",
    "antes",
    "--req",
    "REQ-212"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const today = new Date().toISOString().slice(0, 10);
  assert.match(
    read(dir, "docs/specs/changes/draft-garaje/review.md"),
    new RegExp(`\\| ${today} \\| REQ-212 \\| Mejor 2 horas antes \\|`)
  );
  const { reviewNotes } = require("../../scripts/lib/change-review");
  assert.deepEqual(reviewNotes(dir, "draft-garaje"), [
    { date: today, requirement: "REQ-212", text: "Mejor 2 horas antes" },
  ]);
});

const app = () => require("../../scripts/lib/studio-app");

test("REQ-205 SCN-205a: questions come first", () => {
  const dir = project();
  const h = app().home(dir);
  assert.deepEqual(h.next, { kind: "answer", count: 1 });
  assert.equal(h.questions, 1);
  assert.equal(h.drafts, 1);
});

test("REQ-205 SCN-205b: then review, then nothing left", () => {
  const dir = project();
  assert.equal(cli(dir, "answer", "Q1", "Solo consultar", "--change", "draft-garaje").status, 0);
  assert.equal(cli(dir, "answer", "Q1", "--reviewed", "--change", "draft-garaje").status, 0);
  assert.deepEqual(app().home(dir).next, { kind: "review", count: 1, change: "draft-garaje" });
  assert.equal(cli(dir, "change", "approve", "draft-garaje").status, 0);
  const next = app().home(dir).next.kind;
  assert.ok(next === "build" || next === "done", next);
});

test("REQ-206 SCN-206a: Review shows the draft as a person reads it, and what blocks it", () => {
  const dir = project();
  const [d] = app().drafts(dir);
  assert.equal(d.change, "draft-garaje");
  assert.equal(d.module, "garaje");
  assert.equal(d.requirements[0].title, "Ver el horario del coche");
  assert.match(d.requirements[0].statement, /show when the school's car is free/);
  assert.equal(d.requirements[0].scenarios[0].steps.length, 3);
  assert.ok(d.blockers.some((b: { message: string }) => /Q1 is open/.test(b.message)));
});

test("REQ-210 SCN-210a: open questions with their options, and answers to confirm", () => {
  const dir = project();
  const q = app().questionsView(dir);
  assert.deepEqual(
    q.open.map((x: { id: string; from: string; options: string[] }) => [x.id, x.from, x.options]),
    [["Q1", "draft", ["Solo consultar", "Reservar"]]]
  );
  assert.equal(cli(dir, "answer", "Q1", "Solo consultar", "--change", "draft-garaje").status, 0);
  const after = app().questionsView(dir);
  assert.deepEqual(after.open, []);
  assert.deepEqual(
    after.toReview.map((x: { question: string; change: string }) => [x.question, x.change]),
    [["Q1", "draft-garaje"]]
  );
});

test("REQ-210 SCN-210a: confirming an answer releases the requirement it held", () => {
  const dir = project();
  const spec = "docs/specs/changes/draft-garaje/specs/garaje/spec.md";
  fs.writeFileSync(
    path.join(dir, spec),
    read(dir, spec).replace("status=Draft", 'status="Needs Clarification"')
  );
  const q = "docs/specs/changes/draft-garaje/questions.md";
  fs.writeFileSync(path.join(dir, q), read(dir, q).replace("| none |", "| REQ-210 |"));
  assert.equal(cli(dir, "answer", "Q1", "Solo consultar", "--change", "draft-garaje").status, 0);
  assert.match(read(dir, spec), /status="Needs Clarification"/, "still waiting until confirmed");
  assert.equal(cli(dir, "answer", "Q1", "--reviewed", "--change", "draft-garaje").status, 0);
  assert.match(read(dir, spec), /status=Draft/);
});

test("REQ-208 SCN-208a: only requirements of approved drafts that wait for nothing are ready", () => {
  const dir = project();
  assert.deepEqual(app().buildView(dir).ready, [], "draft-garaje is not approved");
  fs.appendFileSync(
    path.join(dir, "docs/specs/changes/draft-garaje/change.yaml"),
    "approved: 2026-10-27\n"
  );
  assert.deepEqual(
    app()
      .buildView(dir)
      .ready.map((r: { id: string }) => r.id),
    ["REQ-210"]
  );
});

test("REQ-208 SCN-208c: no agent, no build", () => {
  const dir = project();
  fs.appendFileSync(
    path.join(dir, "docs/specs/changes/draft-garaje/change.yaml"),
    "approved: 2026-10-27\n"
  );
  const r = app().startBuild(dir, ["REQ-210"]);
  assert.equal(r.ok, false);
  assert.equal(r.code, "build_no_agent");
  assert.match(r.message, /harness\.config\.yaml/);
});

test("REQ-208 SCN-208b: starting a build answers at once and runs the harness in the background", () => {
  const dir = project();
  fs.appendFileSync(
    path.join(dir, "docs/specs/changes/draft-garaje/change.yaml"),
    "approved: 2026-10-27\n"
  );
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    'harness_version: 1\nagent: "node -e 0 {prompt_file}"\n'
  );
  const started = Date.now();
  const r = app().startBuild(dir, ["REQ-210", "REQ-999"]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.started, ["REQ-210"], "only what is ready");
  assert.ok(Date.now() - started < 5000, "it does not wait for the run");
  assert.ok(fs.existsSync(path.join(dir, r.log)), "the run writes its log");
  // The run is real: stop its whole tree before the folder is removed.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(r.pid), "/T", "/F"]);
  else {
    try {
      process.kill(-r.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 800)"]);
});

test("REQ-204 SCN-204a: the app page has its four sections, both modes and both languages", () => {
  const { studioAppPage } = require("../../scripts/lib/studio-app-page");
  const html = studioAppPage("demo", "abc123");
  assert.match(html, /<meta name="specgate-token" content="abc123"\/>/);
  for (const want of [
    'home:"Inicio"',
    'questions:"Preguntas"',
    'review:"Revisión"',
    'build:"Construir"',
    'home:"Home"',
    'id="mSimple"',
    'id="mAdv"',
    'id="lEs"',
    'id="lEn"',
  ]) {
    assert.ok(html.includes(want), want);
  }
  for (const api of [
    '"api/home"',
    '"api/questions"',
    '"api/drafts"',
    '"api/build"',
    '"api/approve"',
    '"api/note"',
    '"api/stop"',
  ]) {
    assert.ok(html.includes(api), api);
  }
  const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new Function(script));
});

test("REQ-204 SCN-204b: the app's writes need the page's token", async () => {
  const dir = project();
  const http = require("node:http");
  const port = 45000 + Math.floor(Math.random() * 2000);
  const child = require("node:child_process").spawn(
    process.execPath,
    [CLI, "studio", "--port", String(port)],
    {
      cwd: dir,
      env: { ...process.env, NO_COLOR: "1" },
      detached: process.platform !== "win32",
    }
  );
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
    const call = (method: string, url: string, headers: Record<string, string> = {}, body = "") =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
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
            res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
          }
        );
        req.on("error", reject);
        req.end(body);
      });
    const page = await call("GET", "/");
    assert.match(page.body, /Specgate Studio/);
    const token = (/name="specgate-token" content="([0-9a-f]+)"/.exec(page.body) || [])[1];
    const json = { "content-type": "application/json" };
    const refused = await call(
      "POST",
      "/api/note",
      json,
      JSON.stringify({ change: "draft-garaje", text: "x" })
    );
    assert.equal(refused.status, 403);
    const noted = await call(
      "POST",
      "/api/note",
      { ...json, "x-specgate-token": token },
      JSON.stringify({ change: "draft-garaje", req: "REQ-210", text: "Más corto" })
    );
    assert.equal(noted.status, 200, noted.body);
    const home = JSON.parse((await call("GET", "/api/home")).body);
    assert.equal(home.next.kind, "answer");
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
