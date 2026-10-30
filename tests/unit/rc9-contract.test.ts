/**
 * After the seventh microservices run of 1.0.0-rc.8 (REQ-405..REQ-408): a part
 * that serves or calls a contract cites the operation, not only the contracts'
 * requirement; its agent reads the operation as the contract writes it; and a
 * delivered part whose code has no such path is pointed out.
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

function tmp(prefix = "specgate-rc9-"): string {
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

const { apiReferenceProblems } = require("../../scripts/lib/contracts");
const { buildPrompt } = require("../../scripts/harness/prompt");

/** The contract the contracts repository wrote in run 7, cut to two operations. */
const FLEET = [
  "openapi: 3.0.3",
  "info:",
  "  title: Fleet",
  "  version: 1.0.0",
  "paths:",
  "  /fleet/status:",
  "    get:",
  "      operationId: getFleetStatus",
  "      summary: Where every truck is",
  "      responses:",
  '        "200":',
  "          description: The fleet",
  "  /vehicles/{vehicleId}/tachograph:",
  "    get:",
  "      operationId: getTachograph",
  "      parameters:",
  "        - name: vehicleId",
  "          in: path",
  "          required: true",
  "      responses:",
  '        "200":',
  "          description: The tachograph state",
  "",
].join("\n");

/** Contracts' part: REQ-002 writes the fleet contract and cites its operation. */
function contractsPart(contracts: string) {
  put(path.join(contracts, "contracts", "fleet.openapi.yaml"), FLEET);
  specs(contracts, " api=contracts/fleet.openapi.yaml#getFleetStatus");
}

const wsOf = (tracking: string) => path.join(path.dirname(tracking), "ws");

function workspaceCheck(tracking: string) {
  const r = sg(wsOf(tracking), ["workspace", "check", "--json"]);
  const doc = json(r);
  return { r, errors: doc.status || [], warnings: doc.workspace?.warnings || [] };
}

type Found = { code: string; message: string; severity: string };
const codes = (ds: Found[], code: string) => ds.filter((d) => d.code === code);

// ── REQ-405: an operation of another repository's contract ─────────────────

test("REQ-405 SCN-405a: tracking cites the contracts' operation", () => {
  // A member's validate leaves a qualified citation to the workspace…
  const lone = tmp();
  put(
    path.join(lone, "spec.md"),
    "# Spec\n\n## REQ-002 — Fleet\n\n" +
      "<!-- specgate:trace kind=functional status=Implemented api=contracts:contracts/fleet.openapi.yaml#getFleetStatus -->\n"
  );
  assert.deepEqual(apiReferenceProblems(lone), []);
  // …and still holds a file of its own that is missing.
  put(
    path.join(lone, "spec.md"),
    "# Spec\n\n## REQ-002 — Fleet\n\n" +
      "<!-- specgate:trace kind=functional status=Implemented api=contracts/fleet.openapi.yaml#getFleetStatus -->\n"
  );
  assert.equal(apiReferenceProblems(lone)[0]?.code, "api_contract_missing");

  // The workspace resolves it in the contracts repository.
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getFleetStatus status=Implemented"
  );
  let c = workspaceCheck(tracking);
  assert.deepEqual(codes([...c.errors, ...c.warnings], "workspace_api_unresolved"), [], out(c.r));

  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getNothing status=Implemented"
  );
  c = workspaceCheck(tracking);
  const unresolved = codes(c.errors, "workspace_api_unresolved");
  assert.equal(unresolved.length, 1, out(c.r));
  assert.match(unresolved[0].message, /tracking:REQ-002 cites api=contracts:/);
  assert.equal(c.r.status, 1);
});

// ── REQ-406: the operation, not only the requirement ───────────────────────

function operationWarnings(dir: string) {
  const r = sg(dir, ["change", "validate", "track-fleet", "--json", "--project-dir", dir]);
  const j = json(r);
  return (j.items || [])
    .flatMap((i: { issues?: unknown[] }) => i.issues || [])
    .filter((d: { code: string }) => d.code === "layer_no_operation_cited");
}

test("REQ-406 SCN-406a: tracking names the requirement, not the operation", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(tracking, " depends=contracts:REQ-002");
  const found = operationWarnings(tracking);
  assert.equal(found.length, 1, JSON.stringify(found));
  // REQ-415: an error once the contracts' requirement cites its operation.
  assert.equal(found[0].severity, "error");
  assert.match(found[0].message, /api=contracts:contracts\/fleet\.openapi\.yaml#getFleetStatus/);

  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getFleetStatus"
  );
  assert.deepEqual(operationWarnings(tracking), []);
});

// ── REQ-407: the prompt quotes the operation ───────────────────────────────

test("REQ-407 SCN-407a: tracking's agent reads getFleetStatus", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getFleetStatus"
  );
  const prompt = buildPrompt(
    { requirement: "REQ-002", category: "functional", description: "Fleet positions on the panel" },
    tracking
  );
  assert.match(prompt, /## The operations this requirement serves or calls/);
  assert.match(prompt, /GET \/fleet\/status \(getFleetStatus\)/);
  assert.match(prompt, /operationId: getFleetStatus/);
  assert.match(prompt, /serves exactly this method and path/);
  assert.doesNotMatch(prompt, /getTachograph/, "only the operation it cites");
});

// ── REQ-408: the operation is in the code ──────────────────────────────────

test("REQ-408 SCN-408a: tracking serves a path of its own", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getTachograph status=Implemented"
  );
  const server = path.join(tracking, "src", "server.ts");

  put(server, 'app.get("/api/vehicles/:vehicleId/tachograph", (req, res) => res.json(state));\n');
  commit(tracking, "serves the contract");
  let c = workspaceCheck(tracking);
  assert.deepEqual(codes(c.warnings, "contract_operation_not_found"), [], out(c.r));

  put(server, 'app.get("/api/fleet/trucks/:truckId/tachograph", (req, res) => res.json(state));\n');
  // A test calling the path is no proof the code serves it.
  put(
    path.join(tracking, "tests", "server.test.ts"),
    'get("/vehicles/1/tachograph");\nget("/vehicles/:vehicleId/tachograph");\n'
  );
  commit(tracking, "serves its own path");
  c = workspaceCheck(tracking);
  const missing = codes(c.warnings, "contract_operation_not_found");
  assert.equal(missing.length, 1, out(c.r));
  assert.equal(missing[0].severity, "warning");
  assert.match(missing[0].message, /tracking:REQ-002/);
  assert.match(missing[0].message, /GET \/vehicles\/\{vehicleId\}\/tachograph/);
});
