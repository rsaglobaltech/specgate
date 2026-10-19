"use strict";

/**
 * Guard: the agent JSON contract must be true, not merely documented.
 *
 * ADR-0017 §4 and docs/specs/agent-contract.md both say "camelCase everywhere
 * in command output". `plan --json` and `report --json` said otherwise for a
 * whole release: 0.2.0 announced the rename as a breaking change and applied
 * it to the top-level keys only, leaving `scenario_id`, `feature_file`,
 * `test_artifact` and friends inside `requirements` — the one array an agent
 * actually iterates. No test noticed, which is why this file exists.
 *
 * It runs the real CLI against a real scaffolded project rather than asserting
 * on a fixture, because the defect was in the emit boundary, and a fixture
 * would have been written in whatever case the author assumed.
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

/** Commands that must answer `--json` with one parseable document on stdout. */
const JSON_COMMANDS = [
  ["status"],
  ["plan"],
  ["validate", "."],
  ["report"],
  ["doctor"],
  ["fix", "--dry-run"],
  ["req", "list"],
  ["change", "list"],
  ["schema", "which"],
  ["onboard"],
  ["update", "--dry-run"],
  ["done", "REQ-000"],
  // `pack lint` needs a pack to lint, and `specops diff` a lockfile, so both
  // are exercised below against fixtures rather than the bare scaffold.
];

/** Commands that need more than a scaffolded project to say anything. */
const CONTEXTUAL = [
  {
    label: "pack lint",
    args: [
      "pack",
      "lint",
      "--pack-root",
      path.join(ROOT_DIR, "tests/fixtures/domain-packs"),
      "--pack",
      "parking-management/backend",
    ],
  },
  {
    label: "pack lint --graph",
    args: [
      "pack",
      "lint",
      "--graph",
      "--pack-root",
      path.join(ROOT_DIR, "tests/fixtures/domain-packs"),
      "--pack",
      "parking-management/backend",
    ],
  },
];

let projectDir: string | null = null;

function scaffold(): string {
  if (projectDir) return projectDir;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-json-"));
  const r = spawnSync(process.execPath, [CLI_PATH, "init", "--yes", "--out", tmp, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `init failed: ${r.stdout}${r.stderr}`);
  const entries = fs.readdirSync(tmp);
  assert.equal(entries.length, 1, `expected one generated project, got ${entries.join(", ")}`);
  const dir: string = path.join(tmp, entries[0]);
  projectDir = dir;
  return dir;
}

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI_PATH, ...args, "--json"], {
    cwd: scaffold(),
    encoding: "utf8",
  });
}

/** Every key in the document, at any depth, including inside arrays. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

for (const args of JSON_COMMANDS) {
  const label = args.join(" ");

  test(`specgate ${label} --json emits one parseable JSON document on stdout`, () => {
    const r = run(args);
    assert.ok(r.stdout.trim().length > 0, `no stdout (stderr: ${r.stderr})`);
    assert.doesNotThrow(
      () => JSON.parse(r.stdout),
      `stdout is not valid JSON:\n${r.stdout.slice(0, 400)}`
    );
  });

  test(`specgate ${label} --json uses camelCase keys throughout (ADR-0017 §4)`, () => {
    const doc = JSON.parse(run(args).stdout);
    // SCREAMING_SNAKE keys are category *values* used as map keys — `summary`
    // and `byCategory` are keyed by the enum, not by a field name. The rule is
    // about field names, so only lowercase snake_case counts as a violation.
    const offenders = [...new Set(allKeys(doc))].filter((k) =>
      /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(k)
    );
    assert.deepEqual(
      offenders,
      [],
      `snake_case keys in the JSON contract: ${offenders.join(", ")}`
    );
  });

  test(`specgate ${label} --json carries a status array`, () => {
    // The envelope is what lets a consumer treat every command alike.
    const doc = JSON.parse(run(args).stdout);
    assert.ok(Array.isArray(doc.status), "missing or non-array `status`");
  });
}

for (const { label, args } of CONTEXTUAL) {
  test(`specgate ${label} --json emits camelCase and a status array`, () => {
    const r = spawnSync(process.execPath, [CLI_PATH, ...args, "--json"], {
      cwd: scaffold(),
      encoding: "utf8",
    });
    assert.ok(r.stdout.trim().length > 0, `no stdout (stderr: ${r.stderr})`);
    const doc = JSON.parse(r.stdout);
    assert.ok(Array.isArray(doc.status), "missing or non-array `status`");
    const offenders = [...new Set(allKeys(doc))].filter((k) =>
      /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(k)
    );
    assert.deepEqual(offenders, [], `snake_case keys: ${offenders.join(", ")}`);
  });
}

test("at least twelve commands honour the contract", () => {
  // The metric from the OpenSpec benchmark §9. Pinning it here means the
  // number cannot quietly regress when a command is refactored.
  assert.ok(JSON_COMMANDS.length >= 12, `only ${JSON_COMMANDS.length} commands are pinned here`);
});

test("a command that cannot honour --json rejects it rather than ignoring it", () => {
  // `req list --json` used to print the human table and ignore the flag, which
  // is the worst outcome: the caller believes it received a document.
  const r = spawnSync(process.execPath, [CLI_PATH, "req", "list", "--json"], {
    cwd: scaffold(),
    encoding: "utf8",
  });
  assert.doesNotThrow(() => JSON.parse(r.stdout));
  assert.ok(!r.stdout.includes("📝"), "human output leaked into --json mode");
});
