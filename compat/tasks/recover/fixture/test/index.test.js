// REQ-001: the project starts, and says its name.
const test = require("node:test");
const assert = require("node:assert/strict");
test("REQ-001: the project loads and names itself", () => {
  assert.equal(require("../src/index.js").name, "compat-fixture");
});
