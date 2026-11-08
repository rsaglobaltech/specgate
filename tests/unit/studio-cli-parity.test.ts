/**
 * studio-cli-parity: the studio does what the CLI does (REQ-438 … REQ-444).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { actionView, planAction, runAction } from "../../scripts/lib/studio-actions";

/** A project with one open change, `draft-orders`, its one requirement still Draft. */
function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-actions-"));
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.writeFileSync(
    path.join(change, "change.yaml"),
    "specgate_change_version: 1\nschema: spec-driven\nreq_range: [REQ-001, REQ-001]\n"
  );
  fs.writeFileSync(
    path.join(change, "proposal.md"),
    "# Proposal: draft-orders\n\n## Intent\n\nOrders.\n"
  );
  fs.writeFileSync(
    path.join(change, "specs", "orders", "spec.md"),
    "# Delta — orders\n\n## ADDED Requirements\n\n### Requirement: REQ-001 — Place an order\n\nThe system SHALL let a customer place an order.\n\n#### Scenario: SCN-001 — An order\n\n- GIVEN a cart\n- WHEN it is sent\n- THEN it is placed\n\n<!-- specgate:trace status=Draft kind=functional -->\n"
  );
  return dir;
}

async function ended(dir: string) {
  for (let i = 0; i < 150; i++) {
    const v = actionView(dir);
    if (v.last && !v.running && v.last.exit !== null) return v;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error("the command did not end");
}

test("REQ-438 SCN-438a: an offered command is planned with its arguments checked", () => {
  const dir = project();
  assert.deepEqual(planAction(dir, "archive-preview", { change: "draft-orders" }), {
    ok: true,
    argv: ["archive", "draft-orders", "--dry-run"],
  });
  assert.deepEqual(planAction(dir, "apply", { req: "REQ-001" }).ok, true);
  // Some commands read the project from the folder they run in, which is the project's.
  assert.deepEqual(planAction(dir, "check", {}), { ok: true, argv: ["check"], inFolder: true });
  assert.deepEqual(planAction(dir, "config-set", { key: "test_cmd", value: "npm run test:unit" }), {
    ok: true,
    argv: ["config", "set", "test_cmd", "npm run test:unit"],
  });
});

test("REQ-438 SCN-438a: anything the list does not name is refused, naming why, and runs nothing", () => {
  const dir = project();
  const rm = planAction(dir, "rm -rf .", {});
  assert.equal(rm.ok, false);
  assert.equal(!rm.ok && rm.code, "action_unknown");
  const escape = planAction(dir, "archive-preview", { change: "../draft-orders" });
  assert.equal(!escape.ok && escape.code, "argument_invalid");
  assert.match(!escape.ok ? escape.message : "", /change/);
  assert.equal(
    !planAction(dir, "archive", { change: "nope" }).ok && "refused",
    "refused",
    "a change that does not exist"
  );
  assert.equal(planAction(dir, "apply", { req: "REQ-1; rm -rf ." }).ok, false);
  assert.equal(
    planAction(dir, "config-set", { key: "PATH", value: "x" }).ok,
    false,
    "an unknown key"
  );
  assert.equal(
    planAction(dir, "config-set", { key: "pet", value: "maybe" }).ok,
    false,
    "a value the key does not take"
  );
  assert.equal(
    planAction(dir, "archive-preview", { change: "draft-orders", extra: "--force" }).ok,
    false,
    "an argument the action does not take"
  );
  // Refused, it ran nothing: no output was kept.
  assert.equal(runAction(dir, "rm -rf .", {}).ok, false);
  assert.equal(actionView(dir).last, null);
});

test("REQ-438 SCN-438a: the preview runs specgate in the project, its output kept as it grows, its end said", async () => {
  const dir = project();
  const r = runAction(dir, "archive-preview", { change: "draft-orders" });
  assert.equal(r.ok, true, JSON.stringify(r));
  // One at a time.
  assert.equal(runAction(dir, "doctor", {}).ok, false);
  const v = await ended(dir);
  assert.deepEqual(v.last!.argv, ["archive", "draft-orders", "--dry-run"]);
  assert.match(v.output, /draft-orders/);
  assert.equal(typeof v.last!.exit, "number");
  // Kept in the ignored events folder, never where git sees it.
  assert.ok(fs.existsSync(path.join(dir, ".harness", "events", "studio-action.log")));
  assert.equal(
    fs.readFileSync(path.join(dir, ".harness", "events", ".gitignore"), "utf8").trim(),
    "*"
  );
  assert.equal(runAction(dir, "doctor", {}).ok, true, "free again once it ended");
  await ended(dir);
});

test("REQ-438 SCN-438a: over HTTP — an offered command is started with the token, anything else refused", async () => {
  const cp = require("node:child_process");
  const http = require("node:http");
  const dir = project();
  const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");
  const port = 46000 + Math.floor(Math.random() * 2000);
  const child = cp.spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
    detached: process.platform !== "win32",
  });
  const call = (method: string, url: string, body?: unknown, token?: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const data = body === undefined ? "" : JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path: url,
          headers: {
            host: "localhost",
            ...(data ? { "content-type": "application/json" } : {}),
            ...(token ? { "x-specgate-token": token } : {}),
          },
        },
        (res: import("node:http").IncomingMessage) => {
          let out = "";
          res.on("data", (d: Buffer) => (out += d));
          res.on("end", () => resolve({ status: res.statusCode || 0, body: out }));
        }
      );
      req.on("error", reject);
      req.end(data);
    });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("studio did not start")), 10000);
      child.stdout.on("data", (d: Buffer) => {
        if (String(d).includes("http://")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const token = JSON.parse((await call("GET", "/api/ping")).body).token;
    assert.equal(
      (await call("POST", "/api/action", { action: "doctor", args: {} })).status,
      403,
      "no token, no command"
    );
    const rm = await call("POST", "/api/action", { action: "rm -rf .", args: {} }, token);
    assert.equal(rm.status, 422);
    assert.match(JSON.parse(rm.body).message, /does not run/);
    const bad = await call(
      "POST",
      "/api/action",
      { action: "archive-preview", args: { change: "../x" } },
      token
    );
    assert.equal(bad.status, 422);
    const ok = await call(
      "POST",
      "/api/action",
      { action: "archive-preview", args: { change: "draft-orders" } },
      token
    );
    assert.equal(ok.status, 202, ok.body);
    await ended(dir);
    const view = JSON.parse((await call("GET", "/api/action")).body);
    assert.deepEqual(view.last.argv, ["archive", "draft-orders", "--dry-run"]);
    assert.match(view.output, /\$ specgate archive draft-orders --dry-run/);
  } finally {
    try {
      if (process.platform === "win32")
        cp.spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
});

test("REQ-438 SCN-438a: the page shows the very command, its output, and how it ended", () => {
  const studio = require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));
  const run = {
    action: "archive-preview",
    argv: ["archive", "draft-orders", "--dry-run"],
    pid: 1,
    started: 0,
    exit: null,
  };
  const going: string = studio.renderCommand(
    "en",
    run,
    "$ specgate archive draft-orders --dry-run\nreading…\n"
  );
  assert.match(going, /<code class="where">specgate archive draft-orders --dry-run<\/code>/);
  assert.match(going, /Running…/);
  assert.match(going, />reading…\n</);
  assert.doesNotMatch(going, /\$ specgate archive/, "the command is said once, above");
  const failed: string = studio.renderCommand("es", { ...run, exit: 1 }, "✖ draft-orders\n");
  assert.match(failed, /Terminó con error \(código 1\)/);
  assert.match(studio.renderCommand("en", { ...run, exit: 0 }, ""), /Ended well/);
  assert.equal(studio.renderCommand("en", null, ""), "");
});

// ── REQ-439: every change, from proposal to archive ───────────────────────
/** The browser tests' project, with a second change `checkout` whose one requirement is delivered. */
async function twoChanges(): Promise<string> {
  const { makeProject } = await import(
    path.join(__dirname, "..", "..", "..", "e2e", "studio", "fixture.mjs")
  );
  const dir: string = makeProject();
  const c = path.join(dir, "docs", "specs", "changes", "checkout");
  fs.mkdirSync(path.join(c, "specs", "checkout"), { recursive: true });
  fs.writeFileSync(
    path.join(c, "change.yaml"),
    "specgate_change_version: 1\nschema: spec-driven\nrigor: lite\nreq_range: [REQ-011, REQ-011]\n"
  );
  fs.writeFileSync(
    path.join(c, "proposal.md"),
    "# Proposal: checkout\n\n## Intent\n\nPay for an order.\n"
  );
  fs.writeFileSync(path.join(c, "tasks.md"), "# Tasks\n\n- [x] 1.1 The delta\n- [ ] 2.1 REQ-011\n");
  fs.writeFileSync(
    path.join(c, "specs", "checkout", "spec.md"),
    "# Delta — checkout\n\n## ADDED Requirements\n\n### Requirement: REQ-011 — Pay an order\n\nThe system SHALL let a customer pay a placed order.\n\n#### Scenario: SCN-011 — A paid order\n\n- GIVEN a placed order\n- WHEN the customer pays it\n- THEN it is paid\n\n<!-- specgate:trace status=Implemented actor=Customer kind=functional feature=features/checkout/REQ-011.feature test=tests/checkout.test.js -->\n"
  );
  fs.mkdirSync(path.join(dir, "features", "checkout"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "features", "checkout", "REQ-011.feature"),
    "Feature: Pay\n\n  @REQ-011 @SCN-011\n  Scenario: A paid order\n    Given a placed order\n    When the customer pays it\n    Then it is paid\n"
  );
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests", "checkout.test.js"), "// REQ-011 SCN-011\n");
  return dir;
}

test("REQ-439 SCN-439a: Changes lists every open change with its progress; only a delivered one can be archived", async () => {
  const { changesView } = require("../../scripts/lib/studio-app");
  const dir = await twoChanges();
  const v = changesView(dir);
  const ids = v.changes.map((c: { id: string }) => c.id).sort();
  assert.deepEqual(ids, ["checkout", "draft-orders"]);
  const checkout = v.changes.find((c: { id: string }) => c.id === "checkout");
  assert.deepEqual(
    {
      delivered: checkout.delivered,
      total: checkout.requirements.length,
      tasks: [checkout.tasks.done, checkout.tasks.total],
    },
    { delivered: 1, total: 1, tasks: [1, 2] }
  );
  assert.equal(checkout.canArchive, true);
  assert.match(checkout.proposal, /Pay for an order\./);
  assert.equal(checkout.module, null);
  const orders = v.changes.find((c: { id: string }) => c.id === "draft-orders");
  assert.equal(orders.canArchive, false);
  assert.equal(orders.module, "orders");
  assert.equal(v.alm, false);
});

test("REQ-439 SCN-439a: archiving checkout from the studio moves it to the archive", async () => {
  const dir = await twoChanges();
  assert.equal(runAction(dir, "archive", { change: "checkout" }).ok, true);
  const v = await ended(dir);
  assert.equal(v.last!.exit, 0, v.output);
  const archive = path.join(dir, "docs", "specs", "changes", "archive");
  assert.ok(
    fs.readdirSync(archive).some((d) => d.endsWith("-checkout")),
    v.output
  );
  assert.ok(!fs.existsSync(path.join(dir, "docs", "specs", "changes", "checkout")));
  // The undelivered one is refused by archive itself.
  assert.equal(runAction(dir, "archive", { change: "draft-orders" }).ok, true);
  assert.notEqual((await ended(dir)).last!.exit, 0);
});

const studioUi = () => require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));
const checkoutView = (extra: Record<string, unknown> = {}) => ({
  id: "checkout",
  module: null,
  approved: "",
  requirements: [{ id: "REQ-011", title: "Pay an order", status: "Implemented" }],
  delivered: 1,
  tasks: {
    done: 1,
    total: 2,
    items: [
      { text: "1.1 The delta", done: true },
      { text: "2.1 REQ-011", done: false },
    ],
  },
  proposal: "# Proposal: checkout\n\n## Intent\n\nPay for an order.\n",
  canArchive: true,
  ...extra,
});

test("REQ-439 SCN-439a: Changes lists the changes that are not brief modules, each with its progress", () => {
  const html: string = studioUi().renderChanges(
    "en",
    {
      brief: true,
      modules: [
        {
          key: "orders",
          stage: "review",
          requirements: 3,
          scenarios: 3,
          questions: 0,
          findings: [],
          progress: null,
        },
      ],
      job: null,
      step: "",
    },
    [],
    {
      changes: [
        checkoutView(),
        {
          ...checkoutView({
            id: "draft-orders",
            module: "orders",
            canArchive: false,
            delivered: 0,
          }),
        },
      ],
    }
  );
  assert.match(html, /<h3 class="list-head">Other changes<\/h3>/);
  assert.match(
    html,
    /<span class="name">checkout<\/span><span class="faint stage-approved">Ready to archive/
  );
  // The draft of a module is that module's, not listed twice.
  assert.equal((html.match(/<span class="name">orders<\/span>/g) || []).length, 1);
  assert.doesNotMatch(html, /<span class="name">draft-orders<\/span>/);
  assert.match(html, /\+ New change/);
});

test("REQ-439 SCN-439a: a delivered change is archived only after its preview; one still to deliver says when", () => {
  const ui = studioUi();
  const fresh: string = ui.renderChangePanel("en", checkoutView());
  assert.match(fresh, /1 of 1 requirements delivered · 1 of 2 tasks/);
  assert.match(fresh, /REQ-011<\/span> Pay an order <span class="chip ok-chip">Implemented/);
  assert.match(fresh, />See what archive writes</);
  assert.doesNotMatch(fresh, />Archive</, "no archive before the preview");
  assert.match(fresh, /<summary>Proposal<\/summary><pre class="doc-text"># Proposal: checkout/);
  const previewed: string = ui.renderChangePanel(
    "en",
    checkoutView(),
    {
      action: "archive-preview",
      argv: ["archive", "checkout", "--dry-run"],
      pid: 1,
      started: 0,
      exit: 0,
    },
    "Archive plan\n~ docs/specs/capabilities/checkout/spec.md\n"
  );
  assert.match(previewed, /<button type="button" class="btn-primary">Archive<\/button>/);
  assert.match(previewed, /specgate archive checkout --dry-run/);
  assert.match(previewed, /docs\/specs\/capabilities\/checkout\/spec\.md/);
  const pending: string = ui.renderChangePanel(
    "en",
    checkoutView({ canArchive: false, delivered: 0 })
  );
  assert.match(pending, /It is archived once every requirement in it is delivered\./);
  assert.doesNotMatch(pending, /See what archive writes/);
});

test("REQ-439 SCN-439a: a new change from an idea; from a ticket only when an ALM is configured", () => {
  const ui = studioUi();
  const plain: string = ui.renderNewChange("en", false);
  assert.match(
    plain,
    /<label for="new-change-id" class="label">The change&#39;s id<\/label>|<label for="new-change-id" class="label">The change’s id<\/label>|The change's id/
  );
  assert.match(plain, /disabled[^>]*>Propose</);
  assert.doesNotMatch(plain, /From a ticket/);
  assert.match(
    ui.renderNewChange("en", true),
    /<label for="new-change-ticket" class="label">From a ticket<\/label>/
  );
});

// ── REQ-440: the gate and the doctor from the studio ─────────────────────
const CHECK_FAILED = `
  ◆ specgate · check   my-spec-driven-app

  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✖  Tests           node -e "process.exit(1)"
  ✖  The gate failed: \`node -e "process.exit(1)"\`.  [check_tests_failed]
     fix: Make \`node -e "process.exit(1)"\` pass, then run \`specgate check\` again.
`;

test("REQ-440 SCN-440a: the gate's output read as its stages and findings, each finding with its fix", () => {
  const ui = studioUi();
  const r = ui.readCliResult(CHECK_FAILED);
  assert.deepEqual(
    r.items.map((x: { mark: string; name: string }) => `${x.mark} ${x.name}`),
    [
      "skip Ids",
      "pass Specification",
      "fail Tests",
      'fail The gate failed: `node -e "process.exit(1)"`.',
    ]
  );
  const finding = r.items[3];
  assert.equal(finding.code, "check_tests_failed");
  assert.match(finding.fix, /^Make `node -e "process.exit\(1\)"` pass/);
  assert.equal(r.items[2].detail, 'node -e "process.exit(1)"');
});

test("REQ-440: the doctor's findings, a detail on two lines, each with its fix", () => {
  const ui = studioUi();
  const r = ui.readCliResult(`
  ✔  specgate             v0.28.0 — local checkout
                          /Users/me/specgate
  ✖  features/            directory does not exist
                          fix: Create features/ and add at least one .feature file.
  ✔  changes              1 active, 0 archived

  ███████████████░░░░░  9 of 12 checks passed   3 error(s) · 0 warning(s)
`);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].detail, "v0.28.0 — local checkout /Users/me/specgate");
  assert.deepEqual(
    [r.items[1].mark, r.items[1].name, r.items[1].fix],
    ["fail", "features/", "Create features/ and add at least one .feature file."]
  );
  assert.match(r.summary, /9 of 12 checks passed/);
});

test("REQ-440 SCN-440a: the gate run from the studio — Specification passed, Tests failed with the command, not passed", async () => {
  const { makeProject } = await import(
    path.join(__dirname, "..", "..", "..", "e2e", "studio", "fixture.mjs")
  );
  const dir: string = makeProject();
  assert.equal(
    runAction(dir, "config-set", { key: "test_cmd", value: 'node -e "process.exit(1)"' }).ok,
    true
  );
  await ended(dir);
  assert.equal(runAction(dir, "check", {}).ok, true);
  const v = await ended(dir);
  assert.notEqual(v.last!.exit, 0);
  const ui = studioUi();
  const html: string = ui.renderGate("en", v.last, v.output);
  assert.match(
    html,
    /<li class="gate-item gate-pass"><span[^>]*>✓<\/span><strong>Specification<\/strong>/
  );
  assert.match(
    html,
    /<li class="gate-item gate-fail"><span[^>]*>✗<\/span><strong>Tests<\/strong> <code>node -e &quot;process.exit\(1\)&quot;<\/code>/
  );
  assert.match(html, /The gate does not pass/);
  assert.match(html, /fix: Make/);
});

// ── REQ-441: a requirement coded by hand, delivered from the studio ──────
test("REQ-441 SCN-441a: apply refused because no test names REQ-001 — it stays Draft, and the studio says why", async () => {
  const { makeProject } = await import(
    path.join(__dirname, "..", "..", "..", "e2e", "studio", "fixture.mjs")
  );
  const dir: string = makeProject();
  const delta = path.join(
    dir,
    "docs",
    "specs",
    "changes",
    "draft-orders",
    "specs",
    "orders",
    "spec.md"
  );
  const before = fs.readFileSync(delta, "utf8");
  assert.equal(runAction(dir, "apply", { req: "REQ-001" }).ok, true);
  const v = await ended(dir);
  assert.notEqual(v.last!.exit, 0);
  assert.equal(fs.readFileSync(delta, "utf8"), before, "REQ-001 stays as it was: Draft");
  const ui = studioUi();
  const es: string = ui.renderGate("es", v.last, v.output);
  assert.match(es, /No se entregó/);
  assert.match(es, /REQ-001 todavía no tiene una prueba que lo nombre \(TDD-1\)\./);
  assert.match(es, /fix: write a test that names REQ-001/);
  assert.match(
    ui.renderGate("en", v.last, v.output),
    /REQ-001 has no test that names it yet \(TDD-1\)\./
  );
});

test("REQ-441: each requirement still to deliver offers Deliver; a delivered one does not", () => {
  const html: string = studioUi().renderChangePanel(
    "en",
    checkoutView({
      requirements: [
        { id: "REQ-011", title: "Pay an order", status: "Implemented" },
        { id: "REQ-012", title: "Refund", status: "Draft" },
      ],
      delivered: 1,
      canArchive: false,
    })
  );
  assert.equal((html.match(/>Deliver</g) || []).length, 1);
  assert.match(html, /REQ-012<\/span> Refund <span class="chip">Draft<\/span>[^]*?>Deliver</);
});

// ── REQ-442: the project's preferences and the agents, in Settings ───────
test("REQ-442 SCN-442a: the test command changed in Settings — config get answers it; an unknown key is refused", async () => {
  const { preferencesView } = require("../../scripts/lib/studio-actions");
  const { makeProject, CLI } = await import(
    path.join(__dirname, "..", "..", "..", "e2e", "studio", "fixture.mjs")
  );
  const dir: string = makeProject();
  const cp = require("node:child_process");
  cp.execFileSync(
    process.execPath,
    [CLI, "config", "set", "test_cmd", "npm test", "--project-dir", dir],
    { env: { ...process.env, NO_COLOR: "1" } }
  );
  const before = preferencesView(dir);
  assert.equal(before.find((p: { key: string }) => p.key === "test_cmd").value, "npm test");
  assert.deepEqual(before.find((p: { key: string }) => p.key === "pet").options, ["on", "off"]);
  assert.equal(
    runAction(dir, "config-set", { key: "test_cmd", value: "npm run test:unit" }).ok,
    true
  );
  assert.equal((await ended(dir)).last!.exit, 0);
  const got = cp.execFileSync(
    process.execPath,
    [CLI, "config", "get", "test_cmd", "--project-dir", dir],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  assert.match(got, /test_cmd = npm run test:unit/);
  assert.equal(
    preferencesView(dir).find((p: { key: string }) => p.key === "test_cmd").value,
    "npm run test:unit"
  );
  const unknown = runAction(dir, "config-set", { key: "telemetry", value: "on" });
  assert.equal(unknown.ok, false);
});

test("REQ-442: Settings shows each preference with its value, and the agents' guards and integrations", () => {
  const ui = studioUi();
  const html: string = ui.renderPreferences("en", [
    { key: "test_cmd", value: "npm test", options: null },
    { key: "pet", value: null, options: ["on", "off"] },
    { key: "profile", value: "full", options: ["core", "full"] },
  ]);
  assert.match(
    html,
    /<label for="pref-test_cmd"[^>]*>The tests the gate runs <code class="where">test_cmd<\/code><\/label>/
  );
  assert.match(html, /<input id="pref-test_cmd"[^>]*value="npm test"/);
  assert.match(html, /<select id="pref-pet"[^>]*>/);
  assert.match(html, /<option value selected>\(default\)<\/option>/);
  assert.match(html, /<option value="full" selected>full<\/option>/);
  assert.match(html, />Guards for Claude Code</);
  assert.match(html, />For OpenCode</);
  assert.match(html, />Wire the assistants</);
});

test("REQ-442: the guards are installed for this project, never for every project of the user", () => {
  const dir = project();
  assert.deepEqual(planAction(dir, "agents-guards", { tool: "claude-plugin" }), {
    ok: true,
    argv: ["agents", "init", "--tool", "claude-plugin"],
  });
  assert.equal(planAction(dir, "agents-guards", { tool: "cursor" }).ok, false);
  assert.equal(planAction(dir, "agents-install", {}).ok, false, "agents install is not offered");
});

// ── REQ-443: a repository that has code, adopted from the studio ─────────
test("REQ-443 SCN-443a: adopting a repository with a README and code — previewed, then adopted, nothing else changed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-adopt-"));
  fs.writeFileSync(path.join(dir, "README.md"), "# Shop\n");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "index.js"), "console.log(1)\n");
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"shop","scripts":{"test":"node -e 0"}}\n'
  );
  assert.deepEqual(planAction(dir, "adopt-preview", {}), {
    ok: true,
    argv: ["adopt", "--dry-run"],
  });

  assert.equal(runAction(dir, "adopt-preview", {}).ok, true);
  const preview = await ended(dir);
  assert.equal(preview.last!.exit, 0, preview.output);
  assert.match(preview.output, /\+ spec\.md/);
  assert.ok(!fs.existsSync(path.join(dir, "spec.md")), "a preview writes nothing");

  assert.equal(runAction(dir, "adopt", {}).ok, true);
  const adopted = await ended(dir);
  assert.equal(adopted.last!.exit, 0, adopted.output);
  assert.ok(fs.existsSync(path.join(dir, "spec.md")));
  assert.equal(fs.readFileSync(path.join(dir, "README.md"), "utf8"), "# Shop\n");
  assert.equal(fs.readFileSync(path.join(dir, "src", "index.js"), "utf8"), "console.log(1)\n");
});

test("REQ-443: a folder with files offers the preview, then the adoption", () => {
  const ui = studioUi();
  const html: string = ui.renderSettings("en", { isProject: false, empty: false });
  assert.match(html, /This folder already holds files/);
  assert.match(html, />See what adopt writes</);
  assert.doesNotMatch(html, /<button[^>]*>Adopt this folder</, "adoption comes after the preview");
  const previewed: string = ui.renderSettings(
    "en",
    { isProject: false, empty: false },
    [],
    { claude: true, codex: false },
    null,
    null,
    {
      run: { action: "adopt-preview", argv: ["adopt", "--dry-run"], pid: 1, started: 0, exit: 0 },
      output: "+ spec.md   dry run\n",
    }
  );
  assert.match(previewed, /<button[^>]*class="btn-primary"[^>]*>Adopt this folder</);
  assert.match(previewed, /\+ spec\.md/);
});
