/**
 * questions-asked: every question says where it was asked — the brief, a draft
 * or the agent while it builds (REQ-481); an answered question stays in sight
 * until `answer --reviewed` confirms it (REQ-482).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";

const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");

/** The shop with `draft-orders` opened from a brief whose orders module asks Q1's question. */
function shop(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-qask-"));
  const init = runCli([
    "init",
    "--config",
    path.join(FIXTURE, "project.yaml"),
    "--out",
    parent,
    "--no-git",
    "--no-agents",
    "--no-ci",
  ]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, "my-spec-driven-app");
  fs.cpSync(
    path.join(FIXTURE, "draft-orders"),
    path.join(dir, "docs", "specs", "changes", "draft-orders"),
    { recursive: true }
  );
  fs.writeFileSync(
    path.join(dir, "docs", "brief.md"),
    "---\nproduct: Tienda\nsurfaces: [api]\nmodules: [orders]\n---\n\n# Brief\n\n" +
      "## Module: orders\n\nRules\n\n- Customers place orders.\n\nQuestions\n\n" +
      "- From what amount is shipping free?\n"
  );
  return dir;
}

type Doc = {
  questions: {
    open: Array<{ id: string; asked: string; blocks: string[] }>;
    answered: Array<{ id: string; change: string; answer: string; blocks: string[]; line: number }>;
  };
};
const questions = (dir: string): Doc => {
  const r = runCli(["questions", "--json", "--project-dir", dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout) as Doc;
};

test("REQ-481 SCN-481a: the brief's Q1, the draft's Q2 and the agent's Q3 each say where they were asked — the command and the API alike", async () => {
  const dir = shop();
  try {
    const ask = runCli(["ask", "REQ-001", "Is the invoice sent by email?", "--project-dir", dir]);
    assert.equal(ask.status, 0, ask.stdout + ask.stderr);
    const doc = questions(dir);
    const asked = Object.fromEntries(doc.questions.open.map((q) => [q.id, q.asked]));
    assert.deepEqual(asked, { Q1: "brief", Q2: "draft", Q3: "build" });
    // Read back from the row, not remembered: the table says it.
    assert.match(
      fs.readFileSync(path.join(dir, "docs/specs/changes/draft-orders/questions.md"), "utf8"),
      /\| Q3 \|.*\| build \|/
    );
    assert.deepEqual(await api.questions(dir), doc, "the API answers what the command prints");
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});

test("REQ-481: without a brief, a change's questions are the draft's", () => {
  const dir = shop();
  try {
    fs.rmSync(path.join(dir, "docs", "brief.md"));
    const asked = questions(dir).questions.open.map((q) => q.asked);
    assert.deepEqual(asked, ["draft", "draft"]);
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});

test('REQ-482 SCN-482a: Q1 answered "50 €" waits in `answered` until --reviewed confirms it', async () => {
  const dir = shop();
  try {
    const a = runCli(["answer", "Q1", "50 €", "--change", "draft-orders", "--project-dir", dir]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    const first = questions(dir);
    assert.deepEqual(
      first.questions.open.map((q) => q.id),
      ["Q2"]
    );
    assert.deepEqual(first.questions.answered, [
      {
        id: "Q1",
        change: "draft-orders",
        text: "From what amount is shipping free?",
        blocks: ["REQ-002"],
        answer: "50 €",
        asked: "brief",
        file: "docs/specs/changes/draft-orders/questions.md",
        line: first.questions.answered[0]!.line,
      },
    ]);
    assert.deepEqual(await api.questions(dir), first, "the API answers what the command prints");

    const r = runCli([
      "answer",
      "Q1",
      "--reviewed",
      "--change",
      "draft-orders",
      "--project-dir",
      dir,
    ]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const second = questions(dir);
    assert.deepEqual(second.questions.answered, []);
    assert.deepEqual(
      second.questions.open.map((q) => q.id),
      ["Q2"]
    );
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});
