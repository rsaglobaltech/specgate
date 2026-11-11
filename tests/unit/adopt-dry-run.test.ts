/**
 * studio-json-gaps: `adopt --dry-run` lists exactly the files `adopt --yes`
 * writes — README.md and .gitattributes among them (REQ-489).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/cli";

/** A Node project with a test script, a test, Claude Code's marker, no README.md, in git. */
function nodeProject(parent: string, name: string): string {
  const dir = path.join(parent, name);
  fs.mkdirSync(path.join(dir, "src", "orders"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", scripts: { test: "node --test" } }, null, 2) + "\n"
  );
  fs.writeFileSync(path.join(dir, "src", "orders", "orders.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir, "test", "orders.test.js"), "require('node:test');\n");
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Notes for Claude\n");
  const git = (...args: string[]) =>
    cp.spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
      cwd: dir,
      encoding: "utf8",
    });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "start");
  return dir;
}

/** What git sees as new or changed, one path per entry, with `/`. */
function changed(dir: string): string[] {
  const r = cp.spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "-z"], {
    cwd: dir,
    encoding: "utf8",
  });
  return r.stdout
    .split("\0")
    .filter(Boolean)
    .map((e) => e.slice(3))
    .sort();
}

/** The files a dry run says it would write: `+ <path>` lines, and harness.config.yaml for a setting. */
function listed(stdout: string): string[] {
  const out = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const added = /^\s+\+ (\S+)/.exec(line);
    if (added) out.add(added[1]);
    if (/would set .*\(harness\.config\.yaml\)/.test(line)) out.add("harness.config.yaml");
    if (/add the specgate block to AGENTS\.md/.test(line)) out.add("AGENTS.md");
  }
  return [...out].sort();
}

test("REQ-489 SCN-489a: the dry run lists exactly what --yes writes, README.md and .gitattributes among them", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-adopt-dry-"));
  try {
    const dry = nodeProject(parent, "dry");
    const real = nodeProject(parent, "real");
    const env = { ...process.env, NO_COLOR: "1" };

    const r1 = runCli(["adopt", "--dry-run", "--project-dir", dry], { env });
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    assert.deepEqual(changed(dry), [], "the dry run writes nothing");

    const r2 = runCli(["adopt", "--yes", "--project-dir", real], { env });
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    const written = changed(real);

    assert.deepEqual(listed(r1.stdout), written, r1.stdout);
    assert.ok(written.includes("README.md"), written.join(", "));
    assert.ok(written.includes(".gitattributes"), written.join(", "));
    assert.ok(written.includes("harness.config.yaml"), written.join(", "));
    assert.ok(
      written.some((f) => f.startsWith(".claude/commands/")),
      written.join(", ")
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-489: a CI gate already there is not listed, as --yes keeps it", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-adopt-dry-"));
  try {
    const dry = nodeProject(parent, "dry");
    const gate = path.join(dry, ".github", "workflows", "spec-gate.yml");
    fs.mkdirSync(path.dirname(gate), { recursive: true });
    fs.writeFileSync(gate, "name: spec gate\n");
    fs.writeFileSync(path.join(dry, "README.md"), "# Shop\n");
    const r = runCli(["adopt", "--dry-run", "--project-dir", dry], {
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const files = listed(r.stdout);
    assert.ok(!files.includes(".github/workflows/spec-gate.yml"), files.join(", "));
    assert.ok(!files.includes("README.md"), files.join(", "));
    assert.match(r.stdout, /spec-gate\.yml kept as it is/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
