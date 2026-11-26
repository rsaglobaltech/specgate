/**
 * learn-rules (trust curve, phase 4): the lessons that keep coming back
 * (REQ-684), and a lesson made a principle through an approved change (REQ-685).
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
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

const review = (rows: Array<[string, string, string]>) =>
  [
    "# Review",
    "",
    "| Date | Requirement | Request | Status |",
    "|---|---|---|---|",
    ...rows.map(([d, r, t]) => `| ${d} | ${r} | ${t} | open |`),
    "",
  ].join("\n");

/** An `init` project with two drafts whose review notes say the same thing in other words. */
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-learn-"));
  madeDirs.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  const made = sg(dir, "init");
  assert.equal(made.status, 0, made.stdout + made.stderr);
  const yaml = "specgate_change_version: 1\nschema: layered\ncreated: 2026-11-20\nrigor: lite\n";
  w(dir, "docs/specs/changes/draft-pedidos/change.yaml", yaml);
  w(
    dir,
    "docs/specs/changes/draft-pedidos/review.md",
    review([["2026-11-20", "REQ-031", "Prices always with their currency, never a bare number"]])
  );
  w(dir, "docs/specs/changes/archive/2026-11-21-draft-pagos/change.yaml", yaml);
  w(
    dir,
    "docs/specs/changes/archive/2026-11-21-draft-pagos/review.md",
    review([
      ["2026-11-21", "REQ-040", "Show every price with its currency, not a bare number"],
      ["2026-11-21", "—", "Use the brand blue for buttons"],
    ])
  );
  return dir;
}

const lessons = (dir: string) => {
  const r = sg(dir, "learn", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).learn.lessons;
};

test("REQ-684 SCN-684a: the same note in two drafts is a lesson", () => {
  const dir = project();
  const [l1, ...rest] = lessons(dir);
  assert.equal(l1.id, "L1");
  assert.equal(l1.kind, "review");
  assert.deepEqual(l1.evidence.map((e: { change: string }) => e.change).sort(), [
    "draft-pagos",
    "draft-pedidos",
  ]);
  assert.equal(l1.next, 'specgate learn promote L1 --title "<rule>"');
  // A note said once is no lesson.
  assert.equal(rest.filter((l: { kind: string }) => l.kind === "review").length, 0);
});

test("REQ-684 SCN-684b: the agent keeps failing the architecture check", () => {
  const dir = project();
  const ev = (req: string, attempt: number, stage: string, result: string) =>
    JSON.stringify({ t: 1, req, attempt, type: "gate", stage, result });
  w(
    dir,
    ".harness/events/REQ-040.jsonl",
    [
      ev("REQ-040", 1, "architecture", "fail"),
      ev("REQ-040", 2, "architecture", "fail"),
      ev("REQ-040", 3, "tests", "pass"),
    ].join("\n") + "\n"
  );
  w(dir, ".harness/events/REQ-041.jsonl", ev("REQ-041", 1, "architecture", "fail") + "\n");
  const h = lessons(dir).find((l: { kind: string }) => l.kind === "harness");
  assert.ok(h);
  assert.equal(h.stage, "architecture");
  assert.equal(h.count, 3);
  assert.deepEqual(h.requirements, ["REQ-040", "REQ-041"]);
});

test("REQ-685 SCN-685a: a barrier, written only once a person approves it", () => {
  const dir = project();
  const r = sg(
    dir,
    "learn",
    "promote",
    "L1",
    "--title",
    "Prices carry their currency",
    "--forbid",
    "price:\\s*\\d",
    "--in",
    "src/**",
    "--json"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).learn.promote.change, "learn-prices-carry-their-currency");
  assert.match(
    read(dir, "docs/specs/changes/learn-prices-carry-their-currency/discover.md"),
    /Prices always with their currency/
  );
  assert.equal(fs.existsSync(path.join(dir, "docs/specs/principles.md")), false);
  const ok = sg(dir, "change", "approve", "learn-prices-carry-their-currency", "--json");
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const p = read(dir, "docs/specs/principles.md");
  assert.match(p, /^principles_version: 1\.0\.0$/m);
  assert.match(p, /^## P1 — Prices carry their currency$/m);
  assert.match(p, /<!-- specgate:principle forbid="price:\\s\*\\d" in="src\/\*\*" -->/);
});

test("REQ-685 SCN-685b: an instruction, in prose", () => {
  const dir = project();
  assert.equal(
    sg(dir, "learn", "promote", "L1", "--title", "Prices carry their currency").status,
    0
  );
  assert.equal(sg(dir, "change", "approve", "learn-prices-carry-their-currency").status, 0);
  const p = read(dir, "docs/specs/principles.md");
  assert.match(p, /^## P1 — Prices carry their currency$/m);
  assert.doesNotMatch(p, /specgate:principle/);
  // The next one is P2.
  assert.equal(sg(dir, "learn", "promote", "L1", "--title", "Buttons in brand blue").status, 0);
  assert.equal(sg(dir, "change", "approve", "learn-buttons-in-brand-blue").status, 0);
  assert.match(read(dir, "docs/specs/principles.md"), /^## P2 — Buttons in brand blue$/m);
});
