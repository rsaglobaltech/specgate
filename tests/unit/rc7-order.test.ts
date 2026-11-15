/**
 * After the sixth microservices run of 1.0.0-rc.6 (REQ-395, REQ-396): a part
 * that shares a criterion with the contracts is written after them, and a
 * requirement of an open change that waits for another repository is the
 * order the story is built in, not a failure.
 *
 * Every test builds real folders in a temp directory, each git repository with
 * its own identity (CI runners have none), and drives the CLI.
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

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "specgate-rc7-"): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

function sg(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_PROFILE: "" },
  });
}

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

function gitRepo(dir: string) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
}

function commit(dir: string, msg = "work") {
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", msg);
}

const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;
const put = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};

function delta(trace: string) {
  return [
    "# Delta — panel",
    "",
    "## ADDED Requirements",
    "",
    "### Requirement: REQ-002 — Fleet positions on the panel",
    "",
    "The system SHALL show the dispatcher where every truck is.",
    "",
    "#### Scenario: SCN-002 — The panel opens",
    "",
    "- GIVEN trucks TRK-1 and TRK-2 have reported",
    "- WHEN the dispatcher opens the panel",
    "- THEN they see TRK-1 and TRK-2 on the map",
    "",
    `<!-- specgate:trace kind=functional actor=Dispatcher feature=features/panel/REQ-002.feature${trace} -->`,
    "",
  ].join("\n");
}

function member(root: string, folder: string): string {
  const tmpOut = path.join(root, `.init-${folder}`);
  const r = sg(root, ["init", "--yes", "--out", tmpOut, "--no-git", "--keep-matrix"]);
  assert.equal(r.status, 0, out(r));
  const dir = path.join(root, folder);
  fs.renameSync(path.join(tmpOut, "my-spec-driven-app"), dir);
  fs.rmSync(tmpOut, { recursive: true, force: true });
  gitRepo(dir);
  commit(dir, "seed");
  return dir;
}

/** A workspace whose story track-fleet gives AC-1 to contracts and tracking, proposed to both. */
function storyOfTwo(): { contracts: string; tracking: string } {
  const root = tmp();
  const tracking = member(root, "tracking");
  const contracts = member(root, "contracts");
  const ws = path.join(root, "ws");
  fs.mkdirSync(ws);
  gitRepo(ws);
  put(path.join(ws, "brief.md"), "# Proyecto\n\nEl despachador ve su flota en un mapa.\n");
  let r = sg(ws, [
    "workspace",
    "init",
    "--name",
    "truck-flote",
    "--repo",
    "tracking=../tracking",
    "--repo",
    "contracts=../contracts:contracts",
  ]);
  assert.equal(r.status, 0, out(r));
  commit(ws, "the workspace");
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  const brief = path.join(ws, "docs", "brief.md");
  fs.writeFileSync(
    brief,
    fs
      .readFileSync(brief, "utf8")
      .replace(
        /^stories:.*$/m,
        "stories:\n  - { id: track-fleet, title: El despachador sigue su flota, repos: [contracts, tracking] }"
      ),
    "utf8"
  );
  assert.equal(sg(ws, ["workspace", "draft", "track-fleet"]).status, 0);
  const story = path.join(ws, "docs", "stories", "track-fleet", "story.md");
  fs.writeFileSync(
    story,
    fs
      .readFileSync(story, "utf8")
      .replace(/## Intent\n\n<!--[^]*?-->\n/, "## Intent\n\nEl despachador ve su flota.\n")
      .replace(
        /## Acceptance criteria\n\n<!--[^]*?-->\n(- AC-1:\n)?/,
        "## Acceptance criteria\n\n- AC-1: El despachador ve dónde está cada camión.\n"
      )
      .replace(
        /## Repositories\n[^]*$/,
        "## Repositories\n\n- `contracts`: AC-1\n- `tracking`: AC-1\n"
      ),
    "utf8"
  );
  commit(ws, "the story");
  r = sg(ws, ["workspace", "propose", "track-fleet"]);
  assert.equal(r.status, 0, out(r));
  for (const d of [tracking, contracts, ws]) commit(d, "track-fleet");
  return { contracts, tracking };
}

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

function specs(dir: string, trace = "") {
  const changeDir = path.join(dir, "docs", "specs", "changes", "track-fleet");
  put(path.join(changeDir, "specs", "panel", "spec.md"), delta(trace));
  commit(dir, "the specs");
}

function author(dir: string, ...extra: string[]) {
  return sg(dir, [
    "change",
    "author",
    "track-fleet",
    "--artifact",
    "design",
    "--agent",
    "node -e 0 {prompt_file}",
    "--json",
    ...extra,
  ]);
}

// ── REQ-395: the contracts are written first ────────────────────────────────

test("REQ-395 SCN-395a: tracking's design waits for the contracts", () => {
  const { tracking, contracts } = storyOfTwo();
  let r = author(tracking);
  assert.equal(r.status, 1, out(r));
  const refused = json(r).status.find((d: { code: string }) => d.code === "author_contracts_first");
  assert.ok(refused, out(r));
  assert.match(refused.message, /contracts/);
  assert.match(refused.fix, /--force/);

  // --force writes it anyway.
  r = author(tracking, "--force");
  assert.ok(!out(r).includes("author_contracts_first"), out(r));

  // Once the contracts' part has a requirement, nothing holds tracking back.
  specs(contracts);
  r = author(tracking);
  assert.ok(!out(r).includes("author_contracts_first"), out(r));
});

// ── REQ-396: a dependency inside an open change is the build order ─────────

test("REQ-396 SCN-396a: tracking's open change waits for contracts:REQ-002", () => {
  const { tracking, contracts } = storyOfTwo();
  specs(contracts);
  specs(tracking, " depends=contracts:REQ-002");
  const ws = path.join(path.dirname(tracking), "ws");
  const r = sg(ws, ["workspace", "check", "--json"]);
  const doc = json(r);
  const errors = (doc.status || []).filter(
    (d: { code: string }) => d.code === "workspace_dependency_pending"
  );
  assert.deepEqual(errors, [], out(r));
  const waiting = (doc.workspace?.warnings || []).filter(
    (d: { code: string }) => d.code === "workspace_dependency_pending"
  );
  assert.equal(waiting.length, 1, out(r));
  assert.equal(waiting[0].severity, "warning");
  assert.match(waiting[0].message, /tracking:REQ-002 depends on contracts:REQ-002/);
});
