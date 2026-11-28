"use strict";

/**
 * A sequence read from the code, checked against the run (change
 * `urbanops-run`, REQ-824): the page says whether the diagram matches what
 * the run called — from the browser's trace or the server's own record — or
 * that it could not be checked, never presenting the reading as fact.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli } from "../helpers/cli";
import { zip } from "../helpers/zip";
const { checkSequence } = require("../../scripts/lib/sequence-check");
const { traceWindow, loggedCalls } = require("../../scripts/lib/trace-zip");

const call = (method: string, p: string, status: number) => ({
  method,
  path: p,
  status,
  statusText: "",
  ms: 5,
  request: "",
  response: "",
});

const SEQUENCE = [
  "sequenceDiagram",
  "  actor A as Citizen",
  "  participant P1 as «boundary» Web app",
  "  participant P2 as :IncidentController",
  "  A->>+P1: presses Consultar",
  "  P1->>+P2: GET /api/incidents/{trackingNumber}",
  "  P2-->>-P1: 200 OK",
  "  P1-->>-A: sees the status",
].join("\n");

test("REQ-824: a sequence matches the run, differs from it, or says why it was not checked", () => {
  const matches = checkSequence(SEQUENCE, [call("GET", "/api/incidents/INC-2026-000011", 200)]);
  assert.equal(matches.state, "matches");
  assert.match(
    matches.text,
    /Matches the run: `GET \/api\/incidents\/\{trackingNumber\}` answered 200/
  );

  const otherCall = checkSequence(SEQUENCE, [call("POST", "/api/incidents", 201)]);
  assert.equal(otherCall.state, "differs");
  assert.match(
    otherCall.text,
    /it draws `GET \/api\/incidents\/\{trackingNumber\}`; the run called `POST \/api\/incidents`/
  );

  const otherEnd = checkSequence(SEQUENCE, [call("GET", "/api/incidents/INC-2026-000011", 404)]);
  assert.equal(otherEnd.state, "differs");
  assert.match(
    otherEnd.text,
    /it ends in `200 OK`; `GET \/api\/incidents\/\{trackingNumber\}` answered 404/
  );

  const refused = SEQUENCE.replace("P2-->>-P1: 200 OK", "P2-->>-P1: too_many_photos");
  assert.equal(
    checkSequence(refused, [call("GET", "/api/incidents/x", 422)]).state,
    "matches",
    "a code is an error"
  );

  const unchecked = checkSequence(SEQUENCE, []);
  assert.equal(unchecked.state, "unchecked");
  assert.match(unchecked.text, /not checked against the run/);

  const steps = checkSequence(
    "sequenceDiagram\n  actor A as Citizen\n  participant S as System\n  A->>S: presses Consultar\n",
    []
  );
  assert.equal(steps.state, "steps");
});

test("REQ-824: when a test ran, from its trace; what the server recorded, from its log", (t: TestContext) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sequence-check-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "trace.zip");
  fs.writeFileSync(file, testTrace(1_000_000, 4_000));
  assert.deepEqual(traceWindow(file), { from: 1_000_000, to: 1_004_000 });
  const log = path.join(dir, "http-calls.jsonl");
  fs.writeFileSync(
    log,
    '{"at":5,"method":"get","path":"/api/x","status":200,"ms":3}\nnot json\n{"method":"GET"}\n'
  );
  assert.deepEqual(
    loggedCalls(log).map((c: { at: number; method: string; status: number }) => [
      c.at,
      c.method,
      c.status,
    ]),
    [[5, "GET", 200]]
  );
});

/** Playwright's test-runner trace: when the test started, and when its last step ended. */
function testTrace(wallTime: number, ms: number): Buffer {
  return zip({
    "test.trace": [
      JSON.stringify({
        type: "context-options",
        origin: "testRunner",
        wallTime,
        monotonicTime: 100,
      }),
      JSON.stringify({ type: "after", callId: "hook@1", endTime: 100 + ms }),
    ].join("\n"),
  });
}

/**
 * A screen's scenario whose call is made from the server: the browser's trace
 * has none, the server's log has it — inside the scenario's window or not.
 */
function project(t: TestContext, served: Array<{ at: number; status: number }>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sequence-page-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (rel: string, text: string | Buffer) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write(
    "src/main/java/city/web/OrderController.java",
    `package city.web;
@RestController
@RequestMapping("/api/orders")
class OrderController {
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  Order place(Order order) { return order; }
}
`
  );
  write(
    "web/lib/api.ts",
    'export const api = {\n  /** REQ-041 */\n  place: () => call("/api/orders", { method: "POST" }),\n};\n'
  );
  write("spec.md", "# Spec\n");
  write(
    "docs/specs/changes/draft-orders/change.yaml",
    "specgate_change_version: 1\nschema: layered\n"
  );
  write(
    "docs/specs/changes/draft-orders/specs/orders/spec.md",
    [
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-041 — An order is placed",
      "",
      "<!-- specgate:trace actor=Customer artifact=src/main/java/city/web/OrderController.java,web/lib/api.ts -->",
      "",
      "The system SHALL place it.",
      "",
      "#### Scenario: SCN-041 — Placing",
      "",
      "- GIVEN a cart",
      "- WHEN the Customer presses Place",
      "- THEN the order is confirmed",
      "",
    ].join("\n")
  );
  const run = ".specgate/evidence/REQ-041";
  const folder = "artifacts/web/orders-REQ-0-1a2b3-Placing-bdd";
  write(`${run}/${folder}/trace.zip`, testTrace(1_000_000, 4_000));
  write(
    `${run}/artifacts/specgate/http-calls.jsonl`,
    served
      .map((s) =>
        JSON.stringify({ at: s.at, method: "POST", path: "/api/orders", status: s.status, ms: 9 })
      )
      .join("\n")
  );
  write(
    `${run}/evidence.json`,
    JSON.stringify({
      command: "bdd",
      exitCode: 0,
      artifacts: [`${folder}/trace.zip`, "artifacts/specgate/http-calls.jsonl"],
    })
  );
  write(`${run}/bdd.log`, "  ✓  1 [bdd] › orders › Placing @REQ-041 (4.0s)\n");
  return {
    dir,
    page: () =>
      fs.readFileSync(path.join(dir, "docs/specs/changes/draft-orders/EVIDENCE.md"), "utf8"),
  };
}

test("REQ-824 SCN-824a: the server's record, inside the scenario's window, checks the sequence", (t: TestContext) => {
  const ok = project(t, [{ at: 1_002_000, status: 201 }]);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", ok.dir).status, 0);
  assert.match(ok.page(), /✓ Matches the run: `POST \/api\/orders` answered 201\./);
  assert.match(
    ok.page(),
    /\| `POST \/api\/orders` \| — \| 201 \|/,
    "the server's call is on the calls table too"
  );

  const refused = project(t, [{ at: 1_002_000, status: 422 }]);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", refused.dir).status, 0);
  assert.match(
    refused.page(),
    /⚠ Read from the code, and the run differs: it ends in `201 Created`; `POST \/api\/orders` answered 422\./
  );

  const elsewhen = project(t, [{ at: 2_000_000, status: 201 }]);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", elsewhen.dir).status, 0);
  assert.match(
    elsewhen.page(),
    /· Read from the code, not checked against the run/,
    "a call outside the window is not this scenario's"
  );
});

test("REQ-824: the same call twice in a scenario is two numbered rows, the second answer kept", (t: TestContext) => {
  const twice = project(t, [
    { at: 1_001_000, status: 201 },
    { at: 1_002_000, status: 409 },
  ]);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", twice.dir).status, 0);
  assert.match(twice.page(), /\| `POST \/api\/orders \(1\)` \| — \| 201 \|/);
  assert.match(twice.page(), /\| `POST \/api\/orders \(2\)` \| — \| 409 \|/);
});
