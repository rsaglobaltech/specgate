/**
 * REQ-627: the gate's use_cases rule — every requirement names a use case of
 * the catalog, every use case is delivered, no template row is left.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { useCaseCoverage } from "../../src/domain/UseCaseDelta";

const CATALOG = `| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |
|---|---|---|---|---|---|---|---|
| UC-002 | Register a family | Tutor | REQ-001 | - | - | - | Approved |
| UC-003 | Delete a profile | Tutor | REQ-009 | - | - | - | Approved |
`;

test("REQ-627 SCN-627c: what the rule names — a requirement with none, one with an unknown use case, an undelivered use case", () => {
  const found = useCaseCoverage(
    [
      { requirement: "REQ-000", useCase: "UC-000" },
      { requirement: "REQ-001", useCase: "UC-002" },
      { requirement: "REQ-002", useCase: "-" },
      { requirement: "REQ-003", useCase: "UC-077" },
    ],
    CATALOG
  );
  assert.deepEqual(
    found.map((f) => `${f.code}:${f.target}`),
    ["use_case_missing:REQ-002", "use_case_unknown:REQ-003", "use_case_undelivered:UC-003"]
  );
});

test("REQ-627: a catalog every requirement names, and that every requirement delivers — nothing to say", () => {
  assert.deepEqual(
    useCaseCoverage(
      [
        { requirement: "REQ-001", useCase: "UC-002" },
        { requirement: "REQ-009", useCase: "UC-003" },
      ],
      CATALOG
    ),
    []
  );
});
