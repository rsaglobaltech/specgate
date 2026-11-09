/**
 * REQ-437: a module written by hand under a plain `## orders` heading is the
 * module's section once the studio saves the form — one section, its prose in it.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { briefForm, saveBriefForm } from "../../scripts/lib/studio-route";

const BRIEF = [
  "---",
  "product: Tienda",
  "surfaces: [api]",
  "actors:",
  "  - { name: Customer, surfaces: [api] }",
  "modules: [orders]",
  "---",
  "",
  "# Brief",
  "",
  "## Context",
  "A small shop. Orders is the first module.",
  "",
  "## orders",
  "Shipping is free above some amount.",
  "An order can be cancelled.",
  "",
].join("\n");

function project(brief: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-brief-plain-"));
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "brief.md"), brief);
  return dir;
}

test("REQ-437 SCN-437a: a hand-written module section is kept as the module's", () => {
  const dir = project(BRIEF);
  const form = briefForm(dir);
  const orders = form.modules.find((m) => m.key === "orders")!;
  saveBriefForm(dir, {
    product: form.product,
    actors: form.actors,
    modules: [{ ...orders, rules: ["An order has at least one item"] }],
  });
  const out = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");

  assert.equal((out.match(/^## Module: orders$/gm) || []).length, 1, out);
  assert.doesNotMatch(out, /^## orders$/m, "no plain heading left beside it");
  const section = out.slice(out.indexOf("## Module: orders"));
  assert.match(section, /Shipping is free above some amount\.\nAn order can be cancelled\./);
  assert.match(section, /- An order has at least one item/);
  assert.match(
    out,
    /## Context\nA small shop\. Orders is the first module\.\n/,
    "other sections unchanged"
  );
  // Read back, the form sees the module's rule.
  assert.deepEqual(briefForm(dir).modules.find((m) => m.key === "orders")!.rules, [
    "An order has at least one item",
  ]);
});

test("REQ-437: a plain heading that names no listed module is left as it is", () => {
  const dir = project(BRIEF.replace("modules: [orders]", "modules: [orders, users]"));
  const form = briefForm(dir);
  saveBriefForm(dir, {
    product: form.product,
    actors: form.actors,
    modules: form.modules.map((m) =>
      m.key === "users" ? { ...m, rules: ["A user has an email"] } : m
    ),
  });
  const out = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.match(out, /^## Context$/m);
  assert.match(out, /^## Module: users$/m);
});

test("REQ-437: CRLF briefs and a heading written in another case are the module's too", () => {
  const dir = project(BRIEF.replace("## orders", "## Orders").replace(/\n/g, "\r\n"));
  const form = briefForm(dir);
  const orders = form.modules.find((m) => m.key === "orders")!;
  saveBriefForm(dir, {
    product: form.product,
    actors: form.actors,
    modules: [{ ...orders, rules: ["R1"] }],
  });
  const out = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.equal((out.match(/^## Module: Orders$/gm) || []).length, 1, out);
  assert.doesNotMatch(out, /^## Orders\r?$/m);
  assert.match(out, /Shipping is free above some amount\./);
});
