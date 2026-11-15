/**
 * REQ-562 — a 1.0 change's layers in the redesigned studio: each owner, its
 * approvals against the quorum, and Approve on the layers the viewer holds the
 * role for; in a team's studio the viewer is the sign-in proxy's user
 * (change studio-layers).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import { spawnSync } from "node:child_process";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const studio = require(path.join(ROOT_DIR, "dist", "studio-test", "studio.cjs"));
const { drafts } = require("../../scripts/lib/studio-app");
const { approveChange } = require("../../scripts/lib/change-review");
const { changeApprovals } = require("../../scripts/lib/approvals");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const layer = (id: string, owner: string, extra: Record<string, unknown> = {}) => ({
  id,
  owner,
  written: true,
  approvals: [],
  quorum: 1,
  approved: false,
  mine: false,
  ...extra,
});

test("REQ-562: the layers card — owner, quorum, who approved, Approve where the viewer owns it", () => {
  const html: string = studio.renderChanges(
    "en",
    {
      brief: true,
      modules: [
        {
          key: "orders",
          stage: "review",
          requirements: 1,
          scenarios: 1,
          questions: 0,
          findings: [],
          progress: null,
        },
      ],
      job: null,
      step: "",
    },
    [
      {
        change: "draft-orders",
        module: "orders",
        requirements: [
          { id: "REQ-002", title: "T", statement: "S", status: "Draft", scenarios: [] },
        ],
        blockers: [],
        notes: [],
        questions: [],
        layers: [
          layer("discover", "product", { mine: true }),
          layer("design", "architect", {
            approved: true,
            approvals: [{ by: { name: "Ana", email: "ana@acme.eu" }, role: "architect", at: "x" }],
          }),
          layer("tasks", "developer", { written: false }),
        ],
      },
    ]
  );
  assert.match(html, /Layers — each approved by whoever holds its role/);
  assert.match(html, /<strong>Discover<\/strong>/);
  assert.match(html, />Approve Discover</);
  assert.match(html, /architect's · 1 of 1 approvals · Ana/);
  assert.doesNotMatch(html, />Approve Design</, "approved already, and not the viewer's");
  assert.doesNotMatch(html, /<strong>Tasks<\/strong>/, "a layer not written is not offered");
});

test("REQ-562 SCN-562a: in a team, the proxy's user approves the layer of their role", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-layers-"));
  made.push(parent);
  const init = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    "harness_version: 1\nroles:\n  product: [luis@acme.eu]\n"
  );
  assert.equal(
    spawnSync(process.execPath, [CLI, "propose", "pdf-invoices"], { cwd: dir, encoding: "utf8" })
      .status,
    0
  );
  const change = path.join(dir, "docs/specs/changes/pdf-invoices");
  fs.writeFileSync(
    path.join(change, "discover.md"),
    "# Discover: pdf-invoices\n\n## Context\n\nCustomers ask for copies.\n\n## Use case\n\nA customer downloads one.\n\n## Acceptance criteria\n\n- AC-1: A paid invoice downloads.\n"
  );
  fs.writeFileSync(
    path.join(change, "specs/pdf-invoices/spec.md"),
    "# Delta — pdf-invoices\n\n## ADDED Requirements\n\n### Requirement: REQ-001 — A paid invoice downloads\n\nThe system SHALL let a customer download a paid invoice.\n\n" +
      "#### Scenario: SCN-001a — A paid one\n\n- GIVEN a paid invoice\n- WHEN its owner downloads it\n- THEN a PDF is returned\n\n<!-- specgate:trace actor=Customer kind=functional -->\n"
  );
  const luis = { name: "luis", email: "luis@acme.eu" };
  const ana = { name: "ana", email: "ana@acme.eu" };
  const discoverOf = (who: { name: string; email: string }) =>
    drafts(dir, who)[0].layers.find((l: { id: string }) => l.id === "discover");
  assert.equal(discoverOf(luis).mine, true, "luis holds product");
  assert.equal(discoverOf(ana).mine, false);

  const refused = approveChange(dir, "pdf-invoices", "2026-11-15", "discover", ana);
  assert.equal(refused.ok, false, JSON.stringify(refused));
  const done = approveChange(dir, "pdf-invoices", "2026-11-15", "discover", luis);
  assert.equal(done.ok, true, JSON.stringify(done));
  // Approved, the change may leave the list of drafts: read the record itself.
  const approvals = changeApprovals(dir, "pdf-invoices").layers.find(
    (l: { layer: string }) => l.layer === "discover"
  ).approvals;
  assert.deepEqual(
    approvals.map((a: { by: { email: string } }) => a.by.email),
    ["luis@acme.eu"],
    "recorded as the proxy's user, not the machine's git identity"
  );
});
