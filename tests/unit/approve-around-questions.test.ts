/**
 * approve-around-questions REQ-771: an open question on a requirement that
 * waits (Needs Clarification) does not block approving the rest of its change.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const cli = (dir: string, args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: "1", SPECGATE_SKIP_DOCTOR: "1" },
  });

const req = (id: string, title: string, waits: boolean) => [
  `### Requirement: ${id} — ${title}`,
  "",
  `<!-- specgate:trace actor=Member kind=functional${waits ? ' status="Needs Clarification"' : ""} -->`,
  "",
  `The system SHALL ${title.toLowerCase()}, as the club's rules say.`,
  "",
  `#### Scenario: SCN-${id.slice(4)}a — ${title}`,
  "",
  "- GIVEN a member with a booking",
  "- WHEN the member acts on it",
  "- THEN the club's rule applies",
  "",
];

/** A draft with REQ-002 decided and REQ-003 waiting on Q1; `extra` adds an open Q2 on REQ-002. */
function draft(extra: boolean): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-approve-q-")));
  made.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli(dir, ["adopt", "--no-ci"]).status, 0);
  assert.equal(cli(dir, ["propose", "bookings", "--capability", "bookings"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/bookings/specs/bookings/spec.md");
  const first = Number((fs.readFileSync(delta, "utf8").match(/REQ-(\d+)/) || ["", "2"])[1]);
  const a = `REQ-${String(first).padStart(3, "0")}`;
  const b = `REQ-${String(first + 1).padStart(3, "0")}`;
  fs.writeFileSync(
    delta,
    ["# Delta — bookings", "", "## ADDED Requirements", "", ...req(a, "Book a court", false), ...req(b, "Cancel late", true)].join("\n")
  );
  const rows = [`| Q1 | How much is a late cancellation? | ${b} | A flat fee · nothing |`];
  if (extra) rows.push(`| Q2 | Can a member book two courts at once? | ${a} | yes · no |`);
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes/bookings/questions.md"),
    ["# Open questions", "", "| # | Question | Blocks | Options seen |", "|---|---|---|---|", ...rows, ""].join("\n")
  );
  return dir;
}

test("REQ-771 SCN-771a: the rest goes ahead — a question on a waiting requirement does not block approving", () => {
  const dir = draft(false);
  const r = cli(dir, ["change", "approve", "bookings", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(path.join(dir, "docs/specs/changes/bookings/change.yaml"), "utf8"), /^approved:/m);
});

test("REQ-771 SCN-771b: a question on a decided requirement still blocks", () => {
  const dir = draft(true);
  const r = cli(dir, ["change", "approve", "bookings", "--json"]);
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /approve_blocked/);
  assert.match(r.stdout, /Q2/);
  assert.doesNotMatch(r.stdout, /Q1 is open/);
});
