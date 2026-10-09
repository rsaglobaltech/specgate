"use strict";

/**
 * `init --multi-stack` end to end.
 *
 * The claim being tested is narrow and easy to fake: that the spec is *shared*,
 * not copied. A test that only counted directories would pass on three
 * independent projects that happen to start identical, which is the thing this
 * feature exists not to produce.
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
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { cwd: ROOT_DIR, encoding: "utf8" });
}

function withTree(stacks, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csda-multistack-"));
  try {
    const r = cli("init", "--yes", "--out", tmp, "--multi-stack", stacks, "--no-git");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return fn(path.join(tmp, "my-spec-driven-app"), r);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("one directory per stack, all registered in specops.config.yaml", () => {
  withTree("spring,quarkus,micronaut", (root) => {
    for (const stack of ["spring", "quarkus", "micronaut"]) {
      assert.ok(fs.statSync(path.join(root, stack)).isDirectory(), `${stack}/ should exist`);
    }
    const cfg = fs.readFileSync(path.join(root, "specops.config.yaml"), "utf8");
    for (const stack of ["spring", "quarkus", "micronaut"]) {
      assert.match(cfg, new RegExp(`- \\./${stack}\\b`), `projects: should list ${stack}`);
    }
  });
});

test("the spec is shared, not copied — an edit at the root reaches every stack", () => {
  withTree("spring,quarkus", (root) => {
    const marker = "## REQ-777 — written once, at the root";
    fs.appendFileSync(path.join(root, "spec.md"), `\n${marker}\n`);

    for (const stack of ["spring", "quarkus"]) {
      const seen = fs.readFileSync(path.join(root, stack, "spec.md"), "utf8");
      const link = fs.lstatSync(path.join(root, stack, "spec.md"));
      if (link.isSymbolicLink()) {
        assert.ok(seen.includes(marker), `${stack} should see the root's edit through the link`);
      } else {
        // Windows without Developer Mode: copies, and the gate catches drift.
        // That path is covered by its own test below.
        assert.ok(seen.length > 0, `${stack} should have a spec.md either way`);
      }
    }
  });
});

test("the matrix is NOT shared — artifacts differ per stack", () => {
  withTree("spring,quarkus", (root) => {
    for (const stack of ["spring", "quarkus"]) {
      const matrix = path.join(root, stack, "docs/specs/traceability.md");
      assert.ok(fs.existsSync(matrix), `${stack} needs its own matrix`);
      assert.ok(
        !fs.lstatSync(matrix).isSymbolicLink(),
        `${stack}'s matrix must not point at a shared one — its artifacts are its own`
      );
    }
  });
});

test("each stack's rulebook names its own stack", () => {
  withTree("spring,quarkus", (root) => {
    const spring = fs.readFileSync(path.join(root, "spring/AGENTS.md"), "utf8");
    const quarkus = fs.readFileSync(path.join(root, "quarkus/AGENTS.md"), "utf8");
    assert.match(spring, /spring/i);
    assert.match(quarkus, /quarkus/i);
    assert.notEqual(spring, quarkus, "one rulebook for two toolchains is not a rulebook");
  });
});

test("validate walks every stack from the root and passes", () => {
  withTree("spring,quarkus,micronaut", (root) => {
    const r = cli("validate", root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /3\/3 project\(s\) passed/);
  });
});

test("a generated tree passes its own strict gates", () => {
  // H20 was a generated project that failed its own --strict-tdd from minute
  // zero. Three of them multiply the ways to get that wrong.
  withTree("spring,quarkus", (root) => {
    const r = cli(
      "validate",
      root,
      "--strict-tdd",
      "--strict-links",
      "--strict-requirements",
      "--strict-scenarios"
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test("a copied shared spec that drifts fails the gate", () => {
  withTree("spring,quarkus", (root) => {
    // Reproduce the Windows fallback on any platform: replace the link with a
    // copy. Identical, it passes; edited, it must not.
    const target = path.join(root, "quarkus/spec.md");
    const content = fs.readFileSync(path.join(root, "spec.md"), "utf8");
    fs.rmSync(target);
    fs.writeFileSync(target, content);
    assert.equal(cli("validate", root).status, 0, "an identical copy is not drift");

    fs.appendFileSync(target, "\n## REQ-999 — a requirement only quarkus knows about\n");
    const r = cli("validate", root);
    assert.equal(r.status, 1, "a drifted copy must fail");
    assert.match(r.stdout + r.stderr, /drifted/i);
  });
});

test("an unusable stack list is a usage error that writes nothing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csda-multistack-bad-"));
  try {
    for (const bad of ["spring", "../etc,spring", "spring,spring", ""]) {
      const r = cli("init", "--yes", "--out", tmp, "--multi-stack", bad, "--no-git");
      assert.equal(r.status, 2, `'${bad}' should be a usage error, got ${r.status}`);
      assert.deepEqual(fs.readdirSync(tmp), [], `'${bad}' must not leave a half-built tree`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("--help documents the flag", () => {
  const r = cli("init", "--help");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--multi-stack/);
});
