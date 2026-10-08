"use strict";

/**
 * `specgate verify` over OpenSpec (ADR-0030). The fixture follows OpenSpec's
 * own layout and headings, as its repository uses them (October 2026).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { readOpenSpec } = require("../../packages/core/src/domain/OpenSpecReader");
const { verifyClaims } = require("../../packages/core/src/domain/VerifyClaims");
const { namesId, slug } = require("../../packages/core/src/domain/ForeignSpec");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const cli = (cwd, ...args) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

const MAIN = `# auth Specification

## Purpose
Sign-in for field crews.

## Requirements
### Requirement: Sign in with a crew code
The system SHALL sign a worker in with their crew code.

#### Scenario: Valid code
- **WHEN** a worker enters a valid crew code
- **THEN** they are signed in

#### Scenario: Unknown code
- **WHEN** a worker enters an unknown code
- **THEN** sign-in is refused

### Requirement: Sign out
The system SHALL sign a worker out.

#### Scenario: Sign out clears the session
- **WHEN** a signed-in worker signs out
- **THEN** the session is gone
`;

const DELTA = `## ADDED Requirements
### Requirement: Sign in with a crew code
The system SHALL sign a worker in with their crew code.

#### Scenario: Valid code
- **WHEN** a worker enters a valid crew code
- **THEN** they are signed in
`;

const files = (extra = []) => [
  { path: "openspec/specs/auth/spec.md", source: MAIN },
  {
    path: "openspec/changes/archive/2026-10-01-add-crew-sign-in/specs/auth/spec.md",
    source: DELTA,
  },
  {
    path: "openspec/changes/archive/2026-10-01-add-crew-sign-in/tasks.md",
    source: "- [x] 1.1 Sign-in\n",
  },
  ...extra,
];

const VALID = "openspec:auth/sign-in-with-a-crew-code/valid-code";
const UNKNOWN = "openspec:auth/sign-in-with-a-crew-code/unknown-code";

test("ids are built from OpenSpec's names", () => {
  assert.equal(slug("Sign in with a crew code"), "sign-in-with-a-crew-code");
  const spec = readOpenSpec(files());
  assert.deepEqual(
    spec.requirements.flatMap((r) => r.criteria.map((c) => c.id)),
    [VALID, UNKNOWN, "openspec:auth/sign-out/sign-out-clears-the-session"]
  );
  assert.deepEqual(spec.problems, []);
});

test("an archived change claims the current scenarios of what it added", () => {
  const spec = readOpenSpec(files());
  assert.equal(spec.claims.length, 1);
  assert.equal(spec.claims[0].finished, true);
  // The delta named one scenario; the spec now holds two — both are owed.
  assert.deepEqual([...spec.claims[0].criteria].sort(), [UNKNOWN, VALID]);
});

test("a claim with no test naming each criterion fails; naming them passes", () => {
  const spec = readOpenSpec(files());
  const none = verifyClaims({ spec, tests: [] });
  assert.deepEqual(
    none.status
      .filter((d) => d.severity === "error")
      .map((d) => d.target)
      .sort(),
    [UNKNOWN, VALID]
  );

  const tests = [{ path: "test/auth.test.ts", source: `// ${VALID}\n// ${UNKNOWN}\n` }];
  const ok = verifyClaims({ spec, tests });
  assert.equal(ok.status.filter((d) => d.severity === "error").length, 0);
  assert.deepEqual([...ok.proved].sort(), [UNKNOWN, VALID]);
});

test("an id is matched whole, not as a prefix of a longer one", () => {
  assert.equal(namesId(`see ${VALID}.`, VALID), true);
  assert.equal(namesId(`see ${VALID}-2`, VALID), false);
  assert.equal(namesId(`${VALID}/more`, VALID), false);
  assert.equal(namesId("speckit:f/US1.2", "speckit:f/US1"), false);
  assert.equal(namesId("(speckit:f/US1.2)", "speckit:f/US1.2"), true);
});

test("an active change with every task ticked is reported, never gated", () => {
  const spec = readOpenSpec(
    files([
      {
        path: "openspec/changes/add-sign-out/specs/auth/spec.md",
        source:
          "## MODIFIED Requirements\n### Requirement: Sign out\nText.\n\n#### Scenario: Sign out clears the session\n- **WHEN** x\n- **THEN** y\n",
      },
      {
        path: "openspec/changes/add-sign-out/tasks.md",
        source: "- [x] 1.1 Do it\n- [x] 1.2 Test it\n",
      },
    ])
  );
  const active = spec.claims.find((c) => c.label.includes("add-sign-out"));
  assert.equal(active.finished, false);
  const r = verifyClaims({ spec, tests: [{ path: "t.test.ts", source: `${VALID} ${UNKNOWN}` }] });
  const about = r.status.filter(
    (d) => d.target === "openspec:auth/sign-out/sign-out-clears-the-session"
  );
  assert.equal(about.length, 1);
  assert.equal(about[0].severity, "info");
});

test("a change with unticked tasks claims nothing", () => {
  const spec = readOpenSpec(
    files([
      { path: "openspec/changes/wip/specs/auth/spec.md", source: DELTA },
      { path: "openspec/changes/wip/tasks.md", source: "- [x] 1.1 a\n- [ ] 1.2 b\n" },
    ])
  );
  assert.equal(
    spec.claims.some((c) => c.label.includes("wip")),
    false
  );
});

test("a current spec that does not read as OpenSpec is an error, never zero criteria", () => {
  const spec = readOpenSpec([
    { path: "openspec/specs/billing/spec.md", source: "# Billing\n\nSome prose.\n" },
  ]);
  assert.equal(spec.problems.length, 1);
  const r = verifyClaims({ spec, tests: [] });
  assert.ok(r.status.some((d) => d.code === "V5_unreadable" && d.severity === "error"));
});

test("archived history older than OpenSpec's structured format is not an error", () => {
  const spec = readOpenSpec(
    files([
      {
        path: "openspec/changes/archive/2025-01-11-old/specs/cli/spec.md",
        source:
          "# Update Command Specification\n\n## Core Requirements\n\n### Update Behavior\nProse.\n",
      },
    ])
  );
  assert.deepEqual(spec.problems, []);
});

test("a pre-delta archived spec claims all its requirements", () => {
  const spec = readOpenSpec([
    { path: "openspec/specs/auth/spec.md", source: MAIN },
    { path: "openspec/changes/archive/2025-07-01-first/specs/auth/spec.md", source: MAIN },
  ]);
  assert.equal(spec.claims[0].criteria.length, 3);
});

test("a requirement the spec no longer has is a warning, not an error", () => {
  const spec = readOpenSpec([
    { path: "openspec/specs/auth/spec.md", source: MAIN },
    {
      path: "openspec/changes/archive/2026-01-01-old/specs/auth/spec.md",
      source:
        "## ADDED Requirements\n### Requirement: Remember me\nText.\n#### Scenario: S\n- **WHEN** a\n- **THEN** b\n",
    },
  ]);
  const r = verifyClaims({ spec, tests: [] });
  const v4 = r.status.filter((d) => d.code === "V4_unknown_reference");
  assert.equal(v4.length, 1);
  assert.equal(v4[0].severity, "warning");
});

test("a test naming an id the spec does not have is reported", () => {
  const spec = readOpenSpec(files());
  const r = verifyClaims({
    spec,
    tests: [{ path: "t.test.ts", source: `${VALID} ${UNKNOWN} openspec:auth/renamed/gone` }],
  });
  assert.ok(r.status.some((d) => d.code === "V6_orphan_name" && d.severity === "warning"));
});

// ── The command, on a git repository ─────────────────────────────────────────

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-verify-"));
  const git = (...a) => {
    const r = spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  git("init", "--quiet", "--initial-branch=main");
  for (const [k, v] of [
    ["user.email", "t@example.com"],
    ["user.name", "T"],
    ["commit.gpgsign", "false"],
  ])
    git("config", k, v);
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  return { dir, git, write };
}

test("verify: a red check, then green once tests name the criteria; --record pins the text", () => {
  const { dir, git, write } = project();
  try {
    for (const f of files()) write(f.path, f.source);
    git("add", ".");
    git("commit", "--quiet", "-m", "spec");

    const red = cli(dir, "verify", "--json");
    assert.equal(red.status, 1);
    const doc = JSON.parse(red.stdout);
    assert.equal(doc.verify.claims[0].gated, true);

    write("test/auth.test.js", `// ${VALID}\n// ${UNKNOWN}\n`);
    const green = cli(dir, "verify", "--record");
    assert.equal(green.status, 0, green.stdout + green.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".specgate", "verify.lock")));

    // The criterion changes after it was verified: its test proves the old text.
    write(
      "openspec/specs/auth/spec.md",
      MAIN.replace("sign-in is refused", "sign-in is refused and logged")
    );
    const changed = cli(dir, "verify", "--json");
    assert.equal(changed.status, 1);
    assert.ok(
      JSON.parse(changed.stdout).status.some(
        (d) => d.code === "V3_criterion_changed" && d.target === UNKNOWN
      )
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verify --since gates only claims made after the ref", () => {
  const { dir, git, write } = project();
  try {
    for (const f of files()) write(f.path, f.source);
    git("add", ".");
    git("commit", "--quiet", "-m", "old work, never tested");
    git("tag", "adopted");

    assert.equal(
      cli(dir, "verify", "--since", "adopted").status,
      0,
      "old claims are reported, not gated"
    );

    write(
      "openspec/specs/auth/spec.md",
      `${MAIN}\n### Requirement: Badge\nText.\n\n#### Scenario: Badge shows the name\n- **WHEN** a\n- **THEN** b\n`
    );
    write(
      "openspec/changes/archive/2026-10-08-add-badge/specs/auth/spec.md",
      "## ADDED Requirements\n### Requirement: Badge\nText.\n\n#### Scenario: Badge shows the name\n- **WHEN** a\n- **THEN** b\n"
    );
    git("add", ".");
    git("commit", "--quiet", "-m", "new claim");
    const r = cli(dir, "verify", "--since", "adopted", "--json");
    assert.equal(r.status, 1);
    const errors = JSON.parse(r.stdout).status.filter((d) => d.severity === "error");
    assert.deepEqual(
      errors.map((d) => d.target),
      ["openspec:auth/badge/badge-shows-the-name"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verify --run fails on a red suite; --format github annotates the spec line", () => {
  const { dir, git, write } = project();
  try {
    for (const f of files()) write(f.path, f.source);
    write("test/auth.test.js", `// ${VALID}\n`);
    git("add", ".");
    git("commit", "--quiet", "-m", "x");
    const gh = cli(dir, "verify", "--format", "github");
    assert.equal(gh.status, 1);
    assert.match(
      gh.stdout,
      /::error file=openspec\/changes\/archive\/2026-10-01-add-crew-sign-in\/specs\/auth\/spec\.md,line=2,title=V1_unproved_claim::/
    );

    write("test/auth.test.js", `// ${VALID}\n// ${UNKNOWN}\n`);
    const red = cli(dir, "verify", "--run", "--test-cmd", 'node -e "process.exit(3)"', "--json");
    assert.equal(red.status, 1);
    assert.ok(JSON.parse(red.stdout).status.some((d) => d.code === "V2_failing_suite"));
    assert.equal(cli(dir, "verify", "--run", "--test-cmd", 'node -e "process.exit(0)"').status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verify --ids prints every criterion id to name in a test", () => {
  const { dir, write } = project();
  try {
    for (const f of files()) write(f.path, f.source);
    const r = cli(dir, "verify", "--ids");
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp(VALID.replace(/[/.]/g, "\\$&")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a nested capability is read, not skipped", () => {
  // OpenSpec 1.14 writes `specs/time-attendance/clock-punches/spec.md`; the
  // first reader took one path segment and silently found nothing there.
  const spec = readOpenSpec([
    { path: "openspec/specs/time-attendance/clock-punches/spec.md", source: MAIN },
    {
      path: "openspec/changes/archive/2026-10-08-x/specs/time-attendance/clock-punches/spec.md",
      source: DELTA,
    },
  ]);
  assert.equal(spec.requirements.length, 2);
  assert.ok(
    spec.claims[0].criteria.includes(
      "openspec:time-attendance/clock-punches/sign-in-with-a-crew-code/valid-code"
    )
  );
});
