"use strict";

/**
 * F1B — SpecOps × the change lifecycle.
 *
 *   validate --against-lock   the drift gate, in requirements not files
 *   specops contribute        the loop back to the pack
 *   pack-shipped changes      a pack proposing, never applying
 *   diff --as-change          end to end against a real git pack repo
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { checkPackAgainstProject } = require("../../scripts/specops/against_lock");
const { deltaToPackFragment, stageContribution } = require("../../scripts/specops/contribute");
const { depositPackChanges } = require("../../packages/core/src/infrastructure/PackChangeDeposit");
const { parseDelta } = require("../../packages/core/src/domain/SpecParser");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

const cleanup = (...dirs) =>
  dirs.forEach((d) => d && fs.rmSync(d, { recursive: true, force: true }));

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr || r.stdout}`);
  return r.stdout;
}

const GIT_AVAILABLE = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

// ── validate --against-lock ───────────────────────────────────────────────────

const PACK_MODEL = {
  requirements: [
    { id: "REQ-001", title: "Alert at threshold" },
    { id: "REQ-002", title: "Register entry" },
  ],
  scenarios: [
    {
      id: "SCN-001",
      requirement_id: "REQ-001",
      target: "features/capacity/threshold.feature",
    },
  ],
};

const ENTRY = { pack_id: "parking/backend", version: "v0.1.0", repo: "https://x/y.git" };

const row = (over) => ({
  requirement: "REQ-001",
  scenarioId: "SCN-001",
  featureFile: "`features/capacity/threshold.feature`",
  useCase: "-",
  commandOrQuery: "-",
  aggregate: "-",
  event: "-",
  technicalArtifact: "-",
  testArtifact: "TBD",
  status: "Draft",
  ...over,
});

test("a project honouring the pack reports no drift", () => {
  const diags = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({}),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
  ]);
  assert.deepEqual(
    diags.filter((d) => d.severity === "error"),
    []
  );
});

test("a pack requirement absent from the matrix is drift, with a fix", () => {
  const diags = checkPackAgainstProject(PACK_MODEL, ENTRY, [row({})]);
  const d = diags.find((x) => x.code === "pack_requirement_missing");
  assert.ok(d);
  assert.equal(d.target, "REQ-002");
  assert.match(d.fix, /specops sync/);
});

test("a requirement pointing at a different scenario is drift", () => {
  const diags = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({ scenarioId: "SCN-999" }),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
  ]);
  const d = diags.find((x) => x.code === "pack_requirement_drifted");
  assert.ok(d);
  assert.match(d.message, /SCN-999/);
  assert.match(d.fix, /--as-change/);
});

test("a requirement pointing at a different feature file is drift", () => {
  const diags = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({ featureFile: "`features/other/thing.feature`" }),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
  ]);
  assert.ok(diags.some((d) => d.code === "pack_requirement_drifted" && /feature/.test(d.message)));
});

test("backticks in the matrix do not read as drift", () => {
  const withBackticks = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({ featureFile: "`features/capacity/threshold.feature`" }),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
  ]);
  const without = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({ featureFile: "features/capacity/threshold.feature" }),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
  ]);
  assert.deepEqual(
    withBackticks.filter((d) => d.severity === "error"),
    []
  );
  assert.deepEqual(
    without.filter((d) => d.severity === "error"),
    []
  );
});

test("local requirements are reported as info, never as drift", () => {
  const diags = checkPackAgainstProject(PACK_MODEL, ENTRY, [
    row({}),
    row({ requirement: "REQ-002", scenarioId: "-", featureFile: "-" }),
    row({ requirement: "REQ-050", scenarioId: "SCN-050", featureFile: "-" }),
  ]);
  assert.deepEqual(
    diags.filter((d) => d.severity === "error"),
    []
  );
  const local = diags.find((d) => d.code === "local_requirements");
  assert.ok(local);
  assert.equal(local.severity, "info");
  assert.match(local.target, /REQ-050/);
});

// ── specops contribute ────────────────────────────────────────────────────────

const LOCAL_DELTA = `## ADDED Requirements

### Requirement: REQ-050 — Nightly settlement report

El sistema SHALL emitir un informe de liquidación cada noche.

#### Scenario: SCN-050a — Informe nocturno

- GIVEN sesiones cerradas durante el día
- WHEN llega la medianoche
- THEN se emite el informe

<!-- specgate:trace uc=UC-020 cmd=EmitSettlementCommand agg=Billing evt=SettlementEmitted feature=features/billing/settlement.feature -->
`;

test("a delta becomes a pack fragment carrying the DDD coordinates", () => {
  const fragment = deltaToPackFragment(parseDelta(LOCAL_DELTA), { changeId: "add-settlement" });
  assert.match(fragment, /requirements:/);
  assert.match(fragment, /- id: REQ-050/);
  assert.match(fragment, /title: "Nightly settlement report"/);
  assert.match(fragment, /scenarios:/);
  assert.match(fragment, /requirement_id: REQ-050/);
  assert.match(fragment, /use_case: UC-020/);
  assert.match(fragment, /command: EmitSettlementCommand/);
  assert.match(fragment, /aggregate: Billing/);
  assert.match(fragment, /- SettlementEmitted/);
  assert.match(fragment, /target: "features\/billing\/settlement\.feature"/);
});

test("a modified requirement is flagged for the maintainer to reconcile", () => {
  const fragment = deltaToPackFragment(
    parseDelta(LOCAL_DELTA.replace("## ADDED", "## MODIFIED")),
    {}
  );
  assert.match(fragment, /MODIFIED upstream — reconcile/);
});

test("a locally removed requirement is a comment, never a deletion", () => {
  const fragment = deltaToPackFragment(
    parseDelta(
      `## REMOVED Requirements\n\n### Requirement: REQ-003 — Obsoleto\n\n(ya no aplica)\n`
    ),
    {}
  );
  assert.match(fragment, /# REMOVED locally: REQ-003/);
  assert.doesNotMatch(fragment, /^requirements:/m);
});

test("a delta with nothing in it produces no fragment", () => {
  assert.equal(deltaToPackFragment({ added: [], modified: [], removed: [] }), null);
});

test(
  "contribute stages a branch in a clone and pushes nothing",
  { skip: !GIT_AVAILABLE && "git not available" },
  () => {
    const upstream = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-upstream-"));
    let clone;
    try {
      git(["init", "-q", "--bare", "."], upstream);

      // Seed the bare repo with one commit through a scratch working copy.
      const seed = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-seed-"));
      git(["clone", "-q", upstream, seed], undefined);
      fs.writeFileSync(path.join(seed, "pack.yaml"), 'schema_version: "1.1.0"\n', "utf8");
      git(["add", "-A"], seed);
      git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "seed"], seed);
      git(["push", "-q", "origin", "HEAD:refs/heads/main"], seed);
      cleanup(seed);

      const staged = stageContribution(upstream, "main", "contribute/add-settlement", [
        {
          file: "contributions/add-settlement/fragment.yaml",
          contents: "requirements: []\n",
          message: "m",
        },
        { file: "contributions/add-settlement/README.md", contents: "# c\n" },
      ]);
      clone = staged.dir;

      assert.equal(staged.branch, "contribute/add-settlement");
      assert.equal(
        fs.existsSync(path.join(clone, "contributions/add-settlement/fragment.yaml")),
        true
      );
      // The commit exists locally...
      assert.match(git(["log", "--oneline", "-1"], clone), /Contribute|m/);
      // ...and nothing reached the upstream repository.
      const remoteBranches = git(["branch", "-a"], upstream);
      assert.doesNotMatch(remoteBranches, /contribute\/add-settlement/);
    } finally {
      cleanup(upstream, clone);
    }
  }
);

// ── packs that ship changes ───────────────────────────────────────────────────

function mkPackWithChanges(root, packId) {
  const base = path.join(root, packId, "changes");
  const write = (rel, contents) => {
    const full = path.join(base, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, "utf8");
  };
  write("adopt-pricing/proposal.md", "# Proposal: adopt pricing\n");
  write("adopt-pricing/tasks.md", "# Tasks\n\n- [ ] 1.1\n");
  write("adopt-pricing/specs/pricing/spec.md", "## ADDED Requirements\n");
  write("archive/2026-01-01-old/proposal.md", "# old\n");
  return root;
}

test("a pack's changes land as proposals, and its archive never does", () => {
  const packRoot = mkPackWithChanges(
    fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pk-")),
    "p/backend"
  );
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pj-"));
  try {
    const { deposited, skipped } = depositPackChanges(project, packRoot, "p/backend");
    assert.deepEqual(deposited, ["adopt-pricing"]);
    assert.deepEqual(skipped, []);
    assert.equal(
      fs.existsSync(path.join(project, "docs/specs/changes/adopt-pricing/proposal.md")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(project, "docs/specs/changes/adopt-pricing/specs/pricing/spec.md")),
      true
    );
    // The pack's own history is not the project's business.
    assert.equal(fs.existsSync(path.join(project, "docs/specs/changes/archive")), false);
  } finally {
    cleanup(packRoot, project);
  }
});

test("a pack never overwrites a local change with the same id", () => {
  const packRoot = mkPackWithChanges(
    fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pk-")),
    "p/backend"
  );
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pj-"));
  try {
    const mine = path.join(project, "docs/specs/changes/adopt-pricing");
    fs.mkdirSync(mine, { recursive: true });
    fs.writeFileSync(path.join(mine, "proposal.md"), "# MINE, in flight\n", "utf8");

    const { deposited, skipped } = depositPackChanges(project, packRoot, "p/backend");
    assert.deepEqual(deposited, []);
    assert.deepEqual(skipped, ["adopt-pricing"]);
    assert.equal(fs.readFileSync(path.join(mine, "proposal.md"), "utf8"), "# MINE, in flight\n");
  } finally {
    cleanup(packRoot, project);
  }
});

test("dryRun deposits nothing", () => {
  const packRoot = mkPackWithChanges(
    fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pk-")),
    "p/backend"
  );
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pj-"));
  try {
    const { deposited } = depositPackChanges(project, packRoot, "p/backend", { dryRun: true });
    assert.deepEqual(deposited, ["adopt-pricing"]);
    assert.equal(fs.existsSync(path.join(project, "docs")), false);
  } finally {
    cleanup(packRoot, project);
  }
});

// ── diff --as-change, end to end against a real git repo ──────────────────────

const PACK_V1 = `schema_version: "1.1.0"

metadata:
  name: "Demo Backend Domain Pack"
  version: "0.1.0"
  language: "en"
  project_type: "backend"

requirements:
  - id: REQ-001
    title: "Alert operators when capacity reaches a threshold"
    priority: Must
    description: "Operators need proactive alerts."
    status: Draft

scenarios:
  - id: "SCN-001"
    requirement_id: REQ-001
    use_case: UC-001
    target: "features/capacity/threshold.feature"
    template: "templates/features/capacity/threshold.feature.tpl"
    feature: "Parking Capacity"
    scenario: "Alert at threshold"
    command: CheckCapacityCommand
    aggregate: ParkingFacility
    events:
      - CapacityThresholdReached
`;

const PACK_V2 = PACK_V1.replace('version: "0.1.0"', 'version: "0.2.0"').replace(
  "scenarios:",
  `  - id: REQ-002
    title: "Apply dynamic peak pricing"
    priority: Should
    description: "The system SHALL apply a 20 percent surcharge during peak hours."
    status: Draft

scenarios:`
);

const TPL = `Feature: Parking Capacity

  Scenario: Alert at threshold
    Given the facility is at 89 percent occupancy
    When another vehicle enters
    Then a CapacityThresholdReached event is emitted
`;

test(
  "diff --as-change derives a reviewable change from a real two-tag pack repo",
  { skip: !GIT_AVAILABLE && "git not available" },
  () => {
    const packRepo = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-packrepo-"));
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-project-"));
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-cache-"));
    try {
      // A pack repository with two tagged versions.
      git(["init", "-q", "."], packRepo);
      const packDir = path.join(packRepo, "demo/backend");
      fs.mkdirSync(path.join(packDir, "templates/features/capacity"), { recursive: true });
      fs.writeFileSync(path.join(packDir, "pack.yaml"), PACK_V1, "utf8");
      fs.writeFileSync(
        path.join(packDir, "templates/features/capacity/threshold.feature.tpl"),
        TPL,
        "utf8"
      );
      git(["add", "-A"], packRepo);
      git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "v0.1.0"], packRepo);
      git(["tag", "v0.1.0"], packRepo);

      fs.writeFileSync(path.join(packDir, "pack.yaml"), PACK_V2, "utf8");
      // A purely cosmetic template reformat rides along and must not show up.
      fs.writeFileSync(
        path.join(packDir, "templates/features/capacity/threshold.feature.tpl"),
        TPL.replace("\n\n", "\n\n\n"),
        "utf8"
      );
      git(["add", "-A"], packRepo);
      git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "v0.2.0"], packRepo);
      git(["tag", "v0.2.0"], packRepo);

      // A project locked to v0.1.0 of that pack.
      fs.writeFileSync(path.join(project, "spec.md"), "# Spec\n", "utf8");
      fs.writeFileSync(
        path.join(project, ".specops.lock"),
        JSON.stringify(
          {
            specops_version: 1,
            packs: [
              {
                repo: packRepo,
                version: "v0.1.0",
                commit: "0".repeat(40),
                pack_id: "demo/backend",
                expanded_at: new Date().toISOString(),
                vars: { PROJECT_NAME: "Demo" },
              },
            ],
          },
          null,
          2
        ),
        "utf8"
      );

      const result = spawnSync(
        process.execPath,
        [
          CLI_PATH,
          "specops",
          "diff",
          "--project-dir",
          project,
          "--pack-version",
          "v0.2.0",
          "--as-change",
          "--cache-dir",
          cache,
          "--format",
          "json",
        ],
        { encoding: "utf8" }
      );

      assert.equal(result.status, 0, `stderr: ${result.stderr}`);
      const doc = JSON.parse(result.stdout);
      assert.equal(doc.changes.length, 1);
      const entry = doc.changes[0];
      assert.equal(entry.change, "upgrade-backend-v0.2.0");
      assert.deepEqual(entry.summary.added, ["REQ-002"]);
      // The cosmetic template reformat must not surface as a modification.
      assert.deepEqual(entry.summary.modified, []);
      assert.deepEqual(entry.summary.removed, []);

      const changeDir = path.join(project, "docs/specs/changes/upgrade-backend-v0.2.0");
      assert.equal(fs.existsSync(path.join(changeDir, "proposal.md")), true);
      const delta = fs.readFileSync(path.join(changeDir, "specs/demo/backend/spec.md"), "utf8");
      assert.match(delta, /REQ-002 — Apply dynamic peak pricing/);
      assert.match(delta, /origin=pack:demo\/backend@v0\.2\.0/);

      // The derived change is valid input for the lifecycle it feeds.
      const validated = spawnSync(
        process.execPath,
        [
          CLI_PATH,
          "change",
          "validate",
          "upgrade-backend-v0.2.0",
          "--project-dir",
          project,
          "--json",
        ],
        { encoding: "utf8" }
      );
      const report = JSON.parse(validated.stdout);
      assert.equal(report.summary.failed, 0, `issues: ${JSON.stringify(report.items[0].issues)}`);
    } finally {
      cleanup(packRepo, project, cache);
    }
  }
);
