/**
 * person-approves: approving takes a person at a terminal (REQ-748), and the
 * exam proves which Specgate the agent reaches before it starts (REQ-749).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { cliReach, examCli } = require("../../scripts/lib/cli-reach");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const POSIX = process.platform !== "win32";

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

// ── REQ-748 ──

/** A project with export-csv open and approved by nobody, as Codex left it on 2026-11-25. */
function csvProject() {
  const dir = tmp("specgate-approve-");
  const run = (args: string[]) =>
    spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(run(["adopt", "--no-ci"]).status, 0);
  assert.equal(run(["propose", "export-csv", "--capability", "export"]).status, 0);
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
  return dir;
}

const approve = (dir: string, person: boolean) =>
  spawnSync(
    process.execPath,
    [CLI, "change", "approve", "export-csv", "--json", "--project-dir", dir],
    {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: person ? "1" : "" },
    }
  );

test("REQ-748 SCN-748a: an agent's command — no terminal, no approval", () => {
  const dir = csvProject();
  const r = approve(dir, false);
  assert.notEqual(r.status, 0, r.stdout);
  const out = JSON.parse(r.stdout);
  const finding = out.status.find((s: { code: string }) => s.code === "approve_needs_person");
  assert.ok(finding, r.stdout);
  assert.match(finding.message, /person's act/);
  assert.doesNotMatch(finding.fix, /ASSUME_TTY/);
  assert.equal(
    fs.existsSync(path.join(dir, "docs/specs/changes/export-csv/approvals.json")),
    false
  );
});

test("REQ-748 SCN-748b: a person at a terminal approves as before", () => {
  const dir = csvProject();
  const r = approve(dir, true);
  assert.doesNotMatch(r.stdout, /approve_needs_person/);
  assert.ok(
    fs.existsSync(path.join(dir, "docs/specs/changes/export-csv/approvals.json")),
    r.stdout + r.stderr
  );
});

// ── REQ-749 ──

/** A machine with `specgate` installed for every project, in a folder of its own, and a home whose startup files put it first. */
function machine(startup: Record<string, string>) {
  const root = tmp("specgate-reach-");
  const other = path.join(root, "global", "bin");
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, "specgate"), "#!/bin/sh\necho 1.0.0-other\n", { mode: 0o755 });
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  for (const [file, text] of Object.entries(startup))
    fs.writeFileSync(path.join(home, file), text.split("OTHER").join(other));
  const project = path.join(root, "project");
  fs.mkdirSync(project);
  const scratch = path.join(root, "scratch");
  fs.mkdirSync(scratch);
  const env = {
    HOME: home,
    PATH: `${other}:${process.env.PATH}`,
    npm_config_cache: path.join(root, "npm-cache"),
    npm_config_update_notifier: "false",
  };
  return { root, other, home, project, scratch, env };
}

const prepare = (m: ReturnType<typeof machine>, kind: object) => {
  const bin = path.join(m.scratch, "bin");
  const mark = path.join(m.scratch, "mark");
  const extra = examCli(m.scratch, bin, mark, kind, { HOME: m.home });
  return { bin, mark, env: { ...m.env, PATH: `${bin}:${m.env.PATH}`, ...extra } };
};

const hasZsh = POSIX && spawnSync("zsh", ["-c", "true"]).status === 0;
const hasBash = POSIX && spawnSync("bash", ["-c", "true"]).status === 0;

test(
  "REQ-749 SCN-749a: the shell finds another — the run is not started",
  { skip: !hasBash },
  () => {
    // bash's login files are the Developer's, and the exam cannot put itself after them.
    const m = machine({ ".bash_profile": "export PATH=OTHER:$PATH\n" });
    const p = prepare(m, { run: process.execPath, cli: CLI });
    const r = cliReach(m.project, p.env, p.mark, "bash");
    assert.equal(r.ok, false);
    assert.ok(
      r.missed.some((s: string) => s.includes(path.join(m.other, "specgate"))),
      r.missed.join("\n")
    );
  }
);

test("REQ-749 SCN-749b: the one under exam, by both roads", { skip: !hasZsh }, () => {
  const m = machine({
    ".zprofile": "export PATH=OTHER:$PATH\n",
    ".zshenv": "export PATH=OTHER:$PATH\n",
  });
  const p = prepare(m, { run: process.execPath, cli: CLI });
  const r = cliReach(m.project, p.env, p.mark, "zsh");
  assert.deepEqual(r.missed, []);
  assert.equal(r.ok, true);
  // And what answered is the CLI under exam.
  const v = spawnSync("zsh", ["-lc", "specgate --version"], {
    cwd: m.project,
    env: { ...process.env, ...p.env },
    encoding: "utf8",
  });
  assert.equal(
    v.stdout.trim(),
    JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).version
  );
});

test("REQ-749 SCN-749c: the baseline reaches none", { skip: !hasZsh }, () => {
  const m = machine({ ".zprofile": "export PATH=OTHER:$PATH\n" });
  const p = prepare(m, { absent: "specgate: command not found" });
  const r = cliReach(m.project, p.env, p.mark, "zsh");
  assert.equal(r.ok, true, r.missed.join("\n"));
  const v = spawnSync("zsh", ["-lc", "specgate status"], {
    cwd: m.project,
    env: { ...process.env, ...p.env },
    encoding: "utf8",
  });
  assert.equal(v.status, 127);
  assert.match(v.stderr, /not found/);
  const n = spawnSync("npx", ["--no-install", "specgate", "status"], {
    cwd: m.project,
    env: { ...process.env, ...p.env },
    encoding: "utf8",
  });
  assert.notEqual(n.status, 0);
  assert.doesNotMatch(n.stdout, /1\.0\.0-other/);
});
