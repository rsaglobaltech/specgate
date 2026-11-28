"use strict";

/**
 * Evidence before and after (ADR-0047, change `evidence-before-after`):
 * the run before the code is kept as the before (REQ-803), the delivery's
 * evidence names it (REQ-804), and doctor says when Playwright keeps no
 * pictures (REQ-805).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli, json } from "../helpers/cli";
const { keepBefore, keepEvidence } = require("../../scripts/lib/evidence");
const { STEPS } = require("../../scripts/agents/commands");
const { slashCommandBody } = require("../../scripts/agents/init");

/** An adopted project whose gate requires its scenarios, run by `bdd_cmd`. */
function project(t: TestContext, bddCmd: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "app");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  const gate = path.join(dir, ".specgate", "gate.yaml");
  const policy = fs.existsSync(gate) ? fs.readFileSync(gate, "utf8") : "preset: standard\n";
  fs.writeFileSync(gate, `${policy.replace(/^#?\s*bdd:.*$/m, "").trimEnd()}\nbdd: required\n`);
  assert.equal(cli("config", "set", "bdd_cmd", bddCmd, "--project-dir", dir).status, 0);
  return dir;
}

/** A runner stand-in: writes a screenshot under test-results/ and fails, as before the code. */
const RED_RUNNER = [
  'const fs = require("fs");',
  'fs.mkdirSync("test-results/checkout", { recursive: true });',
  'fs.writeFileSync("test-results/checkout/screenshot.png", "png");',
  'console.log("1 failed: " + process.argv.slice(2).join(" "));',
  "process.exit(1);",
].join("\n");

test("REQ-803 SCN-803a: evidence before keeps the red run and what the runner wrote", (t: TestContext) => {
  const dir = project(t, "node red.js {tags}");
  fs.writeFileSync(path.join(dir, "red.js"), RED_RUNNER);
  const r = cli("evidence", "before", "REQ-031", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  assert.equal(doc.evidence.before[0].requirement, "REQ-031");
  assert.equal(doc.evidence.before[0].exitCode, 1);
  const before = path.join(dir, ".specgate", "evidence", "REQ-031", "before");
  const run = JSON.parse(fs.readFileSync(path.join(before, "run.json"), "utf8"));
  assert.match(run.command, /@REQ-031/);
  assert.equal(run.exitCode, 1);
  assert.deepEqual(run.artifacts, ["artifacts/checkout/screenshot.png"]);
  assert.ok(fs.existsSync(path.join(before, "artifacts", "checkout", "screenshot.png")));
  assert.match(fs.readFileSync(path.join(before, "run.log"), "utf8"), /1 failed: @REQ-031/);
  assert.match(
    fs.readFileSync(path.join(dir, ".specgate", "evidence", ".gitignore"), "utf8"),
    /^\*\/before\/artifacts\/$/m
  );
});

test("REQ-803: evidence before needs a runner, and a requirement id", (t: TestContext) => {
  const dir = project(t, "node red.js {tags}");
  assert.equal(cli("config", "set", "bdd_cmd", "", "--project-dir", dir).status, 0);
  const none = cli("evidence", "before", "REQ-031", "--project-dir", dir, "--json");
  assert.equal(none.status, 1);
  assert.equal(json(none).status[0].code, "evidence_no_runner");
  const bad = cli("evidence", "before", "checkout", "--project-dir", dir, "--json");
  assert.equal(bad.status, 2);
  assert.equal(json(bad).status[0].code, "evidence_usage");
});

test("REQ-803: an older Specgate's .gitignore gains the before's artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-ignore-"));
  try {
    const root = path.join(dir, ".specgate", "evidence");
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, ".gitignore"), "# old\n*/artifacts/\n");
    const run = { command: "x @REQ-1", exitCode: 1, ms: 5, output: "no", startedAt: Date.now() };
    keepBefore(dir, "REQ-1", run);
    keepBefore(dir, "REQ-1", run);
    const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    assert.equal(ignore.match(/before\/artifacts/g).length, 1, ignore);
    assert.match(ignore, /^\*\/artifacts\/$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-804 SCN-804a: the delivery's evidence names its before, and leaves it as it was", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-after-"));
  try {
    const red = { command: "x @REQ-031", exitCode: 1, ms: 5, output: "red", startedAt: Date.now() };
    keepBefore(dir, "REQ-031", red, new Date("2026-11-27T10:00:00Z"));
    const beforeFile = path.join(dir, ".specgate", "evidence", "REQ-031", "before", "run.json");
    const kept = fs.readFileSync(beforeFile, "utf8");
    const green = { ...red, exitCode: 0, output: "green", startedAt: Date.now() };
    keepEvidence(dir, "REQ-031", green);
    assert.equal(fs.readFileSync(beforeFile, "utf8"), kept);
    const ev = JSON.parse(
      fs.readFileSync(path.join(dir, ".specgate", "evidence", "REQ-031", "evidence.json"), "utf8")
    );
    assert.equal(ev.scenarios.exitCode, 0);
    assert.deepEqual(ev.before, {
      command: "x @REQ-031",
      exitCode: 1,
      at: "2026-11-27T10:00:00.000Z",
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-803: the apply step says to take the before after the test, before the code", () => {
  const body = slashCommandBody(STEPS.find((s: { name: string }) => s.name === "apply"));
  assert.match(body, /specgate evidence before REQ-NNN/);
});

test("REQ-805 SCN-805a: doctor says when Playwright keeps no screenshots or video", (t: TestContext) => {
  const dir = project(t, "npx bddgen && npx playwright test --grep {tags}");
  fs.writeFileSync(
    path.join(dir, "playwright.config.ts"),
    "export default { use: { baseURL: 'http://localhost:3000' } };\n"
  );
  const media = (d: string) =>
    json(cli("doctor", "--project-dir", d, "--json")).status.find(
      (s: { code: string }) => s.code === "doctor_evidence_media"
    );
  const off = media(dir);
  assert.ok(off, "warned");
  assert.equal(off.severity, "warning");
  assert.match(off.fix, /screenshot: 'on'/);
  assert.match(off.fix, /video: 'on'/);
  fs.writeFileSync(
    path.join(dir, "playwright.config.ts"),
    "export default { use: { screenshot: 'on', video: 'retain-on-failure', trace: 'on' } };\n"
  );
  assert.equal(media(dir).severity, "info", "both set: fine");
});

test("REQ-805: a runner doctor does not read is not judged", (t: TestContext) => {
  const dir = project(t, "npx cucumber-js --tags {tags}");
  const status = json(cli("doctor", "--project-dir", dir, "--json")).status;
  assert.ok(!status.some((s: { code: string }) => s.code === "doctor_evidence_media"));
});

test("REQ-803: a requirement already met is delivered as it is, and before says so", (t: TestContext) => {
  const dir = project(t, 'node -e "process.exit(0)" {tags}');
  const r = cli("evidence", "before", "REQ-031", "--project-dir", dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /its scenarios pass already/);
  assert.match(r.stdout, /they pass already: deliver it as it is/);
  assert.doesNotMatch(r.stdout, /once the code makes them pass/);
});
