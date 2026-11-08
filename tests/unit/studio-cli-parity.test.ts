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
