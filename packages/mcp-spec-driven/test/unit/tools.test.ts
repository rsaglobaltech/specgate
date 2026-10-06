"use strict";

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const CLI = path.join(REPO_ROOT, "bin/specgate.js");
const CONFIG = path.join(REPO_ROOT, "examples/project.config.example");

import {
  TOOLS,
  readSpec,
  listRequirements,
  updateTraceability,
  validateProject,
} from "../../src/tools";

function generateProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
  const r = spawnSync(
    process.execPath,
    [CLI, "init", "--config", CONFIG, "--out", tmp, "--no-git", "--force", "--keep-matrix"],
    { encoding: "utf8", cwd: REPO_ROOT }
  );
  assert.equal(r.status, 0, `init failed:\n${r.stdout}\n${r.stderr}`);
  return { tmp, projectDir: path.join(tmp, "acme-energy-hub") };
}

// ── TOOL REGISTRY ────────────────────────────────────────────────────────────────

test("TOOLS registry exposes the documented tools", () => {
  const names = Object.keys(TOOLS);
  assert.ok(names.includes("read_spec"));
  assert.ok(names.includes("list_requirements"));
  assert.ok(names.includes("update_traceability"));
  assert.ok(names.includes("lint_pack"));
  assert.ok(names.includes("validate_project"));
  assert.ok(names.includes("plan"));
  assert.ok(names.includes("mark_requirement_done"));
});

test("Every tool has description, inputSchema, and handler", () => {
  for (const [name, tool] of Object.entries(TOOLS) as [string, any][]) {
    assert.ok(
      typeof tool.description === "string" && tool.description.length > 10,
      `${name} description`
    );
    assert.ok(tool.inputSchema && tool.inputSchema.type === "object", `${name} inputSchema`);
    assert.ok(typeof tool.handler === "function", `${name} handler`);
  }
});

// ── read_spec ──────────────────────────────────────────────────────────────────────

test("read_spec returns spec.md content and lists docs/specs/*.md", () => {
  const { tmp, projectDir } = generateProject();
  try {
    const r = readSpec({ projectDir }) as any;
    assert.ok(r.specMd.length > 0, "specMd should not be empty");
    assert.ok(r.specMd.includes("Acme Energy Hub"), "specMd should contain project name");
    assert.ok(Array.isArray(r.files));
    assert.ok(
      r.files.some((f) => f.endsWith("traceability.md")),
      "should list traceability.md"
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("read_spec throws on missing projectDir", () => {
  assert.throws(() => readSpec({}) as any, /projectDir is required/);
});

test("read_spec throws on non-existent directory", () => {
  assert.throws(() => readSpec({ projectDir: "/no/such/dir" }) as any, /does not exist/);
});

test("read_spec throws on directory without spec.md", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "no-spec-"));
  try {
    assert.throws(() => readSpec({ projectDir: tmp }) as any, /Not a spec-driven project/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── list_requirements ────────────────────────────────────────────────────────────────

test("list_requirements returns an array of requirement objects", () => {
  const { tmp, projectDir } = generateProject();
  try {
    // Append unique IDs that don't collide with template-shipped REQ-001 etc.
    const specPath = path.join(projectDir, "spec.md");
    fs.appendFileSync(specPath, "\n## REQ-501 — First custom requirement\n");
    fs.appendFileSync(specPath, "\n## REQ-502 — Second custom requirement\n");

    const r = listRequirements({ projectDir }) as any;
    assert.ok(Array.isArray(r.requirements));
    const ids = r.requirements.map((req) => req.id);
    assert.ok(ids.includes("REQ-501"), "should find REQ-501");
    assert.ok(ids.includes("REQ-502"), "should find REQ-502");

    const req501 = r.requirements.find((req) => req.id === "REQ-501");
    assert.ok(req501.title.includes("First custom requirement"), `title was: ${req501.title}`);
    assert.ok(typeof req501.line === "number");
    assert.ok(req501.file.includes("spec.md"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("list_requirements deduplicates IDs across files", () => {
  const { tmp, projectDir } = generateProject();
  try {
    const specPath = path.join(projectDir, "spec.md");
    const tracePath = path.join(projectDir, "docs/specs/traceability.md");
    fs.appendFileSync(specPath, "\n## REQ-077 — Common\n");
    fs.appendFileSync(tracePath, "\n| REQ-077 | reference |\n");

    const r = listRequirements({ projectDir }) as any;
    const occurrences = r.requirements.filter((req) => req.id === "REQ-077");
    assert.equal(occurrences.length, 1, "REQ-077 should appear exactly once");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── update_traceability ──────────────────────────────────────────────────────────────

test("update_traceability appends a row when not present", () => {
  const { tmp, projectDir } = generateProject();
  try {
    const r = updateTraceability({
      projectDir,
      requirement: "REQ-099",
      scenario: "SCN-099",
      feature: "features/test/example.feature",
      status: "Draft",
    });
    assert.equal((r as any).updated, true);
    assert.equal((r as any).rowsAdded, 1);
    const content = fs.readFileSync(path.join(projectDir, "docs/specs/traceability.md"), "utf8");
    assert.ok(content.includes("REQ-099"));
    assert.ok(content.includes("features/test/example.feature"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("update_traceability is idempotent — second call adds no row", () => {
  const { tmp, projectDir } = generateProject();
  try {
    const args = {
      projectDir,
      requirement: "REQ-100",
      feature: "features/test/dup.feature",
      status: "Draft",
    };
    const r1 = updateTraceability(args) as any;
    const r2 = updateTraceability(args) as any;
    assert.equal(r1.updated, true);
    assert.equal(r2.updated, false);
    assert.equal(r2.rowsAdded, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("update_traceability throws on missing required argument", () => {
  const { tmp, projectDir } = generateProject();
  try {
    assert.throws(
      () => updateTraceability({ projectDir, feature: "x.feature", status: "Draft" }) as any,
      /Missing argument: requirement/
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── validate_project ────────────────────────────────────────────────────────────

test("validate_project succeeds on a freshly generated project", () => {
  const { tmp, projectDir } = generateProject();
  try {
    const r = validateProject({
      projectDir,
      cliPath: `"${process.execPath}" "${CLI}"`,
    });
    // The tool returns the CLI's own JSON document verbatim — one envelope,
    // per ADR-0017 — rather than the bespoke `{ passed, errors, warnings }`
    // shape it used to flatten it into. Branch on the contract, not on a
    // summary this layer invented.
    assert.ok((r as any).validation, `expected a validation document, got: ${JSON.stringify(r)}`);
    assert.equal((r as any).validation.passed, true);
    assert.deepEqual((r as any).status, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("validate_project throws when projectDir is not a spec-driven project", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "not-spec-"));
  try {
    assert.throws(() => validateProject({ projectDir: tmp }) as any, /Not a spec-driven project/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
