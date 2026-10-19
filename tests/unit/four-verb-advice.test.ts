"use strict";

/**
 * ADR-0035: the advice the CLI prints names the four verbs — propose, apply,
 * archive, status. The old names (`draft`, `done`, `change new`,
 * `change archive`) still work; they are just no longer what it tells you to
 * run next.
 */

import { test } from "node:test";
import type { TestContext } from "node:test";
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import { spawnSync } from "node:child_process";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { hintFor } = require("../../scripts/plan");
const { STAGES, DELTA_RULES } = require("../../scripts/change/instructions");

const BRIEF = `---
product: Court bookings
surfaces: [api, web]
actors:
  - { name: Member, surfaces: [api, web] }
modules: [bookings, coupons]
---

# Brief

Members book a court for one hour.
`;

function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-verbs-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "brief.md"), BRIEF);
  const cli = (...a: string[]) =>
    spawnSync(process.execPath, [CLI, ...a], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  return { dir, cli };
}

test("propose --from-brief names propose --from-brief as the next step, not draft", (t: TestContext) => {
  const { cli } = project(t);
  const list = cli("propose", "--from-brief");
  assert.equal(list.status, 0, list.stdout + list.stderr);
  assert.match(list.stdout, /specgate propose --from-brief bookings/);
  assert.doesNotMatch(list.stdout, /specgate draft/);
  const json = JSON.parse(cli("propose", "--from-brief", "--json").stdout);
  assert.equal(json.draft.next, "specgate propose --from-brief bookings");

  const open = cli("propose", "--from-brief", "bookings");
  assert.equal(open.status, 0, open.stdout + open.stderr);
  assert.doesNotMatch(open.stdout, /specgate draft/);
  assert.match(open.stdout, /specgate propose --from-brief bookings/);
});

test("plan's hint for a requirement ready to close names apply", () => {
  const hint = hintFor({ requirement: "REQ-007", category: "NEEDS_STATUS_UPDATE" });
  assert.match(hint, /specgate apply REQ-007/);
  assert.doesNotMatch(hint, /specgate done/);
});

test("change instructions point at apply and archive, not done and change archive", () => {
  const text = JSON.stringify({ STAGES, DELTA_RULES });
  assert.doesNotMatch(text, /specgate done/);
  assert.doesNotMatch(text, /specgate change archive/);
  assert.match(text, /specgate apply REQ-NNN/);
  assert.match(text, /specgate archive <id>/);
});
