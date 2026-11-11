/**
 * studio-json-gaps: a draft's review notes as JSON (REQ-484), and drafting
 * again handing the open ones to the agent, which marks addressed those it
 * changed (REQ-485).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";
import { parseReviewNotes } from "../../packages/core/src/domain/ReviewNotes";

const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");
const TODAY = new Date().toISOString().slice(0, 10);
const DELTA = "docs/specs/changes/draft-orders/specs/orders/spec.md";

/** The studio's shop with the draft `draft-orders` and its brief, in git. */
function shop(): { dir: string; stub: string; promptFile: string } {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-review-notes-"));
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
  fs.copyFileSync(path.join(FIXTURE, "brief.md"), path.join(dir, "docs", "brief.md"));
  const git = (...args: string[]) =>
    cp.spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "start");
  const stub = path.join(parent, "agent.js");
  fs.writeFileSync(stub, AGENT);
  return { dir, stub, promptFile: path.join(parent, "prompt.md") };
}

/**
 * A stand-in agent: keeps the prompt it was given, and rewrites REQ-001's
 * sentence to what NEW_TEXT says.
 */
const AGENT = `
const fs = require("fs");
const prompt = fs.readFileSync(0, "utf8");
fs.writeFileSync(process.env.PROMPT_OUT, prompt);
const file = ${JSON.stringify(DELTA)};
const text = fs.readFileSync(file, "utf8");
fs.writeFileSync(file, text.replace(/The system SHALL let a customer place an order[^\\n]*/, process.env.NEW_TEXT));
`;

function note(dir: string, text: string, req?: string) {
  const r = runCli([
    "change",
    "note",
    "draft-orders",
    text,
    ...(req ? ["--req", req] : []),
    "--project-dir",
    dir,
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
}

function redraft(s: { dir: string; stub: string; promptFile: string }, newText: string) {
  const r = runCli(
    [
      "propose",
      "--from-brief",
      "orders",
      "--agent",
      `"${process.execPath}" "${s.stub}"`,
      "--json",
      "--project-dir",
      s.dir,
    ],
    { env: { ...process.env, PROMPT_OUT: s.promptFile, NEW_TEXT: newText } }
  );
  assert.ok(r.stdout.trim().startsWith("{"), r.stdout + r.stderr);
  return {
    answer: JSON.parse(r.stdout),
    prompt: fs.existsSync(s.promptFile) ? fs.readFileSync(s.promptFile, "utf8") : "",
  };
}

const cleanup = (dir: string) => fs.rmSync(path.dirname(dir), { recursive: true, force: true });

test("REQ-484 SCN-484a: change show --json and change(dir, id) give N1 addressed with before and after, N2 open", async () => {
  const s = shop();
  try {
    note(s.dir, "Say how many items an order may hold", "REQ-001");
    redraft(s, "The system SHALL let a customer place an order of 1 to 20 items.");
    note(s.dir, "Prices in euros | everywhere");

    const r = runCli(["change", "show", "draft-orders", "--json", "--project-dir", s.dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const printed = JSON.parse(r.stdout);
    assert.deepEqual(await api.change(s.dir, "draft-orders"), printed);

    const review = printed.change.review;
    assert.equal(review.file, "docs/specs/changes/draft-orders/review.md");
    assert.equal(review.open, 1);
    const [n1, n2] = review.notes;
    assert.equal(n1.id, "N1");
    assert.equal(n1.requirement, "REQ-001");
    assert.equal(n1.text, "Say how many items an order may hold");
    assert.equal(n1.state, "addressed");
    assert.equal(n1.addressed.date, TODAY);
    assert.equal(n1.addressed.changes.length, 1);
    const ch = n1.addressed.changes[0];
    assert.equal(ch.requirement, "REQ-001");
    assert.equal(ch.file, DELTA);
    assert.equal(ch.line, 5);
    assert.match(ch.before, /^### Requirement: REQ-001 — Place an order\n/);
    assert.match(ch.before, /The system SHALL let a customer place an order\.\n/);
    assert.match(ch.after, /The system SHALL let a customer place an order of 1 to 20 items\./);
    assert.doesNotMatch(ch.after, /REQ-002/, "only REQ-001's own text");
    assert.deepEqual(n2, {
      id: "N2",
      date: TODAY,
      requirement: null,
      text: "Prices in euros | everywhere",
      state: "open",
      addressed: null,
      line: n2.line,
    });
    const md = fs.readFileSync(path.join(s.dir, review.file), "utf8");
    assert.equal(
      md.split("\n")[n2.line - 1],
      `| ${TODAY} | — | Prices in euros \\| everywhere | open |`
    );
  } finally {
    cleanup(s.dir);
  }
});

test("REQ-484: a change with no review.md gives an empty review; an unknown change rejects", async () => {
  const s = shop();
  try {
    const answer = await api.change(s.dir, "draft-orders");
    assert.deepEqual(answer.change.review, { file: null, open: 0, notes: [] });
    await assert.rejects(api.change(s.dir, "no-such-change"), { code: "change_not_found" });
  } finally {
    cleanup(s.dir);
  }
});

test("REQ-485 SCN-485a: the open notes, and only they, go to the agent; the one it changed is addressed", () => {
  const s = shop();
  try {
    note(s.dir, "Say how many items an order may hold", "REQ-001");
    redraft(s, "The system SHALL let a customer place an order of 1 to 20 items.");
    note(s.dir, "An order needs a delivery address", "REQ-001");
    note(s.dir, "Say the free-shipping amount: 50 EUR", "REQ-002");

    const { answer, prompt } = redraft(
      s,
      "The system SHALL let a customer place an order of 1 to 20 items, with a delivery address."
    );
    assert.match(prompt, /N2, on REQ-001: An order needs a delivery address/);
    assert.match(prompt, /N3, on REQ-002: Say the free-shipping amount: 50 EUR/);
    assert.doesNotMatch(prompt, /Say how many items an order may hold/, "N1 is addressed");
    assert.match(prompt, /do not start it over/);
    assert.deepEqual(answer.draft.notes, { given: ["N2", "N3"], addressed: ["N2"], open: ["N3"] });

    const md = fs.readFileSync(
      path.join(s.dir, "docs", "specs", "changes", "draft-orders", "review.md"),
      "utf8"
    );
    const notes = parseReviewNotes(md);
    assert.deepEqual(
      notes.map((n) => [n.id, n.state]),
      [
        ["N1", "addressed"],
        ["N2", "addressed"],
        ["N3", "open"],
      ]
    );
    const n2 = notes[1].addressed!.changes[0];
    assert.match(n2.before, /place an order of 1 to 20 items\./);
    assert.match(n2.after, /place an order of 1 to 20 items, with a delivery address\./);
    // The quoted texts are not read as requirements of the change.
    const validate = runCli([
      "change",
      "validate",
      "draft-orders",
      "--json",
      "--project-dir",
      s.dir,
    ]);
    assert.doesNotMatch(validate.stdout, /review\.md/);
  } finally {
    cleanup(s.dir);
  }
});

test("REQ-485: a review.md written before the Status column reads as open notes, and gains it on the next note", () => {
  const md =
    "# Review — draft-orders\n\nWhat the person reviewing this draft asked to change.\n\n" +
    "| Date | Requirement | Request |\n|---|---|---|\n| 2026-11-09 | REQ-001 | Mejor 2 horas antes |\n";
  const notes = parseReviewNotes(md);
  assert.deepEqual(notes, [
    {
      id: "N1",
      date: "2026-11-09",
      requirement: "REQ-001",
      text: "Mejor 2 horas antes",
      state: "open",
      addressed: null,
      line: 7,
    },
  ]);
  const { withNoteAdded } = require("../../packages/core/src/domain/ReviewNotes");
  const next: string = withNoteAdded(md, "draft-orders", {
    date: "2026-11-10",
    requirement: "",
    text: "Precios en euros",
  });
  assert.match(next, /^\| Date \| Requirement \| Request \| Status \|$/m);
  assert.match(next, /^\| 2026-11-09 \| REQ-001 \| Mejor 2 horas antes \| open \|$/m);
  assert.match(next, /^\| 2026-11-10 \| — \| Precios en euros \| open \|$/m);
});
