"use strict";

/**
 * A trace value cut at a space (change `trace-values`, REQ-798): validate
 * says so, and every reader of `actor=` reads it as the spec parser does.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli } from "../helpers/cli";
const { strayTraceWords } = require("../../packages/core/src/domain/SpecParser");
const { requirementsOf } = require("../../packages/core/src/domain/DomainView");
const { requirementActors } = require("../../scripts/lib/domain-docs");

/** An adopted project with one requirement whose trace opens with `actor`. */
function project(t: TestContext, actor: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-trace-values-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "app");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  assert.equal(cli("new", "A guardian resets access", "--project-dir", dir).status, 0);
  const spec = path.join(dir, "spec.md");
  const text = fs.readFileSync(spec, "utf8");
  assert.match(text, /<!-- specgate:trace /);
  fs.writeFileSync(spec, text.replace("<!-- specgate:trace ", `<!-- specgate:trace ${actor} `));
  return dir;
}

const SPEC = (trace: string) =>
  "# Delta\n\n### Requirement: REQ-011 — Access is recovered\n\n" +
  `<!-- specgate:trace ${trace} -->\n\nThe system SHALL recover access.\n`;

test("REQ-798: an unquoted value followed by a stray word is found, with its line", () => {
  assert.deepEqual(strayTraceWords(SPEC("actor=Adulto responsable kind=functional")), [
    { line: 5, key: "actor", read: "Adulto", meant: "Adulto responsable" },
  ]);
  assert.deepEqual(strayTraceWords(SPEC('actor="Adulto responsable" kind=functional')), []);
  assert.deepEqual(strayTraceWords(SPEC("actor=Developer kind=functional")), []);
  assert.deepEqual(
    strayTraceWords("```md\n<!-- specgate:trace actor=Adulto responsable -->\n```\n"),
    [],
    "a fenced example is not a trace"
  );
});

test("REQ-798: a multi-line trace is read whole", () => {
  const spec =
    "## REQ-011 — Access\n<!-- specgate:trace\n  actor=Adulto responsable\n  kind=functional\n-->\n";
  assert.deepEqual(strayTraceWords(spec), [
    { line: 2, key: "actor", read: "Adulto", meant: "Adulto responsable" },
  ]);
});

test("REQ-798 SCN-798a: validate warns about an actor cut at a space", (t: TestContext) => {
  const dir = project(t, "actor=Adulto responsable");
  const r = cli("validate", dir);
  const out = r.stdout + r.stderr;
  assert.match(out, /spec\.md:\d+: actor=Adulto responsable is read as actor=Adulto/);
  assert.match(out, /actor="Adulto responsable"/);
});

test("REQ-798 SCN-798b: a quoted actor keeps its spaces everywhere, and validate is quiet", (t: TestContext) => {
  const dir = project(t, 'actor="Adulto responsable"');
  const r = cli("validate", dir);
  assert.doesNotMatch(r.stdout + r.stderr, /is read as actor=/);
  assert.deepEqual(requirementActors(dir), ["Adulto responsable"]);
  const [req] = requirementsOf(SPEC('actor="Adulto responsable" kind=functional'), "access");
  assert.equal(req.actor, "Adulto responsable");
});

test("REQ-798: the domain view reads a trace spread over lines", () => {
  const spec =
    "### Requirement: REQ-012 — Access\n\n<!-- specgate:trace\n  kind=functional\n  actor='Tutor legal'\n-->\n";
  assert.equal(requirementsOf(spec, "access")[0].actor, "Tutor legal");
  assert.equal(requirementsOf("### Requirement: REQ-013 — None\n", "access")[0].actor, null);
});
