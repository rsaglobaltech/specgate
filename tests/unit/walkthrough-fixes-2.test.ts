/**
 * walkthrough-fixes-2: what the second literal walkthrough of the guides met
 * on 2026-11-26.
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
const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const cli = (dir: string, args: string[], person = false) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NO_COLOR: "1",
      SPECGATE_SKIP_DOCTOR: "1",
      SPECGATE_ASSUME_TTY: person ? "1" : "",
    },
  });
function project(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt2-")));
  made.push(dir);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  // A CI runner has no git identity; the harness asks for one before it runs an agent.
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  assert.equal(cli(dir, ["adopt", "--no-ci"]).status, 0);
  return dir;
}

test("REQ-781 SCN-781a: the Claude Code plugin, generated in a project, goes under .claude/ — and the guard lets the next call through", () => {
  const dir = project();
  const r = cli(dir, ["agents", "init", "--tool", "claude-plugin"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(dir, ".claude", "specgate-plugin", "hooks", "hooks.json")));
  assert.ok(!fs.existsSync(path.join(dir, "scripts")), "nothing of the plugin at the root");
  assert.ok(!fs.existsSync(path.join(dir, "plugin.json")));
  // A change open, no test yet: the guard judges the working tree — the plugin is not part of it.
  assert.equal(cli(dir, ["propose", "export-csv", "--capability", "export"]).status, 0);
  const { decide } = require("../../scripts/plugin/guard-hook");
  const d = decide({ cwd: dir, tool_name: "Bash", tool_input: { command: "ls" } }, {});
  assert.equal(d.allow, true, d.message);
});

test("REQ-781: given a folder of its own, the plugin is written there, as before", () => {
  const out = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt2-plugin-")));
  made.push(out);
  const r = cli(out, ["agents", "init", "--tool", "claude-plugin"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(out, "hooks", "hooks.json")));
});

test("REQ-782 SCN-782a: a requirement waiting for an answer — harness run starts no agent and makes no branch", () => {
  const dir = project();
  assert.equal(cli(dir, ["propose", "bookings", "--capability", "bookings"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/bookings/specs/bookings/spec.md");
  const id = (fs.readFileSync(delta, "utf8").match(/REQ-\d+/) || ["REQ-002"])[0];
  fs.writeFileSync(
    delta,
    [
      "# Delta — bookings",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${id} — Cancel late`,
      "",
      '<!-- specgate:trace actor=Member kind=functional status="Needs Clarification" -->',
      "",
      "The system SHALL charge a fee for a late cancellation, as the club decides.",
      "",
      `#### Scenario: SCN-${id.slice(4)}a — A late cancellation`,
      "",
      "- GIVEN a booking that starts in an hour",
      "- WHEN the member cancels it",
      "- THEN the club's fee is charged",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes/bookings/questions.md"),
    `# Open questions\n\n| # | Question | Blocks | Options seen |\n|---|---|---|---|\n| Q1 | How much is the fee? | ${id} | a flat fee · nothing |\n`
  );
  assert.equal(cli(dir, ["change", "approve", "bookings"], true).status, 0);
  const marker = path.join(dir, "agent-ran");
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    `harness_version: 1\nagent: 'node -e "require(\\"fs\\").writeFileSync(\\"${marker}\\", \\"x\\")"'\ntest_cmd: 'node --test'\nmax_attempts: 1\n`
  );
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t.invalid", "commit", "-qm", "draft"],
    { cwd: dir }
  );
  const r = cli(dir, ["harness", "run", "--req", id, "--skip-doctor"]);
  assert.match(r.stdout + r.stderr, /waits for an answer/);
  assert.ok(!fs.existsSync(marker), "the agent never ran");
  const branches = spawnSync("git", ["branch", "--list", `harness/${id}`], {
    cwd: dir,
    encoding: "utf8",
  }).stdout.trim();
  assert.equal(branches, "", "no branch for it");
});

test("REQ-783 SCN-783a: the client's answer is a source — a value it gives is not unlisted", () => {
  const { checkDraft } = require("../../packages/core/src/domain/DraftChecklist");
  const delta = [
    "# Delta — bookings",
    "",
    "## ADDED Requirements",
    "",
    "### Requirement: REQ-004 — Cancel late",
    "",
    "<!-- specgate:trace actor=Member kind=functional -->",
    "",
    "The system SHALL charge a fee for a cancellation less than 24 hours before the booking.",
    "",
    "#### Scenario: SCN-004 — A late cancellation",
    "",
    "- GIVEN a booking that starts in 3 hours",
    "- WHEN the member cancels it",
    "- THEN a fee of 5 euros is charged",
    "",
  ].join("\n");
  const brief =
    "# Courts\n\nMembers book courts by the hour. A booking can be cancelled up to 24 hours before; a booking that starts in 3 hours is late.\n";
  const unanswered =
    "# Open questions\n\n| # | Question | Blocks | Options seen | Answer | Status |\n|---|---|---|---|---|---|\n| Q1 | How much is a late cancellation? | REQ-004 | a flat fee |  | open |\n";
  const answered = unanswered.replace(
    "| a flat fee |  | open |",
    "| a flat fee | 5 euros | answered |"
  );
  const d6 = (questions: string) =>
    checkDraft({
      deltas: [{ path: "specs/bookings/spec.md", source: delta }],
      brief,
      questions,
    }).status.filter(
      (d: { code: string; message: string }) =>
        d.code === "D6_unlisted_value" && /"5/.test(d.message)
    );
  assert.equal(d6(unanswered).length, 1, "before the answer, 5 is unlisted");
  assert.deepEqual(d6(answered), [], "the answer gives it");
});

test("REQ-785 SCN-785a: a branch that changes nothing names no control change, sealed tests included", () => {
  const dir = project();
  assert.equal(cli(dir, ["propose", "export-csv", "--capability", "export"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/export-csv/specs/export/spec.md");
  const id = (fs.readFileSync(delta, "utf8").match(/REQ-\d+/) || ["REQ-002"])[0];
  const scn = `SCN-${id.slice(4)}a`;
  fs.writeFileSync(
    delta,
    [
      "# Delta — export",
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${id} — Export the loans as CSV`,
      "",
      "<!-- specgate:trace actor=Librarian kind=functional -->",
      "",
      "The system SHALL export the loans as CSV, one line a loan, under the header `title,daysLate`.",
      "",
      `#### Scenario: ${scn} — Two loans, two lines`,
      "",
      "- GIVEN two loans",
      "- WHEN the librarian exports them",
      "- THEN the file has the header and two lines",
      "",
    ].join("\n")
  );
  assert.equal(cli(dir, ["change", "approve", "export-csv"], true).status, 0);
  fs.mkdirSync(path.join(dir, "tests", "acceptance"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "tests/acceptance/export.spec.ts"),
    `test("${id} ${scn}", () => {});\n`
  );
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes/export-csv/acceptance-tests.md"),
    `- tests/acceptance/export.spec.ts — ${scn}\n`
  );
  assert.equal(
    cli(dir, ["change", "approve", "export-csv", "--layer", "acceptance"], true).status,
    0
  );
  const git = (...a: string[]) =>
    spawnSync("git", a, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t.invalid",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t.invalid",
      },
    });
  git("checkout", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "sealed");
  git("checkout", "-q", "-b", "feature");
  const { branchControls } = require("../../scripts/lib/controls");
  const r = branchControls(dir, "main");
  assert.equal(r.state, "checked");
  assert.deepEqual(r.changed, []);
});

test("REQ-786 SCN-786a: an id the pack brings and the project already uses is found, not merged in silence", () => {
  const { duplicateRequirementIds } = require("../../scripts/cli/commands/specops/SyncCommand");
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt2-dup-")));
  made.push(dir);
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    "# Spec\n\n## REQ-005 — Receipt\n\nx\n\n## REQ-006 — Reserve a spot\n\nmine\n\n## REQ-006 — Join a waitlist\n\nthe pack's\n"
  );
  assert.deepEqual(duplicateRequirementIds(dir), ["REQ-006"]);
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    "# Spec\n\n## REQ-005 — Receipt\n\n## REQ-006 — Join a waitlist\n"
  );
  assert.deepEqual(duplicateRequirementIds(dir), []);
  // The project's REQ-006 delivered into a capability, the pack's in spec.md.
  fs.mkdirSync(path.join(dir, "docs/specs/capabilities/reservations"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/specs/capabilities/reservations/spec.md"),
    "# Reservations\n\n## Requirements\n\n### Requirement: REQ-006 — Reserve a spot\n"
  );
  assert.deepEqual(duplicateRequirementIds(dir), ["REQ-006"]);
});

test("REQ-784 SCN-784a: a ready draft names the approval next, then apply", () => {
  const { draftNextCommand } = require("../../scripts/cli/commands/spec/DraftCommand");
  const ready = { module: "bookings", change: "draft-bookings", state: "ready", findings: 0 };
  assert.equal(
    draftNextCommand({ ...ready, approved: false }),
    "specgate change approve draft-bookings"
  );
  assert.equal(draftNextCommand({ ...ready, approved: true }), "specgate apply");
  assert.equal(
    draftNextCommand({ ...ready, state: "drafting", findings: 2 }),
    "specgate propose --from-brief bookings"
  );
});

test("REQ-790 SCN-790a: in a project whose package.json says type: module, the plugin's guard still refuses", () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","type":"module"}\n');
  assert.equal(cli(dir, ["agents", "init", "--tool", "claude-plugin"]).status, 0);
  const guard = path.join(dir, ".claude", "specgate-plugin", "scripts", "guard-hook.js");
  const input = JSON.stringify({
    cwd: dir,
    tool_name: "Write",
    tool_input: { file_path: path.join(dir, "src", "x.js"), content: "x" },
  });
  const r = spawnSync(process.execPath, [guard], { cwd: dir, input, encoding: "utf8" });
  assert.equal(r.status, 2, `the guard must refuse, not crash: ${r.stderr}`);
  assert.match(r.stderr, /No change is open/);
});

test("REQ-791 SCN-791a: a first pack over a project with its own specification is refused, nothing written", () => {
  const { ownSpecification } = require("../../scripts/cli/commands/pack/ExpandDomainPackCommand");
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-wt3-own-")));
  made.push(dir);
  assert.equal(ownSpecification(dir), null, "an empty project has nothing of its own");
  fs.mkdirSync(path.join(dir, "docs/specs/capabilities/loans"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/specs/capabilities/loans/spec.md"),
    "# Loans\n\n### Requirement: REQ-012 — Renew a loan\n"
  );
  assert.match(String(ownSpecification(dir)), /1 capability spec/);
  fs.writeFileSync(path.join(dir, "spec.md"), "# Mine\n");
  const before = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
  const packs = path.join(dir, "..", path.basename(dir) + "-packs");
  made.push(packs);
  fs.cpSync(
    path.join(ROOT_DIR, "tests", "fixtures", "pack-upgrade", "v0.1.0"),
    path.join(packs, "backend"),
    { recursive: true }
  );
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      "expand",
      "--pack-root",
      packs,
      "--pack",
      "backend",
      "--project-dir",
      dir,
      "--var",
      "PROJECT_NAME=Lib",
      "--var",
      "PROJECT_SLUG=lib",
      "--var",
      "DOMAIN=loans",
    ],
    { encoding: "utf8" }
  );
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /already has its own specification/);
  assert.equal(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), before, "spec.md untouched");
  // A pack already there: sync's road, not refused here.
  fs.writeFileSync(path.join(dir, ".specops.lock"), "{}");
  assert.equal(ownSpecification(dir), null);
});
