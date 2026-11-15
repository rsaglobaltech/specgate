/**
 * fast-gate: `check --affected` runs the tests of what the change touches
 * (REQ-510), the whole suite when a file every test depends on changed
 * (REQ-511) or when nothing maps (REQ-512), through `{files}` and `{req}`
 * (REQ-513); `check` and `check --ci` run everything (REQ-514); `apply` runs
 * the requirement's own tests (REQ-515).
 *
 * The project's test runner records the files it was given, one JSON line
 * per run, in `ran.log`, which git ignores.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { git, removeProject, write } from "../helpers/project";
import { edit, project, runs } from "../helpers/affected-project";
import { runCli } from "../helpers/cli";
import {
  fillTestCommand,
  globalFile,
  sectionsAt,
  selectAffected,
  type AffectedInput,
} from "../../packages/core/src/domain/AffectedTests";
import { parseZeroContextDiff, unquoteGitPath } from "../../scripts/lib/affected";
import { candidatePaths, scanImports } from "../../packages/core/src/domain/ImportScan";
import { quoteArg } from "../../scripts/lib/escape";

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

type Selection = {
  mode: string;
  reason: string;
  base: string | null;
  changed: string[];
  requirements: string[];
  tests: string[];
  cached: string[];
  command: string | null;
};
type Finding = { code: string; message: string; fix?: string };

function check(dir: string, ...flags: string[]) {
  const r = runCli(["check", dir, "--json", ...flags]);
  const doc = json(r);
  const tests = (doc.stages || []).find((s: { stage: string }) => s.stage === "tests");
  return { r, doc, selection: doc.selection as Selection, tests };
}

test("REQ-510 SCN-510a: one requirement's code changed on a branch — only its test runs", () => {
  const dir = project();
  try {
    edit(dir, "src/two.js", "exports.reason = 'customer';\n");
    const { r, selection, tests } = check(dir, "--affected");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(selection.mode, "affected", selection.reason);
    assert.equal(selection.base, "main");
    assert.deepEqual(selection.changed, ["src/two.js"]);
    assert.deepEqual(selection.requirements, ["REQ-002"]);
    assert.deepEqual(selection.tests, ["test/two.test.js"]);
    assert.equal(selection.command, "node run-tests.js test/two.test.js");
    assert.equal(tests.command, "node run-tests.js test/two.test.js");
    assert.deepEqual(runs(dir), [["test/two.test.js"]]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-510: a requirement's text changed in the spec — its tests run; a changed test runs too", () => {
  const dir = project();
  try {
    const spec = path.join(dir, "spec.md");
    fs.writeFileSync(
      spec,
      fs
        .readFileSync(spec, "utf8")
        .replace("The system SHALL place an order.", "The system SHALL place an order, once.")
    );
    edit(dir, "test/two.test.js", "// and one more line\n");
    const { r, selection } = check(dir, "--affected");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(selection.mode, "affected", selection.reason);
    assert.deepEqual(selection.requirements, ["REQ-001", "REQ-002"]);
    assert.deepEqual(selection.tests, ["test/one.test.js", "test/two.test.js"]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-510: a file no requirement names, imported by a test's code — that test runs", () => {
  const dir = project();
  try {
    edit(dir, "src/shared.js", "exports.none = 0;\n");
    const { r, selection } = check(dir, "--affected");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(selection.mode, "affected", selection.reason);
    assert.deepEqual(selection.tests, ["test/one.test.js"]);
    assert.deepEqual(runs(dir), [["test/one.test.js"]]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-511 SCN-511a: the lockfile changed — the whole suite runs, and the reason names it", () => {
  const dir = project();
  try {
    edit(dir, "src/one.js", "\n");
    edit(dir, "package-lock.json", "\n");
    const { r, doc, selection, tests } = check(dir, "--affected");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /package-lock\.json/);
    assert.equal(tests.command, "node run-tests.js");
    assert.deepEqual(runs(dir), [[]]);
    assert.ok(doc.status.some((d: Finding) => d.code === "affected_full"));
  } finally {
    removeProject(dir);
  }
});

test("REQ-511: a file under a full_on: glob runs the whole suite", () => {
  const dir = project({ extraHarness: 'full_on: ["db/**"]\n' });
  try {
    write(dir, "db/schema.sql", "create table orders (id int);\n");
    const { selection } = check(dir, "--affected");
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /db\/schema\.sql/);
  } finally {
    removeProject(dir);
  }
});

test("REQ-512 SCN-512a: only an unlinked file changed — the whole suite, and it says the file is linked to nothing", () => {
  const dir = project();
  try {
    write(dir, "src/helpers.sql", "select 1;\n");
    const { r, selection, tests } = check(dir, "--affected");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /src\/helpers\.sql/);
    assert.match(selection.reason, /no requirement, test or import links it/);
    assert.equal(tests.command, "node run-tests.js");
    assert.deepEqual(runs(dir), [[]]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-512: nothing changed, a base that does not exist, no git — the whole suite each time, and why", () => {
  const dir = project();
  try {
    let { selection } = check(dir, "--affected");
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /nothing changed/);

    edit(dir, "src/one.js", "\n");
    ({ selection } = check(dir, "--affected", "--base", "no-such-branch"));
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /no-such-branch/);

    fs.rmSync(path.join(dir, ".git"), { recursive: true, force: true });
    ({ selection } = check(dir, "--affected"));
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /not in a git repository/);
    assert.equal(runs(dir).length, 3, "every one of them ran the suite");
  } finally {
    removeProject(dir);
  }
});

test("REQ-512: documentation alone changed — nothing maps, so the whole suite runs", () => {
  const dir = project();
  try {
    write(dir, "docs/notes.md", "# Notes\n");
    const { selection } = check(dir, "--affected");
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /nothing that changed is linked/);
  } finally {
    removeProject(dir);
  }
});

test("REQ-513 SCN-513a: a command with no placeholder runs whole and says how to add {files}; test_cmd_affected takes a path with a space as one argument", () => {
  const dir = project({ testCmd: "node run-tests.js" });
  try {
    fs.renameSync(path.join(dir, "test", "one.test.js"), path.join(dir, "test", "my req.test.js"));
    assert.equal(runCli(["matrix", "--project-dir", dir]).status, 0);
    git(dir, "add", "-A");
    assert.equal(git(dir, "commit", "-qm", "rename").status, 0);
    git(dir, "checkout", "-q", "main");
    git(dir, "merge", "-q", "--ff-only", "work");
    git(dir, "checkout", "-q", "work");
    edit(dir, "src/one.js", "\n");

    const first = check(dir, "--affected");
    assert.equal(first.r.status, 0, first.r.stdout + first.r.stderr);
    assert.equal(first.selection.mode, "full");
    assert.deepEqual(first.selection.tests, ["test/my req.test.js"]);
    const needs = first.doc.status.find((d: Finding) => d.code === "affected_needs_files");
    assert.ok(needs, JSON.stringify(first.doc.status));
    assert.match(needs.fix, /\{files\}/);
    assert.match(needs.fix, /test_cmd_affected/);

    // The setting is the project's: on main, where a change to it is not the branch's.
    git(dir, "stash", "-q");
    git(dir, "checkout", "-q", "main");
    assert.equal(
      runCli([
        "config",
        "set",
        "test_cmd_affected",
        "node run-tests.js {files}",
        "--project-dir",
        dir,
      ]).status,
      0
    );
    git(dir, "commit", "-qam", "test_cmd_affected");
    git(dir, "checkout", "-q", "work");
    git(dir, "merge", "-q", "main");
    git(dir, "stash", "pop", "-q");

    const second = check(dir, "--affected");
    assert.equal(second.r.status, 0, second.r.stdout + second.r.stderr);
    assert.equal(second.selection.mode, "affected", second.selection.reason);
    assert.equal(second.selection.command, `node run-tests.js ${quoteArg("test/my req.test.js")}`);
    assert.deepEqual(runs(dir).at(-1), ["test/my req.test.js"]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-513: {req} alone takes the one requirement touched; with two it runs whole and says why", () => {
  const dir = project({ testCmd: "node run-tests.js --grep {req}" });
  try {
    edit(dir, "src/one.js", "\n");
    let { selection } = check(dir, "--affected");
    assert.equal(selection.mode, "affected");
    assert.equal(selection.command, "node run-tests.js --grep REQ-001");
    edit(dir, "src/two.js", "\n");
    ({ selection } = check(dir, "--affected"));
    assert.equal(selection.mode, "full");
    assert.match(selection.reason, /\{req\} names one requirement and 2 are touched/);
    assert.equal(selection.command, "node run-tests.js --grep");
  } finally {
    removeProject(dir);
  }
});

test("REQ-514 SCN-514a: check alone and check --ci --affected run the whole suite; --ci says --affected is ignored", () => {
  const dir = project();
  try {
    edit(dir, "src/one.js", "\n");
    const plain = check(dir);
    assert.equal(plain.r.status, 0, plain.r.stdout + plain.r.stderr);
    assert.equal(plain.selection.mode, "full");
    assert.equal(plain.tests.command, "node run-tests.js");
    assert.equal(plain.doc.check.testCommand, "node run-tests.js {files}");

    const ci = check(dir, "--ci", "--affected");
    assert.equal(ci.r.status, 0, ci.r.stdout + ci.r.stderr);
    assert.equal(ci.selection.mode, "full");
    assert.deepEqual(ci.selection.cached, []);
    assert.ok(ci.doc.status.some((d: Finding) => d.code === "affected_ignored_ci"));
    assert.deepEqual(runs(dir), [[], []]);
  } finally {
    removeProject(dir);
  }
});

test("REQ-514: check with no flag prints what it always printed — no Affected line", () => {
  const dir = project();
  try {
    const r = runCli(["check", dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /Affected/);
    const affected = runCli(["check", dir, "--affected"]);
    assert.match(affected.stdout, /Affected\s+the whole suite — nothing changed since the base/);
  } finally {
    removeProject(dir);
  }
});

test("REQ-515 SCN-515a: apply runs the requirement's own test through {files} of test_cmd_affected", () => {
  const dir = project({
    testCmd: "node run-tests.js",
    extraHarness: 'test_cmd_affected: "node run-tests.js {files}"\n',
  });
  try {
    const r = runCli(["apply", "REQ-001", "--project-dir", dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), /status=Implemented/);
    assert.deepEqual(runs(dir), [["test/one.test.js"]]);
  } finally {
    removeProject(dir);
  }
});

// ── The decisions, one by one ───────────────────────────────────────────────

const base: AffectedInput = {
  changed: [],
  rows: [
    { requirement: "REQ-001", feature: "f/a.feature", tests: ["t/a.test.js"], code: ["src/a.js"] },
    { requirement: "REQ-002", feature: "f/b.feature", tests: ["t/b.test.js"], code: ["src/b.js"] },
  ],
  texts: new Map(),
  isTest: (p) => /\.test\.js$/.test(p),
  exists: () => true,
  importedBy: new Map(),
  fullOn: [],
};
const mod = (p: string, extra: Partial<AffectedInput["changed"][number]> = {}) => ({
  path: p,
  kind: "modified" as const,
  lines: [],
  text: "",
  ...extra,
});

test("REQ-510: a spec's changed lines touch the requirement whose section holds them, scenarios included", () => {
  const text = [
    "# Trusted Gate",
    "## Requirements",
    "### Requirement: REQ-001 — One",
    "The system SHALL one.",
    "#### Scenario: SCN-001a — about REQ-002",
    "- GIVEN x",
    "### Requirement: REQ-002 — Two",
    "The system SHALL two.",
    "## Notes",
    "prose",
  ].join("\n");
  assert.deepEqual(sectionsAt(text, [6]), ["REQ-001"]);
  assert.deepEqual(sectionsAt(text, [8]), ["REQ-002"]);
  assert.deepEqual(sectionsAt(text, [10]), []);
  assert.deepEqual(sectionsAt(text, null).sort(), ["REQ-001", "REQ-002"]);
  const s = selectAffected({
    ...base,
    changed: [mod("docs/specs/capabilities/x/spec.md", { lines: [10], text: "see REQ-002" })],
    texts: new Map([["docs/specs/capabilities/x/spec.md", text]]),
  });
  assert.deepEqual(s.requirements, ["REQ-002"], "an id named on a changed line counts");
});

test("REQ-511: the files every test depends on, by name, wherever they are", () => {
  for (const f of [
    "package.json",
    "packages/web/package.json",
    "yarn.lock",
    "tsconfig.build.json",
    "pom.xml",
    "build.gradle.kts",
    "pyproject.toml",
    "requirements-dev.txt",
    "go.mod",
    "jest.config.ts",
    "vitest.config.mts",
    ".env.test",
    "App.csproj",
  ]) {
    assert.equal(globalFile(f), f, f);
  }
  assert.equal(globalFile("src/package.js"), null);
  assert.equal(globalFile("gen/a.ts", ["gen/**"]), "gen/a.ts");
});

test("REQ-512: a removed source file runs the whole suite; a removed test or a doc does not decide", () => {
  const removed = selectAffected({
    ...base,
    changed: [mod("src/gone.js", { kind: "deleted" }), mod("src/a.js")],
  });
  assert.equal(removed.mode, "full");
  assert.match(removed.reason, /src\/gone\.js was removed/);
  const fine = selectAffected({
    ...base,
    changed: [mod("t/old.test.js", { kind: "deleted" }), mod("README.md"), mod("src/a.js")],
  });
  assert.equal(fine.mode, "affected");
  assert.deepEqual(fine.tests, ["t/a.test.js"]);
});

test("REQ-513: {files} quoted per platform; a command line too long for cmd.exe runs whole", () => {
  const sel = {
    mode: "affected" as const,
    requirements: ["REQ-001"],
    tests: ["a b.test.js", "c.test.js"],
  };
  assert.equal(
    fillTestCommand("npx vitest run {files}", sel, (f) => quoteArg(f, "win32"), "win32").command,
    'npx vitest run "a b.test.js" c.test.js'
  );
  assert.equal(
    fillTestCommand("npx vitest run {files} -t {req}", sel, (f) => quoteArg(f, "linux"), "linux")
      .command,
    "npx vitest run 'a b.test.js' c.test.js -t REQ-001"
  );
  const many = {
    ...sel,
    tests: Array.from({ length: 900 }, (_, i) => `tests/unit/file-${i}.test.js`),
  };
  const filled = fillTestCommand("node --test {files}", many, (f) => quoteArg(f, "win32"), "win32");
  assert.equal(filled.command, "node --test");
  assert.match(filled.fullBecause || "", /do not fit on one command line/);
});

test("REQ-510: imports read without running the file; a require built at run time is unknown", () => {
  const scan = scanImports(
    'import a from "./a";\nimport {\n  b,\n} from "../b.js";\nexport * from "./c";\nimport "./d.css";\n' +
      'const e = require("e");\nconst f = await import(`./f`);\nconst g = require(path.join(__dirname, "g"));\n'
  );
  assert.deepEqual(scan.specifiers, ["./a", "../b.js", "./c", "./d.css", "e", "./f"]);
  assert.equal(scan.dynamic, true);
  assert.ok(candidatePaths("src/x/y.ts", "../b.js").includes("src/b.ts"));
  assert.ok(candidatePaths("src/y.ts", "./a").includes("src/a/index.tsx"));
  assert.deepEqual(candidatePaths("y.ts", "../../out"), []);
});

test("REQ-510: git's zero-context diff read into the lines each file's hunks wrote", () => {
  const patch = [
    'diff --git "a/docs/caf\\303\\251.md" "b/docs/caf\\303\\251.md"',
    "index 1..2 100644",
    '--- "a/docs/caf\\303\\251.md"',
    '+++ "b/docs/caf\\303\\251.md"',
    "@@ -3 +3,2 @@ heading",
    "-old REQ-007",
    "+new",
    "++++ a line that starts with +++",
    "@@ -10,2 +11,0 @@",
    "-gone",
    "-gone too",
    "diff --git a/spec.md b/spec.md",
    "deleted file mode 100644",
    "--- a/spec.md",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-## REQ-009 — x",
  ].join("\n");
  const out = parseZeroContextDiff(patch);
  assert.deepEqual(out.get("docs/café.md")?.lines, [3, 4, 11, 12]);
  assert.match(out.get("docs/café.md")?.text.join("\n") || "", /old REQ-007/);
  assert.match(out.get("spec.md")?.text.join("\n") || "", /REQ-009/);
  assert.equal(unquoteGitPath('"a\\tb"'), "a\tb");
});
