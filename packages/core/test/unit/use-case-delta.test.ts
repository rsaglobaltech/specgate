/**
 * REQ-625: a change's use cases — added, modified, removed — checked against
 * the catalog and merged into docs/specs/use-cases.md (#543).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  applyUseCaseDelta,
  checkUseCaseDelta,
  parseUseCaseDelta,
  readCatalog,
} from "../../src/domain/UseCaseDelta";

const TEMPLATE = `# Use Cases

| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |
|---|---|---|---|---|---|---|---|
| UC-001 | Describe the first use case | Primary actor | REQ-TBD | CMD-001 ExampleCommand | AGG-001 CoreAggregate | EVT-001 ExampleEvent | Draft |
`;

const CATALOG = `# Use Cases

| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |
|---|---|---|---|---|---|---|---|
| UC-002 | Register a family account | Tutor | REQ-001 | CMD-001 Register | AGG-001 Family | EVT-001 Registered | Approved |
| UC-003 | Create a child profile | Tutor | REQ-002, REQ-003 | - | - | - | Approved |
`;

const delta = (body: string) => parseUseCaseDelta(`# Use cases — draft-x\n\n${body}`);

test("REQ-625 SCN-625a: a draft adds UC-004 — the catalog gets its row, the template row goes", () => {
  const d = delta(`## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-004 | Ask for a coloring sheet | Niño | REQ-021, REQ-022 |
`);
  assert.deepEqual(d.added, [
    {
      id: "UC-004",
      name: "Ask for a coloring sheet",
      actor: "Niño",
      requirements: ["REQ-021", "REQ-022"],
    },
  ]);
  assert.deepEqual(checkUseCaseDelta(d, readCatalog(TEMPLATE)), []);
  const merged = applyUseCaseDelta(TEMPLATE, d);
  assert.deepEqual(
    readCatalog(merged).map((r) => [r.id, r.name, r.requirements, r.template, r.status]),
    [["UC-004", "Ask for a coloring sheet", ["REQ-021", "REQ-022"], false, "Approved"]]
  );
  assert.match(merged, /^# Use Cases\n/);
});

test("REQ-625 SCN-625b: UC-003 modified — its row replaced, its command, aggregate and events kept", () => {
  const catalog = CATALOG.replace(
    "| - | - | - | Approved |",
    "| CMD-002 Create | AGG-002 Profile | EVT-002 Created | Approved |"
  );
  const d = delta(`## MODIFIED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-003 | Create or edit a child profile | Tutor | REQ-002, REQ-003, REQ-009 |
`);
  assert.deepEqual(checkUseCaseDelta(d, readCatalog(catalog)), []);
  const merged = applyUseCaseDelta(catalog, d);
  assert.match(
    merged,
    /\| UC-003 \| Create or edit a child profile \| Tutor \| REQ-002, REQ-003, REQ-009 \| CMD-002 Create \| AGG-002 Profile \| EVT-002 Created \| Approved \|/
  );
  assert.match(merged, /\| UC-002 \| Register a family account \|/, "the others stay");
});

test("REQ-625 SCN-625c: UC-002 removed while REQ-001 still names it — refused; once REQ-001 moves, removed", () => {
  const d = delta(`## REMOVED Use Cases

| ID | Reason |
| --- | --- |
| UC-002 | Accounts are created by the school |
`);
  const refused = checkUseCaseDelta(d, readCatalog(CATALOG), new Map([["REQ-001", "UC-002"]]));
  assert.deepEqual(
    refused.map((f) => f.code),
    ["uc_removed_in_use"]
  );
  assert.match(refused[0].message, /UC-002 is removed, and REQ-001 still names it/);
  assert.deepEqual(
    checkUseCaseDelta(d, readCatalog(CATALOG), new Map([["REQ-001", "UC-003"]])),
    []
  );
  const merged = applyUseCaseDelta(CATALOG, d);
  assert.deepEqual(
    readCatalog(merged).map((r) => r.id),
    ["UC-003"]
  );
});

test("REQ-625: what the checks refuse — a bad id, a repeat, an added id in the catalog, a modified one not in it, no name, no requirement, an unknown section", () => {
  const d = delta(`## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-1 | Short | Tutor | REQ-001 |
| UC-002 | Again | Tutor | REQ-001 |
| UC-009 |  | Tutor | REQ-010 |
| UC-010 | Nothing | Tutor | - |
| UC-010 | Twice | Tutor | REQ-011 |

## MODIFIED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-077 | Ghost | Tutor | REQ-001 |

## Notes
`);
  assert.deepEqual(
    checkUseCaseDelta(d, readCatalog(CATALOG)).map((f) => `${f.code}:${f.target ?? ""}`),
    [
      "uc_unknown_section:",
      "uc_invalid_id:UC-1",
      "uc_exists:UC-002",
      "uc_no_name:UC-009",
      "uc_no_requirement:UC-010",
      "uc_duplicate:UC-010",
      "uc_unknown:UC-077",
    ]
  );
});

test("REQ-625: the template's placeholder is marked, and a catalog with no table gets one", () => {
  assert.deepEqual(
    readCatalog(TEMPLATE).map((r) => r.template),
    [true]
  );
  const merged = applyUseCaseDelta(
    "# Use Cases\n\nWhat the actors achieve.\n",
    delta(`## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-002 | Register | Tutor | REQ-001 |
`)
  );
  assert.match(merged, /What the actors achieve\.\n\n\| ID \| Use Case \|/);
  assert.deepEqual(
    readCatalog(merged).map((r) => r.id),
    ["UC-002"]
  );
});
