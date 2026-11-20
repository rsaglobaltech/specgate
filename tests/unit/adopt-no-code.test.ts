/**
 * REQ-608 (issue #513): adopting a folder with no code sets it up as a new
 * project — no "existing project", no API style nobody chose, and a first
 * requirement its first test can meet.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

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

const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), "specgate-nocode-"));
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

test("REQ-608 SCN-608a: an empty folder is set up as a new project", () => {
  const dir = folder();
  const adopt = run(dir, "adopt");
  assert.equal(adopt.status, 0, adopt.out);
  assert.match(adopt.out, /No code here yet: set up as a new project/);
  assert.match(adopt.out, /the first thing the product should do/);

  const agents = read(dir, "AGENTS.md");
  assert.match(agents, /^new project · /m);
  assert.match(agents, /^Stack: TBD · API: TBD · Testing: TBD$/m);
  assert.doesNotMatch(agents, /REST with DTO/);

  const spec = read(dir, "spec.md");
  assert.match(spec, /^## REQ-001 — The project builds and its tests run$/m);
  assert.match(spec, /before any code was written/);
  assert.doesNotMatch(spec, /brownfield|Existing behaviour|REST with DTO|\{\{/);
  assert.match(read(dir, "features/adoption/baseline.feature"), /^Feature: The project builds/);
  assert.match(read(dir, "docs/specs/traceability.md"), /UC-001 Build and test the project/);

  assert.equal(run(dir, "check").status, 0);
  assert.match(
    run(dir, "status").out,
    /nothing is specified yet — add the first thing the product should do/
  );
});

test("REQ-608 SCN-608b: a folder with code is adopted as before, its API as built", () => {
  const dir = folder();
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", scripts: { test: "node --test" } })
  );
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.js"), "export const a = 1;\n");
  const adopt = run(dir, "adopt");
  assert.equal(adopt.status, 0, adopt.out);
  assert.doesNotMatch(adopt.out, /No code here yet/);

  assert.match(read(dir, "AGENTS.md"), /^existing project · /m);
  assert.match(read(dir, "AGENTS.md"), / · API: as built · /);
  const spec = read(dir, "spec.md");
  assert.match(spec, /^## REQ-001 — Existing behaviour is preserved$/m);
  assert.match(spec, /existing codebase \(brownfield\)/);
  assert.match(spec, /^- API style: as built$/m);
  assert.match(read(dir, "docs/specs/traceability.md"), /UC-001 Preserve existing behaviour/);
  assert.match(run(dir, "status").out, /add one requirement your code already meets/);
});

test("REQ-608 SCN-608c: source files with no manifest are code, and --var still decides", () => {
  const dir = folder();
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "main.py"), "print('hi')\n");
  assert.equal(run(dir, "adopt", "--var", "API_STYLE=GraphQL").status, 0);
  const agents = read(dir, "AGENTS.md");
  assert.match(agents, /^existing project · /m);
  assert.match(agents, /^Stack: TBD · API: GraphQL · /m);
  assert.match(read(dir, "spec.md"), /^## REQ-001 — Existing behaviour is preserved$/m);
});
