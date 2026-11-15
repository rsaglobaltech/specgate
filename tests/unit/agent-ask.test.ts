/**
 * agent-ask: `specgate agent ask` proposes a plan in a scratch copy and writes
 * nothing (REQ-520), with the mentions as context (REQ-521), kept in the git
 * folder until applied or discarded (REQ-522), in spec mode (REQ-523), and
 * answers no agent, a failing agent and an empty plan (REQ-526).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { cliJson, git, removeProject } from "../helpers/project";
import { agentProject, read } from "../helpers/fake-agent";

const REQUEST = "allow cancelling up to 24 h before shipping";

test("REQ-520 SCN-520a: an agent proposes a line in spec.md — the plan, its diff, then, usage; spec.md unchanged", () => {
  const p = agentProject("spec");
  try {
    const before = read(p.dir, "spec.md");
    const { status, doc } = cliJson(p.dir, "agent", "ask", REQUEST, "--plan");
    assert.equal(status, 0, JSON.stringify(doc));
    const plan = doc.plan;
    assert.match(plan.id, /^\d{8}-\d{6}-[0-9a-f]{4}$/);
    assert.equal(plan.request, REQUEST);
    assert.equal(plan.files.length, 1);
    const [file] = plan.files;
    assert.equal(file.path, "spec.md");
    assert.equal(file.change, "modify");
    assert.equal(file.why, "States the cancellation window.");
    assert.match(file.diff, /^\+- Orders can be cancelled up to 24 h before shipping\.$/m);
    assert.match(file.diff, /^--- a\/spec\.md$/m);
    assert.deepEqual(plan.then, ["specgate validate"]);
    assert.deepEqual(plan.usage, { input: 1200, output: 340, cost: 0.0123 });
    assert.ok(plan.read.includes("spec.md"));
    assert.equal(read(p.dir, "spec.md"), before, "the working tree is unchanged");
    assert.equal(git(p.dir, "status", "--porcelain").stdout, "", "nothing new in the working tree");
    assert.match(p.prompt("spec"), new RegExp(REQUEST));
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-520: the prompt goes as {prompt_file} when the command names it", () => {
  const p = agentProject(null);
  try {
    const script = path.join(p.agentDir, "agent.js").split(path.sep).join("/");
    const { status, doc } = cliJson(
      p.dir,
      "agent",
      "ask",
      REQUEST,
      "--agent",
      `node "${script}" spec < {prompt_file}`
    );
    assert.equal(status, 0, JSON.stringify(doc));
    assert.equal(doc.plan.files[0].path, "spec.md");
    assert.match(p.prompt("spec"), new RegExp(REQUEST));
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-521 SCN-521a: @REQ-001 and @docs/notes.md become context; @REQ-999 is unresolved", () => {
  const p = agentProject("spec");
  try {
    const { status, doc } = cliJson(
      p.dir,
      "agent",
      "ask",
      "cancel up to 24 h before shipping @REQ-001 @docs/notes.md @REQ-999"
    );
    assert.equal(status, 0, JSON.stringify(doc));
    const prompt = p.prompt("spec");
    assert.match(prompt, /## REQ-001 — Orders can be cancelled/);
    assert.match(prompt, /The system SHALL orders can be cancelled\./);
    assert.match(prompt, /docs\/notes\.md/);
    for (const f of ["spec.md", "features/orders/REQ-001.feature", "docs/notes.md"]) {
      assert.ok(doc.plan.read.includes(f), `read lists ${f}: ${doc.plan.read}`);
    }
    const unresolved = doc.status.filter((d: any) => d.code === "mention_unresolved");
    assert.equal(unresolved.length, 1);
    assert.equal(unresolved[0].target, "@REQ-999");
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-521: --req and --file give the same context as mentions", () => {
  const p = agentProject("spec");
  try {
    const { status, doc } = cliJson(
      p.dir,
      "agent",
      "ask",
      REQUEST,
      "--req",
      "REQ-001",
      "--file",
      "docs/notes.md"
    );
    assert.equal(status, 0, JSON.stringify(doc));
    assert.match(p.prompt("spec"), /## REQ-001 — Orders can be cancelled/);
    assert.ok(doc.plan.read.includes("docs/notes.md"));
    assert.ok(doc.plan.read.includes("features/orders/REQ-001.feature"));
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-522 SCN-522a: the plan is listed from the git folder, then discarded; a second discard is plan_not_found", () => {
  const p = agentProject("spec");
  try {
    const asked = cliJson(p.dir, "agent", "ask", REQUEST).doc;
    const id = asked.plan.id;
    const listed = cliJson(p.dir, "agent", "plans");
    assert.equal(listed.status, 0);
    assert.equal(listed.doc.plans.length, 1);
    const [entry] = listed.doc.plans;
    assert.equal(entry.id, id);
    assert.equal(entry.request, REQUEST);
    assert.deepEqual(entry.files, [{ path: "spec.md", change: "modify" }]);
    assert.equal(entry.stale, false);
    assert.ok(entry.created);
    const kept = path.join(p.dir, ".git", "specgate", "plans", id, "plan.json");
    assert.ok(fs.existsSync(kept), "kept under the git folder");
    const stored = JSON.parse(fs.readFileSync(kept, "utf8"));
    assert.equal(stored.base.commit, git(p.dir, "rev-parse", "HEAD").stdout.trim());
    assert.match(stored.base.files["spec.md"], /^[0-9a-f]{64}$/);

    const discarded = cliJson(p.dir, "agent", "discard", id);
    assert.equal(discarded.status, 0);
    assert.equal(discarded.doc.discarded.id, id);
    assert.deepEqual(cliJson(p.dir, "agent", "plans").doc.plans, []);
    const again = cliJson(p.dir, "agent", "discard", id);
    assert.equal(again.status, 1);
    assert.equal(again.doc.status[0].code, "plan_not_found");
    assert.equal(again.doc.status[0].fix, "specgate agent plans");
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-522: a plan whose file changed since is listed as stale", () => {
  const p = agentProject("spec");
  try {
    cliJson(p.dir, "agent", "ask", REQUEST);
    fs.appendFileSync(path.join(p.dir, "spec.md"), "\nA person's edit.\n");
    assert.equal(cliJson(p.dir, "agent", "plans").doc.plans[0].stale, true);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-523 SCN-523a: spec mode keeps spec.md and features/, refuses src/app.js; --mode code is refused before the agent runs", () => {
  const p = agentProject("code");
  try {
    const { status, doc } = cliJson(p.dir, "agent", "ask", REQUEST);
    assert.equal(status, 0, JSON.stringify(doc));
    const paths = doc.plan.files.map((f: any) => f.path).sort();
    assert.deepEqual(paths, ["features/orders/cancel.feature", "spec.md"]);
    const added = doc.plan.files.find((f: any) => f.path === "features/orders/cancel.feature");
    assert.equal(added.change, "add");
    const refused = doc.status.filter((d: any) => d.code === "edit_refused");
    assert.deepEqual(
      refused.map((d: any) => d.target),
      ["src/app.js"]
    );
    assert.equal(refused[0].severity, "warning");
    assert.equal(read(p.dir, "src/app.js"), "module.exports = {};\n");

    const runs = p.runs();
    const code = cliJson(p.dir, "agent", "ask", REQUEST, "--mode", "code");
    assert.equal(code.status, 2);
    assert.equal(code.doc.plan, null);
    assert.equal(code.doc.status[0].code, "agent_mode_unknown");
    assert.equal(p.runs(), runs, "the agent did not run");
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-526 SCN-526a: no agent is agent_not_set; a failing agent is agent_failed with stderr; nothing changed is plan_empty", () => {
  const p = agentProject(null);
  try {
    const none = cliJson(p.dir, "agent", "ask", REQUEST);
    assert.equal(none.status, 1);
    assert.equal(none.doc.plan, null);
    assert.equal(none.doc.status[0].code, "agent_not_set");
    assert.equal(none.doc.status[0].fix, "specgate agents init --tool claude");

    const failed = cliJson(p.dir, "agent", "ask", REQUEST, "--agent", p.agent("fail"));
    assert.equal(failed.status, 1);
    assert.equal(failed.doc.plan, null);
    assert.equal(failed.doc.status[0].code, "agent_failed");
    assert.match(failed.doc.status[0].message, /rate limited/);
    assert.deepEqual(cliJson(p.dir, "agent", "plans").doc.plans, [], "no plan is kept");

    const empty = cliJson(p.dir, "agent", "ask", REQUEST, "--agent", p.agent("noop"));
    assert.equal(empty.status, 0, JSON.stringify(empty.doc));
    assert.equal(empty.doc.plan.id, null);
    assert.deepEqual(empty.doc.plan.files, []);
    assert.equal(empty.doc.status[0].code, "plan_empty");
    assert.deepEqual(cliJson(p.dir, "agent", "plans").doc.plans, []);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-526: an agent past --timeout is agent_failed, and says it timed out", () => {
  const p = agentProject(null);
  try {
    const started = Date.now();
    const slow = cliJson(
      p.dir,
      "agent",
      "ask",
      REQUEST,
      "--agent",
      p.agent("slow"),
      "--timeout",
      "1"
    );
    assert.equal(slow.status, 1);
    assert.equal(slow.doc.status[0].code, "agent_failed");
    assert.match(slow.doc.status[0].message, /timed out after 1 s/);
    assert.ok(Date.now() - started < 15000, "it did not wait for the agent");
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-526: a project outside git is refused with agent_needs_git", () => {
  const p = agentProject("spec");
  try {
    fs.rmSync(path.join(p.dir, ".git"), { recursive: true, force: true });
    const r = cliJson(p.dir, "agent", "ask", REQUEST);
    assert.equal(r.status, 1);
    assert.equal(r.doc.status[0].code, "agent_needs_git");
  } finally {
    removeProject(p.dir);
  }
});
