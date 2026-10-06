"use strict";

/**
 * `specgate update` — refreshing generated files without discarding local edits.
 *
 * The behaviour that matters is the one nobody tests until it bites: a team
 * edits a generated instruction file, the CLI is upgraded, and the upgrade must
 * neither clobber the edit nor silently skip the file. Three-way merge is the
 * only answer that does both, and a conflict has to be reported rather than
 * resolved on the user's behalf.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { updateFile, generatedFiles, BASELINE_DIR } = require("../../scripts/update");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "update-"));
  const r = cli(
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, "acme-energy-hub");
  assert.equal(
    cli("agents", "init", "--project-dir", dir, "--tool", "claude", "--force").status,
    0
  );
  try {
    fn(dir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const REL = path.join(".claude", "commands", "specgate", "propose.md");

/** Put a file, its baseline, and the incoming version into a known state. */
function stage(dir, { local, base }: { local: string; base?: string }) {
  fs.writeFileSync(path.join(dir, REL), local, "utf8");
  if (base !== undefined) {
    const b = path.join(dir, BASELINE_DIR, REL);
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.writeFileSync(b, base, "utf8");
  }
}

test("a file with no baseline is adopted, not clobbered", () => {
  // Every project that predates `update` is in this state. Merging against an
  // empty base would report every line as a conflict.
  withProject((dir) => {
    stage(dir, { local: "hand written\n" });
    const result = updateFile(dir, { path: REL, contents: "generated\n" }, { dryRun: false });

    assert.equal(result.outcome, "adopted");
    assert.equal(fs.readFileSync(path.join(dir, REL), "utf8"), "hand written\n");
    // And it starts tracking from here, so the next update can merge properly.
    assert.ok(fs.existsSync(path.join(dir, BASELINE_DIR, REL)));
  });
});

test("an upstream change lands when the file was not edited locally", () => {
  withProject((dir) => {
    stage(dir, { local: "line one\nline two\n", base: "line one\nline two\n" });
    const result = updateFile(
      dir,
      { path: REL, contents: "line one\nline two\nline three\n" },
      { dryRun: false }
    );
    assert.equal(result.outcome, "updated");
    assert.match(fs.readFileSync(path.join(dir, REL), "utf8"), /line three/);
  });
});

test("a local edit survives an upstream change to a different part", () => {
  // The whole point of the command.
  withProject((dir) => {
    stage(dir, {
      base: "header\nmiddle\nfooter\n",
      local: "header\nMY TEAM RULE\nmiddle\nfooter\n",
    });
    const result = updateFile(
      dir,
      { path: REL, contents: "header\nmiddle\nfooter\nNEW UPSTREAM LINE\n" },
      { dryRun: false }
    );

    assert.equal(result.outcome, "updated");
    const merged = fs.readFileSync(path.join(dir, REL), "utf8");
    assert.match(merged, /MY TEAM RULE/, "the local edit survives");
    assert.match(merged, /NEW UPSTREAM LINE/, "the upstream change lands");
  });
});

test("a genuine conflict is marked and reported, never resolved silently", () => {
  withProject((dir) => {
    stage(dir, { base: "the original line\n", local: "our version of the line\n" });
    const result = updateFile(
      dir,
      { path: REL, contents: "their version of the line\n" },
      { dryRun: false }
    );

    assert.equal(result.outcome, "conflict");
    assert.ok(result.conflicts > 0);
    const merged = fs.readFileSync(path.join(dir, REL), "utf8");
    assert.match(merged, /<<<<<<</);
    assert.match(merged, /our version of the line/);
    assert.match(merged, /their version of the line/);
  });
});

test("an unchanged file is left alone", () => {
  withProject((dir) => {
    stage(dir, { local: "same\n", base: "same\n" });
    const result = updateFile(dir, { path: REL, contents: "same\n" }, { dryRun: false });
    assert.equal(result.outcome, "unchanged");
  });
});

test("upstream not moving means the local file is intentional", () => {
  withProject((dir) => {
    stage(dir, { base: "generated\n", local: "generated, then edited\n" });
    const result = updateFile(dir, { path: REL, contents: "generated\n" }, { dryRun: false });
    assert.equal(result.outcome, "unchanged");
    assert.equal(fs.readFileSync(path.join(dir, REL), "utf8"), "generated, then edited\n");
  });
});

test("--dry-run writes neither the file nor the baseline", () => {
  withProject((dir) => {
    stage(dir, { base: "a\n", local: "a\n" });
    const before = fs.readFileSync(path.join(dir, REL), "utf8");
    updateFile(dir, { path: REL, contents: "a\nb\n" }, { dryRun: true });
    assert.equal(fs.readFileSync(path.join(dir, REL), "utf8"), before);
    assert.equal(fs.readFileSync(path.join(dir, BASELINE_DIR, REL), "utf8"), "a\n");
  });
});

test("update never introduces a tool the project did not opt into", () => {
  // The project asked for claude only. Cursor's rule file must not appear.
  withProject((dir) => {
    const paths = generatedFiles(dir).map((f) => f.path);
    assert.ok(
      paths.some((p) => p.includes("commands")),
      "claude's files are tracked"
    );
    assert.ok(!paths.some((p) => p.includes(".cursor")), "cursor was never opted into");

    cli("update", "--project-dir", dir);
    assert.ok(!fs.existsSync(path.join(dir, ".cursor")), "update must not create it either");
  });
});

test("a conflict is surfaced as a diagnostic with a fix", () => {
  withProject((dir) => {
    stage(dir, { base: "original\n", local: "ours\n" });
    // Force the incoming side to differ by regenerating from a modified baseline.
    fs.writeFileSync(path.join(dir, BASELINE_DIR, REL), "original\n", "utf8");

    const r = cli("update", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    const conflicts = doc.status.filter((d) => d.code === "update_conflict");
    for (const d of conflicts) {
      assert.ok(d.fix, "a conflict the user has to resolve must say how");
      assert.match(d.fix, /<<<<<<</);
    }
  });
});

// ── The csda → specgate rename ───────────────────────────────────────────────
//
// Agent files were generated under the tool's old name, so a team typed
// `specgate` in the terminal and `/csda:apply` in their agent. `update` moves
// them, keeps the team's edits, and leaves no `/csda:` behind.

/** What 0.9 generated: today's files under the old name, with no baseline. */
function asGeneratedBy09(dir) {
  const fresh = path.join(dir, ".claude", "commands", "specgate");
  const old = path.join(dir, ".claude", "commands", "csda");
  fs.renameSync(fresh, old);
  for (const f of fs.readdirSync(old)) {
    const p = path.join(old, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").split("/specgate:").join("/csda:"));
  }
  fs.rmSync(path.join(dir, BASELINE_DIR), { recursive: true, force: true });
}

test("update moves csda agent files to specgate, keeping the team's edits", () => {
  withProject((dir) => {
    asGeneratedBy09(dir);
    const old = path.join(dir, ".claude", "commands", "csda", "apply.md");
    fs.appendFileSync(old, "\nOur team runs the integration suite before /csda:verify.\n");

    const r = cli("update", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const outcomes = JSON.parse(r.stdout).update.files.map((f) => f.outcome);
    assert.ok(outcomes.includes("renamed"), JSON.stringify(outcomes));

    assert.ok(!fs.existsSync(path.join(dir, ".claude", "commands", "csda")), "old dir removed");
    const moved = fs.readFileSync(
      path.join(dir, ".claude", "commands", "specgate", "apply.md"),
      "utf8"
    );
    assert.match(moved, /^# \/specgate:apply/m, "the generated heading took the new name");
    assert.match(moved, /Our team runs the integration suite/, "the edit survived");

    const again = JSON.parse(cli("update", "--project-dir", dir, "--json").stdout);
    assert.ok(
      again.update.files.every((f) => f.outcome === "unchanged"),
      "a second run is a no-op"
    );
  });
});

test("update refuses to choose when both the csda and specgate files exist", () => {
  withProject((dir) => {
    const old = path.join(dir, ".claude", "commands", "csda", "apply.md");
    fs.mkdirSync(path.dirname(old), { recursive: true });
    fs.writeFileSync(old, "# edited under the old name\n");

    const r = JSON.parse(cli("update", "--project-dir", dir, "--json").stdout);
    assert.ok(
      r.status.some((d) => d.code === "rename_conflict"),
      JSON.stringify(r.status)
    );
    assert.ok(fs.existsSync(old), "neither file is deleted");
  });
});

test("the project's own README is never taken for the Claude plugin's", () => {
  // Same path, different file: `update` adopted it as the plugin README, and
  // the next run would have merged the plugin's README into it.
  withProject((dir) => {
    const readme = path.join(dir, "README.md");
    const before = fs.readFileSync(readme, "utf8");
    assert.ok(!generatedFiles(dir).some((f) => f.path === "README.md"));
    cli("update", "--project-dir", dir);
    assert.equal(fs.readFileSync(readme, "utf8"), before);
    assert.ok(!fs.existsSync(path.join(dir, BASELINE_DIR, "README.md")));
  });
});
