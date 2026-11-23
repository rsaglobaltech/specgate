/**
 * trust-levels (ADR-0046): each module declares how far an agent may go in it
 * (REQ-670); the harness does only what its level allows (REQ-671); a level
 * rises only through an approved change (REQ-672) and drops at once with a bug
 * (REQ-673); `specgate trust` shows what each module has earned (REQ-674).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const trust = require(path.join(ROOT_DIR, "dist", "scripts", "lib", "trust.js"));

const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
const run = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
const json = (r: { stdout: string }) => JSON.parse(r.stdout);
/** `specgate check <dir> --json`, its document. */
const check = (dir: string) =>
  json(
    spawnSync(process.execPath, [CLI, "check", dir, "--json"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    })
  );
type Finding = { code: string; message: string; fix?: string };
/** Every finding of a check, its stages' and its verdict's. */
const findings = (doc: { stages?: Array<{ findings: Finding[] }>; status?: Finding[] }): Finding[] => [
  ...(doc.stages || []).flatMap((s) => s.findings),
  ...(doc.status || []),
];
const codes = (doc: object) => findings(doc).map((f) => f.code).join("\n");

/** A capability spec with the requirements given, each Implemented. */
function capability(dir: string, name: string, reqs: string[]) {
  const blocks = reqs.map((id) =>
    [
      `### Requirement: ${id} — ${name} ${id}`,
      "",
      `<!-- specgate:trace status=Draft actor=Customer kind=functional -->`,
      "",
      `The system SHALL handle ${name} for ${id}.`,
      "",
      `#### Scenario: SCN-${id.slice(4)} — It works`,
      "",
      "- GIVEN a customer",
      `- WHEN the customer uses ${name}`,
      "- THEN it works",
      "",
    ].join("\n")
  );
  w(dir, `docs/specs/capabilities/${name}/spec.md`, `# ${name}\n\n## Requirements\n\n${blocks.join("\n")}`);
}

/** An adopted project with pagos (REQ-040, REQ-041) and catalogo (REQ-050), and `trust` as its trust: line. */
function project(trustLine: string | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-trust-"));
  madeDirs.push(dir);
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  const adopted = run(dir, "adopt", "--no-ci");
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  capability(dir, "pagos", ["REQ-040", "REQ-041"]);
  capability(dir, "catalogo", ["REQ-050"]);
  w(dir, ".specgate/gate.yaml", `preset: standard\n${trustLine ? `${trustLine}\n` : ""}`);
  return dir;
}

const ledger = (dir: string) =>
  read(dir, ".specgate/trust-ledger.jsonl")
    .trim()
    .split("\n")
    .map((l: string) => JSON.parse(l));

test("REQ-670 SCN-670a: a level out of range fails the gate with trust_invalid", () => {
  const dir = project("trust: { pagos: 6 }");
  const doc = check(dir);
  const said = JSON.stringify(doc);
  assert.match(codes(doc), /trust_invalid/);
  assert.match(said, /pagos is 6/);
  assert.match(said, /1 \(observed\) to 5/);
});

test("REQ-670 SCN-670b: no trust declared, no finding names trust and the gate passes as it did", () => {
  const dir = project(null);
  const doc = check(dir);
  assert.doesNotMatch(codes(doc), /trust_/);
  assert.equal(fs.existsSync(path.join(dir, ".specgate/trust-ledger.jsonl")), false);
  // A capability that is no capability is a finding, once trust: exists.
  w(dir, ".specgate/gate.yaml", "preset: standard\ntrust: { tienda: 2 }\n");
  assert.match(codes(check(dir)), /trust_unknown_capability/);
});

test("REQ-671 SCN-671a: an observed module is left to a person", () => {
  const dir = project("trust: { pagos: 1, catalogo: 3 }");
  const plain = { named: [], concurrency: 1 };
  assert.equal(trust.harnessTrustRefusal(dir, "REQ-050", undefined, plain), null);
  const skipped = trust.harnessTrustRefusal(dir, "REQ-040", undefined, plain);
  assert.match(skipped, /^trust_level: pagos is at level 1 \(observed\), and this run needs 3/);
});

test("REQ-671 SCN-671b: a confined module runs one named requirement, never in parallel", () => {
  const dir = project("trust: { pagos: 2 }");
  const named = { named: ["REQ-040"], concurrency: 1 };
  assert.equal(trust.harnessTrustRefusal(dir, "REQ-040", undefined, named), null);
  assert.match(trust.harnessTrustRefusal(dir, "REQ-041", undefined, named), /needs 3/);
  const parallel = { named: [], concurrency: 2 };
  for (const id of ["REQ-040", "REQ-041"])
    assert.match(trust.harnessTrustRefusal(dir, id, undefined, parallel), /level 2 \(confined\), and this run needs 4/);
  // The run's intent travels to its workers in the environment.
  assert.deepEqual(trust.runIntent({ SPECGATE_TRUST_RUN: JSON.stringify(named) }), named);
});

test("REQ-671: a bug change runs only at level 5", () => {
  const dir = project("trust: { catalogo: 4 }");
  w(dir, "docs/specs/changes/fix-precio/change.yaml", "schema: layered\nkind: bug\n");
  const plain = { named: [], concurrency: 1 };
  assert.match(trust.harnessTrustRefusal(dir, "REQ-050", "fix-precio", plain), /needs 5/);
  w(dir, ".specgate/gate.yaml", "trust: { catalogo: 5 }\n");
  assert.equal(trust.harnessTrustRefusal(dir, "REQ-050", "fix-precio", plain), null);
});

test("REQ-671 SCN-671c: no merging alone — --chain refused before any worktree", () => {
  const dir = project("trust: { catalogo: 5 }");
  assert.match(trust.chainRefusal(dir), /^harness_trust_chain:/);
  w(dir, ".specgate/gate.yaml", "preset: standard\n");
  assert.equal(trust.chainRefusal(dir), null);
});

test("REQ-672 SCN-672a: a level raised by hand fails the gate with trust_raised_unapproved", () => {
  const dir = project("trust: { catalogo: 3 }");
  check(dir);
  assert.deepEqual(
    ledger(dir).map((l: { capability: string; to: number; reason: string }) => [l.capability, l.to, l.reason]),
    [["catalogo", 3, "declared"]]
  );
  w(dir, ".specgate/gate.yaml", "preset: standard\ntrust: { catalogo: 4 }\n");
  const doc = check(dir);
  assert.match(codes(doc), /trust_raised_unapproved/);
  assert.match(JSON.stringify(doc), /specgate trust promote catalogo/);
  // Lowered by hand: allowed, and recorded.
  w(dir, ".specgate/gate.yaml", "preset: standard\ntrust: { catalogo: 2 }\n");
  assert.doesNotMatch(codes(check(dir)), /trust_/);
  assert.equal(ledger(dir).at(-1).reason, "lowered");
});

test("REQ-672 SCN-672b: promoted by an approved change", () => {
  const dir = project("trust:\n  catalogo: 3\n  promote_after: 1");
  check(dir);
  const opened = run(dir, "trust", "promote", "catalogo", "--json");
  assert.equal(opened.status, 0, opened.stdout + opened.stderr);
  assert.equal(json(opened).trust.promote.change, "trust-catalogo-4");
  assert.match(read(dir, "docs/specs/changes/trust-catalogo-4/discover.md"), /catalogo is at trust level 3/);
  assert.match(read(dir, ".specgate/gate.yaml"), /catalogo: 3/);
  const approved = run(dir, "change", "approve", "trust-catalogo-4", "--json");
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  assert.match(read(dir, ".specgate/gate.yaml"), /^ {2}catalogo: 4$/m);
  assert.match(read(dir, ".specgate/gate.yaml"), /^ {2}promote_after: 1$/m);
  const last = ledger(dir).at(-1);
  assert.deepEqual([last.reason, last.from, last.to, last.change], ["promotion", 3, 4, "trust-catalogo-4"]);
  assert.doesNotMatch(codes(check(dir)), /trust_/);
});

test("REQ-673 SCN-673a: a bug escaped from catalogo lowers it at once", () => {
  const dir = project("trust: { catalogo: 4 }");
  const r = run(dir, "propose", "fix-precio", "--kind", "bug", "--capability", "catalogo", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).trust, { capability: "catalogo", from: 4, to: 3 });
  assert.match(read(dir, ".specgate/gate.yaml"), /trust: \{ catalogo: 3 \}/);
  const last = ledger(dir).at(-1);
  assert.deepEqual([last.reason, last.from, last.to, last.change], ["leak", 4, 3, "fix-precio"]);
  const human = run(dir, "propose", "fix-otro", "--kind", "bug", "--capability", "catalogo");
  assert.match(human.stdout, /catalogo went down to trust level 2 \(from 3\)/);
  // Never below 1.
  w(dir, ".specgate/gate.yaml", "trust: { catalogo: 1 }\n");
  run(dir, "propose", "fix-tercero", "--kind", "bug", "--capability", "catalogo");
  assert.match(read(dir, ".specgate/gate.yaml"), /catalogo: 1/);
});

test("REQ-674 SCN-674a: ready for a promotion after ten green deliveries", () => {
  const dir = project("trust: { catalogo: 3 }");
  const ids = Array.from({ length: 10 }, (_, i) => `REQ-${500 + i}`);
  capability(dir, "catalogo", ids);
  const at = Date.now();
  w(
    dir,
    ".specgate/applied.jsonl",
    ids
      .map((req, i) => JSON.stringify({ req, capability: "catalogo", at: new Date(at - i * 1000).toISOString() }))
      .join("\n") + "\n"
  );
  const r = run(dir, "trust", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const row = json(r).trust.capabilities.find((c: { capability: string }) => c.capability === "catalogo");
  assert.equal(row.level, 3);
  assert.equal(row.name, "verified");
  assert.equal(row.streak, 10);
  assert.equal(row.ready, true);
  assert.equal(row.next, "specgate trust promote catalogo");
});

test("REQ-674 SCN-674b: a leak resets the streak", () => {
  const dir = project("trust: { catalogo: 3 }");
  const ids = Array.from({ length: 7 }, (_, i) => `REQ-${600 + i}`);
  capability(dir, "catalogo", ids);
  const past = Date.now() - 60_000;
  w(
    dir,
    ".specgate/applied.jsonl",
    ids.map((req) => JSON.stringify({ req, capability: "catalogo", at: new Date(past).toISOString() })).join("\n") + "\n"
  );
  assert.equal(
    json(run(dir, "trust", "--json")).trust.capabilities.find((c: { capability: string }) => c.capability === "catalogo").streak,
    7
  );
  run(dir, "propose", "fix-precio", "--kind", "bug", "--capability", "catalogo");
  const r = run(dir, "trust");
  assert.match(r.stdout, /catalogo\s+2 confined\s+\d+ applied · streak 0 · 1 leak\n/);
  assert.doesNotMatch(r.stdout, /ready/);
  // A failed harness attempt resets it too.
  w(dir, ".harness/events/REQ-600.jsonl", JSON.stringify({ t: Date.now() / 1000, req: "REQ-600", type: "attempt", state: "end", result: "fail" }) + "\n");
  assert.equal(
    json(run(dir, "trust", "--json")).trust.capabilities.find((c: { capability: string }) => c.capability === "catalogo").streak,
    0
  );
});
