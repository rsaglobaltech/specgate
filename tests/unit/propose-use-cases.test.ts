/**
 * REQ-636: `specgate propose --use-cases` — a change proposing the use cases
 * of requirements delivered before the project kept them, written by the
 * agent or by hand, then approved and archived like any other (#544).
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
const run = (cwd: string, args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
const git = (cwd: string, ...a: string[]) =>
  spawnSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...a], {
    encoding: "utf8",
  });

const CATALOG =
  "# Use Cases\n\n| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |\n|---|---|---|---|---|---|---|---|\n| UC-001 | Describe the first use case | Primary actor | REQ-TBD | CMD-001 ExampleCommand | AGG-001 CoreAggregate | EVT-001 ExampleEvent | Draft |\n";

function project(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-propose-uc-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", version: "1.0.0", scripts: { test: "node --test" } })
  );
  git(dir, "init", "-q");
  assert.equal(run(dir, ["init", "--no-agents", "--no-ci", "--yes"]).status, 0);
  assert.equal(run(dir, ["new", "A customer can cancel an order before it ships"]).status, 0);
  fs.writeFileSync(path.join(dir, "docs", "specs", "use-cases.md"), CATALOG);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "start");
  return dir;
}

const STUB = `
const fs = require("fs");
const dir = "docs/specs/changes/use-cases-catalog";
fs.writeFileSync(dir + "/use-cases.md", "# Use cases\\n\\n## ADDED Use Cases\\n\\n| ID | Use Case | Actor | Requirements |\\n| --- | --- | --- | --- |\\n| UC-002 | Cancel an order | Customer | REQ-002 |\\n");
fs.writeFileSync(dir + "/use-cases/UC-002.md", "# UC-002 — Cancel an order\\n\\n## Overview\\n\\nThe customer cancels an order before it ships.\\n\\n## Main flow (" + process.env.SCN + ")\\n\\n1. The customer cancels the order.\\n2. The system confirms it.\\n");
fs.writeFileSync("stray.txt", "outside the change\\n");
`;

test("REQ-636 SCN-636a: the change opens with what to place — REQ-002 in no use case — and the agent's use cases make it ready; nothing outside it is kept", (t) => {
  const dir = project(t);
  const opened = JSON.parse(run(dir, ["propose", "--use-cases", "--json"]).stdout);
  assert.deepEqual(opened.useCases.uncovered, ["REQ-002"]);
  assert.equal(opened.useCases.ready, false);
  const change = path.join(dir, "docs/specs/changes/use-cases-catalog");
  assert.match(
    fs.readFileSync(path.join(change, "change.yaml"), "utf8"),
    /skip_specs: true[\s\S]*uc_range: \[UC-\d+, UC-\d+\]/
  );
  const guide = fs.readFileSync(path.join(change, "USE-CASES.md"), "utf8");
  const scn = /\| REQ-002 \| [^|]+ \| (SCN-[\w.]+)/.exec(guide)?.[1];
  assert.ok(scn, guide);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "opened");

  const stub = path.join(dir, "..", `uc-stub-${path.basename(dir)}.js`);
  fs.writeFileSync(stub, STUB);
  t.after(() => fs.rmSync(stub, { force: true }));
  const r = spawnSync(
    process.execPath,
    [CLI, "propose", "--use-cases", "--agent", `node ${stub}`, "--json"],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", CI: "1", SCN: scn! },
    }
  );
  const done = JSON.parse(r.stdout);
  assert.equal(done.useCases.ready, true, JSON.stringify(done.status));
  assert.equal(
    fs.existsSync(path.join(dir, "stray.txt")),
    false,
    "what the agent wrote outside the change is undone"
  );
});

test("REQ-636 SCN-636b: approved and archived, the catalog has UC-002 and its specification; asked again, every requirement is in a use case", (t) => {
  const dir = project(t);
  run(dir, ["propose", "--use-cases"]);
  const change = path.join(dir, "docs/specs/changes/use-cases-catalog");
  const guide = fs.readFileSync(path.join(change, "USE-CASES.md"), "utf8");
  const scn = /\| REQ-002 \| [^|]+ \| (SCN-[\w.]+)/.exec(guide)![1];
  fs.writeFileSync(
    path.join(change, "use-cases.md"),
    "# Use cases\n\n## ADDED Use Cases\n\n| ID | Use Case | Actor | Requirements |\n| --- | --- | --- | --- |\n| UC-002 | Cancel an order | Customer | REQ-002 |\n"
  );
  fs.writeFileSync(
    path.join(change, "use-cases", "UC-002.md"),
    `# UC-002 — Cancel an order\n\n## Overview\n\nThe customer cancels an order.\n\n## Main flow (${scn})\n\n1. The customer cancels it.\n`
  );
  fs.writeFileSync(path.join(change, "tasks.md"), "# Tasks\n\n- [x] 1.1 Reviewed\n");
  assert.equal(run(dir, ["propose", "--use-cases"]).status, 0);
  const approved = run(dir, ["change", "approve", "use-cases-catalog"]);
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  const archived = run(dir, ["archive", "use-cases-catalog"]);
  assert.equal(archived.status, 0, archived.stdout + archived.stderr);
  const catalog = fs.readFileSync(path.join(dir, "docs/specs/use-cases.md"), "utf8");
  assert.match(catalog, /\| UC-002 \| Cancel an order \| Customer \| REQ-002 \|/);
  assert.doesNotMatch(catalog, /Describe the first use case/);
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/use-cases/UC-002.md")));
  const again = run(dir, ["propose", "--use-cases"]);
  assert.match(again.stdout, /Every requirement is in a use case/);
});
