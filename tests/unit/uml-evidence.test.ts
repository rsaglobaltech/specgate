"use strict";

/**
 * The evidence's diagrams as standard UML (change `uml-evidence`): the
 * requirement's slice of the code as a class diagram (REQ-811), and a
 * scenario followed through the code as a sequence (REQ-812).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
const { umlTypesOf } = require("../../packages/core/src/domain/UmlModel");
const { codeSequence, webCallsOf } = require("../../packages/core/src/domain/UmlDiagrams");
const { requirementDiagrams } = require("../../scripts/lib/evidence-diagrams");

const JAVA = "src/main/java/shop";
const FILES: Record<string, string> = {
  [`${JAVA}/app/ReviewOrder.java`]: `package shop.app;

import shop.domain.Decision;
import reactor.core.publisher.Mono;

/** REQ-041: the review of an order. */
public final class ReviewOrder {
  private final Classifier classifier;

  public ReviewOrder(Classifier classifier) { this.classifier = classifier; }

  public Mono<Decision> execute(String text) {
    return classifier.classify(text).map(d -> check(d));
  }

  private Decision check(Decision d) { return d; }
}
`,
  [`${JAVA}/app/Classifier.java`]: `package shop.app;

import shop.domain.Decision;

public interface Classifier {
  Mono<Decision> classify(String text);
}
`,
  [`${JAVA}/infra/AiClassifier.java`]: `package shop.infra;

@Component
class AiClassifier implements Classifier {
  private final ChatClient chat;

  AiClassifier(ChatClient chat) { this.chat = chat; }

  @Override
  public Mono<Decision> classify(String text) {
    return Mono.just(chat.prompt().user(text).call().entity(Decision.class));
  }
}
`,
  [`${JAVA}/domain/Decision.java`]: `package shop.domain;

/** What the review decides. */
public enum Decision {
  /** Let through. */
  ALLOW,
  DENY
}
`,
  [`${JAVA}/web/OrderController.java`]: `package shop.web;

@RestController
@RequestMapping("/api/orders")
class OrderController {
  record OrderRequest(String text) {}

  private final ReviewOrder review;

  OrderController(ReviewOrder review) { this.review = review; }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  Mono<Decision> place(@RequestBody OrderRequest request) {
    return review.execute(request.text());
  }
}
`,
  "web/lib/api.ts": `export const api = {
  /** REQ-041: place the order. */
  placeOrder: (text: string) =>
    call<Decision>("/api/orders", { method: "POST", body: JSON.stringify({ text }) }),
  orders: () => call<Order[]>("/api/orders"),
};
`,
};

function project(t: TestContext, steps: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-uml-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [f, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    [
      "# Spec",
      "",
      "## REQ-041 — An order is reviewed",
      "",
      `<!-- specgate:trace actor=Customer artifact=${JAVA}/app/ReviewOrder.java,${JAVA}/domain/Decision.java -->`,
      "",
      "The system SHALL review the order.",
      "",
      "#### Scenario: SCN-041 — Placing",
      "",
      ...steps.map((s) => `- ${s}`),
      "",
    ].join("\n")
  );
  return dir;
}

test("REQ-811: Java types with typed members, visibility, stereotypes and literals", () => {
  const [controller, request] = umlTypesOf(
    "OrderController.java",
    FILES[`${JAVA}/web/OrderController.java`]
  );
  assert.equal(controller.name, "OrderController");
  assert.equal(controller.pkg, "shop.web");
  const place = controller.members.find((m: { name: string }) => m.name === "place");
  assert.equal(place.visibility, "~");
  assert.equal(place.type, "Mono<Decision>");
  assert.deepEqual(place.params, [{ name: "request", type: "OrderRequest" }]);
  assert.match(place.annotations, /@PostMapping/);
  assert.equal(request.name, "OrderRequest");
  assert.equal(request.kind, "record");
  assert.equal(request.outer, "OrderController");
  const [decision] = umlTypesOf("Decision.java", FILES[`${JAVA}/domain/Decision.java`]);
  assert.equal(decision.kind, "enum");
  assert.deepEqual(decision.literals, ["ALLOW", "DENY"]);
  const [ts] = umlTypesOf(
    "a.ts",
    "export interface Order {\n  id: string\n  lines?: Line[]\n}\n"
  );
  assert.deepEqual(
    ts.members.map((m: { name: string; type: string }) => `${m.name}:${m.type}`),
    ["id:string", "lines:Line[]"]
  );
});

test("REQ-811 SCN-811a: the requirement's slice as one UML class diagram", (t: TestContext) => {
  const dir = project(t, ["GIVEN a cart", "WHEN the Customer sends POST /api/orders", "THEN it is 201"]);
  const d = requirementDiagrams(dir, "REQ-041");
  assert.equal(d.classes.length, 1);
  const java = d.classes[0];
  assert.match(java.file, /^Java — shop$/);
  const text = java.after;
  assert.match(text, /"theme": "neutral"/);
  assert.match(text, /ReviewOrder --> "1" Classifier : classifier/);
  assert.match(text, /Classifier <\|\.\. AiClassifier/);
  assert.match(text, /\+execute\(text : String\) Mono~Decision~/);
  assert.match(text, /-check\(d : Decision\) Decision/);
  assert.match(text, /class Decision \{\n {4}<<enumeration>>\n {4}ALLOW\n {4}DENY\n/);
  assert.match(text, /class Classifier \{\n {4}<<interface>>/);
  assert.match(text, /OrderController --> "1" ReviewOrder : review/, "the type that holds it");
  assert.match(text, /OrderController \.\.> OrderRequest/, "a nested type, by what uses it");
  // Mermaid has no nesting arrow: `+--` stops the whole diagram from rendering.
  assert.doesNotMatch(text, /\+--/);
  assert.deepEqual(requirementDiagrams(dir, "REQ-041"), d, "the same every time");
});

test("REQ-812 SCN-812a: from the endpoint to the port, object by object", (t: TestContext) => {
  const dir = project(t, ["GIVEN a cart", "WHEN the Customer sends POST /api/orders", "THEN it is 201"]);
  const seq = requirementDiagrams(dir, "REQ-041").sequences[0].after;
  assert.match(seq, /autonumber/);
  assert.match(seq, /actor A as Customer/);
  assert.match(seq, /participant P1 as :OrderController/);
  assert.match(seq, /participant P2 as :ReviewOrder/);
  assert.match(seq, /participant P3 as :AiClassifier/);
  assert.match(seq, /participant P4 as :ChatClient/);
  const execute = seq.indexOf("P1->>+P2: execute(text : String)");
  const classify = seq.indexOf("P2->>+P3: classify(text : String)");
  assert.ok(execute > 0 && classify > execute, seq);
  assert.match(seq, /P3->>\+P4: prompt\(\)\.user\(\)\.call\(\)\.entity\(\)/);
  assert.match(seq, /P2->>\+P2: check\(d : Decision\)/);
  assert.match(seq, /P1-->>-A: 201 Created/);
});

test("REQ-812: a screen's scenario starts at the web app, which calls what its code names", () => {
  const types = Object.entries(FILES)
    .filter(([f]) => f.endsWith(".java"))
    .flatMap(([f, s]) => umlTypesOf(f, s));
  assert.deepEqual(webCallsOf(FILES["web/lib/api.ts"], "REQ-041"), ["POST /api/orders"]);
  const seq = codeSequence({
    scenario: {
      title: "Placing on the web",
      steps: ["GIVEN a cart", "WHEN the Customer presses Place", "THEN the order is confirmed"],
    },
    actor: "Customer",
    types,
    webCalls: ["POST /api/orders"],
  });
  assert.match(seq, /participant P1 as «boundary» Web app/);
  assert.match(seq, /A->>\+P1: the Customer presses Place/);
  assert.match(seq, /P1->>\+P2: POST \/api\/orders/);
  assert.match(seq, /P1-->>-A: the order is confirmed/);
});

test("REQ-812 SCN-812b: a call no controller declares is drawn from the steps", (t: TestContext) => {
  const dir = project(t, ["GIVEN a cart", "WHEN the Customer sends POST /api/unknown", "THEN it is 404"]);
  const seq = requirementDiagrams(dir, "REQ-041").sequences[0].after;
  assert.match(seq, /participant S as System/);
  assert.match(seq, /A->>S: POST \/api\/unknown/);
});
