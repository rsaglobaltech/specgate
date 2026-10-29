"use strict";

/**
 * The change workflow says the same thing at every step (microservices run 1
 * of 1.0.0-rc.1): init --yes adopts, validate reports what approve refuses,
 * a shared feature file is caught, a delivered requirement ticks its tasks.
 * REQ-249, REQ-350..REQ-354.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "specgate-rc2-"): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

function run(cwd: string, ...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_PROFILE: "" },
  });
}

const out = (r: CliResult) => `${r.stdout}${r.stderr}`;
const json = (r: CliResult) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
const codes = (r: CliResult) =>
  (json(r).items || []).flatMap((i: { issues?: { code: string }[] }) =>
    (i.issues || []).map((d) => d.code)
  );
const messages = (r: CliResult) =>
  (json(r).items || [])
    .flatMap((i: { issues?: { message: string }[] }) => (i.issues || []).map((d) => d.message))
    .join(" | ");
const put = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};

/** A project with one layered change `follow`, its delta as given. */
function project(delta: string, tasks?: string): { root: string; dir: string } {
  const root = tmp();
  put(path.join(root, "spec.md"), "# Spec\n");
  put(
    path.join(root, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n"
  );
  const r = run(root, "change", "new", "follow", "--capability", "tracking", "--json");
  assert.equal(r.status, 0, out(r));
  const dir = path.join(root, "docs", "specs", "changes", "follow");
  put(path.join(dir, "specs", "tracking", "spec.md"), delta);
  put(
    path.join(dir, "discover.md"),
    "# Discover: follow\n\n> Owner: product\n\n## Context\n\nClients call to ask where their parcel is.\n\n## Use case\n\nThe client opens the panel.\n\n## Acceptance criteria\n\n- AC-1: The client sees the truck.\n"
  );
  put(
    path.join(dir, "design.md"),
    "# Design\n\n> Owner: architect\n\n## Modules\n\nAC-1 — a map.\n"
  );
  if (tasks !== undefined) put(path.join(dir, "tasks.md"), tasks);
  return { root, dir };
}

const requirement = (id: string, trace: string, scn = `SCN-${id.slice(4)}`) => `
### Requirement: ${id} — The client sees the truck ${id}

The system SHALL show the client the truck carrying their shipment (${id}).

#### Scenario: ${scn} — A client opens the panel

- GIVEN a shipment on a truck
- WHEN the client opens the panel
- THEN they see the truck

<!-- specgate:trace ${trace} -->
`;

const delta = (...reqs: string[]) =>
  `# Delta — tracking\n\n## ADDED Requirements\n${reqs.join("")}`;

// ── REQ-249 ──────────────────────────────────────────────────────────────────

test("REQ-249 SCN-249a: a package.json and --yes", () => {
  const dir = tmp();
  put(path.join(dir, "package.json"), '{"name":"contracts"}');
  const r = run(dir, "init", "--yes", "--no-git", "--dry-run");
  assert.equal(r.status, 0, out(r));
  assert.match(out(r), /adopting this repository in place/);
  assert.equal(fs.existsSync(path.join(dir, "my-spec-driven-app")), false, out(r));
});

test("REQ-249 SCN-249b: --new still scaffolds", () => {
  const dir = tmp();
  put(path.join(dir, "package.json"), '{"name":"contracts"}');
  const r = run(dir, "init", "--yes", "--new", "--no-git", "--dry-run");
  assert.equal(r.status, 0, out(r));
  assert.doesNotMatch(out(r), /adopting this repository in place/);
});

// ── REQ-350 ──────────────────────────────────────────────────────────────────

test("REQ-350 SCN-350a: a requirement with no kind", () => {
  const { root } = project(
    delta(requirement("REQ-001", "actor=Client feature=features/tracking/REQ-001.feature"))
  );
  const r = run(root, "change", "validate", "follow", "--json");
  assert.equal(r.status, 1, out(r));
  assert.ok(codes(r).includes("change_not_approvable"), out(r));
  assert.match(messages(r), /no kind/);
  // The same refusal approve gives.
  const a = run(root, "change", "approve", "follow");
  assert.notEqual(a.status, 0, out(a));
});

test("REQ-350: a layered change approval would accept validates", () => {
  const { root } = project(
    delta(
      requirement(
        "REQ-001",
        "actor=Client kind=functional feature=features/tracking/REQ-001.feature"
      )
    )
  );
  const r = run(root, "change", "validate", "follow", "--json");
  assert.ok(!codes(r).includes("change_not_approvable"), out(r));
});

// ── REQ-351 ──────────────────────────────────────────────────────────────────

test("REQ-351 SCN-351a: the instructions for the specs of a layered change", () => {
  const { root } = project(delta(requirement("REQ-001", "kind=functional actor=Client")));
  const r = run(root, "change", "instructions", "specs", "follow", "--json");
  assert.equal(r.status, 0, out(r));
  const rules = JSON.stringify(json(r));
  assert.match(rules, /kind=/);
  assert.match(rules, /actor=/);
  assert.match(rules, /feature file of its own|one feature file per requirement/i);
});

// ── REQ-352 ──────────────────────────────────────────────────────────────────

test("REQ-352 SCN-352a: three requirements, one feature file", () => {
  const shared = "kind=functional actor=Client feature=features/x/follow.feature";
  const { root } = project(delta(requirement("REQ-002", shared), requirement("REQ-003", shared)));
  const r = run(root, "change", "validate", "follow", "--json");
  assert.equal(r.status, 1, out(r));
  assert.ok(codes(r).includes("change_feature_shared"), out(r));
  const said = messages(r);
  assert.match(said, /REQ-002/);
  assert.match(said, /REQ-003/);
  assert.match(said, /features\/x\/follow\.feature/);
});

// ── REQ-353 ──────────────────────────────────────────────────────────────────

test("REQ-353 SCN-353a: the harness delivered REQ-002", () => {
  const { root, dir } = project(
    delta(
      requirement(
        "REQ-002",
        "kind=functional actor=Client feature=features/tracking/REQ-002.feature test=test/panel.test.js"
      )
    ),
    "# Tasks\n\n> Owner: developer\n\n## 2. Implementation\n\n- [ ] 2.1 Build the panel (REQ-002)\n- [ ] 2.2 Docs\n"
  );
  put(path.join(root, "test", "panel.test.js"), "// REQ-002 SCN-002\n");
  const r = run(root, "done", "REQ-002", "--no-check");
  assert.equal(r.status, 0, out(r));
  const tasks = fs.readFileSync(path.join(dir, "tasks.md"), "utf8");
  assert.match(tasks, /- \[x\] 2\.1 Build the panel \(REQ-002\)/, tasks);
  assert.match(tasks, /- \[ \] 2\.2 Docs/, tasks);
});

// ── REQ-354 ──────────────────────────────────────────────────────────────────

test("REQ-354 SCN-354a: the help of change new", () => {
  const r = run(tmp(), "change", "--help");
  const line = out(r)
    .split("\n")
    // NO_COLOR is set: the help carries no colour codes.
    .find((l) => /^\s*new <id>/.test(l));
  assert.ok(line, out(r));
  assert.match(line, /discover/);
  assert.match(line, /design/);
  assert.match(line, /tasks/);
  assert.doesNotMatch(line, /proposal/);
});
