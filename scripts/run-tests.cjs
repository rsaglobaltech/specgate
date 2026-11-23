#!/usr/bin/env node
"use strict";

/**
 * Cross-platform `node --test` glob expander.
 *
 * Usage:
 *   node scripts/run-tests.js <dir> [<dir>...]
 *
 * For each <dir> argument, finds all *.test.js files inside (one level deep)
 * and passes them to `node --test`. This sidesteps the Windows cmd.exe
 * limitation where shell globs are not expanded.
 *
 * Exits with the exit code of the underlying node --test invocation.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function findTests(dir) {
  if (!fs.existsSync(dir)) {
    process.stderr.write(`run-tests: directory not found: ${dir}\n`);
    process.exit(2);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".test.js"))
    .sort()
    .map((f) => path.join(dir, f));
}

function main() {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    process.stderr.write("run-tests: at least one directory argument required\n");
    process.exit(2);
  }

  const files = dirs.flatMap(findTests);
  if (files.length === 0) {
    process.stderr.write(`run-tests: no .test.js files found in ${dirs.join(", ")}\n`);
    process.exit(1);
  }

  // REQ-691: `harness run` asks each agent first; the suite's agents are
  // scripts that answer no prompt, so only the tests of that check run it.
  const result = spawnSync(process.execPath, ["--test", ...files], {
    stdio: "inherit",
    env: { ...process.env, SPECGATE_SKIP_DOCTOR: process.env.SPECGATE_SKIP_DOCTOR ?? "1" },
  });
  process.exit(result.status === null ? 1 : result.status);
}

main();
