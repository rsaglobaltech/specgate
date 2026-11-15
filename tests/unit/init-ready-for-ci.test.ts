/**
 * init-ready-for-ci: a project checked by CI from its first push, as fully as
 * specgate can, the person deciding what to take out (REQ-455 … REQ-464).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cliFromRoot as cli } from "../helpers/cli";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const PKG = require(path.join(ROOT_DIR, "package.json")) as { name: string; version: string };
const PINNED = `${PKG.name}@${PKG.version}`;
const GATE = ".github/workflows/spec-gate.yml";
const OLD = ".github/workflows/specs.yml";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sg-init-ci-"));
}

/** `specgate init --config` with these keys; returns the project folder. */
function init(parent: string, keys: Record<string, string>, ...flags: string[]): string {
  const config = path.join(parent, "project.yaml");
  const all = {
    PROJECT_NAME: "Shop",
    PROJECT_SLUG: "shop",
    PROJECT_TYPE: "backend",
    DOMAIN: "general",
    STACK: "Node.js 22, TypeScript",
    API_STYLE: "REST",
    TESTING: "node:test",
    ARCHITECTURE: "minimal",
    ...keys,
  };
  fs.writeFileSync(
    config,
    Object.entries(all)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n") + "\n"
  );
  const r = cli("init", "--config", config, "--out", parent, "--no-git", "--no-agents", ...flags);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, all.PROJECT_SLUG);
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const exists = (dir: string, rel: string) => fs.existsSync(path.join(dir, rel));

/** The `specgate init` of an older release: specs.yml with `validate .` on latest. */
const OLD_SPECS_YML = [
  "name: Spec Validation",
  "on:",
  "  pull_request:",
  "    branches: [main, develop]",
  "jobs:",
  "  validate-specs:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - run: npm install -g @rsaglobaltech/specgate@latest",
  "      - run: specgate validate .",
  "",
].join("\n");

// ── REQ-455: init installs the full gate, not specs.yml ─────────────────

test("REQ-455 SCN-455a: a new project gets spec-gate.yml running a pinned `check`, and no specs.yml", () => {
  const parent = tmp();
  try {
    const dir = init(parent, { PROJECT_TYPE: "backend" });
    assert.ok(exists(dir, GATE), "spec-gate.yml written");
    assert.ok(!exists(dir, OLD), "no specs.yml");
    assert.ok(read(dir, GATE).includes(`npx ${PINNED} check .`), "the gate runs the pinned check");
    assert.doesNotMatch(read(dir, GATE), /@latest/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-455: --no-ci writes no CI file", () => {
  const parent = tmp();
  try {
    const dir = init(parent, {}, "--no-ci");
    assert.ok(!exists(dir, GATE));
    assert.ok(!exists(dir, OLD));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-455: adopt writes the gate too, and leaves one that exists", () => {
  const dir = tmp();
  try {
    fs.writeFileSync(
      path.join(dir, "package.json"),
      '{ "name": "app", "scripts": { "test": "node --test" } }\n'
    );
    let r = cli("adopt", "--project-dir", dir, "--no-agents");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(exists(dir, GATE), "adopt wrote spec-gate.yml");
    fs.writeFileSync(path.join(dir, GATE), "# mine\n");
    fs.rmSync(path.join(dir, "spec.md"));
    r = cli("adopt", "--project-dir", dir, "--no-agents");
    assert.equal(read(dir, GATE), "# mine\n", "an existing gate is never overwritten");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-456: the gate is green on a project just created ────────────────

test("REQ-456 SCN-456a: on a project just created, the gate's command passes and says how to configure the tests", () => {
  const parent = tmp();
  try {
    const dir = init(parent, {});
    const gate = /npx \S+ (check \.[^\n]*)/.exec(read(dir, GATE));
    assert.ok(gate, "the gate runs check");
    const args = gate[1]
      .replace(/ --base .*$/, "")
      .trim()
      .split(/\s+/);
    const r = cli(...args.map((a) => (a === "." ? dir : a)));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /config set test_cmd/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-456: an unconfigured quality step says so and how, and does not fail", () => {
  const parent = tmp();
  try {
    const gate = read(init(parent, {}), GATE);
    assert.match(gate, /specgate quality init/);
    assert.match(gate, /not configured/i);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-457: each step says what it checks and how to remove it ─────────

test("REQ-457 SCN-457a: every step and the matrix are explained in the YAML, with what to delete", () => {
  const parent = tmp();
  try {
    const lines = read(init(parent, {}), GATE).split("\n");
    const steps = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /^\s+- (name|uses|run):/.test(l));
    assert.ok(steps.length >= 5, "the gate has its steps");
    for (const { l, i } of steps) {
      assert.match(lines[i - 1] ?? "", /^\s*#/, `no comment above: ${l.trim()}`);
    }
    assert.match(lines.join("\n"), /# Remove:/);
    const matrix = lines.findIndex((l) => /^\s+matrix:/.test(l));
    const above = lines.slice(Math.max(0, matrix - 6), matrix).join("\n");
    assert.match(above, /Ubuntu, macOS and Windows/);
    assert.match(above, /delete `macos-latest` and `windows-latest`/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-458: more validations by default ────────────────────────────────

test("REQ-458 SCN-458a: the ids against the base branch, on Ubuntu, macOS and Windows; drift, plan and quality", () => {
  const dir = tmp();
  try {
    const r = cli("ci", "init", "--provider", "github", "--project-dir", dir, "--stdout");
    assert.equal(r.status, 0, r.stderr);
    const gate = r.stdout;
    assert.match(gate, /os: \[ubuntu-latest, macos-latest, windows-latest\]/);
    assert.match(gate, /runs-on: \$\{\{ matrix\.os \}\}/);
    assert.match(gate, /fetch-depth: 0/);
    assert.match(
      gate,
      /check \. --base origin\/\$\{\{ github\.base_ref \|\| github\.event\.repository\.default_branch \}\}/
    );
    assert.match(gate, /validate \. --against-lock/);
    assert.match(gate, /plan --project-dir \. --format json/);
    assert.match(gate, /quality run --stage ci/);
    assert.match(gate, /if: matrix\.os == 'ubuntu-latest'/, "quality where Docker runs");
    assert.match(gate, /shell: bash/, "the same shell on Windows");
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(gate), "no unresolved template tokens");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-459: a minimal gate ─────────────────────────────────────────────

test("REQ-459 SCN-459a: --minimal is one job on Ubuntu whose only specgate step is check", () => {
  const dir = tmp();
  try {
    const r = cli("ci", "init", "--provider", "github", "--minimal", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const gate = read(dir, GATE);
    assert.equal((gate.match(/runs-on:/g) || []).length, 1);
    assert.match(gate, /runs-on: ubuntu-latest/);
    const steps = gate.match(/@rsaglobaltech\/specgate@\S+ (\w+)/g) || [];
    assert.deepEqual(
      steps.map((s) => s.split(" ")[1]),
      ["check"]
    );
    assert.ok(gate.includes(PINNED));
    assert.doesNotMatch(gate, /matrix|against-lock|quality run/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-460: ci status ──────────────────────────────────────────────────

test("REQ-460 SCN-460a: ci status on an old specs.yml — the specification present, the rest missing with how to add it", () => {
  const dir = tmp();
  try {
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(dir, OLD), OLD_SPECS_YML);
    const r = cli("ci", "status", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stderr);
    const status = JSON.parse(r.stdout) as {
      file: string;
      checks: Array<{ id: string; present: boolean; add?: string }>;
    };
    assert.equal(status.file, OLD);
    const by = Object.fromEntries(status.checks.map((c) => [c.id, c]));
    assert.equal(by.specification?.present, true);
    for (const id of ["tests", "architecture", "systems", "base", "drift", "plan"]) {
      assert.equal(by[id]?.present, false, id);
      assert.match(by[id]?.add ?? "", /specgate ci init/, id);
    }
    const text = cli("ci", "status", "--project-dir", dir);
    assert.match(text.stdout, /missing/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-460: ci status on the full gate — everything present", () => {
  const parent = tmp();
  try {
    const dir = init(parent, {});
    const r = cli("ci", "status", "--project-dir", dir, "--json");
    const status = JSON.parse(r.stdout) as { checks: Array<{ id: string; present: boolean }> };
    assert.deepEqual(
      status.checks.filter((c) => !c.present).map((c) => c.id),
      []
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-461: an old specs.yml replaced only after showing the difference ─

test("REQ-461 SCN-461a: without --replace, the difference is shown, nothing is written, and --replace is named", () => {
  const dir = tmp();
  try {
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(dir, OLD), OLD_SPECS_YML);
    const r = cli("ci", "init", "--provider", "github", "--project-dir", dir);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /tests/);
    assert.match(r.stdout + r.stderr, /specgate ci init --provider github --replace/);
    assert.ok(!exists(dir, GATE));
    assert.equal(read(dir, OLD), OLD_SPECS_YML);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-461: with --replace, spec-gate.yml replaces specs.yml", () => {
  const dir = tmp();
  try {
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(dir, OLD), OLD_SPECS_YML);
    const r = cli("ci", "init", "--provider", "github", "--replace", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(exists(dir, GATE));
    assert.ok(!exists(dir, OLD));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-462: the README names only what was written ─────────────────────

test("REQ-462 SCN-462a: a layered project's README lists use-cases.md, none of the skipped documents, and `specgate check`", () => {
  const parent = tmp();
  try {
    const readme = read(init(parent, { ARCHITECTURE: "layered" }), "README.md");
    assert.match(readme, /docs\/specs\/use-cases\.md/);
    for (const doc of [
      "domain-model.md",
      "commands.md",
      "events.md",
      "aggregates.md",
      "status-model.md",
      "AI_RULES.md",
    ]) {
      assert.ok(!readme.includes(doc), doc);
    }
    assert.match(readme, /specgate check/);
    assert.doesNotMatch(readme, /validate_specs\.sh/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-462: a tactical-ddd project's README lists its domain documents", () => {
  const parent = tmp();
  try {
    const readme = read(init(parent, { ARCHITECTURE: "tactical-ddd" }), "README.md");
    for (const doc of [
      "domain-model.md",
      "use-cases.md",
      "commands.md",
      "events.md",
      "aggregates.md",
      "status-model.md",
    ]) {
      assert.ok(readme.includes(doc), doc);
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-463: the container scaffold only for a service ──────────────────

test("REQ-463 SCN-463a: a desktop project has no container scaffold, and its runtime is a local app", () => {
  const parent = tmp();
  try {
    const dir = init(parent, { PROJECT_TYPE: "desktop", STACK: "Tauri 2, TypeScript" });
    for (const f of [
      ".env.dev",
      ".env.feature",
      ".env.prod",
      "docker-compose.yml",
      ".dockerignore",
      ".devcontainer",
    ]) {
      assert.ok(!exists(dir, f), f);
    }
    const runtime = read(dir, "docs/specs/runtime-environments.md");
    assert.match(runtime, /on the person's device/);
    assert.doesNotMatch(runtime, /docker compose/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("REQ-463: a mobile project has none either; a backend keeps its compose file", () => {
  const parent = tmp();
  try {
    const mobile = init(parent, { PROJECT_TYPE: "mobile", PROJECT_SLUG: "app" });
    assert.ok(!exists(mobile, "docker-compose.yml"));
    assert.ok(!exists(mobile, ".env.dev"));
    const backend = init(parent, { PROJECT_TYPE: "backend", PROJECT_SLUG: "api" });
    assert.ok(exists(backend, "docker-compose.yml"));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ── REQ-464: a project type for desktop apps ────────────────────────────

test("REQ-464 SCN-464a: a Tauri app — AGENTS.md says desktop project and names installers and auto-update", () => {
  const parent = tmp();
  try {
    const agents = read(
      init(parent, { PROJECT_TYPE: "desktop", STACK: "Tauri 2, TypeScript" }),
      "AGENTS.md"
    );
    assert.match(agents, /desktop project/);
    assert.match(agents, /installer/i);
    assert.match(agents, /auto-update/i);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
