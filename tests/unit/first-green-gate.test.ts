/**
 * REQ-610 … REQ-612: what stopped a team with code on its way to a first green
 * gate (first-use journey, 2026-11-20) — a Python job with nothing installed,
 * `apply` refusing twice, and a baseline that stayed pending for good.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { pythonInstall } from "../../scripts/cli/commands/config/CiToolchain";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(dir: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-green-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const PYPROJECT = '[project]\nname = "billing"\nversion = "0.1.0"\n';

// ── REQ-610: the Python job installs what the tests need ─────────────────────

test("REQ-610 SCN-610a: a pyproject with no build system and pytest as the test command", () => {
  const dir = project({ "pyproject.toml": PYPROJECT });
  assert.deepEqual(pythonInstall(dir, "pytest"), ["pip install pytest"]);
});

test("REQ-610 SCN-610b: requirements files, a build system and a test extra", () => {
  const dir = project({
    "requirements.txt": "requests==2.32.0\n",
    "requirements-dev.txt": "pytest==8.0.0\n",
    "pyproject.toml":
      PYPROJECT +
      '\n[project.optional-dependencies]\ndocs = ["mkdocs"]\ntest = ["pytest-cov"]\n' +
      '\n[build-system]\nrequires = ["setuptools"]\n',
  });
  assert.deepEqual(pythonInstall(dir, "pytest -q"), [
    "pip install -r requirements.txt",
    "pip install -r requirements-dev.txt",
    'pip install -e ".[test]"',
  ]);
  assert.deepEqual(
    pythonInstall(project({ "requirements.txt": "flask\n" }), "python -m unittest"),
    ["pip install -r requirements.txt"]
  );
});

test("REQ-610 SCN-610c: the generated workflow runs the install, and Poetry is told, not guessed", () => {
  const dir = project({
    "pyproject.toml": PYPROJECT,
    "tests/test_a.py": "def test_a():\n    pass\n",
  });
  assert.equal(run(dir, "ci", "init", "--provider", "github").status, 0);
  const workflow = fs.readFileSync(path.join(dir, ".github/workflows/spec-gate.yml"), "utf8");
  assert.match(workflow, /setup-python@v5[\s\S]*- run: \|\n\s+pip install pytest\n/);
  assert.doesNotMatch(workflow, /# Install what your tests need/);

  const poetry = project({
    "pyproject.toml":
      PYPROJECT +
      '\n[tool.poetry]\nname = "billing"\n\n[build-system]\nrequires = ["poetry-core"]\n',
  });
  assert.deepEqual(pythonInstall(poetry, "pytest"), []);
  assert.equal(run(poetry, "ci", "init", "--provider", "github").status, 0);
  assert.match(
    fs.readFileSync(path.join(poetry, ".github/workflows/spec-gate.yml"), "utf8"),
    /# poetry manages this project/
  );
});

// ── REQ-611, REQ-612: one refusal, and a baseline that is not a to-do ────────

function adopted(): string {
  const dir = project({
    "package.json": JSON.stringify({ name: "shop", scripts: { test: "node --test" } }),
    "src/total.js": "exports.total = (a, b) => a + b;\n",
    "test/total.test.js":
      'const test = require("node:test");\nconst assert = require("node:assert");\n' +
      'const { total } = require("../src/total");\n' +
      'test("REQ-002: a total adds its lines", () => assert.equal(total(1, 2), 3));\n',
  });
  assert.equal(run(dir, "adopt").status, 0);
  return dir;
}

test("REQ-611 SCN-611a: apply on a requirement fresh from new says both rewrites at once", () => {
  const dir = adopted();
  assert.equal(run(dir, "new", "A total adds its lines").status, 0);
  const refused = run(dir, "apply", "REQ-002");
  assert.notEqual(refused.status, 0);
  assert.match(refused.out, /scenario_placeholder_step/);
  assert.match(refused.out, /requirement_template_obligation/);

  const json = run(dir, "validate", ".", "--strict", "--delivering", "REQ-002", "--json");
  const codes = (JSON.parse(json.stdout).status as { code: string }[]).map((d) => d.code);
  assert.ok(codes.includes("scenario_placeholder_step"), codes.join());
  assert.ok(codes.includes("requirement_template_obligation"), codes.join());
});

test("REQ-611 SCN-611b: with both rewritten, apply delivers it", () => {
  const dir = adopted();
  run(dir, "new", "A total adds its lines");
  const feature = path.join(
    dir,
    "features",
    fs.readdirSync(path.join(dir, "features")).find((f) => f.endsWith(".feature")) as string
  );
  fs.writeFileSync(
    feature,
    fs
      .readFileSync(feature, "utf8")
      .replace(/Given <[^>]+>/, "Given lines of 1 and 2")
      .replace(/When <[^>]+>/, "When the total is computed")
      .replace(/Then <[^>]+>/, "Then it is 3")
  );
  const spec = path.join(dir, "spec.md");
  const text = fs.readFileSync(spec, "utf8");
  fs.writeFileSync(
    spec,
    text.slice(0, text.indexOf("The system MUST satisfy:")) +
      "The system MUST add the lines of a total.\n"
  );
  const applied = run(dir, "apply", "REQ-002");
  assert.equal(applied.status, 0, applied.out);

  // REQ-612: the baseline is said apart, and the count is of what can be closed.
  const status = run(dir, "status").out;
  assert.match(status, /1 of 1 done/);
  assert.match(
    status,
    /REQ-001 Preserve existing behaviour: your test suite holds it on every check/
  );
  assert.doesNotMatch(status, /To do/);
  assert.match(status, /every requirement written so far is delivered/);
});

test("REQ-612 SCN-612a: after adoption the baseline is not a to-do, and --json counts it as before", () => {
  const dir = adopted();
  const status = run(dir, "status").out;
  assert.match(status, /0 of 0 done/);
  assert.match(status, /REQ-001 Preserve existing behaviour: your test suite holds it/);
  assert.match(status, /To close it, name REQ-001 in a test that starts the product/);
  assert.doesNotMatch(status, /To do/);
  const doc = JSON.parse(run(dir, "status", "--json").stdout);
  assert.equal(doc.counts.total, 1);
});

test("REQ-612 SCN-612b: the first requirement of a project with no code stays a to-do", () => {
  const dir = project({});
  assert.equal(run(dir, "adopt").status, 0);
  const status = run(dir, "status").out;
  assert.match(status, /0 of 1 done/);
  assert.match(status, /To do/);
  assert.doesNotMatch(status, /your test suite holds it/);
});
