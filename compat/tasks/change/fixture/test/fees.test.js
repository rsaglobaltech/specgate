// REQ-002 SCN-002a SCN-002b: the late fee.
const test = require("node:test");
const assert = require("node:assert/strict");
const { lateFee } = require("../src/fees.js");

test("REQ-002 SCN-002a: three days late is 1.50", () => assert.equal(lateFee(3), 1.5));
test("REQ-002 SCN-002b: thirty days late is capped at 10.00", () => assert.equal(lateFee(30), 10));
