/**
 * approved-delta: what a person approved is what gets built. Approving a
 * change seals each of its requirements (REQ-739); the gate fails when an
 * approved requirement changed, was added or is gone (REQ-740); a change
 * approved before seals existed is said to be unsealed, and passes (REQ-741).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  requirementBlocks,
  sealDiff,
  sealOf,
  sealsOf,
} from "../../packages/core/src/domain/DeltaSeal";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const CHANGE = "docs/specs/changes/draft-pedidos";
const DELTA_FILE = `${CHANGE}/specs/draft-pedidos/spec.md`;
const REQ_031 = [
  "### Requirement: REQ-031 — Cancel an order",
  "",
  "<!-- specgate:trace status=Draft actor=Customer kind=functional -->",
  "",
  "The system SHALL let the customer cancel an order not shipped yet.",
  "",
  "#### Scenario: SCN-031 — Cancelled before shipping",
  "",
  '- GIVEN the order "A-1" not shipped',
  '- WHEN the customer cancels "A-1"',
  '- THEN "A-1" is cancelled',
  "",
  "#### Scenario: SCN-032 — Shipped, not cancelled",
  "",
  '- GIVEN the order "A-2" shipped',
  '- WHEN the customer cancels "A-2"',
  '- THEN "A-2" is not cancelled',
  "",
].join("\n");
const REQ_032 = [
  "### Requirement: REQ-032 — Refund a cancelled order",
  "",
  "<!-- specgate:trace status=Draft actor=Customer kind=functional -->",
  "",
  "The system SHALL refund an order the customer cancelled.",
  "",
  "#### Scenario: SCN-033 — A cancelled order gets its money back",
  "",
  '- GIVEN the order "A-1" cancelled',
  "- WHEN the refund runs",
  '- THEN "A-1" is refunded',
  "",
].join("\n");
const delta = (...reqs: string[]) =>
  `# Delta — pedidos\n\n## ADDED Requirements\n\n${reqs.join("\n")}`;

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

/** A project with draft-pedidos of lite rigor: its delta, and nothing written in its layers. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-seal-"));
  madeDirs.push(dir);
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  run("git", ["init", "-q"]);
  run("git", ["config", "user.email", "t@t"]);
  run("git", ["config", "user.name", "t"]);
  const adopted = run(process.execPath, [CLI, "adopt", "--project-dir", dir, "--no-ci"]);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  const config = path.join(dir, "harness.config.yaml");
  const harness = fs.existsSync(config) ? read(dir, "harness.config.yaml") : "";
  w(
    dir,
    "harness.config.yaml",
    `${harness.replace(/^(test_cmd|bdd_cmd):.*\n?/gm, "").replace(/\s*$/, "")}\ntest_cmd: "node -e 0"\n`
  );
  w(dir, ".specgate/gate.yaml", "preset: standard\n");
  // As `propose` leaves it: lite rigor, its layers still as scaffolded.
  const proposed = run(process.execPath, [CLI, "propose", "draft-pedidos", "--project-dir", dir]);
  assert.equal(proposed.status, 0, proposed.stdout + proposed.stderr);
  assert.match(read(dir, `${CHANGE}/change.yaml`), /^rigor: lite$/m);
  w(dir, DELTA_FILE, delta(REQ_031));
  const matrix = read(dir, "docs/specs/traceability.md");
  w(
    dir,
    "docs/specs/traceability.md",
    `${matrix.replace(/\s*$/, "")}\n| REQ-031 | SCN-031, SCN-032 | - | - | - | - | - | \`src/orders.js\` | tests/orders.test.js | Approved |\n`
  );
  w(dir, "src/orders.js", "module.exports = {};\n");
  w(dir, "tests/orders.test.js", "// REQ-031 SCN-031 SCN-032: cancel an order\n");
  const cli = (...args: string[]) => run(process.execPath, [CLI, ...args, "--project-dir", dir]);
  const approve = () => {
    const r = cli("change", "approve", "draft-pedidos");
    assert.equal(r.status, 0, r.stdout + r.stderr);
  };
  /** `specgate check --json`: its exit code and everything it said. */
  const check = () => {
    const r = run(process.execPath, [CLI, "check", dir, "--json"]);
    return { status: r.status, said: r.stdout + r.stderr };
  };
  const records = () => JSON.parse(read(dir, `${CHANGE}/approvals.json`));
  const seals = () => records().find((r: { layer: string }) => r.layer === "requirements");
  const edit = (from: string | RegExp, to: string) => {
    const before = read(dir, DELTA_FILE);
    const after = before.replace(from, to);
    assert.notEqual(after, before, "the delta was edited");
    w(dir, DELTA_FILE, after);
  };
  return { dir, cli, approve, check, seals, edit };
}

test("REQ-739: a seal is of the heading, the statement and the scenarios — not of the trace comment, nor of blank lines", () => {
  const block = requirementBlocks(delta(REQ_031, REQ_032)).get("REQ-031")!;
  assert.match(block, /SCN-032/);
  assert.doesNotMatch(block, /REQ-032/, "the block ends at the next requirement");
  const seal = sealOf(block);
  assert.equal(sealOf(block.replace("status=Draft", "status=Implemented")), seal);
  assert.equal(sealOf(block.replace(/\n\n/g, "\n\n\n")), seal);
  assert.notEqual(sealOf(block.replace("not shipped yet", "shipped or not")), seal);
  assert.notEqual(sealOf(block.replace("is not cancelled", "is cancelled")), seal);
  assert.notEqual(sealOf(block.replace("Cancel an order", "Cancel any order")), seal);
});

test("REQ-740: the difference between two sets of seals says which changed, which were added, which are gone", () => {
  const sealed = sealsOf([delta(REQ_031, REQ_032)]);
  assert.deepEqual(sealDiff(sealed, sealed), { changed: [], added: [], gone: [] });
  const now = sealsOf([
    delta(REQ_031.replace("not shipped yet", "shipped"), REQ_032.replace(/REQ-032/g, "REQ-033")),
  ]);
  assert.deepEqual(sealDiff(sealed, now), {
    changed: ["REQ-031"],
    added: ["REQ-033"],
    gone: ["REQ-032"],
  });
});

test("REQ-739 SCN-739a: sealed at lite rigor — approving a change with nothing written in its layers records a seal for REQ-031", () => {
  const p = project();
  p.approve();
  const record = p.seals();
  assert.ok(record, "approvals.json has the requirements' record");
  assert.match(record.seals["REQ-031"], /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(record.seals), ["REQ-031"]);
  assert.equal(p.check().status, 0, p.check().said);
  assert.doesNotMatch(p.check().said, /approved_requirement_changed|approval_not_sealed/);
});

test("REQ-739 SCN-739b: delivering is not changing — apply writes the status in the delta, the seal still matches and the gate says nothing of it", () => {
  const p = project();
  p.approve();
  const r = p.cli("apply", "REQ-031");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(
    read(p.dir, DELTA_FILE),
    /status=Draft/,
    "apply wrote the status in the delta"
  );
  const c = p.check();
  assert.equal(c.status, 0, c.said);
  assert.doesNotMatch(c.said, /approved_requirement_changed/);
});

test("REQ-740 SCN-740a: a requirement rewritten after approval — the gate fails naming REQ-031 as changed, whose fix is to approve again", () => {
  const p = project();
  p.approve();
  p.edit("cancel an order not shipped yet", "cancel an order, shipped or not");
  const c = p.check();
  assert.notEqual(c.status, 0, c.said);
  assert.match(c.said, /approved_requirement_changed/);
  assert.match(c.said, /REQ-031[^"]*changed/);
  assert.match(c.said, /specgate change approve draft-pedidos/);
  const applied = p.cli("apply", "REQ-031");
  assert.notEqual(applied.status, 0, "apply is refused too");
});

test("REQ-740 SCN-740b: a scenario loosened — SCN-032's THEN turned around fails the gate naming REQ-031", () => {
  const p = project();
  p.approve();
  p.edit('"A-2" is not cancelled', '"A-2" is cancelled');
  const c = p.check();
  assert.notEqual(c.status, 0, c.said);
  assert.match(c.said, /approved_requirement_changed/);
  assert.match(c.said, /REQ-031/);
});

test("REQ-740 SCN-740c: approved again — the finding is gone", () => {
  const p = project();
  p.approve();
  p.edit("cancel an order not shipped yet", "cancel an order, shipped or not");
  assert.notEqual(p.check().status, 0);
  p.approve();
  const c = p.check();
  assert.equal(c.status, 0, c.said);
  assert.doesNotMatch(c.said, /approved_requirement_changed/);
});

test("REQ-740 SCN-740d: a requirement slipped in — REQ-032 added to the delta after the approval fails the gate, named as added", () => {
  const p = project();
  p.approve();
  w(p.dir, DELTA_FILE, delta(REQ_031, REQ_032));
  const c = p.check();
  assert.notEqual(c.status, 0, c.said);
  assert.match(c.said, /approved_requirement_changed/);
  assert.match(c.said, /REQ-032[^"]*added after/);
  assert.doesNotMatch(c.said, /REQ-031[^"]*changed/);
});

test("REQ-740: a sealed requirement taken out of the delta fails the gate, named as gone", () => {
  const p = project();
  w(p.dir, DELTA_FILE, delta(REQ_031, REQ_032));
  p.approve();
  w(p.dir, DELTA_FILE, delta(REQ_031));
  const c = p.check();
  assert.notEqual(c.status, 0, c.said);
  assert.match(c.said, /REQ-032[^"]*gone/);
});

test("REQ-741 SCN-741a: approved by an earlier Specgate — only `approved:` in change.yaml: the gate passes with the warning approval_not_sealed", () => {
  const p = project();
  fs.appendFileSync(path.join(p.dir, `${CHANGE}/change.yaml`), "approved: 2026-11-01\n");
  const c = p.check();
  assert.equal(c.status, 0, c.said);
  assert.match(c.said, /approval_not_sealed/);
  const v = spawnSync(process.execPath, [CLI, "validate", p.dir, "--strict", "--json"], {
    cwd: p.dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /approval_not_sealed/);
  assert.match(v.stdout, /draft-pedidos/);
  assert.match(v.stdout, /specgate change approve draft-pedidos/);
});

test("REQ-741: a change nobody approved is not said to be unsealed", () => {
  const p = project();
  const v = spawnSync(process.execPath, [CLI, "validate", p.dir, "--strict", "--json"], {
    cwd: p.dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.doesNotMatch(v.stdout, /approval_not_sealed|approved_requirement_changed/);
});
