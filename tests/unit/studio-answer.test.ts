"use strict";

/**
 * REQ-201 — answering a question from the live view.
 *
 * The live view showed the agent's question and the command that answers it;
 * the person then had to leave the page for a terminal. Studio now takes the
 * answer itself, through its one write, guarded by a token only its own page
 * carries.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");
const { writeAllowed } = require("../../scripts/cli/commands/spec/StudioCommand");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

test("REQ-201 SCN-201a: a write needs this studio's token, JSON, and a loopback origin", () => {
  const ok = { token: "t0k3n", contentType: "application/json", origin: "http://localhost:4173" };
  assert.equal(writeAllowed("t0k3n", ok), true);
  assert.equal(
    writeAllowed("t0k3n", { ...ok, origin: undefined }),
    true,
    "no Origin: not a browser"
  );
  assert.equal(writeAllowed("t0k3n", { ...ok, token: "other" }), false);
  assert.equal(writeAllowed("t0k3n", { ...ok, token: undefined }), false);
  assert.equal(writeAllowed("t0k3n", { ...ok, contentType: "text/plain" }), false, "a form post");
  assert.equal(writeAllowed("t0k3n", { ...ok, origin: "https://evil.example" }), false);
  assert.equal(writeAllowed("", ok), false, "no token, no write");
});

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-studio-answer-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w(
    "docs/specs/changes/draft-examen/questions.md",
    "# Questions — draft-examen\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q6 | ¿Qué foto? | REQ-049 |  |  | open |\n"
  );
  return dir;
}

function request(
  port: number,
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body = ""
) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method, path: url, headers: { host: "localhost", ...headers } },
      (res: import("node:http").IncomingMessage) => {
        let data = "";
        res.on("data", (d: Buffer) => (data += d));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

test("REQ-201 SCN-201b: the live page answers a question and marks it reviewed; other writes are refused", async () => {
  const dir = project();
  const port = 43000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
    detached: process.platform !== "win32",
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
    const page = await request(port, "GET", "/live");
    const token = (/name="specgate-token" content="([0-9a-f]+)"/.exec(page.body) || [])[1];
    assert.ok(token, "the page carries the token");

    const json = { "content-type": "application/json" };
    const refused = await request(
      port,
      "POST",
      "/live/answer",
      json,
      JSON.stringify({ question: "Q6", answer: "x" })
    );
    assert.equal(refused.status, 403);

    const answered = await request(
      port,
      "POST",
      "/live/answer",
      { ...json, "x-specgate-token": token, origin: `http://localhost:${port}` },
      JSON.stringify({ question: "Q6", answer: "La de la pasarela" })
    );
    assert.equal(answered.status, 200, answered.body);
    assert.equal(JSON.parse(answered.body).assumption, "A1");
    const q = fs.readFileSync(
      path.join(dir, "docs/specs/changes/draft-examen/questions.md"),
      "utf8"
    );
    assert.match(q, /\| Q6 \| ¿Qué foto\? \| REQ-049 \| {2}\| La de la pasarela \| answered \|/);

    const reviewed = await request(
      port,
      "POST",
      "/live/answer",
      { ...json, "x-specgate-token": token },
      JSON.stringify({ question: "Q6", reviewed: true })
    );
    assert.equal(reviewed.status, 200, reviewed.body);
    assert.match(
      fs.readFileSync(path.join(dir, "docs/specs/changes/draft-examen/assumptions.md"), "utf8"),
      /\| A1 \| La de la pasarela \| REQ-049 \| Q6 \| decided \|/
    );

    const put = await request(port, "PUT", "/live.json");
    assert.equal(put.status, 405);
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
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("REQ-201 SCN-201c: Needs attention offers the answer form for the agent's question", () => {
  const { livePage } = require("../../scripts/lib/live-page");
  const html = livePage("demo", "abc");
  assert.ok(html.includes("function answerForm(q)"));
  assert.ok(html.includes('fetch("live/answer"'));
  assert.ok(html.includes('"x-specgate-token"'));
  assert.ok(html.includes("Mark reviewed"));
  assert.ok(!livePage("demo", '"><script>').includes('"><script>'), "the token is only hex");
});

test("REQ-203 SCN-203a: the live model carries every open question, and the page answers each", () => {
  const dir = project();
  try {
    fs.mkdirSync(path.join(dir, "docs/specs/capabilities/diario"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs/specs/capabilities/diario/spec.md"),
      '# diario\n\n### Requirement: REQ-031 — Tipo\n\nThe system SHALL keep it.\n\n<!-- specgate:trace status="Needs Clarification" kind=functional -->\n'
    );
    const { readLive } = require("../../scripts/lib/live-model");
    const q = readLive(dir).questions;
    assert.deepEqual(q.open, [
      { id: "Q6", change: "draft-examen", text: "¿Qué foto?", blocks: ["REQ-049"] },
    ]);
    assert.deepEqual(
      q.waitingWithoutQuestion.map((r: { requirement: string }) => r.requirement),
      ["REQ-031"]
    );
    const { livePage } = require("../../scripts/lib/live-page");
    const html = livePage("demo", "abc");
    assert.ok(html.includes('block("Open questions"'));
    assert.ok(html.includes("oq.forEach(function(q){"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
