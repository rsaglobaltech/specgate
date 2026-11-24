// The compatibility exam's hidden check (harness-compat REQ-711): the agent never sees it.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { lateFee } = require(path.join(process.cwd(), "src", "fees.js"));

test("not late: no fee", () => {
  assert.equal(lateFee(0), 0);
  assert.equal(lateFee(-2), 0);
});
test("0.50 per late day", () => {
  assert.equal(lateFee(1), 0.5);
  assert.equal(lateFee(3), 1.5);
});
test("never more than 10.00", () => {
  assert.equal(lateFee(20), 10);
  assert.equal(lateFee(30), 10);
});
