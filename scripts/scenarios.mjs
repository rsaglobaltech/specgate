#!/usr/bin/env node
/**
 * specgate's own `bdd_cmd` (executable scenarios, REQ-661): a requirement's
 * scenarios run — the tests whose titles name the tags given (`@REQ-664`,
 * `@SCN-664a`), as every test here names the scenario it proves — from what
 * `npx tsc` compiled into dist/tests.
 *
 *   node scripts/scenarios.mjs @REQ-664
 *
 * Exits 1 when no test names a tag, when one is not compiled yet, or when one fails.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ids = process.argv
  .slice(2)
  .join(" ")
  .split(/[\s,|]+/)
  .map((t) => t.replace(/^@/, ""))
  .filter((t) => /^(REQ|SCN)-[\w-]+$/.test(t));
if (ids.length === 0) {
  console.error("Give the scenarios' tags: node scripts/scenarios.mjs @REQ-664");
  process.exit(2);
}

const named = new RegExp(`\\b(${ids.join("|")})\\b`);
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const full = join(d, e.name).split("\\").join("/");
    if (e.isDirectory()) walk(full);
    else if (/\.test\.ts$/.test(e.name) && named.test(readFileSync(full, "utf8"))) files.push(full);
  }
};
walk("tests");
// The packages keep their own tests (packages/core/test/unit), compiled beside them.
if (existsSync("packages"))
  for (const p of readdirSync("packages")) if (existsSync(`packages/${p}/test`)) walk(`packages/${p}/test`);
if (files.length === 0) {
  console.error(`No test names ${ids.join(", ")}: its scenarios have no test yet.`);
  process.exit(1);
}

let failed = 0;
for (const file of files.sort()) {
  const js = `dist/${file.replace(/\.ts$/, ".js")}`;
  if (!existsSync(js)) {
    console.error(`${file} is not compiled: npx tsc first.`);
    failed++;
    continue;
  }
  console.log(`▶ ${js}`);
  const r = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=spec", `--test-name-pattern=\\b(${ids.join("|")})\\b`, js],
    // As in run-tests.cjs (REQ-691): the suite's agents are scripts that answer
    // no prompt, so only the tests of that check ask them first.
    {
      stdio: "inherit",
      timeout: 600_000,
      env: { ...process.env, SPECGATE_SKIP_DOCTOR: process.env.SPECGATE_SKIP_DOCTOR ?? "1",
        // REQ-748: the suite approves as the person at the terminal would; a test of the refusal unsets it.
        SPECGATE_ASSUME_TTY: process.env.SPECGATE_ASSUME_TTY ?? "1" },
    },
  );
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
