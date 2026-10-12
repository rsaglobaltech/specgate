// specgate:allow-placeholders — this file emits or asserts on {{VAR}} template syntax.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const os = require("node:os");
const fs = require("node:fs");

const {
  renderTemplate,
  normalizeVars,
  asArray,
  formatList,
  entityLabel,
  hasStructuredDomainModel,
  PACK_SCHEMA_VERSION,
  isNewerThan,
} = require("../../packages/core/src/domain/PackSpec");
const {
  loadPack,
  validatePackModel,
  safeResolve,
} = require("../../packages/core/src/infrastructure/DiskPackRepository");
const {
  parseTraceabilityRows,
  buildTraceabilityMarkdown,
} = require("../../packages/core/src/domain/TraceabilityFormat");

const FIXTURE_ROOT = path.resolve(__dirname, "../../../tests/fixtures/domain-packs");
const FIXTURE_ID = "parking-management/backend";
const REPO_ROOT = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);

// ── renderTemplate ────────────────────────────────────────────────────────────

test("renderTemplate substitutes a single variable", () => {
  const result = renderTemplate("Hello {{NAME}}!", { NAME: "World" });
  assert.equal(result, "Hello World!");
});

test("renderTemplate substitutes multiple variables", () => {
  const result = renderTemplate("{{A}} + {{B}} = {{C}}", { A: "1", B: "2", C: "3" });
  assert.equal(result, "1 + 2 = 3");
});

test("renderTemplate substitutes the same variable appearing twice", () => {
  const result = renderTemplate("{{X}} and {{X}}", { X: "repeat" });
  assert.equal(result, "repeat and repeat");
});

test("renderTemplate coerces number values to string", () => {
  const result = renderTemplate("port={{PORT}}", { PORT: 5432 });
  assert.equal(result, "port=5432");
});

test("renderTemplate leaves text without placeholders unchanged", () => {
  const result = renderTemplate("no placeholders", { UNUSED: "x" });
  assert.equal(result, "no placeholders");
});

test("renderTemplate throws when a required variable is missing", () => {
  assert.throws(() => renderTemplate("Hello {{MISSING}}!", {}), /MISSING/);
});

test("renderTemplate handles special characters in replacement values", () => {
  const result = renderTemplate("pw={{PW}}", { PW: "p@$$w0rd!" });
  assert.equal(result, "pw=p@$$w0rd!");
});

test("renderTemplate handles slashes in replacement values", () => {
  const result = renderTemplate("path={{P}}", { P: "a/b/c" });
  assert.equal(result, "path=a/b/c");
});

test("renderTemplate is idempotent given the same input", () => {
  const tpl = "service={{SVC}}, env={{ENV}}";
  const vars = { SVC: "api", ENV: "dev" };
  assert.equal(renderTemplate(tpl, vars), renderTemplate(tpl, vars));
});

// ── normalizeVars ─────────────────────────────────────────────────────────────

test("normalizeVars returns merged vars when all required keys are present", () => {
  const result = normalizeVars(["A", "B"], { A: "1", B: "2", C: "extra" });
  assert.equal(result.A, "1");
  assert.equal(result.B, "2");
  assert.equal(result.C, "extra");
});

test("normalizeVars throws when a required variable is absent", () => {
  assert.throws(() => normalizeVars(["MISSING"], {}), /MISSING/);
});

test("normalizeVars throws when a required variable is empty string", () => {
  assert.throws(() => normalizeVars(["NAME"], { NAME: "" }), /NAME/);
});

test("normalizeVars accepts zero required variables", () => {
  const result = normalizeVars([], { A: "1" });
  assert.equal(result.A, "1");
});

// ── asArray ───────────────────────────────────────────────────────────────────

test("asArray wraps a scalar in an array", () => {
  assert.deepEqual(asArray("x"), ["x"]);
});

test("asArray returns an existing array unchanged", () => {
  assert.deepEqual(asArray(["a", "b"]), ["a", "b"]);
});

test("asArray returns empty array for undefined", () => {
  assert.deepEqual(asArray(undefined), []);
});

test("asArray returns empty array for null", () => {
  assert.deepEqual(asArray(null), []);
});

// ── formatList ────────────────────────────────────────────────────────────────

test("formatList joins an array with commas", () => {
  assert.equal(formatList(["a", "b", "c"]), "a, b, c");
});

test("formatList returns fallback for empty array", () => {
  assert.equal(formatList([]), "-");
});

test("formatList returns fallback for undefined", () => {
  assert.equal(formatList(undefined), "-");
});

test("formatList accepts a custom fallback", () => {
  assert.equal(formatList([], "n/a"), "n/a");
});

// ── entityLabel ───────────────────────────────────────────────────────────────

test("entityLabel returns id + name when both present", () => {
  assert.equal(entityLabel({ id: "EVT-001", name: "Created" }), "EVT-001 Created");
});

test("entityLabel returns id when name is absent", () => {
  assert.equal(entityLabel({ id: "EVT-001" }), "EVT-001");
});

test("entityLabel returns name when id is absent", () => {
  assert.equal(entityLabel({ name: "Created" }), "Created");
});

test("entityLabel returns fallback when entity is empty", () => {
  assert.equal(entityLabel({}), "-");
});

// ── loadPack + validatePackModel (integration) ────────────────────────────────

test("loadPack reads the parking-management fixture without error", () => {
  const { pack } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.equal(pack.metadata.project_type, "backend");
  assert.ok(Array.isArray(pack.requirements));
  assert.ok(pack.requirements.length > 0);
});

test("validatePackModel accepts the parking-management fixture", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.doesNotThrow(() => validatePackModel(pack, packRoot));
});

test("validatePackModel rejects a pack with no requirements", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  pack.requirements = [];
  assert.throws(() => validatePackModel(pack, packRoot));
});

test("validatePackModel rejects a pack with duplicate requirement ids", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  pack.requirements.push({ ...pack.requirements[0] });
  assert.throws(() => validatePackModel(pack, packRoot));
});

test("validatePackModel rejects an aggregate pointing at a context that does not exist", () => {
  // This check existed and did nothing. `validatePackModel` read
  // `aggregate.context`; every shipped pack writes `bounded_context`, and
  // `assertRef` returns early on an empty reference — so the cross-reference
  // was inert on all eleven of them. `pack lint` has its own check and caught
  // it, which is exactly why nobody noticed the installer's did not: two
  // validators disagreeing, and the quiet one trusted.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.ok(pack.aggregates && pack.aggregates.length > 0, "the fixture has no aggregates");
  pack.aggregates[0].bounded_context = "BC-999";
  assert.throws(() => validatePackModel(pack, packRoot), /BC-999/);
});

test("validatePackModel refuses a depends_on pointing at a requirement that does not exist", () => {
  // A dependency naming nothing is worse than none: the harness would stack a
  // branch on a predecessor it can never find, and the failure would surface
  // as a base that does not exist rather than as the typo it is.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  pack.requirements[0].depends_on = ["REQ-999"];
  assert.throws(() => validatePackModel(pack, packRoot), /REQ-999/);
});

test("validatePackModel refuses a requirement that depends on itself", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  const id = pack.requirements[0].id;
  pack.requirements[0].depends_on = [id];
  assert.throws(() => validatePackModel(pack, packRoot), /itself/);
});

test("validatePackModel refuses a cycle, and names the way round", () => {
  // `runLevels` already refuses to loop forever, but it finds out at run time
  // after the packs are installed. A cycle is a defect in the pack, and the
  // pack is where it should be reported.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.ok(pack.requirements.length >= 2, "the fixture needs two requirements");
  const [a, b] = pack.requirements;
  a.depends_on = [b.id];
  b.depends_on = [a.id];
  assert.throws(() => validatePackModel(pack, packRoot), /cycle/i);
});

test("a pack whose requirements declare no dependencies is unaffected", () => {
  // `depends_on` is optional, so every pack written before it stays valid.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.doesNotThrow(() => validatePackModel(pack, packRoot));
});

test("validatePackModel still honours `context`, the name the schema used", () => {
  // Both spellings are accepted while the schema catches up: a pack authored
  // against the published schema must not silently lose the check either.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  delete pack.aggregates[0].bounded_context;
  pack.aggregates[0].context = "BC-999";
  assert.throws(() => validatePackModel(pack, packRoot), /BC-999/);
});

// ── safeResolve ───────────────────────────────────────────────────────────────

test("safeResolve returns absolute path within project dir", () => {
  const tmp = os.tmpdir();
  const result = safeResolve(tmp, "docs/spec.md");
  assert.equal(result, path.resolve(tmp, "docs/spec.md"));
});

test("safeResolve throws on path traversal attempt", () => {
  const tmp = os.tmpdir();
  assert.throws(() => safeResolve(tmp, "../outside"), /escapes|Invalid/);
});

test("safeResolve throws on absolute path input", () => {
  const tmp = os.tmpdir();
  assert.throws(() => safeResolve(tmp, "/etc/passwd"), /Invalid target path/);
});

// ── parseTraceabilityRows ─────────────────────────────────────────────────────

const LEGACY_MATRIX = `
# Traceability Matrix

| Feature | Scenario | Technical Artifact | Status |
|---|---|---|---|
| Login | User logs in | AuthService | Verified |
| Login | User logs in | AuthService | Verified |
| Logout | User logs out | AuthService | Draft |
`.trim();

const RICH_MATRIX = `
# Traceability Matrix

| Requirement | Scenario ID | Feature File | Use Case | Command | Aggregate | Event | Technical Artifact | Test Artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001 | features/login.feature | UC-001 | LoginCmd | UserSession | UserLoggedIn | AuthService | login.steps | Verified |
`.trim();

test("parseTraceabilityRows detects legacy mode", () => {
  const { mode } = parseTraceabilityRows(LEGACY_MATRIX);
  assert.equal(mode, "legacy");
});

test("parseTraceabilityRows parses legacy rows", () => {
  const { rows } = parseTraceabilityRows(LEGACY_MATRIX);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].feature, "Login");
  assert.equal(rows[0].status, "Verified");
});

test("parseTraceabilityRows deduplicates legacy rows by feature+scenario key", () => {
  const { rows } = parseTraceabilityRows(LEGACY_MATRIX);
  const loginRows = rows.filter((r) => r.feature === "Login");
  assert.equal(loginRows.length, 1);
});

test("parseTraceabilityRows detects rich mode", () => {
  const { mode } = parseTraceabilityRows(RICH_MATRIX);
  assert.equal(mode, "rich");
});

test("parseTraceabilityRows parses rich rows", () => {
  const { rows } = parseTraceabilityRows(RICH_MATRIX);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requirement, "REQ-001");
  assert.equal(rows[0].scenarioId, "SCN-001");
  assert.equal(rows[0].status, "Verified");
});

test("parseTraceabilityRows returns empty rows for empty input", () => {
  const { rows } = parseTraceabilityRows("");
  assert.equal(rows.length, 0);
});

// ── buildTraceabilityMarkdown ─────────────────────────────────────────────────

test("buildTraceabilityMarkdown produces a markdown table in legacy mode", () => {
  const rows = [
    { feature: "Login", scenario: "Success", technicalArtifact: "AuthService", status: "Draft" },
  ];
  const md = buildTraceabilityMarkdown(rows, "legacy");
  assert.ok(md.includes("| Login |"));
  assert.ok(md.includes("Draft"));
});

test("buildTraceabilityMarkdown produces rich headers in rich mode", () => {
  const rows = [
    {
      requirement: "REQ-001",
      scenarioId: "SCN-001",
      featureFile: "login.feature",
      useCase: "UC-001",
      commandOrQuery: "LoginCmd",
      aggregate: "Session",
      event: "LoggedIn",
      technicalArtifact: "AuthSvc",
      testArtifact: "login.steps",
      status: "Draft",
    },
  ];
  const md = buildTraceabilityMarkdown(rows, "rich");
  assert.ok(md.includes("REQ-001"));
  assert.ok(md.includes("SCN-001"));
});

test("buildTraceabilityMarkdown returns empty-table string for zero rows", () => {
  const md = buildTraceabilityMarkdown([], "legacy");
  assert.ok(typeof md === "string");
});

// ── hasStructuredDomainModel ──────────────────────────────────────────────────

test("hasStructuredDomainModel returns true when all sections present", () => {
  const { pack } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  assert.ok(hasStructuredDomainModel(pack));
});

test("hasStructuredDomainModel returns false when all domain sections absent", () => {
  assert.equal(hasStructuredDomainModel({}), false);
});

test("hasStructuredDomainModel returns true when any domain section is non-empty", () => {
  assert.equal(hasStructuredDomainModel({ requirements: [{ id: "REQ-001" }] }), true);
});

// ── pack.yaml schema compatibility ────────────────────────────────────────────
//
// `schema_version` was written by `pack init` and read by nothing. A pack
// authored against a newer schema failed later with "unknown property X" —
// accurate, and useless for working out that the CLI was simply too old.

test("validatePackModel rejects a pack.yaml from a newer schema, and names the fix", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  pack.schema_version = "9.0.0";
  assert.throws(
    () => validatePackModel(pack, packRoot),
    // Plain substring checks: building a regex out of a version string means
    // escaping it, and a half-escaped pattern is how this file earned a
    // js/incomplete-sanitization alert in the first place.
    (err) =>
      err.message.includes("schema_version 9.0.0") &&
      err.message.includes(`up to ${PACK_SCHEMA_VERSION}`) &&
      err.message.includes("Fix:")
  );
});

test("validatePackModel accepts the current schema and older ones", () => {
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  for (const version of [PACK_SCHEMA_VERSION, "1.1.0", "1.0.0"]) {
    pack.schema_version = version;
    assert.doesNotThrow(() => validatePackModel(pack, packRoot), `${version} should be accepted`);
  }
});

test("a pack.yaml with no schema_version is still accepted", () => {
  // The field is optional and predates this gate; requiring it would reject
  // every pack written before the field existed.
  const { pack, packRoot } = loadPack(FIXTURE_ROOT, FIXTURE_ID);
  delete pack.schema_version;
  assert.doesNotThrow(() => validatePackModel(pack, packRoot));
});

test("isNewerThan compares each numeric field, not the string", () => {
  // "1.10.0" > "1.9.0" is false under string comparison and true under this.
  assert.equal(isNewerThan("1.10.0", "1.9.0"), true);
  assert.equal(isNewerThan("1.9.0", "1.10.0"), false);
  assert.equal(isNewerThan("2.0.0", "1.99.99"), true);
  assert.equal(isNewerThan("1.2.0", "1.2.0"), false);
  assert.equal(isNewerThan("1.2", "1.2.0"), false);
});

test("every curated pack declares a schema this CLI can read", () => {
  // Guards the release order: bumping PACK_SCHEMA_VERSION without shipping the
  // CLI that understands it would make our own packs uninstallable.
  const packsDir = path.join(REPO_ROOT, "packs");
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "pack.yaml") found.push(full);
    }
  };
  walk(packsDir);
  assert.ok(found.length > 0, "no curated packs found");
  for (const file of found) {
    const declared = /schema_version:\s*"([^"]+)"/.exec(fs.readFileSync(file, "utf8"));
    if (!declared) continue;
    assert.equal(
      isNewerThan(declared[1], PACK_SCHEMA_VERSION),
      false,
      `${path.relative(REPO_ROOT, file)} declares ${declared[1]}, newer than ${PACK_SCHEMA_VERSION}`
    );
  }
});
