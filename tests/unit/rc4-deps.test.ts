/**
 * After the third microservices run of 1.0.0-rc.3 (REQ-380..382): what a
 * design says a requirement waits for, or the operation it uses, is carried by
 * a requirement's trace — and the repository that holds the contracts writes
 * them, while the others cite them.
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

function tmp(prefix = "specgate-rc4-"): string {
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

// ── REQ-380, REQ-381: the design and the traces ─────────────────────────────

const DISCOVER = `# Discover: panel

> Owner: product

## Context

Dispatchers lose time finding their trucks.

## Use case

A dispatcher opens the panel and sees every truck.

## Acceptance criteria

- AC-1: The dispatcher sees where every truck is.
`;

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

/** A project with a layered change `panel`: its design and its trace as given. */
function change(design: string, trace = "") {
  const root = tmp();
  put(path.join(root, "spec.md"), "# Spec\n");
  put(
    path.join(root, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n|---|---|---|---|---|---|---|---|---|---|\n"
  );
  const r = sg(root, ["change", "new", "panel", "--capability", "panel", "--project-dir", root]);
  assert.equal(r.status, 0, out(r));
  const dir = path.join(root, "docs", "specs", "changes", "panel");
  put(path.join(dir, "discover.md"), DISCOVER);
  put(path.join(dir, "design.md"), design);
  put(path.join(dir, "specs", "panel", "spec.md"), delta(trace));
  return root;
}

function untraced(root: string) {
  const r = sg(root, ["change", "validate", "panel", "--json", "--project-dir", root]);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return (j.items || [])
    .flatMap((i: { issues?: unknown[] }) => i.issues || [])
    .filter((d: { code: string }) => d.code === "layer_design_dependency_untraced");
}

const DESIGN = (rows: string) => `# Design: panel

> Owner: architect

## Modules

- AC-1 — the panel reads the fleet from tracking.

## Across repositories

A requirement here that needs one of their requirements names it in its trace: \`depends=contracts:REQ-NNN\`. An API between repositories is an operation of \`contracts\`, cited as \`api=<file>#<operationId>\`.

| Requirement | Uses |
| --- | --- |
${rows}
`;

test("REQ-380 SCN-380a: the panel's design names what it waits for", () => {
  const root = change(DESIGN("| REQ-002 | `depends=tracking:REQ-002` |"));
  const found = untraced(root);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].message, /tracking:REQ-002/);
  assert.match(found[0].message, /REQ-002/);
  assert.equal(found[0].severity, "warning");
  assert.match(found[0].fix, /REQ-002's specgate:trace/);
});

test("REQ-380 SCN-380b: the dependency is in the trace", () => {
  const root = change(
    DESIGN("| REQ-002 | `depends=tracking:REQ-002` |"),
    " depends=tracking:REQ-002"
  );
  assert.deepEqual(untraced(root), []);
});

test("REQ-381 SCN-381a: an operation named only in the design", () => {
  const root = change(DESIGN("| REQ-002 | `api=contracts/fleet.yaml#listFleet` |"));
  const found = untraced(root);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].message, /api=contracts\/fleet\.yaml#listFleet/);
  // Cited in the trace, it is carried.
  const cited = change(
    DESIGN("| REQ-002 | `api=contracts/fleet.yaml#listFleet` |"),
    " api=contracts/fleet.yaml#listFleet"
  );
  assert.deepEqual(untraced(cited), []);
});

// ── REQ-382: the contracts repository and the others ────────────────────────

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

function contractWarnings(dir: string, trace: string) {
  const changeDir = path.join(dir, "docs", "specs", "changes", "track-fleet");
  put(path.join(changeDir, "specs", "panel", "spec.md"), delta(trace));
  const r = sg(dir, ["change", "validate", "track-fleet", "--json", "--project-dir", dir]);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return (j.items || [])
    .flatMap((i: { issues?: unknown[] }) => i.issues || [])
    .filter((d: { code: string }) => d.code === "layer_no_contract_cited");
}

test("REQ-386 SCN-386a: the tracking part cites nothing of the contracts", () => {
  const { tracking, contracts } = storyOfTwo();
  const found = contractWarnings(tracking, "");
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].severity, "warning");
  assert.equal(found[0].target, "REQ-002");
  assert.match(found[0].fix, /depends=contracts:REQ-NNN/);
  // Citing the contracts member, by requirement or by operation, answers it.
  assert.deepEqual(contractWarnings(tracking, " depends=contracts:REQ-002"), []);
  assert.deepEqual(contractWarnings(tracking, " api=contracts/fleet.yaml#listFleet"), []);
  // The contracts member is not asked to cite itself.
  assert.deepEqual(contractWarnings(contracts, ""), []);
});

test("REQ-382 SCN-382a: writing the contracts part, then the panel's", () => {
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
  r = sg(ws, ["workspace", "draft", "track-fleet"]);
  assert.equal(r.status, 0, out(r));
  const story = path.join(ws, "docs", "stories", "track-fleet", "story.md");
  fs.writeFileSync(
    story,
    fs
      .readFileSync(story, "utf8")
      .replace(/## Intent\n\n<!--[^]*?-->\n/, "## Intent\n\nEl despachador ve su flota.\n")
      .replace(
        /## Acceptance criteria\n\n<!--[^]*?-->\n(- AC-1:\n)?/,
        "## Acceptance criteria\n\n- AC-1: El despachador ve dónde está cada camión.\n"
      ),
    "utf8"
  );
  commit(ws, "the story");
  r = sg(ws, ["workspace", "propose", "track-fleet"]);
  assert.equal(r.status, 0, out(r));
  for (const d of [tracking, contracts, ws]) commit(d, "track-fleet");

  const prompt = (dir: string) => {
    const p = sg(dir, [
      "change",
      "author",
      "track-fleet",
      "--artifact",
      "specs",
      "--agent",
      "node -e 0 {prompt_file}",
      "--dry-run",
    ]);
    assert.equal(p.status, 0, out(p));
    return p.stdout;
  };
  const own = prompt(contracts);
  assert.match(own, /contracts\//, "the contracts member is asked for the contract file");
  assert.match(own, /OpenAPI|AsyncAPI/);
  assert.match(own, /api=contracts\//);
  const other = prompt(tracking);
  assert.match(other, /depends=contracts:REQ-NNN/, "the others cite the contracts member");
});
