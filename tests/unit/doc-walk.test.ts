"use strict";

/**
 * What following the documentation step by step, on the published package,
 * found the tool doing differently from what the docs say (2026-10-07). Each
 * test pins the behaviour the docs describe.
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
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-walk-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  const r = cli("adopt", "--project-dir", dir, "--no-capabilities");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir };
}

/** `new`, then the obligation and scenario filled in: everything but a test. */
function requirement(dir: string, title: string) {
  const req = JSON.parse(cli("new", title, "--project-dir", dir, "--json").stdout).requirement;
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        `The system MUST satisfy: ${title}.`,
        "The system MUST return a paid invoice as a PDF."
      )
      .replace(/^> Written by Specgate\..*$/m, "")
  );
  const file = path.join(dir, req.featureFile);
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace("<the state before the action>", "a paid invoice")
      .replace("<the action under test>", "the customer downloads it")
      .replace("<the observable outcome>", "a PDF is returned")
  );
  return req;
}

test("a Deprecated requirement owes nothing, so `req rm`'s advice is not a loop", () => {
  const { parent, dir } = adopted();
  try {
    const req = requirement(dir, "Invoices download as PDF");
    const r = cli("done", req.id, "--status", "Deprecated", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const check = cli("check", dir);
    assert.equal(check.status, 0, check.stdout + check.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("done refuses to close a requirement no test mentions", () => {
  // It used to judge the requirement as still Draft and write Implemented;
  // the next `check` — the one in CI — then failed it with [TDD-1].
  const { parent, dir } = adopted();
  try {
    const req = requirement(dir, "Invoices download as PDF");
    const r = cli("done", req.id, "--project-dir", dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /TDD-1/);
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "test/invoice.test.js"), `// ${req.id} ${req.scenarioId}\n`);
    const ok = cli("done", req.id, "--project-dir", dir);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("done --json says why the gate refused, not only that it did", () => {
  // Over MCP an agent got `done_validate_failed` and nothing it could act on.
  const { parent, dir } = adopted();
  try {
    cli("new", "Invoices download as PDF", "--project-dir", dir);
    const r = cli("done", "REQ-002", "--project-dir", dir, "--json");
    assert.equal(r.status, 1);
    const codes = JSON.parse(r.stdout).status.map((d: any) => d.code);
    assert.ok(codes.includes("scenario_placeholder_step"), codes.join(", "));
    assert.ok(codes.includes("done_validate_failed"), codes.join(", "));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("right after adoption, status points at a first real requirement", () => {
  // It said "specgate check — write REQ-001's test": the baseline, and a
  // command paired with an instruction about something else.
  const { parent, dir } = adopted();
  try {
    const doc = JSON.parse(cli("status", "--project-dir", dir, "--json").stdout);
    assert.match(doc.nextCommand, /^specgate new /);
    cli("new", "Invoices download as PDF", "--project-dir", dir);
    const after = JSON.parse(cli("status", "--project-dir", dir, "--json").stdout);
    assert.equal(after.nextCommand, "specgate done REQ-002");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an orphan feature on a generated matrix is told to tag it, not to add a row", () => {
  const { parent, dir } = adopted();
  try {
    fs.writeFileSync(
      path.join(dir, "features", "orphan.feature"),
      "Feature: Orphan\n\n  Scenario: Nothing claims it\n    Given a\n    When b\n    Then c\n"
    );
    const r = cli("check", dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /@REQ-NNN @SCN-NNN/);
    assert.doesNotMatch(r.stdout + r.stderr, /Add a row for it/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("MCP tools declare the argument their command needs", () => {
  const { TOOLS } = require(
    path.join(ROOT_DIR, "dist", "packages", "mcp-spec-driven", "src", "tools.js")
  );
  for (const [tool, arg] of [
    ["specgate_change_new", "id"],
    ["specgate_req_link", "requirement"],
    ["specgate_req_add", "title"],
    ["specgate_new", "title"],
    ["mark_requirement_done", "requirement"],
  ]) {
    assert.ok(TOOLS[tool].inputSchema.required.includes(arg), `${tool} does not declare ${arg}`);
  }
});
