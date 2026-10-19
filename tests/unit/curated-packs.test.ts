"use strict";

/**
 * Guard: every pack this repository ships must be installable.
 *
 * Nothing exercised `packs/` — not CI, not a test — so all eleven curated
 * packs drifted onto a format the installer never accepted, and `pack lint`
 * said they were fine because it only checked cross-references. A pack you
 * cannot install is not a pack; it is a YAML file.
 *
 * This is the cheapest possible guard against that recurring: lint each pack
 * the way a user would, and expand it into a real scaffolded project.
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
const { loadPack } = require("../../packages/core/src/infrastructure/DiskPackRepository");
const PACKS_DIR = path.join(ROOT_DIR, "packs");

/** Variables beyond the usual three that a pack may declare. */
const EXTRA_VARS: Record<string, string[]> = {
  "sample-contracts/contracts": ["PROVIDER_SERVICE=billing", "CONSUMER_SERVICE=web"],
};

function packIds(): string[] {
  const ids: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "pack.yaml") {
        ids.push(path.relative(PACKS_DIR, path.dirname(full)).split(path.sep).join("/"));
      }
    }
  };
  walk(PACKS_DIR);
  return ids.sort();
}

const IDS = packIds();

test("the repository actually ships curated packs", () => {
  // If this ever reads zero, every test below would vacuously pass.
  assert.ok(IDS.length > 0, "no pack.yaml found under packs/");
});

for (const id of IDS) {
  test(`pack ${id} passes lint`, () => {
    const r = spawnSync(
      process.execPath,
      [CLI, "pack", "lint", "--pack-root", PACKS_DIR, "--pack", id],
      {
        encoding: "utf8",
      }
    );
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  });

  test(`pack ${id} installs into a scaffolded project`, () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-packs-"));
    try {
      const init = spawnSync(
        process.execPath,
        [CLI, "init", "--yes", "--no-sample-req", "--out", parent, "--no-git"],
        { encoding: "utf8" }
      );
      assert.equal(init.status, 0, init.stdout + init.stderr);
      const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

      const vars = ["PROJECT_NAME=Guard", "PROJECT_SLUG=guard", "DOMAIN=guard"]
        .concat(EXTRA_VARS[id] || [])
        .flatMap((v) => ["--var", v]);

      const r = spawnSync(
        process.execPath,
        [
          CLI,
          "expand",
          "--pack-root",
          PACKS_DIR,
          "--pack",
          id,
          "--project-dir",
          projectDir,
          ...vars,
        ],
        { encoding: "utf8" }
      );
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);

      // Installing is not enough: the documents have to carry what the pack
      // declared. The schema said `context` and `invariants`, the packs write
      // `bounded_context` and `responsibilities`, and the renderer read the
      // schema's names — so every curated pack installed cleanly and produced
      // `| AGG-001 | Invoice | - | - |`. H13 was not paperwork; it shipped a
      // worse product (E1).
      const { pack } = loadPack(PACKS_DIR, id);

      const aggregate = (pack.aggregates || []).find((a: any) => a.bounded_context || a.context);
      if (aggregate) {
        const rendered = fs.readFileSync(path.join(projectDir, "docs/specs/aggregates.md"), "utf8");
        const row = rendered.split("\n").find((l: string) => l.includes(`| ${aggregate.id} `));
        assert.ok(row, `no row for ${aggregate.id} in aggregates.md`);
        assert.ok(
          row.includes(aggregate.bounded_context || aggregate.context),
          `${id}: the aggregate's context is missing from the rendered row:\n  ${row}`
        );
      }

      const event = (pack.events || []).find((e: any) => e.producer || e.aggregate);
      if (event) {
        const rendered = fs.readFileSync(path.join(projectDir, "docs/specs/events.md"), "utf8");
        const row = rendered.split("\n").find((l: string) => l.includes(`| ${event.id} `));
        assert.ok(row, `no row for ${event.id} in events.md`);
        assert.ok(
          row.includes(event.producer || event.aggregate),
          `${id}: the event's producer is missing from the rendered row:\n  ${row}`
        );
      }
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
}

/**
 * An agent that writes one file, because the harness refuses an empty attempt.
 *
 * These runs used to pass `true {prompt_file}` — nothing read, nothing
 * written, exit 0. That stand-in encoded **H19**: the gate approving an agent
 * that produced no files. What is under test here is branch stacking and
 * profile selection, not the agent, so the cheapest honest agent is one that
 * leaves a single file behind.
 */
let writingAgentSeq = 0;
function writingAgent(projectDir: string): string {
  // Beside the project, never inside it: a stray file in the working tree makes
  // the harness refuse to start, which is H2 all over again.
  writingAgentSeq += 1;
  const file = path.join(path.dirname(projectDir), `writing-agent-${writingAgentSeq}.js`);
  fs.writeFileSync(
    file,
    'const fs = require("node:fs");\n' +
      'const p = require("node:path");\n' +
      'const t = p.join(process.cwd(), "src", "harness-fixture.ts");\n' +
      "fs.mkdirSync(p.dirname(t), { recursive: true });\n" +
      'fs.writeFileSync(t, "export const writtenByTheFixtureAgent = true;\\n", "utf8");\n',
    "utf8"
  );
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

test("no shipped pack declares a schema newer than this CLI reads", () => {
  const { PACK_SCHEMA_VERSION, isNewerThan } = require("../../packages/core/src/domain/PackSpec");
  for (const id of IDS) {
    const raw = fs.readFileSync(path.join(PACKS_DIR, id, "pack.yaml"), "utf8");
    const declared = /schema_version:\s*"([^"]+)"/.exec(raw);
    if (!declared) continue;
    assert.equal(
      isNewerThan(declared[1], PACK_SCHEMA_VERSION),
      false,
      `${id} declares ${declared[1]}, newer than ${PACK_SCHEMA_VERSION}`
    );
  }
});

test("no shipped pack uses `rules` for domain rules", () => {
  // `rules` is render configuration; invariants belong in `business_rules`.
  // Conflating them is what made every curated pack uninstallable.
  for (const id of IDS) {
    const raw = fs.readFileSync(path.join(PACKS_DIR, id, "pack.yaml"), "utf8");
    const rulesBlock = /^rules:\n((?:[ \t].*\n|\n)*)/m.exec(raw);
    if (!rulesBlock) continue;
    assert.ok(
      !/^\s+- id: RUL-/m.test(rulesBlock[1]),
      `${id} lists RUL-* under \`rules\` — move them to \`business_rules\``
    );
  }
});

// ── `depends_on`, from the pack to the harness (B1) ──────────────────────────
//
// The last piece of B1. Ordering, stacking and the stale-base warning already
// existed; what was missing was a way for a *pack* to say REQ-002 builds on
// REQ-001. This walks the whole path: pack → expand → matrix → plan → harness.

test("a pack's depends_on reaches plan and stacks the harness branch", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-dependson-"));
  try {
    // A curated pack with one dependency added. Using a real pack rather than a
    // fixture keeps this honest about the shape packs actually have.
    const packRoot = path.join(parent, "packs");
    fs.mkdirSync(packRoot, { recursive: true });
    fs.cpSync(path.join(PACKS_DIR, "billing"), path.join(packRoot, "billing"), {
      recursive: true,
    });
    const packYaml = path.join(packRoot, "billing", "backend", "pack.yaml");
    fs.writeFileSync(
      packYaml,
      fs
        .readFileSync(packYaml, "utf8")
        .replace("  - id: REQ-002\n", "  - id: REQ-002\n    depends_on: [REQ-001]\n"),
      "utf8"
    );

    const lint = spawnSync(
      process.execPath,
      [CLI, "pack", "lint", "--pack-root", packRoot, "--pack", "billing/backend"],
      { encoding: "utf8" }
    );
    assert.equal(lint.status, 0, `depends_on must not break lint:\n${lint.stdout}${lint.stderr}`);

    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--no-sample-req", "--out", parent, "--no-git"],
      { encoding: "utf8" }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(
      parent,
      fs.readdirSync(parent).find((d: string) => d !== "packs")
    );

    const expand = spawnSync(
      process.execPath,
      [
        CLI,
        "expand",
        "--pack-root",
        packRoot,
        "--pack",
        "billing/backend",
        "--project-dir",
        projectDir,
        "--var",
        "PROJECT_NAME=Dep",
        "--var",
        "PROJECT_SLUG=dep",
        "--var",
        "DOMAIN=dep",
      ],
      { encoding: "utf8" }
    );
    assert.equal(expand.status, 0, expand.stdout + expand.stderr);

    // The matrix carries it, beneath the table where a rebuild will not lose it.
    const matrix = fs.readFileSync(path.join(projectDir, "docs/specs/traceability.md"), "utf8");
    // The key, not the whole line: a trace line carries several keys (D1 added
    // `context=`), and pinning the exact text would break every time one grew.
    assert.match(matrix, /<!-- specgate:trace REQ-002 [^>]*depends=REQ-001\b/, matrix.slice(-400));

    // `plan` reads it, and orders REQ-002 behind REQ-001.
    const planned = spawnSync(
      process.execPath,
      [CLI, "plan", "--project-dir", projectDir, "--format", "json"],
      { encoding: "utf8" }
    );
    const plan = JSON.parse(planned.stdout);
    const req002 = plan.requirements.find((r: any) => r.requirement === "REQ-002");
    assert.deepEqual(req002.dependsOn, ["REQ-001"]);
    assert.deepEqual(req002.blockedBy, ["REQ-001"], "REQ-001 has not been done yet");

    // And the harness cuts REQ-002 from REQ-001's branch, not from the base.
    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    git("init", "-q");
    // In the repo, not with `-c`: the harness commits on its own, and CI has no
    // global identity. `-c` covers only the command it is written on.
    git("config", "user.email", "harness-test@example.com");
    git("config", "user.name", "Harness Test");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

    const run = spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        projectDir,
        "--agent",
        writingAgent(projectDir),
        "--max-attempts",
        "1",
      ],
      { encoding: "utf8" }
    );
    const log = git("log", "--oneline", "harness/REQ-002").stdout;
    assert.match(
      log,
      /feat\(REQ-001\)/,
      `REQ-002 was not cut from its predecessor's branch:\n${log}\n${run.stdout}${run.stderr}`
    );

    // And it is never reported as blocked by a predecessor that passed in this
    // very run — the plan's `blockedBy` is a snapshot taken before it started.
    assert.doesNotMatch(
      run.stdout + run.stderr,
      /REQ-002: it depends on REQ-001, which is not done/,
      "a stale blocker would skip work the scheduler had correctly unblocked"
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── An agent profile per requirement, not per run (D1) ───────────────────────
//
// `agent_profile` resolved one profile for the whole run, so the allowed tools
// had to be the greatest common denominator of everything in the plan.
//
// The criterion took measuring. The proposal named the bounded context, "which
// is already in the model" — it is in the *pack* model and was not reachable
// from a requirement: **zero of the twenty-seven** scenarios across the curated
// packs link to an aggregate. Matching on it would have matched nothing and
// used the default every time. Use case → command → aggregate → bounded context
// resolves for all twenty-seven, so `expand` derives it and writes it.

test("a requirement's bounded context is derived and matched to a profile", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-profilematch-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--no-sample-req", "--out", parent, "--no-git"],
      { encoding: "utf8" }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

    const expand = spawnSync(
      process.execPath,
      [
        CLI,
        "expand",
        "--pack-root",
        PACKS_DIR,
        "--pack",
        "billing/backend",
        "--project-dir",
        projectDir,
        "--var",
        "PROJECT_NAME=Ctx",
        "--var",
        "PROJECT_SLUG=ctx",
        "--var",
        "DOMAIN=ctx",
      ],
      { encoding: "utf8" }
    );
    assert.equal(expand.status, 0, expand.stdout + expand.stderr);

    // Derived from the pack model and written by name — `Invoicing`, not
    // `BC-001`: the name is what a person writes in `match:`.
    const matrix = fs.readFileSync(path.join(projectDir, "docs/specs/traceability.md"), "utf8");
    assert.match(matrix, /<!-- specgate:trace REQ-001 context=Invoicing -->/, matrix.slice(-400));
    assert.match(matrix, /<!-- specgate:trace REQ-002 context=Payments -->/);

    fs.mkdirSync(path.join(projectDir, ".harness"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".harness", "profiles.yaml"),
      [
        "profiles_version: 1",
        "profiles:",
        "  payments:",
        `    agent: ${JSON.stringify(writingAgent(projectDir))}`,
        "    match:",
        "      bounded_context: Payments",
        "  everything-else:",
        `    agent: ${JSON.stringify(writingAgent(projectDir))}`,
        "    match:",
        '      bounded_context: "*"',
        "",
      ].join("\n"),
      "utf8"
    );

    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
    git("init", "-q");
    // In the repo, not with `-c`: the harness commits on its own, and CI has no
    // global identity. `-c` covers only the command it is written on.
    git("config", "user.email", "harness-test@example.com");
    git("config", "user.name", "Harness Test");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

    const run = spawnSync(
      process.execPath,
      [
        CLI,
        "harness",
        "run",
        "--project-dir",
        projectDir,
        "--agent",
        writingAgent(projectDir),
        "--max-attempts",
        "1",
      ],
      { encoding: "utf8" }
    );
    const out = run.stdout + run.stderr;

    // The whole point: different requirements, different profiles, in one run.
    assert.match(out, /REQ-001\s+profile 'everything-else' matched/, out);
    assert.match(out, /REQ-002\s+profile 'payments' matched/, out);

    // And it works with no `harness.config.yaml` at all — the rules live in
    // profiles.yaml, and reaching them through the config reader made them
    // silently absent in exactly this project shape.
    assert.equal(fs.existsSync(path.join(projectDir, "harness.config.yaml")), false);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("expand tags every scenario it generates, and repeating it does not duplicate", () => {
  // Nobody writes these by hand, and `expand` runs more than once against the
  // same project — a step that duplicates on every run is one people avoid.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-tags-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--no-sample-req", "--out", parent, "--no-git"],
      { encoding: "utf8" }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const projectDir = path.join(parent, fs.readdirSync(parent)[0]);

    const expand = () =>
      spawnSync(
        process.execPath,
        [
          CLI,
          "expand",
          "--pack-root",
          PACKS_DIR,
          "--pack",
          "billing/backend",
          "--project-dir",
          projectDir,
          "--var",
          "PROJECT_NAME=Tag",
          "--var",
          "PROJECT_SLUG=tag",
          "--var",
          "DOMAIN=tag",
        ],
        { encoding: "utf8" }
      );

    assert.equal(expand().status, 0);
    const featureDir = path.join(projectDir, "features", "billing");
    const first = fs
      .readdirSync(featureDir)
      .map((f: string) => fs.readFileSync(path.join(featureDir, f), "utf8"));
    assert.ok(first.length > 0, "expand generated no features");
    for (const content of first) {
      assert.match(content, /@REQ-\d+ @SCN-\d+/, content.slice(0, 200));
    }

    assert.equal(expand().status, 0);
    const second = fs
      .readdirSync(featureDir)
      .map((f: string) => fs.readFileSync(path.join(featureDir, f), "utf8"));
    assert.deepEqual(second, first, "a second expand must not change the tags");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
