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

  private Decision check(Decision d) {
    if (d == null) throw new UnclearOrder();
    return d;
  }
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
  [`${JAVA}/domain/UnclearOrder.java`]: `package shop.domain;

public final class UnclearOrder extends DomainException {
  public UnclearOrder() {
    super("order_unclear", "Give us another clue, please");
  }
}
`,
  "web/app/actions.ts": `// REQ-041: the order goes through the review.
export async function place(text: string) {
  return api.placeOrder(text);
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
      `<!-- specgate:trace actor=Customer artifact=${JAVA}/app/ReviewOrder.java,${JAVA}/domain/Decision.java,web/app/actions.ts -->`,
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
  const [ts] = umlTypesOf("a.ts", "export interface Order {\n  id: string\n  lines?: Line[]\n}\n");
  assert.deepEqual(
    ts.members.map((m: { name: string; type: string }) => `${m.name}:${m.type}`),
    ["id:string", "lines:Line[]"]
  );
});

test("REQ-811 SCN-811a: the requirement's slice as one UML class diagram", (t: TestContext) => {
  const dir = project(t, [
    "GIVEN a cart",
    "WHEN the Customer sends POST /api/orders",
    "THEN it is 201",
  ]);
  const d = requirementDiagrams(dir, "REQ-041");
  assert.deepEqual(
    d.classes.map((c: { file: string }) => c.file.split(" ")[0]),
    ["Java"],
    "a web file that declares no type draws no class diagram"
  );
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
  const dir = project(t, [
    "GIVEN a cart",
    "WHEN the Customer sends POST /api/orders",
    "THEN it is 201",
  ]);
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

test("REQ-812: the call beside the requirement, its method from the helper it goes through", () => {
  const api = [
    "async function send<T>(path: string, form: FormData): Promise<T> {",
    '  const res = await fetch(`${API_URL}${path}`, { method: "POST", body: form });',
    "  return res.json();",
    "}",
    "export const api = {",
    "  /** UC-002: report an incident (REQ-002). */",
    "  reportIncident: (form: FormData) =>",
    '    send<ReportedIncident>("/api/incidents", form),',
    '  myTasks: () => call<Task[]>("/api/tasks"),',
    "  createTask: (title: string) =>",
    '    call<Task>("/api/tasks", {',
    '      method: "POST",',
    "    }),",
    "};",
  ].join("\n");
  assert.deepEqual(
    webCallsOf(api, "REQ-002"),
    ["POST /api/incidents"],
    "not the next call, and POST as send posts"
  );
  assert.deepEqual(webCallsOf(api, "REQ-999"), [
    "POST /api/incidents",
    "GET /api/tasks",
    "POST /api/tasks",
  ]);
  // A template's `${…}` is a path variable, and a helper's verb is read from its own body only.
  const tracked = [
    "async function call<T>(path: string, init: RequestInit = {}): Promise<T> {",
    "  return (await fetch(path, init)).json();",
    "}",
    "async function send<T>(path: string, form: FormData): Promise<T> {",
    '  return (await fetch(path, { method: "POST", body: form })).json();',
    "}",
    "export const api = {",
    "  /** UC-003: an incident by its tracking number (REQ-005). */",
    "  trackIncident: (n: string) =>",
    "    call<TrackedIncident>(`/api/incidents/${encodeURIComponent(n)}`),",
    "};",
  ].join("\n");
  assert.deepEqual(webCallsOf(tracked, "REQ-005"), ["GET /api/incidents/{id}"]);
});

test("REQ-812 SCN-812b: a call no controller declares is drawn from the steps", (t: TestContext) => {
  const dir = project(t, [
    "GIVEN a cart",
    "WHEN the Customer sends POST /api/unknown",
    "THEN it is 404",
  ]);
  const seq = requirementDiagrams(dir, "REQ-041").sequences[0].after;
  assert.match(seq, /participant S as System/);
  assert.match(seq, /A->>S: POST \/api\/unknown/);
});

test("REQ-812: a scenario that ends in an error follows the exception the code throws", (t: TestContext) => {
  const dir = project(t, [
    "GIVEN an empty cart",
    "WHEN the Customer sends POST /api/orders",
    "THEN it is 422 with `order_unclear`",
  ]);
  const seq = requirementDiagrams(dir, "REQ-041").sequences[0].after;
  assert.match(seq, /P2--xP2: «exception» UnclearOrder/);
  assert.match(seq, /P2--xP1: «exception» UnclearOrder/);
  assert.match(seq, /P1-->>-A: 422 order_unclear/);
  assert.doesNotMatch(seq, /201 Created/);
});

test("REQ-812: a generic exception is followed to the throw that carries the code, through a static operation", () => {
  const sources: Record<string, string> = {
    "Incident.java": `package city.domain;
public record Incident(String address) {
  public static void checkPhotos(int count) {
    if (count > 5) {
      throw new DomainException("too_many_photos", Kind.INVALID, "Puedes adjuntar hasta " + 5 + " fotografías");
    }
  }
}
`,
    "Category.java": `package city.domain;
public enum Category {
  LIGHTING;
  public static Category of(String label) {
    return find(label).orElseThrow(() -> new DomainException("invalid_category", Kind.INVALID, "Elige una categoría"));
  }
}
`,
    "ReportIncident.java": `package city.app;
public final class ReportIncident {
  public Incident execute(Command command) {
    Category category = Category.of(command.category());
    Incident.checkPhotos(command.photos().size());
    return new Incident(command.address());
  }
}
`,
    "IncidentController.java": `package city.web;
@RestController
@RequestMapping("/api/incidents")
class IncidentController {
  private final ReportIncident report;
  @PostMapping
  Incident report(Command command) { return report.execute(command); }
}
`,
  };
  const types = Object.entries(sources).flatMap(([f, s]) => umlTypesOf(f, s));
  const api = codeSequence({
    scenario: {
      title: "Six photos",
      steps: [
        "GIVEN a report",
        "WHEN the Citizen sends POST /api/incidents",
        "THEN it is 422 with `too_many_photos`",
      ],
    },
    actor: "Citizen",
    types,
    webCalls: [],
  });
  assert.match(api, /participant P3 as Category/, "a static operation, on the class's lifeline");
  assert.match(api, /P2->>\+P4: checkPhotos\(count : int\)/);
  assert.match(api, /P4--xP2: «exception» DomainException\(too_many_photos\)/);
  assert.match(api, /P1-->>-A: 422 too_many_photos/);
  assert.doesNotMatch(api, /invalid_category/, "not the other throw of the same type");
  const web = codeSequence({
    scenario: {
      title: "Six photos on the web",
      steps: [
        "GIVEN a report",
        "WHEN the Citizen attaches 6 photos",
        'THEN they read "Puedes adjuntar hasta 5 fotografías"',
      ],
    },
    actor: "Citizen",
    types,
    webCalls: ["POST /api/incidents"],
  });
  assert.match(
    web,
    /--x.*«exception» DomainException\(too_many_photos\)/,
    "found by the message the person reads"
  );
  assert.match(web, /P2-->>-P1: too_many_photos/);
});

test("REQ-812: no noise — platform types, a quiet private helper and a builder's repeats are left out", () => {
  const sources: Record<string, string> = {
    "Incidents.java": `package city.app;
public final class Incidents {
  private final Clock clock;
  private final Database db;
  private final String label;
  public Incident report(String label) {
    var now = clock.instant();
    if (blank(label.strip())) return null;
    db.sql("insert").param(1).param(2).param(3).update();
    return new Incident(now);
  }
  private static boolean blank(String s) { return s == null || s.isBlank(); }
}
`,
    "IncidentController.java": `package city.web;
@RestController
@RequestMapping("/api/incidents")
class IncidentController {
  private final Incidents incidents;
  @PostMapping
  Incident report(String label) { return incidents.report(label); }
}
`,
  };
  const types = Object.entries(sources).flatMap(([f, s]) => umlTypesOf(f, s));
  const seq = codeSequence({
    scenario: {
      title: "Reported",
      steps: ["WHEN the Citizen sends POST /api/incidents", "THEN it is 201"],
    },
    actor: "Citizen",
    types,
    webCalls: [],
  });
  assert.doesNotMatch(seq, /:Clock|instant\(\)/, "a clock is how the code tells the time");
  assert.doesNotMatch(
    seq,
    /:String|strip\(\)/,
    "the parameter, not the field of the same name — and a string either way"
  );
  assert.doesNotMatch(seq, /blank\(/, "a private helper that talks to no one");
  assert.match(seq, /->>\+P\d: sql\(\)\.param\(\)\.update\(\)/, "a builder's repeats once");
});

test("REQ-812: through a screen, the client function the web code calls names the endpoint", (t: TestContext) => {
  const dir = project(t, [
    "GIVEN an empty cart",
    "WHEN the Customer presses Place",
    'THEN they read "Give us another clue, please"',
  ]);
  const seq = requirementDiagrams(dir, "REQ-041").sequences[0].after;
  assert.match(seq, /participant P1 as «boundary» Web app/);
  assert.match(seq, /P1->>\+P2: POST \/api\/orders/);
  assert.match(
    seq,
    /P2-->>-P1: order_unclear/,
    "the exception found by the message the person reads"
  );
});

test("REQ-812: a call passed as an argument is made first; a nested record's factory is transport, not drawn", () => {
  const sources: Record<string, string> = {
    "BookCourt.java": `package club.app;
public final class BookCourt {
  public Booking execute(int court) { return null; }
}
`,
    "BookingController.java": `package club.web;
@RestController
@RequestMapping("/api/bookings")
class BookingController {
  record BookingResponse(String number) {
    static BookingResponse of(Booking b) { return new BookingResponse(b.number()); }
  }
  private final BookCourt bookCourt;
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  BookingResponse book(BookRequest request) {
    return BookingResponse.of(bookCourt.execute(request.court()));
  }
}
`,
  };
  const types = Object.entries(sources).flatMap(([f, s]) => umlTypesOf(f, s));
  const seq = codeSequence({
    scenario: {
      title: "Booked",
      steps: ["WHEN the Member sends POST /api/bookings", "THEN it is 201"],
    },
    actor: "Member",
    types,
    webCalls: [],
  });
  assert.match(seq, /P1->>\+P2: execute\(court : int\)/);
  assert.doesNotMatch(seq, /BookingResponse|of\(b : Booking\)/);
});
