"use strict";

/**
 * A matrix checked out with CRLF is current (REQ-808, change
 * `matrix-line-endings`): git on Windows writes `\r\n`, Specgate generates
 * `\n`, and only a real difference makes the matrix stale.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import type { TestContext } from "node:test";
import { cli } from "../helpers/cli";

/** An adopted repo with a generated matrix, current. */
function project(t: TestContext) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-crlf-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "shop");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"shop","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--keep-matrix", "--no-capabilities").status, 0);
  cli("new", "Orders can be cancelled", "--project-dir", dir);
  cli("matrix", "--migrate", "--project-dir", dir);
  assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 0);
  return dir;
}

const MATRIX = (dir: string) => path.join(dir, "docs/specs/traceability.md");
const toCrlf = (dir: string, edit = (s: string) => s) => {
  const lf = fs.readFileSync(MATRIX(dir), "utf8");
  fs.writeFileSync(MATRIX(dir), edit(lf).replace(/\n/g, "\r\n"));
};

test("REQ-808 SCN-808a: a current matrix with CRLF line endings is not stale, nor rewritten", (t: TestContext) => {
  const dir = project(t);
  toCrlf(dir);
  const crlf = fs.readFileSync(MATRIX(dir), "utf8");
  const v = cli("validate", dir, "--json");
  assert.doesNotMatch(v.stdout, /matrix_stale/, v.stdout);
  assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 0);
  cli("check", dir);
  assert.equal(fs.readFileSync(MATRIX(dir), "utf8"), crlf, "left as git wrote it");
});

test("REQ-808 SCN-808b: a CRLF matrix whose row changed is still stale", (t: TestContext) => {
  const dir = project(t);
  toCrlf(dir, (s) => s.replace(/\| Draft \|/, "| Implemented |"));
  const v = cli("validate", dir, "--json");
  assert.match(v.stdout, /matrix_stale/);
  assert.equal(cli("matrix", "--check", "--project-dir", dir).status, 1);
});
