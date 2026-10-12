// specgate:allow-placeholders — this file emits or asserts on {{VAR}} template syntax.
"use strict";

/**
 * Property-based tests for core rendering and parsing logic.
 * Uses fast-check to stress-test the template renderer and config parser
 * with arbitrary inputs, uncovering edge cases that example-based tests miss.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");

const { renderTemplate } = require("../../packages/core/src/domain/PackSpec");

// ── Helpers ───────────────────────────────────────────────────────────────────

// Arbitrary for UPPER_SNAKE_CASE variable names
const varName = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,19}$/);

// Arbitrary for a simple vars map (1-5 entries, non-empty values only — empty
// string is treated as "missing" by normalizeVars)
const safeValue = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !s.includes("{") && !s.includes("}"));

const varsMap = fc.dictionary(varName, safeValue, { minKeys: 1, maxKeys: 5 });

// ── renderTemplate properties ─────────────────────────────────────────────────

test("renderTemplate: idempotent — rendering a rendered result produces the same output", () => {
  fc.assert(
    fc.property(varsMap, (vars) => {
      // Build a template with all vars referenced once
      const template = Object.keys(vars)
        .map((k) => `{{${k}}}`)
        .join(" ");
      const once = renderTemplate(template, vars);
      // Rendered output should not contain any {{...}} tokens
      assert.ok(!once.includes("{{"), `Rendered output still contains placeholders: ${once}`);
    }),
    { numRuns: 200 }
  );
});

test("renderTemplate: all placeholders are replaced — no {{VAR}} remains", () => {
  fc.assert(
    fc.property(
      varsMap,
      // Filler must not contain { or } to avoid creating accidental {{ patterns
      fc
        .string({ minLength: 0, maxLength: 100 })
        .filter((s) => !s.includes("{") && !s.includes("}")),
      (vars, filler) => {
        const tokens = Object.keys(vars).map((k) => `{{${k}}}`);
        const template = tokens.join(filler);
        const result = renderTemplate(template, vars);
        assert.ok(!result.includes("{{"), `Unreplaced placeholder in: ${result}`);
      }
    ),
    { numRuns: 200 }
  );
});

test("renderTemplate: value substitution is exact — no extra characters", () => {
  fc.assert(
    fc.property(
      varName,
      fc
        .string({ minLength: 1, maxLength: 30 })
        .filter((s) => !s.includes("{{") && !s.includes("}}")),
      (name, value) => {
        const template = `{{${name}}}`;
        const result = renderTemplate(template, { [name]: value });
        assert.equal(result, value);
      }
    ),
    { numRuns: 300 }
  );
});

test("renderTemplate: plain text with no placeholders is returned unchanged", () => {
  fc.assert(
    fc.property(
      fc
        .string({ minLength: 0, maxLength: 200 })
        .filter((s) => !s.includes("{{") && !s.includes("}}")),
      (text) => {
        const result = renderTemplate(text, {});
        assert.equal(result, text);
      }
    ),
    { numRuns: 300 }
  );
});

test("renderTemplate: multiple occurrences of the same placeholder are all replaced", () => {
  fc.assert(
    fc.property(
      varName,
      fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !s.includes("{{") && !s.includes("}}")),
      fc.integer({ min: 2, max: 10 }),
      (name, value, count) => {
        const template = Array.from({ length: count }, () => `{{${name}}}`).join("-");
        const result = renderTemplate(template, { [name]: value });
        const expected = Array.from({ length: count }, () => value).join("-");
        assert.equal(result, expected);
      }
    ),
    { numRuns: 200 }
  );
});

// ── normalizeVars properties ──────────────────────────────────────────────────

const { normalizeVars } = require("../../packages/core/src/domain/PackSpec");

test("normalizeVars: result includes all provided vars", () => {
  fc.assert(
    fc.property(varsMap, (vars) => {
      const required = Object.keys(vars);
      const result = normalizeVars(required, vars);
      for (const k of required) {
        assert.ok(k in result, `Key ${k} missing from normalized result`);
        assert.equal(result[k], vars[k]);
      }
    }),
    { numRuns: 200 }
  );
});

test("normalizeVars: extra vars beyond required are preserved", () => {
  fc.assert(
    fc.property(
      varsMap,
      varName,
      fc.string({ minLength: 1, maxLength: 20 }),
      (vars, extraKey, extraVal) => {
        // Ensure extraKey is not already in vars
        fc.pre(!Object.prototype.hasOwnProperty.call(vars, extraKey));
        const required = Object.keys(vars);
        const provided = { ...vars, [extraKey]: extraVal };
        const result = normalizeVars(required, provided);
        assert.equal(result[extraKey], extraVal);
      }
    ),
    { numRuns: 150 }
  );
});

// ── asArray properties ────────────────────────────────────────────────────────

const { asArray } = require("../../packages/core/src/domain/PackSpec");

test("asArray: wrapping a non-empty, non-null scalar always returns an array of length 1", () => {
  fc.assert(
    fc.property(
      // asArray("") returns [] (empty string is treated as absent)
      fc.oneof(fc.string({ minLength: 1 }), fc.integer(), fc.boolean()),
      (value) => {
        const result = asArray(value);
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 1);
        assert.equal(result[0], value);
      }
    ),
    { numRuns: 300 }
  );
});

test("asArray: empty string returns empty array (treated as absent)", () => {
  assert.deepEqual(asArray(""), []);
});

test("asArray: passing an array returns the same array reference", () => {
  fc.assert(
    fc.property(fc.array(fc.string()), (arr) => {
      const result = asArray(arr);
      assert.strictEqual(result, arr);
    }),
    { numRuns: 200 }
  );
});

test("asArray: null/undefined returns empty array", () => {
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray(undefined), []);
});
