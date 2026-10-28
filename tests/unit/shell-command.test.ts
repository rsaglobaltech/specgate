"use strict";

/** REQ-255 — a command written for a POSIX shell, run by cmd.exe on Windows. */

const test = require("node:test");
const assert = require("node:assert/strict");
const { forShell } = require("../../scripts/lib/shell-command");

test("REQ-255 SCN-255a: ./mvnw -B test", () => {
  assert.equal(forShell("./mvnw -B test", "win32"), ".\\mvnw -B test");
  assert.equal(
    forShell("cd apps/api && ./mvnw -q test", "win32"),
    "cd apps/api && .\\mvnw -q test"
  );
  assert.equal(forShell("./gradlew test; ./run.sh", "win32"), ".\\gradlew test; .\\run.sh");
  // An argument that happens to start with ./ is a path, not a program.
  assert.equal(forShell("npx vitest ./src", "win32"), "npx vitest ./src");
  for (const platform of ["linux", "darwin"]) {
    assert.equal(
      forShell("cd apps/api && ./mvnw -q test", platform),
      "cd apps/api && ./mvnw -q test"
    );
  }
});
