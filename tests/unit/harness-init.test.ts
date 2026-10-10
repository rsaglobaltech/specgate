"use strict";

/**
 * `harness init` — the command that closes the gap between a config file the
 * docs described and a config file anything actually wrote.
 *
 * The load-bearing assertion here is the *absence* of a `test_cmd` when none
 * could be detected. A placeholder like `echo "set this"` exits 0, which makes
 * the extra gate pass unconditionally and lets the harness mark requirements
 * done without running a single test. An unset key is safe, because
 * `harness run` always runs `validate --strict-tdd` regardless.
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
const { detectTestCommand } = require("../../scripts/harness/init");

function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-hinit-"));
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

function run(projectDir, ...args) {
  return spawnSync(process.execPath, [CLI, "harness", "init", ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });
}

test("writes both files and reports what it wrote", () => {
  const { parent, projectDir } = scaffold();
  try {
    const r = run(projectDir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(projectDir, "harness.config.yaml")));
    assert.ok(fs.existsSync(path.join(projectDir, ".harness", "prompt-prefix.md")));
    assert.match(r.stdout, /harness\.config\.yaml/);
    assert.match(r.stdout, /prompt-prefix\.md/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("leaves test_cmd unset rather than writing a placeholder that exits 0", () => {
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir);
    const config = fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8");
    const live = config
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    assert.ok(!/^\s*test_cmd:/m.test(live), "test_cmd must not be set when none was detected");
    assert.ok(!/echo /.test(live), "no echo placeholder — it would pass the gate unconditionally");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("warns when no test command was detected, and says why that is safe", () => {
  const { parent, projectDir } = scaffold();
  try {
    const r = run(projectDir, "--json");
    const doc = JSON.parse(r.stdout);
    const codes = doc.status.map((d) => d.code);
    assert.ok(codes.includes("harness_test_cmd_unset"), `codes: ${codes.join(", ")}`);
    assert.equal(doc.testCmd, null);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("detects the gate from the build file that is present", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csda-detect-"));
  try {
    assert.equal(detectTestCommand(dir), null);

    fs.writeFileSync(path.join(dir, "pom.xml"), "<project/>", "utf8");
    assert.equal(detectTestCommand(dir), "mvn -B test");
    fs.rmSync(path.join(dir, "pom.xml"));

    // `verify` wins over `test`: in a spec-driven repo `test` often includes
    // the end-to-end suite, which stays red until the last requirement lands.
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ scripts: { test: "vitest", verify: "npm run typecheck && vitest run" } }),
      "utf8"
    );
    assert.equal(detectTestCommand(dir), "npm run verify");

    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ scripts: { test: "vitest" } }),
      "utf8"
    );
    assert.equal(detectTestCommand(dir), "npm test");

    // A malformed manifest must not abort scaffolding.
    fs.writeFileSync(path.join(dir, "package.json"), "{ not json", "utf8");
    assert.equal(detectTestCommand(dir), "npm test");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("--test-cmd overrides detection", () => {
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir, "--test-cmd", "make check");
    const config = fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8");
    assert.match(config, /^test_cmd: "make check"$/m);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("refuses to overwrite, and names the flag that would", () => {
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir);
    fs.writeFileSync(path.join(projectDir, "harness.config.yaml"), "hand: edited\n", "utf8");
    const again = run(projectDir);
    assert.equal(again.status, 1);
    assert.match(again.stderr, /--force/);
    assert.equal(
      fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8"),
      "hand: edited\n",
      "the hand-edited file must survive"
    );

    const forced = run(projectDir, "--force");
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(
      fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8"),
      /harness_version/
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--stdout prints both files and touches nothing", () => {
  const { parent, projectDir } = scaffold();
  try {
    const r = run(projectDir, "--stdout");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /harness_version: 1/);
    assert.match(r.stdout, /Active project boundary/);
    assert.ok(!fs.existsSync(path.join(projectDir, "harness.config.yaml")));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the generated config leaves the agent unset on purpose", () => {
  // A committed default agent is a default somebody pays for by accident.
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir);
    const config = fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8");
    const live = config
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    assert.ok(!/^\s*agent:/m.test(live), "agent must not be set");
    assert.match(config, /# agent: /, "but it must be shown, commented, as a template");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the generated prefix forbids editing the specification", () => {
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir);
    const prefix = fs.readFileSync(path.join(projectDir, ".harness", "prompt-prefix.md"), "utf8");
    assert.match(prefix, /features\/\*\*\/\*\.feature/);
    assert.match(prefix, /docs\/specs/);
    // The scaffolded fixture has no Gherkin runner, so the prefix must not
    // tell its agent to write step definitions — measured on PetClinic,
    // where `grep -ci cucumber pom.xml` is 0 and the prompt asked anyway.
    assert.match(prefix, /no Gherkin runner/i);
    assert.doesNotMatch(prefix, /step_definitions/);
    // No unrendered template tokens.
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(prefix), "unrendered placeholder left in the prefix");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("what it writes is what `harness run` reads", () => {
  // The seam that matters: a config this command generates must parse in the
  // reader that consumes it, including resolving prompt_prefix_file.
  const { parent, projectDir } = scaffold();
  try {
    run(projectDir);
    const {
      readHarnessConfig,
    } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
    const cfg = readHarnessConfig(projectDir);
    assert.ok(cfg, "generated config did not parse");
    assert.equal(cfg.maxAttempts, 3);
    assert.match(cfg.promptPrefix, /Active project boundary/);
    assert.equal(cfg.agent, undefined, "agent is deliberately unset");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── #71: a config written by `config set` is merged, not refused ────────────
test("#71: harness init keeps the test_cmd that config set wrote, and adds the rest", () => {
  const { parent, projectDir } = scaffold();
  try {
    const set = spawnSync(process.execPath, [CLI, "config", "set", "test_cmd", "mvn -q -B test"], {
      cwd: projectDir,
      encoding: "utf8",
    });
    assert.equal(set.status, 0, set.stdout + set.stderr);
    const r = run(projectDir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const body = fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8");
    assert.match(body, /^test_cmd: "mvn -q -B test"$/m, "the chosen test command survives");
    assert.equal(body.match(/^test_cmd:/gm).length, 1, "and is not written twice");
    assert.match(body, /^max_attempts: /m);
    assert.match(body, /^prompt_prefix_file: /m);
    assert.ok(fs.existsSync(path.join(projectDir, ".harness", "prompt-prefix.md")));

    // A second run has nothing to add and changes nothing.
    const again = run(projectDir);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.equal(fs.readFileSync(path.join(projectDir, "harness.config.yaml"), "utf8"), body);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
