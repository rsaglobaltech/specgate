/**
 * REQ-187..189 — questions and answers as rows of their tables, written by
 * commands instead of by hand.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  questionTable,
  answerQuestion,
  addQuestion,
  addAssumption,
  reviewAssumptions,
  assumptionsToReview,
} from "../../src/domain/Clarification";
import { checkDraft } from "../../src/domain/DraftChecklist";

const QUESTIONS = [
  "# Questions — draft-examen",
  "",
  "| # | Question | Blocks | Options seen | Answer | Status |",
  "|---|---|---|---|---|---|",
  "| Q1 | ¿Cuántas Fahraufgaben? | REQ-042 | 8 | Ocho | answered |",
  "| Q6 | ¿Qué foto? | REQ-049, REQ-050 | Wikimedia |  | open |",
  "",
].join("\n");

const ASSUMPTIONS = [
  "# Assumptions — draft-examen",
  "",
  "| # | Assumption | Used in | Why | Status |",
  "|---|---|---|---|---|",
  "| A27 | Vídeos por enlace | REQ-051 | Q7 | decided |",
  "",
].join("\n");

test("REQ-187 SCN-187a: the question table gives each row's text, blocks and whether it is answered", () => {
  const rows = questionTable(QUESTIONS);
  assert.deepEqual(
    rows.map((q) => [q.id, q.text, q.blocks, q.answered]),
    [
      ["Q1", "¿Cuántas Fahraufgaben?", ["REQ-042"], true],
      ["Q6", "¿Qué foto?", ["REQ-049", "REQ-050"], false],
    ]
  );
});

test("REQ-188 SCN-188a: answering fills the Answer and Status cells of that row only", () => {
  const r = answerQuestion(QUESTIONS, "Q6", "Königsbrücker Straße desde la pasarela");
  assert.ok(r.ok);
  const q6 = questionTable(r.md).find((q) => q.id === "Q6");
  assert.equal(q6?.answered, true);
  assert.match(
    r.md,
    /\| Q6 \| ¿Qué foto\? \| REQ-049, REQ-050 \| Wikimedia \| Königsbrücker Straße desde la pasarela \| answered \|/
  );
  assert.match(r.md, /\| Q1 \| ¿Cuántas Fahraufgaben\? \| REQ-042 \| 8 \| Ocho \| answered \|/);
  assert.deepEqual(r.blocks, ["REQ-049", "REQ-050"]);
});

test("REQ-188 SCN-188c: an answer that decides nothing, or a question that is not there, is refused", () => {
  assert.deepEqual(answerQuestion(QUESTIONS, "Q6", "TBD"), { ok: false, code: "answer_deferred" });
  assert.deepEqual(answerQuestion(QUESTIONS, "Q9", "x"), { ok: false, code: "question_not_found" });
  const pipe = answerQuestion(QUESTIONS, "Q6", "a | b");
  assert.ok(
    pipe.ok && pipe.md.includes("a \\| b"),
    "a pipe in the answer does not break the table"
  );
});

test("REQ-188 SCN-188a: the answer becomes the next assumption, to review", () => {
  const r = addAssumption(ASSUMPTIONS, "draft-examen", {
    text: "Königsbrücker Straße desde la pasarela",
    usedIn: ["REQ-049", "REQ-050"],
    why: "Q6",
  });
  assert.equal(r.id, "A28");
  assert.match(
    r.md,
    /\| A28 \| Königsbrücker Straße desde la pasarela \| REQ-049, REQ-050 \| Q6 \| to review \|/
  );
  assert.deepEqual(
    assumptionsToReview(r.md).map((a) => a.id),
    ["A28"]
  );

  const fresh = addAssumption(undefined, "draft-examen", {
    text: "x",
    usedIn: ["REQ-001"],
    why: "Q1",
  });
  assert.equal(fresh.id, "A1");
  assert.match(fresh.md, /^# Assumptions — draft-examen/);
  assert.match(fresh.md, /\| # \| Assumption \| Used in \| Why \| Status \|/);
});

test("REQ-188 SCN-188b: reviewed marks the question's assumptions decided", () => {
  const added = addAssumption(ASSUMPTIONS, "draft-examen", {
    text: "t",
    usedIn: ["REQ-049"],
    why: "Q6",
  });
  const r = reviewAssumptions(added.md, "Q6");
  assert.deepEqual(r.ids, ["A28"]);
  assert.deepEqual(assumptionsToReview(r.md), []);
  assert.match(r.md, /\| A28 \| t \| REQ-049 \| Q6 \| decided \|/);
  assert.deepEqual(reviewAssumptions(r.md, "Q6").ids, [], "nothing left to review");
});

test("REQ-188 SCN-188b: the draft checklist fails while an assumption is to review", () => {
  const delta = [
    "# Delta — examen",
    "",
    "## ADDED Requirements",
    "",
    "### Requirement: REQ-049 — Situaciones",
    "",
    "The system SHALL show a photo.",
    "",
    "#### Scenario: SCN-137 — Abrir",
    "",
    "- GIVEN the Fahrschüler is on Examen",
    "- WHEN they open Situaciones",
    "- THEN they see the photo",
    "",
    "<!-- specgate:trace status=Draft actor=Fahrschüler kind=functional -->",
    "",
  ].join("\n");
  const toReview = addAssumption(ASSUMPTIONS, "draft-examen", {
    text: "t",
    usedIn: ["REQ-049"],
    why: "Q6",
  }).md;
  const report = checkDraft({
    deltas: [{ path: "specs/examen/spec.md", source: delta }],
    assumptions: toReview,
  });
  const d13 = report.status.filter((s) => s.code === "D13_assumption_to_review");
  assert.equal(d13.length, 1);
  assert.match(d13[0].message, /A28/);
  assert.match(String(d13[0].fix), /specgate answer Q6 --reviewed/);
  const decided = reviewAssumptions(toReview, "Q6").md;
  const after = checkDraft({
    deltas: [{ path: "specs/examen/spec.md", source: delta }],
    assumptions: decided,
  });
  assert.equal(after.status.filter((s) => s.code === "D13_assumption_to_review").length, 0);
});

test("REQ-189 SCN-189a: asking adds the next question, open, blocking the requirement", () => {
  const r = addQuestion(QUESTIONS, "draft-examen", "¿Qué foto de noche?", ["REQ-049"]);
  assert.equal(r.id, "Q7");
  const q7 = questionTable(r.md).find((q) => q.id === "Q7");
  assert.deepEqual(
    [q7?.text, q7?.blocks, q7?.answered],
    ["¿Qué foto de noche?", ["REQ-049"], false]
  );
  const fresh = addQuestion(undefined, "project", "¿Cuál?", ["REQ-017"]);
  assert.equal(fresh.id, "Q1");
  assert.match(fresh.md, /\| # \| Question \| Blocks \| Options seen \| Answer \| Status \|/);
});
