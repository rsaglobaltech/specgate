/**
 * Does the value a spec declares match the value the code declares? (§8.6.)
 *
 * Pure domain logic only — no filesystem, no correlation with a matrix row.
 * That wiring lives in `ReportCommand.ts`; these tests pin the three
 * functions it composes: extract from a trace comment, extract from a
 * source file's text, compare.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  declaredSpecValues,
  declaredCodeValues,
  compareDeclaredValues,
} from "../../src/domain/ValueAnnotations";

test("value_ keys are extracted and their prefix stripped; other keys are ignored", () => {
  assert.deepEqual(
    declaredSpecValues({ uc: "Login", value_session_timeout: "15m", depends: "REQ-001" }),
    [{ id: "session_timeout", value: "15m" }]
  );
});

test("declaredSpecValues tolerates a trace with no value_ keys, or no trace at all", () => {
  assert.deepEqual(declaredSpecValues({ uc: "Login" }), []);
  assert.deepEqual(declaredSpecValues(null), []);
  assert.deepEqual(declaredSpecValues(undefined), []);
});

test("a bare 'value_' with nothing after the prefix is not a valid id", () => {
  assert.deepEqual(declaredSpecValues({ value_: "15m" }), []);
});

test("specgate:value is found regardless of comment syntax, because it is not parsed as one", () => {
  const source = [
    "// specgate:value session_timeout=15m",
    "const SESSION_TIMEOUT = '15m';",
    "# specgate:value max_attempts=5",
    "-- specgate:value lockout_minutes=60",
    "not a marker at all",
  ].join("\n");
  assert.deepEqual(declaredCodeValues(source), [
    { id: "session_timeout", value: "15m", line: 1 },
    { id: "max_attempts", value: "5", line: 3 },
    { id: "lockout_minutes", value: "60", line: 4 },
  ]);
});

test("declaredCodeValues finds nothing in a file with no marker", () => {
  assert.deepEqual(declaredCodeValues("const x = 1;\nfunction f() {}\n"), []);
});

test("matched: same id, same literal value on both sides", () => {
  const result = compareDeclaredValues(
    [{ id: "session_timeout", value: "15m" }],
    [{ id: "session_timeout", value: "15m", line: 12, file: "src/auth.ts" }]
  );
  assert.deepEqual(result, [
    {
      id: "session_timeout",
      specValue: "15m",
      codeValue: "15m",
      codeFile: "src/auth.ts",
      codeLine: 12,
      status: "matched",
    },
  ]);
});

test("diverging: same id, different literal — no unit interpretation", () => {
  const result = compareDeclaredValues(
    [{ id: "session_timeout", value: "15m" }],
    [{ id: "session_timeout", value: "900000", line: 12, file: "src/auth.ts" }]
  );
  assert.equal(result[0].status, "diverging");
  // 15m and 900000 mean the same duration; this module does not know that,
  // and is not supposed to (PLAN_PREDICTABLE_CODE_EVOLUTION.md §5, the H13 trap).
  assert.equal(result[0].specValue, "15m");
  assert.equal(result[0].codeValue, "900000");
});

test("spec_only: the spec declares a value with no matching code marker", () => {
  const result = compareDeclaredValues([{ id: "session_timeout", value: "15m" }], []);
  assert.deepEqual(result, [
    {
      id: "session_timeout",
      specValue: "15m",
      codeValue: null,
      codeFile: null,
      codeLine: null,
      status: "spec_only",
    },
  ]);
});

test("code_only: a specgate:value marker with no matching spec declaration", () => {
  const result = compareDeclaredValues(
    [],
    [{ id: "retry_backoff", value: "2s", line: 5, file: "src/retry.ts" }]
  );
  assert.deepEqual(result, [
    {
      id: "retry_backoff",
      specValue: null,
      codeValue: "2s",
      codeFile: "src/retry.ts",
      codeLine: 5,
      status: "code_only",
    },
  ]);
});

test("a repeated code marker for the same id keeps its first occurrence, deterministically", () => {
  const result = compareDeclaredValues(
    [{ id: "session_timeout", value: "15m" }],
    [
      { id: "session_timeout", value: "15m", line: 3, file: "src/a.ts" },
      { id: "session_timeout", value: "30m", line: 9, file: "src/b.ts" },
    ]
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].codeFile, "src/a.ts");
  assert.equal(result[0].status, "matched");
});

test("ids are scoped to whatever entries the caller passes — no global comparison", () => {
  // Two unrelated requirements can reuse the same id name without being
  // compared against each other; that scoping is the caller's job (one call
  // per requirement), and this test pins that the function itself does not
  // need to know about requirements at all to behave correctly.
  const reqA = compareDeclaredValues(
    [{ id: "limit", value: "5" }],
    [{ id: "limit", value: "5", line: 1, file: "src/a.ts" }]
  );
  const reqB = compareDeclaredValues(
    [{ id: "limit", value: "10" }],
    [{ id: "limit", value: "999", line: 1, file: "src/b.ts" }]
  );
  assert.equal(reqA[0].status, "matched");
  assert.equal(reqB[0].status, "diverging");
});

test("multiple ids in one requirement are each classified independently", () => {
  const result = compareDeclaredValues(
    [
      { id: "session_timeout", value: "15m" },
      { id: "max_attempts", value: "5" },
    ],
    [{ id: "session_timeout", value: "30m", line: 1, file: "src/a.ts" }]
  );
  const byId = Object.fromEntries(result.map((r) => [r.id, r.status]));
  assert.deepEqual(byId, { session_timeout: "diverging", max_attempts: "spec_only" });
});
