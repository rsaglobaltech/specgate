"use strict";

/**
 * Artefact schemas: the graph a change follows.
 *
 * The property worth protecting is that the semantics do not change with the
 * graph. Whatever artefacts a team declares, `requires` stays an enabler and
 * never becomes a gate (ADR-0018).
 */

const { test } = require("node:test");
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
  BUILT_IN,
  toYaml,
  parseYaml,
  validateSchema,
  findCycle,
  resolveSchema,
  listSchemas,
} = require("../../scripts/schema/registry");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "schema-"));
  const r = cli(
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  try {
    fn(path.join(root, "acme-energy-hub"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("both built-in schemas are sound graphs", () => {
  for (const [name, schema] of Object.entries(BUILT_IN)) {
    assert.deepEqual(validateSchema(schema), [], `${name} should have no problems`);
  }
});

test("bdd-first puts the scenario before the spec", () => {
  const specs = BUILT_IN["bdd-first"].artifacts.find((a) => a.id === "specs");
  assert.deepEqual(specs.requires, ["feature"], "the spec explains a scenario that exists");
  const feature = BUILT_IN["bdd-first"].artifacts.find((a) => a.id === "feature");
  assert.deepEqual(feature.requires, ["proposal"]);
});

test("a schema survives the YAML round trip", () => {
  // The emitter and parser are hand-rolled to keep the zero-dependency promise,
  // so they have to agree with each other.
  for (const schema of Object.values(BUILT_IN) as any[]) {
    const parsed = parseYaml(toYaml(schema));
    assert.equal(parsed.name, schema.name);
    assert.equal(parsed.artifacts.length, schema.artifacts.length);
    for (let i = 0; i < schema.artifacts.length; i++) {
      assert.equal(parsed.artifacts[i].id, schema.artifacts[i].id);
      assert.equal(parsed.artifacts[i].generates, schema.artifacts[i].generates);
      assert.deepEqual(parsed.artifacts[i].requires, schema.artifacts[i].requires);
    }
  }
});

test("a dependency on an undeclared artefact is caught", () => {
  // Left unchecked it silently marks every dependent artefact blocked forever,
  // which reads as the tool being broken rather than the schema being wrong.
  const problems = validateSchema({
    name: "broken",
    artifacts: [{ id: "tasks", generates: "tasks.md", requires: ["ghost"] }],
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, "artifact_unknown_dependency");
});

test("a cycle is caught and named", () => {
  const problems = validateSchema({
    name: "circular",
    artifacts: [
      { id: "a", generates: "a.md", requires: ["b"] },
      { id: "b", generates: "b.md", requires: ["a"] },
    ],
  });
  assert.ok(problems.some((p) => p.code === "artifact_cycle"));
  assert.ok(
    findCycle([
      { id: "a", generates: "a.md", requires: ["b"] },
      { id: "b", generates: "b.md", requires: ["a"] },
    ])
  );
});

test("duplicate ids and missing outputs are caught", () => {
  const problems = validateSchema({
    name: "sloppy",
    artifacts: [
      { id: "a", generates: "a.md", requires: [] },
      { id: "a", generates: "", requires: [] },
    ],
  });
  const codes = problems.map((p) => p.code);
  assert.ok(codes.includes("artifact_duplicate_id"));
  assert.ok(codes.includes("artifact_no_output"));
});

test("a project fork shadows the built-in of the same name", () => {
  withProject((dir) => {
    assert.equal(resolveSchema(dir, "bdd-first").source, "built-in");
    assert.equal(cli("schema", "fork", "bdd-first", "bdd-first", "--project-dir", dir).status, 0);
    const found = resolveSchema(dir, "bdd-first");
    assert.equal(found.source, "project", "the fork wins once it exists");
    assert.match(found.path, /\.specgate[\\/]schemas/);
  });
});

test("fork refuses to clobber an existing schema", () => {
  withProject((dir) => {
    assert.equal(cli("schema", "fork", "spec-driven", "mine", "--project-dir", dir).status, 0);
    const again = cli("schema", "fork", "spec-driven", "mine", "--project-dir", dir, "--json");
    assert.equal(again.status, 1);
    assert.equal(JSON.parse(again.stdout).status[0].code, "schema_exists");
  });
});

test("a change follows the schema it declares", () => {
  withProject((dir) => {
    assert.equal(
      cli("change", "new", "add-pricing", "--schema", "bdd-first", "--project-dir", dir).status,
      0
    );
    const doc = JSON.parse(cli("change", "status", "--project-dir", dir, "--json").stdout);
    const ids = doc.artifacts.map((a) => a.id);
    assert.deepEqual(ids, ["proposal", "feature", "specs", "design", "tasks"]);

    // The scenario is not written yet, so the spec that explains it is blocked.
    const specs = doc.artifacts.find((a) => a.id === "specs");
    assert.equal(specs.status, "blocked");
    assert.deepEqual(specs.missingDeps, ["feature"]);
  });
});

test("a project's own .feature files do not satisfy a change's feature artefact", () => {
  // Every generated project already ships features/core/health.feature. Looking
  // at the project tree marked the artefact done before anyone wrote anything.
  withProject((dir) => {
    assert.ok(fs.existsSync(path.join(dir, "features/core/health.feature")));
    cli("change", "new", "add-pricing", "--schema", "bdd-first", "--project-dir", dir);
    const doc = JSON.parse(cli("change", "status", "--project-dir", dir, "--json").stdout);
    assert.equal(doc.artifacts.find((a) => a.id === "feature").status, "ready");
  });
});

test("instructions accept the artefacts of the change's schema, not the default", () => {
  withProject((dir) => {
    cli("change", "new", "add-pricing", "--schema", "bdd-first", "--project-dir", dir);
    const ok = cli("change", "instructions", "feature", "--project-dir", dir, "--json");
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.equal(JSON.parse(ok.stdout).instructions.artifact, "feature");

    // `feature` exists in bdd-first but not in spec-driven, so asking for it
    // against a spec-driven change is what proves the check is schema-aware
    // rather than a fixed list. A plain typo is caught earlier, by the
    // vocabulary pre-check.
    cli("change", "new", "add-billing", "--schema", "spec-driven", "--project-dir", dir);
    const bad = cli(
      "change",
      "instructions",
      "feature",
      "add-billing",
      "--project-dir",
      dir,
      "--json"
    );
    assert.equal(bad.status, 2);
    const fix = JSON.parse(bad.stdout).status[0].fix;
    assert.match(fix, /spec-driven/);
    assert.doesNotMatch(fix, /feature/);
  });
});

test("listSchemas includes forks alongside the built-ins", () => {
  withProject((dir) => {
    assert.deepEqual(listSchemas(dir), ["bdd-first", "spec-driven"]);
    cli("schema", "fork", "spec-driven", "team-flow", "--project-dir", dir);
    assert.deepEqual(listSchemas(dir), ["bdd-first", "spec-driven", "team-flow"]);
  });
});

test("an unknown schema falls back rather than breaking a change in flight", () => {
  // Deleting a schema file should not make existing changes unreadable.
  withProject((dir) => {
    cli("change", "new", "add-pricing", "--schema", "deleted-schema", "--project-dir", dir);
    const doc = JSON.parse(cli("change", "status", "--project-dir", dir, "--json").stdout);
    assert.deepEqual(
      doc.artifacts.map((a) => a.id),
      ["proposal", "specs", "design", "tasks"]
    );
  });
});
