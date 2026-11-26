/**
 * walkthrough-fixes: what a newcomer following the guides met on 2026-11-26 —
 * `status` names the approval a change waits for (REQ-777).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const cli = (dir: string, args: string[], person = false) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NO_COLOR: "1",
      SPECGATE_SKIP_DOCTOR: "1",
      SPECGATE_ASSUME_TTY: person ? "1" : "",
    },
  });

test("REQ-777 SCN-777a: a change nobody approved — status names the approval, not apply", () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-status-approve-")));
  made.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli(dir, ["adopt", "--no-ci"]).status, 0);
  assert.equal(cli(dir, ["propose", "export-csv", "--capability", "export"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/export-csv/specs/export/spec.md");
  const id = (fs.readFileSync(delta, "utf8").match(/REQ-\d+/) || ["REQ-002"])[0];
  fs.writeFileSync(
    delta,
    [
      "# Delta — export",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${id} — Export the loans as CSV`,
      "",
      "<!-- specgate:trace actor=Librarian kind=functional -->",
      "",
      "The system SHALL export the loans as CSV, one line a loan, under the header `title,daysLate`.",
      "",
      `#### Scenario: SCN-${id.slice(4)}a — Two loans, two lines`,
      "",
      "- GIVEN two loans",
      "- WHEN the librarian exports them",
      "- THEN the file has the header and two lines",
      "",
    ].join("\n")
  );
  const before = JSON.parse(cli(dir, ["status", "--json"]).stdout);
  assert.equal(
    before.nextCommand,
    "specgate change approve export-csv",
    JSON.stringify(before.nextCommand)
  );
  assert.equal(cli(dir, ["change", "approve", "export-csv"], true).status, 0);
  const after = JSON.parse(cli(dir, ["status", "--json"]).stdout);
  assert.notEqual(after.nextCommand, "specgate change approve export-csv");
});

test("REQ-778 SCN-778a: a trace comment over two lines keeps its feature file through archive", () => {
  const { withDefaultFeaturePaths } = require("../../packages/core/src/domain/DeltaFeature");
  const delta = [
    "## ADDED Requirements",
    "",
    "### Requirement: REQ-014 — Dynamic peak pricing",
    "",
    "The system SHALL apply the peak rate above the threshold.",
    "",
    "#### Scenario: SCN-014 — Peak rate applies above the threshold",
    "",
    "- GIVEN occupancy is above 85%",
    "- WHEN a vehicle enters",
    "- THEN the peak tariff is applied",
    "",
    "<!-- specgate:trace kind=functional uc=UC-007",
    "     feature=features/pricing/dynamic_pricing.feature -->",
    "",
  ].join("\n");
  const out = withDefaultFeaturePaths(delta, "pricing");
  assert.equal(out, delta, "the author's feature file stands");
  assert.doesNotMatch(out, /REQ-014\.feature/);
  // One line, no feature named: the default is still given.
  const plain = delta.replace(
    "<!-- specgate:trace kind=functional uc=UC-007\n     feature=features/pricing/dynamic_pricing.feature -->",
    "<!-- specgate:trace kind=functional -->"
  );
  assert.match(
    withDefaultFeaturePaths(plain, "pricing"),
    /feature=features\/pricing\/REQ-014\.feature/
  );
});

test("REQ-778 SCN-778a: writing a status into a trace comment over two lines keeps all of it", () => {
  const { setTraceFields } = require("../../packages/core/src/domain/DerivedMatrix");
  const spec = [
    "### Requirement: REQ-014 — Dynamic peak pricing",
    "",
    "<!-- specgate:trace kind=functional uc=UC-007",
    "     feature=features/pricing/dynamic_pricing.feature -->",
    "",
    "The system SHALL apply the peak rate.",
    "",
  ].join("\n");
  const out = setTraceFields(spec, "REQ-014", { status: "Implemented" });
  const traces = out.split("\n").filter((l: string) => /specgate:trace|feature=/.test(l));
  assert.equal(traces.length, 1, out);
  assert.match(traces[0], /status=Implemented/);
  assert.match(traces[0], /feature=features\/pricing\/dynamic_pricing\.feature/);
  assert.ok(traces[0].trimEnd().endsWith("-->"), traces[0]);
});
