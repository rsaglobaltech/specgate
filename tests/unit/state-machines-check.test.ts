/**
 * REQ-637: `validate --strict` checks each entity's state machine against the
 * requirements; its errors fail the gate, its warnings are reported.
 * REQ-639: `check` writes each machine's PlantUML beside it, and
 * `status --json` carries the machines.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { TestContext } from "node:test";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}
function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}

/**
 * A Node project with REQ-002 Implemented and no test that names it: a
 * `strict_tdd_1` finding, the only one, under `validate --strict`.
 */
function project(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sm-check-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", version: "1.0.0", scripts: { test: "node --test" } })
  );
  git(dir, "init", "-q");
  const init = run(dir, ["init", "--no-agents", "--no-ci", "--yes"]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  fs.rmSync(path.join(dir, ".specgate", "gate.yaml"), { force: true });
  assert.equal(run(dir, ["new", "A customer can cancel an order before it ships"]).status, 0);
  const feature = fs
    .readdirSync(path.join(dir, "features"))
    .find((f) => f.startsWith("a-customer-can-cancel"))!;
  fs.writeFileSync(
    path.join(dir, "features", feature),
    [
      "Feature: A customer can cancel an order before it ships",
      "",
      "  @REQ-002 @SCN-002",
      "  Scenario: Ana cancels an order that has not shipped",
      '    Given Ana has order 1001 with status "paid"',
      "    When Ana cancels order 1001",
      '    Then order 1001 has status "cancelled"',
      "",
    ].join("\n")
  );
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "The system MUST satisfy: A customer can cancel an order before it ships.",
        'The system SHALL let a customer cancel an order whose status is not "shipped".'
      )
      .replace(/\n> Written by Specgate[^\n]*\n/g, "\n")
  );
  assert.equal(run(dir, ["apply", "REQ-002", "--no-check"]).status, 0);
  assert.equal(run(dir, ["matrix"]).status, 0);
  return dir;
}
const policy = (dir: string, text: string) => {
  fs.mkdirSync(path.join(dir, ".specgate"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".specgate", "gate.yaml"), text);
};

const MACHINE = `# Order — states

## States

- Paid (initial)
- Cancelled (final)
- Shipped (final)

## Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Paid | Cancelled | cancel [not shipped] | REQ-002 |
| Paid | Shipped | ship | - |

## Forbidden

- Shipped → Cancelled (REQ-002)
`;

const machine = (dir: string, text: string) => {
  fs.mkdirSync(path.join(dir, "docs", "specs", "state-machines"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "specs", "state-machines", "Order.md"), text);
};

test("REQ-637 SCN-637d: a machine that holds passes the gate; its untraced transition is reported", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n");
  machine(dir, MACHINE);
  const j = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(j.status, 0, j.stdout + j.stderr);
  assert.match(j.stdout, /sm_transition_untraced/);
});

test("REQ-637 SCN-637e: a forbidden transition taken and an unknown requirement fail the gate; minimal reports them", (t) => {
  const dir = project(t);
  policy(dir, "preset: strict\nrules:\n  tdd: off\n");
  machine(
    dir,
    MACHINE.replace(
      "| Paid | Shipped | ship | - |",
      "| Paid | Shipped | ship | REQ-404 |\n| Shipped | Cancelled | refund | REQ-002 |"
    )
  );
  const r = run(dir, ["validate", ".", "--strict"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const out = r.stdout + r.stderr;
  assert.match(out, /sm_forbidden_used/);
  assert.match(out, /sm_unknown_requirement/);
  assert.match(out, /docs\/specs\/state-machines\/Order\.md/);
  policy(dir, "preset: minimal\nrules:\n  tdd: off\n");
  const minimal = run(dir, ["validate", ".", "--strict", "--json"]);
  assert.equal(minimal.status, 0, minimal.stdout + minimal.stderr);
  assert.match(minimal.stdout, /sm_forbidden_used/);
});

test("REQ-639 SCN-639b: check writes Order.puml beside the machine, and status --json carries it", (t) => {
  const dir = project(t);
  machine(dir, MACHINE);
  run(dir, ["check"]);
  const puml = fs.readFileSync(
    path.join(dir, "docs", "specs", "state-machines", "Order.puml"),
    "utf8"
  );
  assert.match(puml, /Paid --> Cancelled : cancel \[not shipped\]\\nREQ-002/);
  const s = run(dir, ["status", "--json"]);
  const json = JSON.parse(s.stdout.slice(s.stdout.indexOf("{")));
  assert.equal(json.stateMachines.length, 1);
  assert.equal(json.stateMachines[0].name, "Order");
  assert.equal(json.stateMachines[0].puml, "docs/specs/state-machines/Order.puml");
  assert.deepEqual(
    json.stateMachines[0].transitions.map((x: { from: string; to: string }) => `${x.from}>${x.to}`),
    ["Paid>Cancelled", "Paid>Shipped"]
  );
});
