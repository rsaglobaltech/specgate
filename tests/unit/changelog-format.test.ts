"use strict";

/**
 * REQ-195 — no inline code split across lines in the changelog.
 *
 * `apply` and `--status Approved` ended up on two lines of CHANGELOG.md, and
 * the second came out unindented in the release notes: a code span wrapped by
 * hand, that Prettier then moved. A line with an odd number of backticks is a
 * code span left open.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);

test("REQ-195 SCN-195a: every inline code span of CHANGELOG.md opens and closes on one line", () => {
  const lines = fs.readFileSync(path.join(ROOT_DIR, "CHANGELOG.md"), "utf8").split("\n");
  let fence = false;
  const split: string[] = [];
  lines.forEach((line: string, i: number) => {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const ticks = (line.replace(/``+/g, "").match(/`/g) || []).length;
    if (ticks % 2 === 1) split.push(`CHANGELOG.md:${i + 1}: ${line.trim().slice(0, 80)}`);
  });
  assert.deepEqual(split, [], "keep each `code span` on one line");
});
