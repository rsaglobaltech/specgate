"use strict";

/**
 * REQ-177 — An open draft can reserve more ids while its range is the last.
 *
 * A draft reserves ten requirement ids. A module that needed more had no way
 * to grow: in an adopter's project the agents folded new behaviour into
 * requirements that already existed to stay inside the range.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const BRIEF = `---
product: Court bookings
surfaces: [api, web]
actors:
  - { name: Member, surfaces: [api, web] }
modules: [bookings, coupons]
---

# Brief

Members book a court for one hour. A court cannot be booked twice for the same hour.
`;

function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-reserve-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "brief.md"), BRIEF);
  const cli = (...a: string[]): CliResult =>
    spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: "utf8" });
  return { dir, cli };
}

const read = (dir: string, m: string, file: string) =>
  fs.readFileSync(path.join(dir, "docs", "specs", "changes", `draft-${m}`, file), "utf8");

test("REQ-177 SCN-177a: the last draft grows its range with --reserve", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  assert.match(read(dir, "bookings", "change.yaml"), /req_range: \[REQ-001, REQ-010\]/);

  const r = cli("draft", "bookings", "--reserve", "15");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /REQ-001…REQ-015/);
  const yaml = read(dir, "bookings", "change.yaml");
  assert.match(yaml, /req_range: \[REQ-001, REQ-015\]/);
  assert.match(yaml, /scn_range: \[SCN-001, SCN-045\]/);
  assert.match(read(dir, "bookings", "DRAFTING.md"), /REQ-015/);
  assert.match(read(dir, "bookings", "DRAFTING.md"), /SCN-045/);

  // The next draft starts after the grown range.
  assert.equal(cli("draft", "coupons").status, 0);
  assert.match(read(dir, "coupons", "change.yaml"), /req_range: \[REQ-016, REQ-025\]/);
});

test("REQ-177 SCN-177b: a draft whose ids are followed by another's cannot grow", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  assert.equal(cli("draft", "coupons").status, 0);
  const before = read(dir, "bookings", "change.yaml");

  const r = cli("draft", "bookings", "--reserve", "15");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /draft_range_not_last/);
  assert.match(r.stdout + r.stderr, /REQ-011/);
  assert.equal(read(dir, "bookings", "change.yaml"), before);
});

test("REQ-177 SCN-177c: --reserve below what the draft holds is refused", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const r = cli("draft", "bookings", "--reserve", "5");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /already holds 10/);
  assert.match(read(dir, "bookings", "change.yaml"), /req_range: \[REQ-001, REQ-010\]/);
});
