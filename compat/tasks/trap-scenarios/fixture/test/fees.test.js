// REQ-002 SCN-002a SCN-002b: the late fee.
const test = require("node:test");
const assert = require("node:assert/strict");
const { lateFee } = require("../src/fees.js");

test("REQ-002 SCN-002a: three days late", () => assert.equal(lateFee(3), 3));
test("REQ-002 SCN-002b: the cap", () => assert.equal(lateFee(30), 20));
