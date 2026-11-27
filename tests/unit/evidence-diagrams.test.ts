"use strict";

/**
 * A requirement drawn before and after, the same way every time (ADR-0047,
 * REQ-806): sequence diagrams from its scenarios, class diagrams from its code.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  sequenceDiagram,
  classesOf,
  classDiagram,
} = require("../../packages/core/src/domain/EvidenceDiagrams");
const { requirementDiagrams } = require("../../scripts/lib/evidence-diagrams");

const ORDER = {
  title: "An order is paid",
  steps: [
    "GIVEN a cart with 2 books",
    "AND the member is signed in",
    "WHEN the member sends POST /api/orders; then POST /api/payments",
    "THEN the response is 201 with the order #12",
  ],
};

test("REQ-806: a scenario as a sequence: GIVEN a note, each call a message, THEN a reply", () => {
  const text = sequenceDiagram(ORDER, "Member");
  assert.equal(
    text,
    [
      "sequenceDiagram",
      "  title An order is paid",
      "  actor A as Member",
      "  participant S as System",
      "  Note over A,S: a cart with 2 books#59; the member is signed in",
      "  A->>S: POST /api/orders",
      "  A->>S: POST /api/payments",
      "  S-->>A: the response is 201 with the order #35;12",
      "",
    ].join("\n")
  );
  assert.equal(sequenceDiagram(ORDER, "Member"), text, "the same input, the same text");
});

test("REQ-806: a WHEN that names no call is the message itself", () => {
  const text = sequenceDiagram(
    { title: "Sign in", steps: ["WHEN the member signs in", "THEN they see their orders"] },
    ""
  );
  assert.match(text, /actor A as User/);
  assert.match(text, /A->>S: the member signs in/);
  assert.match(text, /S-->>A: they see their orders/);
});

const ORDERS_TS = (extra: string) => `
import { Base } from "./base";
// class Commented {}
export class Orders extends Base implements Payable, Auditable {
  private secret = 1;
  readonly total: number = 0;
  constructor(private repo: Repo) { super(); }
  place(cart: Cart): Order {
    if (cart.empty) { return null; }
    return new Order();
  }
${extra}  #hidden() {}
  private helper() {}
}
export interface Payable { pay(): void; }
`;

test("REQ-806: TypeScript classes, their public members and parents", () => {
  const [orders, payable] = classesOf("src/orders.ts", ORDERS_TS(""));
  assert.equal(orders.name, "Orders");
  assert.deepEqual(orders.parents, [
    { name: "Base", kind: "extends" },
    { name: "Payable", kind: "implements" },
    { name: "Auditable", kind: "implements" },
  ]);
  assert.deepEqual(orders.members, ["total", "constructor()", "place()"]);
  assert.equal(payable.name, "Payable");
  assert.deepEqual(payable.members, ["pay()"]);
});

test("REQ-806 SCN-806b: a method added since the base is in a note", () => {
  const before = ORDERS_TS("");
  const after = ORDERS_TS("  refund(order: Order): void {}\n");
  const text = classDiagram("src/orders.ts", before, after);
  assert.match(text, /^classDiagram\n/);
  assert.match(text, /class Orders \{\n(?:.*\n)*? {4}\+refund\(\)\n/);
  assert.match(text, /Base <\|-- Orders/);
  assert.match(text, /Payable <\|\.\. Orders/);
  assert.match(text, /note for Orders "added: refund\(\)"/);
  assert.doesNotMatch(classDiagram("src/orders.ts", before, before), /note for/);
  assert.match(classDiagram("src/orders.ts", null, after), /note for Orders "new"/);
  assert.doesNotMatch(classDiagram("src/orders.ts", null, before, false), /note for/, "the base's own view");
});

test("REQ-806: Java, Kotlin, C# and Python, public members only", () => {
  const java = classesOf(
    "src/Orders.java",
    'public class Orders extends Base implements Payable {\n  private int n;\n  public Order place(Cart c) { return null; }\n  void internal() {}\n  public static final String NAME = "x";\n}\n'
  );
  assert.deepEqual(java[0].members, ["place()", "NAME"]);
  assert.deepEqual(
    java[0].parents.map((p: { name: string }) => p.name),
    ["Base", "Payable"]
  );
  const kotlin = classesOf(
    "src/Orders.kt",
    'data class Order(val id: String)\nclass Orders(private val repo: Repo) : Base(), Payable {\n  val count: Int = 0\n  fun place(c: Cart): Order { return Order("1") }\n  private fun helper() {}\n}\n'
  );
  assert.deepEqual(
    kotlin.map((c: { name: string }) => c.name),
    ["Order", "Orders"]
  );
  assert.deepEqual(kotlin[1].members, ["count", "place()"]);
  const cs = classesOf(
    "src/Orders.cs",
    "public class Orders : Base, IPayable {\n  public int Count { get; set; }\n  public Order Place(Cart c) { return null; }\n  private void Helper() {}\n}\n"
  );
  assert.deepEqual(cs[0].members, ["Count", "Place()"]);
  const py = classesOf(
    "app/orders.py",
    "class Orders(Base):\n    def __init__(self, repo):\n        self.repo = repo\n    def place(self, cart):\n        pass\n    def _helper(self):\n        pass\n\ndef free(): pass\n"
  );
  assert.deepEqual(py[0].members, ["__init__()", "place()"]);
  assert.deepEqual(py[0].parents, [{ name: "Base", kind: "extends" }]);
  assert.deepEqual(classesOf("README.md", "class X {}"), [], "not a language it reads");
});

const git = (dir: string, ...args: string[]) => {
  const r = spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

const spec = (steps: string[]) =>
  [
    "# Spec",
    "",
    "## REQ-031 — An order is paid",
    "",
    "<!-- specgate:trace actor=Member artifact=src/orders.ts -->",
    "",
    "The system SHALL take the order.",
    "",
    "#### Scenario: SCN-031 — Paying",
    "",
    ...steps.map((s) => `- ${s}`),
    "",
  ].join("\n");

test("REQ-806 SCN-806a: the requirement drawn at the base and now", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-diagrams-"));
  try {
    fs.mkdirSync(path.join(dir, "src"));
    const steps = ["GIVEN a cart", "WHEN the member sends POST /api/orders", "THEN it is 201"];
    fs.writeFileSync(path.join(dir, "spec.md"), spec(steps));
    fs.writeFileSync(path.join(dir, "src", "orders.ts"), ORDERS_TS(""));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");
    git(dir, "checkout", "-q", "-b", "feature");
    steps[1] = "WHEN the member sends POST /api/orders and POST /api/payments";
    fs.writeFileSync(path.join(dir, "spec.md"), spec(steps));
    fs.writeFileSync(path.join(dir, "src", "orders.ts"), ORDERS_TS("  refund(): void {}\n"));

    const d = requirementDiagrams(dir, "REQ-031", "main");
    assert.equal(d.sequences.length, 1);
    const calls = (t: string) => (t.match(/A->>S:/g) || []).length;
    assert.equal(calls(d.sequences[0].before), 1);
    assert.equal(calls(d.sequences[0].after), 2);
    assert.match(d.sequences[0].after, /actor A as Member/);
    assert.deepEqual(
      d.classes.map((c: { file: string }) => c.file),
      ["src/orders.ts"]
    );
    assert.match(d.classes[0].after, /note for Orders "added: refund\(\)"/);
    assert.deepEqual(requirementDiagrams(dir, "REQ-031", "main"), d, "the same every time");

    // In an open change's delta, with no artifact= and no matrix row: the code that names it.
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    const delta = path.join(dir, "docs", "specs", "changes", "pay", "specs", "orders");
    fs.mkdirSync(delta, { recursive: true });
    fs.writeFileSync(
      path.join(delta, "spec.md"),
      spec(steps).replace("# Spec", "## ADDED Requirements").replace(" artifact=src/orders.ts", "")
    );
    fs.writeFileSync(
      path.join(dir, "src", "orders.ts"),
      `// REQ-031\n${ORDERS_TS("  refund(): void {}\n")}`
    );
    const inFlight = requirementDiagrams(dir, "REQ-031", "main");
    assert.deepEqual(inFlight.classes.map((c: { file: string }) => c.file), ["src/orders.ts"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
