/**
 * `reconcile` decides what `specops sync` does to each file. Every branch is
 * a way a project's local edit can survive or be lost, so each gets a test —
 * which is the point of the decision having been lifted away from the disk.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  CONFLICT_OUTCOMES,
  MergeFn,
  OUTCOME_LABEL,
  ReconcileOutcome,
  reconcile,
} from "../../src/domain/Reconciliation";

/** A merge that must not be reached. */
const noMerge: MergeFn = () => {
  throw new Error("reconcile should not have needed a merge here");
};
const cleanMerge: MergeFn = () => ({ merged: "MERGED", conflict: false });
const conflictMerge: MergeFn = () => ({ merged: "<<<<<<< markers", conflict: true });

test("a file the project does not have is written", () => {
  assert.deepEqual(reconcile(null, null, "pack", {}, noMerge), {
    outcome: "added",
    write: "pack",
    baselineContent: "pack",
  });
});

test("a file already matching the pack is left alone", () => {
  const d = reconcile("old", "pack", "pack", {}, noMerge);
  assert.equal(d.outcome, "unchanged");
  assert.equal(d.write, null, "nothing to write");
  assert.equal(d.baselineContent, "pack", "the baseline still moves forward");
});

test("--force takes the pack's version without consulting the baseline", () => {
  const d = reconcile("base", "local edit", "pack", { force: true }, noMerge);
  assert.equal(d.outcome, "overwritten");
  assert.equal(d.write, "pack");
});

test("without a baseline the local file is never touched", () => {
  // The critical branch: guessing here is how an edit disappears silently.
  const d = reconcile(null, "local edit", "pack", {}, noMerge);
  assert.equal(d.outcome, "conflict-no-base");
  assert.equal(d.write, null);
  assert.equal(d.baselineContent, null, "the baseline must not be invented either");
});

test("an unedited local file follows the pack", () => {
  const d = reconcile("base", "base", "pack", {}, noMerge);
  assert.equal(d.outcome, "updated");
  assert.equal(d.write, "pack");
});

test("a pack that did not move leaves local edits standing", () => {
  const d = reconcile("base", "local edit", "base", {}, noMerge);
  assert.equal(d.outcome, "kept");
  assert.equal(d.write, null);
  assert.equal(d.baselineContent, "base");
});

test("both sides moved and the merge is clean: the merge is written", () => {
  const d = reconcile("base", "local edit", "pack edit", {}, cleanMerge);
  assert.equal(d.outcome, "merged");
  assert.equal(d.write, "MERGED");
  assert.equal(d.baselineContent, "pack edit");
});

test("both sides moved and the merge conflicts: markers are written", () => {
  const d = reconcile("base", "local edit", "pack edit", {}, conflictMerge);
  assert.equal(d.outcome, "conflict");
  assert.equal(d.write, "<<<<<<< markers");
  assert.equal(d.baselineContent, "base", "the baseline stays put until resolved");
});

test("--abort-on-conflict leaves the file untouched instead", () => {
  const d = reconcile("base", "local edit", "pack edit", { abortOnConflict: true }, conflictMerge);
  assert.equal(d.outcome, "conflict-skipped");
  assert.equal(d.write, null);
  assert.equal(d.baselineContent, "base");
});

test("every conflict outcome is labelled, and labelled as a conflict", () => {
  for (const outcome of CONFLICT_OUTCOMES) {
    assert.match(OUTCOME_LABEL[outcome], /CONFLICT/, `${outcome} should read as a conflict`);
  }
  for (const outcome of Object.keys(OUTCOME_LABEL) as ReconcileOutcome[]) {
    assert.ok(OUTCOME_LABEL[outcome], `${outcome} has no label`);
  }
});
