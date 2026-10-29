/**
 * The workspace: the repositories of one product (ADR-0041, REQ-290..298).
 *
 * Every test builds real repositories in a temp folder — `specgate init` for
 * each member, git with its own identity (CI runners have none) — and drives
 * the CLI the way a person would.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { RequirementGraph } = require("../../packages/core/src/domain/RequirementGraph");
const { readWorkspace, qualifiedRefs } = require("../../packages/core/src/domain/Workspace");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ws-"));
  made.push(d);
  return d;
}

function sg(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

/** A member repository: a Specgate project with git and its own identity. */
function member(root: string, name: string): string {
  const out = path.join(root, `.init-${name}`);
  const r = sg(root, "init", "--yes", "--out", out, "--no-git", "--keep-matrix");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, name);
  fs.renameSync(path.join(out, "my-spec-driven-app"), dir);
  fs.rmSync(out, { recursive: true, force: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  return dir;
}

/** A workspace repository beside its members. */
function workspace(...members: string[]): {
  root: string;
  ws: string;
  dirs: Record<string, string>;
} {
  const root = tmp();
  const dirs: Record<string, string> = {};
  for (const m of members) dirs[m] = member(root, m);
  const ws = path.join(root, "ws");
  fs.mkdirSync(ws);
  return { root, ws, dirs };
}

const json = (r: { stdout: string }) => JSON.parse(r.stdout);

test("REQ-290 SCN-290a: init names the sibling projects", () => {
  const { ws } = workspace("fleet", "contracts");
  const r = sg(ws, "workspace", "init", "--name", "truck-flote", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const read = readWorkspace(fs.readFileSync(path.join(ws, "specgate.workspace.yaml"), "utf8"));
  assert.deepEqual(read.problems, []);
  assert.equal(read.config.name, "truck-flote");
  assert.deepEqual(
    read.config.repos.map((x: { name: string; path: string; role: string }) => [
      x.name,
      x.path,
      x.role,
    ]),
    [
      ["contracts", "../contracts", "contracts"],
      ["fleet", "../fleet", "service"],
    ]
  );
  assert.match(
    fs.readFileSync(path.join(ws, ".gitignore"), "utf8"),
    /\.specgate\/workspace-check\.json/
  );
});

test("REQ-290 SCN-290b: a repo with an unknown role is refused", () => {
  const read = readWorkspace(
    "workspace_version: 1\nname: x\nrepos:\n  - name: fleet\n    path: ../fleet\n    role: backend\n"
  );
  assert.equal(read.config, null);
  assert.match(
    read.problems.join("\n"),
    /fleet has the role backend: a role is service, web, library, contracts/
  );
});

test("REQ-291 SCN-291a: status shows each repository", () => {
  const { ws, dirs } = workspace("fleet", "web");
  assert.equal(
    sg(ws, "workspace", "init", "--repo", "fleet=../fleet", "--repo", "web=../web:web").status,
    0
  );
  const r = sg(ws, "workspace", "status", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const model = json(r).workspace;
  assert.equal(model.schemaVersion, 1);
  const fleet = model.repos.find((x: { name: string }) => x.name === "fleet");
  assert.equal(fleet.role, "service");
  assert.equal(fleet.branch, "main");
  assert.equal(fleet.exists, true);
  assert.equal(fleet.requirements.total, 1);
  assert.deepEqual(fleet.gate, { state: "not run", at: null });
  assert.equal(
    fs.realpathSync.native(model.dir),
    fs.realpathSync.native(ws),
    "the model names the workspace it read"
  );
  assert.ok(dirs.web);
});

test("REQ-292 SCN-292a: one repository's gate fails the workspace", () => {
  const { ws, dirs } = workspace("fleet", "tracking");
  assert.equal(sg(ws, "workspace", "init").status, 0);
  assert.equal(sg(ws, "workspace", "check").status, 0, "both pass at first");
  fs.writeFileSync(
    path.join(dirs.tracking, "harness.config.yaml"),
    'harness_version: 1\ntest_cmd: "node -e process.exit(3)"\n'
  );
  const r = sg(ws, "workspace", "check", "--json");
  assert.equal(r.status, 1, r.stdout);
  const status = json(sg(ws, "workspace", "status", "--json")).workspace;
  const gate = Object.fromEntries(
    status.repos.map((x: { name: string; gate: { state: string } }) => [x.name, x.gate.state])
  );
  assert.deepEqual(gate, { fleet: "passed", tracking: "failed" });
});

test("REQ-293 SCN-293a: a qualified id that names nothing", () => {
  const { ws, dirs } = workspace("fleet", "contracts");
  assert.equal(sg(ws, "workspace", "init").status, 0);
  const spec = path.join(dirs.fleet, "spec.md");
  fs.appendFileSync(
    spec,
    "\nThe fleet reads contracts:REQ-000 and contracts:REQ-099, and billing:REQ-001.\n"
  );
  const r = sg(ws, "workspace", "check", "--json");
  assert.equal(r.status, 1);
  const codes = json(r).status.map(
    (d: { code: string; message: string }) => `${d.code} ${d.message}`
  );
  assert.ok(
    codes.some((c: string) => /workspace_unknown_requirement .*contracts:REQ-099/.test(c)),
    codes.join("\n")
  );
  assert.ok(
    codes.some((c: string) => /workspace_unknown_repo .*billing:REQ-001/.test(c)),
    codes.join("\n")
  );
  assert.ok(!codes.some((c: string) => /contracts:REQ-000/.test(c)), "an id the repo has is fine");
  assert.deepEqual(
    qualifiedRefs("see fleet:REQ-012, http://x/y:REQ-1 and REQ-004").map(
      (q: { repo: string; id: string }) => `${q.repo}:${q.id}`
    ),
    ["fleet:REQ-012"]
  );
});

test("REQ-294 SCN-294a: a repository leaves another's id to the workspace", () => {
  const graph = RequirementGraph.fromDependencies(["REQ-001", "REQ-002"], {
    "REQ-002": ["CONTRACTS:REQ-003", "REQ-001"],
  });
  assert.deepEqual(graph.unknown, []);
  assert.deepEqual(graph.external, [{ requirement: "REQ-002", dependency: "CONTRACTS:REQ-003" }]);
  assert.deepEqual(graph.dependsOn["REQ-002"], ["REQ-001"]);
});

/** A capability requirement in `dir` that depends on `dep`. */
function dependent(dir: string, dep: string) {
  const cap = path.join(dir, "docs", "specs", "capabilities", "tracking");
  fs.mkdirSync(cap, { recursive: true });
  fs.writeFileSync(
    path.join(cap, "spec.md"),
    [
      "# Tracking",
      "",
      "## Purpose",
      "",
      "Where each truck is.",
      "",
      "## Requirements",
      "",
      "### Requirement: REQ-005 — The client follows the truck carrying their shipment",
      "",
      "The system SHALL show the client the truck's last position.",
      "",
      "#### Scenario: SCN-005 — The client opens the tracking",
      "",
      "- GIVEN shipment ENV-1 is on truck TRK-1",
      "- WHEN the client opens its tracking",
      "- THEN they see TRK-1's last position",
      "",
      `<!-- specgate:trace actor=Client kind=functional depends=${dep} -->`,
      "",
    ].join("\n")
  );
}

test("REQ-295 SCN-295a: a dependency on another repository not delivered yet", () => {
  const { ws, dirs } = workspace("tracking", "contracts");
  assert.equal(sg(ws, "workspace", "init").status, 0);
  dependent(dirs.tracking, "contracts:REQ-000");
  let r = sg(ws, "workspace", "check", "--json");
  assert.equal(r.status, 1);
  const pending = json(r).status.filter(
    (d: { code: string }) => d.code === "workspace_dependency_pending"
  );
  assert.equal(pending.length, 1, r.stdout);
  assert.match(pending[0].message, /tracking:REQ-005 depends on contracts:REQ-000, which is Draft/);

  // Delivered in contracts: the workspace no longer holds tracking back.
  const matrix = path.join(dirs.contracts, "docs", "specs", "traceability.md");
  fs.writeFileSync(
    matrix,
    fs.readFileSync(matrix, "utf8").replace(/(\| REQ-000 \|.*\| )Draft( \|)/, "$1Implemented$2")
  );
  r = sg(ws, "workspace", "check", "--json");
  const codes = json(r).status.map((d: { code: string }) => d.code);
  assert.ok(!codes.includes("workspace_dependency_pending"), r.stdout);
});

test("REQ-296 SCN-296a: a story split across three repositories", () => {
  const { ws, dirs } = workspace("fleet", "tracking", "web");
  assert.equal(sg(ws, "workspace", "init", "--name", "truck-flote").status, 0);
  const r = sg(
    ws,
    "workspace",
    "propose",
    "follow-shipment",
    "--repos",
    "fleet,tracking,web",
    "--title",
    "El cliente sigue su envío",
    "--json"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const n of ["fleet", "tracking", "web"]) {
    const proposal = fs.readFileSync(
      path.join(dirs[n], "docs", "specs", "changes", "follow-shipment", "proposal.md"),
      "utf8"
    );
    assert.match(proposal, /Part of the workspace story `truck-flote:follow-shipment`/);
  }
  const story = fs.readFileSync(
    path.join(ws, "docs", "stories", "follow-shipment", "story.yaml"),
    "utf8"
  );
  assert.match(story, /repo: tracking\n {4}change: follow-shipment/);
  const again = sg(ws, "workspace", "propose", "follow-shipment", "--repos", "fleet");
  assert.equal(again.status, 1, "a story is proposed once");
});

test("REQ-297 SCN-297a: the story is done when every repository archived its part", () => {
  const { ws, dirs } = workspace("fleet", "web");
  assert.equal(sg(ws, "workspace", "init").status, 0);
  assert.equal(sg(ws, "workspace", "propose", "follow-shipment", "--repos", "fleet,web").status, 0);
  const archiveIn = (dir: string) => {
    const from = path.join(dir, "docs", "specs", "changes", "follow-shipment");
    const to = path.join(dir, "docs", "specs", "changes", "archive", "2026-10-29-follow-shipment");
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  };
  const stories = () => json(sg(ws, "workspace", "status", "--json")).workspace.stories;
  assert.equal(stories()[0].done, false);
  archiveIn(dirs.fleet);
  const half = stories()[0];
  assert.equal(half.done, false, "web still has its part open");
  assert.deepEqual(
    half.subchanges.map((s: { repo: string; state: string }) => `${s.repo} ${s.state}`),
    ["fleet archived", "web open"]
  );
  archiveIn(dirs.web);
  assert.equal(stories()[0].done, true);
});

test("REQ-298 SCN-298a: the model other views read", () => {
  const { ws } = workspace("fleet");
  assert.equal(sg(ws, "workspace", "init").status, 0);
  const model = json(sg(ws, "workspace", "status", "--json")).workspace;
  assert.deepEqual(Object.keys(model), ["schemaVersion", "name", "dir", "repos", "stories"]);
  assert.deepEqual(Object.keys(model.repos[0]), [
    "name",
    "role",
    "path",
    "url",
    "exists",
    "branch",
    "requirements",
    "gate",
  ]);
  // Without a workspace file: the null shape, and the fix.
  const none = sg(tmp(), "workspace", "status", "--json");
  assert.equal(none.status, 1);
  assert.equal(json(none).workspace, null);
  assert.equal(json(none).status[0].code, "workspace_missing");
});
