"use strict";

/**
 * REQ-310..315, REQ-319 (ADR-0043) — the roles of a project, an approval per
 * layer by the role that owns it, a quorum, the record of who approved which
 * version, a changed layer approved again, and the harness waiting for them.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const approvals = () => require("../../scripts/lib/approvals");
const domain = () => require("../../packages/core/src/domain/Approvals");

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
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** Act as this person: the repository's own identity, as CI has no global one. */
function as(dir: string, email: string, name = email.split("@")[0]) {
  git(dir, "config", "user.email", email);
  git(dir, "config", "user.name", name);
}

const CHANGE = "docs/specs/changes/draft-fleet";

const DISCOVER = [
  "# Discover: draft-fleet",
  "",
  "> Owner: product — what the business needs and why.",
  "",
  "## Context",
  "",
  "Dispatchers keep the fleet on paper.",
  "",
  "## Use case",
  "",
  "1. The dispatcher registers a truck.",
  "",
  "## Acceptance criteria",
  "",
  "- AC-1: A registered truck is in the fleet list.",
  "",
].join("\n");

const DESIGN = [
  "# Design: draft-fleet",
  "",
  "> Owner: architect — how the system meets the Discover.",
  "",
  "## Mechanisms",
  "",
  "- AC-1 — the fleet module stores the truck and lists it.",
  "",
].join("\n");

const TASKS = [
  "# Tasks",
  "",
  "> Owner: developer — each task names its requirement.",
  "",
  "## 1. Specification",
  "",
  "- [x] 1.1 Write the delta spec",
  "",
  "## 2. Implementation",
  "",
  "- [ ] 2.1 REQ-002 — register a truck",
  "",
].join("\n");

const DELTA = [
  "# Delta — fleet",
  "",
  "## ADDED Requirements",
  "",
  "### Requirement: REQ-002 — Register a truck",
  "",
  "The system SHALL let the dispatcher register a truck with its plate.",
  "",
  "#### Scenario: SCN-002 — A truck is registered",
  "",
  '- GIVEN no truck with plate "1234-BCD"',
  '- WHEN the dispatcher registers plate "1234-BCD"',
  '- THEN the fleet lists "1234-BCD"',
  "",
  "<!-- specgate:trace actor=Dispatcher kind=functional -->",
  "",
].join("\n");

/** Write the open layered change draft-fleet into `dir`. */
function layeredChange(dir: string) {
  w(
    dir,
    `${CHANGE}/change.yaml`,
    "specgate_change_version: 1\nschema: layered\nreq_range: [REQ-002, REQ-004]\n"
  );
  w(dir, `${CHANGE}/discover.md`, DISCOVER);
  w(dir, `${CHANGE}/design.md`, DESIGN);
  w(dir, `${CHANGE}/tasks.md`, TASKS);
  w(dir, `${CHANGE}/specs/fleet/spec.md`, DELTA);
}

/** A bare project holding the change, a git repository, and `config` as its harness config. */
function project(config: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-approvals-"));
  madeDirs.push(dir);
  w(dir, "spec.md", "# Spec\n\n## Requirements\n");
  w(dir, "docs/specs/traceability.md", "# Traceability\n");
  w(dir, "harness.config.yaml", ["harness_version: 1", ...config, ""].join("\n"));
  layeredChange(dir);
  git(dir, "init", "-q");
  as(dir, "t@t", "t");
  return dir;
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}
const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;

const ROLES = [
  "roles:",
  "  product: [ana@acme.eu]",
  "  architect: [carlos@acme.eu, dora@acme.eu]",
  "  developer: [eva@acme.eu]",
];

test("REQ-310 SCN-310a: Ana holds the product role", () => {
  const settings = domain().readApprovalSettings({
    roles: { product: ["ana@acme.eu"], architect: ["carlos@acme.eu"] },
  });
  const held = domain().rolesHeld(settings, { name: "Ana", email: "ANA@acme.eu" });
  assert.ok(held.includes("product"), String(held));
  assert.ok(held.includes("developer"), "nobody is named for developer: anyone holds it");
  assert.ok(!held.includes("architect"), String(held));

  // Read from the project, with the identity git has there.
  const dir = project(["roles:", "  product: [ana@acme.eu]", "  architect: [carlos@acme.eu]"]);
  as(dir, "ana@acme.eu", "Ana");
  const fromDisk = approvals().approvalSettings(dir);
  assert.deepEqual(fromDisk.roles.product, ["ana@acme.eu"]);
  assert.equal(approvals().gitIdentity(dir).email, "ana@acme.eu");
});

test("REQ-311 SCN-311a: the architect cannot approve the business story", () => {
  const dir = project(ROLES);
  as(dir, "carlos@acme.eu", "Carlos");
  const refused = cli(dir, "change", "approve", "draft-fleet", "--layer", "discover", "--json");
  assert.notEqual(refused.status, 0);
  assert.match(out(refused), /approve_not_owner/);
  assert.match(out(refused), /product/);
  const ok = cli(dir, "change", "approve", "draft-fleet", "--layer", "design", "--json");
  assert.equal(ok.status, 0, out(ok));
  const states = approvals().changeApprovals(dir, "draft-fleet");
  const design = states.layers.find((l: { layer: string }) => l.layer === "design");
  assert.equal(design.approved, true);
  assert.equal(states.approved, false, "the Discover and the Tasks still wait");
});

test("REQ-312 SCN-312a: two architects for the design", () => {
  const dir = project([...ROLES, "approvals:", "  quorum:", "    design: 2"]);
  as(dir, "carlos@acme.eu", "Carlos");
  assert.equal(cli(dir, "change", "approve", "draft-fleet", "--layer", "design").status, 0);
  assert.equal(cli(dir, "change", "approve", "draft-fleet", "--layer", "design").status, 0);
  let design = approvals()
    .changeApprovals(dir, "draft-fleet")
    .layers.find((l: { layer: string }) => l.layer === "design");
  assert.equal(design.approved, false, "the same person twice counts once");
  assert.equal(design.quorum, 2);
  assert.equal(design.approvals.length, 1);
  as(dir, "dora@acme.eu", "Dora");
  assert.equal(cli(dir, "change", "approve", "draft-fleet", "--layer", "design").status, 0);
  design = approvals()
    .changeApprovals(dir, "draft-fleet")
    .layers.find((l: { layer: string }) => l.layer === "design");
  assert.equal(design.approved, true);
});

/** Approve the three layers, each by its owner. */
function approveAll(dir: string) {
  for (const [who, layer] of [
    ["ana@acme.eu", "discover"],
    ["carlos@acme.eu", "design"],
    ["eva@acme.eu", "tasks"],
  ]) {
    as(dir, who);
    const r = cli(dir, "change", "approve", "draft-fleet", "--layer", layer);
    assert.equal(r.status, 0, out(r));
  }
}

test("REQ-313 SCN-313a: the audit after the change is closed", () => {
  const dir = project(ROLES);
  approveAll(dir);
  const record = JSON.parse(read(dir, `${CHANGE}/approvals.json`));
  assert.equal(record.length, 3);
  const today = new Date().toISOString().slice(0, 10);
  for (const a of record) {
    assert.ok(["discover", "design", "tasks"].includes(a.layer));
    assert.match(a.by.email, /@acme\.eu$/);
    assert.ok(a.by.name);
    assert.ok(a.role);
    assert.match(a.hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(a.at, today);
  }
  const discover = record.find((a: { layer: string }) => a.layer === "discover");
  assert.equal(discover.role, "product");
  assert.equal(discover.hash, domain().contentHash(DISCOVER));
  assert.equal(approvals().changeApprovals(dir, "draft-fleet").approved, true);
  assert.match(read(dir, `${CHANGE}/change.yaml`), new RegExp(`^approved: ${today}$`, "m"));
});

test("REQ-314 SCN-314a: the design is rewritten after its approval", () => {
  const dir = project(ROLES);
  approveAll(dir);
  w(dir, `${CHANGE}/design.md`, `${DESIGN}\n- AC-1 — and it is kept in PostgreSQL.\n`);
  const states = approvals().changeApprovals(dir, "draft-fleet");
  const byLayer = (id: string) => states.layers.find((l: { layer: string }) => l.layer === id);
  assert.equal(byLayer("design").approved, false);
  assert.equal(byLayer("design").stale.length, 1);
  assert.equal(byLayer("discover").approved, true);
  assert.equal(states.approved, false);
  const { approvedOn } = require("../../scripts/lib/change-review");
  assert.equal(approvedOn(dir, "draft-fleet"), "", "the change no longer reads as approved");
});

/** A project `init` wrote, with the open change and a no-op agent. */
function harnessProject(extra: string[]) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-approvals-run-"));
  madeDirs.push(parent);
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  if (extra.length) fs.appendFileSync(path.join(dir, "harness.config.yaml"), extra.join("\n"));
  layeredChange(dir);
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(agent, "// writes nothing\n");
  git(dir, "init", "-q");
  as(dir, "t@t", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { dir, agent };
}

function run(dir: string, agent: string) {
  return cli(
    dir,
    "harness",
    "run",
    "--req",
    "REQ-002",
    "--agent",
    `node "${agent}" {prompt_file}`,
    "--max-attempts",
    "1",
    "--setup-cmd",
    "none",
    "--skip-baseline",
    "--format",
    "json"
  );
}

test("REQ-315 SCN-315a: a 1.0 change nobody approved", () => {
  const blocked = harnessProject([]);
  const r = run(blocked.dir, blocked.agent);
  assert.match(out(r), /harness_not_approved/, out(r));
  assert.match(out(r), /specgate change approve draft-fleet/);
  assert.doesNotMatch(out(r), /attempt 1\/1/, "no agent ran");

  const off = harnessProject(["approvals:", "  required: never", ""]);
  const r2 = run(off.dir, off.agent);
  assert.doesNotMatch(out(r2), /harness_not_approved/, out(r2));
  assert.match(out(r2), /attempt 1\/1/, "the agent was given the requirement");
});

test("REQ-319 SCN-319a: Ana approves the Discover from the studio", () => {
  const dir = project(ROLES);
  as(dir, "ana@acme.eu", "Ana");
  const studio = require("../../scripts/lib/studio-app");
  const draft = studio.drafts(dir).find((d: { change: string }) => d.change === "draft-fleet");
  assert.ok(draft, "the draft is in Review");
  const discover = draft.layers.find((l: { id: string }) => l.id === "discover");
  assert.equal(discover.mine, true, "the viewer owns the Discover");
  assert.equal(discover.approved, false);
  assert.equal(discover.quorum, 1);
  const design = draft.layers.find((l: { id: string }) => l.id === "design");
  assert.equal(design.mine, false);

  const r = approvals().approveLayers(dir, "draft-fleet", ["discover"], "2026-10-29");
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = studio.drafts(dir).find((d: { change: string }) => d.change === "draft-fleet");
  const approved = after.layers.find((l: { id: string }) => l.id === "discover");
  assert.equal(approved.approved, true);
  assert.equal(approved.approvals[0].by.email, "ana@acme.eu");
});
