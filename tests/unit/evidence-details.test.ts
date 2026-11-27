"use strict";

/**
 * What a screenshot does not show (change `evidence-details`): why each
 * scenario was red (REQ-815), what each call to the service answered
 * (REQ-816) and what the AI model decided (REQ-817), before and after.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import type { TestContext } from "node:test";
import { cli } from "../helpers/cli";
const { scenarioOutcomes } = require("../../packages/core/src/domain/ScenarioOutcomes");
const { httpCalls, readZip } = require("../../scripts/lib/trace-zip");

const BEFORE_LOG = [
  "Running 2 tests using 1 worker",
  "",
  "  ✘  1 [bdd] › .features-gen\\orders\\REQ-031.feature.spec.js:6:3 › Orders › Paying @REQ-031 @SCN-031 (18.7s)",
  "  ✓  2 [bdd] › .features-gen\\orders\\REQ-031.feature.spec.js:12:3 › Orders › Browsing @REQ-031 @SCN-031b (2.1s)",
  "",
  "  1) [bdd] › .features-gen\\orders\\REQ-031.feature.spec.js:6:3 › Orders › Paying @REQ-031 @SCN-031 › Then the response is 422 ",
  "",
  "    Error: expect(received).toBe(expected) // Object.is equality",
  "",
  "    Expected: 422",
  "    Received: 500",
  "",
  "       at e2e\\steps\\orders.steps.ts:61",
  "",
  "  1 failed",
].join("\n");

const AFTER_LOG = [
  "  ✓  1 [bdd] › .features-gen\\orders\\REQ-031.feature.spec.js:6:3 › Orders › Paying @REQ-031 @SCN-031 (10.5s)",
  "  ✓  2 [bdd] › .features-gen\\orders\\REQ-031.feature.spec.js:12:3 › Orders › Browsing @REQ-031 @SCN-031b (2.0s)",
].join("\n");

/** A zip of stored entries, as Playwright's trace.zip is read: enough to test the reader. */
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, "utf8");
    const n = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const snapshot = (method: string, url: string, status: number, at: number, fromTest = true) =>
  JSON.stringify({
    type: "resource-snapshot",
    snapshot: {
      time: 12.4,
      _monotonicTime: at,
      ...(fromTest ? { _apiRequestRef: "request-context@1" } : {}),
      request: { method, url, headers: [{ name: "Authorization", value: "Bearer abc" }] },
      response: { status, statusText: status === 422 ? "Unprocessable Entity" : "OK", content: { _file: `resources/${at}.json` } },
    },
  });

function trace(calls: Array<[string, string, number, string]>): Buffer {
  const entries: Record<string, string> = {};
  entries["0-trace.network"] = calls
    .map(([m, u, s, b], i) => {
      entries[`resources/${i + 1}.json`] = b;
      return snapshot(m, u, s, i + 1);
    })
    .join("\n");
  entries["0-trace.network"] += "\n" + snapshot("GET", "http://localhost:3000/_next/static/app.js", 200, 99, false);
  return zip(entries);
}

/** draft-orders with REQ-031's before and after: logs, traces and the AI record, as the runs keep them. */
function project(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-details-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(path.join(change, "change.yaml"), "specgate_change_version: 1\nschema: layered\n");
  fs.writeFileSync(
    path.join(change, "specs", "orders", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: REQ-031 — An order is paid\n\nThe system SHALL take it.\n"
  );
  const side = (rel: string, json: string, log: string, files: Record<string, Buffer | string>) => {
    const folder = path.join(dir, ".specgate", "evidence", rel);
    for (const [f, data] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(folder, f)), { recursive: true });
      fs.writeFileSync(path.join(folder, f), data);
    }
    fs.writeFileSync(path.join(folder, json), JSON.stringify({ command: "bdd", exitCode: 0, artifacts: Object.keys(files) }));
    fs.writeFileSync(path.join(folder, json === "run.json" ? "run.log" : "bdd.log"), log);
  };
  const session = (at: string): [string, string, number, string] => [
    "POST",
    "http://127.0.0.1:8080/api/session",
    201,
    `{"token":"abc","expiresAt":"${at}"}`,
  ];
  side("REQ-031/before", "run.json", BEFORE_LOG, {
    "artifacts/paying/trace.zip": trace([session("2026-11-27T20:00:48.462Z"), ["POST", "http://127.0.0.1:8080/api/orders", 500, '{"title":"Internal Server Error"}']]),
    "artifacts/specgate/ai-decisions.jsonl": '{"model":"llama3.2","input":"Haz eso","output":{"category":"C"},"ms":812}\n',
  });
  side("REQ-031", "evidence.json", AFTER_LOG, {
    "artifacts/paying/trace.zip": trace([session("2026-11-27T20:08:58.871Z"), ["POST", "http://127.0.0.1:8080/api/orders", 422, '{"code":"order_unclear","detail":"Another clue?"}']]),
  });
  return { dir, page: () => fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8") };
}

test("REQ-815: Playwright's list output read as one outcome per scenario", () => {
  assert.deepEqual(scenarioOutcomes(BEFORE_LOG), [
    {
      scenario: "Paying",
      passed: false,
      time: "18.7s",
      step: "Then the response is 422",
      reason: ["Error: expect(received).toBe(expected) // Object.is equality", "Expected: 422", "Received: 500"],
    },
    { scenario: "Browsing", passed: true, time: "2.1s", step: "", reason: [] },
  ]);
  assert.deepEqual(scenarioOutcomes("no runner output here"), []);
});

test("REQ-815 SCN-815a: the page says why each scenario was red, and that it passed after", (t: TestContext) => {
  const { dir, page } = project(t);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  assert.match(
    page(),
    /\| Paying \| ✘ 18\.7s — Then the response is 422: Error: expect\(received\)\.toBe\(expected\) \/\/ Object\.is equality · Expected: 422 · Received: 500 \| ✓ 10\.5s \|/
  );
  assert.match(page(), /\| Browsing \| ✓ 2\.1s \| ✓ 2\.0s \|/);
});

test("REQ-816: the trace's calls to the service, bodies kept, secrets hidden, assets left out", (t: TestContext) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-trace-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "trace.zip");
  fs.writeFileSync(file, trace([["POST", "http://127.0.0.1:8080/api/session", 201, '{"token":"abc","user":{"password":"p"}}']]));
  assert.ok(readZip(file).has("0-trace.network"));
  const [call, ...rest] = httpCalls(file);
  assert.equal(rest.length, 0, "the page's script is not a call to the service");
  assert.equal(call.method, "POST");
  assert.equal(call.path, "/api/session");
  assert.equal(call.status, 201);
  assert.doesNotMatch(call.response, /abc|"p"/);
  assert.match(call.response, /"token": "«hidden»"/);
  assert.match(call.response, /"password": "«hidden»"/);
  assert.deepEqual(httpCalls(path.join(dir, "missing.zip")), []);
});

test("REQ-816 SCN-816a: the page pairs each call before and after, with the bodies that changed", (t: TestContext) => {
  const { dir, page } = project(t);
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  const text = page();
  assert.match(text, /\| `POST \/api\/orders` \| 500 OK \| 422 Unprocessable Entity \|/);
  assert.match(text, /\| `POST \/api\/session` \| 201 OK \| 201 OK \|/);
  assert.match(text, /<summary>POST \/api\/orders — bodies<\/summary>[\s\S]*"code": "order_unclear"/);
  assert.doesNotMatch(text, /<summary>POST \/api\/session/, "the same answer, its time aside, is not repeated");
  assert.doesNotMatch(text, /abc/, "no secret reaches the page");
});

test("REQ-816: doctor asks for a trace that a passing test keeps", (t: TestContext) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-doctor-trace-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  assert.equal(cli("config", "set", "bdd_cmd", "npx playwright test --grep {tags}", "--project-dir", dir).status, 0);
  const media = () =>
    JSON.parse(cli("doctor", "--project-dir", dir, "--json").stdout).status.find(
      (s: { code: string }) => s.code === "doctor_evidence_media"
    );
  const config = (trace: string) =>
    fs.writeFileSync(
      path.join(dir, "playwright.config.ts"),
      `export default { use: { screenshot: "on", video: "on", trace: "${trace}" } };\n`
    );
  config("retain-on-failure");
  assert.equal(media().severity, "warning");
  assert.match(media().fix, /trace: 'on'/);
  config("on");
  assert.equal(media().severity, "info");
});

test("REQ-817 SCN-817a: what the AI model decided, recorded by the run and shown before and after", (t: TestContext) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ai-log-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  fs.writeFileSync(
    path.join(dir, "ai.js"),
    [
      'const fs = require("fs");',
      "const line = { model: 'llama3.2', input: 'Haz eso', output: { category: 'C' }, ms: 812, apiKey: 'k-1' };",
      "fs.appendFileSync(process.env.SPECGATE_AI_LOG, JSON.stringify(line) + '\\n');",
      "process.exit(1);",
    ].join("\n")
  );
  assert.equal(cli("config", "set", "bdd_cmd", "node ai.js {tags}", "--project-dir", dir).status, 0);
  const stale = path.join(dir, "test-results", "specgate", "ai-decisions.jsonl");
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.writeFileSync(stale, '{"model":"from an older run"}\n');
  const r = cli("evidence", "before", "REQ-031", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const kept = path.join(dir, ".specgate", "evidence", "REQ-031", "before", "artifacts", "specgate", "ai-decisions.jsonl");
  const lines = fs.readFileSync(kept, "utf8").trim().split("\n");
  assert.equal(lines.length, 1, "emptied before the run");

  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(path.join(change, "change.yaml"), "specgate_change_version: 1\nschema: layered\n");
  fs.writeFileSync(
    path.join(change, "specs", "orders", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: REQ-031 — An order is paid\n\nThe system SHALL take it.\n"
  );
  assert.equal(cli("evidence", "draft-orders", "--project-dir", dir).status, 0);
  const page = fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8");
  assert.match(page, /#### AI decisions/);
  assert.match(page, /\| Before \| llama3\.2 \| Haz eso \| `\{"category":"C"\}` \| 812 ms \|/);
  assert.doesNotMatch(page, /k-1/, "a key the record carries is hidden");
});
