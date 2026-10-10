const test = require("node:test");
const assert = require("node:assert");
const { total } = require("../src/carrito");

// REQ-002 SCN-002 — nombrarlo es el enlace
test("REQ-002 SCN-002: dos líneas suman su total", () => {
  assert.strictEqual(total([{ precio: 49.9, cantidad: 2 }]), 99.8);
});
