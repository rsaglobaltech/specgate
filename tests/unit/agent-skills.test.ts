"use strict";

/**
 * REQ-549, REQ-550 — the loop as Agent Skills, and the plugin's manifests kept
 * at the package's version (change agent-skills).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { STEPS } = require("../../scripts/agents/commands");
const { skillBody, skillDirsFor } = require("../../scripts/agents/skills");
const { pluginFiles, PLUGIN_DIR } = require("../../scripts/plugin/sync-claude-plugin");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** A scaffolded project, as `init --yes` leaves it. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-skills-"));
  madeDirs.push(parent);
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}
const skills = (dir: string, ...more: string[]) => {
  const r = spawnSync(
    process.execPath,
    [CLI, "agents", "init", "--format", "skills", "--project-dir", dir, "--json", ...more],
    { encoding: "utf8" }
  );
  return {
    status: r.status,
    out: r.stdout + r.stderr,
    doc: r.status === 0 ? JSON.parse(r.stdout) : null,
  };
};
const frontName = (text: string) => /^---\nname: (\S+)\n/.exec(text)?.[1];

// ── REQ-549 ─────────────────────────────────────────────────────────────────

test("REQ-549 SCN-549a: skills for Cursor", () => {
  const dir = project();
  const r = skills(dir, "--tool", "cursor");
  assert.equal(r.status, 0, r.out);
  for (const base of [".agents/skills", ".cursor/skills"]) {
    const file = path.join(dir, base, "specgate-apply", "SKILL.md");
    assert.ok(fs.existsSync(file), `${base}/specgate-apply/SKILL.md exists`);
    assert.equal(frontName(fs.readFileSync(file, "utf8")), "specgate-apply");
  }
  assert.equal(fs.existsSync(path.join(dir, ".claude", "skills")), false, "only the named tool");
});

test("REQ-549: every step is a skill whose description says when to use it", () => {
  for (const step of STEPS) {
    const body = skillBody(step);
    assert.equal(frontName(body), `specgate-${step.name}`);
    const description = /\ndescription: (.+)\n/.exec(body)?.[1] || "";
    assert.match(description, /Use when:/, step.name);
    assert.doesNotThrow(() => JSON.parse(description), "the description is one quoted line");
  }
});

test("REQ-549: without --tool, the tools whose folder the project has", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-skills-dirs-"));
  madeDirs.push(dir);
  fs.mkdirSync(path.join(dir, ".gemini"));
  assert.deepEqual(
    skillDirsFor(dir, null).map((d: string) => d.split(path.sep).join("/")),
    [".agents/skills", ".gemini/skills"]
  );
  assert.deepEqual(
    skillDirsFor(dir, ["windsurf"]).map((d: string) => d.split(path.sep).join("/")),
    [".agents/skills"],
    "a tool without a skills folder of its own reads the shared one"
  );
});

test("REQ-549: a SKILL.md changed by hand is kept, and said", () => {
  const dir = project();
  assert.equal(skills(dir).status, 0);
  const file = path.join(dir, ".agents", "skills", "specgate-check", "SKILL.md");
  fs.appendFileSync(file, "\nOur team runs the gate twice.\n");
  const again = skills(dir);
  assert.equal(again.status, 0, again.out);
  assert.ok(again.doc.agents.kept.includes(".agents/skills/specgate-check/SKILL.md"));
  assert.equal(again.doc.status.filter((d: { code: string }) => d.code === "skill_kept").length, 1);
  assert.match(fs.readFileSync(file, "utf8"), /runs the gate twice/);
  assert.equal(again.doc.agents.written.length, 0, "the rest are current");

  const forced = skills(dir, "--force");
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /runs the gate twice/);
  assert.equal(forced.doc.agents.kept.length, 0);
});

test("REQ-549: an unknown format is a usage error", () => {
  const dir = project();
  const r = spawnSync(
    process.execPath,
    [CLI, "agents", "init", "--format", "zip", "--project-dir", dir, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(r.status, 2, r.stdout);
  assert.equal(JSON.parse(r.stdout).status[0].code, "format_unknown");
});

// ── REQ-550 ─────────────────────────────────────────────────────────────────

test("REQ-550 SCN-550a: the committed plugin is what the generator renders, at the package's version", () => {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).version;
  const differs: string[] = [];
  for (const f of pluginFiles()) {
    const rel = f.path.split(path.sep).join("/");
    if (!/plugin\.json$|SKILL\.md$/.test(rel)) continue;
    const target = path.join(PLUGIN_DIR, f.path);
    const now = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (now !== f.contents) differs.push(`packages/claude-plugin/${rel}`);
  }
  assert.deepEqual(differs, [], `out of date — run: npm run plugin:sync`);
  for (const manifest of [
    ".claude-plugin/plugin.json",
    "plugin.json",
    ".tessl-plugin/plugin.json",
  ]) {
    const m = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, manifest), "utf8"));
    assert.equal(m.version, version, manifest);
    assert.equal(m.name, "specgate", manifest);
  }
});

test("REQ-550: the manifests list every skill the plugin carries", () => {
  for (const manifest of ["plugin.json", ".tessl-plugin/plugin.json"]) {
    const m = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, manifest), "utf8"));
    assert.deepEqual(
      m.skills,
      STEPS.map((s: { name: string }) => `skills/specgate-${s.name}`)
    );
    for (const s of m.skills) {
      assert.ok(fs.existsSync(path.join(PLUGIN_DIR, s, "SKILL.md")), `${manifest}: ${s}`);
    }
  }
});
