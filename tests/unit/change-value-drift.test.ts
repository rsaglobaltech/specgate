"use strict";

/**
 * `specgate change new --from-value-drift REQ-ID:value_id` — route 2 of the
 * three-way resolution for a declared-value divergence (§8.6 → §11).
 *
 * Routes 1 ("fix the code") and 3 ("retire the requirement") need no new
 * tooling — `specgate report` already names the code file:line for route 1, and
 * route 3 is `change new` with a hand-written `REMOVED Requirements`
 * section, same as retiring any other requirement. This is the one route
 * that is glue: find the requirement, find its code value, propose the spec
 * catch up.
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

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const RICH_SEP = "|---|---|---|---|---|---|---|---|---|---|";

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-value-drift-"));
  fs.writeFileSync(path.join(root, "spec.md"), "# Spec\n", "utf8");
  fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "specs", "traceability.md"),
    [RICH_HEADER, RICH_SEP].join("\n") + "\n",
    "utf8"
  );
  return root;
}

function addMatrixRow(root: string, row: string) {
  const p = path.join(root, "docs", "specs", "traceability.md");
  fs.appendFileSync(p, row + "\n");
}

function writeCapabilitySpec(root: string, name: string, body: string) {
  const dir = path.join(root, "docs", "specs", "capabilities", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), body, "utf8");
}

function writeCode(root: string, rel: string, body: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
}

const cleanup = (root: string) => fs.rmSync(root, { recursive: true, force: true });

function run(root: string, args: string[]) {
  return spawnSync(process.execPath, [CLI_PATH, ...args, "--project-dir", root], {
    encoding: "utf8",
  });
}

const AUTH_SPEC = [
  "# Auth",
  "## Requirements",
  "### Requirement: REQ-200 — Session expiry",
  "The system SHALL expire the session after 15 minutes of inactivity.",
  "<!-- specgate:trace uc=Login value_session_timeout=15m -->",
  "#### Scenario: SCN-200a — Expires",
  "- GIVEN a session idle for 15 minutes",
  "- WHEN the user tries to use it",
  "- THEN it has expired",
].join("\n");

test("generates a MODIFIED delta proposing the spec take the code's value", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    writeCode(root, "src/auth.ts", "// specgate:value session_timeout=30m\n");
    addMatrixRow(root, "| REQ-200 | SCN-200a | - | - | - | - | - | `src/auth.ts` | TBD | In Dev |");

    const r = run(root, [
      "change",
      "new",
      "fix-timeout",
      "--from-value-drift",
      "REQ-200:session_timeout",
    ]);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const deltaPath = path.join(root, "docs/specs/changes/fix-timeout/specs/auth/spec.md");
    assert.ok(fs.existsSync(deltaPath), "delta file should be written under the auth capability");
    const content = fs.readFileSync(deltaPath, "utf8");
    assert.match(content, /## MODIFIED Requirements/);
    assert.match(content, /value_session_timeout=30m/);
    assert.doesNotMatch(content, /value_session_timeout=15m/);
    assert.match(content, /TODO:/);
    assert.match(content, /GIVEN a session idle for 15 minutes/);
  } finally {
    cleanup(root);
  }
});

test("the generated delta passes specgate change validate", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    writeCode(root, "src/auth.ts", "// specgate:value session_timeout=30m\n");
    addMatrixRow(root, "| REQ-200 | SCN-200a | - | - | - | - | - | `src/auth.ts` | TBD | In Dev |");

    const created = run(root, [
      "change",
      "new",
      "fix-timeout",
      "--from-value-drift",
      "REQ-200:session_timeout",
    ]);
    assert.equal(created.status, 0, created.stdout + created.stderr);

    const validated = run(root, ["change", "validate", "fix-timeout"]);
    assert.equal(validated.status, 0, validated.stdout + validated.stderr);
  } finally {
    cleanup(root);
  }
});

test("--capability and --from-value-drift are mutually exclusive", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    const r = run(root, [
      "change",
      "new",
      "x",
      "--from-value-drift",
      "REQ-200:session_timeout",
      "--capability",
      "auth",
    ]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /conflicting_seed_flags/);
  } finally {
    cleanup(root);
  }
});

test("an unknown requirement id fails cleanly, no partial change dir left behind", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-999:whatever"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /value_drift_requirement_not_found/);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/x")), false);
  } finally {
    cleanup(root);
  }
});

test("a value_ id the spec never declared fails cleanly", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-200:not_declared"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /value_drift_id_not_declared/);
  } finally {
    cleanup(root);
  }
});

test("no matching specgate:value marker in the declared code file fails cleanly", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    writeCode(root, "src/auth.ts", "const X = '30m'; // no marker\n");
    addMatrixRow(root, "| REQ-200 | SCN-200a | - | - | - | - | - | `src/auth.ts` | TBD | In Dev |");

    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-200:session_timeout"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /value_drift_no_code_value/);
  } finally {
    cleanup(root);
  }
});

test("already matching values report nothing to propose, instead of a no-op change", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    writeCode(root, "src/auth.ts", "// specgate:value session_timeout=15m\n");
    addMatrixRow(root, "| REQ-200 | SCN-200a | - | - | - | - | - | `src/auth.ts` | TBD | In Dev |");

    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-200:session_timeout"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /value_drift_already_matches/);
    assert.equal(fs.existsSync(path.join(root, "docs/specs/changes/x")), false);
  } finally {
    cleanup(root);
  }
});

test("a malformed --from-value-drift spec (no colon) fails cleanly", () => {
  const root = mkProject();
  try {
    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-200"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /invalid_value_drift_spec/);
  } finally {
    cleanup(root);
  }
});

test("--json emits one document with the diagnostic on failure", () => {
  const root = mkProject();
  try {
    writeCapabilitySpec(root, "auth", AUTH_SPEC);
    const r = run(root, ["change", "new", "x", "--from-value-drift", "REQ-999:whatever", "--json"]);
    assert.notEqual(r.status, 0);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.change, null);
    assert.ok(Array.isArray(doc.status));
    assert.equal(doc.status[0].code, "value_drift_requirement_not_found");
  } finally {
    cleanup(root);
  }
});
