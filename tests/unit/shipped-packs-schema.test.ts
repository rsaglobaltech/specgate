"use strict";

/**
 * Every pack this repository ships, validated against the schema that claims to
 * govern it (E1 / H13).
 *
 * ## Why this file did not exist, and had to
 *
 * ADR-0020 says it plainly: *"`schemas/pack.schema.json` is the single
 * authority. The validator, the installer, `pack init` and every shipped pack
 * conform to it."* Measured before writing this, ten of the eleven curated packs
 * failed that schema — while all eleven passed `pack lint --strict`.
 *
 * `tests/unit/pack-schema.test.ts` already validated against the schema, and
 * looked like the check that would have caught this. It validates **one fixture
 * pack**. The packs actually shipped were read by nobody. That is the same shape
 * as H14: a check that exists, appears to cover something, and is pointed
 * somewhere else.
 *
 * So this walks `packs/**` and validates what really goes out. A schema declared
 * the authority and enforced against nothing is a document, not a gate.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv/dist/2020");

const ROOT = path.resolve(__dirname, "../../..");
const PACKS_DIR = path.join(ROOT, "packs");

const { loadPack } = require("../../packages/core/src/infrastructure/DiskPackRepository");

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "pack.schema.json"), "utf8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

/** Every `domain/type` under `packs/` that carries a `pack.yaml`. */
function shippedPackIds(): string[] {
  const ids: string[] = [];
  for (const domain of fs.readdirSync(PACKS_DIR)) {
    const domainDir = path.join(PACKS_DIR, domain);
    if (!fs.statSync(domainDir).isDirectory()) continue;
    for (const type of fs.readdirSync(domainDir)) {
      if (fs.existsSync(path.join(domainDir, type, "pack.yaml"))) ids.push(`${domain}/${type}`);
    }
  }
  return ids.sort();
}

test("the walk finds the packs that are really there", () => {
  // Guards the test below from passing by looking at nothing — the failure mode
  // that makes a green suite meaningless.
  const ids = shippedPackIds();
  assert.ok(ids.length >= 10, `expected the curated packs, found ${ids.length}`);
  assert.ok(ids.includes("billing/backend"), ids.join(", "));
});

test("every shipped pack satisfies the schema ADR-0020 calls the authority", () => {
  const failures: string[] = [];

  for (const id of shippedPackIds()) {
    const { pack } = loadPack(PACKS_DIR, id);
    if (validate(pack)) continue;
    const detail = (validate.errors || [])
      .slice(0, 5)
      .map((e: any) => `      ${e.instancePath || "/"} ${e.message}`)
      .join("\n");
    failures.push(`${id}\n${detail}`);
  }

  assert.deepEqual(
    failures,
    [],
    "\n  These packs ship and do not satisfy their own schema. Either the pack is\n" +
      "  wrong or the schema is — but a schema declared the authority and enforced\n" +
      "  against nothing is a document, not a gate (H13):\n\n    " +
      failures.join("\n\n    ")
  );
});

test("a pack that violates the schema is caught, not waved through", () => {
  // Mutation-proofing: without it, the test above could pass because `validate`
  // never really ran.
  const { pack } = loadPack(PACKS_DIR, "billing/backend");
  const broken = { ...pack, metadata: { ...pack.metadata, project_type: "not-a-type" } };
  assert.equal(validate(broken), false, "an invalid project_type must not validate");
});

// ── What the mismatch actually cost (E1) ─────────────────────────────────────
//
// H13 read like a paperwork problem: a schema declaring authority it did not
// exercise. Measuring it turned up something worse. The schema said `context`
// and `invariants`, the packs write `bounded_context` and `responsibilities`,
// and the renderer read the schema's names — so installing any curated pack
// produced domain documents with empty columns:
//
//     | AGG-001 | Invoice | - | - |
//     | EVT-001 | InvoiceIssued | - | - | invoiceId: string, … |
//
// Not a red test. A worse product, shipped, for every pack.

test("a curated pack renders its context and producer, not a column of dashes", () => {
  const { pack } = loadPack(PACKS_DIR, "billing/backend");

  const aggregate = (pack.aggregates || [])[0];
  assert.ok(aggregate, "billing declares no aggregates");
  assert.ok(
    aggregate.bounded_context || aggregate.context,
    "an aggregate with no context to render makes this test vacuous"
  );

  const event = (pack.events || [])[0];
  assert.ok(event, "billing declares no events");
  assert.ok(
    event.producer || event.aggregate,
    "an event with no producer to render makes this test vacuous"
  );

  // The parser fix that goes with this: one quoted responsibility is one item.
  assert.deepEqual(aggregate.responsibilities, ["Invoice line items, totals, status, aging"]);
});

test("every shipped pack writes the inline string payload spelling", () => {
  // Issue #116 (and ADR-0020's own 2026-08-23 amendment) said one pack —
  // file-storage — used a block sequence of mappings (`payload:\n  - fileId:
  // string`, reading as an object per entry) against ten using the string
  // form (`payload: [fileId: string]`). Walking all eleven for this fix found
  // five in the object form, not one: file-storage, multi-tenant, reporting,
  // search, webhooks. The earlier count was never re-verified after being
  // written. All five migrated 2026-08-26 (ADR-0020) — every curated pack now
  // writes the same spelling, so a diff between two packs' payloads is a real
  // difference, not a notation accident.
  for (const id of shippedPackIds()) {
    const { pack } = loadPack(PACKS_DIR, id);
    for (const event of pack.events || []) {
      for (const field of event.payload || []) {
        assert.equal(
          typeof field,
          "string",
          `${id} event ${event.id} payload should be the string spelling, got ${typeof field}`
        );
      }
    }
  }
});

test("the object payload spelling still validates, for a community pack that already uses it", () => {
  // The schema documents both spellings deliberately (ADR-0020): retiring the
  // object form would reject a pack this repository does not control. Proven
  // against a mutated clone of a real pack, not a curated one, now that none
  // of the eleven use this form.
  const inline = loadPack(PACKS_DIR, "billing/backend").pack;
  assert.equal(typeof inline.events[0].payload[0], "string");
  assert.ok(validate(inline), "the inline spelling must validate");

  const block = JSON.parse(JSON.stringify(inline));
  block.events[0].payload = block.events[0].payload.map((field: string) => {
    const [key, type] = field.split(":").map((s) => s.trim());
    return { [key]: type };
  });
  assert.equal(typeof block.events[0].payload[0], "object");
  assert.ok(validate(block), "the block spelling must still validate");
});
