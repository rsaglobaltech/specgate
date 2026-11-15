/**
 * agent-ask: agentAsk, agentPlans, agentApply and agentDiscard in-process,
 * answering what the commands print, with refusals as codes and fixes
 * (REQ-527).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import { cliJson, removeProject } from "../helpers/project";
import { agentProject, read } from "../helpers/fake-agent";
import * as api from "../../scripts/api";

const REQUEST = "allow cancelling up to 24 h before shipping";

/** The keys of a document, recursively, so two answers can be compared by shape. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : [];
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, shape((v as Record<string, unknown>)[k])])
    );
  }
  return v === null ? null : typeof v;
}

test("REQ-527 SCN-527a: agentAsk, agentPlans, agentApply in-process have the commands' shapes; agentDiscard rejects plan_not_found", async () => {
  const p = agentProject("spec");
  try {
    assert.equal(api.API_VERSION, "1.0.0");
    const printed = cliJson(p.dir, "agent", "ask", REQUEST).doc;
    const asked = await api.agentAsk(p.dir, REQUEST);
    assert.deepEqual(shape(asked), shape(printed));
    assert.equal(asked.plan.files[0].path, "spec.md");

    const plans = await api.agentPlans(p.dir);
    assert.deepEqual(plans, cliJson(p.dir, "agent", "plans").doc);
    assert.equal(plans.plans.length, 2);

    const applied = await api.agentApply(p.dir, asked.plan.id as string);
    assert.deepEqual(applied.applied?.written, [{ path: "spec.md", change: "modify" }]);
    assert.match(read(p.dir, "spec.md"), /cancelled up to 24 h before shipping/);
    assert.equal(applied.applied?.then[0].command, "specgate validate");

    const discarded = await api.agentDiscard(p.dir, printed.plan.id);
    assert.equal(discarded.discarded.id, printed.plan.id);

    await assert.rejects(api.agentDiscard(p.dir, "nope"), (err: any) => {
      assert.equal(err.code, "plan_not_found");
      assert.equal(err.fix, "specgate agent plans");
      return true;
    });
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-527: agentAsk rejects agent_not_set and agent_failed with their fixes, and takes the request's options", async () => {
  const p = agentProject(null);
  try {
    await assert.rejects(api.agentAsk(p.dir, REQUEST), (err: any) => {
      assert.equal(err.code, "agent_not_set");
      assert.equal(err.fix, "specgate agents init --tool claude");
      return true;
    });
    await assert.rejects(api.agentAsk(p.dir, REQUEST, { agent: p.agent("fail") }), (err: any) => {
      assert.equal(err.code, "agent_failed");
      assert.match(err.message, /rate limited/);
      return true;
    });
    const asked = await api.agentAsk(p.dir, REQUEST, {
      agent: p.agent("spec"),
      req: ["REQ-001"],
      files: ["docs/notes.md"],
    });
    assert.ok(asked.plan.read.includes("docs/notes.md"));
    assert.match(p.prompt("spec"), /## REQ-001/);
  } finally {
    removeProject(p.dir);
  }
});
