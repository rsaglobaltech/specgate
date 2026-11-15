/**
 * The guards' next requirement (change guard-next-requirement): the one the
 * change's tasks put next, a denial that says any requirement unlocks the
 * file, and none named once every requirement is applied.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const { openChanges } = require("../../scripts/plugin/project-state");
const session = require("../../scripts/plugin/session-hook");
const guard = require("../../scripts/plugin/guard-hook");

interface Req {
  id: string;
  status: string;
}

/** A spec-driven git project with one open change, its delta and, when given, its tasks.md. */
function project(id: string, reqs: Req[], tasks?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guard-next-"));
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  write("spec.md", "# Spec\n");
  write(`docs/specs/changes/${id}/change.yaml`, "specgate_change_version: 1\n");
  write(
    `docs/specs/changes/${id}/specs/x/spec.md`,
    "# Delta — x\n\n## ADDED Requirements\n\n" +
      reqs
        .map(
          (r) =>
            `### Requirement: ${r.id} — something\n\nThe system SHALL do it.\n\n` +
            `<!-- specgate:trace status=${r.status} actor=Developer kind=functional -->\n`
        )
        .join("\n")
  );
  if (tasks !== undefined) write(`docs/specs/changes/${id}/tasks.md`, tasks);
  write("src/index.ts", "export {};\n");
  const g = (...a: string[]) =>
    spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", ...a], {
      cwd: root,
      encoding: "utf8",
    });
  g("init", "-q");
  g("add", "-A");
  g("commit", "-qm", "init");
  return root;
}

/** What the guard says to a Write of `rel` in `root`. */
function edit(root: string, rel: string) {
  return guard.decide(
    { cwd: root, tool_name: "Write", tool_input: { file_path: path.join(root, rel) } },
    {}
  );
}

const V2: Req[] = [
  { id: "REQ-311", status: "Draft" },
  { id: "REQ-312", status: "Draft" },
  { id: "REQ-313", status: "Implemented" },
  { id: "REQ-319", status: "Implemented" },
  { id: "REQ-320", status: "Draft" },
];
const V2_TASKS = `# Tasks

## 1. Specification

- [x] 1.1 Write the delta spec for each affected capability

## 2. Phase 1

- [x] 2.2 REQ-313 — roles
- [x] 2.3 REQ-319 — families
- [ ] 2.4 REQ-320 — interfaces the framework implements
- [ ] 2.9 REQ-312 — test scope out of the graph
- [ ] 2.10 REQ-311 — single-module projects
`;

test("REQ-426 SCN-426a: the guard and the session name the requirement the tasks put next", () => {
  const root = project("module-map-v2", V2, V2_TASKS);
  assert.deepEqual(openChanges(root)[0].pending, ["REQ-320", "REQ-312", "REQ-311"]);
  const denied = edit(root, "src/core/map/scan.ts");
  assert.equal(denied.allow, false);
  assert.match(denied.message, /write the test for REQ-320 first/);
  assert.match(denied.message, /a test that names any requirement of `module-map-v2`/);
  assert.match(session.sessionContext(root), /Next: REQ-320/);
});

test("REQ-426: requirements no unchecked task names follow in the delta's order; no tasks.md, the delta's order", () => {
  const partial = `# Tasks\n\n- [ ] 2.1 REQ-312 — first\n- [x] 2.2 REQ-311 — ticked, yet still Draft\n`;
  assert.deepEqual(openChanges(project("c", V2, partial))[0].pending, [
    "REQ-312",
    "REQ-311",
    "REQ-320",
  ]);
  assert.deepEqual(openChanges(project("c", V2))[0].pending, ["REQ-311", "REQ-312", "REQ-320"]);
  // CRLF tasks, as Windows writes them, read the same.
  const crlf = V2_TASKS.replace(/\n/g, "\r\n");
  assert.deepEqual(openChanges(project("c", V2, crlf))[0].pending, [
    "REQ-320",
    "REQ-312",
    "REQ-311",
  ]);
});

test("REQ-427 SCN-427a: with every requirement applied, the guard names none", () => {
  const done = V2.map((r) => ({ ...r, status: "Implemented" }));
  const root = project("module-map", done, V2_TASKS);
  const denied = edit(root, "src/core/map/scan.ts");
  assert.equal(denied.allow, false);
  assert.match(denied.message, /every requirement of `module-map` is applied/);
  assert.match(denied.message, /specgate archive module-map/);
  assert.match(denied.message, /specgate propose <change-id>/);
  assert.doesNotMatch(denied.message, /REQ-\d+/);
});
