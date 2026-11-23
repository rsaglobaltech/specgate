/**
 * matrix-migrate-fixes: found migrating specgate's own matrix. Code under a
 * folder named `spec` is not a test (REQ-675); the migration leaves an open
 * change's requirements to it (REQ-676).
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
const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

/** A project `init` made, with `## <id>` sections added to spec.md. */
function project(ids: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-matrix-fix-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  const made = sg(dir, "init");
  assert.equal(made.status, 0, made.stdout + made.stderr);
  const sections = ids
    .map((id) => `\n## ${id} — Requirement ${id}\n\nThe system SHALL do ${id}.\n`)
    .join("");
  fs.appendFileSync(path.join(dir, "spec.md"), sections);
  return dir;
}

type Row = { requirement: string; tests: string[]; code: string[] };
const rowOf = (dir: string, id: string): Row => {
  const r = sg(dir, "matrix", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).matrix.scenarios.find((s: Row) => s.requirement === id);
};

test("REQ-675 SCN-675a: a command folder named spec is code, not a test", () => {
  const dir = project(["REQ-062"]);
  w(dir, "scripts/commands/spec/Done.ts", "// REQ-062: marks a requirement done\nexport const done = 1;\n");
  w(dir, "tests/done.test.ts", "// REQ-062\nimport test from 'node:test';\n");
  const row = rowOf(dir, "REQ-062");
  assert.deepEqual(row.tests, ["tests/done.test.ts"]);
  assert.ok(row.code.includes("scripts/commands/spec/Done.ts"), JSON.stringify(row));
});

test("REQ-675 SCN-675b: RSpec's spec folder still holds tests", () => {
  const dir = project(["REQ-063"]);
  w(dir, "spec/models/order_spec.rb", "# REQ-063\ndescribe 'order' do\nend\n");
  w(dir, "spec/support/order_helper.rb", "# REQ-063\nmodule OrderHelper\nend\n");
  const row = rowOf(dir, "REQ-063");
  assert.deepEqual(row.tests, ["spec/models/order_spec.rb", "spec/support/order_helper.rb"]);
});

test("REQ-676 SCN-676a: the migration leaves a requirement still in its change to it", () => {
  const dir = project(["REQ-020"]);
  // The matrix as it is generated, then kept by hand: its marker dropped.
  assert.equal(sg(dir, "matrix").status, 0);
  const generated = read(dir, "docs/specs/traceability.md").split("\n").slice(1).join("\n");
  const handRow = "| REQ-021 | SCN-021 | - | - | - | - | - | - | - | Approved |";
  w(dir, "docs/specs/traceability.md", `${generated.trimEnd()}\n${handRow}\n`);
  w(
    dir,
    "docs/specs/changes/draft-pedidos/change.yaml",
    "specgate_change_version: 1\nschema: layered\ncreated: 2026-11-23\nrigor: lite\n"
  );
  w(
    dir,
    "docs/specs/changes/draft-pedidos/specs/pedidos/spec.md",
    [
      "# Delta — pedidos",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-021 — Cancel an order",
      "",
      "The system SHALL let the customer cancel an order not shipped yet.",
      "",
      "#### Scenario: SCN-021 — Cancelled",
      "",
      "- GIVEN an order not shipped",
      "- WHEN the customer cancels it",
      "- THEN it is cancelled",
      "",
    ].join("\n")
  );
  const r = sg(dir, "matrix", "--migrate", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(read(dir, "spec.md"), /REQ-021/);
  assert.match(read(dir, "docs/specs/traceability.md"), /^<!-- specgate:derived/);
  const doc = JSON.parse(r.stdout);
  const note = doc.status.find((s: { code: string }) => s.code === "matrix_rows_in_changes");
  assert.ok(note, r.stdout);
  assert.match(note.message, /draft-pedidos/);
});

/** A project whose matrix is generated, then kept by hand: its marker dropped, `edit` applied to it. */
function handKept(edit: (matrix: string) => string) {
  const dir = project(["REQ-020"]);
  assert.equal(sg(dir, "matrix").status, 0);
  const generated = read(dir, "docs/specs/traceability.md").split("\n").slice(1).join("\n");
  w(dir, "docs/specs/traceability.md", edit(generated));
  return dir;
}

test("REQ-677 SCN-677a: a row with more code than the hand-kept one is kept", () => {
  const dir = handKept((m) => m);
  w(dir, "src/orders.ts", "// REQ-020: orders\nexport const orders = [];\n");
  const r = sg(dir, "matrix", "--migrate", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(dir, "docs/specs/traceability.md"), /\| REQ-020 \|.*src\/orders\.ts/);
  const note = JSON.parse(r.stdout).status.find((s: { code: string }) => s.code === "matrix_rows_richer");
  assert.ok(note, r.stdout);
  assert.match(note.message, /^1 row\(s\)/);
});

test("REQ-677 SCN-677b: a test the hand-kept row named and no file mentions is kept in the trace", () => {
  const dir = handKept((m) =>
    m.replace(/^(\| REQ-020 \|(?:[^|]*\|){7})[^|]*\|/m, "$1 tests/orders.test.ts |")
  );
  const r = sg(dir, "matrix", "--migrate", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(dir, "spec.md"), /specgate:trace[^>]*test=tests\/orders\.test\.ts/);
  assert.match(read(dir, "docs/specs/traceability.md"), /\| REQ-020 \|.*tests\/orders\.test\.ts/);
});

test("REQ-676 SCN-676b: a requirement an open change modifies waits for its archive", () => {
  const dir = project([]);
  w(
    dir,
    "docs/specs/capabilities/avisos/spec.md",
    [
      "# avisos",
      "",
      "## Requirements",
      "",
      "### Requirement: REQ-030 — Warn the customer",
      "",
      "The system SHALL warn the customer of a late order.",
      "",
      "#### Scenario: SCN-030a — Late",
      "",
      "- GIVEN a late order",
      "- WHEN the day ends",
      "- THEN the customer is warned",
      "",
    ].join("\n")
  );
  assert.equal(sg(dir, "matrix").status, 0);
  const generated = read(dir, "docs/specs/traceability.md").split("\n").slice(1).join("\n");
  // The hand-kept row already says what draft-avisos will: a second scenario.
  w(dir, "docs/specs/traceability.md", generated.replace(/^\| REQ-030 \| [^|]*\|/m, "| REQ-030 | SCN-030a, SCN-030b |"));
  w(dir, "docs/specs/changes/draft-avisos/change.yaml", "specgate_change_version: 1\nschema: layered\ncreated: 2026-11-23\nrigor: lite\n");
  w(
    dir,
    "docs/specs/changes/draft-avisos/specs/avisos/spec.md",
    [
      "# Delta — avisos",
      "",
      "## MODIFIED Requirements",
      "",
      "### Requirement: REQ-030 — Warn the customer",
      "",
      "The system SHALL warn the customer of a late order, and of a cancelled one.",
      "",
      "#### Scenario: SCN-030a — Late",
      "",
      "- GIVEN a late order",
      "- WHEN the day ends",
      "- THEN the customer is warned",
      "",
      "#### Scenario: SCN-030b — Cancelled",
      "",
      "- GIVEN a cancelled order",
      "- WHEN it is cancelled",
      "- THEN the customer is warned",
      "",
    ].join("\n")
  );
  const r = sg(dir, "matrix", "--migrate", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(read(dir, "spec.md"), /REQ-030/);
  const note = JSON.parse(r.stdout).status.find((s: { code: string }) => s.code === "matrix_rows_in_changes");
  assert.ok(note && /draft-avisos/.test(note.message), r.stdout);
});
