/**
 * studio-phase3-json: `report --format json` and the API's `report(dir)` give
 * the project's line coverage, read from the report its coverage tool wrote —
 * and null, never 0, when nothing measured it (REQ-499).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import * as api from "../../scripts/api";
import { totalLineCoverage } from "../../packages/core/src/domain/ChangeMeasures";
import { cliJson, newProject, removeProject, write } from "../helpers/project";
import { runCli } from "../helpers/cli";

/** LCOV for two files: 10 executable lines, 8 of them run. */
const LCOV = [
  "TN:",
  "SF:src/a.js",
  ...[1, 2, 3, 4, 5, 6].map((n) => `DA:${n},${n <= 5 ? 1 : 0}`),
  "end_of_record",
  "SF:src\\b.js",
  ...[1, 2, 3, 4].map((n) => `DA:${n},${n <= 3 ? 2 : 0}`),
  "end_of_record",
  "",
].join("\r\n");

function report(dir: string) {
  const r = runCli(["report", "--format", "json", "--stdout", "--project-dir", dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}

test("REQ-499 SCN-499a: an LCOV report gives 80% of 10 lines, the tool, the file and when; with none, null and how to get one", async () => {
  const dir = newProject("sg-coverage-");
  try {
    write(
      dir,
      "package.json",
      '{"name":"shop","version":"1.0.0","scripts":{"test":"node -e \\"\\""}}\n'
    );
    write(dir, "coverage/lcov.info", LCOV);
    const written = fs.statSync(path.join(dir, "coverage", "lcov.info")).mtime.toISOString();

    const doc = report(dir);
    assert.deepEqual(doc.coverage.lines, {
      percent: 80,
      covered: 8,
      total: 10,
      tool: "lcov",
      file: "coverage/lcov.info",
      measuredAt: written,
    });
    assert.deepEqual(await api.report(dir), doc, "the API answers what the command prints");

    fs.rmSync(path.join(dir, "coverage"), { recursive: true });
    const none = report(dir);
    assert.equal(none.coverage.lines, null, "never 0 for a coverage nothing measured");
    const finding = none.status.find((d: { code: string }) => d.code === "coverage_not_measured");
    assert.ok(finding, JSON.stringify(none.status));
    assert.match(finding.fix, /c8/);
  } finally {
    removeProject(dir);
  }
});

test("REQ-499: a report a quality check names wins; a report that measures no line is null", () => {
  const dir = newProject("sg-coverage-");
  try {
    write(dir, "coverage/lcov.info", LCOV);
    write(
      dir,
      "out/jacoco.xml",
      '<report name="x"><package name="com/acme"><sourcefile name="A.java">' +
        '<line nr="1" mi="0" ci="3"/><line nr="2" mi="1" ci="0"/></sourcefile></package></report>'
    );
    write(
      dir,
      "harness.config.yaml",
      'harness_version: 1\nchecks:\n  - name: coverage\n    run: "mvn -q verify"\n    when: end\n    runner: local\n    report: jacoco:out/jacoco.xml\n'
    );
    const lines = cliJson(dir, "report", "--format", "json", "--stdout").doc.coverage.lines;
    assert.equal(lines.tool, "jacoco");
    assert.equal(lines.file, "out/jacoco.xml");
    assert.equal(lines.percent, 50);

    assert.equal(totalLineCoverage("lcov", "SF:a.js\nend_of_record\n"), null);
    assert.equal(
      totalLineCoverage("istanbul", '{"total":{"lines":{"total":0,"covered":0}}}'),
      null
    );
    assert.deepEqual(
      totalLineCoverage("istanbul", '{"total":{"lines":{"total":4,"covered":3,"pct":75}}}'),
      { percent: 75, covered: 3, total: 4 }
    );
    assert.deepEqual(
      totalLineCoverage(
        "cobertura",
        '<coverage><class filename="a.py"><lines><line number="1" hits="1"/><line number="2" hits="0"/></lines></class></coverage>'
      ),
      { percent: 50, covered: 1, total: 2 }
    );
  } finally {
    removeProject(dir);
  }
});
