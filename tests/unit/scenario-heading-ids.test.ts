/**
 * scenario-heading-ids: a requirement id named in a scenario's title declares
 * nothing (REQ-483).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import { requirementSections } from "../../packages/core/src/domain/SpecSections";

const DELTA = [
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-086 — Apply runs the gate",
  "",
  "The system SHALL apply.",
  "",
  "#### Scenario: SCN-251 — Apply on REQ-031 refused on the desktop",
  "",
  "#### Scenario: SCN-252 — Apply on REQ-030 in the browser",
  "",
  "## REQ-001 — The baseline",
  "",
  "#### Scenario SCN-001 — REQ-002 named without a colon",
  "",
  "| REQ-040 | A requirement in a table | Draft |",
].join("\n");

test("REQ-483 SCN-483a: a scenario that names REQ-030 and REQ-031 declares neither; REQ-086, REQ-001 and the table row stay declared", () => {
  assert.deepEqual(requirementSections(DELTA), ["REQ-086", "REQ-001", "REQ-040"]);
});

test("REQ-483 SCN-483a: `validate --strict` asks no matrix row for a requirement a scenario only names", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const path = require("node:path") as typeof import("node:path");
  const { runCli } = require("../helpers/cli") as typeof import("../helpers/cli");
  const env = { ...process.env, CI: "1" };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-483-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "repro" }));
    assert.equal(runCli(["adopt", "--yes", "--project-dir", dir], { env }).status, 0);
    const spec = path.join(dir, "spec.md");
    fs.appendFileSync(
      spec,
      "\n#### Scenario: SCN-252 — Apply on REQ-030 in the browser\n\n- GIVEN a change\n"
    );
    const r = runCli(["validate", dir, "--strict"], { env });
    assert.doesNotMatch(r.stdout + r.stderr, /REQ-030/);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
