"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
const { spawnSync } = require("node:child_process");

const {
  WIZARD_FIELDS,
  slugify,
  defaultAnswers,
  validateAnswer,
  renderConfigYaml,
  runInitWizard,
} = require("../../scripts/cli/commands/project/WizardCommand");
const { parseYamlLite } = require("../../packages/core/src/domain/YamlLite");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function withTmp(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csda-wizard-"));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── slugify ───────────────────────────────────────────────────────────────────

test("slugify lowercases and dashes non-alphanumerics", () => {
  assert.equal(slugify("My Spec-Driven App"), "my-spec-driven-app");
  assert.equal(slugify("  Acme  Energy Hub! "), "acme-energy-hub");
  assert.equal(slugify("HIE/HIS Platform"), "hie-his-platform");
});

test("slugify falls back to a valid default on empty input", () => {
  assert.equal(slugify(""), "my-spec-driven-app");
  assert.equal(slugify("!!!"), "my-spec-driven-app");
});

// ── defaultAnswers ────────────────────────────────────────────────────────────

test("defaultAnswers covers every required init key", () => {
  const answers = defaultAnswers();
  for (const key of [
    "PROJECT_NAME",
    "PROJECT_SLUG",
    "PROJECT_TYPE",
    "DOMAIN",
    "STACK",
    "API_STYLE",
    "TESTING",
  ]) {
    assert.ok(answers[key], `missing ${key}`);
  }
  assert.match(answers.PROJECT_SLUG, /^[a-z0-9][a-z0-9-]*$/);
  assert.equal(answers.PROJECT_TYPE, "backend");
});

// ── validateAnswer ────────────────────────────────────────────────────────────

test("validateAnswer rejects a bad slug with an actionable message", () => {
  const slugField = WIZARD_FIELDS.find((f) => f.key === "PROJECT_SLUG");
  const error = validateAnswer(slugField, "Bad Slug!");
  assert.match(error, /lowercase letters, numbers, and dashes/);
  assert.equal(validateAnswer(slugField, "good-slug"), null);
});

test("validateAnswer rejects an unknown project type", () => {
  // `mobile` used to be the example of an invalid type here. It is a supported
  // one now, which is why this assertion had to change rather than the code.
  const typeField = WIZARD_FIELDS.find((f) => f.key === "PROJECT_TYPE");
  assert.match(validateAnswer(typeField, "desktop"), /backend, frontend, mobile/);
  assert.equal(validateAnswer(typeField, "frontend"), null);
  assert.equal(validateAnswer(typeField, "mobile"), null);
});

// ── renderConfigYaml ──────────────────────────────────────────────────────────

test("renderConfigYaml round-trips through the YAML parser", () => {
  const answers = defaultAnswers();
  answers.PROJECT_NAME = "Colon: y #comentario";
  const parsed = parseYamlLite(renderConfigYaml(answers));
  assert.equal(parsed.PROJECT_NAME, "Colon: y #comentario");
  assert.equal(parsed.PROJECT_SLUG, answers.PROJECT_SLUG);
  assert.equal(parsed.PROJECT_TYPE, "backend");
  // Empty MODULES is omitted, not serialized as an empty value.
  assert.ok(!("MODULES" in parsed));
});

// ── runInitWizard (injected question fn, no TTY needed) ──────────────────────

function fakeIo(lines) {
  const pending = [...lines];
  let written = "";
  const output = new Writable({
    write(chunk, _enc, cb) {
      written += chunk.toString();
      cb();
    },
  });
  const question = async (prompt) => {
    written += prompt;
    if (pending.length === 0) throw new Error("wizard asked more questions than answers given");
    return pending.shift();
  };
  return { question, output, getOutput: () => written };
}

test("runInitWizard accepts defaults on empty input", async () => {
  const io = fakeIo(WIZARD_FIELDS.map(() => ""));
  const answers = await runInitWizard(io);
  assert.deepEqual(answers, defaultAnswers());
});

test("runInitWizard re-asks on invalid input until valid", async () => {
  const lines = [];
  for (const field of WIZARD_FIELDS) {
    if (field.key === "PROJECT_SLUG") {
      lines.push("Bad Slug!"); // rejected → re-ask
      lines.push("acme-hub");
    } else {
      lines.push("");
    }
  }
  const io = fakeIo(lines);
  const answers = await runInitWizard(io);
  assert.equal(answers.PROJECT_SLUG, "acme-hub");
  assert.match(io.getOutput(), /✖ .*lowercase letters/);
});

test("runInitWizard applies custom answers and derives the slug default", async () => {
  const lines = WIZARD_FIELDS.map((field) =>
    field.key === "PROJECT_NAME" ? "HIE HIS Platform" : ""
  );
  const io = fakeIo(lines);
  const answers = await runInitWizard(io);
  assert.equal(answers.PROJECT_NAME, "HIE HIS Platform");
  assert.equal(answers.PROJECT_SLUG, "hie-his-platform");
});

// ── end-to-end via the CLI ────────────────────────────────────────────────────

test("init --yes scaffolds a valid project with zero other flags", () => {
  withTmp((tmp) => {
    const r = cli("init", "--yes", "--out", tmp, "--no-git");
    assert.equal(r.status, 0, r.stderr);

    const projectDir = path.join(tmp, "my-spec-driven-app");
    assert.ok(fs.existsSync(path.join(projectDir, "spec.md")));
    assert.ok(fs.existsSync(path.join(projectDir, "AI_RULES.md")));

    // Wizard/--yes runs persist their config for reproducibility.
    const savedConfig = path.join(projectDir, "project.yaml");
    assert.ok(fs.existsSync(savedConfig));
    const parsed = parseYamlLite(fs.readFileSync(savedConfig, "utf8"));
    assert.equal(parsed.PROJECT_SLUG, "my-spec-driven-app");

    const v = cli("validate", projectDir);
    assert.equal(v.status, 0, v.stdout + v.stderr);
  });
});

function cliIn(cwd, ...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, encoding: "utf8" });
}

test("init without config outside a terminal fails with a remedy", () => {
  // In an empty directory: this repository has a package.json, and plain
  // `init` adopts a directory that already has code.
  withTmp((tmp) => {
    const r = cliIn(tmp, "init", "--no-git");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--config is required when not running in a terminal/);
    assert.match(r.stdout, /interactive wizard/);
    assert.match(r.stdout, /--yes/);
  });
});

test("plain init in a repository with code adopts it in place", () => {
  // Phase 1 of mejoras/plan-simplificacion-equipo.md: one entry command.
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "package.json"), '{"name":"shop"}');
    const r = cliIn(tmp, "init");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Existing code found \(package\.json\)/);
    assert.ok(fs.existsSync(path.join(tmp, "spec.md")), "adopted in place");
    assert.ok(fs.existsSync(path.join(tmp, "docs/specs/traceability.md")));

    const again = cliIn(tmp, "init");
    assert.equal(again.status, 0, "running init twice is not an error");
    assert.match(again.stdout, /already spec-driven/);
  });
});

test("init --new and every scaffold flag keep scaffolding where code exists", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "package.json"), '{"name":"shop"}');
    const r = cliIn(tmp, "init", "--new", "--yes", "--no-git", "--dry-run");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /adopting this repository/);
    assert.ok(!fs.existsSync(path.join(tmp, "spec.md")), "nothing adopted");

    const y = cliIn(tmp, "init", "--yes", "--no-git", "--dry-run");
    assert.doesNotMatch(y.stdout, /adopting this repository/, "--yes keeps its meaning");
  });
});

test("init --config without --out defaults to the current directory", () => {
  withTmp((tmp) => {
    const config = [
      "PROJECT_NAME: Out Default",
      "PROJECT_SLUG: out-default",
      "PROJECT_TYPE: backend",
      "DOMAIN: testing",
      "STACK: Node.js 20",
      "API_STYLE: REST",
      "TESTING: node:test",
    ].join("\n");
    const configPath = path.join(tmp, "project.yaml");
    fs.writeFileSync(configPath, config, "utf8");

    // cli() pins cwd to the repo root — spawn directly to control cwd.
    const rr = spawnSync(process.execPath, [CLI_PATH, "init", "--config", configPath, "--no-git"], {
      cwd: tmp,
      encoding: "utf8",
    });
    assert.equal(rr.status, 0, rr.stderr);
    assert.match(rr.stdout, /No --out given/);
    assert.ok(fs.existsSync(path.join(tmp, "out-default", "spec.md")));
  });
});
