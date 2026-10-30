/**
 * After the fifth microservices run of 1.0.0-rc.5 (REQ-390, REQ-391): the
 * architect who decides what a requirement needs from another repository
 * writes it into the requirement's trace, and the guidance a design quotes is
 * not taken for a reference.
 *
 * Every test builds real folders in a temp directory and drives the CLI.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
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
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "specgate-rc6-"): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

function sg(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_PROFILE: "" },
  });
}

const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;
const put = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};

const DISCOVER = `# Discover: panel

> Owner: product

## Context

Dispatchers lose time finding their trucks.

## Use case

A dispatcher opens the panel and sees every truck.

## Acceptance criteria

- AC-1: The dispatcher sees where every truck is.
`;

const DELTA = [
  "# Delta — panel",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-002 — Fleet positions on the panel",
  "",
  "The system SHALL show the dispatcher where every truck is.",
  "",
  "#### Scenario: SCN-002 — The panel opens",
  "",
  "- GIVEN trucks TRK-1 and TRK-2 have reported",
  "- WHEN the dispatcher opens the panel",
  "- THEN they see TRK-1 and TRK-2 on the map",
  "",
  "<!-- specgate:trace kind=functional actor=Dispatcher feature=features/panel/REQ-002.feature -->",
  "",
].join("\n");

/** A project with a layered change `panel`, its design as given. */
function change(design: string) {
  const root = tmp();
  put(path.join(root, "spec.md"), "# Spec\n");
  put(
    path.join(root, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n"
  );
  const r = sg(root, ["change", "new", "panel", "--capability", "panel", "--project-dir", root]);
  assert.equal(r.status, 0, out(r));
  const dir = path.join(root, "docs", "specs", "changes", "panel");
  put(path.join(dir, "discover.md"), DISCOVER);
  if (design) put(path.join(dir, "design.md"), design);
  put(path.join(dir, "specs", "panel", "spec.md"), DELTA);
  return root;
}

// ── REQ-390: the design's dependencies go into the traces ───────────────────

test("REQ-390 SCN-390a: the architect is told to carry a dependency into the trace", () => {
  const root = change("");
  const r = sg(root, ["change", "instructions", "design", "panel", "--project-dir", root, "--json"]);
  assert.equal(r.status, 0, out(r));
  const doc = JSON.parse(r.stdout);
  const rules: string[] = doc.instructions.rules;
  const rule = rules.find((x) => /depends=/.test(x) && /api=/.test(x));
  assert.ok(rule, JSON.stringify(rules));
  assert.match(rule, /specgate:trace/);
  assert.match(rule, /specs\//);
  assert.match(rule, /layer_design_dependency_untraced/);
});

// ── REQ-391: a quoted placeholder is guidance ───────────────────────────────

function untraced(root: string) {
  const r = sg(root, ["change", "validate", "panel", "--json", "--project-dir", root]);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return (j.items || [])
    .flatMap((i: { issues?: unknown[] }) => i.issues || [])
    .filter((d: { code: string }) => d.code === "layer_design_dependency_untraced");
}

test("REQ-391 SCN-391a: an operation placeholder after a real file is no reference", () => {
  const root = change(`# Design: panel

> Owner: architect

## Modules

- AC-1 — the panel reads the fleet. Each requirement cites its operation as
  \`api=contracts/fleet-tracking.openapi.yaml#<operationId>\`.
`);
  assert.deepEqual(untraced(root), []);
});
