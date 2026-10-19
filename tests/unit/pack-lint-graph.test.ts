"use strict";

import { test } from "node:test";
import assert = require("node:assert/strict");

import { parseArgs, buildPackGraph, renderMermaid, renderDot } from "../../scripts/lint_pack";

// A small, well-formed pack: one full REQ→UC→CMD/AGG/EVT spine.
const goodPack = {
  requirements: [{ id: "REQ-001", title: "Alert on capacity" }],
  use_cases: [
    {
      id: "UC-001",
      name: "Monitor Capacity",
      requirement: "REQ-001",
      command: "CheckCapacityCommand",
      aggregate: "ParkingFacility",
      emits: ["CapacityThresholdReached"],
    },
  ],
  commands: [{ id: "CMD-001", name: "CheckCapacityCommand" }],
  aggregates: [{ id: "AGG-001", name: "ParkingFacility" }],
  events: [{ id: "EVT-001", name: "CapacityThresholdReached" }],
};

// ── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs accepts --graph and defaults --graph-format to mermaid", () => {
  const opts = parseArgs(["--pack-root", "p", "--pack", "x", "--graph"]);
  assert.equal(opts.graph, true);
  assert.equal(opts.graphFormat, "mermaid");
});

test("parseArgs reads --graph-format dot", () => {
  const opts = parseArgs(["--graph", "--graph-format", "dot"]);
  assert.equal(opts.graphFormat, "dot");
});

// ── buildPackGraph ───────────────────────────────────────────────────────────

test("buildPackGraph builds a node per declared entity", () => {
  const graph = buildPackGraph(goodPack);
  const types = graph.nodes.map((n) => n.type).sort();
  assert.deepEqual(types, ["aggregate", "command", "event", "requirement", "use_case"]);
  assert.equal(graph.broken.length, 0);
});

test("buildPackGraph wires the REQ→UC→CMD/AGG/EVT spine", () => {
  const graph = buildPackGraph(goodPack);
  const edge = (from: string, kind: string) =>
    graph.edges.find((e) => e.from === from && e.kind === kind);

  assert.equal(edge("REQ:REQ-001", "implements")?.to, "UC:UC-001");
  assert.equal(edge("UC:UC-001", "dispatches")?.to, "CMD:CMD-001");
  assert.equal(edge("UC:UC-001", "handled by")?.to, "AGG:AGG-001");
  assert.equal(edge("UC:UC-001", "emits")?.to, "EVT:EVT-001");
});

test("buildPackGraph records dangling references and adds a missing node", () => {
  const broken = {
    requirements: [{ id: "REQ-001", title: "t" }],
    use_cases: [
      {
        id: "UC-001",
        name: "Do Thing",
        requirement: "REQ-999",
        command: "GhostCommand",
        aggregate: "GhostAggregate",
        emits: ["GhostEvent"],
      },
    ],
    commands: [],
    aggregates: [],
    events: [],
  };
  const graph = buildPackGraph(broken);

  assert.equal(graph.broken.length, 4);
  const kinds = graph.broken.map((b) => b.kind).sort();
  assert.deepEqual(kinds, ["aggregate", "command", "event", "requirement"]);

  // Each dangling ref still produces a (missing-typed) node so the diagram shows the break.
  const missing = graph.nodes.filter((n) => n.type === "missing");
  assert.equal(missing.length, 4);
  assert.ok(missing.some((n) => n.label === "REQ-999"));
});

test("buildPackGraph resolves a command referenced by id as well as by name", () => {
  const pack = {
    requirements: [{ id: "REQ-001", title: "t" }],
    use_cases: [{ id: "UC-001", requirement: "REQ-001", command: "CMD-001" }],
    commands: [{ id: "CMD-001", name: "RealCommand" }],
    aggregates: [],
    events: [],
  };
  const graph = buildPackGraph(pack);
  assert.equal(graph.broken.length, 0);
  assert.ok(graph.edges.some((e) => e.from === "UC:UC-001" && e.to === "CMD:CMD-001"));
});

// ── renderMermaid ────────────────────────────────────────────────────────────

test("renderMermaid emits a graph with sanitized ids, edge labels and classDefs", () => {
  const mermaid = renderMermaid(buildPackGraph(goodPack));
  assert.match(mermaid, /^graph LR/);
  // Hyphens in ids are not valid Mermaid node ids — they must be sanitized.
  assert.ok(!/\bREQ-001\[/.test(mermaid));
  assert.match(mermaid, /REQ_REQ_001\["REQ-001"\]:::requirement/);
  assert.match(mermaid, /-->\|implements\|/);
  assert.match(mermaid, /classDef missing fill:#ff6b6b/);
});

test("renderMermaid marks dangling references with the missing class", () => {
  const pack = {
    requirements: [],
    use_cases: [{ id: "UC-001", requirement: "REQ-404" }],
    commands: [],
    aggregates: [],
    events: [],
  };
  const mermaid = renderMermaid(buildPackGraph(pack));
  assert.match(mermaid, /:::missing/);
});

// ── renderDot ────────────────────────────────────────────────────────────────

test("renderDot emits a left-to-right digraph with labelled edges", () => {
  const dot = renderDot(buildPackGraph(goodPack));
  assert.match(dot, /^digraph pack \{/);
  assert.match(dot, /rankdir=LR;/);
  assert.match(dot, /"REQ:REQ-001" -> "UC:UC-001" \[label="implements"\];/);
  assert.match(dot, /\}$/);
});
