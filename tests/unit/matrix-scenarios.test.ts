/**
 * studio-phase3-json: `matrix --json` and the API's `matrix(dir)` answer one
 * row per scenario, with its links, the links it is missing and the question
 * it waits for (REQ-498).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import * as api from "../../scripts/api";
import { scenarioRows } from "../../packages/core/src/domain/MatrixScenarios";
import {
  FIXTURE,
  cliJson,
  feature,
  newProject,
  removeProject,
  specRequirement,
  write,
} from "../helpers/project";

/** REQ-001 with two scenarios, a test and code; REQ-002 with a feature alone. */
function orders(): string {
  const dir = newProject("sg-matrix-");
  specRequirement(dir, "REQ-001", "Place an order");
  specRequirement(dir, "REQ-002", "Free shipping");
  feature(dir, "features/orders/REQ-001.feature", "REQ-001", ["SCN-001a", "SCN-001b"]);
  feature(dir, "features/orders/REQ-002.feature", "REQ-002", ["SCN-002a"]);
  write(dir, "tests/orders.test.js", "// REQ-001: placing an order\n");
  write(dir, "src/orders.js", "// REQ-001\nmodule.exports = {};\n");
  return dir;
}

type Row = { requirement: string; scenario: string | null; [k: string]: unknown };

test("REQ-498 SCN-498a: one row per scenario, with the feature, tests, code and the links each row is missing", async () => {
  const dir = orders();
  try {
    const { status, doc } = cliJson(dir, "matrix", "--dry-run");
    assert.equal(status, 0, JSON.stringify(doc));
    const rows: Row[] = doc.matrix.scenarios;
    const of = (scn: string) => rows.find((r) => r.scenario === scn);
    for (const scn of ["SCN-001a", "SCN-001b"]) {
      assert.deepEqual(
        of(scn),
        {
          requirement: "REQ-001",
          scenario: scn,
          feature: "features/orders/REQ-001.feature",
          tests: ["tests/orders.test.js"],
          code: ["src/orders.js"],
          status: of(scn)?.status,
          gaps: [],
          waiting: null,
        },
        JSON.stringify(rows)
      );
    }
    assert.deepEqual(of("SCN-002a")?.gaps, ["test", "code"]);
    assert.equal(typeof doc.matrix.rows, "number", "rows stays the count");

    // The API answers the same.
    assert.deepEqual(await api.matrix(dir), doc);
  } finally {
    removeProject(dir);
  }
});

test("REQ-498 SCN-498b: Q2 of the open change draft-orders blocks REQ-002, and its row says so", async () => {
  const dir = orders();
  try {
    const change = "docs/specs/changes/draft-orders";
    fs.cpSync(
      path.join(FIXTURE, "draft-orders", "change.yaml"),
      path.join(dir, change, "change.yaml")
    );
    write(
      dir,
      `${change}/questions.md`,
      "# Questions — draft-orders\n\n" +
        "| #   | Question                              | Blocks  |\n" +
        "| --- | ------------------------------------- | ------- |\n" +
        "| Q2  | Until when can an order be cancelled? | REQ-002 |\n"
    );
    const rows: Row[] = cliJson(dir, "matrix", "--dry-run").doc.matrix.scenarios;
    assert.deepEqual(rows.find((r) => r.requirement === "REQ-002")?.waiting, {
      question: "Q2",
      change: "draft-orders",
    });
    for (const r of rows.filter((x) => x.requirement === "REQ-001")) assert.equal(r.waiting, null);
  } finally {
    removeProject(dir);
  }
});

test("REQ-498: a hand-kept row with two scenario ids is two rows; a delivered baseline is not a gap; no scenario is null", () => {
  const exists = (rel: string) => rel === "features/a.feature" || rel === "tests/a.test.ts";
  const rows = scenarioRows(
    [
      {
        requirement: "REQ-001",
        scenarioId: "SCN-001a, SCN-001b",
        featureFile: "`features/a.feature`",
        technicalArtifact: "-",
        testArtifact: "tests/a.test.ts",
        status: "Approved",
      },
      {
        requirement: "REQ-002",
        scenarioId: "-",
        featureFile: "-",
        technicalArtifact: "existing codebase",
        testArtifact: "npm test",
        status: "Implemented",
      },
    ],
    exists
  );
  assert.deepEqual(
    rows.map((r) => [r.requirement, r.scenario, r.gaps]),
    [
      ["REQ-001", "SCN-001a", ["code"]],
      ["REQ-001", "SCN-001b", ["code"]],
      ["REQ-002", null, ["feature"]],
    ]
  );
  assert.deepEqual(rows[2].tests, [], "a command is not a test file");
});
