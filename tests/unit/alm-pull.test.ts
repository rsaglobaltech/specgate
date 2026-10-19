/**
 * `specgate alm pull` — a board issue arriving as a reviewable change (E2-03).
 *
 * ADR-0021 governs the shape: the board never writes a matrix row, inbound work
 * enters as a change, and the scenario is left unwritten because a ticket
 * carries no executable acceptance criterion.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_DIR = path.join(ROOT_DIR, "dist", "scripts", "alm", "cli.js");

/** A project with an alm.config.yaml pointing at github. */
function withProject(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-pull-"));
  try {
    fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs", "specs", "traceability.md"),
      [
        "# Traceability Matrix",
        "",
        "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
        "|---|---|---|---|---|---|---|---|---|---|",
        "| REQ-001 | SCN-001 | `features/f.feature` | U | C | A | E | `s.ts` | `t.ts` | Draft |",
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const GH_CONFIG = [
  "alm_version: 1",
  "provider: github",
  "repo: acme/widgets",
  "token_env: SPECGATE_PULL_TOK",
  "",
].join("\n");

/**
 * Run `alm pull` with the board faked at the `fetch` boundary — the same seam
 * the conformance kit uses, so no network and no provider-specific stubbing.
 */
function runPull(dir: string, issues: unknown[], extra: string[] = []) {
  // The issues go in a file the shim reads, not interpolated into its source.
  // `JSON.stringify` is not an escape for JavaScript source — U+2028 and U+2029
  // are valid in JSON strings and terminate a line in a script — and building
  // code out of data is the habit worth not having in a test either
  // (js/bad-code-sanitization).
  const shim = path.join(dir, "shim.js");
  const issuesFile = path.join(dir, "issues.json");
  fs.writeFileSync(issuesFile, JSON.stringify(issues), "utf8");
  fs.writeFileSync(
    shim,
    [
      `const issues = require("node:fs").readFileSync(process.argv[2], "utf8");`,
      `globalThis.fetch = async () => ({ ok: true, status: 200,`,
      `  json: async () => JSON.parse(issues), text: async () => "" });`,
      `const target = process.argv[3];`,
      `process.argv = [process.argv[0], target, ...process.argv.slice(4)];`,
      `require(target);`,
    ].join("\n"),
    "utf8"
  );
  return spawnSync(
    process.execPath,
    [shim, issuesFile, CLI_DIR, "pull", "--project-dir", dir, ...extra],
    {
      encoding: "utf8",
      env: { ...process.env, SPECGATE_PULL_TOK: "tok" },
    }
  );
}

const ISSUE = {
  number: 7,
  title: "Charge more at peak hours",
  body: "Flat tariff subsidises peak load.",
  html_url: "https://github.com/acme/widgets/issues/7",
};

test("a pulled issue becomes a change, never a matrix row", () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), GH_CONFIG, "utf8");
    const before = fs.readFileSync(path.join(dir, "docs", "specs", "traceability.md"), "utf8");

    const result = runPull(dir, [ISSUE]);
    assert.equal(result.status, 0, result.stderr + result.stdout);

    const changeDir = path.join(dir, "docs", "specs", "changes", "alm-7");
    assert.ok(fs.existsSync(path.join(changeDir, "proposal.md")));
    assert.ok(fs.existsSync(path.join(changeDir, "change.yaml")));
    assert.ok(fs.existsSync(path.join(changeDir, "specs", "7", "spec.md")));

    // ADR-0021: the board is a mirror. It may not touch the matrix.
    assert.equal(
      fs.readFileSync(path.join(dir, "docs", "specs", "traceability.md"), "utf8"),
      before,
      "the matrix must be untouched by an inbound pull"
    );
  });
});

test("the pulled delta does not satisfy the gate", () => {
  // The load-bearing behaviour of the whole feature. A change whose scenario is
  // a placeholder must be refused, or `alm pull` would be the "import tickets
  // with a placeholder scenario" option ADR-0021 explicitly rejected.
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), GH_CONFIG, "utf8");
    assert.equal(runPull(dir, [ISSUE]).status, 0);

    const validate = spawnSync(
      process.execPath,
      [
        path.join(ROOT_DIR, "dist", "scripts", "change", "cli.js"),
        "validate",
        "alm-7",
        "--project-dir",
        dir,
      ],
      { encoding: "utf8" }
    );
    const output = validate.stdout + validate.stderr;
    assert.match(output, /scenario_steps_unwritten/);
    assert.match(output, /asserts nothing/);
  });
});

test("pulling twice does not duplicate a change somebody may have edited", () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), GH_CONFIG, "utf8");
    assert.equal(runPull(dir, [ISSUE]).status, 0);

    const proposal = path.join(dir, "docs", "specs", "changes", "alm-7", "proposal.md");
    fs.appendFileSync(proposal, "\nEdited by a human.\n", "utf8");

    const second = runPull(dir, [ISSUE]);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout + second.stderr, /skipped|already/i);
    assert.match(
      fs.readFileSync(proposal, "utf8"),
      /Edited by a human\./,
      "a second pull must not overwrite work already started"
    );
  });
});

test("--dry-run reports what it would pull and writes nothing", () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), GH_CONFIG, "utf8");
    const result = runPull(dir, [ISSUE], ["--dry-run"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /alm-7/);
    assert.equal(fs.existsSync(path.join(dir, "docs", "specs", "changes")), false);
  });
});

test("a provider that cannot search says so instead of failing mid-run", () => {
  // Azure searches with WIQL, a different shape entirely, so it declares
  // listIssues: false. The capability exists to make that a message rather than
  // a stack trace at the first request.
  withProject((dir) => {
    fs.writeFileSync(
      path.join(dir, "alm.config.yaml"),
      [
        "alm_version: 1",
        "provider: azure",
        "base_url: https://dev.azure.com/acme",
        "project_key: P",
        "token_env: SPECGATE_PULL_TOK",
        "",
      ].join("\n"),
      "utf8"
    );
    const result = runPull(dir, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /alm_pull_unsupported|cannot search/);
    assert.match(result.stderr, /specgate propose/, "it should say how to do it by hand");
  });
});
