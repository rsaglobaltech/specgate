/**
 * The green diff must touch what the matrix declared (A2).
 *
 * A row names `test_artifact` and `technical_artifact`; the prompt hands both
 * to the agent; nothing checked the diff contained them. An agent can implement
 * elsewhere, pass the scenario, and leave the matrix pointing at a file where
 * the logic does not live — the documentary lie `AI_RULES.md` forbids.
 *
 * Most of these tests are about *not* firing. A real matrix cell is markdown
 * written by a person, and the scaffolded one says `` `API /health`, smoke
 * test ``. A check that treats prose as a path reports every project as broken,
 * and a warning that is usually wrong is a warning people learn to ignore —
 * which is how `--strict`-only rules ended up useless in H14.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  ARTIFACT_CODES,
  checkDeclaredArtifacts,
  declaredPaths,
  looksLikePath,
} from "../../src/domain/DeclaredArtifacts";

test("a path is a path; a sentence about a path is not", () => {
  for (const yes of ["src/App.java", "App.java", "features/core/health.feature", "src/health/"]) {
    assert.equal(looksLikePath(yes), true, `${yes} should read as a path`);
  }
  for (const no of ["API /health", "smoke test", "TBD", "TODO", "N/A", "-", "", "the health API"]) {
    assert.equal(looksLikePath(no), false, `${no} should not read as a path`);
  }
});

test("a cell can be half path and half prose, and both halves are respected", () => {
  // The realistic case. Forcing the cell to be all one or all the other would
  // mean either losing the check or inventing findings about the prose.
  assert.deepEqual(declaredPaths("`src/Health.java`, smoke test"), ["src/Health.java"]);
  assert.deepEqual(declaredPaths("`API /health`, smoke test"), []);
  assert.deepEqual(declaredPaths("TBD"), []);
  assert.deepEqual(declaredPaths(""), []);
  assert.deepEqual(declaredPaths(null), []);
});

test("a declared path the diff never touched is reported, with a fix that names a real flag", () => {
  const found = checkDeclaredArtifacts({
    requirement: "REQ-007",
    touched: ["src/Other.java"],
    technicalArtifact: "`src/Health.java`",
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].code, ARTIFACT_CODES.UNTOUCHED);
  assert.equal(found[0].severity, "warning", "a warning by default — see the module note");
  assert.match(found[0].message, /src\/Health\.java/);
  const { fix } = found[0];
  assert.ok(fix);
  assert.match(fix, /specgate req link REQ-007 --code/);
});

test("the test artifact gets its own flag in the fix", () => {
  const found = checkDeclaredArtifacts({
    requirement: "REQ-007",
    touched: [],
    testArtifact: "`src/test/HealthTest.java`",
  });
  const { fix } = found[0];
  assert.ok(fix);
  assert.match(fix, /--test/);
});

test("--strict-artifacts promotes it to an error, and nothing else changes", () => {
  const input = { requirement: "REQ-007", touched: [], technicalArtifact: "`src/Health.java`" };
  const lenient = checkDeclaredArtifacts(input, false);
  const strict = checkDeclaredArtifacts(input, true);
  assert.equal(lenient[0].severity, "warning");
  assert.equal(strict[0].severity, "error");
  assert.equal(strict[0].message, lenient[0].message);
});

test("touching the declared file raises nothing", () => {
  assert.deepEqual(
    checkDeclaredArtifacts({
      touched: ["src/Health.java", "src/test/HealthTest.java"],
      technicalArtifact: "`src/Health.java`",
      testArtifact: "`src/test/HealthTest.java`",
    }),
    []
  );
});

test("a row may name a directory and the work land on files inside it", () => {
  assert.deepEqual(
    checkDeclaredArtifacts({
      touched: ["src/health/Endpoint.java"],
      technicalArtifact: "`src/health/`",
    }),
    []
  );
});

test("a prose-only row produces no findings at all", () => {
  // The scaffolded project. If this ever starts warning, every `specgate init`
  // hands the user a harness that complains on its first run.
  assert.deepEqual(
    checkDeclaredArtifacts({
      requirement: "REQ-000",
      touched: ["src/App.java"],
      technicalArtifact: "`API /health`, smoke test",
      testArtifact: "TBD",
    }),
    []
  );
});

test("an empty diff with prose declarations is still silent", () => {
  assert.deepEqual(
    checkDeclaredArtifacts({ touched: [], technicalArtifact: "TBD", testArtifact: "TBD" }),
    []
  );
});
