// compat task `recover` (REQ-722): the requirement delivered, and what was red put right.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
test("the project names itself", () => {
  assert.equal(require(path.join(process.cwd(), "src", "index.js")).name, "compat-fixture");
});
test("the late fee", () => {
  const { lateFee } = require(path.join(process.cwd(), "src", "fees.js"));
  assert.equal(lateFee(3), 1.5);
  assert.equal(lateFee(30), 10);
  assert.equal(lateFee(0), 0);
});
