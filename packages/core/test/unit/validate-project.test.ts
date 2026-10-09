/**
 * `ValidateProjectUseCase` is the only place that judges a traceability matrix.
 * `specgate validate` renders what it returns, so these tests are where that
 * judgement is pinned — the command tests exercise the rendering on top.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { ValidateProjectUseCase } from "../../src/application/ValidateProjectUseCase";
import { ITraceabilityRepository } from "../../src/application/ports/ITraceabilityRepository";
import { RICH_HEADER, LEGACY_HEADER } from "../../src/domain/TraceabilityFormat";

const SEP_10 = "|---|---|---|---|---|---|---|---|---|---|";

/** A rich matrix built from `[requirement, scenarioId, testArtifact, status]`. */
function richMatrix(rows: Array<[string, string, string, string]>): string {
  const body = rows.map(
    ([req, scn, test, status]) =>
      `| ${req} | ${scn} | f.feature | UC-1 | C | A | E | src/x.ts | ${test} | ${status} |`
  );
  return [RICH_HEADER, SEP_10, ...body].join("\n") + "\n";
}

function repoReturning(content: string | null): ITraceabilityRepository {
  return {
    readTraceability: () => content,
    writeTraceability: () => {
      throw new Error("validation must not write");
    },
  };
}

const useCase = (content: string | null = null) =>
  new ValidateProjectUseCase(repoReturning(content));

// ── the matrix shape ─────────────────────────────────────────────────────────

test("a missing traceability.md is an error naming the project", () => {
  const { report, mode } = useCase(null).execute("/tmp/proj");
  assert.equal(mode, null);
  assert.equal(report.valid, false);
  assert.deepEqual(
    report.errors.map((e) => e.code),
    ["traceability_missing"]
  );
  assert.match(report.errors[0].message, /\/tmp\/proj/);
});

test("neither header present is reported as a missing header, not as bad rows", () => {
  const { report, mode } = useCase().checkMatrix("# Traceability Matrix\n\nnothing here\n");
  assert.equal(mode, null);
  assert.deepEqual(
    report.errors.map((e) => e.code),
    ["traceability_header_missing"]
  );
  assert.ok(report.errors[0].fixLines?.some((l) => l.includes(RICH_HEADER)));
});

test("both matrix shapes are recognised", () => {
  assert.equal(useCase().checkMatrix(richMatrix([])).mode, "rich");
  const legacy = [
    LEGACY_HEADER,
    "|---|---|---|---|",
    "| f.feature | SCN-001 | src/x.ts | Draft |",
  ].join("\n");
  assert.equal(useCase().checkMatrix(legacy).mode, "legacy");
});

// ── row-level checks ─────────────────────────────────────────────────────────

test("a well-formed matrix produces no findings", () => {
  const { report, requirements } = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "SCN-001", "tests/a.test.ts", "Implemented"],
      ["REQ-002", "SCN-002", "tests/b.test.ts", "Draft"],
    ])
  );
  assert.deepEqual(report.findings, []);
  assert.deepEqual([...requirements].sort(), ["REQ-001", "REQ-002"]);
});

test("an unknown status is an error that lists what is allowed", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([["REQ-001", "SCN-001", "tests/a.test.ts", "Shipped"]])
  );
  const finding = report.errors.find((e) => e.code === "invalid_status");
  assert.ok(finding, "expected invalid_status");
  assert.match(finding!.message, /Shipped/);
  assert.ok(finding!.fixLines?.[0].includes("Ready for Dev"));
});

test("a repeated Requirement ID is an error — it is the primary key", () => {
  // The state three cold adoptions reached through `adopt` then `req add`:
  // two different requirements under one id, every gate green. `req link`
  // writes every matching row, so linking one retargets the other.
  const { report } = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "SCN-001", "tests/a.test.ts", "Draft"],
      ["REQ-002", "SCN-002", "tests/b.test.ts", "Draft"],
      ["REQ-002", "SCN-003", "tests/c.test.ts", "Draft"],
    ])
  );
  const finding = report.errors.find((e) => e.code === "duplicate_requirement_id");
  assert.ok(finding, "expected duplicate_requirement_id");
  assert.match(finding!.message, /REQ-002/);
  assert.ok(finding!.fixLines?.length, "a finding without a fix is not actionable");
});

test("distinct requirement ids are left alone", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "SCN-001", "tests/a.test.ts", "Draft"],
      ["REQ-002", "SCN-002", "tests/b.test.ts", "Draft"],
    ])
  );
  assert.equal(report.errors.filter((e) => e.code === "duplicate_requirement_id").length, 0);
});

test("a repeated Scenario ID is an error, but `-` is not an id", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "SCN-001", "tests/a.test.ts", "Draft"],
      ["REQ-002", "SCN-001", "tests/b.test.ts", "Draft"],
    ])
  );
  assert.deepEqual(
    report.errors.map((e) => e.code),
    ["duplicate_scenario_id"]
  );

  const placeholders = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "-", "tests/a.test.ts", "Draft"],
      ["REQ-002", "-", "tests/b.test.ts", "Draft"],
    ])
  );
  assert.deepEqual(placeholders.report.findings, []);
});

// ── the strict-TDD gate ──────────────────────────────────────────────────────

test("strict TDD is off by default", () => {
  const matrix = richMatrix([["REQ-001", "SCN-001", "TBD", "In Dev"]]);
  assert.deepEqual(useCase().checkMatrix(matrix).report.findings, []);
});

test("TDD-1: a TBD test artifact past Draft is a violation", () => {
  const { report } = useCase().checkMatrix(richMatrix([["REQ-001", "SCN-001", "TBD", "In Dev"]]), {
    strictTdd: true,
  });
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0].message, /^\[TDD-1\]/);
});

test("TDD-1 does not fire while the row is still Draft", () => {
  const { report } = useCase().checkMatrix(richMatrix([["REQ-001", "SCN-001", "TBD", "Draft"]]), {
    strictTdd: true,
  });
  assert.deepEqual(report.findings, []);
});

test("#59: TDD-1 does not fire while the row waits on a question", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([["REQ-008", "SCN-023", "TBD", "Needs Clarification"]]),
    { strictTdd: true }
  );
  assert.deepEqual(report.findings, []);
});

test("TDD-2: a row past Draft with no Scenario ID is a violation", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([["REQ-001", "", "tests/a.test.ts", "Ready for Dev"]]),
    { strictTdd: true }
  );
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0].message, /^\[TDD-2\]/);
});

test("TDD-3: a REQ in spec.md with no matrix row is a violation", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([["REQ-001", "SCN-001", "tests/a.test.ts", "Implemented"]]),
    { strictTdd: true, specContent: "REQ-001 is here and so is REQ-002.\n" }
  );
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0].message, /^\[TDD-3\] Requirement REQ-002/);
});

test("TDD-3 is skipped when spec.md was not supplied", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([["REQ-001", "SCN-001", "tests/a.test.ts", "Implemented"]]),
    { strictTdd: true, specContent: null }
  );
  assert.deepEqual(report.findings, []);
});

test("findings keep the order the checks ran in, so the first error is stable", () => {
  const { report } = useCase().checkMatrix(
    richMatrix([
      ["REQ-001", "SCN-001", "tests/a.test.ts", "Bogus"],
      ["REQ-002", "SCN-001", "TBD", "In Dev"],
    ]),
    { strictTdd: true }
  );
  // Per row: duplicate id, then status, then the TDD gate. Note TDD-1 needs a
  // *valid* post-Draft status, so an unknown status suppresses it on that row.
  assert.deepEqual(
    report.findings.map((f) => f.code),
    ["invalid_status", "duplicate_scenario_id", "strict_tdd_violation"]
  );
});

test("validation never writes the matrix back", () => {
  // The repository throws on write; reaching the end means nothing tried.
  assert.doesNotThrow(() =>
    useCase(richMatrix([["REQ-001", "SCN-001", "tests/a.test.ts", "Draft"]])).execute("/tmp/proj")
  );
});
