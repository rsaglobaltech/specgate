/**
 * A failed delivery is kept as an attempt (REQ-819, change
 * `evidence-attempts`): why it failed and what the AI decided stay beside the
 * before and the after.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const madeDirs: string[] = [];
test.after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

/**
 * A runner stand-in: prints Playwright's list output and records the AI's
 * decision in SPECGATE_AI_LOG; it fails, the model saying A, while
 * `outcome.txt` says `fail`.
 */
const RUNNER = `
const fs = require("fs");
const fail = fs.readFileSync("outcome.txt", "utf8").trim() === "fail";
fs.appendFileSync(process.env.SPECGATE_AI_LOG, JSON.stringify({ model: "llama3.2", input: "Haz eso", output: { category: fail ? "A" : "C" }, ms: 900 }) + "\\n");
const title = "[bdd] › REQ-031.feature.spec.js:6:3 › Orders › Unclear by API " + process.argv[2];
if (!fail) { console.log("  ✓  1 " + title + " (1.2s)"); process.exit(0); }
console.log("  ✘  1 " + title + " (1.5s)");
console.log("");
console.log("  1) " + title + " › Then recibe 422 ");
console.log("");
console.log("    Error: expect(received).toBe(expected)");
console.log("    Expected: 422");
console.log("    Received: 202");
process.exit(1);
`;

/** The change that holds REQ-031, for its evidence page. */
function openChange(dir: string) {
  w(dir, "docs/specs/changes/draft-orders/change.yaml", "specgate_change_version: 1\nschema: layered\n");
  w(
    dir,
    "docs/specs/changes/draft-orders/specs/orders/spec.md",
    "# Delta — orders\n\n## MODIFIED Requirements\n\n### Requirement: REQ-031 — Unclear idea\n\nThe system SHALL ask for another clue.\n\n#### Scenario: SCN-031 — Unclear by API\n\n- GIVEN a child session\n- WHEN the child sends POST /api/drawing-requests with \"Haz eso\"\n- THEN the answer is 422\n"
  );
}

/** An init project with REQ-031, whose scenarios its runner checks. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-attempts-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  const made = sg(dir, "init");
  assert.equal(made.status, 0, made.stdout + made.stderr);
  fs.appendFileSync(
    path.join(dir, "spec.md"),
    "\n## REQ-031 — Unclear idea\n\n<!-- specgate:trace -->\n\nThe system SHALL ask for another clue.\n"
  );
  w(dir, ".specgate/gate.yaml", "preset: standard\nbdd: required\n");
  w(dir, "run-scenarios.js", RUNNER);
  fs.appendFileSync(path.join(dir, "harness.config.yaml"), 'bdd_cmd: "node run-scenarios.js {tags}"\n');
  w(dir, "tests/unclear.test.ts", "// REQ-031\n");
  return dir;
}

test("REQ-819 SCN-819a: two failed deliveries kept as attempts, listed by the delivery and on the page", () => {
  const dir = project();
  w(dir, "outcome.txt", "fail");
  const first = sg(dir, "apply", "REQ-031", "--json");
  assert.notEqual(first.status, 0);
  assert.match(first.stdout, /apply_bdd_failed/, first.stdout + first.stderr);
  assert.match(first.stdout, /kept in \.specgate\/evidence\/REQ-031\/attempts\/1/);
  assert.notEqual(sg(dir, "apply", "REQ-031").status, 0);

  const kept = JSON.parse(read(dir, ".specgate/evidence/REQ-031/attempts/2/run.json"));
  assert.equal(kept.attempt, 2);
  assert.equal(kept.exitCode, 1);
  assert.match(read(dir, ".specgate/evidence/REQ-031/attempts/1/run.log"), /Received: 202/);
  assert.match(
    read(dir, ".specgate/evidence/REQ-031/attempts/1/artifacts/specgate/ai-decisions.jsonl"),
    /"category":"A"/
  );
  const ignored = spawnSync(
    "git",
    ["check-ignore", ".specgate/evidence/REQ-031/attempts/1/artifacts/specgate/ai-decisions.jsonl"],
    { cwd: dir, encoding: "utf8" }
  );
  assert.equal(ignored.status, 0, "an attempt's artifacts stay out of git");

  w(dir, "outcome.txt", "pass");
  const delivered = sg(dir, "apply", "REQ-031");
  assert.equal(delivered.status, 0, delivered.stdout + delivered.stderr);
  const evidence = JSON.parse(read(dir, ".specgate/evidence/REQ-031/evidence.json"));
  assert.deepEqual(
    evidence.attempts.map((a: { n: number; exitCode: number }) => [a.n, a.exitCode]),
    [
      [1, 1],
      [2, 1],
    ]
  );

  openChange(dir);
  assert.equal(sg(dir, "evidence", "draft-orders", "--html").status, 0);
  const page = read(dir, "docs/specs/changes/draft-orders/EVIDENCE.md");
  assert.match(page, /#### Failed attempts/);
  assert.match(
    page,
    /\| 1 \| Unclear by API: ✘ 1\.5s — Then recibe 422: Error: expect\(received\)\.toBe\(expected\) · Expected: 422 · Received: 202 \| llama3\.2: Haz eso → \{"category":"A"\} \|/
  );
  assert.match(page, /\| 2 \| Unclear by API/);
  assert.match(read(dir, "docs/specs/changes/draft-orders/EVIDENCE.html"), /<h3>Failed attempts<\/h3>/);
});

test("REQ-819: a new before starts again, its old attempts gone", () => {
  const dir = project();
  w(dir, "outcome.txt", "fail");
  assert.notEqual(sg(dir, "apply", "REQ-031").status, 0);
  assert.ok(fs.existsSync(path.join(dir, ".specgate/evidence/REQ-031/attempts/1")));
  assert.equal(sg(dir, "evidence", "before", "REQ-031").status, 0);
  assert.ok(!fs.existsSync(path.join(dir, ".specgate/evidence/REQ-031/attempts")));
});
