"use strict";

/**
 * REQ-231 — ADR-0028's points 3 and 4: `arch_cmd` with `arch_sarif` is judged
 * by its findings against the baseline, so an existing codebase's
 * architecture debt does not fail the gate and a violation a change adds does.
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
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const NL = String.fromCharCode(10);

/**
 * A fake architecture tool: every line under lib/domain that requires
 * "../infra" is a violation, written as SARIF; it exits 1 while any exists,
 * as ArchUnit or dependency-cruiser would.
 */
const TOOL = [
  'const fs = require("fs");',
  'const path = require("path");',
  "const results = [];",
  'for (const f of fs.readdirSync("lib/domain")) {',
  '  const lines = fs.readFileSync(path.join("lib/domain", f), "utf8").split(String.fromCharCode(10));',
  "  lines.forEach((l, i) => {",
  '    if (l.includes("../infra")) results.push({',
  '      ruleId: "domain-not-to-infra",',
  '      message: { text: "the domain depends on infrastructure" },',
  '      locations: [{ physicalLocation: { artifactLocation: { uri: "lib/domain/" + f }, region: { startLine: i + 1 } } }],',
  "    });",
  "  });",
  "}",
  'fs.mkdirSync(".specgate/quality", { recursive: true });',
  'fs.writeFileSync(".specgate/quality/arch.sarif", JSON.stringify({ version: "2.1.0", runs: [{ results }] }));',
  "process.exit(results.length ? 1 : 0);",
].join(NL);

function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-arch-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib", "domain"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(
    path.join(dir, "lib/domain/order.js"),
    'const db = require("../infra/db");' + NL
  );
  fs.writeFileSync(path.join(dir, "arch.js"), TOOL);
  const adopt = spawnSync(
    process.execPath,
    [CLI, "adopt", "--project-dir", dir, "--no-capabilities"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(adopt.status, 0, adopt.stdout + adopt.stderr);
  const file = path.join(dir, "harness.config.yaml");
  const kept = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "harness_version: 1" + NL;
  fs.writeFileSync(
    file,
    `${kept.trimEnd()}${NL}arch_cmd: "node arch.js"${NL}arch_sarif: .specgate/quality/arch.sarif${NL}`
  );
  return { parent, dir };
}

const check = (dir: string) =>
  spawnSync(process.execPath, [CLI, "check", "--json", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

test("REQ-231 SCN-231a: existing architecture debt fails until it is baselined, then only new violations do", () => {
  const { parent, dir } = adopted();
  try {
    const before = check(dir);
    assert.notEqual(before.status, 0, "the debt fails the gate before a baseline");
    assert.match(before.stdout + before.stderr, /check_arch_failed/);

    const base = spawnSync(
      process.execPath,
      [CLI, "quality", "baseline", "--json", "--project-dir", dir],
      {
        encoding: "utf8",
      }
    );
    assert.equal(base.status, 0, base.stdout + base.stderr);
    const taken = JSON.parse(base.stdout.slice(base.stdout.indexOf("{"))).quality.checks;
    assert.deepEqual(taken, [{ name: "arch", findings: 1, skipped: "" }]);

    const after = check(dir);
    assert.equal(
      after.status,
      0,
      "the baselined debt passes, though the tool exits 1: " + after.stdout
    );

    fs.writeFileSync(
      path.join(dir, "lib/domain/invoice.js"),
      'const q = require("../infra/queue");' + NL
    );
    const added = spawnSync(process.execPath, [CLI, "check", dir], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.notEqual(added.status, 0);
    assert.match(added.stdout + added.stderr, /lib\/domain\/invoice\.js:1 \[domain-not-to-infra\]/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 10 });
  }
});
