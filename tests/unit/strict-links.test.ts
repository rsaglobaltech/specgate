"use strict";

/**
 * `link: strict` in the gate policy (change `strict-links`, REQ-800, REQ-801):
 * a comment that names a requirement does not make its file the test.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli } from "../helpers/cli";
const { withoutCodeComments } = require("../../packages/core/src/domain/CodeComments");
const { deriveRows } = require("../../packages/core/src/domain/DerivedMatrix");
const { parseGatePolicy, gatePolicyTemplate } = require("../../scripts/lib/gate-policy");

const SPEC = ["REQ-007", "REQ-008", "REQ-009"]
  .map(
    (id) =>
      `## ${id} — ${id} title\n\n<!-- specgate:trace status=Approved -->\n\nThe system SHALL do ${id}.\n`
  )
  .join("\n");

const LOGIN = [
  "// REQ-009: covered elsewhere",
  'const url = "http://x/REQ-008"; /* REQ-009 again */',
  'test("REQ-007: a locked account is refused", () => {',
  "  # not a comment in JavaScript, but a private-looking token: REQ-010",
  "});",
].join("\n");

const testOf = (rows: Array<{ requirement: string; testArtifact?: string }>, id: string) =>
  rows.find((r) => r.requirement === id)?.testArtifact || "";

test("REQ-800: comments are blanked by the file's language, strings kept", () => {
  const js = withoutCodeComments("a.test.js", LOGIN);
  assert.equal(js.length, LOGIN.length, "every other character stays where it was");
  assert.doesNotMatch(js, /REQ-009/);
  assert.match(js, /"http:\/\/x\/REQ-008"/);
  assert.match(js, /REQ-007: a locked account/);
  const py = withoutCodeComments(
    "test_login.py",
    '# REQ-001\ndef test_req_002():\n    """REQ-003 docstring"""\n    s = "#REQ-004"  # REQ-005\n'
  );
  assert.doesNotMatch(py, /REQ-001|REQ-005/);
  assert.match(py, /REQ-003/);
  assert.match(py, /#REQ-004/);
  assert.match(py, /test_req_002/);
  const java = withoutCodeComments(
    "LoginTest.java",
    '/**\n * REQ-001\n */\n@DisplayName("REQ-002")\n'
  );
  assert.doesNotMatch(java, /REQ-001/);
  assert.match(java, /REQ-002/);
  assert.equal(
    withoutCodeComments("notes.unknown", "// REQ-001"),
    "// REQ-001",
    "unknown: as read"
  );
});

test("REQ-800 SCN-800b: under link: strict, a name and a string link; a comment does not", () => {
  const sources = {
    spec: SPEC,
    features: [],
    tests: [{ path: "tests/login.test.js", source: LOGIN }],
  };
  const strict = deriveRows({ ...sources, links: "strict" });
  assert.equal(testOf(strict, "REQ-007"), "tests/login.test.js");
  assert.equal(testOf(strict, "REQ-008"), "tests/login.test.js");
  assert.doesNotMatch(testOf(strict, "REQ-009"), /login\.test\.js/);
  const mention = deriveRows(sources);
  assert.equal(
    testOf(mention, "REQ-009"),
    "tests/login.test.js",
    "without link: strict, as before"
  );
});

test("REQ-800: an explicit test= is kept under link: strict", () => {
  const spec =
    "## REQ-009 — t\n\n<!-- specgate:trace status=Approved test=tests/login.test.js -->\n";
  const rows = deriveRows({
    spec,
    features: [],
    tests: [{ path: "tests/login.test.js", source: LOGIN }],
    links: "strict",
  });
  assert.equal(testOf(rows, "REQ-009"), "tests/login.test.js");
});

test("REQ-801 SCN-801a: the policy reads link, and refuses any other value", () => {
  assert.equal(parseGatePolicy("preset: standard\nlink: strict\n").link, "strict");
  const mention = parseGatePolicy("preset: standard\nlink: mention\n");
  assert.equal(mention.link, undefined);
  assert.deepEqual(mention.problems, []);
  const bad = parseGatePolicy("preset: standard\nlink: tags\n");
  assert.equal(bad.problems.length, 1);
  assert.match(bad.problems[0].message, /link `tags` is not mention or strict/);
  assert.match(bad.problems[0].fix, /link: strict/);
  assert.match(gatePolicyTemplate(), /^# link: strict +# .*comment/m);
});

/** An adopted project with one requirement, and a test that names it only in a comment. */
function project(t: TestContext) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-strict-links-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  assert.equal(cli("new", "A locked account is refused", "--project-dir", dir).status, 0);
  const id = /(REQ-\d+)/.exec(fs.readFileSync(path.join(dir, "spec.md"), "utf8"))![1];
  fs.writeFileSync(
    path.join(dir, "tests", "login.test.js"),
    `// ${id}: covered elsewhere\nrequire("node:test")("logs in", () => {});\n`
  );
  return { dir, id };
}

test("REQ-800 SCN-800a: apply refuses a requirement whose only link is a comment, and says why", (t: TestContext) => {
  const { dir, id } = project(t);
  const gate = path.join(dir, ".specgate", "gate.yaml");
  fs.mkdirSync(path.dirname(gate), { recursive: true });
  const before = fs.existsSync(gate) ? fs.readFileSync(gate, "utf8") : "preset: standard\n";
  fs.writeFileSync(gate, `${before.trimEnd()}\nlink: strict\n`);
  const r = cli("apply", id, "--project-dir", dir, "--json");
  const doc = JSON.parse(r.stdout);
  const refusal = doc.status.find((d: { code: string }) => d.code === "apply_no_test");
  assert.ok(refusal, r.stdout + r.stderr);
  assert.match(refusal.fix, /a comment .*does not count.*link: strict/);
});
