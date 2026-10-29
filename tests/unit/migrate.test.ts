/**
 * `specgate migrate 1.0`: a 0.27 project's open changes moved to the three
 * layers (ADR-0042, REQ-325..329).
 *
 * Every test builds a project the way 0.27.9 left it — `specgate init`, a change
 * opened with `--schema spec-driven`, an archived change — with git and its own
 * identity (CI runners have none), and drives the CLI as a person would.
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

function sg(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

const ARCHIVED = path.join("docs", "specs", "changes", "archive", "2026-01-01-old-rates");
const CHANGE = path.join("docs", "specs", "changes", "add-rates");

/** A committed 0.27.9-style project: one open change, one archived. */
function project027(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-mig-"));
  made.push(root);
  const out = path.join(root, "init");
  const r = sg(root, "init", "--yes", "--out", out, "--no-git", "--keep-matrix");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, "app");
  fs.renameSync(path.join(out, "my-spec-driven-app"), dir);
  const open = sg(dir, "change", "new", "add-rates", "--schema", "spec-driven");
  assert.equal(open.status, 0, open.stdout + open.stderr);
  fs.writeFileSync(
    path.join(dir, CHANGE, "proposal.md"),
    "# Proposal: add-rates\n\n## Why\n\nRates come from the provider.\n\n## Approach\n\nRead the rates once a day.\n"
  );
  fs.mkdirSync(path.join(dir, ARCHIVED), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ARCHIVED, "change.yaml"),
    "specgate_change_version: 1\nschema: spec-driven\n"
  );
  fs.writeFileSync(path.join(dir, ARCHIVED, "proposal.md"), "# Proposal: old-rates\n");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "0.27 project");
  return dir;
}

/** Every file of the project with its content, git's own folder left out. */
function snapshot(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.set(path.relative(dir, p), fs.readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return files;
}

const json = (r: { stdout: string }) => JSON.parse(r.stdout);

test("REQ-325 SCN-325a: an open change written with 0.27", () => {
  const dir = project027();
  const r = sg(dir, "migrate", "1.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const change = path.join(dir, CHANGE);
  assert.match(
    fs.readFileSync(path.join(change, "discover.md"), "utf8"),
    /Rates come from the provider\./
  );
  assert.ok(!fs.existsSync(path.join(change, "proposal.md")), "the proposal became the Discover");
  assert.match(fs.readFileSync(path.join(change, "design.md"), "utf8"), /^# Design: add-rates/);
  assert.match(
    fs.readFileSync(path.join(change, "design.md"), "utf8"),
    /Read the rates once a day\./
  );
  assert.ok(fs.existsSync(path.join(change, "tasks.md")));
  assert.match(fs.readFileSync(path.join(change, "change.yaml"), "utf8"), /^schema: layered$/m);
  const v = sg(dir, "change", "validate", "add-rates");
  assert.equal(v.status, 0, v.stdout + v.stderr);
});

test("REQ-325 SCN-325b: a delivered change", () => {
  const dir = project027();
  const before = snapshot(dir);
  assert.equal(sg(dir, "migrate", "1.0").status, 0);
  const after = snapshot(dir);
  for (const [file, text] of before) {
    if (file.startsWith(ARCHIVED)) assert.equal(after.get(file), text, file);
  }
});

test("REQ-326 SCN-326a: a preview", () => {
  const dir = project027();
  const before = snapshot(dir);
  const r = sg(dir, "migrate", "1.0", "--dry-run", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = json(r).migrate;
  assert.equal(m.dryRun, true);
  const layers = m.steps.find((s: { id: string }) => s.id === "layers");
  const files = layers.actions.map((a: { file: string }) => a.file.replace(/\\/g, "/"));
  assert.ok(files.includes("docs/specs/changes/add-rates/discover.md"), files.join(", "));
  assert.ok(files.includes("docs/specs/changes/add-rates/design.md"), files.join(", "));
  assert.deepEqual(snapshot(dir), before, "a preview writes nothing");
});

test("REQ-326 SCN-326b: a second run", () => {
  const dir = project027();
  assert.equal(sg(dir, "migrate", "1.0").status, 0);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "migrated");
  const before = snapshot(dir);
  const r = sg(dir, "migrate", "1.0", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = json(r).migrate;
  assert.equal(m.applied, 0);
  assert.equal(m.nothingToDo, true);
  assert.deepEqual(snapshot(dir), before);
});

test("REQ-327 SCN-327a: work not committed", () => {
  const dir = project027();
  fs.appendFileSync(path.join(dir, "spec.md"), "\n<!-- an edit -->\n");
  const r = sg(dir, "migrate", "1.0", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(
    json(r).status.some((d: { code: string }) => d.code === "migrate_dirty_tree"),
    r.stdout
  );
  assert.ok(fs.existsSync(path.join(dir, CHANGE, "proposal.md")), "nothing changed");
});

test("REQ-328 SCN-328a: the report of a real run", () => {
  const dir = project027();
  const r = sg(dir, "migrate", "1.0", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = fs.readFileSync(path.join(dir, "docs", "specs", "migration-1.0.md"), "utf8");
  assert.match(report, /add-rates/);
  assert.match(report, /discover\.md/);
  assert.match(report, /design\.md/);
  assert.match(report, /Review .*design\.md/i);
  const m = json(r).migrate;
  assert.deepEqual(
    m.steps.map((s: { id: string }) => s.id),
    ["layers", "config"],
    "the steps are one ordered table"
  );
  assert.ok(
    m.manual.some((x: string) => /design\.md/.test(x)),
    m.manual.join(" | ")
  );
  // The table is the one place a later 1.0 step is added.
  const { MIGRATION_1_0 } = require("../../scripts/lib/migrate");
  assert.deepEqual(
    MIGRATION_1_0.map((s: { id: string }) => s.id),
    ["layers", "config"]
  );
});

test("REQ-329 SCN-329a: a 0.27 project opened with 1.0", () => {
  const dir = project027();
  const text = sg(dir, "status");
  assert.equal(text.stdout.split("specgate migrate 1.0").length - 1, 1, text.stdout);
  const j = sg(dir, "status", "--json");
  assert.deepEqual(json(j).migrate.changes, ["add-rates"]);
  assert.equal(sg(dir, "migrate", "1.0").status, 0);
  assert.doesNotMatch(sg(dir, "status").stdout, /specgate migrate 1\.0/);
  assert.equal(json(sg(dir, "status", "--json")).migrate, undefined);
});
