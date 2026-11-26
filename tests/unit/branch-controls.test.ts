/**
 * branch-controls REQ-754: what a branch changes in the controls is named, by
 * `check --base`, for the person who reviews it.
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

/** A project on main, adopted and committed; its work goes on the branch `work`. */
function project(policy = ""): { dir: string; git: (...a: string[]) => void; check: () => { status: number; codes: string[]; out: string } } {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-branch-controls-")));
  made.push(dir);
  const env = { ...process.env, NO_COLOR: "1", SPECGATE_ASSUME_TTY: "1" };
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  const adopted = spawnSync(process.execPath, [CLI, "adopt", "--no-ci", "--project-dir", dir], { cwd: dir, encoding: "utf8", env });
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  if (policy) {
    fs.mkdirSync(path.join(dir, ".specgate"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".specgate", "gate.yaml"), policy);
  }
  git("add", "-A");
  git("commit", "-qm", "main");
  git("checkout", "-qb", "work");
  const check = () => {
    const r = spawnSync(process.execPath, [CLI, "check", "--base", "main", "--json"], { cwd: dir, encoding: "utf8", env });
    const doc = JSON.parse(r.stdout);
    const codes = [...(doc.status || []), ...(doc.stages || []).flatMap((s: { findings: { code: string }[] }) => s.findings)].map((f: { code: string }) => f.code);
    assert.ok(!codes.includes("unknown_flag"), r.stdout);
    // The base was compared with: what is said or not said of the controls is the branch's.
    assert.doesNotMatch(r.stdout, /ids_not_compared/);
    return { status: r.status ?? -1, codes, out: r.stdout };
  };
  return { dir, git, check };
}

const guardOff = (dir: string) => {
  const file = path.join(dir, ".specgate", "config.json");
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, `${JSON.stringify({ ...config, agent_guard: "off" }, null, 2)}\n`);
};

test("REQ-754 SCN-754a: the guard switched off on a branch is named, and the gate passes", () => {
  const p = project();
  guardOff(p.dir);
  p.git("add", "-A");
  p.git("commit", "-qm", "guard off");
  const r = p.check();
  assert.ok(r.codes.includes("controls_changed_on_branch"), r.out);
  assert.match(r.out, /the guard was switched off on this branch, against main/);
  assert.equal(r.status, 0, r.out);
});

test("REQ-754 SCN-754b: with controls: error the gate fails", () => {
  const p = project("preset: standard\nrules:\n  controls: error\n");
  guardOff(p.dir);
  p.git("add", "-A");
  p.git("commit", "-qm", "guard off");
  const r = p.check();
  assert.notEqual(r.status, 0, r.out);
  assert.ok(r.codes.includes("controls_changed_on_branch"), r.out);
});

test("REQ-754 SCN-754c: an archived change, and a branch that changed only code, are told nothing", () => {
  const p = project();
  // On main: a change, approved.
  p.git("checkout", "-q", "main");
  const changes = path.join(p.dir, "docs", "specs", "changes", "export-csv");
  fs.mkdirSync(changes, { recursive: true });
  fs.writeFileSync(path.join(changes, "change.yaml"), "specgate_change_version: 1\nschema: layered\napproved: 2026-11-25\n");
  fs.writeFileSync(path.join(changes, "approvals.json"), '[{"layer":"design","by":{"name":"A","email":"a@a"},"hash":"sha256:x","at":"2026-11-25"}]\n');
  p.git("add", "-A");
  p.git("commit", "-qm", "approved on main");
  p.git("checkout", "-q", "work");
  p.git("merge", "-q", "main");
  // The branch archives it.
  const archive = path.join(p.dir, "docs", "specs", "changes", "archive");
  fs.mkdirSync(archive, { recursive: true });
  p.git("mv", path.join("docs", "specs", "changes", "export-csv"), path.join("docs", "specs", "changes", "archive", "2026-11-25-export-csv"));
  p.git("commit", "-qm", "archived");
  const archived = p.check();
  assert.ok(!archived.codes.includes("controls_changed_on_branch"), archived.out);

  // Only code.
  fs.mkdirSync(path.join(p.dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(p.dir, "src", "x.js"), "module.exports = 1;\n");
  p.git("add", "-A");
  p.git("commit", "-qm", "code");
  const code = p.check();
  assert.ok(!code.codes.includes("controls_changed_on_branch"), code.out);
});
