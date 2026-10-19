/**
 * Picking a run back up where it stopped (C3).
 *
 * The design was measured, not assumed: a run was killed with `kill -9` and the
 * remains inspected. The run ledger was empty — it is written when a run
 * finishes, and `--resume` exists for the runs that do not. What survived was
 * the branch, the worktree with uncommitted partial work, and the prompt
 * archive, whose filenames carry the attempt number.
 *
 * That makes the archive filename format load-bearing for resume, which is why
 * it is pinned here rather than left as an implementation detail somebody
 * tidies later.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  parseArchivedPromptName,
  previousFailureFromPrompt,
  resumePoint,
} from "../../src/domain/ResumeState";

const NAME = "REQ-000-2026-08-22T12-11-14-133Z-attempt-1-agent.md";

test("an archived prompt filename is taken apart, attempt and all", () => {
  const parsed = parseArchivedPromptName(NAME);
  assert.ok(parsed);
  assert.equal(parsed.requirement, "REQ-000");
  assert.equal(parsed.attempt, 1);
  assert.equal(parsed.role, "agent");
  assert.equal(parsed.stamp, "2026-08-22T12-11-14-133Z");
});

test("anything that is not one of ours is ignored, not guessed at", () => {
  // A person may well leave a note in that directory.
  for (const other of ["notes.md", "README.md", "REQ-000-attempt.md", "REQ-000-x-attempt-0-a.md"]) {
    assert.equal(parseArchivedPromptName(other), null, other);
  }
});

test("no archive means there is nothing to resume — start at attempt 1", () => {
  assert.deepEqual(resumePoint([], "REQ-000"), { attempt: 1, latest: null });
  assert.equal(resumePoint(["notes.md"], "REQ-000").attempt, 1);
});

test("an interrupted attempt is re-run, not skipped", () => {
  // It never reached a verdict: the gate never ran, so nothing was learned.
  // Charging it against max_attempts would spend budget for no information.
  const files = [
    "REQ-000-2026-08-22T10-00-00-000Z-attempt-1-agent.md",
    "REQ-000-2026-08-22T11-00-00-000Z-attempt-2-agent.md",
  ];
  assert.equal(resumePoint(files, "REQ-000", false).attempt, 2);
});

test("a completed attempt hands over to its successor", () => {
  const files = ["REQ-000-2026-08-22T10-00-00-000Z-attempt-2-agent.md"];
  assert.equal(resumePoint(files, "REQ-000", true).attempt, 3);
});

test("only this requirement's archive counts", () => {
  const files = [
    "REQ-000-2026-08-22T10-00-00-000Z-attempt-1-agent.md",
    "REQ-007-2026-08-22T11-00-00-000Z-attempt-5-agent.md",
  ];
  assert.equal(resumePoint(files, "REQ-000").attempt, 1);
  assert.equal(resumePoint(files, "REQ-007").attempt, 5);
});

test("within one attempt the newest file wins, so the reviewer does not shadow the agent", () => {
  const files = [
    "REQ-000-2026-08-22T10-00-00-000Z-attempt-2-reviewer.md",
    "REQ-000-2026-08-22T10-30-00-000Z-attempt-2-agent.md",
  ];
  const { latest } = resumePoint(files, "REQ-000");
  assert.ok(latest);
  assert.equal(latest.role, "agent");
});

test("the last gate failure is recovered from the prompt that carried it", () => {
  // A resumed run has no record of its own; the prompt it already wrote does.
  const prompt = [
    "# Implement REQ-000",
    "",
    "## Previous attempt failed (attempt 1 of 3)",
    "",
    "The gate rejected the last attempt. Fix the specific failure below.",
    "",
    "```",
    "Gate failed at: validate --strict-tdd",
    "  [TDD-1] REQ-000 has no test artifact",
    "```",
    "",
    "## Definition of done",
    "",
  ].join("\n");

  const failure = previousFailureFromPrompt(prompt);
  assert.match(failure, /Gate failed at: validate --strict-tdd/);
  assert.match(failure, /TDD-1/);
  assert.doesNotMatch(failure, /Definition of done/, "it must stop at the fence");
});

test("a first-attempt prompt carries no failure, and that is not an error", () => {
  assert.equal(previousFailureFromPrompt("# Implement REQ-000\n\n## Requirement facts\n"), "");
  assert.equal(previousFailureFromPrompt(""), "");
});
