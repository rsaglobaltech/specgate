/**
 * sealed-acceptance: a change's acceptance tests, written by another hand,
 * approved by a person and sealed (REQ-757); a changed one fails the gate
 * (REQ-758); the gate runs them with the project's own command (REQ-759); no
 * tool of the agent writes one, and the judge sees one changed (REQ-760).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const {
  acceptanceRun,
  acceptanceSealDiagnostics,
  readAcceptanceSeals,
} = require("../../scripts/lib/acceptance");
const { decide } = require("../../scripts/plugin/guard-hook");
const { controlsOf, sessionChanged } = require("../../scripts/lib/controls");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const tmp = (p: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), p));
  made.push(d);
  return fs.realpathSync(d);
};

const sha = (text: string) =>
  `sha256:${createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex")}`;

const cli = (dir: string, args: string[], person = true) =>
  spawnSync(
    process.execPath,
    [CLI, ...args, ...(args[0] === "check" ? [] : ["--project-dir", dir])],
    {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
        SPECGATE_ASSUME_TTY: person ? "1" : "",
        SPECGATE_SKIP_DOCTOR: "1",
      },
    }
  );

/** A project with export-csv open, its delta written; the scenario's id is returned. */
function csvProject(): { dir: string; scn: string } {
  const dir = tmp("specgate-acceptance-");
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli(dir, ["adopt", "--no-ci"]).status, 0);
  assert.equal(cli(dir, ["propose", "export-csv", "--capability", "export"]).status, 0);
  const delta = path.join(dir, "docs/specs/changes/export-csv/specs/export/spec.md");
  const id = (fs.readFileSync(delta, "utf8").match(/REQ-\d+/) || ["REQ-002"])[0];
  const n = id.slice(4);
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
      `#### Scenario: SCN-${n}a — Two loans, two lines`,
      "",
      "- GIVEN two loans",
      "- WHEN the librarian exports them",
      "- THEN the file has the header and two lines",
      "",
    ].join("\n")
  );
  return { dir, scn: `SCN-${n}a` };
}

const write = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

const TEST = "tests/acceptance/export.spec.ts";
const TEST_TEXT = "test('two loans, two lines', () => { /* the writer's */ });\n";

/** export-csv approved, with one acceptance test listed for its scenario. */
function listed(): { dir: string; scn: string } {
  const p = csvProject();
  assert.equal(cli(p.dir, ["change", "approve", "export-csv"]).status, 0);
  write(p.dir, TEST, TEST_TEXT);
  write(
    p.dir,
    "docs/specs/changes/export-csv/acceptance-tests.md",
    `# Acceptance\n\n- ${TEST} — ${p.scn}\n`
  );
  return p;
}

const sealAcceptance = (dir: string, person = true) =>
  cli(dir, ["change", "approve", "export-csv", "--layer", "acceptance", "--json"], person);

const codes = (stdout: string): string[] => {
  try {
    const doc = JSON.parse(stdout.slice(stdout.indexOf("{")));
    const all = [...(doc.status || []), ...(doc.diagnostics || []), ...(doc.findings || [])];
    for (const s of doc.stages || []) all.push(...(s.findings || []));
    return all.map((d: { code: string }) => d.code);
  } catch {
    return [];
  }
};

// ── REQ-757 ──

test("REQ-757 SCN-757a: sealed as they are — the approval holds the file's sha256", () => {
  const { dir } = listed();
  const r = sealAcceptance(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const record = readAcceptanceSeals(dir, "export-csv");
  assert.ok(record, "an acceptance record");
  assert.equal(record.layer, "acceptance");
  assert.deepEqual(record.seals, { [TEST]: sha(TEST_TEXT) });
  // The layers' approvals still read: the change is approved as before.
  const show = cli(dir, ["change", "approve", "export-csv", "--json"]);
  assert.equal(show.status, 0, show.stdout);
});

test("REQ-757 SCN-757b: a test that proves no scenario — refused, nothing recorded", () => {
  const { dir } = listed();
  write(dir, "docs/specs/changes/export-csv/acceptance-tests.md", `- ${TEST} — SCN-999z\n`);
  const r = sealAcceptance(dir);
  assert.notEqual(r.status, 0, r.stdout);
  assert.ok(codes(r.stdout).includes("acceptance_unknown_scenario"), r.stdout);
  assert.match(r.stdout, /SCN-999z/);
  assert.equal(readAcceptanceSeals(dir, "export-csv"), null);
});

test("REQ-757: a listed file that is not there, or a change not approved — refused", () => {
  const { dir, scn } = listed();
  write(
    dir,
    "docs/specs/changes/export-csv/acceptance-tests.md",
    `- tests/acceptance/missing.spec.ts — ${scn}\n`
  );
  let r = sealAcceptance(dir);
  assert.notEqual(r.status, 0);
  assert.ok(codes(r.stdout).includes("acceptance_file_missing"), r.stdout);

  const fresh = csvProject();
  write(fresh.dir, TEST, TEST_TEXT);
  write(
    fresh.dir,
    "docs/specs/changes/export-csv/acceptance-tests.md",
    `- ${TEST} — ${fresh.scn}\n`
  );
  r = cli(fresh.dir, ["change", "approve", "export-csv", "--layer", "acceptance", "--json"]);
  assert.notEqual(r.status, 0);
  assert.ok(codes(r.stdout).includes("acceptance_change_not_approved"), r.stdout);
  assert.equal(readAcceptanceSeals(fresh.dir, "export-csv"), null);
});

test("REQ-757: sealing is approving — no terminal, no seal (REQ-748)", () => {
  const { dir } = listed();
  const r = sealAcceptance(dir, false);
  assert.notEqual(r.status, 0);
  assert.ok(codes(r.stdout).includes("approve_needs_person"), r.stdout);
  assert.match(r.stdout, /change approve export-csv --layer acceptance/);
  assert.equal(readAcceptanceSeals(dir, "export-csv"), null);
});

test("REQ-757 SCN-757c: any language — a Maven integration test is sealed the same way", () => {
  const { dir, scn } = listed();
  const java = "src/test/java/shop/FeesAcceptanceIT.java";
  const text =
    "package shop;\nclass FeesAcceptanceIT { @org.junit.jupiter.api.Test void fees() {} }\n";
  write(dir, java, text);
  write(dir, "docs/specs/changes/export-csv/acceptance-tests.md", `- ${java} — ${scn}\n`);
  assert.equal(sealAcceptance(dir).status, 0);
  assert.deepEqual(readAcceptanceSeals(dir, "export-csv").seals, { [java]: sha(text) });
});

// ── REQ-758 ──

test("REQ-758 SCN-758a, REQ-780 SCN-780a: one byte changed — the gate fails with acceptance_not_sealed and says what to do", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  assert.deepEqual(acceptanceSealDiagnostics(dir, "export-csv").errors, []);
  write(dir, TEST, TEST_TEXT.replace("two lines", "two linez"));
  const found = acceptanceSealDiagnostics(dir, "export-csv").errors;
  assert.equal(found.length, 1);
  assert.equal(found[0].code, "acceptance_not_sealed");
  assert.match(found[0].message, /tests\/acceptance\/export\.spec\.ts/);
  const r = cli(dir, ["check", "--json"]);
  assert.notEqual(r.status, 0);
  assert.ok(codes(r.stdout).includes("acceptance_not_sealed"), r.stdout);
  // The verdict says what was approved changed — not "fix its delta".
  assert.ok(codes(r.stdout).includes("check_approved_changed"), r.stdout);
  assert.ok(!codes(r.stdout).includes("check_change_invalid"), r.stdout);
});

test("REQ-758: a sealed test that is gone fails too; line endings are not a change", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  write(dir, TEST, TEST_TEXT.replace(/\n/g, "\r\n"));
  assert.deepEqual(acceptanceSealDiagnostics(dir, "export-csv").errors, []);
  fs.rmSync(path.join(dir, TEST));
  const found = acceptanceSealDiagnostics(dir, "export-csv").errors;
  assert.equal(found[0]?.code, "acceptance_not_sealed");
  assert.match(found[0].message, /gone/);
});

test("REQ-758 SCN-758b: approved again — acceptance_not_sealed is gone", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  write(dir, TEST, `${TEST_TEXT}// the person agreed\n`);
  assert.equal(acceptanceSealDiagnostics(dir, "export-csv").errors.length, 1);
  assert.equal(sealAcceptance(dir).status, 0);
  assert.deepEqual(acceptanceSealDiagnostics(dir, "export-csv").errors, []);
  const r = cli(dir, ["check", "--json"]);
  assert.ok(!codes(r.stdout).includes("unknown_flag"), r.stdout);
  assert.ok(!codes(r.stdout).includes("acceptance_not_sealed"), r.stdout);
});

// ── REQ-759 ──

const setCmd = (dir: string, cmd: string) =>
  fs.appendFileSync(
    path.join(dir, "harness.config.yaml"),
    `\nacceptance_cmd: '${cmd.replace(/'/g, "''")}'\n`
  );

test("REQ-759 SCN-759a: red is red — acceptance_red with the command's output", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  setCmd(dir, `node -e "console.log('ran', process.argv[1]); process.exit(1)" {files}`);
  const v = acceptanceRun(dir);
  assert.equal(v.ran, true);
  assert.equal(v.errors[0]?.code, "acceptance_red");
  assert.match(v.errors[0].message, new RegExp(`ran ${TEST.replace(/\./g, "\\.")}`));
});

test("REQ-759: green passes, and {files} is the sealed paths", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  setCmd(dir, `node -e "process.exit(process.argv[1] === '${TEST}' ? 0 : 3)" {files}`);
  const v = acceptanceRun(dir);
  assert.equal(v.ran, true);
  assert.deepEqual(v.errors, []);
});

test("REQ-759 SCN-759b: no command — acceptance_no_command, nothing installed", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  const list = () =>
    spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: dir,
      encoding: "utf8",
    }).stdout;
  const before = list();
  const v = acceptanceRun(dir);
  assert.equal(v.errors[0]?.code, "acceptance_no_command");
  assert.match(v.errors[0].fix, /acceptance_cmd/);
  assert.equal(list(), before);
  assert.ok(!fs.existsSync(path.join(dir, "node_modules")));
});

test("REQ-759: a project with no sealed tests runs nothing", () => {
  const { dir } = csvProject();
  const v = acceptanceRun(dir);
  assert.equal(v.ran, false);
  assert.deepEqual(v.errors, []);
});

// ── REQ-760 ──

test("REQ-760 SCN-760a: each road refused — Write, a patch, sed -i, a redirect, git checkout", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  const env = {};
  const refused = (input: Record<string, unknown>) => {
    const d = decide({ cwd: dir, ...input }, env);
    assert.equal(d.allow, false, JSON.stringify(input));
    assert.match(d.message, /acceptance_sealed/);
    return d;
  };
  refused({ tool_name: "Write", tool_input: { file_path: path.join(dir, TEST), content: "pass" } });
  refused({ tool_name: "Edit", tool_input: { file_path: TEST, old_string: "a", new_string: "b" } });
  refused({
    tool_name: "apply_patch",
    tool_input: {
      command: `*** Begin Patch\n*** Update File: ${TEST}\n@@\n-a\n+b\n*** End Patch\n`,
    },
  });
  refused({ tool_name: "Bash", tool_input: { command: `sed -i '' 's/two/one/' ${TEST}` } });
  refused({ tool_name: "Bash", tool_input: { command: `echo pass > ./${TEST}` } });
  refused({ tool_name: "Bash", tool_input: { command: `git checkout HEAD~1 -- ${TEST}` } });
  refused({ tool_name: "Bash", tool_input: { command: `cp /tmp/fake.ts ${TEST}` } });
  // Reading it is allowed; so is writing a test that is not sealed.
  assert.equal(
    decide({ cwd: dir, tool_name: "Bash", tool_input: { command: `cat ${TEST}` } }, env).allow,
    true
  );
  assert.equal(
    decide(
      {
        cwd: dir,
        tool_name: "Write",
        tool_input: { file_path: "tests/unit/mine.test.ts", content: "x" },
      },
      env
    ).allow,
    true
  );
});

test("REQ-760 SCN-760b: changed where no hook runs — the judge reports it", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  const before = controlsOf(dir);
  assert.deepEqual(sessionChanged(dir, before), []);
  write(dir, TEST, "test('always', () => {});\n");
  const changed = sessionChanged(dir, before);
  assert.ok(
    changed.some((c: string) => /acceptance test/.test(c) && c.includes(TEST)),
    changed.join("; ")
  );
});

test("REQ-758, REQ-759: the rule acceptance fails strict and standard gates, warns in minimal", () => {
  const { PRESET_RULES, RULE_MEANING } = require("../../scripts/lib/gate-policy");
  assert.equal(PRESET_RULES.strict.acceptance, "error");
  assert.equal(PRESET_RULES.standard.acceptance, "error");
  assert.equal(PRESET_RULES.minimal.acceptance, "warning");
  assert.match(RULE_MEANING.acceptance, /acceptance_cmd/);
});

test("REQ-760 SCN-760c: the sealed test came first — a source write is allowed by it", () => {
  const { dir, scn } = listed();
  const id = scn.replace(/^SCN-(\d+)\w$/, "REQ-$1");
  write(dir, TEST, `test("${id} ${scn} — two loans, two lines", () => {});\n`);
  assert.equal(sealAcceptance(dir).status, 0);
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t.invalid", "commit", "-qm", "sealed"],
    { cwd: dir }
  );
  const d = decide(
    {
      cwd: dir,
      tool_name: "Write",
      tool_input: { file_path: "src/export.ts", content: "export {}" },
    },
    {}
  );
  assert.equal(d.allow, true, d.message);
  // A sealed test that names nothing of the change does not open the door.
  const other = listed();
  assert.equal(sealAcceptance(other.dir).status, 0);
  spawnSync("git", ["add", "-A"], { cwd: other.dir });
  spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t.invalid", "commit", "-qm", "sealed"],
    { cwd: other.dir }
  );
  assert.equal(
    decide(
      {
        cwd: other.dir,
        tool_name: "Write",
        tool_input: { file_path: "src/export.ts", content: "export {}" },
      },
      {}
    ).allow,
    false
  );
});

test("REQ-757: a line of acceptance-tests.md without its bullet is read; prose is not", () => {
  const { acceptanceList } = require("../../scripts/lib/acceptance");
  const { dir, scn } = listed();
  write(
    dir,
    "docs/specs/changes/export-csv/acceptance-tests.md",
    `# Acceptance\n\nThese prove the export - see below.\n\n${TEST} — ${scn}\n- \`src/test/java/A.java\` — ${scn}\n`
  );
  const list = acceptanceList(dir, "export-csv");
  assert.deepEqual(
    list.map((l: { path: string }) => l.path),
    [TEST, "src/test/java/A.java"]
  );
});

test("REQ-757 SCN-757d: the sign-off checklist is not a list of tests — acceptance.md stays specgate acceptance's", () => {
  const p = csvProject();
  assert.equal(cli(p.dir, ["change", "approve", "export-csv"]).status, 0);
  const checklist = cli(p.dir, ["acceptance", "export-csv"]);
  assert.equal(checklist.status, 0, checklist.stdout + checklist.stderr);
  const file = path.join(p.dir, "docs/specs/changes/export-csv/acceptance.md");
  const before = fs.readFileSync(file, "utf8");
  const r = sealAcceptance(p.dir);
  assert.notEqual(r.status, 0);
  assert.ok(codes(r.stdout).includes("acceptance_not_listed"), r.stdout);
  assert.match(r.stdout, /acceptance-tests\.md/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.equal(readAcceptanceSeals(p.dir, "export-csv"), null);
});

test("REQ-779 SCN-779a: the seal outlives the change — an archived change's sealed test is still checked and guarded", () => {
  const { dir } = listed();
  assert.equal(sealAcceptance(dir).status, 0);
  const archive = path.join(dir, "docs/specs/changes/archive");
  fs.mkdirSync(archive, { recursive: true });
  fs.renameSync(
    path.join(dir, "docs/specs/changes/export-csv"),
    path.join(archive, "2026-11-26-export-csv")
  );
  setCmd(dir, "node -e 0");
  assert.deepEqual(acceptanceRun(dir).errors, []);
  write(dir, TEST, "test('always', () => {});\n");
  const v = acceptanceRun(dir);
  assert.equal(v.errors[0]?.code, "acceptance_not_sealed");
  assert.match(v.errors[0].message, /acceptance-tests\.md/);
  const d = decide(
    { cwd: dir, tool_name: "Write", tool_input: { file_path: TEST, content: "x" } },
    {}
  );
  assert.equal(d.allow, false);
  assert.match(d.message, /acceptance_sealed/);
});
