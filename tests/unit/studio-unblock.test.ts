/**
 * The studio unblocked (change studio-unblock): a forja project on 2026-11-08
 * could not answer a question, confirm an answer, approve a draft or choose an
 * agent from the studio. Each requirement of the change is proved here.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import { questionTable } from "../../packages/core/src/domain/Clarification";
import { openQuestions, answeredQuestions } from "../../packages/core/src/domain/DraftChecklist";
import { draftingGuide } from "../../scripts/draft/drafting-guide";

const ANSWERS = [
  "# Questions — draft-pedidos",
  "",
  "| # | Question | Blocks | Options seen | Answer | Status |",
  "|---|---|---|---|---|---|",
  "| Q1 | ¿Desde qué importe se aprueba a mano? | REQ-031 | Siempre; 500 € | Más de 500 € | answered |",
  "| Q2 | ¿Cuántos días para devolver? | REQ-032 |  |  | open |",
  "| Q3 | ¿Envío gratis? | REQ-033 |  | TBD | open |",
  "| Q4 | ¿Factura en papel? | REQ-034 |  | pendiente | open |",
  "",
  "Answer (Q2): 30 days",
  "",
].join("\n");

test("REQ-429 SCN-429a: the studio, `specgate questions` and the checklist read an answer the same way", () => {
  const studio = questionTable(ANSWERS)
    .filter((q) => q.answered)
    .map((q) => q.id);
  assert.deepEqual(studio, ["Q1", "Q2"]);
  assert.deepEqual(
    answeredQuestions(ANSWERS).map((q) => q.row),
    ["Q1", "Q2"]
  );
  assert.deepEqual(
    openQuestions(ANSWERS).map((q) => q.row),
    ["Q3", "Q4"]
  );
});

test("REQ-429: the drafting guide asks for the Answer and Status columns", () => {
  const guide = draftingGuide({
    module: "pedidos",
    changeId: "draft-pedidos",
    brief: "# Brief\n",
    reqRange: ["REQ-030", "REQ-036"],
    firstScenario: "SCN-030a",
    maxRequirements: 7,
    actors: new Map(),
  });
  assert.match(guide, /\| # \| Question \| Blocks \| Options seen \| Answer \| Status \|/);
  assert.doesNotMatch(guide, /\| # \| Question \| Blocks \| Options seen \|\n/);
});
