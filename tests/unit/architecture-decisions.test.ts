"use strict";

/**
 * REQ-546, REQ-547, REQ-548 — decisions recorded and superseded, the agent kept
 * to its decision rights, and the stack file (change architecture-decisions).
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
const {
  adrSlug,
  nextAdrNumber,
  readAdr,
  supersededText,
} = require("../../packages/core/src/domain/Adr");
const {
  addedDependencies,
  decisionsExceeded,
  operationCount,
  parseDecisionRights,
} = require("../../packages/core/src/domain/DecisionRights");
const {
  mergeCommands,
  renderStack,
  stackCommands,
} = require("../../packages/core/src/domain/StackFile");
const { AgentPrompt } = require("../../packages/core/src/domain/AgentPrompt");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function tmp(prefix = "specgate-arch-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
}
const sg = (cwd: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};
const put = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

/** `init --yes` with REQ-001 dropped, so `harness run --req REQ-000` has one requirement. */
function project() {
  const parent = tmp();
  const init = spawnSync(
    process.execPath,
    [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  return { parent, dir };
}

// ── REQ-546 ─────────────────────────────────────────────────────────────────

const OLD_ADR =
  "# ADR-0001: Use Postgres\n\n**Date:** 2026-01-01  \n**Status:** Accepted  \n\n## Context\n\nWe need SQL.\n";

test("REQ-546 SCN-546a: a decision replaced", () => {
  const { dir } = project();
  put(dir, "docs/specs/adr/0001-use-postgres.md", OLD_ADR);
  const s = sg(dir, "adr", "supersede", "0001", "Use SQLite for the edge", "--json");
  assert.equal(s.status, 0, s.out);
  const created = path.join(dir, "docs/specs/adr/0002-use-sqlite-for-the-edge.md");
  assert.ok(fs.existsSync(created));
  assert.match(fs.readFileSync(created, "utf8"), /\*\*Supersedes:\*\* ADR-0001/);
  const old = fs.readFileSync(path.join(dir, "docs/specs/adr/0001-use-postgres.md"), "utf8");
  assert.equal(old, OLD_ADR.replace("**Status:** Accepted", "**Status:** Superseded by 0002"));

  const list = JSON.parse(sg(dir, "adr", "list", "--json").stdout).adr.list;
  assert.deepEqual(
    list.map((a: { number: string; status: string }) => [a.number, a.status]),
    [
      ["0001", "Superseded by 0002"],
      ["0002", "Proposed"],
    ]
  );
});

test("REQ-546: adr new writes the next number, Proposed, with the three sections", () => {
  const { dir } = project();
  put(dir, "docs/specs/adr/0007-x.md", OLD_ADR);
  const r = sg(dir, "adr", "new", "Événements en file", "--json");
  assert.equal(r.status, 0, r.out);
  assert.equal(JSON.parse(r.stdout).adr.path, "docs/specs/adr/0008-evenements-en-file.md");
  const text = fs.readFileSync(path.join(dir, "docs/specs/adr/0008-evenements-en-file.md"), "utf8");
  for (const h of ["## Context", "## Decision", "## Consequences", "**Status:** Proposed"]) {
    assert.ok(text.includes(h), h);
  }
});

test("REQ-546: a superseded ADR is not superseded twice, and one without a status is refused whole", () => {
  const { dir } = project();
  put(dir, "docs/specs/adr/0001-a.md", OLD_ADR.replace("Accepted", "Superseded by 0003"));
  put(dir, "docs/specs/adr/0002-b.md", "# ADR-0002: B\n\nNo status here.\n");
  const twice = sg(dir, "adr", "supersede", "0001", "C", "--json");
  assert.equal(JSON.parse(twice.stdout).status[0].code, "adr_already_superseded");
  const none = sg(dir, "adr", "supersede", "0002", "C", "--json");
  assert.equal(JSON.parse(none.stdout).status[0].code, "adr_status_missing");
  assert.deepEqual(
    fs.readdirSync(path.join(dir, "docs/specs/adr")).filter((f: string) => /^\d{4}-/.test(f)),
    ["0001-a.md", "0002-b.md"],
    "nothing was written"
  );
});

test("REQ-546: the rules, without a project", () => {
  assert.equal(nextAdrNumber(["0001-a.md", "0010-b.md", "README.md"]), "0011");
  assert.equal(nextAdrNumber([]), "0001");
  assert.equal(adrSlug("Use SQLite — for the Edge!"), "use-sqlite-for-the-edge");
  assert.equal(
    readAdr("0003-x.md", "# ADR-0003: Title here\nStatus: Accepted\n").status,
    "Accepted"
  );
  assert.equal(supersededText("# T\n", "0002"), null);
  assert.equal(
    supersededText("a\r\n**Status:** Accepted  \r\nb", "0009"),
    "a\r\n**Status:** Superseded by 0009  \r\nb"
  );
});

// ── REQ-547 ─────────────────────────────────────────────────────────────────

const RIGHTS = "| Decision | Right |\n| --- | --- |\n| dependency | ask |\n| migration | agent |\n";

test("REQ-547 SCN-547a: the agent adds a library", () => {
  const { parent, dir } = project();
  put(dir, "docs/specs/decision-rights.md", RIGHTS);
  put(dir, "package.json", JSON.stringify({ name: "app", dependencies: {} }, null, 2) + "\n");
  git(dir, "init", "-q");
  git(dir, "config", "core.autocrlf", "false");
  // CI has no global identity, and the harness commits what it lands.
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(
    agent,
    [
      'const fs = require("node:fs");',
      'const prompt = fs.readFileSync(process.argv[2], "utf8");',
      `fs.writeFileSync(${JSON.stringify(path.join(parent, "prompt.md"))}, prompt);`,
      'fs.mkdirSync("src", { recursive: true });',
      'fs.writeFileSync("src/a.js", "module.exports = 1;\\n");',
      'const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));',
      'pkg.dependencies["left-pad"] = "^1.3.0";',
      'fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\\n");',
      "",
    ].join("\n")
  );
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      "harness",
      "run",
      "--project-dir",
      dir,
      "--req",
      "REQ-000",
      "--agent",
      `"${process.execPath}" "${agent}" {prompt_file}`,
      "--max-attempts",
      "1",
      "--test-cmd",
      `"${process.execPath}" -e "process.exit(0)"`,
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  const out = r.stdout + r.stderr;
  assert.notEqual(r.status, 0, out);
  assert.match(out, /decision_right_exceeded — dependency in package\.json \(left-pad\)/, out);
  assert.match(
    fs.readFileSync(path.join(parent, "prompt.md"), "utf8"),
    /## Decision rights[\s\S]*\| dependency \| ask \|/,
    "the prompt carries the table"
  );
});

test("REQ-547: the decisions a diff shows", () => {
  const { rights, problems } = parseDecisionRights(
    RIGHTS + "| public-api | `ask` |\n| hiring | ask |\n"
  );
  assert.equal(rights.get("public-api"), "ask");
  assert.equal(rights.get("migration"), "agent");
  assert.match(problems.join(), /unknown decision "hiring"/);

  assert.deepEqual(
    addedDependencies(
      "pom.xml",
      "<artifactId>a</artifactId>\n",
      "<artifactId>a</artifactId>\n  <artifactId>b</artifactId>\n"
    ),
    ["<artifactId>b</artifactId>"]
  );
  assert.deepEqual(
    addedDependencies("build.gradle", "", "  implementation 'x:y:1'\n  version = '2'\n"),
    ["implementation 'x:y:1'"]
  );
  assert.deepEqual(addedDependencies("Cargo.toml", 'name = "a"\n', 'name = "b"\nserde = "1"\n'), [
    'serde = "1"',
  ]);
  assert.equal(operationCount("paths:\n  /a:\n    get:\n      x: 1\n    post:\n"), 2);
  assert.equal(operationCount('{"paths":{"/a":{"get":{}}}}'), 1);

  const all = new Map([
    ["dependency", "ask"],
    ["migration", "ask"],
    ["public-api", "ask"],
  ]);
  const found = decisionsExceeded(all, [
    { path: "db/migrate/2026_add.rb", before: null, after: "x" },
    { path: "db/migrate/2025_old.rb", before: "x", after: "y" },
    {
      path: "api/openapi.yaml",
      before: "paths:\n  /a:\n    get:\n",
      after: "paths:\n  /a:\n    get:\n    post:\n",
    },
    { path: "src/package.json.md", before: null, after: "{}" },
  ]);
  assert.deepEqual(
    found.map((e: { decision: string; file: string }) => [e.decision, e.file]),
    [
      ["public-api", "api/openapi.yaml"],
      ["migration", "db/migrate/2026_add.rb"],
    ]
  );
  assert.deepEqual(
    decisionsExceeded(new Map([["dependency", "agent"]]), [
      { path: "package.json", before: "{}", after: '{"dependencies":{"x":"1"}}' },
    ]),
    []
  );
});

test("REQ-547: without a rights file the prompt has no such section", () => {
  const prompt = AgentPrompt.build({ requirement: "REQ-001" }, {});
  assert.doesNotMatch(prompt, /Decision rights/);
});

// ── REQ-548 ─────────────────────────────────────────────────────────────────

test("REQ-548 SCN-548a: a Spring and Flyway project", () => {
  const dir = tmp();
  put(
    dir,
    "pom.xml",
    "<project><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency>" +
      "<dependency><artifactId>flyway-core</artifactId></dependency></dependencies></project>\n"
  );
  put(dir, "src/main/resources/db/migration/V1__init.sql", "create table t (id int);\n");
  put(dir, "src/main/java/A.java", "class A {}\n");
  assert.equal(sg(dir, "init").status, 0);
  const first = sg(dir, "stack", "--json");
  assert.equal(first.status, 0, first.out);
  const stack = fs.readFileSync(path.join(dir, "docs/specs/stack.md"), "utf8");
  assert.match(stack, /\| migration \| Flyway \| pom\.xml: flyway-core \|/);
  assert.match(stack, /\| service \| Spring Boot \| pom\.xml: spring-boot-starter-web \|/);
  const second = sg(dir, "stack", "--json");
  assert.equal(JSON.parse(second.stdout).stack.changed, false);
  assert.equal(fs.readFileSync(path.join(dir, "docs/specs/stack.md"), "utf8"), stack);

  // The test command check runs comes from the stack file when the config sets none.
  const marker = path.join(dir, "ran.txt");
  const cmd = `node -e "require('fs').writeFileSync('ran.txt','1')"`;
  fs.writeFileSync(
    path.join(dir, "docs/specs/stack.md"),
    stack.replace(/\| test \| .* \|/, `| test | \`${cmd}\` |`)
  );
  const harness = path.join(dir, "harness.config.yaml");
  if (fs.existsSync(harness)) {
    fs.writeFileSync(harness, fs.readFileSync(harness, "utf8").replace(/^test_cmd:.*$/m, ""));
  }
  const check = sg(dir, "check", "--json");
  const tests = JSON.parse(check.stdout).stages.find((s: { stage: string }) => s.stage === "tests");
  assert.equal(tests.command, cmd, check.out);
  assert.ok(fs.existsSync(marker), "the stack file's test command ran");
});

test("REQ-548: a command a person corrected is kept on the next run", () => {
  const before = renderStack([], { test: "npm test" }).replace("`npm test`", "`npm run test:ci`");
  const merged = mergeCommands({ test: "npm test", build: "npm run build" }, before);
  assert.deepEqual(merged, { test: "npm run test:ci", build: "npm run build" });
  assert.deepEqual(stackCommands(renderStack([], {})), {});
  const piped = "npm test 2>&1 | tee out.log && echo C:\\tmp";
  assert.deepEqual(
    stackCommands(renderStack([], { test: piped })),
    { test: piped },
    "a pipe and a backslash read back"
  );
});
