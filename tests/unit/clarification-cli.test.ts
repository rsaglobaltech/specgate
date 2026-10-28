"use strict";

/**
 * REQ-187..189 — `questions`, `answer` and `ask` on a project.
 *
 * Taking a brief to a delivered app, every answer was typed into a table cell,
 * a question raised while implementing (which photo for REQ-049) had nowhere
 * to go but the chat, and nothing listed what was still waiting.
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

function cli(dir: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", AGENT_EVENTS_FILE: "", AGENT_EVENTS_REQ: "", ...env },
  });
}

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-clarify-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w(
    "docs/specs/changes/draft-examen/questions.md",
    [
      "# Questions — draft-examen",
      "",
      "| # | Question | Blocks | Options seen | Answer | Status |",
      "|---|---|---|---|---|---|",
      "| Q1 | ¿Cuántas? | REQ-042 | 8 | Ocho | answered |",
      "| Q2 | ¿Cuándo? | none |  |  | open |",
      "| Q6 | ¿Qué foto? | REQ-049 | Wikimedia |  | open |",
      "",
    ].join("\n")
  );
  w(
    "docs/specs/changes/draft-examen/assumptions.md",
    "# Assumptions — draft-examen\n\n| # | Assumption | Used in | Why | Status |\n|---|---|---|---|---|\n| A27 | x | REQ-051 | Q7 | decided |\n"
  );
  w(
    "docs/specs/changes/draft-examen/specs/examen/spec.md",
    [
      "# Delta — examen",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-049 — Situaciones con foto",
      "",
      "The system SHALL show a photo.",
      "",
      "#### Scenario: SCN-137 — Abrir",
      "",
      "- GIVEN the Fahrschüler is on Examen",
      "- WHEN they open Situaciones",
      "- THEN they see the photo",
      "",
      '<!-- specgate:trace status="Needs Clarification" actor=Fahrschüler kind=functional -->',
      "",
      "### Requirement: REQ-050 — Explicación",
      "",
      "The system SHALL explain.",
      "",
      "<!-- specgate:trace status=Draft actor=Fahrschüler kind=functional -->",
      "",
    ].join("\n")
  );
  w(
    "docs/specs/changes/draft-diario/questions.md",
    "# Questions — draft-diario\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q2 | ¿Cuántas clases? | REQ-030 |  |  | open |\n"
  );
  w(
    "docs/specs/capabilities/diario/spec.md",
    '# diario\n\n### Requirement: REQ-031 — Tipo de clase\n\nThe system SHALL keep the type.\n\n<!-- specgate:trace status="Needs Clarification" actor=Fahrschüler kind=functional -->\n'
  );
  return dir;
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

test("REQ-187 SCN-187a: open questions from every change, answered ones left out", () => {
  const dir = project();
  try {
    const r = cli(dir, ["questions", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    const open = doc.questions.open
      .map((q: { change: string; id: string }) => `${q.change}:${q.id}`)
      .sort();
    assert.deepEqual(open, ["draft-diario:Q2", "draft-examen:Q2", "draft-examen:Q6"]);
    const q6 = doc.questions.open.find((q: { id: string; change: string }) => q.id === "Q6");
    assert.deepEqual(q6.blocks, ["REQ-049"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-187 SCN-187b: a requirement waiting with no question is listed too", () => {
  const dir = project();
  try {
    const doc = JSON.parse(cli(dir, ["questions", "--json"]).stdout);
    assert.deepEqual(
      doc.questions.waitingWithoutQuestion.map((r: { requirement: string }) => r.requirement),
      ["REQ-031"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-187 SCN-187c: nothing open", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-clarify-"));
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "specs", "traceability.md"), "# T\n");
    const r = cli(dir, ["questions"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Nothing waits for an answer/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-188 SCN-188a: answer writes the row, an assumption to review, and the requirements to revise", () => {
  const dir = project();
  try {
    const r = cli(dir, ["answer", "Q6", "Königsbrücker Straße desde la pasarela", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.deepEqual(doc.answer, {
      question: "Q6",
      change: "draft-examen",
      assumption: "A28",
      revise: ["REQ-049"],
    });
    assert.match(
      read(dir, "docs/specs/changes/draft-examen/questions.md"),
      /\| Q6 \| ¿Qué foto\? \| REQ-049 \| Wikimedia \| Königsbrücker Straße desde la pasarela \| answered \|/
    );
    assert.match(
      read(dir, "docs/specs/changes/draft-examen/assumptions.md"),
      /\| A28 \| Königsbrücker Straße desde la pasarela \| REQ-049 \| Q6 \| to review \|/
    );
    const rev = cli(dir, ["answer", "Q6", "--reviewed"]);
    assert.equal(rev.status, 0, rev.stderr);
    assert.match(
      read(dir, "docs/specs/changes/draft-examen/assumptions.md"),
      /\| A28 \|.*\| decided \|/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-188 SCN-188c: an ambiguous question or a deferred answer is refused, and nothing is written", () => {
  const dir = project();
  try {
    const before = read(dir, "docs/specs/changes/draft-examen/questions.md");
    const amb = cli(dir, ["answer", "Q2", "yes"]);
    assert.notEqual(amb.status, 0);
    assert.match(amb.stdout + amb.stderr, /draft-diario/);
    assert.match(amb.stdout + amb.stderr, /draft-examen/);
    const tbd = cli(dir, ["answer", "Q6", "TBD"]);
    assert.notEqual(tbd.status, 0);
    assert.match(tbd.stdout + tbd.stderr, /puts the decision off/);
    assert.equal(read(dir, "docs/specs/changes/draft-examen/questions.md"), before);
    const picked = cli(dir, ["answer", "Q2", "Ninguna por ahora no", "--change", "draft-diario"]);
    assert.equal(picked.status, 0, picked.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-189 SCN-189a: asking records the question and the requirement waits", () => {
  const dir = project();
  try {
    const r = cli(dir, ["ask", "REQ-050", "¿Qué explicación?", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).ask.question, "Q7");
    assert.match(
      read(dir, "docs/specs/changes/draft-examen/questions.md"),
      /\| Q7 \| ¿Qué explicación\? \| REQ-050 \| {2}\| {2}\| open \|/
    );
    assert.match(
      read(dir, "docs/specs/changes/draft-examen/specs/examen/spec.md"),
      /### Requirement: REQ-050[\s\S]*status="Needs Clarification"/
    );
    const cap = cli(dir, ["ask", "REQ-031", "¿Qué tipos?"]);
    assert.equal(cap.status, 0, cap.stderr);
    assert.match(read(dir, "docs/specs/questions.md"), /\| Q1 \| ¿Qué tipos\? \| REQ-031 \|/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-189 SCN-189b: inside the harness, ask only records the question as an event", () => {
  const dir = project();
  try {
    const events = path.join(dir, ".harness", "events", "REQ-050.jsonl");
    const before = read(dir, "docs/specs/changes/draft-examen/questions.md");
    const r = cli(dir, ["ask", "REQ-050", "¿Qué explicación?"], {
      AGENT_EVENTS_FILE: events,
      AGENT_EVENTS_REQ: "REQ-050",
      AGENT_EVENTS_ATTEMPT: "1",
    });
    assert.equal(r.status, 0, r.stderr);
    const line = JSON.parse(fs.readFileSync(events, "utf8").trim());
    assert.deepEqual(
      [line.type, line.text, line.req, line.attempt],
      ["question", "¿Qué explicación?", "REQ-050", 1]
    );
    assert.equal(
      read(dir, "docs/specs/changes/draft-examen/questions.md"),
      before,
      "the spec is not edited"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A scaffolded project whose REQ-000 the harness can work on, committed. */
function harnessProject() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ask-"));
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  const specPath = path.join(dir, "spec.md");
  fs.writeFileSync(
    specPath,
    fs
      .readFileSync(specPath, "utf8")
      .split("\n")
      .filter((l: string) => !l.includes("REQ-001"))
      .join("\n")
  );
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  git("add", "-A");
  git("commit", "-qm", "seed");
  const agent = path.join(parent, "asking-agent.js");
  fs.writeFileSync(
    agent,
    [
      'const { spawnSync } = require("node:child_process");',
      `spawnSync(process.execPath, [${JSON.stringify(CLI)}, "ask", "REQ-000", "¿Qué hago si falta la foto?"], { stdio: "inherit" });`,
      "",
    ].join("\n")
  );
  return { parent, dir, git, agent: `"${process.execPath}" "${agent}" {prompt_file}` };
}

test("REQ-189 SCN-189b: the harness stops the requirement without spending its attempts, and records the question", () => {
  const p = harnessProject();
  try {
    const r = spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        p.dir,
        "--req",
        "REQ-000",
        "--agent",
        p.agent,
        "--max-attempts",
        "3",
        "--skip-baseline",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1", AGENT_EVENTS_FILE: "", AGENT_EVENTS_REQ: "" },
      }
    );
    const out = r.stdout + r.stderr;
    assert.match(out, /REQ-000\s+question\s+1 attempt/, out);
    assert.doesNotMatch(out, /attempt 2\/3/);
    const events = fs
      .readFileSync(path.join(p.dir, ".harness", "events", "REQ-000.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l));
    assert.ok(
      events.some(
        (e: { type: string; text?: string }) =>
          e.type === "question" && e.text === "¿Qué hago si falta la foto?"
      )
    );
    const log = p.git("log", "-1", "--format=%s").stdout.trim();
    assert.match(log, /REQ-000 needs clarification — Q1/);
    assert.equal(p.git("status", "--porcelain").stdout.trim(), "", "the question is committed");
    const all = spawnSync(process.execPath, [CLI, "questions", "--json", "--project-dir", p.dir], {
      encoding: "utf8",
    });
    const open = JSON.parse(all.stdout).questions.open;
    assert.deepEqual(
      open.map((q: { id: string; blocks: string[] }) => [q.id, q.blocks]),
      [["Q1", ["REQ-000"]]]
    );
  } finally {
    fs.rmSync(p.parent, { recursive: true, force: true });
  }
});

test("REQ-189 SCN-189c: the live view shows what the agent asked and the command that answers it", () => {
  const dir = project();
  try {
    const { readLive } = require("../../scripts/lib/live-model");
    const { livePage } = require("../../scripts/lib/live-page");
    const events = path.join(dir, ".harness", "events");
    fs.mkdirSync(events, { recursive: true });
    fs.writeFileSync(
      path.join(events, "REQ-049.jsonl"),
      [
        { t: 10, type: "attempt", state: "start" },
        { t: 20, type: "question", text: "¿Qué foto?" },
        { t: 21, type: "attempt", state: "end", result: "question", stage: "question" },
      ]
        .map((e) => JSON.stringify({ req: "REQ-049", attempt: 1, ...e }))
        .join("\n") + "\n"
    );
    const r = readLive(dir).requirements.find((x: { req: string }) => x.req === "REQ-049");
    assert.equal(r.state, "question");
    assert.deepEqual(r.question, {
      text: "¿Qué foto?",
      id: "Q6",
      change: "draft-examen",
      answer: 'specgate answer Q6 "…" --change draft-examen',
    });
    assert.deepEqual(r.steps, [], "the question is not a step");
    const html = livePage("demo");
    assert.ok(html.includes('"asks: "'), "Needs attention shows the question");
    assert.ok(html.includes('["question", "asks"]'), "the legend names it");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-188 SCN-188b: a draft waits until the answer is in its spec", () => {
  const dir = project();
  try {
    assert.equal(cli(dir, ["answer", "Q6", "Königsbrücker Straße"]).status, 0);
    const d13 = (r: { stdout: string }) =>
      JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).status.filter(
        (d: { code: string }) => d.code === "D13_assumption_to_review"
      );
    const before = cli(dir, ["draft", "--check", "draft-examen", "--json"]);
    assert.equal(d13(before).length, 1, before.stdout);
    assert.match(d13(before)[0].fix, /specgate answer Q6 --reviewed/);
    assert.equal(cli(dir, ["answer", "Q6", "--reviewed"]).status, 0);
    const after = cli(dir, ["draft", "--check", "draft-examen", "--json"]);
    assert.equal(d13(after).length, 0, after.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-189 SCN-189b: the harness prompt tells the agent to ask instead of guessing", () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, "scripts", "harness", "prompt.ts"), "utf8");
  assert.match(src, /Run `specgate ask <REQ> "<your question>"` and stop/);
});
