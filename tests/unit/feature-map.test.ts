/**
 * feature-map (trust curve, phase 1): a map of where each requirement lives
 * (REQ-678); the agent told where it lives in the app (REQ-679); apply keeps
 * the evidence of each delivery (REQ-680).
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
const { buildPrompt } = require(path.join(ROOT_DIR, "dist", "scripts", "harness", "prompt.js"));

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

/** An `init` project with REQ-031 in spec.md (its trace as given), an app at localhost:5173. */
function project(trace: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-map-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  const made = sg(dir, "init");
  assert.equal(made.status, 0, made.stdout + made.stderr);
  fs.appendFileSync(
    path.join(dir, "spec.md"),
    `\n## REQ-031 — Cancel an order\n\n<!-- specgate:trace ${trace} -->\n\nThe system SHALL let the customer cancel an order not shipped yet.\n`
  );
  const config = path.join(dir, "harness.config.yaml");
  fs.appendFileSync(config, "app_url: http://localhost:5173\n");
  return dir;
}

const E2E =
  'import { test } from "@playwright/test";\n// REQ-031\ntest("cancel", async ({ page }) => {\n  await page.goto("/orders/A-1");\n});\n';

type Entry = Record<string, unknown>;
const mapOf = (dir: string, ...args: string[]): Entry[] => {
  const r = sg(dir, "map", ...args, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).map.requirements;
};

test("REQ-678 SCN-678a: the route from an end-to-end test", () => {
  const dir = project("uc='UC-002 Cancel an order' actor=Customer");
  w(dir, "e2e/cancel.spec.ts", E2E);
  const [entry] = mapOf(dir, "REQ-031");
  assert.equal(entry.requirement, "REQ-031");
  assert.equal(entry.title, "Cancel an order");
  assert.equal(entry.route, "/orders/A-1");
  assert.equal(entry.routeFrom, "e2e");
  assert.equal(entry.url, "http://localhost:5173/orders/A-1");
  assert.equal(entry.useCase, "UC-002 Cancel an order");
  assert.equal(entry.actor, "Customer");
  assert.deepEqual(entry.e2e, ["e2e/cancel.spec.ts"]);
});

test("REQ-678 SCN-678b: the route the trace gives, and a requirement still in its change", () => {
  const dir = project("route=/orders/:id");
  w(
    dir,
    "docs/specs/changes/draft-pagos/change.yaml",
    "specgate_change_version: 1\nschema: layered\ncreated: 2026-11-23\nrigor: lite\n"
  );
  w(
    dir,
    "docs/specs/changes/draft-pagos/specs/pagos/spec.md",
    "# Delta — pagos\n\n## ADDED Requirements\n\n### Requirement: REQ-040 — Pay an order\n\nThe system SHALL let the customer pay an order.\n\n#### Scenario: SCN-040 — Paid\n\n- GIVEN an order\n- WHEN the customer pays it\n- THEN it is paid\n"
  );
  const all = mapOf(dir);
  const byId = (id: string) => all.find((e) => e.requirement === id) as Entry;
  assert.equal(byId("REQ-031").route, "/orders/:id");
  assert.equal(byId("REQ-031").routeFrom, "trace");
  assert.ok(byId("REQ-040"), JSON.stringify(all.map((e) => e.requirement)));
  assert.equal(byId("REQ-040").route, null);
  assert.equal(byId("REQ-040").routeFrom, null);
  assert.equal(byId("REQ-040").capability, "pagos");
  // Human output: one line per requirement.
  assert.match(sg(dir, "map").stdout, /REQ-031[^\n]*\n[^\n]*\/orders\/:id/);
});

test("REQ-679 SCN-679a: the agent is told to open the requirement before and after", () => {
  const dir = project("uc='UC-002 Cancel an order'");
  w(dir, "e2e/cancel.spec.ts", E2E);
  const prompt = buildPrompt({ requirement: "REQ-031" }, dir, {});
  assert.match(prompt, /Where it lives in the app/);
  assert.match(prompt, /\/orders\/A-1/);
  assert.match(prompt, /http:\/\/localhost:5173\/orders\/A-1/);
  assert.match(prompt, /e2e\/cancel\.spec\.ts/);
  assert.match(prompt, /before you change anything, and again after/);
  // Nothing known, nothing said.
  const bare = project("");
  assert.doesNotMatch(
    buildPrompt({ requirement: "REQ-031" }, bare, {}),
    /Where it lives in the app/
  );
});

test("REQ-680 SCN-680a: apply keeps the evidence of a delivery, its screenshot out of git", () => {
  const dir = project("");
  w(dir, ".specgate/gate.yaml", "preset: standard\nbdd: required\n");
  w(
    dir,
    "run-scenarios.js",
    'const fs=require("fs");fs.mkdirSync("test-results/cancel",{recursive:true});fs.writeFileSync("test-results/cancel/screenshot.png","PNG");console.log("1 scenario passed for "+process.argv[2]);\n'
  );
  fs.appendFileSync(
    path.join(dir, "harness.config.yaml"),
    'bdd_cmd: "node run-scenarios.js {tags}"\n'
  );
  w(dir, "tests/cancel.test.ts", "// REQ-031\n");
  const r = sg(dir, "apply", "REQ-031");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const evidence = JSON.parse(read(dir, ".specgate/evidence/REQ-031/evidence.json"));
  assert.equal(evidence.requirement, "REQ-031");
  assert.equal(evidence.scenarios.command, "node run-scenarios.js @REQ-031");
  assert.equal(evidence.scenarios.exitCode, 0);
  assert.equal(typeof evidence.scenarios.ms, "number");
  assert.match(read(dir, ".specgate/evidence/REQ-031/bdd.log"), /1 scenario passed for @REQ-031/);
  assert.ok(
    fs.existsSync(path.join(dir, ".specgate/evidence/REQ-031/artifacts/cancel/screenshot.png"))
  );
  assert.match(read(dir, ".specgate/evidence/.gitignore"), /^artifacts\/$|\*\/artifacts\//m);
  const ignored = spawnSync(
    "git",
    ["check-ignore", ".specgate/evidence/REQ-031/artifacts/cancel/screenshot.png"],
    { cwd: dir, encoding: "utf8" }
  );
  assert.equal(ignored.status, 0, "the screenshot is ignored by git");
});
