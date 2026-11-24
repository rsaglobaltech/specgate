// compat task `change` (REQ-720): the new case, and the old one still holding.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { lateFee } = require(path.join(process.cwd(), "src", "fees.js"));

test("a child's fee is capped at 5.00", () => {
  assert.equal(lateFee(30, "child"), 5);
  assert.equal(lateFee(10, "child"), 5);
  assert.equal(lateFee(4, "child"), 2);
});
test("an adult's cap is still 10.00", () => assert.equal(lateFee(30, "adult"), 10));
test("without the type, as before", () => {
  assert.equal(lateFee(30), 10);
  assert.equal(lateFee(3), 1.5);
  assert.equal(lateFee(0), 0);
});
