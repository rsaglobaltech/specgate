/**
 * After the eighth microservices run of 1.0.0-rc.9 (REQ-415..REQ-418): a part
 * cites the contracts' operation as the story lists it, or approval refuses it;
 * a rule citing a law names its source, and approval says where; an agent that
 * wrote nothing once is retried; and a requirement whose code serves or calls
 * none of its operation's path does not pass the harness.
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

function tmp(prefix = "specgate-rc10-"): string {
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

const { storyPartContext } = require("../../scripts/lib/story-part");
const { contractNotMet } = require("../../scripts/cli/commands/harness/RunCommand");

/** The contract the contracts repository wrote in run 8, cut to two operations. */
const TRACKING = [
  "openapi: 3.0.3",
  "info:",
  "  title: Tracking",
  "  version: 1.0.0",
  "paths:",
  "  /fleet/positions:",
  "    get:",
  "      operationId: listFleetPositions",
  "      responses:",
  '        "200":',
  "          description: Where every truck is",
  "  /trucks/{truckId}/status:",
  "    get:",
  "      operationId: getTruckStatus",
  "      parameters:",
  "        - name: truckId",
  "          in: path",
  "          required: true",
  "      responses:",
  '        "200":',
  "          description: The truck's status",
  "",
].join("\n");

/** Contracts' part: REQ-002 writes the tracking contract and cites its operation. */
function contractsPart(contracts: string) {
  put(path.join(contracts, "contracts", "tracking-api.yaml"), TRACKING);
  specs(contracts, " api=contracts/tracking-api.yaml#listFleetPositions");
}

type Found = { code: string; message: string; severity: string; fix?: string };

function validateIssues(dir: string): Found[] {
  const r = sg(dir, ["change", "validate", "track-fleet", "--json", "--project-dir", dir]);
  return (json(r).items || []).flatMap((i: { issues?: Found[] }) => i.issues || []);
}

function approve(dir: string) {
  const r = sg(dir, ["change", "approve", "track-fleet", "--json", "--project-dir", dir]);
  return { r, doc: json(r) };
}

const of = (ds: Found[], code: string) => ds.filter((d) => d.code === code);

// ── REQ-415: the operation as the story lists it ───────────────────────────

test("REQ-415 SCN-415a: web cites a contract file that does not exist", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/tracking.yaml#listFleetPositions"
  );
  const found = of(validateIssues(tracking), "layer_api_unresolved");
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].severity, "error");
  assert.match(found[0].message, /api=contracts:contracts\/tracking\.yaml#listFleetPositions/);
  assert.match(found[0].message, /api=contracts:contracts\/tracking-api\.yaml#listFleetPositions/);

  const refused = approve(tracking);
  assert.equal(refused.r.status, 1, out(refused.r));
  assert.match(JSON.stringify(refused.doc), /approve_blocked/);
  assert.match(JSON.stringify(refused.doc), /tracking\.yaml/);

  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/tracking-api.yaml#listFleetPositions"
  );
  assert.deepEqual(of(validateIssues(tracking), "layer_api_unresolved"), []);
});

test("REQ-415 SCN-415b: tracking cites the requirement and not its operation", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  // The story lists the line to copy.
  const context = storyPartContext(tracking, "track-fleet");
  assert.match(
    context,
    /`depends=contracts:REQ-002 api=contracts:contracts\/tracking-api\.yaml#listFleetPositions` — GET \/fleet\/positions/
  );
  assert.match(context, /Copy the `api=` of each operation exactly as listed above/);

  specs(tracking, " depends=contracts:REQ-002");
  const found = of(validateIssues(tracking), "layer_no_operation_cited");
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].severity, "error");
  const refused = approve(tracking);
  assert.equal(refused.r.status, 1, out(refused.r));
  assert.match(JSON.stringify(refused.doc), /layer|operations/);
});

// ── REQ-416: a rule citing a law names its source ──────────────────────────

test("REQ-416 SCN-416a: a driving-time rule cites the regulation", () => {
  const { contracts } = storyOfTwo();
  const rules = sg(contracts, ["change", "instructions", "specs", "track-fleet", "--json"]);
  assert.match(out(rules), /Source: Regulation \(EC\) No 561\/2006/);

  const changeDir = path.join(contracts, "docs", "specs", "changes", "track-fleet");
  put(
    path.join(changeDir, "specs", "panel", "spec.md"),
    [
      "# Delta — panel",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-004 — Driving time",
      "",
      "The system SHALL stop a driver at 4.5 hours of driving, as the EU regulation on driving times requires.",
      "",
      "#### Scenario: SCN-004 — Four and a half hours",
      "",
      "- GIVEN driver D-1 has driven 4 hours 30 minutes",
      "- WHEN the dispatcher opens D-1",
      "- THEN they see that D-1 must rest",
      "",
      "<!-- specgate:trace kind=business-rule actor=Dispatcher feature=features/panel/REQ-004.feature -->",
      "",
    ].join("\n")
  );
  commit(contracts, "the rule");
  const refused = approve(contracts);
  assert.equal(refused.r.status, 1, out(refused.r));
  const text = JSON.stringify(refused.doc);
  assert.match(text, /REQ-004 cites a law, standard or contract and names no source/);
  assert.match(text, /REQ-004: Add a \\"Source:\\" line/, text);
});

// ── REQ-418: the code serves the operation it cites ────────────────────────

test("REQ-418 SCN-418a: tracking passes its tests and serves no route of the contract", () => {
  const { tracking, contracts } = storyOfTwo();
  contractsPart(contracts);
  specs(
    tracking,
    " depends=contracts:REQ-002 api=contracts:contracts/tracking-api.yaml#getTruckStatus"
  );
  const server = path.join(tracking, "src", "TruckController.java");
  put(server, 'class TruckController { String status() { return "ok"; } }\n');
  const missing = contractNotMet(tracking, tracking, "REQ-002");
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.equal(missing[0].code, "contract_operation_not_found");
  assert.match(missing[0].message, /GET \/trucks\/\{truckId\}\/status/);

  put(
    server,
    '@RestController class TruckController { @GetMapping("/trucks/{truckId}/status") String status() { return "ok"; } }\n'
  );
  assert.deepEqual(contractNotMet(tracking, tracking, "REQ-002"), []);
  // Mounted in pieces, as Spring writes it: the class's prefix, the method's rest.
  put(
    server,
    '@RequestMapping("/trucks") class TruckController { @GetMapping("/{truckId}/status") String status() { return "ok"; } }\n'
  );
  assert.deepEqual(contractNotMet(tracking, tracking, "REQ-002"), []);
  put(
    server,
    '@RequestMapping("/trucks") class TruckController { @GetMapping("/{truckId}") String one() { return "ok"; } }\n'
  );
  assert.equal(contractNotMet(tracking, tracking, "REQ-002").length, 1);
  // The contracts repository cites its own operations, and serves none.
  assert.deepEqual(contractNotMet(contracts, contracts, "REQ-002"), []);
});
