"use strict";

/**
 * A gate a team can trust (ADR-0036, change `trust-gate`).
 *
 * The gate fails on defects only, ids are checked against the base branch,
 * the generated matrix never blocks a merge, and the harness delivers a chain
 * of requirements without wrapper scripts.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const CORPUS = path.join(ROOT_DIR, "tests", "fixtures", "corpus");

/** One finding in the `status` list of `validate --json` / `check --json`. */
interface Diagnostic {
  severity: string;
  code: string;
  message: string;
  fix?: string;
}

/** One requirement's outcome in `harness run --format json`. */
interface HarnessResult {
  requirement: string;
  result: string;
  error?: string;
}

/** How `chainProject` shapes the project and its scripted agent. */
interface ChainOptions {
  testCmd?: string;
  extraFiles?: [string, string][];
  failFor?: string;
  envFile?: string;
}

type ChainProject = ReturnType<typeof chainProject>;

function cli(cwd: string, ...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECGATE_PROFILE: "", NO_COLOR: "1" },
  });
}

function out(r: CliResult) {
  return `${r.stdout}${r.stderr}`;
}

function json(r: CliResult) {
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}

function git(cwd: string, ...args: string[]): CliResult {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** A Node repository with code, adopted by plain `specgate init`. */
function adopted(testCmd = "node pass.js") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-trust-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"app","version":"1.0.0","scripts":{"test":"node --test test/"}}\n'
  );
  fs.writeFileSync(path.join(dir, "lib", "index.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir, "pass.js"), "process.exit(0);\n");
  const r = cli(dir, "init");
  assert.equal(r.status, 0, out(r));
  if (testCmd) fs.writeFileSync(path.join(dir, "harness.config.yaml"), `test_cmd: "${testCmd}"\n`);
  return { parent, dir, done: () => fs.rmSync(parent, { recursive: true, force: true }) };
}

function requirement(id: string, title: string, steps: string[], extra = "") {
  return (
    `### Requirement: ${id} — ${title}\n\n` +
    `The system SHALL ${title.toLowerCase()}.${extra}\n\n` +
    `#### Scenario: SCN-${id.slice(4)}a — ${title}\n\n` +
    `${steps.join("\n")}\n\n` +
    `<!-- specgate:trace kind=functional actor=Developer -->\n`
  );
}

/** An open change with these requirements, opened as `propose` opens it. */
function openChange(dir: string, id: string, reqs: string[], capability = "commands") {
  const r = cli(dir, "propose", id, "--capability", capability);
  assert.equal(r.status, 0, out(r));
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes", id, "specs", capability, "spec.md"),
    `# Delta — ${capability}\n\n## ADDED Requirements\n\n${reqs.join("\n")}`
  );
}

function nameInTest(dir: string, file: string, ...ids: string[]) {
  // An empty test/ is not tracked, so a checkout may have removed it.
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "test", file),
    `// ${ids.join(" ")}\nrequire("node:test")("named", () => {});\n`
  );
}

// ── REQ-117 ──────────────────────────────────────────────────────────────────

test("REQ-117 SCN-117a: a command in a code span is not a placeholder", () => {
  const p = adopted();
  try {
    openChange(p.dir, "quick-check", [
      requirement("REQ-002", "Name the quick check", [
        "- GIVEN a repository with the module billing",
        "- WHEN the developer generates the guide",
        "- THEN the developer sees `tool verify <module> --level fast` as the quick check, `etc` excluded",
      ]),
      requirement("REQ-003", "Greet a customer", [
        "- GIVEN a customer named <name>",
        "- WHEN the greeting is asked for",
        "- THEN it reads Hello and the name",
      ]),
    ]);
    nameInTest(p.dir, "commands.test.js", "REQ-002", "SCN-002a", "REQ-003", "SCN-003a");

    const literal = cli(p.dir, "apply", "REQ-002");
    assert.equal(literal.status, 0, out(literal));
    assert.doesNotMatch(out(literal), /scenario_placeholder_step|vague_step/);

    const template = cli(p.dir, "apply", "REQ-003");
    assert.equal(template.status, 1, out(template));
    assert.match(out(template), /scenario_placeholder_step/);
  } finally {
    p.done();
  }
});

// ── REQ-118 ──────────────────────────────────────────────────────────────────

test("REQ-118 SCN-118a: an id a spec only mentions owes no matrix row", () => {
  const p = adopted();
  try {
    openChange(p.dir, "guide-wording", [
      requirement(
        "REQ-002",
        "Name the quick check",
        [
          "- GIVEN a repository with the module billing",
          "- WHEN the developer generates the guide",
          "- THEN the guide names the quick check, as REQ-003 did before",
        ],
        " It replaces REQ-003's wording.\n\n```\nREQ-004 — an example id\n```"
      ),
    ]);
    nameInTest(p.dir, "guide.test.js", "REQ-002", "SCN-002a");
    assert.equal(cli(p.dir, "apply", "REQ-002").status, 0);
    const archived = cli(p.dir, "archive", "guide-wording");
    assert.equal(archived.status, 0, out(archived));

    const r = cli(p.dir, "validate", ".", "--strict");
    assert.equal(r.status, 0, out(r));
    assert.doesNotMatch(out(r), /TDD-3/);

    // On a hand-kept matrix, a declared requirement with no row still fails.
    const {
      ValidateProjectUseCase,
    } = require("../../packages/core/src/application/ValidateProjectUseCase");
    const matrix =
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |\n" +
      "|---|---|---|---|---|---|---|---|---|---|\n" +
      "| REQ-002 | SCN-002a | `features/commands/REQ-002.feature` | - | - | - | - | - | test/guide.test.js | Implemented |\n";
    const spec =
      "### Requirement: REQ-002 — Name the quick check\n\nIt replaces REQ-003's wording.\n\n" +
      "```\nREQ-999 — an example id\n```\n\n### Requirement: REQ-004 — Declared with no row\n";
    const { report } = new ValidateProjectUseCase({}).checkMatrix(matrix, {
      strictTdd: true,
      specContent: spec,
    });
    const messages = report.errors.map((f: { message: string }) => f.message).join("\n");
    assert.match(messages, /TDD-3\] Requirement REQ-004/);
    assert.doesNotMatch(messages, /REQ-003|REQ-999/);
  } finally {
    p.done();
  }
});

// ── REQ-119 ──────────────────────────────────────────────────────────────────

test("REQ-119 SCN-119a: the corpus passes the strict gate with no finding", () => {
  const extra = String(process.env.SPECGATE_CORPUS || "")
    .split(path.delimiter)
    .filter(Boolean);
  const projects = [path.join(CORPUS, "shapes"), ...extra];
  for (const project of projects) {
    const r = cli(project, "validate", ".", "--strict", "--json");
    assert.equal(r.status, 0, `${project}\n${out(r)}`);
    const findings = (json(r).status || []).filter((d: Diagnostic) =>
      ["error", "warning"].includes(d.severity)
    );
    assert.deepEqual(findings, [], `${project}: ${JSON.stringify(findings, null, 2)}`);
  }
});

// ── REQ-120 ──────────────────────────────────────────────────────────────────

function gitRepo(dir: string) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "trust@example.com");
  git(dir, "config", "user.name", "Trust Test");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
}

function capability(dir: string, cap: string, reqs: string[]) {
  const file = path.join(dir, "docs/specs/capabilities", cap, "spec.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${cap}\n\n## Requirements\n\n${reqs.join("\n")}`);
}

test("REQ-120 SCN-120a: an id taken on the base with another title fails check", () => {
  const p = adopted();
  try {
    gitRepo(p.dir);
    git(p.dir, "checkout", "-q", "-b", "develop");
    capability(p.dir, "orders", [
      requirement("REQ-002", "Keep the order total", ["- GIVEN a", "- WHEN b", "- THEN c"]),
      requirement("REQ-003", "Export orders as CSV", ["- GIVEN a", "- WHEN b", "- THEN c"]),
    ]);
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "develop: orders");

    git(p.dir, "checkout", "-q", "main");
    git(p.dir, "checkout", "-q", "-b", "feature");
    capability(p.dir, "orders", [
      requirement("REQ-002", "Keep the order total", ["- GIVEN a", "- WHEN b", "- THEN c"]),
    ]);
    openChange(p.dir, "refunds", [
      requirement("REQ-003", "Refund an order", ["- GIVEN a", "- WHEN b", "- THEN c"]),
    ]);

    const r = cli(p.dir, "check", "--base", "develop", "--json");
    assert.equal(r.status, 1, out(r));
    const errors = json(r).status.filter((d: Diagnostic) => d.severity === "error");
    assert.deepEqual(
      errors.map((d: Diagnostic) => d.code),
      ["id_taken_on_base"]
    );
    assert.match(
      errors[0].message,
      /REQ-003 is "Refund an order" here and "Export orders as CSV" on develop/
    );
    assert.match(errors[0].fix, /renumber REQ-003 on this branch to REQ-\d+/);
    assert.doesNotMatch(
      JSON.stringify(errors),
      /REQ-002/,
      "the same title is the same requirement"
    );
  } finally {
    p.done();
  }
});

test("REQ-120 SCN-120c: a gitflow project compares ids with its pr base", () => {
  // Ticket keys already measured from `pr: base:` (REQ-148) while ids were
  // compared with the remote's default, so one `check` named two bases.
  const p = adopted();
  try {
    gitRepo(p.dir);
    git(p.dir, "checkout", "-q", "-b", "develop");
    capability(p.dir, "orders", [
      requirement("REQ-003", "Export orders as CSV", ["- GIVEN a", "- WHEN b", "- THEN c"]),
    ]);
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "develop: orders");

    git(p.dir, "checkout", "-q", "main");
    git(p.dir, "checkout", "-q", "-b", "feature");
    fs.writeFileSync(
      path.join(p.dir, "alm.config.yaml"),
      "alm_version: 1\nprovider: jira\nbase_url: https://example.atlassian.net\n" +
        "project_key: KAN\npr:\n  base: develop # the branch pull requests target\n"
    );
    openChange(p.dir, "refunds", [
      requirement("REQ-003", "Refund an order", ["- GIVEN a", "- WHEN b", "- THEN c"]),
    ]);

    const r = cli(p.dir, "check", "--json");
    assert.equal(r.status, 1, out(r));
    const taken = json(r).status.find((d: Diagnostic) => d.code === "id_taken_on_base");
    assert.ok(taken, out(r));
    assert.match(taken.message, /"Export orders as CSV" on develop/);
  } finally {
    p.done();
  }
});

test("REQ-120 SCN-120d: a requirement the base changed is not an id taken", () => {
  // Found in a rehearsal: the second of two tickets rewriting REQ-009 was told
  // to renumber it once the first had merged. It had taken nothing.
  const p = adopted();
  const steps = ["- GIVEN a", "- WHEN b", "- THEN c"];
  try {
    capability(p.dir, "owners", [
      requirement("REQ-009", "An owner's telephone is exactly 10 digits", steps),
    ]);
    gitRepo(p.dir);
    git(p.dir, "checkout", "-q", "-b", "develop");
    git(p.dir, "checkout", "-q", "-b", "feature");
    git(p.dir, "checkout", "-q", "develop");
    capability(p.dir, "owners", [
      requirement(
        "REQ-009",
        "An owner's telephone is 10 digits, or an international number",
        steps
      ),
    ]);
    git(p.dir, "commit", "-qam", "PET-103 merged");
    git(p.dir, "checkout", "-q", "feature");

    const r = cli(p.dir, "check", "--base", "develop", "--json");
    assert.ok(!json(r).status.some((d: Diagnostic) => d.code === "id_taken_on_base"), out(r));
  } finally {
    p.done();
  }
});

test("REQ-120 SCN-120b: no git, no comparison, and check says so", () => {
  const p = adopted();
  try {
    const r = cli(p.dir, "check", "--json");
    assert.equal(r.status, 0, out(r));
    assert.match(json(r).check.ids, /^skipped: not a git repository/);
    assert.match(cli(p.dir, "check").stdout, /Ids\s+not compared with a base/);
  } finally {
    p.done();
  }
});

// ── REQ-121 ──────────────────────────────────────────────────────────────────

test("REQ-121 SCN-121a: new skips the ids an open change reserved", () => {
  const p = adopted();
  try {
    const opened = cli(p.dir, "propose", "pricing");
    assert.equal(opened.status, 0, out(opened));
    assert.match(
      fs.readFileSync(path.join(p.dir, "docs/specs/changes/pricing/change.yaml"), "utf8"),
      /req_range: \[REQ-002, REQ-004\]/
    );
    const r = cli(p.dir, "new", "Totals are rounded half-up", "--json");
    assert.equal(r.status, 0, out(r));
    assert.equal(json(r).requirement.id, "REQ-005");
  } finally {
    p.done();
  }
});

// ── REQ-122 ──────────────────────────────────────────────────────────────────

/** What a person writes after `specgate new`: the obligation and the scenario's steps. */
function fillScenario(dir: string, featureFile: string) {
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(/The system MUST satisfy: (.*)\./g, "The system MUST make sure that $1, every time.")
      .replace(/^> Written by Specgate\..*$/gm, "")
  );
  const file = path.join(dir, featureFile);
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace("<the state before the action>", "an order totalling 10.005 EUR")
      .replace("<the action under test>", "the total is computed")
      .replace("<the observable outcome>", "the total is 10.01 EUR")
  );
}

test("REQ-122 SCN-122a: two branches deliver two requirements and merge cleanly", () => {
  const p = adopted();
  try {
    assert.match(
      fs.readFileSync(path.join(p.dir, ".gitattributes"), "utf8"),
      /^docs\/specs\/traceability\.md merge=union$/m
    );
    const a = json(cli(p.dir, "new", "Totals are rounded half-up", "--json")).requirement;
    const b = json(cli(p.dir, "new", "Refunds are logged", "--json")).requirement;
    fillScenario(p.dir, a.featureFile);
    fillScenario(p.dir, b.featureFile);
    gitRepo(p.dir);

    git(p.dir, "checkout", "-q", "-b", "one");
    nameInTest(p.dir, "a.test.js", a.id, a.scenarioId);
    assert.equal(cli(p.dir, "apply", a.id).status, 0);
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "deliver a");

    git(p.dir, "checkout", "-q", "main");
    git(p.dir, "checkout", "-q", "-b", "two");
    nameInTest(p.dir, "b.test.js", b.id, b.scenarioId);
    assert.equal(cli(p.dir, "apply", b.id).status, 0);
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "deliver b");

    const merged = git(p.dir, "merge", "--no-edit", "one");
    assert.equal(merged.status, 0, merged.stdout + merged.stderr);
    const r = cli(p.dir, "check");
    assert.equal(r.status, 0, out(r));
    const matrix = fs.readFileSync(path.join(p.dir, "docs/specs/traceability.md"), "utf8");
    for (const id of [a.id, b.id]) {
      assert.match(matrix, new RegExp(`\\| ${id} \\|.*\\| Implemented \\|`));
    }
  } finally {
    p.done();
  }
});

// ── REQ-123…REQ-127: the harness ─────────────────────────────────────────────

/**
 * A project on `develop` with two requirements in an open change, committed,
 * and an agent that delivers whichever requirement SPECGATE_REQ names: its
 * code and a test naming it. `failFor` makes the agent fail that one.
 */
function chainProject(opts: ChainOptions = {}) {
  const p = adopted(opts.testCmd || "node pass.js");
  openChange(p.dir, "pricing", [
    requirement("REQ-002", "Charge a peak surcharge", [
      "- GIVEN a session started at 18:00",
      "- WHEN the fee is computed",
      "- THEN it includes a 20 % surcharge",
    ]),
    requirement("REQ-003", "Charge an off-peak discount", [
      "- GIVEN a session started at 03:00",
      "- WHEN the fee is computed",
      "- THEN it includes a 10 % discount",
    ]),
  ]);
  for (const f of opts.extraFiles || []) fs.writeFileSync(path.join(p.dir, f[0]), f[1]);
  // 1.0 (REQ-315): a person approves the change before the harness builds it.
  assert.equal(cli(p.dir, "change", "approve", "pricing").status, 0);
  git(p.dir, "init", "-q", "-b", "develop");
  git(p.dir, "config", "user.email", "trust@example.com");
  git(p.dir, "config", "user.name", "Trust Test");
  git(p.dir, "add", "-A");
  git(p.dir, "commit", "-qm", "seed");
  const agent = path.join(p.parent, "agent.js");
  fs.writeFileSync(
    agent,
    [
      'const fs = require("node:fs");',
      "const req = process.env.SPECGATE_REQ;",
      `if (${JSON.stringify(opts.failFor || "")} === req) process.exit(1);`,
      'fs.mkdirSync("test", { recursive: true });',
      'fs.mkdirSync("lib", { recursive: true });',
      'fs.writeFileSync(`lib/${req}.js`, "module.exports = 1;\\n");',
      'fs.writeFileSync(`test/${req}.test.js`, `// ${req} SCN-${req.slice(4)}a\\nrequire("node:test")("ok", () => {});\\n`);',
      opts.envFile
        ? `fs.appendFileSync(${JSON.stringify(opts.envFile)}, req + " " + process.env.SPECGATE_ATTEMPT + "\\n");`
        : "",
    ].join("\n")
  );
  return { ...p, agent: `"${process.execPath}" "${agent}" {prompt_file}` };
}

function harness(p: ChainProject, ...extra: string[]) {
  return cli(p.dir, "harness", "run", "--agent", p.agent, "--max-attempts", "1", ...extra);
}

/** The chain over the change's two requirements, not the adoption baseline. */
function chain(p: ChainProject, ...extra: string[]) {
  return harness(p, "--chain", "--req", "REQ-002", "--req", "REQ-003", ...extra);
}

test("REQ-123 SCN-123a: the lockfile names the setup of each worktree", () => {
  const p = chainProject({ extraFiles: [["package-lock.json", '{"lockfileVersion":3}\n']] });
  try {
    const r = harness(p, "--dry-run");
    assert.equal(r.status, 0, out(r));
    assert.match(r.stdout, /Setup\s+npm ci --silent --no-audit --no-fund/);
    const none = harness(p, "--dry-run", "--setup-cmd", "none");
    assert.match(none.stdout, /Setup\s+none/);
  } finally {
    p.done();
  }
});

test("REQ-125 SCN-125a: the agent knows its requirement and attempt", () => {
  const p0 = { envFile: "" };
  const parentProbe = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-env-"));
  const envFile = path.join(parentProbe, "env.txt");
  const p = chainProject({ ...p0, envFile });
  try {
    const r = harness(p, "--req", "REQ-002");
    assert.match(out(r), /1 passed/, out(r));
    assert.equal(fs.readFileSync(envFile, "utf8"), "REQ-002 1\n");
  } finally {
    p.done();
    fs.rmSync(parentProbe, { recursive: true, force: true });
  }
});

test("REQ-126 SCN-126a + REQ-124 SCN-124a: a chain merges each green requirement in order", () => {
  const p = chainProject();
  try {
    const r = chain(p);
    assert.equal(r.status, 0, out(r));
    const merges = git(p.dir, "log", "--merges", "--format=%H %s", "develop")
      .stdout.trim()
      .split("\n")
      .reverse();
    assert.equal(merges.length, 2, merges.join("\n"));
    assert.match(merges[0], /Merge harness\/REQ-002/);
    assert.match(merges[1], /Merge harness\/REQ-003/);
    const firstMerge = merges[0].split(" ")[0];
    assert.equal(
      git(p.dir, "merge-base", "--is-ancestor", firstMerge, "harness/REQ-003").status,
      0,
      "REQ-003's branch was cut after REQ-002's merge"
    );
    for (const m of merges) {
      const sha = m.split(" ")[0];
      const files = git(p.dir, "diff", "--name-only", `${sha}^1`, sha).stdout;
      assert.doesNotMatch(files, /\.specops\/harness-prompts\//, "prompts never reach develop");
    }
    assert.match(
      git(p.dir, "ls-tree", "-r", "--name-only", "harness/REQ-002").stdout,
      /\.specops\/harness-prompts\/REQ-002-/,
      "the requirement's branch keeps its prompt"
    );
    const check = cli(p.dir, "check");
    assert.equal(check.status, 0, out(check));
  } finally {
    p.done();
  }
});

test("REQ-126 SCN-126b: the chain stops at the first requirement that fails", () => {
  const p = chainProject({ failFor: "REQ-002" });
  try {
    const before = git(p.dir, "rev-parse", "develop").stdout.trim();
    const r = chain(p, "--format", "json");
    assert.equal(r.status, 1, out(r));
    assert.equal(git(p.dir, "rev-parse", "develop").stdout.trim(), before);
    const results = JSON.parse(r.stdout).results;
    assert.deepEqual(
      results.map((x: HarnessResult) => [x.requirement, x.result]),
      [
        ["REQ-002", "fail"],
        ["REQ-003", "skipped"],
      ]
    );
  } finally {
    p.done();
  }
});

test("REQ-127 SCN-127a: green alone, red together — the merge is undone", () => {
  // The gate fails in the project directory — never in a worktree — once
  // REQ-003's code is there: green on its branch, red once merged.
  const gate =
    'const fs = require("node:fs");\n' +
    'process.exit(fs.existsSync(".post-merge") && fs.existsSync("lib/REQ-003.js") ? 1 : 0);\n';
  const p = chainProject({ testCmd: "node gate.js", extraFiles: [["gate.js", gate]] });
  try {
    fs.writeFileSync(path.join(p.dir, ".post-merge"), "");
    fs.appendFileSync(path.join(p.dir, ".git/info/exclude"), ".post-merge\n");
    const r = chain(p, "--format", "json");
    assert.equal(r.status, 1, out(r));
    const results = JSON.parse(r.stdout).results;
    assert.deepEqual(
      results.map((x: HarnessResult) => [x.requirement, x.result]),
      [
        ["REQ-002", "pass"],
        ["REQ-003", "fail"],
      ]
    );
    assert.match(results[1].error, /^post-merge gate/);
    assert.match(
      git(p.dir, "log", "-1", "--format=%s", "develop").stdout,
      /Merge harness\/REQ-002/,
      "develop ends at the first requirement's merge"
    );
  } finally {
    p.done();
  }
});
