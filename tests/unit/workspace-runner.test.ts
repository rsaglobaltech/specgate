"use strict";

/**
 * Browser tests in a workspace (change `workspace-runner`): the evidence keeps
 * what the runner wrote in the workspace's test-results/ (REQ-809), and
 * doctor sees the workspace's runner and its Playwright config (REQ-810).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli, json } from "../helpers/cli";
const { workspaceDirs } = require("../../scripts/lib/workspaces");

/** An adopted monorepo, `apps/*` a workspace, whose gate requires its scenarios. */
function project(t: TestContext, bddCmd: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-workspace-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "apps", "web"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"d","version":"1.0.0","workspaces":["apps/*","packages/*"]}'
  );
  fs.writeFileSync(path.join(dir, "apps", "web", "package.json"), '{"name":"web"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  const gate = path.join(dir, ".specgate", "gate.yaml");
  const policy = fs.existsSync(gate) ? fs.readFileSync(gate, "utf8") : "preset: standard\n";
  fs.writeFileSync(gate, `${policy.replace(/^#?\s*bdd:.*$/m, "").trimEnd()}\nbdd: required\n`);
  assert.equal(cli("config", "set", "bdd_cmd", bddCmd, "--project-dir", dir).status, 0);
  return dir;
}

test("REQ-809: the workspaces are the folders package.json declares that exist", (t: TestContext) => {
  const dir = project(t, "node red.js {tags}");
  assert.deepEqual(workspaceDirs(dir), ["apps/web"]);
  fs.writeFileSync(path.join(dir, "package.json"), '{"workspaces":{"packages":["apps/web"]}}');
  assert.deepEqual(workspaceDirs(dir), ["apps/web"]);
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d"}');
  assert.deepEqual(workspaceDirs(dir), []);
});

test("REQ-809 SCN-809a: the before keeps the screenshot a workspace's runner wrote", (t: TestContext) => {
  const dir = project(t, "node red.js {tags}");
  fs.writeFileSync(
    path.join(dir, "red.js"),
    [
      'const fs = require("fs");',
      'fs.mkdirSync("apps/web/test-results/flow", { recursive: true });',
      'fs.writeFileSync("apps/web/test-results/flow/test-finished-1.png", "png");',
      "process.exit(1);",
    ].join("\n")
  );
  const r = cli("evidence", "before", "REQ-001", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const before = path.join(dir, ".specgate", "evidence", "REQ-001", "before");
  const run = JSON.parse(fs.readFileSync(path.join(before, "run.json"), "utf8"));
  assert.deepEqual(run.artifacts, ["artifacts/apps/web/flow/test-finished-1.png"]);
  assert.ok(
    fs.existsSync(path.join(before, "artifacts", "apps", "web", "flow", "test-finished-1.png"))
  );
});

test("REQ-810 SCN-810a: doctor sees playwright-bdd in a workspace, and its missing screenshots", (t: TestContext) => {
  const dir = project(t, 'npm run test:bdd -- --grep "{tags}"');
  fs.writeFileSync(
    path.join(dir, "apps", "web", "playwright.config.ts"),
    [
      'import { defineBddConfig } from "playwright-bdd";',
      "export default { use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' } };",
    ].join("\n")
  );
  fs.mkdirSync(path.join(dir, "features", "orders"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "features", "orders", "REQ-001.feature"),
    [
      "@REQ-001",
      "Feature: Orders",
      "  @SCN-001a",
      "  Scenario: An order is placed",
      "    Given a cart with one book",
      "    When the customer places the order",
      "    Then the order is confirmed",
      "",
    ].join("\n")
  );
  const status = json(cli("doctor", "--project-dir", dir, "--json")).status;
  const media = status.find((s: { code: string }) => s.code === "doctor_evidence_media");
  assert.ok(media, JSON.stringify(status));
  assert.equal(media.severity, "warning");
  assert.ok(
    !status.some((s: { message?: string }) => /no Gherkin runner/.test(s.message || "")),
    "bdd_cmd runs the scenarios"
  );
});
