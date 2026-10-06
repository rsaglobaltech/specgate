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
const PKG = require(path.join(ROOT_DIR, "package.json"));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    ...options,
  });
}

test("shows the core help with no args", () => {
  const result = runCli([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /specgate/);
  assert.doesNotMatch(
    result.stdout,
    /create-spec-driven-app/,
    "the old name must not appear in the surface a newcomer meets first (ADR-0024)"
  );
  assert.match(result.stdout, /\bUSAGE\b/i);
  // Eight commands, not twenty-one. The rest are one flag away.
  assert.match(result.stdout, /START HERE/);
  assert.match(result.stdout, /specgate --help --all/);
  assert.doesNotMatch(result.stdout, /expand --pack-root/);
});

test("--help --all shows the whole surface", () => {
  const result = runCli(["--help", "--all"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /expand --pack-root/);
  assert.match(result.stdout, /PACK COMMANDS/);
  assert.match(result.stdout, /SPECOPS COMMANDS/);
  assert.ok(
    result.stdout.split("\n").length > runCli([]).stdout.split("\n").length,
    "the full help should be longer than the core one"
  );
});

test("shows version from package.json", () => {
  const result = runCli(["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), PKG.version);
});

test("returns usage error for unknown command", () => {
  const result = runCli(["unknown-cmd"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Unknown command/);
});

test("runs init in dry-run mode with example config", () => {
  const result = runCli([
    "init",
    "--config",
    "examples/project.config.example",
    "--out",
    os.tmpdir(),
    "--dry-run",
    "--no-git",
    "--keep-matrix",
    "--force",
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[dry-run\] project would be generated at:/);
  assert.match(result.stdout, /Generation completed/);
});

test("returns usage error for validate without project dir", () => {
  const result = runCli(["validate"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expects exactly one positional argument/);
});

test("expands domain pack in dry-run mode", () => {
  const fixtureRoot = path.join("tests", "fixtures", "domain-packs");
  const result = runCli([
    "expand",
    "--pack-root",
    fixtureRoot,
    "--pack",
    "parking-management/backend",
    "--project-dir",
    path.join(os.tmpdir(), "smart-parking"),
    "--var",
    "PROJECT_NAME=Smart Parking Backend",
    "--var",
    "PROJECT_SLUG=smart-parking",
    "--var",
    "DOMAIN=parking operations",
    "--dry-run",
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Using pack:/);
  assert.match(result.stdout, /\[dry-run\] write/);
  assert.match(result.stdout, /Generated 5 scenario file\(s\)/);
});

/**
 * H20 — a generated project did not pass its own gates.
 *
 * `templates/base/spec.md.tpl` §8 shipped a pre-filled `REQ-001` example, and
 * `traceability.md.tpl` has only `REQ-000`. So every project born from
 * `specgate init` failed `validate --strict-tdd` with `[TDD-3]` before anyone
 * wrote a line — and `specgate harness run` on a new project burned all three
 * agent attempts on a failure the agent neither caused nor could fix.
 *
 * Found on 2026-08-26 while building the fixture to reproduce H19.
 *
 * The check is worth its runtime because the defect is invisible from inside:
 * the plain `validate` these tests already ran was green throughout.
 */
test("a generated project passes every gate it ships with", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-fresh-gates-"));
  try {
    const init = runCli(["init", "--yes", "--out", tempRoot, "--no-git", "--keep-matrix"]);
    assert.equal(init.status, 0, init.stdout + init.stderr);

    const projectDir = path.join(tempRoot, "my-spec-driven-app");
    assert.ok(fs.existsSync(path.join(projectDir, "spec.md")), init.stdout + init.stderr);

    for (const gate of [
      "--strict-tdd",
      "--strict-scenarios",
      "--strict-requirements",
      "--strict-links",
    ]) {
      const r = runCli(["validate", projectDir, gate]);
      assert.equal(r.status, 0, `${gate} failed on a fresh project:\n${r.stdout}${r.stderr}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

/**
 * `specgate req` had two silent failures, both found timing a newcomer's first
 * path through the tool on 2026-08-26.
 *
 * `execute()` matched "list" / "add" / "link" and fell off the end of the
 * function for anything else — `--help` and any misspelled subcommand printed
 * nothing and exited 0. Worse: `req done <REQ>` fell into that same silent gap,
 * and `req`'s own "Next:" hint recommends it after every `add` and `list`.
 * Following the tool's own advice did nothing.
 */
test("req --help prints usage instead of nothing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-req-help-"));
  try {
    const init = runCli(["init", "--yes", "--out", tempRoot, "--no-git", "--keep-matrix"]);
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(tempRoot, "my-spec-driven-app");

    const help = runCli(["req", "--help"], { cwd: projectDir });
    assert.equal(help.status, 0, help.stdout + help.stderr);
    assert.match(help.stdout, /specgate req add/);
    assert.match(help.stdout, /specgate req done/);

    const unknown = runCli(["req", "bogus-subcommand"], { cwd: projectDir });
    assert.equal(unknown.status, 2, "an unrecognised req subcommand must not exit 0 silently");
    assert.match(unknown.stdout, /specgate req add/, "should fall back to the same usage text");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("req done marks the requirement Implemented, not a silent no-op", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-req-done-"));
  try {
    const init = runCli(["init", "--yes", "--out", tempRoot, "--no-git", "--keep-matrix"]);
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(tempRoot, "my-spec-driven-app");

    const done = runCli(["req", "done", "REQ-000"], { cwd: projectDir });
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.match(done.stdout, /Implemented/);

    const matrix = fs.readFileSync(path.join(projectDir, "docs/specs/traceability.md"), "utf8");
    assert.match(
      matrix,
      /\| REQ-000 \|.*\| Implemented \|/,
      "the matrix row must actually flip — this is what req done exists to do"
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("can init and validate a generated project end-to-end", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-e2e-"));
  const slug = `spec-driven-${Date.now()}`;
  const configPath = path.join(tempRoot, "project.config");
  const projectDir = path.join(tempRoot, slug);

  const config = [
    'PROJECT_NAME="E2E Spec Driven"',
    `PROJECT_SLUG="${slug}"`,
    'PROJECT_TYPE="backend"',
    'DOMAIN="automation testing"',
    'STACK="Quarkus 3.x, Java 21, PostgreSQL, RESTEasy Reactive, SmallRye GraphQL, Maven"',
    'API_STYLE="REST and GraphQL with DTO boundaries"',
    'TESTING="Quarkus Test, Testcontainers, JUnit 5, Cucumber"',
    'LANG="en"',
    'MODULES="auth"',
  ].join("\n");

  fs.writeFileSync(configPath, `${config}\n`, "utf8");

  const initResult = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);

  assert.equal(initResult.status, 0);
  assert.ok(fs.existsSync(projectDir), "project directory should exist");

  const validateResult = runCli(["validate", projectDir]);
  assert.equal(validateResult.status, 0);
  assert.match(validateResult.stdout, /Validation passed/);

  const aiRules = fs.readFileSync(path.join(projectDir, "AI_RULES.md"), "utf8");
  assert.match(aiRules, /Stack: Quarkus 3\.x, Java 21, PostgreSQL/);
  assert.match(aiRules, /Do not infer or replace the stack/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("can init, expand, and validate a generated project end-to-end", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-expand-e2e-"));
  const slug = `parking-spec-driven-${Date.now()}`;
  const configPath = path.join(tempRoot, "project.config");
  const projectDir = path.join(tempRoot, slug);

  const config = [
    'PROJECT_NAME="Parking E2E"',
    `PROJECT_SLUG="${slug}"`,
    'PROJECT_TYPE="backend"',
    'DOMAIN="parking operations"',
    'STACK="Quarkus 3.x, Java 21, PostgreSQL, RESTEasy Reactive, SmallRye GraphQL, Maven"',
    'API_STYLE="REST and GraphQL with DTO boundaries"',
    'TESTING="Quarkus Test, Testcontainers, JUnit 5, Cucumber"',
    'LANG="en"',
    'MODULES=""',
  ].join("\n");

  fs.writeFileSync(configPath, `${config}\n`, "utf8");

  const initResult = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);

  assert.equal(initResult.status, 0);
  assert.ok(fs.existsSync(projectDir), "project directory should exist");

  const packRoot = path.join(ROOT_DIR, "tests", "fixtures", "domain-packs");
  const expandResult = runCli([
    "expand",
    "--pack-root",
    packRoot,
    "--pack",
    "parking-management/backend",
    "--project-dir",
    projectDir,
    "--var",
    "PROJECT_NAME=Parking E2E",
    "--var",
    `PROJECT_SLUG=${slug}`,
    "--var",
    "DOMAIN=parking operations",
  ]);

  assert.equal(expandResult.status, 0);
  assert.ok(
    fs.existsSync(path.join(projectDir, "features", "capacity", "capacity_threshold.feature"))
  );
  assert.ok(fs.existsSync(path.join(projectDir, "docs", "specs", "domain-model.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "docs", "specs", "use-cases.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "docs", "specs", "commands.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "docs", "specs", "events.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "docs", "specs", "aggregates.md")));

  const aiRules = fs.readFileSync(path.join(projectDir, "AI_RULES.md"), "utf8");
  assert.match(aiRules, /Stack: Quarkus 3\.x, Java 21, PostgreSQL/);
  assert.match(aiRules, /Testing: Quarkus Test, Testcontainers, JUnit 5, Cucumber/);
  assert.match(aiRules, /Do not infer or replace the stack/);

  const traceability = fs.readFileSync(
    path.join(projectDir, "docs", "specs", "traceability.md"),
    "utf8"
  );
  assert.match(
    traceability,
    /\| Requirement \| Scenario ID \| Feature file \| Use Case \| Command\/Query \| Aggregate \| Event \| Technical artifact \| Test artifact \| Status \|/
  );
  assert.match(traceability, /REQ-001/);
  assert.match(traceability, /SCN-001/);
  assert.match(traceability, /UC-001 Monitor Capacity Threshold/);
  assert.match(traceability, /CMD-001 CheckCapacityThresholdCommand/);
  assert.match(traceability, /AGG-001 ParkingFacility/);
  assert.match(traceability, /EVT-001 CapacityThresholdReached/);

  const domainModel = fs.readFileSync(
    path.join(projectDir, "docs", "specs", "domain-model.md"),
    "utf8"
  );
  assert.match(domainModel, /BC-001/);
  assert.match(domainModel, /Parking Operations/);
  assert.match(domainModel, /AGG-001/);

  const validateResult = runCli(["validate", projectDir]);
  assert.equal(validateResult.status, 0);
  assert.match(validateResult.stdout, /Validation passed/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// SpecOps: expand --pack-repo + .specops.lock

function gitInTest(args, opts = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    // stdout as well as stderr: a commit with nothing to commit exits non-zero
    // and says so on *stdout*, so reporting only stderr showed nothing but line
    // ending warnings. That cost a CI round to work out.
    throw new Error(`git ${args.join(" ")} failed:\n${result.stdout || ""}${result.stderr || ""}`);
  }
}

/**
 * A fixture repository that does not rewrite what the test wrote.
 *
 * With `core.autocrlf` on — the Windows default — git normalises line endings
 * on checkout and back on add, so a fixture that edits a file to LF finds
 * nothing to commit and `git commit` exits non-zero. These tests are about
 * matrix merges and prompt archives, not line endings.
 */
function gitInitForTest(dir: string) {
  gitInTest(["init", "--quiet", "--initial-branch=main", dir]);
  gitInTest(["-C", dir, "config", "core.autocrlf", "false"]);
  gitInTest(["-C", dir, "config", "user.email", "cli-test@example.com"]);
  gitInTest(["-C", dir, "config", "user.name", "CLI Test"]);
}

function hasGit() {
  return spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
}

test(
  "expand --pack-repo clones a remote pack and writes .specops.lock",
  { skip: !hasGit() },
  () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-specops-e2e-"));
    const remoteRepo = path.join(tempRoot, "remote-pack");
    const cacheDir = path.join(tempRoot, "cache");
    const projectDir = path.join(tempRoot, "project");

    fs.mkdirSync(remoteRepo, { recursive: true });
    fs.cpSync(
      path.join(ROOT_DIR, "tests", "fixtures", "domain-packs", "parking-management"),
      path.join(remoteRepo, "parking-management"),
      { recursive: true }
    );
    gitInTest(["init", "--quiet", "--initial-branch=main", remoteRepo]);
    gitInTest(["config", "user.email", "test@example.com"], { cwd: remoteRepo });
    gitInTest(["config", "user.name", "Test"], { cwd: remoteRepo });
    gitInTest(["config", "commit.gpgsign", "false"], { cwd: remoteRepo });
    gitInTest(["config", "tag.gpgsign", "false"], { cwd: remoteRepo });
    gitInTest(["add", "."], { cwd: remoteRepo });
    gitInTest(["commit", "--quiet", "-m", "initial"], { cwd: remoteRepo });
    gitInTest(["tag", "v0.1.0"], { cwd: remoteRepo });

    fs.mkdirSync(projectDir, { recursive: true });
    const result = runCli([
      "expand",
      "--pack-repo",
      remoteRepo,
      "--pack-version",
      "v0.1.0",
      "--pack",
      "parking-management/backend",
      "--project-dir",
      projectDir,
      "--cache-dir",
      cacheDir,
      "--var",
      "PROJECT_NAME=Smart Parking",
      "--var",
      "PROJECT_SLUG=smart-parking",
      "--var",
      "DOMAIN=parking operations",
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Resolving remote pack/);
    assert.match(result.stdout, /Cloned pack at/);

    assert.ok(fs.existsSync(path.join(projectDir, "AI_RULES.md")));
    assert.ok(
      fs.existsSync(path.join(projectDir, "features", "capacity", "capacity_threshold.feature"))
    );

    const lockPath = path.join(projectDir, ".specops.lock");
    assert.ok(fs.existsSync(lockPath), ".specops.lock should be written");
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    assert.equal(lock.specops_version, 1);
    assert.equal(lock.packs.length, 1);
    assert.equal(lock.packs[0].pack_id, "parking-management/backend");
    assert.equal(lock.packs[0].version, "v0.1.0");
    assert.match(lock.packs[0].commit, /^[0-9a-f]{40}$/);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
);

test(
  "expand --pack-repo without --pack-version exits with a clear error",
  { skip: !hasGit() },
  () => {
    const result = runCli([
      "expand",
      "--pack-repo",
      "https://example.com/x.git",
      "--pack",
      "backend",
      "--project-dir",
      "/tmp/never-written",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--pack-version/);
  }
);

test("expand rejects --pack-root and --pack-repo together", () => {
  const result = runCli([
    "expand",
    "--pack-root",
    "./packs",
    "--pack-repo",
    "https://example.com/x.git",
    "--pack-version",
    "v1.0.0",
    "--pack",
    "backend",
    "--project-dir",
    "/tmp/never-written",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /either --pack-root or --pack-repo/);
});

// ── SpecOps sync: conflict detection (M3) ───────────────────────────────

function makeFixtureRemoteRepo(tempRoot) {
  const remoteRepo = path.join(tempRoot, "remote-pack");
  fs.mkdirSync(remoteRepo, { recursive: true });
  fs.cpSync(
    path.join(ROOT_DIR, "tests", "fixtures", "domain-packs", "parking-management"),
    path.join(remoteRepo, "parking-management"),
    { recursive: true }
  );
  gitInTest(["init", "--quiet", "--initial-branch=main", remoteRepo]);
  gitInTest(["config", "user.email", "test@example.com"], { cwd: remoteRepo });
  gitInTest(["config", "user.name", "Test"], { cwd: remoteRepo });
  gitInTest(["config", "commit.gpgsign", "false"], { cwd: remoteRepo });
  gitInTest(["config", "tag.gpgsign", "false"], { cwd: remoteRepo });
  gitInTest(["add", "."], { cwd: remoteRepo });
  gitInTest(["commit", "--quiet", "-m", "initial"], { cwd: remoteRepo });
  gitInTest(["tag", "v0.1.0"], { cwd: remoteRepo });
  return remoteRepo;
}

test("specops sync preserves local edits instead of overwriting them", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-specops-sync-keep-"));
  const remoteRepo = makeFixtureRemoteRepo(tempRoot);
  const cacheDir = path.join(tempRoot, "cache");
  const projectDir = path.join(tempRoot, "project");
  fs.mkdirSync(projectDir, { recursive: true });

  const initial = runCli([
    "expand",
    "--pack-repo",
    remoteRepo,
    "--pack-version",
    "v0.1.0",
    "--pack",
    "parking-management/backend",
    "--project-dir",
    projectDir,
    "--cache-dir",
    cacheDir,
    "--var",
    "PROJECT_NAME=Smart Parking",
    "--var",
    "PROJECT_SLUG=smart-parking",
    "--var",
    "DOMAIN=parking operations",
  ]);
  assert.equal(initial.status, 0, initial.stderr);

  // expand should record a baseline manifest for the conflict detector.
  assert.ok(
    fs.existsSync(path.join(projectDir, ".specops", "manifest.json")),
    "expand should write .specops/manifest.json"
  );

  // Hand-edit a generated file the way a human or an AI agent would.
  const aiRulesPath = path.join(projectDir, "AI_RULES.md");
  const edited = `${fs.readFileSync(aiRulesPath, "utf8")}\n<!-- my local note -->\n`;
  fs.writeFileSync(aiRulesPath, edited, "utf8");

  // Re-sync at the SAME version: the pack did not change this file, so the
  // local edit must survive.
  const syncResult = runCli([
    "specops",
    "sync",
    "--project-dir",
    projectDir,
    "--cache-dir",
    cacheDir,
  ]);
  assert.equal(syncResult.status, 0, syncResult.stderr);
  assert.match(syncResult.stdout, /kept/);
  assert.equal(
    fs.readFileSync(aiRulesPath, "utf8"),
    edited,
    "sync must not clobber the local edit"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("specops sync errors when .specops.lock is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-specops-nolock-"));
  fs.mkdirSync(tempRoot, { recursive: true });
  const result = runCli(["specops", "sync", "--project-dir", tempRoot]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No \.specops\.lock or specops\.config\.yaml found/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("specops with unknown sub-command exits non-zero", () => {
  const result = runCli(["specops", "bogus"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown specops sub-command/);
});

test("plan --format json returns a stable, parseable structure", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-plan-json-"));
  const slug = `plan-json-${Date.now()}`;
  const configPath = path.join(tempRoot, "project.config");
  const projectDir = path.join(tempRoot, slug);
  fs.writeFileSync(
    configPath,
    [
      'PROJECT_NAME="Plan JSON"',
      `PROJECT_SLUG="${slug}"`,
      'PROJECT_TYPE="backend"',
      'DOMAIN="planning"',
      'STACK="Quarkus"',
      'API_STYLE="REST"',
      'TESTING="JUnit"',
      'LANG="en"',
      'MODULES=""',
    ].join("\n") + "\n",
    "utf8"
  );
  runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  const planResult = runCli(["plan", "--project-dir", projectDir, "--format", "json"]);
  assert.equal(planResult.status, 0, planResult.stderr);
  const parsed = JSON.parse(planResult.stdout);
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(parsed.projectDir);
  assert.ok(Array.isArray(parsed.requirements));
  assert.ok(Array.isArray(parsed.orphanFeatures));
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("plan rejects an invalid --format", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-plan-bad-format-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "docs", "specs", "traceability.md"), "# x\n", "utf8");
  const result = runCli(["plan", "--project-dir", tempRoot, "--format", "yaml"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid --format/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("done refuses an invalid REQ-id", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-done-bad-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "docs", "specs", "traceability.md"), "# x\n", "utf8");
  const result = runCli(["done", "not-a-req", "--project-dir", tempRoot]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid REQ-id/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("specops add requires --pack-repo OR --pack-root", () => {
  const result = runCli(["specops", "add", "--pack", "x/y"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Either --pack-repo .* or --pack-root/);
});

test("specops add requires --pack-version when --pack-repo is used", () => {
  const result = runCli([
    "specops",
    "add",
    "--pack-repo",
    "https://example.com/x.git",
    "--pack",
    "backend",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--pack-version/);
});

test("specops remove exits non-zero when pack-id is not in lockfile", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-remove-missing-"));
  fs.writeFileSync(
    path.join(tempRoot, ".specops.lock"),
    JSON.stringify({ specops_version: 1, csda_version: "0.0.0", packs: [] })
  );
  const result = runCli(["specops", "remove", "ghost/pack", "--project-dir", tempRoot]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not found/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── Harness: plan → agent → verify → done loop (M5) ──────────────────────

// Build a minimal spec-driven project that passes `validate --strict-tdd`
// and has exactly one pending requirement (REQ-001, no artifacts on disk).
/**
 * @param extraReqs additional independent requirements, e.g. ["REQ-002"].
 *                  They declare no dependencies, so they may run in parallel.
 */
/**
 * JS that creates the test and production artifacts the prompt declares.
 *
 * The harness gate is `validate --strict`, the same gate CI runs, so an
 * attempt that leaves a declared file missing fails `declared_artifact_missing`.
 * These agents used to write only `agent-ran.txt` and passed because the
 * harness ran the weaker `--strict-tdd` — green on a requirement whose
 * `src/health.js` did not exist.
 */
const WRITE_DECLARED_ARTIFACTS = [
  "const fs = require('node:fs'); const p = require('node:path');",
  "const prompt = fs.readFileSync(process.argv[2], 'utf8');",
  "for (const re of [/^- Test artifact \\(write this first — TDD\\): (.+)$/m, /^- Production artifact: (.+)$/m]) {",
  "  const m = re.exec(prompt); if (!m) continue;",
  "  const rel = m[1].replace(/`/g, '').trim(); if (rel.startsWith('(')) continue;",
  "  fs.mkdirSync(p.dirname(rel), { recursive: true }); fs.writeFileSync(rel, '// written by the fixture agent\\n');",
  "}",
].join("\n");

/** An agent script that implements what the prompt declares, then runs `extraJs`. */
function implementingAgent(tempRoot, extraJs = "fs.writeFileSync('agent-ran.txt', 'ok');") {
  const file = path.join(tempRoot, `implementing-agent-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(file, `${WRITE_DECLARED_ARTIFACTS}\n${extraJs}\n`, "utf8");
  return `node "${file}" {prompt_file}`;
}

function makeHarnessProject(tempRoot, extraReqs: string[] = []) {
  const projectDir = path.join(tempRoot, "project");
  fs.mkdirSync(path.join(projectDir, "features"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "docs", "specs", "adr"), { recursive: true });

  fs.writeFileSync(
    path.join(projectDir, "spec.md"),
    "# Spec\n\n## REQ-001 — Health endpoint\n\nExpose a health check.\n",
    "utf8"
  );
  fs.writeFileSync(path.join(projectDir, "AI_RULES.md"), "# AI Rules\n\nStack: Node 20.\n", "utf8");
  fs.writeFileSync(path.join(projectDir, "README.md"), "# Harness Fixture\n", "utf8");
  fs.writeFileSync(path.join(projectDir, "docs", "specs", "adr", "README.md"), "# ADRs\n", "utf8");
  fs.writeFileSync(
    path.join(projectDir, "features", "health.feature"),
    "Feature: Health\n  Scenario: The health endpoint reports the service as up\n    Given the service is up\n    When a client requests /health\n    Then /health returns 200\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectDir, "docs", "specs", "traceability.md"),
    [
      "# Traceability Matrix",
      "",
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
      "|---|---|---|---|---|---|---|---|---|---|",
      "| REQ-001 | SCN-001 | `features/health.feature` | UC-001 | CMD-001 | AGG-001 | EVT-001 | `src/health.js` | `test/health.test.js` | Draft |",
      ...extraReqs.map((id) => {
        const n = id.replace("REQ-", "");
        return (
          `| ${id} | SCN-${n} | \`features/f${n}.feature\` | UC-${n} | CMD-${n} | AGG-${n} | ` +
          `EVT-${n} | \`src/f${n}.js\` | \`test/f${n}.test.js\` | Draft |`
        );
      }),
      "",
    ].join("\n"),
    "utf8"
  );

  for (const id of extraReqs) {
    const n = id.replace("REQ-", "");
    fs.appendFileSync(
      path.join(projectDir, "spec.md"),
      `\n## ${id} — Feature ${n}\n\nDo the ${n} thing.\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectDir, "features", `f${n}.feature`),
      `Feature: F${n}\n  Scenario: Feature ${n} answers its endpoint\n    Given the service is up\n    When a client requests /f${n}\n    Then /f${n} returns 200\n`,
      "utf8"
    );
  }

  gitInitForTest(projectDir);
  gitInTest(["config", "user.email", "test@example.com"], { cwd: projectDir });
  gitInTest(["config", "user.name", "Test"], { cwd: projectDir });
  gitInTest(["config", "commit.gpgsign", "false"], { cwd: projectDir });
  gitInTest(["add", "."], { cwd: projectDir });
  gitInTest(["commit", "--quiet", "-m", "initial"], { cwd: projectDir });
  return projectDir;
}

test("harness run --dry-run prints prompts without touching git", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-dry-"));
  const projectDir = makeHarnessProject(tempRoot);

  const result = runCli(["harness", "run", "--project-dir", projectDir, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Implement REQ-001/);
  assert.match(result.stdout, /branch harness\/REQ-001/);

  // No worktree or branch should have been created.
  const branches = spawnSync("git", ["-C", projectDir, "branch", "--list", "harness/*"], {
    encoding: "utf8",
  });
  assert.equal(branches.stdout.trim(), "");

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("harness run errors when no agent is configured", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-noagent-"));
  const projectDir = makeHarnessProject(tempRoot);

  const result = runCli(["harness", "run", "--project-dir", projectDir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No agent configured/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("harness run refuses a dirty working tree", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-dirty-"));
  const projectDir = makeHarnessProject(tempRoot);
  fs.writeFileSync(path.join(projectDir, "uncommitted.txt"), "wip\n", "utf8");

  const result = runCli([
    "harness",
    "run",
    "--project-dir",
    projectDir,
    "--agent",
    `node -e "" {prompt_file}`,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not clean/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test(
  "harness run drives a requirement to pass: worktree, gate, done, commit",
  { skip: !hasGit() },
  () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-pass-"));
    const projectDir = makeHarnessProject(tempRoot);

    // Agent: drop a file proving it ran, then consume the prompt file.
    const result = runCli([
      "harness",
      "run",
      "--project-dir",
      projectDir,
      "--agent",
      // Implements what the prompt declares and drops a file proving it ran.
      implementingAgent(tempRoot),
    ]);

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /REQ-001\s+pass/);
    assert.match(result.stdout, /1 passed/);

    // The harness/REQ-001 branch exists with the agent's file + done's status flip.
    const branches = spawnSync("git", ["-C", projectDir, "branch", "--list", "harness/REQ-001"], {
      encoding: "utf8",
    });
    assert.match(branches.stdout, /harness\/REQ-001/);

    const show = spawnSync("git", ["-C", projectDir, "show", "harness/REQ-001:agent-ran.txt"], {
      encoding: "utf8",
    });
    assert.equal(show.status, 0, "agent's file should be committed on the branch");

    const trace = spawnSync(
      "git",
      ["-C", projectDir, "show", "harness/REQ-001:docs/specs/traceability.md"],
      { encoding: "utf8" }
    );
    assert.match(trace.stdout, /REQ-001 \|.*\| Implemented \|/);

    // The main working tree is untouched — completely. The prompt archive used
    // to be written here, which left the tree dirty and blocked the next run,
    // since the harness refuses to start on a dirty tree.
    const status = spawnSync("git", ["-C", projectDir, "status", "--porcelain"], {
      encoding: "utf8",
    }).stdout.trim();
    assert.equal(status, "", "the harness must leave the project tree clean");

    // The prompt is archived in the branch, so it arrives in the diff a
    // reviewer reads rather than in a directory only the operator sees.
    const archived = spawnSync(
      "git",
      ["-C", projectDir, "ls-tree", "-r", "--name-only", "harness/REQ-001"],
      { encoding: "utf8" }
    ).stdout;
    assert.match(
      archived,
      /\.specops\/harness-prompts\/REQ-001-/,
      "the prompt should be committed on the branch under review"
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
);

test("harness run skips an existing branch unless --force", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-skip-"));
  const projectDir = makeHarnessProject(tempRoot);
  gitInTest(["branch", "harness/REQ-001"], { cwd: projectDir });

  const result = runCli([
    "harness",
    "run",
    "--project-dir",
    projectDir,
    "--agent",
    `node -e "" {prompt_file}`,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /REQ-001\s+skipped/);
  assert.match(result.stdout, /already exists/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test(
  "harness run --concurrency 2 drives every requirement through a worker",
  { skip: !hasGit() },
  () => {
    // The parallel path spawns a worker process per requirement. Nothing
    // exercised it end to end, so it broke silently when the command moved out
    // of its entry-point file: the worker started the module that *defines* the
    // command rather than the one that *runs* it, loaded, did nothing and
    // exited 0 — which the parent reported as "Worker produced no report".
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-par-"));
    const projectDir = makeHarnessProject(tempRoot, ["REQ-002"]);

    const result = runCli([
      "harness",
      "run",
      "--project-dir",
      projectDir,
      "--concurrency",
      "2",
      "--agent",
      implementingAgent(tempRoot),
    ]);

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /REQ-001\s+pass/);
    assert.match(result.stdout, /REQ-002\s+pass/);
    assert.doesNotMatch(result.stdout, /produced no report/);

    for (const id of ["REQ-001", "REQ-002"]) {
      const show = spawnSync("git", ["-C", projectDir, "show", `harness/${id}:agent-ran.txt`], {
        encoding: "utf8",
      });
      assert.equal(show.status, 0, `the agent should have run for ${id}`);
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
);

test("a parallel run records itself once, not once per worker", { skip: !hasGit() }, () => {
  // `harness report` reads every file in .harness/runs, so a worker writing
  // its own record counts the same requirement twice and inflates both
  // "requirements attempted" and "cost per delivered REQ".
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-rec-"));
  const projectDir = makeHarnessProject(tempRoot, ["REQ-002"]);

  const result = runCli([
    "harness",
    "run",
    "--project-dir",
    projectDir,
    "--concurrency",
    "2",
    "--agent",
    implementingAgent(tempRoot),
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);

  const runsDir = path.join(projectDir, ".harness", "runs");
  const records = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json"));
  assert.equal(records.length, 1, `expected one record, got: ${records.join(", ")}`);

  const record = JSON.parse(fs.readFileSync(path.join(runsDir, records[0]), "utf8"));
  assert.equal(record.concurrency, 2, "the record should describe the run a person started");
  assert.deepEqual(
    record.results.map((r: any) => r.requirement).sort(),
    ["REQ-001", "REQ-002"],
    "the parent's record must carry every requirement, not one worker's slice"
  );

  const report = runCli(["harness", "report", "--project-dir", projectDir]);
  assert.match(report.stdout, /requirements attempted\s+2/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("a reviewer advises the next step and can never reach the gate", { skip: !hasGit() }, () => {
  // The roles ladder: attempt 1 implements, attempt 2 runs an advisory
  // reviewer and then implements again with its findings. The reviewer here
  // deliberately misbehaves — it writes a file — because "advisory" has to be
  // enforced, not trusted.
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-roles-"));
  const projectDir = makeHarnessProject(tempRoot);
  const marker = path.join(tempRoot, "attempts.txt");

  // Agents as files rather than `node -e` one-liners: the quoting needed to
  // survive a shell, a YAML string and a JS literal is its own bug farm.
  const implPath = path.join(tempRoot, "impl.js");
  fs.writeFileSync(
    implPath,
    [
      `const marker = ${JSON.stringify(marker)};`,
      "const seen = require('node:fs').existsSync(marker);",
      "const n = seen ? Number(require('node:fs').readFileSync(marker, 'utf8')) : 0;",
      "require('node:fs').writeFileSync(marker, String(n + 1));",
      "if (n === 0) process.exit(3);",
      WRITE_DECLARED_ARTIFACTS,
      "fs.writeFileSync('agent-ran.txt', /Reviewer findings/.test(prompt) ? 'saw-findings' : 'no-findings');",
    ].join("\n"),
    "utf8"
  );
  const reviewPath = path.join(tempRoot, "review.js");
  fs.writeFileSync(
    reviewPath,
    [
      "require('node:fs').writeFileSync('reviewer-sneaked-this-in.txt', 'x');",
      "console.log('FINDING: missing null check.');",
    ].join("\n"),
    "utf8"
  );

  fs.mkdirSync(path.join(projectDir, ".harness"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, ".harness", "profiles.yaml"),
    [
      "profiles:",
      "  implementer:",
      `    agent: "node ${implPath} {prompt_file}"`,
      "  reviewer:",
      `    agent: "node ${reviewPath} {prompt_file}"`,
      "    advisory: true",
      "",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectDir, "harness.config.yaml"),
    [
      "harness_version: 1",
      "attempt_profiles:",
      "  - implementer",
      "  - implementer",
      "review_profile: reviewer",
      "",
    ].join("\n"),
    "utf8"
  );
  gitInTest(["add", "-A"], { cwd: projectDir });
  gitInTest(["commit", "--quiet", "-m", "roles"], { cwd: projectDir });

  const result = runCli(["harness", "run", "--project-dir", projectDir, "--req", "REQ-001"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /REQ-001\s+pass/);

  // The findings reached the implementing step of the *same* attempt. Built
  // once per attempt instead of once per step, they would only ever have
  // arrived one attempt late.
  const ran = spawnSync("git", ["-C", projectDir, "show", "harness/REQ-001:agent-ran.txt"], {
    encoding: "utf8",
  });
  assert.equal(ran.stdout.trim(), "saw-findings");

  const tree = spawnSync(
    "git",
    ["-C", projectDir, "ls-tree", "-r", "--name-only", "harness/REQ-001"],
    { encoding: "utf8" }
  ).stdout;

  // Advisory means advisory: whatever the reviewer wrote is gone.
  assert.doesNotMatch(tree, /reviewer-sneaked-this-in/);

  // ...but the evidence of what it was asked and what it said survives. The
  // discard is `git clean`, which deleted the untracked archive until it was
  // told not to.
  assert.match(tree, /attempt-1-implementer\.md/);
  assert.match(tree, /attempt-2-reviewer\.md/);
  assert.match(tree, /attempt-2-implementer\.md/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("a review profile must declare itself advisory", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-adv-"));
  const projectDir = makeHarnessProject(tempRoot);
  fs.mkdirSync(path.join(projectDir, ".harness"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, ".harness", "profiles.yaml"),
    'profiles:\n  reviewer:\n    agent: "node -e \\"\\" {prompt_file}"\n',
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectDir, "harness.config.yaml"),
    "harness_version: 1\nreview_profile: reviewer\n",
    "utf8"
  );

  const result = runCli(["harness", "run", "--project-dir", projectDir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not declare `advisory: true`/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test(
  "harness init registers a merge driver that merges parallel matrix edits",
  { skip: !hasGit() },
  () => {
    // The domain merge is unit-tested; this asserts git actually routes the
    // file to it. Without the .gitattributes line, or without the local config,
    // git uses its line merge and these two branches conflict.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-merge-drv-"));
    const projectDir = makeHarnessProject(tempRoot, ["REQ-002"]);

    const init = runCli(["harness", "init", "--project-dir", projectDir]);
    assert.equal(init.status, 0, init.stderr);

    const attributes = fs.readFileSync(path.join(projectDir, ".gitattributes"), "utf8");
    assert.match(attributes, /docs\/specs\/traceability\.md merge=csda-matrix/);

    const driver = spawnSync(
      "git",
      ["-C", projectDir, "config", "--get", "merge.csda-matrix.driver"],
      { encoding: "utf8" }
    );
    assert.equal(driver.status, 0, "harness init should register the driver locally");

    gitInTest(["add", "-A"], { cwd: projectDir });
    gitInTest(["commit", "--quiet", "-m", "harness setup"], { cwd: projectDir });

    // Two branches, each flipping its own row. These rows are adjacent lines,
    // which is exactly what git's line merge cannot separate.
    const flip = (id: string) => {
      const file = path.join(projectDir, "docs", "specs", "traceability.md");
      const updated = fs
        .readFileSync(file, "utf8")
        .split("\n")
        .map((line) =>
          line.includes(`| ${id} |`) ? line.replace(/Draft \|$/, "Implemented |") : line
        )
        .join("\n");
      fs.writeFileSync(file, updated, "utf8");
    };
    for (const id of ["REQ-001", "REQ-002"]) {
      gitInTest(["checkout", "--quiet", "-b", `flip/${id}`, "main"], { cwd: projectDir });
      flip(id);
      gitInTest(["commit", "--quiet", "-am", `flip ${id}`], { cwd: projectDir });
      gitInTest(["checkout", "--quiet", "main"], { cwd: projectDir });
    }

    for (const id of ["REQ-001", "REQ-002"]) {
      const merge = spawnSync("git", ["-C", projectDir, "merge", "--no-edit", `flip/${id}`], {
        encoding: "utf8",
      });
      assert.equal(
        merge.status,
        0,
        `merging flip/${id} conflicted:\n${merge.stdout}${merge.stderr}`
      );
    }

    const matrix = fs.readFileSync(
      path.join(projectDir, "docs", "specs", "traceability.md"),
      "utf8"
    );
    for (const id of ["REQ-001", "REQ-002"]) {
      const row = matrix.split("\n").find((l) => l.includes(`| ${id} |`));
      assert.match(String(row), /Implemented \|$/, `${id} lost its edit in the merge`);
      assert.equal(
        matrix.split("\n").filter((l) => l.includes(`| ${id} |`)).length,
        1,
        `${id} was duplicated — the corruption a union merge produces`
      );
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
);

test(
  "doctor separates an unregistered merge driver from a half-registered one",
  { skip: !hasGit() },
  () => {
    // Git has three states for a driver named in .gitattributes, and the middle
    // one is a trap: with `name` set but no `driver` command it answers
    // "fatal: custom merge driver csda-matrix lacks command line" and the file
    // cannot be merged at all — strictly worse than the conflict the driver
    // exists to remove. Unregistered is merely unhelped; half-registered is
    // broken, so they cannot share a severity.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-drv-states-"));
    const projectDir = path.join(tempRoot, "p");
    fs.mkdirSync(projectDir, { recursive: true });
    gitInitForTest(projectDir);
    fs.writeFileSync(path.join(projectDir, "spec.md"), "# Spec\n", "utf8");
    fs.writeFileSync(
      path.join(projectDir, ".gitattributes"),
      "docs/specs/traceability.md merge=csda-matrix\n",
      "utf8"
    );

    const doctor = () => runCli(["doctor", "--project-dir", projectDir]);
    const line = (out: string) => out.split("\n").find((l) => l.includes("merge driver")) || "";

    assert.match(line(doctor().stdout), /⚠️|has not registered it/, "neither key set: a warning");

    gitInTest(["config", "merge.csda-matrix.name", "csda"], { cwd: projectDir });
    assert.match(
      line(doctor().stdout),
      /refuse to merge/,
      "name without driver must be reported as broken, not as unhelped"
    );

    gitInTest(["config", "merge.csda-matrix.driver", "node x %O %A %B"], { cwd: projectDir });
    assert.match(line(doctor().stdout), /merges row by row/, "both set: healthy");

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
);

// ── change author — the spec-author role (E2-02) ─────────────────────────

/** A project with one change ready to be authored, committed and clean. */
function makeAuthorProject() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-author-"));
  const projectDir = path.join(tempRoot, "project");
  fs.mkdirSync(path.join(projectDir, "features"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "docs", "specs", "adr"), { recursive: true });

  fs.writeFileSync(path.join(projectDir, "spec.md"), "# Spec\n\n## REQ-001 — A\n", "utf8");
  fs.writeFileSync(path.join(projectDir, "AI_RULES.md"), "# AI Rules\n", "utf8");
  fs.writeFileSync(path.join(projectDir, "README.md"), "# R\n", "utf8");
  fs.writeFileSync(path.join(projectDir, "docs", "specs", "adr", "README.md"), "# ADRs\n", "utf8");
  fs.writeFileSync(
    path.join(projectDir, "features", "f.feature"),
    "Feature: F\n  Scenario: ok\n    Given x\n    Then y\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectDir, "docs", "specs", "traceability.md"),
    [
      "# Traceability Matrix",
      "",
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
      "|---|---|---|---|---|---|---|---|---|---|",
      "| REQ-001 | SCN-001 | `features/f.feature` | U | C | A | E | `s.ts` | `t.ts` | Draft |",
      "",
    ].join("\n"),
    "utf8"
  );

  gitInitForTest(projectDir);
  gitInTest(["config", "user.email", "t@e.com"], { cwd: projectDir });
  gitInTest(["config", "user.name", "T"], { cwd: projectDir });
  gitInTest(["config", "commit.gpgsign", "false"], { cwd: projectDir });
  gitInTest(["add", "."], { cwd: projectDir });
  gitInTest(["commit", "--quiet", "-m", "base"], { cwd: projectDir });

  const created = runCli(["change", "new", "add-pricing", "--project-dir", projectDir]);
  assert.equal(created.status, 0, created.stderr);
  gitInTest(["add", "-A"], { cwd: projectDir });
  gitInTest(["commit", "--quiet", "-m", "change"], { cwd: projectDir });

  return { tempRoot, projectDir };
}

/** An agent script that writes its proposal and also strays out of scope. */
function writeRogueAgent(tempRoot: string) {
  const file = path.join(tempRoot, "rogue.js");
  fs.writeFileSync(
    file,
    [
      "const fs = require('node:fs');",
      "fs.writeFileSync('docs/specs/changes/add-pricing/proposal.md',",
      "  '# Proposal: add-pricing\\n\\n## Intent\\n\\nCharge per use.\\n\\n## Scope\\n\\nIn scope:\\n\\n- Tariffs\\n\\nOut of scope:\\n\\n- Invoicing\\n');",
      "fs.writeFileSync('docs/specs/traceability.md', '# wiped\\n');",
      "fs.writeFileSync('rogue.txt', 'x');",
    ].join("\n"),
    "utf8"
  );
  return file;
}

test("change author enforces the scope instead of asking for it", { skip: !hasGit() }, () => {
  // An agent asked to *describe* a change, and able to edit what it describes,
  // can make the change unnecessary instead of proposing it — in a diff that
  // looks like the work. So the boundary is enforced, not requested.
  const { tempRoot, projectDir } = makeAuthorProject();
  const rogue = writeRogueAgent(tempRoot);

  const result = runCli([
    "change",
    "author",
    "add-pricing",
    "--project-dir",
    projectDir,
    "--agent",
    `node ${rogue} {prompt_file}`,
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);

  // The legitimate work survived.
  const proposal = fs.readFileSync(
    path.join(projectDir, "docs", "specs", "changes", "add-pricing", "proposal.md"),
    "utf8"
  );
  assert.match(proposal, /Charge per use/);

  // The stray untracked file is gone...
  assert.equal(fs.existsSync(path.join(projectDir, "rogue.txt")), false);

  // ...and the tracked file it overwrote was RESTORED, not deleted. The first
  // implementation ran `git checkout` and then removed the path anyway, which
  // deleted a file the project already had.
  const matrix = path.join(projectDir, "docs", "specs", "traceability.md");
  assert.ok(fs.existsSync(matrix), "an out-of-scope tracked file must be restored, never deleted");
  assert.match(fs.readFileSync(matrix, "utf8"), /^# Traceability Matrix/);

  assert.match(result.stdout + result.stderr, /author_out_of_scope|out of scope/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("change author refuses to run on a dirty tree", { skip: !hasGit() }, () => {
  // Enforcing the scope means reverting what the agent wrote outside it, and on
  // a dirty tree that cannot be told apart from what you were in the middle of.
  const { tempRoot, projectDir } = makeAuthorProject();
  fs.writeFileSync(path.join(projectDir, "work-in-progress.txt"), "mine\n", "utf8");

  const result = runCli([
    "change",
    "author",
    "add-pricing",
    "--project-dir",
    projectDir,
    "--agent",
    "true",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /uncommitted changes/);
  assert.equal(
    fs.readFileSync(path.join(projectDir, "work-in-progress.txt"), "utf8"),
    "mine\n",
    "refusing must not touch the work it refused over"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("change author --dry-run shows the prompt and writes nothing", { skip: !hasGit() }, () => {
  const { tempRoot, projectDir } = makeAuthorProject();
  const result = runCli([
    "change",
    "author",
    "add-pricing",
    "--project-dir",
    projectDir,
    "--dry-run",
    "--agent",
    "true",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Write \*\*only\*\* inside `docs\/specs\/changes\/add-pricing\/`/);
  assert.match(result.stdout, /REQ-002/, "the reserved range is stated, and not double-prefixed");
  assert.doesNotMatch(result.stdout, /REQ-REQ-/);

  const status = spawnSync("git", ["-C", projectDir, "status", "--porcelain"], {
    encoding: "utf8",
  });
  assert.equal(status.stdout.trim(), "", "--dry-run must leave the tree clean");

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("change author needs an agent, and says how to give it one", { skip: !hasGit() }, () => {
  const { tempRoot, projectDir } = makeAuthorProject();
  const result = runCli(["change", "author", "add-pricing", "--project-dir", projectDir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /author_agent_unset|No agent is configured/);
  assert.match(result.stderr, /--agent-profile/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── architecture profiles (ADR-0022) ────────────────────────────────────

const DOMAIN_DOCS = [
  "domain-model.md",
  "use-cases.md",
  "commands.md",
  "aggregates.md",
  "events.md",
  "status-model.md",
];

const specDocs = (projectDir: string) =>
  DOMAIN_DOCS.filter((doc) => fs.existsSync(path.join(projectDir, "docs", "specs", doc)));

test("each architecture profile scaffolds only the vocabulary it declares", () => {
  // ADR-0022: a static site handed aggregates.md is not untidy, it is an agent
  // being told the system has aggregates. The profile decides what gets written.
  const { projectDir: minimal } = initRuntimeProject(['ARCHITECTURE="minimal"']);
  assert.deepEqual(specDocs(minimal), [], "minimal should scaffold no domain vocabulary");

  const { projectDir: layered } = initRuntimeProject(['ARCHITECTURE="layered"']);
  assert.deepEqual(specDocs(layered), ["use-cases.md"]);

  const { projectDir: ddd } = initRuntimeProject(['ARCHITECTURE="tactical-ddd"']);
  assert.deepEqual(specDocs(ddd).sort(), [...DOMAIN_DOCS].sort());
});

test("the gate is identical under every architecture profile", () => {
  // The invariant the whole ADR rests on: profiles change what is scaffolded
  // and what the rulebook demands, never what `validate` accepts. If this ever
  // fails, "patterns are optional" has quietly become "the gate is optional".
  for (const profile of ["minimal", "layered", "tactical-ddd"]) {
    const { projectDir: dir } = initRuntimeProject([`ARCHITECTURE="${profile}"`]);
    const result = runCli(["validate", dir]);
    assert.equal(result.status, 0, `${profile} failed validate:\n${result.stdout}${result.stderr}`);
  }
});

test("the rulebook demands aggregates only where the profile does", () => {
  // Where the obligation actually lives: nothing checks AI_RULES.md, and the
  // agent obeys it on every prompt.
  const read = (dir: string) => fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8");

  const minimal = read(initRuntimeProject(['ARCHITECTURE="minimal"']).projectDir);
  assert.doesNotMatch(minimal, /maps to (an )?aggregate/i);
  assert.doesNotMatch(minimal, /Use case maps to command/i);

  const layered = read(initRuntimeProject(['ARCHITECTURE="layered"']).projectDir);
  assert.match(layered, /Scenario maps to a use case/);
  assert.doesNotMatch(layered, /maps to aggregate|aggregate or read model/i);

  const ddd = read(initRuntimeProject(['ARCHITECTURE="tactical-ddd"']).projectDir);
  assert.match(ddd, /Command\/query maps to aggregate/);

  // The principles are not negotiable, so they survive in every profile.
  for (const rules of [minimal, layered, ddd]) {
    assert.match(rules, /Requirement has ID/);
    assert.match(rules, /Traceability row is complete/);
    assert.match(rules, /business logic out of framework code/i);
  }
});

test("the declared profile is recorded where the agent reads it", () => {
  const { projectDir: dir } = initRuntimeProject(['ARCHITECTURE="layered"']);
  assert.match(
    fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8"),
    /^- Architecture: layered$/m
  );
});

test("an unknown architecture profile is refused with the supported list", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-arch-bad-"));
  const configPath = path.join(tempRoot, "project.config");
  fs.writeFileSync(
    configPath,
    [...RUNTIME_BASE_CONFIG, 'ARCHITECTURE="hexagonal-ish"'].join("\n") + "\n",
    "utf8"
  );
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--no-git",
    "--keep-matrix",
    "--force",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stdout + result.stderr,
    /ARCHITECTURE 'hexagonal-ish' is not supported.*minimal, layered, tactical-ddd/s
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("doctor reports a project that has outgrown its declared profile", () => {
  const { projectDir: dir } = initRuntimeProject(['ARCHITECTURE="minimal"']);

  const clean = runCli(["doctor", "--project-dir", dir]);
  assert.match(clean.stdout, /architecture: minimal — matches/);

  // The matrix is the signal, not the domain documents: those ship with
  // placeholder rows, so "the file has content" is true from the first minute.
  const matrixPath = path.join(dir, "docs", "specs", "traceability.md");
  const withAggregate = fs
    .readFileSync(matrixPath, "utf8")
    .split("\n")
    .map((line) => {
      if (!/\| REQ-/.test(line)) return line;
      const cells = line.split("|");
      cells[6] = " AGG-Policy ";
      return cells.join("|");
    })
    .join("\n");
  fs.writeFileSync(matrixPath, withAggregate, "utf8");

  const drifted = runCli(["doctor", "--project-dir", dir]);
  assert.match(drifted.stdout, /profile is 'minimal' but requirements name aggregates/);
});

// ── pack lint --graph (visual reference graph, M-visual Phase 1) ─────────

test("pack lint --graph renders the reference graph as Mermaid", () => {
  const result = runCli([
    "pack",
    "lint",
    "--pack-root",
    "tests/fixtures/domain-packs",
    "--pack",
    "parking-management/backend",
    "--graph",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^graph LR/);
  assert.match(result.stdout, /REQ_REQ_001\["REQ-001"\]:::requirement/);
  assert.match(result.stdout, /-->\|implements\|/);
});

test("pack lint --graph --graph-format dot renders a DOT digraph", () => {
  const result = runCli([
    "pack",
    "lint",
    "--pack-root",
    "tests/fixtures/domain-packs",
    "--pack",
    "parking-management/backend",
    "--graph",
    "--graph-format",
    "dot",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^digraph pack \{/);
  assert.match(result.stdout, /rankdir=LR;/);
});

test("pack lint --graph rejects an unknown --graph-format", () => {
  const result = runCli([
    "pack",
    "lint",
    "--pack-root",
    "tests/fixtures/domain-packs",
    "--pack",
    "parking-management/backend",
    "--graph",
    "--graph-format",
    "svg",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid --graph-format/);
});

// ── pack infer (.feature → pack.yaml skeleton, M-visual Phase 3) ─────────

test("pack infer proposes a pack.yaml fragment from a .feature file", () => {
  const result = runCli([
    "pack",
    "infer",
    "--from",
    "tests/fixtures/domain-packs/parking-management/backend/templates/features/capacity/capacity_threshold.feature.tpl",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proposed pack\.yaml fragment inferred from/);
  assert.match(result.stdout, /requirements:/);
  assert.match(result.stdout, /use_cases:/);
  assert.match(result.stdout, /commands:/);
  assert.match(result.stdout, /events:/);
  assert.match(result.stdout, /scenarios:/);
  assert.match(result.stdout, /CapacityThresholdReached/);
});

test("pack infer --format json emits a structured model", () => {
  const result = runCli([
    "pack",
    "infer",
    "--from",
    "tests/fixtures/domain-packs/parking-management/backend/templates/features/capacity/capacity_threshold.feature.tpl",
    "--format",
    "json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(Array.isArray(parsed.scenarios));
  assert.ok(parsed.use_cases[0].name.length > 0);
});

test("pack infer requires --from", () => {
  const result = runCli(["pack", "infer"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--from .* is required/);
});

test("pack infer exits non-zero on a feature file with no scenarios", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-infer-empty-"));
  const featurePath = path.join(tempRoot, "empty.feature");
  fs.writeFileSync(featurePath, "Feature: Nothing here\n", "utf8");
  const result = runCli(["pack", "infer", "--from", featurePath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No Gherkin scenarios/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── init: YAML config format ─────────────────────────────────────────────

test("init accepts a YAML config and produces a valid project", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-init-yaml-"));
  const slug = `yaml-cfg-${Date.now()}`;
  const configPath = path.join(tempRoot, "project.yaml");
  const projectDir = path.join(tempRoot, slug);

  const config = [
    'PROJECT_NAME: "YAML Config"',
    `PROJECT_SLUG: ${slug}`,
    "PROJECT_TYPE: backend",
    "DOMAIN: automation testing",
    "STACK: Quarkus 3.x, Java 21, PostgreSQL",
    "API_STYLE: REST with DTO boundaries",
    "TESTING: JUnit 5, Testcontainers, Cucumber",
    "LANG: en",
    'MODULES: ""',
  ].join("\n");
  fs.writeFileSync(configPath, `${config}\n`, "utf8");

  const initResult = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.ok(fs.existsSync(projectDir), "project directory should exist");

  const validateResult = runCli(["validate", projectDir]);
  assert.equal(validateResult.status, 0, validateResult.stderr);
  assert.match(validateResult.stdout, /Validation passed/);

  const aiRules = fs.readFileSync(path.join(projectDir, "AI_RULES.md"), "utf8");
  assert.match(aiRules, /Stack: Quarkus 3\.x, Java 21, PostgreSQL/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("init rejects a YAML config that is a sequence, not a mapping", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-init-yaml-bad-"));
  const configPath = path.join(tempRoot, "bad.yml");
  fs.writeFileSync(configPath, "- one\n- two\n", "utf8");
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--no-git",
    "--keep-matrix",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /flat mapping/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("harness prompt REQ-NNN prints the prompt without touching git", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-prompt-cli-"));
  const projectDir = makeHarnessProject(tempRoot);
  const result = runCli(["harness", "prompt", "REQ-001", "--project-dir", projectDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Implement REQ-001/);
  // No branch was created.
  const branches = spawnSync("git", ["-C", projectDir, "branch", "--list", "harness/*"], {
    encoding: "utf8",
  });
  assert.equal(branches.stdout.trim(), "");
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("harness prompt rejects a malformed REQ id", () => {
  const result = runCli(["harness", "prompt", "001"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REQ-id/);
});

test("harness prompt prepends prompt_prefix from harness.config.yaml", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-prefix-"));
  const projectDir = makeHarnessProject(tempRoot);
  fs.writeFileSync(
    path.join(projectDir, "harness.config.yaml"),
    "prompt_prefix: 'Role: Lead Architect. Hexagonal arch is non-negotiable.'\n",
    "utf8"
  );
  const result = runCli(["harness", "prompt", "REQ-001", "--project-dir", projectDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Lead Architect/);
  // The prefix appears before the per-requirement header.
  const idxPrefix = result.stdout.indexOf("Lead Architect");
  const idxHeader = result.stdout.indexOf("# Implement REQ-001");
  assert.ok(idxPrefix > 0 && idxHeader > idxPrefix);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("harness run --push --pr-cmd publishes green branches (CI mode)", { skip: !hasGit() }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-harness-ci-"));
  const projectDir = makeHarnessProject(tempRoot);

  // Local bare repo standing in for the enterprise remote.
  const remoteDir = path.join(tempRoot, "remote.git");
  gitInTest(["init", "--quiet", "--bare", "--initial-branch=main", remoteDir]);
  gitInTest(["remote", "add", "origin", remoteDir], { cwd: projectDir });

  const prLog = path.join(tempRoot, "pr-calls.txt");
  const result = runCli([
    "harness",
    "run",
    "--project-dir",
    projectDir,
    "--agent",
    // Writes a file: the harness refuses an attempt that produced nothing
    // (H19), and what is under test here is publishing, not the agent.
    implementingAgent(tempRoot),
    "--push",
    "--pr-cmd",
    // The harness runs --pr-cmd through a shell, so the log path is passed as an
    // argument rather than interpolated into the script — a bare path inside the
    // command string would be eaten by the shell. Double quotes, not single:
    // cmd.exe treats single quotes as ordinary characters and would keep them
    // in the path.
    `node -e "require('node:fs').appendFileSync(process.argv[1], process.argv[2]+' '+process.argv[3]+'\\n')" "${prLog}" {branch} {req}`,
  ]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /pushed harness\/REQ-001 to origin/);
  assert.match(result.stdout, /pr command succeeded/);

  // The branch exists on the remote.
  const remoteBranches = spawnSync(
    "git",
    ["-C", remoteDir, "branch", "--list", "harness/REQ-001"],
    { encoding: "utf8" }
  );
  assert.match(remoteBranches.stdout, /harness\/REQ-001/);

  // The PR command ran with both placeholders substituted.
  const calls = fs.readFileSync(prLog, "utf8");
  assert.match(calls, /harness\/REQ-001 REQ-001/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── Runtime environments (C0-09) ──────────────────────────────────────────────

const RUNTIME_BASE_CONFIG = [
  'PROJECT_NAME="Runtime Probe"',
  'PROJECT_SLUG="runtime-probe"',
  'PROJECT_TYPE="backend"',
  'DOMAIN="runtime testing"',
  'STACK="Quarkus 3.x, Java 21, PostgreSQL"',
  'API_STYLE="REST"',
  'TESTING="JUnit 5"',
];

/** Generate a project from an inline config and return its directory. */
function initRuntimeProject(extraLines) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-runtime-"));
  const configPath = path.join(tempRoot, "project.config");
  fs.writeFileSync(configPath, [...RUNTIME_BASE_CONFIG, ...extraLines].join("\n") + "\n", "utf8");
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return { tempRoot, projectDir: path.join(tempRoot, "runtime-probe") };
}

test("init generates the full runtime contract by default", () => {
  const { tempRoot, projectDir } = initRuntimeProject([]);

  for (const rel of [
    "docker-compose.yml",
    ".dockerignore",
    ".devcontainer/devcontainer.json",
    ".env.example",
    ".env.dev",
    ".env.feature",
    ".env.prod",
    "docs/specs/runtime-environments.md",
  ]) {
    assert.ok(fs.existsSync(path.join(projectDir, rel)), `expected ${rel} to be generated`);
  }

  const spec = fs.readFileSync(path.join(projectDir, "docs/specs/runtime-environments.md"), "utf8");
  assert.doesNotMatch(spec, /\{\{/, "runtime spec still has unresolved placeholders");
  // Every environment gets its own database and its own host port.
  assert.match(spec, /runtime_probe_dev/);
  assert.match(spec, /runtime_probe_feature/);
  assert.match(spec, /runtime_probe_prod/);
  assert.match(spec, /## Docker/);
  assert.match(spec, /## Devcontainer/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("DOCKER_SUPPORT=false leaves no orphaned Docker or devcontainer artifacts", () => {
  const { tempRoot, projectDir } = initRuntimeProject([
    'DOCKER_SUPPORT="false"',
    'DEVCONTAINER_SUPPORT="false"',
  ]);

  // A devcontainer.json here would point at the compose file init just removed.
  for (const rel of ["docker-compose.yml", ".dockerignore", ".devcontainer"]) {
    assert.ok(!fs.existsSync(path.join(projectDir, rel)), `${rel} should not survive`);
  }
  // The environment contract itself does not depend on Docker.
  assert.ok(fs.existsSync(path.join(projectDir, ".env.dev")));

  const spec = fs.readFileSync(path.join(projectDir, "docs/specs/runtime-environments.md"), "utf8");
  assert.match(spec, /Docker support is disabled/);
  assert.doesNotMatch(spec, /docker compose --env-file/);
  assert.doesNotMatch(spec, /## Devcontainer/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("DEVCONTAINER_SUPPORT=true without DOCKER_SUPPORT is rejected", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-runtime-"));
  const configPath = path.join(tempRoot, "project.config");
  fs.writeFileSync(
    configPath,
    [...RUNTIME_BASE_CONFIG, 'DOCKER_SUPPORT="false"', 'DEVCONTAINER_SUPPORT="true"'].join("\n"),
    "utf8"
  );
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stdout + result.stderr, /DEVCONTAINER_SUPPORT requires DOCKER_SUPPORT=true/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("an unsupported DATABASE_ENGINE is rejected with the supported list", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-runtime-"));
  const configPath = path.join(tempRoot, "project.config");
  fs.writeFileSync(
    configPath,
    [...RUNTIME_BASE_CONFIG, 'DATABASE_ENGINE="mysql"'].join("\n"),
    "utf8"
  );
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stdout + result.stderr, /is not supported.*postgres/s);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ── Datastore ─────────────────────────────────────────────────────────────────

test("a project with no datastore documents no database", () => {
  // Every project used to get a Postgres contract, whether or not it had one.
  // A frontend or mobile app then shipped .env files full of DATABASE_* nobody
  // reads and a runtime spec describing a database that was never created.
  const { tempRoot, projectDir } = initRuntimeProject(['PROJECT_TYPE="frontend"']);

  const env = fs.readFileSync(path.join(projectDir, ".env.dev"), "utf8");
  assert.doesNotMatch(env, /DATABASE_/);
  assert.doesNotMatch(env, /POSTGRES_/);
  assert.match(env, /APP_ENV=dev/, "the environment itself still exists");

  const spec = fs.readFileSync(path.join(projectDir, "docs/specs/runtime-environments.md"), "utf8");
  assert.match(spec, /owns no datastore/);
  assert.doesNotMatch(spec, /## Database/);
  // The catalog drops its Database column rather than listing a name nobody created.
  assert.doesNotMatch(spec, /\| Environment \| Purpose \| Env file \| Database \|/);

  // Compose keeps the workspace service and loses only the database.
  const compose = fs.readFileSync(path.join(projectDir, "docker-compose.yml"), "utf8");
  assert.match(compose, /workspace:/);
  assert.doesNotMatch(compose, /^ {2}db:/m);
  assert.doesNotMatch(compose, /depends_on/);
  assert.doesNotMatch(compose, /db_data/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("a backend still gets the full database contract", () => {
  const { tempRoot, projectDir } = initRuntimeProject([]);

  const env = fs.readFileSync(path.join(projectDir, ".env.dev"), "utf8");
  assert.match(env, /DATABASE_ENGINE=postgres/);

  const spec = fs.readFileSync(path.join(projectDir, "docs/specs/runtime-environments.md"), "utf8");
  assert.match(spec, /## Database/);
  assert.match(spec, /1\. \*\*No shared databases/);

  const compose = fs.readFileSync(path.join(projectDir, "docker-compose.yml"), "utf8");
  assert.match(compose, /^ {2}db:/m);
  assert.match(compose, /depends_on/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("DATASTORE=none is accepted explicitly on a backend too", () => {
  // A backend that talks only to other services is a real shape.
  const { tempRoot, projectDir } = initRuntimeProject(['DATASTORE="none"']);
  const spec = fs.readFileSync(path.join(projectDir, "docs/specs/runtime-environments.md"), "utf8");
  assert.match(spec, /owns no datastore/);
  // With no database, the invariant list starts at the credentials rule.
  assert.match(spec, /1\. \*\*No credentials in the repository/);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("an unsupported DATASTORE is rejected with the allowed list", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "csda-datastore-"));
  const configPath = path.join(tempRoot, "project.config");
  fs.writeFileSync(configPath, [...RUNTIME_BASE_CONFIG, 'DATASTORE="mongo"'].join("\n"), "utf8");
  const result = runCli([
    "init",
    "--config",
    configPath,
    "--out",
    tempRoot,
    "--force",
    "--no-git",
    "--keep-matrix",
  ]);
  assert.equal(result.status, 2);
  assert.match(
    result.stdout + result.stderr,
    /DATASTORE 'mongo' is not supported.*postgres, none/s
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
