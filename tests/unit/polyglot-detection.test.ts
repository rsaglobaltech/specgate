"use strict";

/**
 * The gaps a Python adoption found (round 3, nimbus-billing).
 *
 * `onboard`/`adopt` reported `detected from none` with `pyproject.toml` in the
 * root, so `Stack: unknown` propagated into spec.md, AI_RULES.md and every
 * capability proposal — while `harness init`, in the same directory, wrote
 * `test_cmd: pytest`. Phase 2.3 unified the test command and left the stack
 * detection behind it, which is half a fix wearing the look of a whole one.
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
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

function repo(files: Record<string, string>) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-poly-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/a.txt"), "x\n");
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body);
  }
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"], {
    cwd: dir,
  });
  return { parent, dir };
}

const CASES: Array<[string, Record<string, string>, RegExp, string]> = [
  [
    "Python via pyproject",
    { "pyproject.toml": '[project]\nname = "flask"\ndependencies = ["flask"]\n' },
    /Python/,
    "pytest",
  ],
  [
    "Python via setup.py",
    { "setup.py": 'from setuptools import setup\nsetup(name="pkg")\n' },
    /Python/,
    "pytest",
  ],
  ["Rust", { "Cargo.toml": '[package]\nname = "p"\n' }, /Rust/, "cargo test"],
  [".NET", { "App.csproj": "<Project/>\n" }, /\.NET/, "dotnet test"],
];

for (const [label, files, stack, testCmd] of CASES) {
  test(`adopt identifies ${label}`, () => {
    const { parent, dir } = repo(files);
    try {
      const r = cli("adopt", "--project-dir", dir);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.doesNotMatch(r.stdout, /Stack: unknown/, r.stdout);
      const rules = fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8");
      assert.match(rules, stack, `AI_RULES should name the stack:\n${rules.slice(0, 400)}`);
      assert.ok(rules.includes(testCmd), `AI_RULES should name \`${testCmd}\``);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
}

test("tox wins over pytest when the project runs its suite through tox", () => {
  // Saying `pytest` where a `tox.ini` exists is a guess that fails on the
  // first run.
  const { parent, dir } = repo({
    "pyproject.toml": '[project]\nname = "pkg"\n',
    "tox.ini": "[tox]\nenvlist = py311\n",
  });
  try {
    assert.equal(cli("adopt", "--project-dir", dir).status, 0);
    assert.match(fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8"), /\btox\b/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("adopt and harness init agree about the same Python project", () => {
  // They used to disagree out loud: "no build manifest found" from one,
  // `test_cmd: pytest` from the other, in the same directory.
  const { parent, dir } = repo({ "pyproject.toml": '[project]\nname = "pkg"\n' });
  try {
    assert.equal(cli("adopt", "--project-dir", dir).status, 0);
    assert.equal(cli("harness", "init", "--project-dir", dir).status, 0);

    const rules = fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8");
    const config = fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
    const effective = config
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");

    assert.match(rules, /pytest/);
    assert.match(effective, /test_cmd:\s*"pytest"/);
    assert.doesNotMatch(rules, /Testing: unknown/, "AI_RULES must not contradict itself");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── req link and validate must agree about a value one of them wrote ─────────

test("a test selector is accepted by req link and by validate", () => {
  // `req link --test "tests/x.py::test_y"` was accepted, then validate
  // rejected the same string as declared_artifact_missing.
  const { parent, dir } = repo({ "pyproject.toml": '[project]\nname = "pkg"\n' });
  try {
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src/config.py"), "def c(): pass\n");
    fs.writeFileSync(path.join(dir, "tests/test_config.py"), "def test_c(): pass\n");
    assert.equal(cli("adopt", "--project-dir", dir).status, 0);

    const added = cli("req", "add", "Config is loaded from a Python object", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(added.stdout)[1];
    assert.equal(
      cli(
        "req",
        "link",
        reqId,
        "--code",
        "src/config.py",
        "--test",
        "tests/test_config.py::test_c",
        "--project-dir",
        dir
      ).status,
      0
    );

    const ok = cli("validate", dir, "--strict");
    assert.equal(
      ok.status,
      0,
      `validate must accept what req link wrote:\n${ok.stdout}${ok.stderr}`
    );

    // And a selector on a file that is genuinely absent still fails.
    cli("req", "link", reqId, "--test", "tests/nope.py::test_c", "--project-dir", dir);
    assert.equal(cli("validate", dir, "--strict").status, 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("doctor says what it checked, not that scenarios run", () => {
  // `doctor` reported "every scenario runnable" from a Gherkin quality check,
  // in a project where the harness prompt said nothing executes a .feature.
  const { parent, dir } = repo({ "pyproject.toml": '[project]\nname = "pkg"\n' });
  try {
    assert.equal(cli("adopt", "--project-dir", dir).status, 0);
    const out = cli("doctor", "--project-dir", dir).stdout;
    assert.match(out, /well-formed/);
    assert.doesNotMatch(out, /scenario runnable/);
    assert.match(out, /no Gherkin runner here/, "and it says nothing executes them");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── Round 3, orbit-inventory ─────────────────────────────────────────────────

test("a requirement with no feature file gets an instruction, not a dash", () => {
  // `req add` writes `-` in the Feature file column by design, and the prompt
  // rendered it as a filename: "The feature file `-` does not exist yet.
  // Create it." Every requirement made the documented way hit that, and an
  // evaluator stopped rather than pay an agent to find out what a file called
  // `-` was meant to be.
  const { parent, dir } = repo({
    "package.json": '{"name":"x","version":"1.0.0","scripts":{"test":"echo ok"}}',
  });
  try {
    assert.equal(cli("adopt", "--project-dir", dir).status, 0);
    const added = cli("req", "add", "res.redirect issues a 302", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(added.stdout)[1];

    const prompt = cli("harness", "prompt", reqId, "--project-dir", dir);
    assert.equal(prompt.status, 0, prompt.stdout + prompt.stderr);

    assert.doesNotMatch(prompt.stdout, /feature file `-`/, "the dash is not a filename");
    assert.match(prompt.stdout, /declares no feature file/);
    assert.match(prompt.stdout, /features\/<area>/, "say where to put it");
    assert.match(prompt.stdout, new RegExp(`@${reqId}`), "and how to tag it");
    assert.match(prompt.stdout, /req link/, "and how to record it");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("the tag convention the validator enforces is the one the docs teach", () => {
  // Tagging `@REQ-004` alone fails, because the matrix matches `@SCN-NNN`.
  // That is defensible and was untaught: the only tag prose in the docs
  // mentioned @REQ-NNN, and an evaluator lost a run to it.
  const guide = fs.readFileSync(path.join(ROOT_DIR, "docs/writing-specs.md"), "utf8");
  assert.match(guide, /@REQ-\d+ @SCN-\d+/, "show both tags together");
  assert.match(guide, /`@SCN-NNN` is the one the gate matches/i);
  assert.match(guide, /no tags at all is left alone/i, "and that tagging is optional");
});

test("the docs index describes the deployment page it actually links to", () => {
  const { NAV } = require("../../scripts/docs/nav");
  const blurbs: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.blurb && node.href && String(node.href).includes("deployment")) {
      blurbs.push(node.blurb);
    }
    for (const v of Object.values(node)) if (typeof v === "object") walk(v);
  };
  walk(NAV);
  for (const blurb of blurbs) {
    assert.doesNotMatch(
      blurb,
      /generated project expects to be deployed/i,
      "deployment.md is about publishing specgate itself, not the user's project"
    );
  }
});
