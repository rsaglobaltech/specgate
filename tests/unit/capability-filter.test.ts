/**
 * studio-phase3-json: each requirement's capability in `status --json`, and
 * `--capability <name>` on `report` and `harness report` (REQ-500 … REQ-502).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as api from "../../scripts/api";
import { cliJson, newProject, removeProject, specRequirement, write } from "../helpers/project";
import { runCli } from "../helpers/cli";

const capabilitySpec = (cap: string, reqs: Array<[string, string]>) =>
  `# ${cap}\n\n## Requirements\n\n` +
  reqs
    .map(
      ([id, title]) =>
        `### Requirement: ${id} — ${title}\n\nThe system SHALL ${title.toLowerCase()}.\n\n` +
        `#### Scenario: SCN-${id.slice(4)}a — ${title}\n\n- GIVEN a customer\n- WHEN they act\n- THEN it happens\n\n` +
        "<!-- specgate:trace status=Approved actor=Customer kind=functional -->\n"
    )
    .join("\n");

const delta = (cap: string, id: string, title: string) =>
  `# Delta — ${cap}\n\n## ADDED Requirements\n\n### Requirement: ${id} — ${title}\n\n` +
  `The system SHALL ${title.toLowerCase()}.\n\n#### Scenario: SCN-${id.slice(4)}a — ${title}\n\n` +
  "- GIVEN a customer\n- WHEN they act\n- THEN it happens\n\n" +
  "<!-- specgate:trace actor=Customer kind=functional -->\n";

/** REQ-001 in spec.md, REQ-002 archived in `orders`, REQ-003 in an open change's `billing`. */
function shop(): string {
  const dir = newProject("sg-capability-");
  specRequirement(dir, "REQ-001", "Place an order");
  write(
    dir,
    "docs/specs/capabilities/orders/spec.md",
    capabilitySpec("Orders", [["REQ-002", "Free shipping"]])
  );
  write(
    dir,
    "docs/specs/changes/add-billing/change.yaml",
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-11-11\n"
  );
  write(
    dir,
    "docs/specs/changes/add-billing/specs/billing/spec.md",
    delta("billing", "REQ-003", "Send the invoice")
  );
  return dir;
}

test("REQ-500 SCN-500a: status names the capability of each requirement — null in spec.md, the archived spec's, the open delta's", async () => {
  const dir = shop();
  try {
    const { doc } = cliJson(dir, "status");
    const cap = (id: string) =>
      doc.requirements.find((r: { id: string }) => r.id === id)?.capability;
    assert.equal(cap("REQ-001"), null, JSON.stringify(doc.requirements));
    assert.equal(cap("REQ-002"), "orders");
    assert.equal(cap("REQ-003"), "billing");
    assert.deepEqual(await api.status(dir), doc);
  } finally {
    removeProject(dir);
  }
});

test("REQ-501 SCN-501a: report --capability orders keeps orders' requirements; a capability that does not exist is refused", async () => {
  const dir = newProject("sg-capability-");
  try {
    specRequirement(dir, "REQ-001", "Place an order");
    write(
      dir,
      "docs/specs/capabilities/orders/spec.md",
      capabilitySpec("Orders", [
        ["REQ-002", "Free shipping"],
        ["REQ-003", "Cancel an order"],
      ])
    );
    assert.equal(runCli(["matrix", "--project-dir", dir]).status, 0);

    const r = runCli([
      "report",
      "--format",
      "json",
      "--stdout",
      "--capability",
      "orders",
      "--project-dir",
      dir,
    ]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.capability, "orders");
    assert.equal(doc.total, 2);
    assert.deepEqual(doc.requirements.map((x: { requirement: string }) => x.requirement).sort(), [
      "REQ-002",
      "REQ-003",
    ]);
    assert.deepEqual(await api.report(dir, { capability: "orders" }), doc);

    const none = cliJson(dir, "report", "--format", "json", "--stdout", "--capability", "nothing");
    assert.equal(none.status, 2);
    assert.equal(none.doc.status[0].code, "capability_unknown");
    assert.match(none.doc.status[0].fix, /orders/);
    await assert.rejects(api.report(dir, { capability: "nothing" }), (e: unknown) => {
      assert.equal((e as { code?: string }).code, "capability_unknown");
      return true;
    });

    // Without the flag, the whole project, and no `capability`.
    const all = JSON.parse(
      runCli(["report", "--format", "json", "--stdout", "--project-dir", dir]).stdout
    );
    assert.equal(all.capability, undefined);
    assert.ok(all.total >= 3);
  } finally {
    removeProject(dir);
  }
});

test("REQ-502 SCN-502a: harness report --capability orders summarises only orders' requirements", () => {
  const dir = shop();
  try {
    write(
      dir,
      ".harness/runs/2026-11-11T10-00-00.json",
      JSON.stringify({
        startedAt: "2026-11-11T10:00:00.000Z",
        finishedAt: "2026-11-11T10:10:00.000Z",
        maxAttempts: 3,
        results: [
          { requirement: "REQ-002", result: "pass", attempts: 1, durationMs: 1000 },
          { requirement: "REQ-003", result: "fail", attempts: 3, durationMs: 3000 },
        ],
      })
    );
    const all = cliJson(dir, "harness", "report");
    assert.equal(all.status, 0, JSON.stringify(all.doc));
    assert.equal(all.doc.report.requirementsAttempted, 2);
    assert.equal(all.doc.report.capability, undefined);

    const orders = cliJson(dir, "harness", "report", "--capability", "orders");
    assert.equal(orders.status, 0, JSON.stringify(orders.doc));
    assert.equal(orders.doc.report.capability, "orders");
    assert.equal(orders.doc.report.requirementsAttempted, 1);
    assert.equal(orders.doc.report.passed, 1);
    assert.equal(orders.doc.report.failed, 0);

    const none = cliJson(dir, "harness", "report", "--capability", "nothing");
    assert.equal(none.status, 2);
    assert.equal(none.doc.status[0].code, "capability_unknown");
    assert.match(none.doc.status[0].fix, /billing, orders/);
  } finally {
    removeProject(dir);
  }
});
