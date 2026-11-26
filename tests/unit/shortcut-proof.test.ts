/**
 * shortcut-proof: the three shortcuts the exam of 2026-11-24 found. Source
 * written by any means before its test stops the session (REQ-742); step
 * definitions changed after the code began fail the gate (REQ-743); a delivery
 * says the source files its change's design does not name (REQ-744).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const guard = require("../../scripts/plugin/guard-hook");
const bridge = require("../../scripts/plugin/opencode-bridge");
const { TOOLS } = require("../../scripts/agents/init");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

/** A committed project with draft-fees open: REQ-002, of the given status. */
function feesProject(status = "Draft"): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-shortcut-"));
  made.push(root);
  w(root, "spec.md", "# Spec\n");
  w(root, "src/index.js", "module.exports = {};\n");
  w(root, "docs/specs/changes/draft-fees/change.yaml", "specgate_change_version: 1\n");
  w(
    root,
    "docs/specs/changes/draft-fees/specs/fees/spec.md",
    "# Delta — fees\n\n## ADDED Requirements\n\n### Requirement: REQ-002 — The late fee\n\n" +
      `<!-- specgate:trace status=${status} actor=Member kind=functional -->\n\n` +
      "The system SHALL charge 0.50 a late day.\n\n#### Scenario: SCN-002a — Three days late\n\n- GIVEN a\n- WHEN b\n- THEN c\n"
  );
  const g = (...a: string[]) =>
    spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", ...a], { cwd: root, encoding: "utf8" });
  g("init", "-q");
  g("add", "-A");
  g("commit", "-qm", "init");
  return root;
}

const shell = (root: string, env: Record<string, string | undefined> = {}) =>
  guard.decide({ cwd: root, tool_name: "Bash", tool_input: { command: "npm test" } }, env);

// ── REQ-742 ──

test("REQ-742 SCN-742a: written through the shell — the next shell call is refused, naming the file and the requirement", () => {
  const root = feesProject();
  assert.equal(shell(root).allow, true, "a clean tree stops nothing");
  // What `cat > src/fees.js` leaves behind.
  w(root, "src/fees.js", "module.exports = { lateFee: (d) => d };\n");
  const d = shell(root);
  assert.equal(d.allow, false);
  assert.match(d.message, /src\/fees\.js/);
  assert.match(d.message, /REQ-002/);
  assert.match(d.message, /draft-fees/);
});

test("REQ-742 SCN-742b: the test puts it right — writing the test is allowed, and the shell call after it", () => {
  const root = feesProject();
  w(root, "src/fees.js", "module.exports = {};\n");
  assert.equal(shell(root).allow, false);
  const test_ = path.join(root, "test/fees.test.js");
  assert.equal(guard.decide({ cwd: root, tool_name: "Write", tool_input: { file_path: test_ } }, {}).allow, true);
  w(root, "test/fees.test.js", "// REQ-002 SCN-002a: the late fee\n");
  assert.equal(shell(root).allow, true);
});

test("REQ-742 SCN-742c: reading is not stopped", () => {
  const root = feesProject();
  w(root, "src/fees.js", "module.exports = {};\n");
  for (const tool_name of ["Read", "Grep", "Glob"]) {
    assert.equal(guard.decide({ cwd: root, tool_name, tool_input: { file_path: path.join(root, "spec.md") } }, {}).allow, true);
  }
});

test("REQ-742: a test that names another change's requirement does not count; off by setting; nothing owed once every requirement is applied", () => {
  const root = feesProject();
  w(root, "src/fees.js", "module.exports = {};\n");
  w(root, "test/other.test.js", "// REQ-001: something else\n");
  assert.equal(shell(root).allow, false);
  assert.equal(shell(root, { SPECGATE_GUARD: "off" }).allow, true);
  const done = feesProject("Implemented");
  w(done, "src/fees.js", "module.exports = {};\n");
  assert.equal(shell(done).allow, true);
});

test("REQ-742: the hook refuses with exit 2, and Claude Code's plugin sends its shell to the guard", () => {
  const root = feesProject();
  w(root, "src/fees.js", "module.exports = {};\n");
  const log = path.join(root, "..", `${path.basename(root)}-hooks.log`);
  made.push(log);
  const raw = JSON.stringify({ cwd: root, tool_name: "Bash", tool_input: { command: "npm test" } });
  assert.equal(guard.main(raw, { SPECGATE_HOOK_LOG: log }), 2);
  const line = JSON.parse(fs.readFileSync(log, "utf8").trim().split("\n").pop());
  assert.equal(line.decision, "refused");
  assert.equal(line.file, "src/fees.js");
  const hooks = JSON.parse(
    TOOLS["claude-plugin"].files().find((f: { path: string }) => f.path.endsWith("hooks.json")).contents
  );
  assert.match(hooks.hooks.PreToolUse[0].matcher, /(^|\|)Bash(\||$)/);
  const shipped = JSON.parse(fs.readFileSync(path.join(__dirname.replace(/[\\/]dist([\\/])/, "$1"), "../../packages/claude-plugin/hooks/hooks.json"), "utf8"));
  assert.match(shipped.hooks.PreToolUse[0].matcher, /(^|\|)Bash(\||$)/);
});

test("REQ-742 SCN-742a: on OpenCode — 2 and 1 — the shell is refused and recorded while the file has no test", async () => {
  const root = feesProject();
  w(root, "src/fees.js", "module.exports = {};\n");
  const log = path.join(root, "..", `${path.basename(root)}-oc.log`);
  made.push(log);
  const env = { SPECGATE_HOOK_LOG: log };
  // OpenCode 2
  const hooks: Record<string, (e: unknown) => unknown> = {};
  const ctx = {
    location: { directory: root },
    session: { hook: async (n: string, fn: (e: unknown) => unknown) => void (hooks[`session.${n}`] = fn), prompt: async () => {} },
    tool: { hook: async (n: string, fn: (e: unknown) => unknown) => void (hooks[`tool.${n}`] = fn) },
    event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {} }) },
  };
  const stop = await bridge.setupV2(ctx, { env });
  try {
    await assert.rejects(async () => hooks["tool.execute.before"]!({ tool: "shell", input: { command: "npm test" } }), /src\/fees\.js[\s\S]*REQ-002/);
    await hooks["tool.execute.before"]!({ tool: "read", input: { path: "spec.md" } });
  } finally {
    stop();
  }
  // OpenCode 1
  const v1 = bridge.createHooks({ directory: root, client: { session: { prompt: async () => {} } } }, { env });
  await assert.rejects(async () => v1["tool.execute.before"]({ tool: "bash" }, { args: { command: "npm test" } }), /REQ-002/);
  // The guard's own lines: the log also keeps the steps of when the code began (REQ-747).
  const lines = fs.readFileSync(log, "utf8").trim().split("\n").map((l: string) => JSON.parse(l)).filter((l: { hook: string }) => l.hook === "guard");
  assert.deepEqual(lines.map((l: { decision: string }) => l.decision), ["refused", "refused"]);
  w(root, "test/fees.test.js", "// REQ-002\n");
  await v1["tool.execute.before"]({ tool: "bash" }, { args: { command: "npm test" } });
});

// ── REQ-744 ──

import { designFiles, outsideDesign } from "../../packages/core/src/domain/DesignScope";

const CLI = path.join(
  path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")),
  "bin",
  "specgate.js"
);
const FEES = "docs/specs/changes/draft-fees";
const FEES_DELTA = [
  "# Delta — fees",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-031 — The late fee",
  "",
  "<!-- specgate:trace status=Draft actor=Member kind=functional -->",
  "",
  "The system SHALL charge 0.50 for each day a book is late.",
  "",
  "#### Scenario: SCN-031 — Three days late costs 1.50",
  "",
  "- GIVEN a book returned 3 days late",
  "- WHEN the fee is computed",
  "- THEN the fee is 1.50",
  "",
].join("\n");

/** An adopted project with draft-fees approved; `design` is its design.md, or none. */
function scopeProject(o: { design?: string | null; gate?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-scope-"));
  made.push(dir);
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: "1" } }); // the fixture stands for a person (REQ-748)
  run("git", ["init", "-q"]);
  run("git", ["config", "user.email", "t@t"]);
  run("git", ["config", "user.name", "t"]);
  const adopted = run(process.execPath, [CLI, "adopt", "--project-dir", dir, "--no-ci"]);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  const config = path.join(dir, "harness.config.yaml");
  const harness = fs.existsSync(config) ? fs.readFileSync(config, "utf8") : "";
  w(dir, "harness.config.yaml", `${harness.replace(/^(test_cmd|bdd_cmd):.*\n?/gm, "").replace(/\s*$/, "")}\ntest_cmd: "node -e 0"\n`);
  w(dir, ".specgate/gate.yaml", o.gate ?? "preset: standard\n");
  const proposed = run(process.execPath, [CLI, "propose", "draft-fees", "--project-dir", dir]);
  assert.equal(proposed.status, 0, proposed.stdout + proposed.stderr);
  w(dir, `${FEES}/specs/draft-fees/spec.md`, FEES_DELTA);
  if (o.design !== null) {
    w(dir, `${FEES}/design.md`, o.design ?? "# Design: draft-fees\n\n## Modules\n\n- `src/fees.js` — the fee of a late book.\n");
  }
  const approved = run(process.execPath, [CLI, "change", "approve", "draft-fees", "--project-dir", dir]);
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  w(dir, "src/fees.js", "module.exports = { lateFee: (d) => Math.min(d * 0.5, 10) };\n");
  w(dir, "tests/fees.test.js", "// REQ-031 SCN-031: the late fee\n");
  run("git", ["add", "-A"]);
  run("git", ["commit", "-qm", "seed"]);
  const check = () => {
    const r = run(process.execPath, [CLI, "check", dir, "--json"]);
    return { status: r.status, said: r.stdout + r.stderr };
  };
  return { dir, check, run };
}

test("REQ-744: a design names the source files it writes in backticks; a new file is outside it when it names others", () => {
  const design = "## Modules\n\n- `src/fees.js` — fees.\n- `./lib/money.ts`, `specgate check`, `docs/x.md`, `AC-1` and `README`.\n";
  assert.deepEqual(designFiles(design), ["src/fees.js", "lib/money.ts"]);
  assert.deepEqual(outsideDesign(["src/fees.js", "src/export.js", "lib/money.ts"], designFiles(design)), ["src/export.js"]);
  assert.deepEqual(outsideDesign(["src/export.js"], []), [], "a design that names no file says nothing");
});

test("REQ-744 SCN-744a: a file nobody designed — with scope: error the gate fails naming src/export.js", () => {
  const p = scopeProject({ gate: "preset: standard\nrules:\n  scope: error\n" });
  assert.equal(p.check().status, 0, p.check().said);
  w(p.dir, "src/export.js", "module.exports = { exportCsv: () => '' };\n");
  w(p.dir, "tests/export.test.js", "// REQ-031: export\n");
  const c = p.check();
  assert.notEqual(c.status, 0, c.said);
  assert.match(c.said, /file_outside_design/);
  assert.match(c.said, /src\/export\.js/);
  assert.doesNotMatch(c.said, /tests\/export\.test\.js[^"]*not name/, "a test is not source");
  const v = p.run(process.execPath, [CLI, "validate", p.dir, "--strict", "--json"]);
  assert.notEqual(v.status, 0);
  assert.match(v.stdout, /file_outside_design/);
});

test("REQ-744 SCN-744b: a warning by default — the gate passes, naming src/export.js", () => {
  const p = scopeProject();
  w(p.dir, "src/export.js", "module.exports = {};\n");
  const c = p.check();
  assert.equal(c.status, 0, c.said);
  assert.match(c.said, /file_outside_design/);
  assert.match(c.said, /src\/export\.js/);
});

test("REQ-744 SCN-744c: a design that names no file — the gate says nothing of it", () => {
  const p = scopeProject({ design: null, gate: "preset: standard\nrules:\n  scope: error\n" });
  w(p.dir, "src/export.js", "module.exports = {};\n");
  const c = p.check();
  assert.equal(c.status, 0, c.said);
  assert.doesNotMatch(c.said, /file_outside_design/);
});

test("REQ-744: the designed file itself, new in the working tree, is not reported; scope: off says nothing", () => {
  const p = scopeProject({ gate: "preset: standard\nrules:\n  scope: off\n" });
  w(p.dir, "src/export.js", "module.exports = {};\n");
  assert.doesNotMatch(p.check().said, /file_outside_design/);
});

// ── REQ-743 ──

const STEPS = "features/step_definitions/fees.steps.js";
const HONEST = "// Then the fee is {float}: assert.equal(fee, expected)\n";
const BENT = "// Then the fee is {float}: assert.equal(fee, expected * 2)\n";

/** scopeProject, its REQ-031 in the matrix and ready to apply; `apply` runs it, as a person at a terminal when asked. */
function stepsProject() {
  const p = scopeProject({ design: null });
  const matrix = fs.readFileSync(path.join(p.dir, "docs/specs/traceability.md"), "utf8");
  w(
    p.dir,
    "docs/specs/traceability.md",
    `${matrix.replace(/\s*$/, "")}\n| REQ-031 | SCN-031 | - | - | - | - | - | \`src/fees.js\` | tests/fees.test.js | Approved |\n`
  );
  p.run("git", ["add", "-A"]);
  p.run("git", ["commit", "-qm", "matrix"]);
  const apply = (o: { reviewed?: boolean; person?: boolean } = {}) => {
    const r = spawnSync(
      process.execPath,
      [CLI, "apply", "REQ-031", "--project-dir", p.dir, ...(o.reviewed ? ["--steps-reviewed"] : [])],
      { cwd: p.dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: o.person ? "1" : "" } }
    );
    return { status: r.status, said: r.stdout + r.stderr };
  };
  /** What the guard does when the agent's first source write is let through. */
  const codeBegins = () => {
    w(p.dir, "tests/fees.test.js", "// REQ-031 SCN-031: the late fee, again\n");
    const d = guard.decide({ cwd: p.dir, tool_name: "Write", tool_input: { file_path: path.join(p.dir, "src/fees.js") } }, {});
    assert.equal(d.allow, true, d.message);
  };
  const record = path.join(p.dir, ".specgate/evidence/REQ-031/steps.json");
  return { ...p, apply, codeBegins, record };
}

test("REQ-743: the steps are recorded when the first source file is written — by the write tool or found written by the shell — and once", () => {
  const p = stepsProject();
  w(p.dir, STEPS, HONEST);
  assert.equal(fs.existsSync(p.record), false);
  p.codeBegins();
  const first = JSON.parse(fs.readFileSync(p.record, "utf8"));
  assert.deepEqual(Object.keys(first.files), [STEPS]);
  assert.match(first.files[STEPS], /^sha256:/);
  w(p.dir, STEPS, BENT);
  p.codeBegins();
  assert.deepEqual(JSON.parse(fs.readFileSync(p.record, "utf8")), first, "the record is of when the code began");

  const viaShell = stepsProject();
  w(viaShell.dir, "src/fees.js", "module.exports = { lateFee: (d) => d };\n");
  guard.decide({ cwd: viaShell.dir, tool_name: "Bash", tool_input: { command: "npm test" } }, {});
  assert.ok(fs.existsSync(viaShell.record), "source found written by the shell begins the code too");
});

test("REQ-743 SCN-743a: steps bent to the code — changed after the code began, apply fails naming the file", () => {
  const p = stepsProject();
  w(p.dir, STEPS, HONEST);
  p.codeBegins();
  w(p.dir, STEPS, BENT);
  const r = p.apply();
  assert.notEqual(r.status, 0, r.said);
  assert.match(r.said, /steps_changed_after_code/);
  assert.match(r.said, /features\/step_definitions\/fees\.steps\.js/);
  assert.match(r.said, /--steps-reviewed/);
  assert.doesNotMatch(fs.readFileSync(path.join(p.dir, `${FEES}/specs/draft-fees/spec.md`), "utf8"), /status=Implemented/);
});

test("REQ-743 SCN-743a: steps written only after the code began fail the same way", () => {
  const p = stepsProject();
  p.codeBegins();
  w(p.dir, STEPS, BENT);
  const r = p.apply();
  assert.notEqual(r.status, 0, r.said);
  assert.match(r.said, /steps_changed_after_code/);
});

test("REQ-743 SCN-743b: steps first — written before any source file and not changed since, the gate says nothing of them", () => {
  const p = stepsProject();
  w(p.dir, STEPS, HONEST);
  p.codeBegins();
  const r = p.apply();
  assert.equal(r.status, 0, r.said);
  assert.doesNotMatch(r.said, /steps_changed_after_code|same delivery/);
  assert.equal(fs.existsSync(p.record), false, "the record ends with the delivery");
});

test("REQ-743 SCN-743c: a person looked — --steps-reviewed delivers it, and its evidence says who", () => {
  const p = stepsProject();
  w(p.dir, STEPS, HONEST);
  p.codeBegins();
  w(p.dir, STEPS, BENT);
  const agent = p.apply({ reviewed: true });
  assert.notEqual(agent.status, 0, "said by something with no terminal, it is not a person's word");
  assert.match(agent.said, /steps_review_needs_person/);
  const r = p.apply({ reviewed: true, person: true });
  assert.equal(r.status, 0, r.said);
  const evidence = JSON.parse(fs.readFileSync(path.join(p.dir, ".specgate/evidence/REQ-031/evidence.json"), "utf8"));
  assert.equal(evidence.steps.reviewed, true);
  assert.equal(evidence.steps.by.email, "t@t");
  assert.deepEqual(evidence.steps.files, [STEPS]);
});

test("REQ-743 SCN-743d: nothing recorded them — apply passes, saying the steps were written in the same delivery and not reviewed", () => {
  const p = stepsProject();
  w(p.dir, STEPS, BENT);
  const r = p.apply();
  assert.equal(r.status, 0, r.said);
  assert.match(r.said, /same delivery as the code/);
  assert.match(r.said, /not reviewed/);
  assert.match(r.said, /features\/step_definitions\/fees\.steps\.js/);
});

test("REQ-743: the harness gate fails at the stage steps when they changed after the code began", () => {
  const { stepsStage } = require("../../scripts/harness/run/gate");
  const p = stepsProject();
  w(p.dir, STEPS, HONEST);
  assert.equal(stepsStage(p.dir, "REQ-031"), null, "nothing recorded: nothing to say");
  p.codeBegins();
  assert.equal(stepsStage(p.dir, "REQ-031"), null);
  w(p.dir, STEPS, BENT);
  const failed = stepsStage(p.dir, "REQ-031");
  assert.equal(failed.ok, false);
  assert.equal(failed.stage, "steps");
  assert.match(failed.output, /fees\.steps\.js[\s\S]*steps_changed_after_code/);
});
