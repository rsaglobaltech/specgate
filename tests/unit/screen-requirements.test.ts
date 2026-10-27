"use strict";

/**
 * REQ-199 — a requirement used on a screen needs an end-to-end test.
 *
 * Twenty requirements of the form "WHEN the Fahrschüler taps …, THEN they see
 * …" passed the harness with a use case and a unit test and no screen at all:
 * the gate only asked that some test name the requirement.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  requirementSurfaces,
  onScreen,
  e2eTestsNaming,
} = require("../../scripts/lib/screen-requirements");
const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
const { AgentPrompt } = require("../../packages/core/src/domain/AgentPrompt");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-screen-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w(
    "docs/brief.md",
    "---\nactors:\n  - { name: Fahrschüler, surfaces: [web] }\n  - { name: Sistema, surfaces: [api] }\n---\n\n# Brief\n"
  );
  w(
    "docs/specs/capabilities/diario/spec.md",
    [
      "# diario",
      "",
      "### Requirement: REQ-022 — Registrar una clase",
      "",
      "The system SHALL let the Fahrschüler record a class.",
      "",
      "<!-- specgate:trace actor=Fahrschüler kind=functional status=Draft -->",
      "",
      "### Requirement: REQ-023 — Exportar",
      "",
      "The system SHALL export the diary.",
      "",
      "<!-- specgate:trace actor=Sistema kind=functional status=Draft -->",
      "",
      "### Requirement: REQ-024 — Ruta",
      "",
      "The system SHALL keep the route.",
      "",
      "<!-- specgate:trace actor=Sistema surfaces=mobile kind=functional status=Draft -->",
      "",
    ].join("\n")
  );
  w("apps/web/e2e/diario.spec.ts", "test('REQ-022 SCN-060: registrar', () => {});\n");
  return dir;
}

test("REQ-199 SCN-199a: a requirement is on a screen by its own surfaces or its actor's", () => {
  const dir = project();
  try {
    assert.deepEqual(requirementSurfaces(dir, "REQ-022"), ["web"]);
    assert.equal(onScreen(dir, "REQ-022"), true, "the actor uses the web");
    assert.equal(onScreen(dir, "REQ-023"), false, "an api actor");
    assert.equal(onScreen(dir, "REQ-024"), true, "its own surfaces=mobile wins over the actor");
    assert.deepEqual(e2eTestsNaming(dir, "apps/web/e2e", "REQ-022"), [
      "apps/web/e2e/diario.spec.ts",
    ]);
    assert.deepEqual(e2eTestsNaming(dir, "apps/web/e2e", "REQ-024"), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-199 SCN-199a: e2e_dir is read from harness.config.yaml", () => {
  const dir = project();
  try {
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      "harness_version: 1\ne2e_dir: apps/web/e2e\n"
    );
    assert.equal(readHarnessConfig(dir).e2eDir, "apps/web/e2e");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-199 SCN-199b: the prompt of a screen requirement asks for the e2e test", () => {
  const prompt = AgentPrompt.build({ requirement: "REQ-022" }, { e2eDir: "apps/web/e2e" });
  assert.match(prompt, /end-to-end test under `apps\/web\/e2e` whose name or content says REQ-022/);
  assert.doesNotMatch(AgentPrompt.build({ requirement: "REQ-023" }, {}), /end-to-end test under/);
});

test("REQ-199 SCN-199c: the gate fails a screen requirement no e2e test names, and passes once one does", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-screen-run-"));
  try {
    const init = spawnSync(
      process.execPath,
      [CLI, "init", "--yes", "--out", parent, "--no-git", "--keep-matrix"],
      {
        encoding: "utf8",
      }
    );
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const dir = path.join(parent, fs.readdirSync(parent)[0]);
    const spec = path.join(dir, "spec.md");
    fs.writeFileSync(
      spec,
      fs
        .readFileSync(spec, "utf8")
        .split("\n")
        .filter((l: string) => !l.includes("REQ-001"))
        // The starter requirement carries no trace comment: give it one that
        // puts it on the web.
        .map((l: string) =>
          l.startsWith("### REQ-000")
            ? `${l}\n\n<!-- specgate:trace surfaces=web kind=functional -->`
            : l
        )
        .join("\n")
    );
    fs.appendFileSync(path.join(dir, "harness.config.yaml"), "\ne2e_dir: e2e\n");
    const git = (...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
    const agent = (files: Array<[string, string]>) => {
      const f = path.join(parent, `agent-${files.length}.js`);
      fs.writeFileSync(
        f,
        `const fs=require("fs"),p=require("path");for(const [r,c] of ${JSON.stringify(files)}){fs.mkdirSync(p.dirname(r),{recursive:true});fs.writeFileSync(r,c);}\n`
      );
      return `"${process.execPath}" "${f}" {prompt_file}`;
    };
    const run = (a: string) =>
      spawnSync(
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
          a,
          "--max-attempts",
          "1",
          "--skip-baseline",
          "--force",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, NO_COLOR: "1" },
        }
      );
    const red = run(agent([["src/health.js", "// REQ-000\nmodule.exports = 1;\n"]]));
    assert.match(
      red.stdout + red.stderr,
      /No file under e2e names REQ-000/,
      red.stdout + red.stderr
    );
    const green = run(
      agent([
        ["src/health.js", "// REQ-000\nmodule.exports = 1;\n"],
        ["e2e/health.spec.js", "// REQ-000 SCN-000: the health page answers\n"],
      ])
    );
    assert.doesNotMatch(
      green.stdout + green.stderr,
      /No file under e2e names REQ-000/,
      green.stdout + green.stderr
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
