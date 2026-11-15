/**
 * REQ-370..372: an approved change survives its own delivery, and a prompt file
 * Windows still holds never fails the command (truck-flote microservices run 2,
 * MS2-8 and MS2-5).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI = path.resolve(__dirname, "..", "..", "bin", "specgate.js");
const domain = () => require("../../packages/core/src/domain/Approvals");
const approvals = () => require("../../scripts/lib/approvals");

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
const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;

const CHANGE = "docs/specs/changes/follow-shipment";

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
  "- [ ] 2.1 REQ-002 — list the client's shipments",
  "- [ ] 2.2 REQ-003 — show the truck's last position",
  "",
].join("\n");

const scenario = (id: string, n: string, title: string) =>
  [
    `### Requirement: ${id} — ${title}`,
    "",
    `The system SHALL let the client ${title.toLowerCase()}.`,
    "",
    `#### Scenario: SCN-${n} — ${title}`,
    "",
    '- GIVEN client "Transportes Norte" has shipment "ENV-1001"',
    '- WHEN the client opens "Mis envíos"',
    '- THEN they see "ENV-1001"',
    "",
    "<!-- specgate:trace actor=Client kind=functional -->",
    "",
  ].join("\n");

/** A project `init` wrote, holding a layered change of two requirements, and a no-op agent. */
function projectWithChange() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-rc3-"));
  madeDirs.push(parent);
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  w(
    dir,
    `${CHANGE}/change.yaml`,
    "specgate_change_version: 1\nschema: layered\nreq_range: [REQ-002, REQ-004]\n"
  );
  w(
    dir,
    `${CHANGE}/discover.md`,
    [
      "# Discover: follow-shipment",
      "",
      "> Owner: product — what the business needs and why.",
      "",
      "## Context",
      "",
      "Clients call the dispatcher to know where their load is.",
      "",
      "## Use case",
      "",
      "1. The client opens their shipments.",
      "",
      "## Acceptance criteria",
      "",
      "- AC-1: The client sees their shipments and where each one is.",
      "",
    ].join("\n")
  );
  w(
    dir,
    `${CHANGE}/design.md`,
    "# Design: follow-shipment\n\n> Owner: architect\n\n## Mechanisms\n\n- AC-1 — a list and a position.\n"
  );
  w(dir, `${CHANGE}/tasks.md`, TASKS);
  w(
    dir,
    `${CHANGE}/specs/shipments/spec.md`,
    [
      "# Delta — shipments",
      "",
      "## ADDED Requirements",
      "",
      scenario("REQ-002", "002", "List their shipments"),
      scenario("REQ-003", "003", "See the truck's last position"),
    ].join("\n")
  );
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(agent, "// writes nothing\n");
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return { dir, agent };
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

/** The harness asked for one requirement, with an agent that writes nothing. */
function harness(dir: string, agent: string, req: string) {
  return cli(
    dir,
    "harness",
    "run",
    "--req",
    req,
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

/** Tick REQ-002's task as delivering it does (REQ-353), and commit it. */
function deliverFirst(dir: string) {
  const file = `${CHANGE}/tasks.md`;
  w(dir, file, read(dir, file).replace("- [ ] 2.1 REQ-002", "- [x] 2.1 REQ-002"));
  git(dir, "commit", "-qam", "REQ-002 delivered");
}

// ── REQ-370 ──────────────────────────────────────────────────────────────────

test("REQ-370 SCN-370a: the second requirement of an approved change", () => {
  const { dir, agent } = projectWithChange();
  const approve = cli(dir, "change", "approve", "follow-shipment");
  assert.equal(approve.status, 0, out(approve));
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "approved");

  deliverFirst(dir);
  assert.equal(approvals().changeApprovals(dir, "follow-shipment").approved, true);
  const r = harness(dir, agent, "REQ-003");
  assert.doesNotMatch(out(r), /harness_not_approved/, out(r));
  assert.match(out(r), /attempt 1\/1/, "the agent was given REQ-003");
});

test("REQ-370 SCN-370b: a task reworded after the approval", () => {
  const { dir, agent } = projectWithChange();
  assert.equal(cli(dir, "change", "approve", "follow-shipment").status, 0);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "approved");

  const file = `${CHANGE}/tasks.md`;
  w(dir, file, read(dir, file).replace("show the truck's last position", "show it on a map"));
  git(dir, "commit", "-qam", "reworded");
  const r = harness(dir, agent, "REQ-003");
  assert.match(out(r), /harness_not_approved/, out(r));
  assert.match(out(r), /tasks/);
});

test("REQ-370: a tick, in either case, is not a change of the layer", () => {
  const { contentHash } = domain();
  const open = "- [ ] 2.1 REQ-002 — list\n";
  assert.equal(contentHash("- [x] 2.1 REQ-002 — list\n"), contentHash(open));
  assert.equal(contentHash("- [X] 2.1 REQ-002 — list\n"), contentHash(open));
  assert.notEqual(contentHash("- [ ] 2.1 REQ-002 — list them\n"), contentHash(open));
});

// ── REQ-371 ──────────────────────────────────────────────────────────────────

test("REQ-371 SCN-371a: a record written by 1.0.0-rc.2", () => {
  const { layerApprovals } = domain();
  const text = TASKS.replace("- [ ] 2.1 REQ-002", "- [x] 2.1 REQ-002");
  // rc.1 and rc.2 hashed the text as written.
  const asWritten = `sha256:${require("node:crypto")
    .createHash("sha256")
    .update(text)
    .digest("hex")}`;
  const settings = { roles: {}, quorum: {}, required: "layered" };
  const [tasks] = layerApprovals(
    [{ id: "tasks", owner: "developer", file: "tasks.md", text }],
    [
      {
        layer: "tasks",
        by: { name: "t", email: "t@t" },
        role: "developer",
        hash: asWritten,
        at: "2026-10-29",
      },
    ],
    settings
  );
  assert.equal(tasks.approved, true);
});

// ── REQ-372 ──────────────────────────────────────────────────────────────────

const busy = () => Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });

test("REQ-372 SCN-372a: Windows still holds the prompt file", () => {
  const { removeTempFile } = require("../../scripts/lib/temp-file");
  let calls = 0;
  const left = removeTempFile("prompt.md", {
    rm: () => {
      calls += 1;
      if (calls < 3) throw busy();
    },
    wait: () => {},
  });
  assert.equal(calls, 3);
  assert.equal(left, false, "removed on the third try");
});

test("REQ-372 SCN-372b: the file stays held", () => {
  const { removeTempFile } = require("../../scripts/lib/temp-file");
  let calls = 0;
  const left = removeTempFile("prompt.md", {
    rm: () => {
      calls += 1;
      throw busy();
    },
    wait: () => {},
  });
  assert.ok(calls > 1, "retried");
  assert.equal(left, true, "left for the system, nothing thrown");
  // Any other error is not a held file: it is thrown as before.
  assert.throws(() =>
    removeTempFile("prompt.md", {
      rm: () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      },
      wait: () => {},
    })
  );
});
