"use strict";

/**
 * A slow delivery names the faster command (change `slow-tests-hint`, REQ-802).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli, runCli } from "../helpers/cli";

/** An adopted project with one requirement, its test, and a "suite" slower than the limit. */
function project(t: TestContext, key: "test_cmd" | "test_cmd_affected", cmd: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-slow-tests-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  assert.equal(cli("new", "Totals are rounded half-up", "--project-dir", dir).status, 0);
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "The system MUST satisfy: Totals are rounded half-up.",
        "The system MUST round every invoice total half-up to two decimals."
      )
      .replace(/^> Written by Specgate\..*$/gm, "")
  );
  const id = /(REQ-\d+)/.exec(fs.readFileSync(spec, "utf8"))![1];
  fs.writeFileSync(path.join(dir, "tests", "totals.test.js"), `// ${id}\n`);
  fs.writeFileSync(path.join(dir, "slow.js"), "setTimeout(() => {}, 400);\n");
  assert.equal(cli("config", "set", "test_cmd", "node slow.js", "--project-dir", dir).status, 0);
  if (key === "test_cmd_affected") {
    assert.equal(cli("config", "set", key, cmd, "--project-dir", dir).status, 0);
  }
  const apply = () =>
    runCli(["apply", id, "--project-dir", dir], {
      env: { ...process.env, NO_COLOR: "1", SPECGATE_SLOW_TESTS_MS: "200" },
    });
  return { id, apply };
}

test("REQ-802 SCN-802a: a slow whole suite names test_cmd_affected with the project's command", (t: TestContext) => {
  const { id, apply } = project(t, "test_cmd", "node slow.js");
  const r = apply();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`${id} .*Implemented`));
  assert.match(r.stdout, /specgate config set test_cmd_affected "node slow\.js \{files\}"/);
  assert.match(r.stdout, /docs\/fast-gate\.md/);
});

test("REQ-802 SCN-802b: a command already scoped says nothing", (t: TestContext) => {
  const { apply } = project(t, "test_cmd_affected", "node slow.js {files}");
  const r = apply();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /test_cmd_affected/);
});
