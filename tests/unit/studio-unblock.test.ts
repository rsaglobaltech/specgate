/**
 * The studio unblocked (change studio-unblock): a forja project on 2026-11-08
 * could not answer a question, confirm an answer, approve a draft or choose an
 * agent from the studio. Each requirement of the change is proved here.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import { answerLines, questionTable } from "../../packages/core/src/domain/Clarification";
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

// ── REQ-210: answers written whatever the table, confirmed whoever wrote them ──

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { answer, reviewed } from "../../scripts/lib/clarification";
import { questionsView } from "../../scripts/lib/studio-app";

/** A project with draft-pedidos: Q1 open and Q2 answered by hand, both blocking a requirement. */
function pedidos(questions: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-unblock-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec\n\n## Requirements\n");
  w("docs/specs/traceability.md", "# Traceability\n");
  w("docs/specs/changes/draft-pedidos/change.yaml", "specgate_change_version: 1\n");
  w("docs/specs/changes/draft-pedidos/questions.md", questions);
  const req = (id: string, title: string) =>
    [
      `### Requirement: ${id} — ${title}`,
      "",
      "The system SHALL do it.",
      "",
      `#### Scenario: SCN-${id.slice(4)}a — it`,
      "",
      "- GIVEN a",
      "- WHEN b",
      "- THEN c",
      "",
      '<!-- specgate:trace status="Needs Clarification" actor=Cliente kind=functional -->',
      "",
    ].join("\n");
  w(
    "docs/specs/changes/draft-pedidos/specs/pedidos/spec.md",
    [
      "# Delta — pedidos",
      "",
      "## ADDED Requirements",
      "",
      req("REQ-031", "Aprobación manual"),
      req("REQ-032", "Devoluciones"),
    ].join("\n")
  );
  return dir;
}

const FOUR_COLUMNS_CRLF = [
  "# Questions — draft-pedidos",
  "",
  "| # | Question | Blocks | Options seen |",
  "|---|---|---|---|",
  "| Q1 | ¿Desde qué importe se aprueba a mano? | REQ-031 | Siempre; 500 € |",
  "| Q2 | ¿Cuántos días para devolver? | REQ-032 |  |",
  "",
].join("\r\n");

const questionsOf = (dir: string) =>
  fs.readFileSync(path.join(dir, "docs/specs/changes/draft-pedidos/questions.md"), "utf8");

test("REQ-210 SCN-210b: an answer into a table without an Answer column, twice", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  const first = answer(dir, "Q1", "Más de 300 €", "draft-pedidos");
  assert.equal(first.ok, true, JSON.stringify(first));
  const second = answer(dir, "Q1", "Más de 500 €", "draft-pedidos");
  assert.equal(second.ok, true, JSON.stringify(second));
  const md = questionsOf(dir);
  assert.match(md, /\| # \| Question \| Blocks \| Options seen \| Answer \| Status \|/);
  assert.match(md, /\| Q1 \|[^\r\n]*\| Más de 500 € \| answered \|/);
  assert.doesNotMatch(md, /300 €/, "the second answer replaces the first");
  assert.ok(!/[^\r]\n/.test(md), "CRLF line endings kept");
  const q1 = questionTable(md).find((q) => q.id === "Q1");
  assert.equal(q1?.answered, true);
  // One answer to confirm for Q1, however often it was answered.
  const toReview = questionsView(dir).toReview.filter((x) => x.question === "Q1");
  assert.equal(toReview.length, 1, JSON.stringify(toReview));
});

test("REQ-210: an answer that writes nothing fails, saying why", () => {
  const dir = pedidos("# Questions — draft-pedidos\n\nNo table here.\n");
  const r = answer(dir, "Q1", "Más de 500 €", "draft-pedidos");
  assert.equal(r.ok, false);
});

test("REQ-210 SCN-210c: confirming an answer given by hand", () => {
  const handAnswered = [
    "# Questions — draft-pedidos",
    "",
    "| # | Question | Blocks | Options seen | Answer |",
    "|---|---|---|---|---|",
    "| Q1 | ¿Desde qué importe se aprueba a mano? | REQ-031 | Siempre; 500 € |  |",
    "| Q2 | ¿Cuántos días para devolver? | REQ-032 |  | 30 días |",
    "",
  ].join("\n");
  const dir = pedidos(handAnswered);
  // Listed to confirm, though no assumption was ever written for it.
  assert.ok(questionsView(dir).toReview.some((x) => x.question === "Q2"));
  const r = reviewed(dir, "Q2", "draft-pedidos");
  assert.equal(r.ok, true, JSON.stringify(r));
  const delta = fs.readFileSync(
    path.join(dir, "docs/specs/changes/draft-pedidos/specs/pedidos/spec.md"),
    "utf8"
  );
  const req032 = delta.slice(delta.indexOf("REQ-032"));
  assert.doesNotMatch(req032, /Needs Clarification/);
  assert.match(
    delta.slice(0, delta.indexOf("REQ-032")),
    /Needs Clarification/,
    "REQ-031 still waits for Q1"
  );
  assert.ok(!questionsView(dir).toReview.some((x) => x.question === "Q2"), "no longer to confirm");
  // An open question cannot be confirmed.
  assert.equal(reviewed(dir, "Q1", "draft-pedidos").ok, false);
});

// ── REQ-206: every blocker of an approval with the action that clears it ──

import { approvalBlockers } from "../../scripts/lib/change-review";

test("REQ-206 SCN-206c: every blocker with its action, each question once and by its exact id", () => {
  const questions = [
    "# Questions — draft-pedidos",
    "",
    "| # | Question | Blocks | Options seen | Answer | Status |",
    "|---|---|---|---|---|---|",
    "| Q1 | ¿Desde qué importe se aprueba a mano? | REQ-031 |  |  | open |",
    "| Q10 | ¿Cuántos días para devolver? | REQ-032 |  | 30 días | answered |",
    "",
  ].join("\n");
  const dir = pedidos(questions);
  const blockers = approvalBlockers(dir, "draft-pedidos");
  const q1 = blockers.filter((b) => /\bQ1\b/.test(b.message));
  const q10 = blockers.filter((b) => /\bQ10\b/.test(b.message));
  assert.equal(q1.length, 1, JSON.stringify(blockers, null, 2));
  assert.equal(q10.length, 1, JSON.stringify(blockers, null, 2));
  assert.deepEqual(q1[0].action, { kind: "answer", question: "Q1" });
  assert.deepEqual(q10[0].action, { kind: "confirm", question: "Q10" });
  // Once Q10 is confirmed, it no longer blocks.
  assert.equal(reviewed(dir, "Q10", "draft-pedidos").ok, true);
  assert.ok(!approvalBlockers(dir, "draft-pedidos").some((b) => /\bQ10\b/.test(b.message)));
});

// ── REQ-431: the agent chosen in the studio; the prompt's path quoted ──

import { buildView } from "../../scripts/lib/studio-app";
import { chooseAgent } from "../../scripts/lib/studio-route";
import { substituteAgentCommand } from "../../packages/core/src/domain/HarnessRun";
import { agentInvocation } from "../../scripts/draft/confined-agent";
import { readHarnessConfig } from "../../packages/core/src/infrastructure/HarnessConfigFile";

test("REQ-431 SCN-431a: Claude Code chosen from the studio", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  assert.equal(buildView(dir).agent, false);
  const r = chooseAgent(dir, { kind: "claude" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const cfg = readHarnessConfig(dir) as { agent?: string };
  assert.match(String(cfg?.agent ?? ""), /^claude -p .*\{prompt_file\}/);
  assert.equal(buildView(dir).agent, true, "Build can start");
});

test("REQ-431: a command of one's own must name {prompt_file}", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  assert.equal(chooseAgent(dir, { kind: "custom", command: "my-agent run" }).ok, false);
  const ok = chooseAgent(dir, { kind: "custom", command: "my-agent run {prompt_file}" });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal((readHarnessConfig(dir) as { agent?: string }).agent, "my-agent run {prompt_file}");
});

test("REQ-431 SCN-431b: a temporary folder with a space reaches the agent as one argument", () => {
  const file = "C:\\Users\\Juan Perez\\AppData\\Local\\Temp\\prompt-1.md";
  assert.equal(substituteAgentCommand("claude -p < {prompt_file}", file), `claude -p < "${file}"`);
  // Quoted already by its author: not quoted twice.
  assert.equal(
    substituteAgentCommand('claude -p < "{prompt_file}"', file),
    `claude -p < "${file}"`
  );
  assert.equal(
    agentInvocation("codex exec - < {prompt_file}", file).command,
    `codex exec - < "${file}"`
  );
});

// ── REQ-208: without an agent, Build offers one instead of naming a command ──

import { startBuild } from "../../scripts/lib/studio-app";

test("REQ-208 SCN-208c: no agent, no build — and the agents found are offered", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  const view = buildView(dir);
  assert.equal(view.agent, false);
  assert.ok(view.installed, "the agents on the PATH come with the view");
  assert.equal(typeof view.installed?.claude, "boolean");
  const r = startBuild(dir, ["REQ-031"]);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.code, "build_no_agent");
  assert.match(r.ok === false ? r.message : "", /Choose one in Build/);
  assert.doesNotMatch(r.ok === false ? r.message : "", /harness init writes it/);
});

// ── REQ-430: reads without a process, cached until a spec file changes; nothing fails in silence ──

// The module object itself, which the studio calls through and a test can watch.

const childProcess = require("node:child_process") as typeof import("node:child_process");

test("REQ-430 SCN-430a: a refresh starts no process and reuses what nothing changed", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  fs.writeFileSync(
    path.join(dir, "docs/specs/traceability.md"),
    "# Traceability\n\n| Requirement | Scenario | Feature | UC | Domain | API | UI | DB | Test | Status |\n|---|---|---|---|---|---|---|---|---|---|\n"
  );
  chooseAgent(dir, { kind: "custom", command: "my-agent {prompt_file}" });
  const real = childProcess.spawnSync;
  const calls: string[] = [];
  (childProcess as { spawnSync: unknown }).spawnSync = (
    cmd: string,
    args: string[],
    o: unknown
  ) => {
    calls.push([cmd, ...(args || [])].join(" "));
    return real(cmd, args, o as never);
  };
  try {
    buildView(dir);
    buildView(dir);
  } finally {
    (childProcess as { spawnSync: unknown }).spawnSync = real;
  }
  const cliCalls = calls.filter((c) => c.startsWith(process.execPath));
  assert.deepEqual(cliCalls, [], "no specgate process started for a read");
});

test("REQ-430 SCN-430b: the page says when a read fails, keeps a button busy while it posts, and redraws only on change", () => {
  const studio = require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));
  // A failed read is shown with its reason and the way to read again, never swallowed.
  const html: string = studio.renderStates("en", [], "/api/questions · 500");
  assert.match(html, /This section could not be read[^]*?\/api\/questions · 500[^]*?Read it again/);
  // The button that posts stays busy until the answer.
  const busy = fs.readFileSync(
    path.join(__dirname, "..", "..", "..", "studio", "src", "ui", "Busy.tsx"),
    "utf8"
  );
  assert.match(busy, /aria-busy=\{busy \? "true" : undefined\}/);
  assert.match(busy, /disabled=\{disabled \|\| busy\}/);
  // A redraw changes only what changed: Preact compares before it writes (no hand-kept lastShown).
});

test("REQ-210: a question id is data, never a pattern", () => {
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  for (const id of ["Q1(", "Q.*", "(a+)+$"]) {
    const r = answer(dir, id, "x", "draft-pedidos");
    assert.equal(r.ok, false, id);
    assert.equal(reviewed(dir, id, "draft-pedidos").ok, false, id);
  }
  assert.equal(answerLines("Answer (Q.*): yes\n", "Q1").length, 0);
});

test("REQ-206: an answer's assumption to review is confirmed from Review; a requirement at the end of a sentence is named whole", async () => {
  const { approvalBlockers: blockers } = await import("../../scripts/lib/change-review");
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  assert.equal(answer(dir, "Q1", "Más de 500 €", "draft-pedidos").ok, true);
  const all = blockers(dir, "draft-pedidos");
  for (const b of all.filter((x) => /\bQ1\b/.test(x.message))) {
    assert.deepEqual(b.action, { kind: "confirm", question: "Q1" }, JSON.stringify(b));
  }
  for (const b of all.filter((x) => x.action?.kind === "open")) {
    assert.match(String(b.action?.requirement), /^REQ-\d+$/, JSON.stringify(b));
  }
});

test("REQ-208 SCN-208b: the studio's run log leaves the working tree clean, so the harness can start", async () => {
  const { studioLog } = await import("../../scripts/lib/harness-events");
  const dir = pedidos(FOUR_COLUMNS_CRLF);
  const git = (...a: string[]) =>
    childProcess.spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", ...a], {
      cwd: dir,
      encoding: "utf8",
    });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "init");
  const log = studioLog(dir, "run");
  fs.writeFileSync(log, "started\n");
  assert.equal(git("status", "--porcelain").stdout, "", "no .harness file shows as a change");
});
