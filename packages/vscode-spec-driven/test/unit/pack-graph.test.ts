import * as yaml from "js-yaml";
("use strict");

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  collectDeclared,
  findReferencePosition,
  analyzePackGraph,
  referenceKindForLine,
  findDeclarationPosition,
  buildPackGraphModel,
  renderPackMermaid,
} from "../../src/pack-graph";

const GOOD_PACK = `
requirements:
  - id: REQ-001
    title: Alert on capacity
use_cases:
  - id: UC-001
    name: Monitor Capacity
    requirement: REQ-001
    command: CheckCapacityCommand
    aggregate: ParkingFacility
    emits:
      - CapacityThresholdReached
commands:
  - id: CMD-001
    name: CheckCapacityCommand
aggregates:
  - id: AGG-001
    name: ParkingFacility
events:
  - id: EVT-001
    name: CapacityThresholdReached
scenarios:
  - id: SCN-001
    requirement: REQ-001
`;

// ── collectDeclared ──────────────────────────────────────────────────────────

test("collectDeclared gathers ids and names by reference kind", () => {
  const declared = collectDeclared(yaml.load(GOOD_PACK));
  assert.ok(declared.requirement.has("REQ-001"));
  assert.ok(declared.use_case.has("UC-001"));
  // commands/aggregates/events are referenceable by id AND by name
  assert.ok(declared.command.has("CMD-001"));
  assert.ok(declared.command.has("CheckCapacityCommand"));
  assert.ok(declared.aggregate.has("ParkingFacility"));
  assert.ok(declared.event.has("CapacityThresholdReached"));
});

test("collectDeclared tolerates a null/!object pack", () => {
  const declared = collectDeclared(null);
  assert.equal(declared.requirement.size, 0);
});

// ── findReferencePosition ────────────────────────────────────────────────────

test("findReferencePosition locates a value after a key", () => {
  const lines = ["use_cases:", "  - id: UC-001", "    requirement: REQ-999"];
  const pos = findReferencePosition(lines, "REQ-999");
  assert.equal(pos.line, 2);
  assert.equal(lines[pos.line].slice(pos.col), "REQ-999");
});

test("findReferencePosition locates a value inside a list item", () => {
  const lines = ["    emits:", "      - GhostEvent"];
  const pos = findReferencePosition(lines, "GhostEvent");
  assert.equal(pos.line, 1);
  assert.equal(lines[pos.line].slice(pos.col), "GhostEvent");
});

test("findReferencePosition does not match a substring of a longer token", () => {
  const lines = ["    command: CheckCapacityCommandV2"];
  const pos = findReferencePosition(lines, "CheckCapacityCommand");
  // No whole-token match → falls back to 0,0
  assert.deepEqual(pos, { line: 0, col: 0 });
});

// ── analyzePackGraph ─────────────────────────────────────────────────────────

test("analyzePackGraph reports no dangling references for a well-formed pack", () => {
  const { dangling } = analyzePackGraph(GOOD_PACK);
  assert.deepEqual(dangling, []);
});

test("analyzePackGraph flags every dangling use_case reference with a position", () => {
  const bad = `
requirements:
  - id: REQ-001
    title: t
use_cases:
  - id: UC-001
    requirement: REQ-999
    command: GhostCommand
    aggregate: GhostAggregate
    emits:
      - GhostEvent
commands: []
aggregates: []
events: []
`;
  const { dangling } = analyzePackGraph(bad);
  assert.equal(dangling.length, 4);
  const messages = dangling.map((d) => d.message).join("\n");
  assert.match(messages, /unknown requirement: REQ-999/);
  assert.match(messages, /unknown command: GhostCommand/);
  assert.match(messages, /unknown aggregate: GhostAggregate/);
  assert.match(messages, /unknown event: GhostEvent/);
  // Each diagnostic carries a real line (not all 0,0).
  assert.ok(dangling.every((d) => d.severity === "error"));
  assert.ok(dangling.some((d) => d.line > 0));
});

test("analyzePackGraph counts use-case and scenario references per requirement", () => {
  const { refCounts } = analyzePackGraph(GOOD_PACK);
  const req1 = refCounts.get("REQ-001");
  assert.deepEqual(req1, { useCases: 1, scenarios: 1 });
});

test("analyzePackGraph stays silent on unparseable YAML", () => {
  const result = analyzePackGraph("this: : : not valid");
  assert.deepEqual(result.dangling, []);
  assert.equal(result.refCounts.size, 0);
});

// ── referenceKindForLine ─────────────────────────────────────────────────────

test("referenceKindForLine recognises inline reference fields", () => {
  assert.equal(referenceKindForLine(["    requirement: REQ-001"], 0), "requirement");
  assert.equal(referenceKindForLine(["    command: Foo"], 0), "command");
  assert.equal(referenceKindForLine(["    aggregate: Bar"], 0), "aggregate");
  assert.equal(referenceKindForLine(["    name: Foo"], 0), null);
});

test("referenceKindForLine resolves a list item to its block key's kind", () => {
  const lines = ["  - id: UC-001", "    emits:", "      - SomeEvent"];
  assert.equal(referenceKindForLine(lines, 2), "event");

  const reqList = ["  - id: UC-002", "    requirements:", "      - REQ-009"];
  assert.equal(referenceKindForLine(reqList, 2), "requirement");
});

test("referenceKindForLine returns null for an unrelated list item", () => {
  const lines = ["payload:", "  - facility_id"];
  assert.equal(referenceKindForLine(lines, 1), null);
});

// ── findDeclarationPosition ──────────────────────────────────────────────────

test("findDeclarationPosition locates an id declaration", () => {
  const pos = findDeclarationPosition(GOOD_PACK, "REQ-001");
  assert.ok(pos);
  const declLine = GOOD_PACK.split("\n")[pos.line];
  assert.match(declLine, /id:\s*REQ-001/);
});

test("findDeclarationPosition locates a name declaration", () => {
  const pos = findDeclarationPosition(GOOD_PACK, "CheckCapacityCommand");
  assert.ok(pos);
  assert.match(GOOD_PACK.split("\n")[pos.line], /name:\s*CheckCapacityCommand/);
});

test("findDeclarationPosition returns null when the entity is not declared", () => {
  assert.equal(findDeclarationPosition(GOOD_PACK, "REQ-404"), null);
});

// ── buildPackGraphModel / renderPackMermaid ──────────────────────────────────

test("buildPackGraphModel wires the REQ→UC→CMD/AGG/EVT spine", () => {
  const { nodes, edges } = buildPackGraphModel(yaml.load(GOOD_PACK));
  const types = [...new Set(nodes.map((n) => n.type))].sort();
  assert.deepEqual(types, ["aggregate", "command", "event", "requirement", "use_case"]);

  const edge = (from: string, kind: string) => {
    const found = edges.find(
      (e: { from: string; to: string; kind: string }) => e.from === from && e.kind === kind
    );
    assert.ok(found, `no ${kind} edge from ${from}`);
    return found;
  };
  assert.equal(edge("REQ:REQ-001", "implements").to, "UC:UC-001");
  assert.equal(edge("UC:UC-001", "dispatches").to, "CMD:CMD-001");
  assert.equal(edge("UC:UC-001", "emits").to, "EVT:EVT-001");
});

test("buildPackGraphModel turns a dangling reference into a missing node", () => {
  const bad = yaml.load(`
use_cases:
  - id: UC-001
    command: GhostCommand
commands: []
`);
  const { nodes } = buildPackGraphModel(bad);
  assert.ok(nodes.some((n) => n.type === "missing" && n.label === "GhostCommand"));
});

test("renderPackMermaid emits a graph with sanitized ids and classDefs", () => {
  const mermaid = renderPackMermaid(GOOD_PACK);
  assert.match(mermaid, /^graph LR/);
  assert.match(mermaid, /REQ_REQ_001\["REQ-001"\]:::requirement/);
  assert.match(mermaid, /-->\|implements\|/);
  assert.match(mermaid, /classDef missing fill:#ff6b6b/);
});

test("renderPackMermaid degrades gracefully on empty or unparseable content", () => {
  assert.match(renderPackMermaid(""), /no requirements \/ use cases/);
  assert.match(renderPackMermaid("not: : valid"), /^graph LR/);
});
