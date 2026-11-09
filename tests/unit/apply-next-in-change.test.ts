/**
 * apply-next-in-change: after `apply`, the next step stays in the change it
 * delivered for, before the project's queue (REQ-465).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import { nextAfter } from "../../scripts/cli/commands/spec/DoneCommand";
import type { QueueItem } from "../../scripts/cli/commands/spec/StatusCommand";
import type { InFlightRequirement, InFlightView } from "../../scripts/lib/in-flight";

const CHANGE = "draft-specgate-port";

function req(id: string, status: string): InFlightRequirement {
  return {
    id,
    change: CHANGE,
    capability: "specgate-port",
    deltaFile: `docs/specs/changes/${CHANGE}/specs/specgate-port/spec.md`,
    status,
    op: "added",
  } as InFlightRequirement;
}

/** specgate-studio after REQ-016: REQ-014 left in the change, REQ-000 outside it. */
function studio(rest: QueueItem) {
  const requirements = [
    req("REQ-011", "Implemented"),
    req("REQ-014", "Approved"),
    req("REQ-016", "Implemented"),
  ];
  const view = { requirements } as unknown as InFlightView;
  const items: QueueItem[] = [{ requirement: "REQ-000", category: "NEEDS_TEST" }, rest];
  return { items, owner: requirements[2], view };
}

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

test("REQ-465 SCN-465a: after apply REQ-016 the next step is the change's REQ-014, not the project's REQ-000", () => {
  const { items, owner, view } = studio({
    requirement: "REQ-014",
    category: "NEEDS_EVERYTHING",
    change: CHANGE,
  });
  const next = plain(nextAfter(items, "REQ-016", owner, view));
  assert.match(next, /specgate apply REQ-014/);
  assert.doesNotMatch(next, /REQ-000/);
});

test("REQ-465 SCN-465b: when the change's last requirement waits for Q2, the next step is the project's REQ-000", () => {
  const { items, owner, view } = studio({
    requirement: "REQ-014",
    category: "WAITING_FOR_ANSWER",
    change: CHANGE,
    question: "Q2 (docs/specs/changes/draft-specgate-port/questions.md)",
  });
  const next = plain(nextAfter(items, "REQ-016", owner, view));
  assert.match(next, /specgate apply REQ-000/);
});

test("REQ-465: once every requirement of the change is delivered, the next step is still archive", () => {
  const requirements = [req("REQ-014", "Implemented"), req("REQ-016", "Implemented")];
  const view = { requirements } as unknown as InFlightView;
  const items: QueueItem[] = [{ requirement: "REQ-000", category: "NEEDS_TEST" }];
  const next = plain(nextAfter(items, "REQ-016", requirements[1], view));
  assert.match(next, new RegExp(`specgate archive ${CHANGE}`));
});
