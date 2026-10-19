/**
 * `depends_on`, carried from a pack to the project (B1).
 *
 * A pack's requirements do not arrive as capability specs — the capability
 * document each pack ships is its own template — so they land in the
 * traceability matrix, and that is where a pack's `depends_on` has to arrive
 * too.
 *
 * It cannot ride in a cell. The row parser splits on `|` and requires exactly
 * ten cells, so anything appended to a row makes an eleventh and the row stops
 * parsing: the annotation would survive one write and vanish on the next
 * `expand`. On its own line beneath the table it is ignored by the row parser
 * by construction, which is the difference between round-trip safety and
 * round-trip carefulness.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  buildTraceabilityMarkdown,
  parseMatrixDependencies,
  parseTraceabilityRows,
  renderMatrixTraceLines,
} from "../../src/domain/TraceabilityFormat";

const row = (requirement: string, extra: any = {}) => ({
  requirement,
  scenarioId: `SCN-${requirement.slice(4)}`,
  featureFile: `features/${requirement}.feature`,
  status: "Draft",
  ...extra,
});

test("a matrix with no dependencies gains no annotation", () => {
  const md = buildTraceabilityMarkdown([row("REQ-001")], "rich");
  assert.doesNotMatch(md, /specgate:trace/);
  assert.deepEqual(parseMatrixDependencies(md), {});
});

test("a declared dependency is written beneath the table and read back", () => {
  const md = buildTraceabilityMarkdown(
    [row("REQ-001"), row("REQ-002", { dependsOn: ["REQ-001"] })],
    "rich"
  );
  assert.match(md, /<!-- specgate:trace REQ-002 depends=REQ-001 -->/);
  assert.deepEqual(parseMatrixDependencies(md), { "REQ-002": ["REQ-001"] });
});

test("the annotation survives a rebuild, which is the whole reason for its placement", () => {
  // `expand` reads the matrix, rebuilds it and writes it back. An annotation
  // that does not round-trip is one that disappears the second time a pack is
  // installed — the worst kind, because it worked when it was tested.
  const first = buildTraceabilityMarkdown(
    [row("REQ-001"), row("REQ-002", { dependsOn: ["REQ-001"] })],
    "rich"
  );
  const parsed = parseTraceabilityRows(first);
  assert.equal(parsed.rows.length, 2, "the rows must still parse alongside the annotation");
  assert.deepEqual((parsed.rows[1] as { dependsOn?: string[] }).dependsOn, ["REQ-001"]);

  const second = buildTraceabilityMarkdown(parsed.rows, "rich");
  assert.deepEqual(parseMatrixDependencies(second), { "REQ-002": ["REQ-001"] });
});

test("the rows still parse — the annotation is not mistaken for one", () => {
  const md = buildTraceabilityMarkdown(
    [row("REQ-001"), row("REQ-002", { dependsOn: ["REQ-001"] })],
    "rich"
  );
  const { rows, mode } = parseTraceabilityRows(md);
  assert.equal(mode, "rich");
  assert.deepEqual(
    rows.map((r: any) => r.requirement),
    ["REQ-001", "REQ-002"]
  );
});

test("several dependencies read back in order, and blank ones are dropped", () => {
  assert.deepEqual(renderMatrixTraceLines({ "REQ-003": { dependsOn: ["REQ-001", "REQ-002"] } }), [
    "",
    "<!-- specgate:trace REQ-003 depends=REQ-001,REQ-002 -->",
  ]);
  assert.deepEqual(renderMatrixTraceLines({ "REQ-003": { dependsOn: [] } }), []);
  assert.deepEqual(
    parseMatrixDependencies("<!-- specgate:trace REQ-003 depends=REQ-001, REQ-002 -->"),
    { "REQ-003": ["REQ-001", "REQ-002"] }
  );
});

test("a comment that is not one of ours is left alone", () => {
  assert.deepEqual(parseMatrixDependencies("<!-- a note from a person -->"), {});
  assert.deepEqual(parseMatrixDependencies("<!-- specgate:trace uc=UC-001 -->"), {});
});
