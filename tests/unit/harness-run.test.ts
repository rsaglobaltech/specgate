"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseArgs,
  substituteAgentCommand,
  substituteGateCommand,
  printReport,
  filterHint,
} = require("../../scripts/harness/run");
const { buildPrompt } = require("../../scripts/harness/prompt");
const { featureFilePath } = require("../../packages/core/src/domain/HarnessRun");
const { DEFAULT_PROTECTED_PATHS } = require("../../packages/core/src/domain/WriteScope");
const {
  readHarnessConfig,
  resolveHarnessSettings,
} = require("../../packages/core/src/infrastructure/HarnessConfigFile");

// ── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs has sane defaults", () => {
  const a = parseArgs([]);
  assert.equal(a.projectDir, ".");
  assert.equal(a.agent, "");
  assert.equal(a.maxAttempts, 0);
  // Asserted in one place only, below, next to the reason it is 1200.
  assert.equal(a.timeout, 1200);
  assert.equal(a.format, "text");
  assert.equal(a.dryRun, false);
  assert.deepEqual(a.reqs, []);
});

test("parseArgs reads agent, test-cmd, max-attempts and repeated --req", () => {
  const a = parseArgs([
    "--agent",
    "claude -p < {prompt_file}",
    "--test-cmd",
    "npm test",
    "--max-attempts",
    "5",
    "--req",
    "REQ-001",
    "--req",
    "REQ-002",
  ]);
  assert.equal(a.agent, "claude -p < {prompt_file}");
  assert.equal(a.testCmd, "npm test");
  assert.equal(a.maxAttempts, 5);
  assert.deepEqual(a.reqs, ["REQ-001", "REQ-002"]);
});

test("parseArgs rejects a non-positive --max-attempts", () => {
  assert.throws(() => parseArgs(["--max-attempts", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--max-attempts", "x"]), /positive integer/);
});

test("parseArgs rejects a malformed --req", () => {
  assert.throws(() => parseArgs(["--req", "001"]), /REQ-NNN/);
});

test("parseArgs rejects an unknown flag and an invalid --format", () => {
  assert.throws(() => parseArgs(["--bogus"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--format", "yaml"]), /Invalid --format/);
});

// ── substituteAgentCommand ───────────────────────────────────────────────────

test("substituteAgentCommand replaces every {prompt_file} occurrence", () => {
  const cmd = substituteAgentCommand("cat {prompt_file} && run {prompt_file}", "/tmp/p.md");
  assert.equal(cmd, "cat /tmp/p.md && run /tmp/p.md");
});

test("substituteAgentCommand throws when the placeholder is missing", () => {
  assert.throws(() => substituteAgentCommand("claude -p", "/tmp/p.md"), /\{prompt_file\}/);
});

// ── buildPrompt ──────────────────────────────────────────────────────────────

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-prompt-"));
}

const sampleReq = {
  requirement: "REQ-001",
  scenario_id: "SCN-001",
  feature_file: "features/capacity/threshold.feature",
  technical_artifact: "src/Capacity.java",
  test_artifact: "test/CapacityTest.java",
  status: "Draft",
  category: "NEEDS_TEST",
};

test("buildPrompt embeds the requirement facts and the definition of done", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(sampleReq, dir);
    assert.match(prompt, /# Implement REQ-001/);
    assert.match(prompt, /Test artifact \(write this first — TDD\): test\/CapacityTest\.java/);
    assert.match(prompt, /Definition of done/);
    // Sourced from `change instructions apply`, so assert the substance rather
    // than the emphasis markers it happens to use.
    assert.match(prompt, /Do not edit `docs\/specs\/traceability\.md`/);
    assert.match(prompt, /Do not modify\*\* `spec\.md`, `AGENTS\.md` \(or `AI_RULES\.md`\)/);
    assert.match(prompt, /specgate status` is the queue/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt inlines the Gherkin feature file when it exists", () => {
  const dir = tmpProject();
  try {
    const featurePath = path.join(dir, "features", "capacity", "threshold.feature");
    fs.mkdirSync(path.dirname(featurePath), { recursive: true });
    fs.writeFileSync(featurePath, "Feature: Capacity\n  Scenario: over\n", "utf8");
    const prompt = buildPrompt(sampleReq, dir);
    assert.match(prompt, /```gherkin/);
    assert.match(prompt, /Feature: Capacity/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt notes a missing feature file instead of inlining it", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(sampleReq, dir);
    assert.match(prompt, /does not exist yet/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt appends the previous failure on a retry", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(sampleReq, dir, {
      previousFailure: "AssertionError: expected 200 got 500",
      attempt: 2,
      maxAttempts: 3,
    });
    assert.match(prompt, /Previous attempt failed \(attempt 1 of 3\)/);
    assert.match(prompt, /AssertionError: expected 200 got 500/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── config ───────────────────────────────────────────────────────────────────

test("readHarnessConfig returns null when no config file exists", () => {
  const dir = tmpProject();
  try {
    assert.equal(readHarnessConfig(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readHarnessConfig parses agent, test_cmd and max_attempts", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      "harness_version: 1\nagent: claude -p < {prompt_file}\ntest_cmd: npm test\nmax_attempts: 4\n",
      "utf8"
    );
    const config = readHarnessConfig(dir);
    assert.equal(config.agent, "claude -p < {prompt_file}");
    assert.equal(config.testCmd, "npm test");
    assert.equal(config.maxAttempts, 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readHarnessConfig rejects a non-positive max_attempts", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(path.join(dir, "harness.config.yaml"), "max_attempts: 0\n", "utf8");
    assert.throws(() => readHarnessConfig(dir), /max_attempts/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveHarnessSettings lets CLI flags override the file, file fills gaps", () => {
  const file = { agent: "file-agent {prompt_file}", testCmd: "file-test", maxAttempts: 9 };
  const merged = resolveHarnessSettings(file, {
    agent: "cli-agent {prompt_file}",
    testCmd: "",
    maxAttempts: 0,
  });
  assert.equal(merged.agent, "cli-agent {prompt_file}");
  assert.equal(merged.testCmd, "file-test");
  assert.equal(merged.maxAttempts, 9);
});

test("resolveHarnessSettings defaults maxAttempts to 3 with no file and no flag", () => {
  const merged = resolveHarnessSettings(null, { agent: "", testCmd: "", maxAttempts: 0 });
  assert.equal(merged.maxAttempts, 3);
  assert.equal(merged.agent, "");
  assert.equal(merged.promptPrefix, "");
});

// ── prompt_prefix / prompt_prefix_file ───────────────────────────────────────

test("readHarnessConfig reads an inline prompt_prefix", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      'prompt_prefix: "Role: Lead Architect."\n',
      "utf8"
    );
    const config = readHarnessConfig(dir);
    assert.equal(config.promptPrefix, "Role: Lead Architect.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readHarnessConfig loads a multi-line prompt_prefix_file", () => {
  const dir = tmpProject();
  try {
    fs.mkdirSync(path.join(dir, ".harness"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".harness", "prefix.md"),
      "Role: Lead Architect.\nHexagonal arch is non-negotiable.\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      "prompt_prefix_file: ./.harness/prefix.md\n",
      "utf8"
    );
    const config = readHarnessConfig(dir);
    assert.match(config.promptPrefix, /Lead Architect/);
    assert.match(config.promptPrefix, /Hexagonal/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readHarnessConfig errors when prompt_prefix_file is missing", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      "prompt_prefix_file: ./does-not-exist.md\n",
      "utf8"
    );
    assert.throws(() => readHarnessConfig(dir), /prompt_prefix_file not found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readHarnessConfig prefers prompt_prefix_file over inline when both set", () => {
  const dir = tmpProject();
  try {
    fs.writeFileSync(path.join(dir, "prefix.md"), "from-file", "utf8");
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      'prompt_prefix: "inline"\nprompt_prefix_file: ./prefix.md\n',
      "utf8"
    );
    assert.equal(readHarnessConfig(dir).promptPrefix, "from-file");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt prepends promptPrefix with a separator", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(sampleReq, dir, {
      promptPrefix: "## Role\nLead Architect.\n",
    });
    // Prefix appears before the requirement header, separated by ---.
    const idxPrefix = prompt.indexOf("Lead Architect");
    const idxSep = prompt.indexOf("\n---\n");
    const idxReq = prompt.indexOf("# Implement REQ-001");
    assert.ok(idxPrefix >= 0 && idxSep > idxPrefix && idxReq > idxSep);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt omits the separator when promptPrefix is blank or absent", () => {
  const dir = tmpProject();
  try {
    const noPrefix = buildPrompt(sampleReq, dir);
    const blank = buildPrompt(sampleReq, dir, { promptPrefix: "   \n  " });
    assert.ok(!noPrefix.startsWith("---"));
    assert.ok(!blank.startsWith("---"));
    assert.equal(noPrefix, blank);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveHarnessSettings exposes promptPrefix from the file config", () => {
  const merged = resolveHarnessSettings(
    { promptPrefix: "## Role\nLead Architect.\n" },
    { agent: "", testCmd: "", maxAttempts: 0 }
  );
  assert.match(merged.promptPrefix, /Lead Architect/);
});

// ── The plan → prompt seam ───────────────────────────────────────────────────
//
// `run.ts` feeds `buildPrompt` by shelling out to `plan --format json` and
// parsing the result, so the two are coupled through a wire format. When that
// format was normalised to camelCase, `buildPrompt` kept reading snake_case
// and every generated prompt silently said "(none declared)" for the scenario,
// the feature file and both artefacts — a prompt an agent cannot act on.
//
// Nothing failed, because the fixture above was written in the old vocabulary
// and tested a shape `plan` no longer produces. These run the real seam.

const { spawnSync } = require("node:child_process");
const REPO_ROOT = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(REPO_ROOT, "bin", "specgate.js");

test("buildPrompt reads the camelCase field names the contract specifies", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(
      {
        requirement: "REQ-042",
        scenarioId: "SCN-042",
        featureFile: "features/billing/invoice.feature",
        technicalArtifact: "src/domain/invoice.ts",
        testArtifact: "tests/unit/invoice.test.ts",
        status: "Draft",
        category: "NEEDS_TEST",
      },
      dir
    );
    assert.match(prompt, /Scenario ID: SCN-042/);
    assert.match(prompt, /Feature file: features\/billing\/invoice\.feature/);
    assert.match(prompt, /test artifact.*tests\/unit\/invoice\.test\.ts/i);
    assert.match(prompt, /Production artifact: src\/domain\/invoice\.ts/);
    assert.doesNotMatch(prompt, /\(none declared\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPrompt still reads snake_case, so an older plan output is not blanked", () => {
  const dir = tmpProject();
  try {
    const prompt = buildPrompt(sampleReq, dir);
    assert.match(prompt, /Scenario ID: SCN-001/);
    assert.match(prompt, /Feature file: features\/capacity\/threshold\.feature/);
    assert.doesNotMatch(prompt, /\(none declared\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a requirement straight out of `plan --format json` produces a usable prompt", () => {
  // The end-to-end guard: scaffold a project, ask the real CLI for its plan,
  // and feed the first requirement to the real prompt builder. If the wire
  // format drifts again, this is what notices.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-seam-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
      {
        encoding: "utf8",
      }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

    const planned = spawnSync(
      process.execPath,
      [CLI, "plan", "--project-dir", projectDir, "--format", "json"],
      { encoding: "utf8" }
    );
    const plan = JSON.parse(planned.stdout);
    const req = (plan.requirements || [])[0];
    assert.ok(req, "plan returned no requirements to build a prompt from");

    const prompt = buildPrompt(req, projectDir);
    assert.match(prompt, new RegExp(`# Implement ${req.requirement}`));
    // The scaffolded requirement declares a scenario and a feature file, so a
    // prompt claiming none declared means the seam is broken, not that the
    // project is empty.
    assert.doesNotMatch(prompt, /Scenario ID: \(none\)/);
    assert.doesNotMatch(prompt, /Feature file: \(none declared\)/);
    assert.match(prompt, /```gherkin/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Agent profiles ───────────────────────────────────────────────────────────
//
// `agent_profile` names an entry in .harness/profiles.yaml, so a team can
// commit the agent commands it uses and pick one by name rather than commit a
// single default somebody pays for by accident.
//
// It exists because the HIE pilot was already configured this way — the file
// declared `agent_profile: local-claude` and a matching profiles.yaml, the CLI
// read neither, and `harness run` reported "No agent configured" while the
// config plainly declared one.

function projectWithProfiles(config, profiles?) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-profiles-"));
  fs.writeFileSync(path.join(dir, "harness.config.yaml"), config, "utf8");
  if (profiles !== undefined) {
    fs.mkdirSync(path.join(dir, ".harness"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".harness", "profiles.yaml"), profiles, "utf8");
  }
  return dir;
}

test("agent_profile resolves to the profile's agent command", () => {
  const dir = projectWithProfiles(
    "harness_version: 1\nagent_profile: local-claude\n",
    'profiles_version: 1\nprofiles:\n  local-claude:\n    agent: "claude -p < {prompt_file}"\n'
  );
  try {
    assert.equal(readHarnessConfig(dir).agent, "claude -p < {prompt_file}");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an explicit agent wins over a profile", () => {
  // The narrower statement beats the indirection.
  const dir = projectWithProfiles(
    'harness_version: 1\nagent: "direct {prompt_file}"\nagent_profile: local-claude\n',
    'profiles_version: 1\nprofiles:\n  local-claude:\n    agent: "profile {prompt_file}"\n'
  );
  try {
    assert.equal(readHarnessConfig(dir).agent, "direct {prompt_file}");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a profile that does not exist names the ones that do", () => {
  const dir = projectWithProfiles(
    "harness_version: 1\nagent_profile: nope\n",
    'profiles_version: 1\nprofiles:\n  ci:\n    agent: "a {prompt_file}"\n  local:\n    agent: "b {prompt_file}"\n'
  );
  try {
    assert.throws(
      () => readHarnessConfig(dir),
      (err) => /no profile 'nope'/.test(err.message) && /ci, local/.test(err.message)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("agent_profile without a profiles.yaml says so, and offers the alternative", () => {
  const dir = projectWithProfiles("harness_version: 1\nagent_profile: local\n");
  try {
    assert.throws(
      () => readHarnessConfig(dir),
      (err) => /profiles\.yaml/.test(err.message) && /agent:/.test(err.message)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown key is rejected rather than ignored", () => {
  // Silently ignoring one is how a pilot ends up configured against a feature
  // that does not exist.
  const dir = projectWithProfiles('harness_version: 1\nagnet: "typo {prompt_file}"\n');
  try {
    assert.throws(
      () => readHarnessConfig(dir),
      (err) => /unknown key\(s\): agnet/.test(err.message) && /Known keys:/.test(err.message)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every key `harness init` generates is a key the reader accepts", () => {
  // The two ends of the same contract: what the scaffolder writes must be what
  // the reader understands, or the strict check above turns into a trap.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-roundtrip-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
      {
        encoding: "utf8",
      }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(parent, fs.readdirSync(parent)[0]);
    const gen = spawnSync(process.execPath, [CLI, "harness", "init", "--project-dir", projectDir], {
      encoding: "utf8",
    });
    assert.equal(gen.status, 0, gen.stdout + gen.stderr);
    assert.doesNotThrow(() => readHarnessConfig(projectDir));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── The gate has to be able to run the scenario under test ───────────────────
//
// `test_cmd` was a fixed string, and the gate runs *before* `specgate done`, so the
// requirement is still Draft and `validate --strict-tdd` does not demand its
// test either. Between the two, the loop could mark a requirement Implemented
// with its scenario never executed — the one outcome this tool exists to
// prevent. Substitution is what lets a project close that.

test("the gate command substitutes the requirement under test", () => {
  const cmd = substituteGateCommand(
    "npm run verify && npm run test:e2e -- {feature_file} --tags @{req} # {scenario}",
    {
      requirement: "REQ-007",
      scenarioId: "SCN-007",
      featureFile: "`features/billing/refund.feature`",
    }
  );
  // Backticks come from the matrix cell and are not part of the path.
  assert.match(cmd, /test:e2e -- features\/billing\/refund\.feature/);
  assert.match(cmd, /--tags @REQ-007/);
  assert.match(cmd, /# SCN-007/);
  assert.doesNotMatch(cmd, /`/);
});

test("the gate command accepts the matrix's snake_case spelling too", () => {
  // Same seam as buildPrompt: `plan --format json` used snake_case before the
  // contract was normalised, and a hand-piped older document should still work.
  const cmd = substituteGateCommand("run {feature_file} for {scenario}", {
    requirement: "REQ-001",
    scenario_id: "SCN-001",
    feature_file: "features/core/health.feature",
  });
  assert.equal(cmd, "run features/core/health.feature for SCN-001");
});

test("a gate command with no placeholders is passed through untouched", () => {
  assert.equal(substituteGateCommand("mvn -B test", { requirement: "REQ-002" }), "mvn -B test");
});

test("a missing feature file substitutes empty rather than the word undefined", () => {
  // `npm test -- undefined` would run, and fail for a reason that reads like a
  // bug in the project rather than a gap in its matrix.
  const cmd = substituteGateCommand("npm test -- {feature_file}", { requirement: "REQ-003" });
  assert.equal(cmd, "npm test -- ");
});

test("an anchor in the feature cell is dropped, since it is not a path", () => {
  const cmd = substituteGateCommand("run {feature_file}", {
    featureFile: "features/a/b.feature#L12",
  });
  assert.equal(cmd, "run features/a/b.feature");
});

// ── A failing run has to be diagnosable ──────────────────────────────────────
//
// The gate's full output was captured into `error` and then reduced to its
// first line by the report, so a failure read "Gate failed at: test command"
// and nothing else. With the worktree removed by default, that left nothing to
// act on — found by running REQ-002 and being unable to tell why it failed.

function captureReport(results, format = "text") {
  const written: string[] = [];
  const original = process.stdout.write;
  (process.stdout as any).write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    printReport(results, format);
  } finally {
    (process.stdout as any).write = original;
  }
  return written.join("");
}

test("a failing requirement shows the gate output, not just its first line", () => {
  const out = captureReport([
    {
      requirement: "REQ-002",
      result: "fail",
      attempts: 2,
      branch: "harness/REQ-002",
      error:
        "Gate failed at: test command\n\n" +
        "> csda-studio-app@0.1.0 test:e2e\n" +
        "AssertionError: expected 'Required field id missing' to equal ''\n" +
        "    at World.<anonymous> (features/step_definitions/validate_schema.steps.ts:31:12)\n" +
        "1 scenario (1 failed)\n",
    },
  ]);
  assert.match(out, /Gate failed at: test command/);
  assert.match(out, /AssertionError/, "the actual failure must reach the report");
  assert.match(out, /validate_schema\.steps\.ts/, "so must the file that failed");
  assert.match(out, /1 scenario \(1 failed\)/);
});

test("the failure block points at the flags that give more", () => {
  const out = captureReport([
    {
      requirement: "REQ-002",
      result: "fail",
      attempts: 1,
      branch: "harness/REQ-002",
      error: "Gate failed at: test command\n\nsomething broke\n",
    },
  ]);
  assert.match(out, /--format json/);
  assert.match(out, /--keep-worktrees/);
});

test("a passing requirement prints no failure block", () => {
  const out = captureReport([
    { requirement: "REQ-001", result: "pass", attempts: 1, branch: "harness/REQ-001" },
  ]);
  assert.doesNotMatch(out, /keep-worktrees/);
  assert.match(out, /✅ REQ-001/);
});

test("a single-line error prints without an empty tail or a dangling hint", () => {
  const out = captureReport([
    {
      requirement: "REQ-003",
      result: "skipped",
      attempts: 0,
      branch: "harness/REQ-003",
      error: "Branch harness/REQ-003 already exists. Re-run with --force to recreate it.",
    },
  ]);
  assert.match(out, /already exists/);
  assert.doesNotMatch(out, /full output/, "no hint when there is nothing more to show");
});

test("json keeps the whole error, since that is what a machine reads", () => {
  const error = "Gate failed at: test command\n\nline one\nline two\n";
  const out = captureReport(
    [{ requirement: "REQ-002", result: "fail", attempts: 1, branch: "b", error }],
    "json"
  );
  assert.equal(JSON.parse(out).results[0].error, error);
});

// ── A failed run has to leave something behind ───────────────────────────────

test("the default timeout reflects what a real agent needs", () => {
  // 600 was a guess and both real runs disproved it: the first REQ-001 attempt
  // hit 900s while the agent installed dependencies and worked. A default that
  // times out on ordinary work makes every first attempt a wasted one.
  assert.equal(parseArgs([]).timeout, 1200);
});

test("the report says where a failed attempt was preserved", () => {
  const out = captureReport([
    {
      requirement: "REQ-002",
      result: "fail",
      attempts: 2,
      branch: "harness/REQ-002",
      error: "Gate failed at: test command\n\nassertion blew up\n",
      workPreserved: true,
    },
  ]);
  assert.match(out, /committed on harness\/REQ-002/);
});

test("the report distinguishes a failing agent from an idle one", () => {
  // "produced no files" and "produced broken files" need different responses:
  // one is a prompt or permissions problem, the other is a code problem.
  const out = captureReport([
    {
      requirement: "REQ-002",
      result: "fail",
      attempts: 1,
      branch: "harness/REQ-002",
      error: "Gate failed at: test command\n\nnothing happened\n",
      workPreserved: false,
    },
  ]);
  assert.match(out, /produced no files/);
  assert.doesNotMatch(out, /committed on/);
});

test("a passing requirement says nothing about preservation", () => {
  const out = captureReport([
    { requirement: "REQ-001", result: "pass", attempts: 1, branch: "harness/REQ-001" },
  ]);
  assert.doesNotMatch(out, /produced no files/);
  assert.doesNotMatch(out, /committed on/);
});

test("the failing gate names the command it ran", () => {
  // A gate that silently does the wrong thing — running the whole suite because
  // a filter did not apply — fails identically to a real failure. This is what
  // made REQ-002's false failure take two agent runs to explain.
  const out = captureReport([
    {
      requirement: "REQ-002",
      result: "fail",
      attempts: 1,
      branch: "harness/REQ-002",
      error:
        "Gate failed at: test command: npm run test:e2e -- features/pack-browsing/validate_schema.feature\n\n" +
        "16 scenarios (13 undefined, 3 passed)\n",
    },
  ]);
  assert.match(out, /test:e2e -- features\/pack-browsing\/validate_schema\.feature/);
  assert.match(out, /16 scenarios/);
});

// ── A gate that silently ran the wrong thing ─────────────────────────────────

test("filterHint fires when one feature was asked for and many ran", () => {
  // The REQ-002 false failure: the scenario passed, the gate ran the whole
  // suite because a `paths` key in the base branch overrode the argument, and
  // the failure was indistinguishable from broken code.
  const hint = filterHint(
    "npm run test:e2e -- {feature_file}",
    { featureFile: "features/pack-browsing/validate_schema.feature" },
    "16 scenarios (13 undefined, 3 passed)\n"
  );
  assert.match(hint, /asked for one feature/);
  assert.match(hint, /validate_schema\.feature/);
  assert.match(hint, /16 scenarios/);
  assert.match(hint, /base branch/, "the fix is on the base, not only on main");
});

test("filterHint stays quiet when the gate never asked to filter", () => {
  assert.equal(filterHint("npm test", { featureFile: "a.feature" }, "16 scenarios (1 failed)"), "");
});

test("filterHint stays quiet on a genuine single-scenario failure", () => {
  // The common case must not be second-guessed into looking like a config bug.
  assert.equal(
    filterHint(
      "npm run test:e2e -- {feature_file}",
      { featureFile: "a.feature" },
      "1 scenario (1 failed)"
    ),
    ""
  );
});

test("filterHint recognises the counts other runners print", () => {
  for (const [out, word] of [
    ["42 tests, 3 failures", "tests"],
    ["7 examples, 1 failure", "examples"],
    ["9 specs completed", "specs"],
  ]) {
    const hint = filterHint("run {feature_file}", { featureFile: "a.feature" }, out);
    assert.match(hint, new RegExp(word), `should recognise "${word}"`);
  }
});

test("filterHint needs a feature file to reason about", () => {
  assert.equal(filterHint("run {feature_file}", {}, "16 scenarios (1 failed)"), "");
});

// ── A scenario that cannot fail is not worth an agent (A3) ───────────────────
//
// The harness gates a requirement by running its scenario. If Cucumber sees no
// steps in that scenario, the gate reports `0 steps · exit 0`, the run is
// recorded as a pass, and the branch is published — the agent was paid for and
// nothing was verified. H14 from the harness's side: not a weak signal, a
// counterfeit one.
//
// So the check runs before the worktree, before the prompt, before the agent.
// The assertion that matters is the last one: the agent never ran.

test("harness run refuses a requirement whose scenario has no steps, before spending the agent", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-a3-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
      {
        encoding: "utf8",
      }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

    spawnSync("git", ["init", "-q"], { cwd: projectDir });
    spawnSync("git", ["config", "user.email", "harness-test@example.com"], { cwd: projectDir });
    spawnSync("git", ["config", "user.name", "Harness Test"], { cwd: projectDir });
    spawnSync("git", ["add", "-A"], { cwd: projectDir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed"], {
      cwd: projectDir,
    });

    const planned = spawnSync(
      process.execPath,
      [CLI, "plan", "--project-dir", projectDir, "--format", "json"],
      { encoding: "utf8" }
    );
    const req = (JSON.parse(planned.stdout).requirements || [])[0];
    assert.ok(req, "plan returned no requirements");
    // The matrix stores the path as markdown, so plan hands it back inside
    // back-ticks. `featureFilePath` is the one place that knows this.
    const featureRel = featureFilePath(req);
    assert.ok(featureRel, "the scaffolded requirement declares no feature file");

    // Shout the keywords. Cucumber now reads every step as prose.
    const featurePath = path.join(projectDir, featureRel);
    const shouted = fs
      .readFileSync(featurePath, "utf8")
      .replace(/^(\s*)(Given|When|Then|And) /gm, (_m, pad, kw) => `${pad}${kw.toUpperCase()} `);
    fs.writeFileSync(featurePath, shouted, "utf8");
    spawnSync("git", ["add", "-A"], { cwd: projectDir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "shout"], {
      cwd: projectDir,
    });

    // An agent that leaves a trace if it is ever invoked.
    const marker = path.join(parent, "agent-ran.txt");
    const agent = `${process.execPath} -e "require('fs').writeFileSync(${JSON.stringify(marker)},'ran')"`;

    const run = spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        projectDir,
        "--req",
        req.requirement,
        "--agent",
        agent,
        "--format",
        "json",
      ],
      { encoding: "utf8" }
    );

    const out = run.stdout + run.stderr;
    assert.match(out, /keyword_case_invalid|scenario_has_no_steps/, `no refusal in:\n${out}`);
    assert.equal(
      fs.existsSync(marker),
      false,
      "the agent was invoked against a scenario that cannot fail — the check ran too late"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── The agent may not edit the contract it is judged against (A1, H16) ───────
//
// Measured before it was written. An agent that replaced the scenario with
// `Given nothing / When nothing happens / Then nothing is asserted` produced:
//
//     1 passed · 0 failed · 0 skipped
//
// The branch was published and the requirement closed. `validate --strict-tdd`
// checks that the feature exists and is in the matrix, never that it still says
// what it said — so "specs as executable contracts" held only for as long as
// the executor chose not to edit the contract.

/** A project whose gate can actually go green, so the guard is the only variable. */
function greenableProject() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "harness-a1-"));
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

  // The scaffold leaves a template REQ-001 in spec.md with no matrix row, which
  // `--strict-tdd` refuses (TDD-3). Left in place, the gate can never pass and
  // this test would prove nothing about the guard.
  const specPath = path.join(projectDir, "spec.md");
  fs.writeFileSync(
    specPath,
    fs
      .readFileSync(specPath, "utf8")
      .split("\n")
      .filter((l) => !l.includes("REQ-001"))
      .join("\n"),
    "utf8"
  );

  const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "harness-test@example.com");
  git("config", "user.name", "Harness Test");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  return { parent, projectDir };
}

/** Each agent gets its own file: several may exist in one fixture. */
let scriptedAgentSeq = 0;

/**
 * An agent that performs `writes` in the worktree and exits 0.
 *
 * A Node script, not a shell one. The shell version passed on macOS and Linux
 * and failed on Windows: `mkdir -p`, `printf` and `>>` are not portable, and
 * the harness runs the agent through `shell: true`, which is `cmd.exe` there.
 * Describing the writes rather than scripting them makes the fixture mean the
 * same thing on all three platforms.
 *
 * `writes` is a list of `[relative path, contents]`. Contents starting with `+`
 * are appended. `sleepMs` delays before exiting, for the budget tests.
 */
function scriptedAgent(parent, writes, opts: any = {}) {
  const file = path.join(parent, `agent-${(scriptedAgentSeq += 1)}.js`);
  fs.writeFileSync(
    file,
    [
      'const fs = require("node:fs");',
      'const p = require("node:path");',
      `for (const [rel, content] of ${JSON.stringify(writes)}) {`,
      "  const target = p.join(process.cwd(), rel);",
      "  fs.mkdirSync(p.dirname(target), { recursive: true });",
      '  if (content.startsWith("+")) fs.appendFileSync(target, content.slice(1), "utf8");',
      '  else fs.writeFileSync(target, content, "utf8");',
      "}",
      opts.sleepMs ? `const until = Date.now() + ${opts.sleepMs};` : "",
      opts.sleepMs ? "while (Date.now() < until) {}" : "",
      "",
    ].join("\n"),
    "utf8"
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

/**
 * The smallest agent that is not a no-op.
 *
 * These tests used to hand the harness `true {prompt_file}` — a command that
 * reads nothing, writes nothing and exits 0 — as the stand-in for "an agent
 * whose work passes the gate". Every assertion built on it was quietly
 * asserting **H19**: an agent that produced no files reporting `pass`, with the
 * requirement moved to `Implemented`. The suite was not merely blind to the
 * defect, it encoded it as correct — the same shape as H3, where a test
 * weakened its own clean-tree check to keep passing.
 *
 * The harness now refuses an empty attempt, so the stand-in has to do what the
 * cheapest real agent does: write one file.
 */
function minimalAgent(parent) {
  return scriptedAgent(parent, [
    ["src/harness-fixture.ts", "export const writtenByTheFixtureAgent = true;\n"],
  ]);
}

function runHarness(projectDir, agent, extra = []) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      projectDir,
      "--req",
      "REQ-000",
      "--agent",
      agent,
      "--max-attempts",
      "1",
      ...extra,
    ],
    { encoding: "utf8" }
  );
}

test("the fixture's gate really can pass, or the guard test below proves nothing", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent));
    assert.match(r.stdout + r.stderr, /1 passed/, `${r.stdout}${r.stderr}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an agent that guts the scenario fails, and the run says which file", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [
      [
        "features/core/health.feature",
        "Feature: Platform health baseline\n" +
          "  Scenario: API reports service as healthy\n" +
          "    Given nothing in particular\n" +
          "    When nothing happens\n" +
          "    Then nothing is asserted\n",
      ],
    ]);
    const r = runHarness(projectDir, agent);
    const out = r.stdout + r.stderr;

    assert.match(out, /0 passed/, `the gutted scenario passed:\n${out}`);
    assert.match(out, /agent_touched_protected_path/);
    assert.match(out, /features\/core\/health\.feature/);
    // The diff goes back to the agent: it almost always did this without
    // meaning to, and being shown the hunk is what corrects it.
    assert.match(out, /Feature: Platform health baseline/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("writing code is not a violation — the guard protects the contract, not the repo", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [["src/App.java", "class App {}\n"]]);
    const r = runHarness(projectDir, agent);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, /agent_touched_protected_path/, out);
    assert.match(out, /1 passed/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("creating a feature that did not exist is allowed (NEEDS_FEATURE)", () => {
  // A requirement in that category is *supposed* to write its feature file. A
  // blanket ban on features/** would fail the legitimate case; git's own
  // tracked/untracked split is what tells the two apart.
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [
      [
        "features/core/brand-new.feature",
        "Feature: New\n  Scenario: Something specific happens here\n" +
          "    Given a precondition\n    When it runs\n    Then it is observable\n",
      ],
    ]);
    const r = runHarness(projectDir, agent);
    assert.doesNotMatch(r.stdout + r.stderr, /agent_touched_protected_path/, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("allow_paths in harness.config.yaml is an escape hatch that has to be written down", () => {
  const { parent, projectDir } = greenableProject();
  try {
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      ["allow_paths:", "  - 'features/**'", ""].join("\n"),
      "utf8"
    );
    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "allow");

    const agent = scriptedAgent(parent, [
      [
        "features/core/health.feature",
        "Feature: Platform health baseline\n  Scenario: API reports service as healthy\n" +
          "    Given nothing\n    When nothing\n    Then nothing\n",
      ],
    ]);
    const r = runHarness(projectDir, agent);
    assert.doesNotMatch(
      r.stdout + r.stderr,
      /agent_touched_protected_path/,
      "an explicit allow_paths entry must be honoured"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── #167: the guard protected the contract but not the gate's own command ────

test("an agent that rewrites the test script fails the attempt", () => {
  // Measured before the fix: a stub agent that wrote no implementation at all
  // and only replaced `"test"` with `echo 'all good'`, over a red suite,
  // produced `✅ REQ-001 pass (1 attempt)`. An agent that cannot pass the test
  // could weaken the test.
  const { parent, projectDir } = greenableProject();
  try {
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "x", scripts: { test: "exit 1" } }, null, 1)
    );
    spawnSync("git", ["add", "-A"], { cwd: projectDir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "pkg"], {
      cwd: projectDir,
    });

    const agent = scriptedAgent(parent, [
      [
        "package.json",
        JSON.stringify({ name: "x", scripts: { test: "echo 'all good'" } }, null, 1),
      ],
    ]);
    const r = runHarness(projectDir, agent, ["--test-cmd", "npm test"]);
    const out = r.stdout + r.stderr;

    assert.match(out, /0 passed/, `the rewritten gate passed:\n${out}`);
    assert.match(out, /agent_rewrote_gate_command/, out);
    assert.match(out, /scripts\.test/, out);
    // The before/after goes back to the agent, same as the write-scope diff.
    assert.match(out, /all good/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("adding a dependency is not a violation — that is legitimate work", () => {
  // A guard that blocks this gets switched off, and then it protects nothing.
  const { parent, projectDir } = greenableProject();
  try {
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "x", scripts: { test: "exit 0" } }, null, 1)
    );
    spawnSync("git", ["add", "-A"], { cwd: projectDir });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "pkg"], {
      cwd: projectDir,
    });

    const agent = scriptedAgent(parent, [
      [
        "package.json",
        JSON.stringify(
          { name: "x", scripts: { test: "exit 0" }, dependencies: { zod: "^3" } },
          null,
          1
        ),
      ],
    ]);
    const r = runHarness(projectDir, agent, ["--test-cmd", "npm test"]);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, /agent_rewrote_gate_command/, out);
    assert.match(out, /1 passed/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("protected_paths and allow_paths are read from harness.config.yaml", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-cfg-"));
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      [
        "agent: 'x {prompt_file}'",
        "protected_paths:",
        "  - 'contracts/**'",
        "allow_paths:",
        "  - 'features/legacy/**'",
        "",
      ].join("\n"),
      "utf8"
    );
    const cfg = readHarnessConfig(dir);
    assert.deepEqual(cfg.protectedPaths, ["contracts/**"]);
    assert.deepEqual(cfg.allowPaths, ["features/legacy/**"]);

    // From the file only — a flag that widens what the agent may edit is a flag
    // somebody eventually types to turn a red run green.
    const settings = resolveHarnessSettings(cfg, {});
    assert.deepEqual(settings.protectedPaths, ["contracts/**"]);
    assert.deepEqual(settings.allowPaths, ["features/legacy/**"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed protected_paths is rejected, not quietly ignored", () => {
  // A guard that silently protects nothing is worse than no guard: it reports
  // clean over an edited spec.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-bad-"));
  try {
    fs.writeFileSync(path.join(dir, "harness.config.yaml"), "protected_paths: spec.md\n", "utf8");
    assert.throws(() => readHarnessConfig(dir), /protected_paths/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no configuration means the built-in protected paths still apply", () => {
  const settings = resolveHarnessSettings(null, {});
  assert.deepEqual(settings.protectedPaths, [], "empty means 'use the defaults'");
  // The defaults live in the domain, and the guard falls back to them.
  assert.ok(DEFAULT_PROTECTED_PATHS.includes("spec.md"));
  assert.ok(DEFAULT_PROTECTED_PATHS.includes("features/**/*.feature"));
});

// ── The green diff must touch what the matrix declared (A2) ──────────────────
//
// The row names `test_artifact` and `technical_artifact`, the prompt hands both
// to the agent, and nothing checked the diff contained them. An agent can
// implement somewhere else, pass the scenario, and leave the matrix pointing at
// a file where the logic does not live — the documentary lie `AI_RULES.md`
// forbids this repository.

/** The same greenable project, with real paths in the row instead of prose. */
function projectWithDeclaredPaths({ existing = false } = {}) {
  const { parent, projectDir } = greenableProject();
  if (existing) {
    // The shared-module case: the declared files are already there.
    fs.mkdirSync(path.join(projectDir, "src/test"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src/Health.java"), "class Health {}\n");
    fs.writeFileSync(path.join(projectDir, "src/test/HealthTest.java"), "class HealthTest {}\n");
  }
  const matrix = path.join(projectDir, "docs/specs/traceability.md");
  fs.writeFileSync(
    matrix,
    fs
      .readFileSync(matrix, "utf8")
      .replace(
        "| `API /health`, smoke test | TBD |",
        "| `src/Health.java` | `src/test/HealthTest.java` |"
      ),
    "utf8"
  );
  const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "paths");
  return { parent, projectDir };
}

test("implementing elsewhere warns but does not fail by default", () => {
  // A warning, deliberately: work can legitimately land in a shared module that
  // already exists, and failing on that is the kind of gate that rejects good
  // work — which already cost two runs on REQ-002.
  const { parent, projectDir } = projectWithDeclaredPaths({ existing: true });
  try {
    const agent = scriptedAgent(parent, [["src/other/Elsewhere.java", "x\n"]]);
    const r = runHarness(projectDir, agent);
    const out = r.stdout + r.stderr;
    assert.match(out, /declared_artifact_untouched/, out);
    assert.match(out, /src\/Health\.java/);
    assert.match(out, /specgate req link REQ-000 --code/, "the fix must name a flag that exists");
    assert.match(out, /1 passed/, `a warning must not fail the run:\n${out}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("implementing elsewhere when the declared file does not exist fails the gate", () => {
  // The harness gate is `validate --strict --delivering REQ`, the gate CI runs.
  // With `--strict-tdd` it passed here and marked REQ-000 Implemented on a
  // `src/Health.java` that did not exist, so the next CI run went red.
  const { parent, projectDir } = projectWithDeclaredPaths();
  try {
    const agent = scriptedAgent(parent, [["src/other/Elsewhere.java", "x\n"]]);
    const out = runHarness(projectDir, agent).stdout;
    assert.match(out, /declared_artifact_missing/, out);
    assert.match(out, /0 passed/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--strict-artifacts turns the same warning into a failed attempt", () => {
  const { parent, projectDir } = projectWithDeclaredPaths({ existing: true });
  try {
    const agent = scriptedAgent(parent, [["src/other/Elsewhere.java", "x\n"]]);
    const r = runHarness(projectDir, agent, ["--strict-artifacts"]);
    assert.match(r.stdout + r.stderr, /0 passed/, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("implementing where the row says passes, even under --strict-artifacts", () => {
  // The regression that matters most here. Plain `git status --porcelain`
  // collapses a wholly new directory into `?? src/`, so `src/Health.java` never
  // appears and the check concludes it was never written. This agent creates
  // both declared files correctly; without `-uall` it is reported as touching
  // neither, and the strict gate rejects correct work.
  const { parent, projectDir } = projectWithDeclaredPaths();
  try {
    const agent = scriptedAgent(parent, [
      ["src/Health.java", "x\n"],
      ["src/test/HealthTest.java", "y\n"],
    ]);
    const r = runHarness(projectDir, agent, ["--strict-artifacts"]);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, /declared_artifact_untouched/, out);
    assert.match(out, /1 passed/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a prose-only row says nothing — the scaffolded project must stay quiet", () => {
  // `specgate init` writes `` `API /health`, smoke test `` and `TBD`. If those ever
  // start warning, every first harness run complains and the warning becomes
  // noise people learn to skip.
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [["src/App.java", "x\n"]]);
    const r = runHarness(projectDir, agent, ["--strict-artifacts"]);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, /declared_artifact_untouched/, out);
    assert.match(out, /1 passed/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Picking a run back up where it stopped (C3) ──────────────────────────────
//
// Until now an existing `harness/REQ-NNN` branch left two options: skip it, or
// delete it with `--force`. After an interruption — a crash, a Ctrl-C, a spend
// limit — neither is what anyone wants: you either lose the work or cannot
// continue.
//
// The design was measured. A run killed with `kill -9` leaves the branch (no
// commits), the worktree with the agent's uncommitted partial work, an empty
// `.harness/runs/`, and the prompt archive. The ledger is written when a run
// *finishes*, so it is exactly no use for the case this exists for.

test("--force and --resume are refused together", () => {
  // They are opposites, and silently picking one is how work gets deleted after
  // an interruption — the loss --resume exists to prevent.
  assert.throws(() => parseArgs(["--force", "--resume"]), /opposites/);
});

test("without --resume, the skip message now offers it", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [["note.txt", "x\n"]]);
    assert.match(runHarness(projectDir, agent).stdout, /1 passed/);
    const again = runHarness(projectDir, agent);
    const out = again.stdout + again.stderr;
    assert.match(out, /already exists/);
    assert.match(out, /--resume to continue it/);
    assert.match(out, /--force to recreate it/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--resume over a requirement that never started runs it, rather than refusing", () => {
  // `--resume` on a whole plan must not become "do nothing unless everything
  // was already attempted".
  const { parent, projectDir } = greenableProject();
  try {
    const agent = scriptedAgent(parent, [["note.txt", "x\n"]]);
    const r = runHarness(projectDir, agent, ["--resume"]);
    assert.match(r.stdout + r.stderr, /1 passed/, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--resume re-attaches to the interrupted worktree and keeps the partial work", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });

    // The state a kill -9 leaves behind: branch at base, a live worktree with
    // uncommitted work, and one archived prompt for the attempt in flight.
    const worktree = path.join(parent, "interrupted-worktree");
    const added = git("worktree", "add", "-b", "harness/REQ-000", worktree, "HEAD");
    assert.equal(added.status, 0, added.stderr);
    fs.writeFileSync(path.join(worktree, "partial-work.txt"), "half-finished\n", "utf8");
    const archive = path.join(worktree, ".specops", "harness-prompts");
    fs.mkdirSync(archive, { recursive: true });
    fs.writeFileSync(
      path.join(archive, "REQ-000-2026-08-22T10-00-00-000Z-attempt-1-agent.md"),
      "# Implement REQ-000\n",
      "utf8"
    );

    const r = runHarness(projectDir, scriptedAgent(parent, [["partial-work.txt", "+more\n"]]), [
      "--resume",
    ]);
    assert.match(r.stdout + r.stderr, /1 passed/, r.stdout + r.stderr);

    // The whole point: the interrupted work is on the branch, not discarded.
    const show = git("show", "--stat", "harness/REQ-000");
    assert.match(show.stdout, /partial-work\.txt/, "the partial work was lost");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("after exhausted attempts, --resume picks up at the next attempt", () => {
  // Interrupted and exhausted deserve different answers, and the branch says
  // which: `preserveFailedAttempt` leaves a `wip(...): FAILED the gate` commit
  // when the attempts run out; an interruption leaves none. An attempt that
  // reached a verdict is spent; one that was cut short is not.
  const { parent, projectDir } = greenableProject();
  try {
    // An agent that breaks the gate: it removes the matrix row's test artifact
    // declaration is overkill — simply failing the gate is enough, so make the
    // agent produce nothing and break validate by emptying the feature.
    const breaking = scriptedAgent(parent, [["features/core/health.feature", "Feature: X\n"]]);
    const first = runHarness(projectDir, breaking, ["--max-attempts", "2"]);
    assert.match(first.stdout + first.stderr, /0 passed/);

    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    const head = git("log", "-1", "--format=%s", "harness/REQ-000").stdout;
    assert.match(head, /FAILED the gate/, "the exhausted run should have left a wip commit");

    const resumed = runHarness(projectDir, minimalAgent(parent), [
      "--resume",
      "--max-attempts",
      "3",
    ]);
    assert.match(resumed.stdout + resumed.stderr, /resuming at attempt 3/, resumed.stdout);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a resumed run cleans up the worktree it re-attached to", () => {
  // The cleanup removes `dir`, not the path a fresh run would have invented. If
  // it removed the latter, the surviving worktree would stay registered after
  // every resume and the list would grow without bound — and `git worktree
  // remove` on a path that never existed fails quietly, so nothing would say so.
  const { parent, projectDir } = greenableProject();
  try {
    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    const worktree = path.join(parent, "interrupted-worktree");
    assert.equal(git("worktree", "add", "-b", "harness/REQ-000", worktree, "HEAD").status, 0);
    fs.writeFileSync(path.join(worktree, "partial-work.txt"), "half\n", "utf8");

    const r = runHarness(projectDir, scriptedAgent(parent, [["partial-work.txt", "+more\n"]]), [
      "--resume",
    ]);
    assert.match(r.stdout + r.stderr, /1 passed/, r.stdout + r.stderr);

    const listed = git("worktree", "list", "--porcelain").stdout;
    assert.doesNotMatch(
      listed,
      /interrupted-worktree/,
      `the re-attached worktree was left registered:\n${listed}`
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Is this requirement fit to hand to an agent? (B2) ────────────────────────
//
// `plan` has always known that a requirement's feature does not exist, that its
// dependencies are unmet, or that its row is Deprecated. `harness run` never
// used any of it as a filter, so the agent found out halfway through and the
// run paid `max_attempts` × the timeout to discover it.
//
// Default stays warn-and-run — this ships in a minor, and a person who wants to
// point an agent at a half-ready requirement is allowed to. The one exception
// is an unrunnable scenario, which skips regardless: Cucumber passes an empty
// scenario, so a green run would prove nothing (H14).

/** The greenable project, with its row pointing at a feature that is not there. */
function projectWithMissingFeature() {
  const { parent, projectDir } = greenableProject();
  const matrix = path.join(projectDir, "docs/specs/traceability.md");
  fs.writeFileSync(
    matrix,
    fs
      .readFileSync(matrix, "utf8")
      .replace("`features/core/health.feature`", "`features/core/missing.feature`"),
    "utf8"
  );
  const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "missing feature");
  return { parent, projectDir };
}

test("a requirement with no feature warns, with a fix, and still runs by default", () => {
  const { parent, projectDir } = projectWithMissingFeature();
  try {
    const r = runHarness(projectDir, minimalAgent(parent));
    const out = r.stdout + r.stderr;
    assert.match(out, /requirement_has_no_feature/, out);
    assert.match(
      out,
      /specgate req link REQ-000 --feature/,
      "a blocker without a fix just stops you"
    );
    // Not `/skipped/` — the summary line always contains the word. The count is
    // what says whether the default changed.
    assert.match(out, /0 skipped/, "the default must not change behaviour in a minor");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--skip-not-ready skips it instead, naming the blocker", () => {
  const { parent, projectDir } = projectWithMissingFeature();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), ["--skip-not-ready"]);
    const out = r.stdout + r.stderr;
    assert.match(out, /1 skipped/, out);
    assert.match(out, /Not ready for an agent: requirement_has_no_feature/);
    assert.match(out, /drop --skip-not-ready to run it anyway/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an unrunnable scenario skips even without --skip-not-ready", () => {
  // Not a preference. An empty scenario passes, so the reward signal is
  // counterfeit and a green run proves nothing — the A3 guard, kept.
  const { parent, projectDir } = greenableProject();
  try {
    const feature = path.join(projectDir, "features/core/health.feature");
    fs.writeFileSync(
      feature,
      fs
        .readFileSync(feature, "utf8")
        .replace(/^(\s*)(Given|When|Then|And) /gm, (_m, pad, kw) => `${pad}${kw.toUpperCase()} `),
      "utf8"
    );
    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "shout");

    const r = runHarness(projectDir, minimalAgent(parent));
    const out = r.stdout + r.stderr;
    assert.match(out, /1 skipped/, out);
    assert.match(out, /requirement_scenario_unrunnable/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a ready requirement runs clean, with no readiness noise", () => {
  // The false-positive check. If a scaffolded project cannot pass its own
  // readiness rules, the rules are wrong.
  const { parent, projectDir } = greenableProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), ["--skip-not-ready"]);
    const out = r.stdout + r.stderr;
    assert.match(out, /1 passed/, out);
    assert.doesNotMatch(out, /requirement_has_no_feature/);
    assert.doesNotMatch(out, /requirement_scenario_unrunnable/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("plan --json carries ready and blockers, each blocker with a fix", () => {
  // Where B2 says the answer belongs: calculated, in the plan, rather than the
  // intuition of whoever typed the run command.
  const { parent, projectDir } = projectWithMissingFeature();
  try {
    const planned = spawnSync(
      process.execPath,
      [CLI, "plan", "--project-dir", projectDir, "--format", "json"],
      { encoding: "utf8" }
    );
    const req = JSON.parse(planned.stdout).requirements[0];
    assert.equal(req.ready, false);
    const codes = req.blockers.map((b) => b.code);
    assert.ok(codes.includes("requirement_has_no_feature"), codes.join(", "));
    for (const b of req.blockers) assert.ok(b.fix, `${b.code} has no fix`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a ready requirement reads as ready in plan --json", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const planned = spawnSync(
      process.execPath,
      [CLI, "plan", "--project-dir", projectDir, "--format", "json"],
      { encoding: "utf8" }
    );
    const req = JSON.parse(planned.stdout).requirements[0];
    assert.equal(req.ready, true, JSON.stringify(req.blockers));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Reading what Cucumber did, not what it printed (F5) ──────────────────────
//
// Measured before writing it: a harness run whose test command was
// `cucumber-js --tags '@does-not-exist'` reported
//
//     1 passed · 0 failed · 0 skipped
//
// The command exits 0 on a filter that matches nothing (§2.2), so the gate
// approved a requirement whose scenario never ran, published the branch and
// closed it. This runs the real cucumber-js and pins both directions.

/** A project whose gate command is a real cucumber-js invocation. */
function cucumberProject() {
  const { parent, projectDir } = greenableProject();
  fs.mkdirSync(path.join(projectDir, "features/step_definitions"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "features/step_definitions/steps.js"),
    [
      'const { Given, When, Then } = require("@cucumber/cucumber");',
      'Given("the backend service is running", function () {});',
      'When("I request the {string} endpoint", function () {});',
      'Then("the response status should be {int}", function () {});',
      'Then("the payload should include {string} with value {string}", function () {});',
      "",
    ].join("\n"),
    "utf8"
  );
  // A fresh worktree carries only what git tracks, so the runner needs the
  // repository's own installed Cucumber.
  fs.symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(projectDir, "node_modules"));
  const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "cucumber");
  return { parent, projectDir };
}

test("a filter matching nothing exits 0, and the gate no longer believes it", () => {
  const { parent, projectDir } = cucumberProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), [
      "--test-cmd",
      "npx cucumber-js --tags '@does-not-exist'",
    ]);
    const out = r.stdout + r.stderr;
    assert.match(out, /0 passed/, `the empty run was accepted:\n${out}`);
    assert.match(out, /cucumber messages/);
    assert.match(out, /never ran/);
    assert.match(out, /exited 0, but the run it reported does not support that verdict/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a run that really covers the requirement still passes", () => {
  // The false-positive check: if reading the stream fails honest work, the
  // check is worse than the exit code it replaced.
  const { parent, projectDir } = cucumberProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), [
      "--test-cmd",
      "npx cucumber-js features/core/health.feature",
    ]);
    const out = r.stdout + r.stderr;
    assert.match(out, /1 passed/, out);
    assert.doesNotMatch(out, /cucumber messages/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a non-Cucumber command is judged by its exit code, exactly as before", () => {
  // The harness stays runner-neutral: a project that does not use Cucumber
  // must not be failed by a reader that never applied.
  const { parent, projectDir } = greenableProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), ["--test-cmd", "true"]);
    assert.match(r.stdout + r.stderr, /1 passed/, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── A ceiling on what one run may spend (C1) ─────────────────────────────────
//
// `max_attempts` was the only limit the harness had. Fourteen requirements ×
// 3 attempts × 1200 s is hours of wall-clock and an unbounded bill, and the
// third real run ended because the account hit its monthly limit — the
// expensive way to find out there was no ceiling of our own.
//
// Exhausting a budget is not an error: the run ends the ordinary way, names
// what it never started, and still writes its ledger. A run that dies halfway
// never writes one, so `harness report` cannot say what the money bought.

/** A project with three independent requirements — so they share one level. */
function threeRequirementProject() {
  const { parent, projectDir } = greenableProject();
  const matrixPath = path.join(projectDir, "docs/specs/traceability.md");
  const matrix = fs.readFileSync(matrixPath, "utf8");
  const row = matrix.split("\n").find((l) => l.startsWith("| REQ-000"));
  assert.ok(row, "the scaffolded matrix no longer has a REQ-000 row");

  const extra = ["001", "002"].map((n) =>
    row
      .replace("REQ-000", `REQ-${n}`)
      .replace("SCN-000", `SCN-${n}`)
      .replace("features/core/health.feature", `features/core/f${n}.feature`)
  );
  fs.writeFileSync(matrixPath, matrix.replace(row, [row, ...extra].join("\n")), "utf8");
  for (const n of ["001", "002"]) {
    // Retag the copy. The scaffolded feature carries `@REQ-000 @SCN-000` (F4),
    // and a copy that kept them would declare it is REQ-000's scenario while
    // the matrix row says otherwise — which `validate` now catches, correctly.
    const source = fs.readFileSync(path.join(projectDir, "features/core/health.feature"), "utf8");
    fs.writeFileSync(
      path.join(projectDir, `features/core/f${n}.feature`),
      source.replace("@REQ-000 @SCN-000", `@REQ-${n} @SCN-${n}`),
      "utf8"
    );
  }
  const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "three");
  return { parent, projectDir };
}

function runAll(projectDir, agent, extra = []) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      projectDir,
      "--agent",
      agent,
      "--max-attempts",
      "1",
      ...extra,
    ],
    { encoding: "utf8" }
  );
}

test("without a ceiling every requirement runs — the baseline the rest is measured against", () => {
  const { parent, projectDir } = threeRequirementProject();
  try {
    const r = runAll(projectDir, minimalAgent(parent));
    assert.match(r.stdout + r.stderr, /3 passed/, r.stdout + r.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--max-requirements stops the run inside a single level, not only between levels", () => {
  // The defect this test exists for: independent requirements all land in one
  // level, which is the common case. A ceiling checked only between levels let
  // all three run past `--max-requirements 2`. Measured before it was fixed.
  const { parent, projectDir } = threeRequirementProject();
  try {
    const r = runAll(projectDir, minimalAgent(parent), ["--max-requirements", "2"]);
    const out = r.stdout + r.stderr;
    assert.match(out, /2 passed/, out);
    assert.match(out, /1 skipped/, out);
    assert.match(out, /--max-requirements 2 reached/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the same ceiling holds when the level runs in parallel", () => {
  // The worker path dispatches its own requirements, so it asks the same
  // question before starting each one.
  const { parent, projectDir } = threeRequirementProject();
  try {
    const r = runAll(projectDir, minimalAgent(parent), [
      "--max-requirements",
      "2",
      "--concurrency",
      "3",
    ]);
    const out = r.stdout + r.stderr;
    assert.match(out, /2 passed/, out);
    assert.match(out, /1 skipped/, out);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--budget-seconds stops the run and still writes the ledger", () => {
  const { parent, projectDir } = threeRequirementProject();
  try {
    // Writes, then sleeps: what is under test is the ceiling, not an empty
    // attempt, and the harness now refuses one (H19).
    const slow = scriptedAgent(
      parent,
      [["src/harness-fixture.ts", "export const writtenByTheFixtureAgent = true;\n"]],
      { sleepMs: 3000 }
    );
    const r = runAll(projectDir, slow, ["--budget-seconds", "2"]);
    const out = r.stdout + r.stderr;
    assert.match(out, /1 passed/, out);
    assert.match(out, /2 skipped/, out);
    assert.match(out, /--budget-seconds 2 exhausted/);

    // A run that dies halfway never writes a record, so `harness report`
    // cannot say what the money bought. Stopping is not dying.
    // `.json` only — the directory also carries the `.gitignore` the ledger
    // writes so run records stay local to the machine.
    const runsDir = path.join(projectDir, ".harness", "runs");
    const runs = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json"));
    assert.equal(runs.length, 1, "the ledger must survive a budget stop");
    const record = JSON.parse(fs.readFileSync(path.join(runsDir, runs[0]), "utf8"));
    assert.equal(record.bounded, true, "the record should say the run had a ceiling");
    assert.equal(record.results.length, 3, "every requirement is accounted for, run or not");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a ceiling of zero or less is refused rather than read as 'no limit'", () => {
  // `--max-requirements 0` meaning "unlimited" would be a quiet way to remove
  // the ceiling somebody thought they had set.
  assert.throws(() => parseArgs(["--max-requirements", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--budget-seconds", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--budget-seconds", "-5"]), /positive integer/);
});

test("a repository with no git identity is refused before the agent runs", () => {
  // Found by CI, which has no global git identity. The harness commits on every
  // requirement it lands, so without one it failed at the commit step — after
  // the agent had run and the gate had passed. A whole attempt, agent time
  // included, thrown away by a one-line config.
  const { parent, projectDir } = greenableProject();
  try {
    const git = (...args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    git("config", "--unset", "user.email");
    git("config", "--unset", "user.name");

    const marker = path.join(parent, "agent-ran.txt");
    const agent = `${process.execPath} -e "require('fs').writeFileSync(${JSON.stringify(marker)},'ran')"`;
    const r = spawnSync(
      process.execPath,
      [CLI, "harness", "run", "--project-dir", projectDir, "--agent", `${agent} {prompt_file}`],
      {
        encoding: "utf8",
        // Neutralise this machine's global identity — CI has none, and without
        // this the test would pass everywhere except the place that found it.
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
      }
    );

    const out = r.stdout + r.stderr;
    assert.match(out, /git has no user\.name and user\.email configured/, out);
    assert.match(out, /git config user\.name/, "a refusal without the fix just stops you");
    assert.equal(
      fs.existsSync(marker),
      false,
      "the agent ran before the harness noticed it could not commit"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── --verbose (#34) ──────────────────────────────────────────────────────────

test("--verbose streams the gate command while it runs", () => {
  // Without it the gate's output only exists once the gate has failed, so a run
  // that takes minutes shows nothing and a hung test looks like a working one.
  //
  // Two fresh projects, not one run twice: after the first run the requirement
  // is done and the gate never executes again, so a second run would prove
  // nothing either way.
  const quiet = greenableProject();
  const loud = greenableProject();
  try {
    // An explicit gate command, because the scaffold ships without one and the
    // branch that streams is the one that runs it.
    const gate = ["--test-cmd", "echo GATE-IS-RUNNING"];
    const a = runHarness(quiet.projectDir, minimalAgent(quiet.parent), gate);
    const b = runHarness(loud.projectDir, minimalAgent(loud.parent), [...gate, "--verbose"]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.equal(b.status, 0, b.stdout + b.stderr);

    // On a *green* run, which is the whole point: a passing gate used to print
    // nothing at all.
    assert.match(b.stderr, /GATE-IS-RUNNING/, `nothing streamed:\n${b.stderr}`);
    assert.doesNotMatch(
      a.stdout + a.stderr,
      /GATE-IS-RUNNING/,
      "a green gate must stay quiet without the flag"
    );
  } finally {
    fs.rmSync(quiet.parent, { recursive: true, force: true });
    fs.rmSync(loud.parent, { recursive: true, force: true });
  }
});

test("--verbose keeps stdout clean for --format json", () => {
  // H18 was prose and JSON sharing a stream. Streaming the gate to stdout would
  // reintroduce it on the one flag whose job is to print more.
  const { parent, projectDir } = greenableProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent), [
      "--test-cmd",
      "echo GATE-IS-RUNNING",
      "--verbose",
      "--format",
      "json",
    ]);
    const doc = JSON.parse(r.stdout);
    assert.ok(doc.results, `stdout was not one JSON document:\n${r.stdout.slice(0, 400)}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--verbose is listed in the help", () => {
  const r = spawnSync(process.execPath, [CLI, "harness", "run", "--help"], { encoding: "utf8" });
  assert.match(r.stdout + r.stderr, /--verbose\b/);
});

// ── Precedents in the prompt (#106 / D2) ─────────────────────────────────────

/** A project whose matrix already has one Verified requirement to point at. */
function projectWithAPrecedent(context = "Billing") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-precedent-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });

  fs.writeFileSync(path.join(dir, "src", "Ledger.java"), "class Ledger { /* impl */ }\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "test", "LedgerTest.java"),
    "class LedgerTest { /* the house style */ }\n",
    "utf8"
  );

  const header =
    "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | " +
    "Aggregate | Event | Technical artifact | Test artifact | Status |";
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [
      "# Traceability Matrix",
      "",
      header,
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| REQ-000 | SCN-000 | `features/a.feature` | - | - | - | - | `src/Ledger.java` | `test/LedgerTest.java` | Verified |",
      "| REQ-001 | SCN-001 | `features/b.feature` | - | - | - | - | TBD | TBD | Draft |",
      "",
      `<!-- csda:trace REQ-000 context=${context} -->`,
      "<!-- csda:trace REQ-001 context=Billing -->",
      "",
    ].join("\n"),
    "utf8"
  );
  return dir;
}

test("the prompt carries no precedent unless the project asks for one", () => {
  // Off by default: it costs prompt budget, and on a project with nothing
  // Verified there is nothing to show.
  const dir = projectWithAPrecedent();
  try {
    assert.doesNotMatch(buildPrompt(sampleReq, dir), /Precedent/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("with precedents on, the prompt shows an accepted requirement and its code", () => {
  const dir = projectWithAPrecedent();
  try {
    const prompt = buildPrompt(sampleReq, dir, { withPrecedents: true });
    assert.match(prompt, /Precedent — an accepted requirement nearby/);
    assert.match(prompt, /REQ-000 was accepted in this same bounded context/);
    assert.match(prompt, /the house style/, "the test excerpt is missing");
    assert.match(prompt, /class Ledger \{/, "the implementation excerpt is missing");
    // The agent must not read an example as a specification.
    assert.match(prompt, /example of \*shape\*, not of behaviour/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a precedent from another bounded context is not offered", () => {
  const dir = projectWithAPrecedent("Shipping");
  try {
    assert.doesNotMatch(buildPrompt(sampleReq, dir, { withPrecedents: true }), /Precedent/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing artifact file does not stop the prompt being built", () => {
  // The section is optional by design; a moved file must not take a run down.
  const dir = projectWithAPrecedent();
  fs.rmSync(path.join(dir, "src", "Ledger.java"));
  fs.rmSync(path.join(dir, "test", "LedgerTest.java"));
  try {
    const prompt = buildPrompt(sampleReq, dir, { withPrecedents: true });
    assert.match(prompt, /# Implement REQ-001/);
    assert.doesNotMatch(prompt, /Precedent/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("prompt_precedents is read from harness.config.yaml", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-cfg-"));
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      "agent: echo\nprompt_precedents: 1\n",
      "utf8"
    );
    const config = readHarnessConfig(dir);
    assert.equal(config.promptPrecedents, true);

    fs.writeFileSync(path.join(dir, "harness.config.yaml"), "agent: echo\n", "utf8");
    assert.equal(readHarnessConfig(dir).promptPrecedents, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Adversarial verification (#107 / D3) ─────────────────────────────────────

/** Commit whatever a test just wrote: the harness refuses a dirty tree. */
function commitAll(projectDir: string) {
  spawnSync("git", ["add", "-A"], { cwd: projectDir, encoding: "utf8" });
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "test setup"], {
    cwd: projectDir,
    encoding: "utf8",
  });
}

test("adversary_profile resolves to its profile's agent", () => {
  const dir = projectWithProfiles(
    "agent: echo\nadversary_profile: breaker\n",
    'profiles_version: 1\nprofiles:\n  breaker:\n    advisory: true\n    agent: "break {prompt_file}"\n'
  );
  try {
    const config = readHarnessConfig(dir);
    assert.equal(config.adversaryProfile, "breaker");
    assert.equal(config.profileAgents.breaker, "break {prompt_file}");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an adversary that is not advisory is refused", () => {
  // Its writes are discarded, so a profile whose work you expect to be kept is
  // not an adversary — and finding that out from a missing commit would be a
  // long afternoon.
  const dir = projectWithProfiles(
    "agent: echo\nadversary_profile: breaker\n",
    'profiles_version: 1\nprofiles:\n  breaker:\n    agent: "break {prompt_file}"\n'
  );
  try {
    assert.throws(() => readHarnessConfig(dir), /does not declare `advisory: true`/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a probe that breaks the tests warns and still passes the requirement", () => {
  // The line the issue draws: the gate is the only judge. An adversary can
  // always assert something the requirement never promised, so a failing probe
  // must not be able to fail correct work.
  const { parent, projectDir } = greenableProject();
  try {
    // Writes a test that fails, which is exactly what an adversary that found
    // something would do.
    const breaker = scriptedAgent(parent, [["probe-fails.txt", "the adversary wrote this\n"]]);
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      // The agent comes from `--agent`; keeping a quoted command out of the
      // YAML avoids fighting the parser for no benefit. The gate passes before
      // the probe and fails once the probe's file exists.
      "adversary_profile: breaker\ntest_cmd: test ! -f probe-fails.txt\n",
      "utf8"
    );
    fs.mkdirSync(path.join(projectDir, ".harness"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".harness", "profiles.yaml"),
      `profiles_version: 1\nprofiles:\n  breaker:\n    advisory: true\n    agent: ${breaker}\n`,
      "utf8"
    );
    // The harness refuses to start on a dirty tree, and the fixture already
    // committed — so the configuration has to be committed too.
    commitAll(projectDir);

    const r = runHarness(projectDir, minimalAgent(parent));
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /1 passed/, `the probe must not change the verdict:\n${out}`);
    assert.match(out, /adversarial_probe_failed/, `no finding was reported:\n${out}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the probe's writes never reach the branch", () => {
  // The branch must carry the implementer's work alone, or a reviewer cannot
  // tell who wrote what.
  const { parent, projectDir } = greenableProject();
  try {
    const breaker = scriptedAgent(parent, [["adversary-artifact.txt", "should not survive\n"]]);
    const implementer = scriptedAgent(parent, [
      ["src/harness-fixture.ts", "export const writtenByTheImplementer = true;\n"],
    ]);
    fs.writeFileSync(
      path.join(projectDir, "harness.config.yaml"),
      "agent: " + JSON.stringify(minimalAgent(parent)) + "\nadversary_profile: breaker\n",
      "utf8"
    );
    fs.mkdirSync(path.join(projectDir, ".harness"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".harness", "profiles.yaml"),
      `profiles_version: 1\nprofiles:\n  breaker:\n    advisory: true\n    agent: ${breaker}\n`,
      "utf8"
    );
    // The harness refuses to start on a dirty tree, and the fixture already
    // committed — so the configuration has to be committed too.
    commitAll(projectDir);

    const r = runHarness(projectDir, implementer);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const tree = spawnSync("git", ["ls-tree", "-r", "--name-only", "harness/REQ-000"], {
      cwd: projectDir,
      encoding: "utf8",
    });
    assert.doesNotMatch(
      tree.stdout,
      /adversary-artifact\.txt/,
      "the adversary's file was committed"
    );
    // The half of this that actually bit: running the probe before the commit
    // meant `git status` showed the implementer's uncommitted work, so
    // discarding "what the probe wrote" threw the implementation away and the
    // run still reported a pass — a green verdict over an empty branch, which
    // is the H19 family exactly.
    assert.match(
      tree.stdout,
      /harness-fixture/,
      "the implementer's work was discarded with the probe's"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("no adversary_profile means no probe at all", () => {
  const { parent, projectDir } = greenableProject();
  try {
    const r = runHarness(projectDir, minimalAgent(parent));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /probing with/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── #50: an attempt that cannot change the outcome is not repeated ───────────

test("#50: an agent out of quota fails the requirement after one attempt, not three", () => {
  // reservas_app: "You've hit your session limit · resets 11:20am", retried
  // three times in 22 seconds.
  const { parent, projectDir } = greenableProject();
  try {
    const agent = `${process.execPath} -e "console.log('You\\'ve hit your session limit · resets 11:20am'); process.exit(1)"`;
    const r = spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        projectDir,
        "--agent",
        `${agent} {prompt_file}`,
        "--max-attempts",
        "3",
        "--format",
        "json",
      ],
      { encoding: "utf8" }
    );
    const out = r.stdout + r.stderr;
    assert.match(out, /cannot run now/, out);
    assert.doesNotMatch(out, /attempt 2\/3/, "a second attempt meets the same quota");
    const report = JSON.parse(r.stdout);
    assert.equal(report.results[0].result, "fail");
    assert.equal(report.results[0].attempts, 1);
    assert.equal(report.results[0].attemptLog[0].endedAt, "agent-unavailable");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
