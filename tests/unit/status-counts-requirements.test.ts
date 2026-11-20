/**
 * REQ-615: `status` counts requirements, not matrix rows. One requirement with
 * two scenarios read "0 of 2 done" and stood twice under To do (trial projects,
 * 2026-11-20).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  onePerRequirement,
  requirementProgress,
} from "../../scripts/cli/commands/spec/StatusCommand";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(dir: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function twoScenarios(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-statuscount-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", scripts: { test: "node --test" } })
  );
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.js"), "exports.a = 1;\n");
  assert.equal(run(dir, "adopt").status, 0);
  assert.equal(run(dir, "new", "Large orders get a discount").status, 0);
  const feature = fs
    .readdirSync(path.join(dir, "features"))
    .filter((f) => f.endsWith(".feature"))
    .map((f) => path.join(dir, "features", f))[0];
  fs.writeFileSync(
    feature,
    [
      "Feature: Large orders get a discount",
      "",
      "  @REQ-002 @SCN-002",
      "  Scenario: At the threshold",
      "    Given an order of 100.00",
      "    When its total is computed",
      "    Then it is discounted",
      "",
      "  @REQ-002 @SCN-003",
      "  Scenario: Below the threshold",
      "    Given an order of 99.99",
      "    When its total is computed",
      "    Then it is not discounted",
      "",
    ].join("\n")
  );
  assert.equal(run(dir, "matrix").status, 0);
  return dir;
}

const row = (requirement: string, category: string) =>
  ({ requirement, category }) as Parameters<typeof requirementProgress>[0][number];

test("REQ-615 SCN-615a: one requirement with two scenarios is one requirement", () => {
  const dir = twoScenarios();
  const status = run(dir, "status");
  assert.equal(status.status, 0, status.out);
  assert.match(status.out, /0 of 1 done/);
  assert.equal(status.out.match(/REQ-002\s+Large orders/g)?.length, 1, status.out);
});

test("REQ-615 SCN-615b: done only when every scenario of it is", () => {
  const items = [
    row("REQ-002", "DONE"),
    row("REQ-002", "NEEDS_TEST"),
    row("REQ-003", "DONE"),
    row("REQ-003", "DONE"),
  ];
  assert.deepEqual(requirementProgress(items), { done: 1, total: 2 });
  assert.deepEqual(requirementProgress([]), { done: 0, total: 0 });
  assert.deepEqual(
    onePerRequirement(items).map((it) => `${it.requirement}:${it.category}`),
    ["REQ-002:DONE", "REQ-003:DONE"]
  );
});

test("REQ-615 SCN-615c: --json keeps one entry per scenario", () => {
  const dir = twoScenarios();
  const json = JSON.parse(run(dir, "status", "--json").out);
  const mine = json.requirements.filter((r: { id: string }) => r.id === "REQ-002");
  assert.equal(mine.length, 2);
});
