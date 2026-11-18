/**
 * REQ-600: requirements are built in the brief's module order, and status
 * says why the next one comes next.
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
const { inBuildOrder, modulePlaces, ordinal, whyNext } = require("../../scripts/lib/build-order");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });

function put(dir: string, rel: string, text: string) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text, "utf8");
}

const capability = (title: string, id: string, n: number) => `# ${title}

## Requirements

### Requirement: ${id} — ${title} ${n}

The system SHALL keep ${n} records.

#### Scenario: SCN-${id.slice(4)}a — Keeps them

- GIVEN ${n} records
- WHEN they are saved
- THEN ${n} records are kept

<!-- specgate:trace actor=Customer kind=functional status=Approved -->
`;

/** A project whose brief lists `users` before `billing` — not the alphabetical order. */
function project(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "build-order-"));
  made.push(parent);
  assert.equal(sg(parent, "init", "--yes", "--out", parent, "--no-git", "--no-agents").status, 0);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  put(
    dir,
    "docs/brief.md",
    "---\nproduct: Shop\nactors: [Customer]\nmodules: [users, billing]\n---\n\nUsers sign up; billing charges them.\n"
  );
  // Only the brief's modules: the starter requirement goes, as its prose says to.
  put(dir, "spec.md", "# Shop\n");
  fs.rmSync(path.join(dir, "features/core/health.feature"), { force: true });
  put(
    dir,
    "features/billing/REQ-002.feature",
    "Feature: Billing\n\n  @REQ-002 @SCN-002a\n  Scenario: Keeps them\n    Given 2 records\n    When they are saved\n    Then 2 records are kept\n"
  );
  put(
    dir,
    "features/users/REQ-022.feature",
    "Feature: Users\n\n  @REQ-022 @SCN-022a\n  Scenario: Keeps them\n    Given 22 records\n    When they are saved\n    Then 22 records are kept\n"
  );
  put(dir, "docs/specs/capabilities/billing/spec.md", capability("Billing", "REQ-002", 2));
  put(dir, "docs/specs/capabilities/users/spec.md", capability("Users", "REQ-022", 22));
  return dir;
}

test("REQ-600: the brief's modules in its order; a requirement outside them keeps its side", () => {
  const places = new Map([
    ["REQ-022", { module: "users", rank: 0, of: 2 }],
    ["REQ-002", { module: "billing", rank: 1, of: 2 }],
    ["REQ-003", { module: "billing", rank: 1, of: 2 }],
  ]);
  const items = ["REQ-000", "REQ-002", "REQ-003", "REQ-022", "REQ-900"].map((requirement) => ({
    requirement,
  }));
  assert.deepEqual(
    inBuildOrder(items, places).map((i: { requirement: string }) => i.requirement),
    ["REQ-000", "REQ-022", "REQ-002", "REQ-003", "REQ-900"]
  );
  assert.deepEqual(inBuildOrder(items, new Map()), items, "no brief: the matrix's order");
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(2), "2nd");
  assert.equal(ordinal(11), "11th");
  assert.equal(whyNext(places.get("REQ-022")), "users, the brief's 1st module of 2");
});

test("REQ-600 SCN-600a: users before billing, as the brief lists them — and status says why", () => {
  const dir = project();
  const places = modulePlaces(dir);
  assert.equal(places.get("REQ-022").module, "users");
  assert.equal(places.get("REQ-002").module, "billing");

  const status = JSON.parse(sg(dir, "status", "--json").stdout);
  const order = status.requirements
    .map((r: { requirement?: string; id?: string }) => r.requirement || r.id)
    .filter((id: string) => id === "REQ-002" || id === "REQ-022");
  assert.deepEqual(order, ["REQ-022", "REQ-002"], JSON.stringify(status.requirements));

  const text = sg(dir, "status");
  assert.match(text.stdout, /users, the brief's 1st module of 2/, text.stdout);

  // The harness takes them in the same order.
  const run = sg(dir, "harness", "run", "--dry-run");
  const heads = [...run.stdout.matchAll(/^\s*(REQ-\d+) ·/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ["REQ-022", "REQ-002"], run.stdout + run.stderr);
});
