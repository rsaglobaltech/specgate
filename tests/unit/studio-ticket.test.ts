/**
 * studio-ticket: a change opened from a ticket in the studio as the CLI opens
 * it — reviewed first, on the ticket's branch, its publishing said and
 * confirmed (REQ-446 … REQ-448).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { actionView, planAction, runAction } from "../../scripts/lib/studio-actions";
import { changesView } from "../../scripts/lib/studio-app";

const studioUi = () => require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });

/** A Jira issue as `/rest/api/3/issue/<key>` returns it, its description in plain text. */
function story(key: string, summary: string, extra: Record<string, unknown> = {}) {
  return {
    key,
    fields: {
      summary,
      issuetype: { name: "Story" },
      labels: [],
      status: { name: "To Do" },
      description:
        "As a customer, I want a refund so that I get my money back.\n\n" +
        "Acceptance Criteria\n" +
        "1. Given a paid order, when a refund is asked, then the money is returned.\n",
      ...extra,
    },
  };
}

/** A Jira that answers the issues it is given, on 127.0.0.1. */
async function jira(issues: Array<{ key: string }>): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    const key = /\/rest\/api\/3\/issue\/([A-Z0-9_]+-\d+)/.exec(req.url || "")?.[1];
    const found = issues.find((i) => i.key === key);
    res.statusCode = found ? 200 : 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(found || { errorMessages: ["Issue does not exist"] }));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

/** A git project with the capabilities `billing` and `orders`, its ALM the given Jira. */
function project(jiraUrl: string, key = "PAY"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-ticket-"));
  for (const capability of ["billing", "orders"]) {
    const where = path.join(dir, "docs", "specs", "capabilities", capability);
    fs.mkdirSync(where, { recursive: true });
    fs.writeFileSync(path.join(where, "spec.md"), `# ${capability}\n`);
  }
  fs.mkdirSync(path.join(dir, "docs", "specs", "changes"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Status |\n|---|---|\n"
  );
  fs.writeFileSync(
    path.join(dir, "alm.config.yaml"),
    [
      "alm_version: 1",
      "provider: jira",
      `base_url: ${jiraUrl}`,
      `project_key: ${key}`,
      "token_env: STUDIO_TICKET_TOKEN",
      "user_env: STUDIO_TICKET_USER",
      "",
    ].join("\n")
  );
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.email", "dev@example.com");
  git(dir, "config", "user.name", "Dev");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "start");
  return dir;
}

process.env.STUDIO_TICKET_TOKEN = "secret-token";
process.env.STUDIO_TICKET_USER = "ba@example.com";

async function ended(dir: string) {
  for (let i = 0; i < 200; i++) {
    const v = actionView(dir);
    if (v.last && !v.running && v.last.exit !== null) return v;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error("the command did not end");
}

// ── REQ-446: a ticket reviewed before its change is opened ───────────────

test("REQ-446 SCN-446a: PAY-123 is reviewed with check --json, its JSON read apart from the prose", async () => {
  const board = await jira([story("PAY-123", "Refund an order")]);
  const dir = project(board.url);
  try {
    const started = runAction(dir, "ticket-check", { ticket: "PAY-123" });
    assert.equal(started.ok, true);
    assert.deepEqual(started.ok && started.run.argv, [
      "propose",
      "--from-ticket",
      "PAY-123",
      "--check",
      "--json",
    ]);
    const v = await ended(dir);
    const review = v.json as {
      ticket: { key: string; summary: string };
      ready: boolean;
      capability: string | null;
      status: Array<{ code: string; fix?: string }>;
    };
    assert.equal(review.ticket.key, "PAY-123");
    assert.equal(review.ready, true);
    assert.equal(review.capability, null);
    assert.deepEqual(
      review.status.map((f) => f.code),
      ["ticket_no_capability"]
    );
    assert.match(v.output, /^\$ specgate propose --from-ticket PAY-123 --check --json/);
    assert.deepEqual(changesView(dir).capabilities, ["billing", "orders"]);
    // Reviewing writes nothing.
    assert.equal(git(dir, "status", "--porcelain").stdout.trim(), "");
  } finally {
    board.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-446 SCN-446a: opened in the capability chosen; one the project lacks is refused", () => {
  const dir = project("http://127.0.0.1:9");
  try {
    assert.deepEqual(
      planAction(dir, "propose-ticket", { ticket: "PAY-123", capability: "orders" }),
      { ok: true, argv: ["propose", "--from-ticket", "PAY-123", "--capability", "orders"] }
    );
    for (const capability of ["payments", "../orders", "orders --no-branch"]) {
      const refused = planAction(dir, "propose-ticket", { ticket: "PAY-123", capability });
      assert.equal(!refused.ok && refused.code, "argument_invalid", capability);
    }
    assert.equal(planAction(dir, "ticket-check", { ticket: "PAY-123; rm -rf ." }).ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const READY = {
  ticket: { key: "PAY-123", summary: "Refund an order", type: "Story", url: "" },
  ready: true,
  capability: null,
  errors: 0,
  warnings: 1,
  next: "specgate propose --from-ticket PAY-123",
  status: [
    {
      severity: "warning",
      code: "ticket_no_capability",
      message: "No capability for PAY-123: it has no epic.",
      fix: "Pass --capability <name> (existing: billing, orders), or map the epic in alm.config.yaml under epics:.",
    },
  ],
};

test("REQ-446 SCN-446a: the review says ready, each finding with its fix, and offers billing and orders", () => {
  const ui = studioUi();
  const html: string = ui.renderFromTicket("en", {
    review: READY,
    capabilities: ["billing", "orders"],
  });
  assert.match(html, /PAY-123/);
  assert.match(html, /Ready to open/);
  assert.match(html, /No capability for PAY-123: it has no epic\./);
  assert.match(html, /Pass --capability &lt;name>/);
  assert.match(html, /<select id="ticket-capability"/);
  assert.match(html, /<option value="billing">billing<\/option>/);
  assert.match(html, /<option value="orders">orders<\/option>/);
  // Until a capability is chosen, the change cannot be opened.
  assert.match(html, /id="ticket-open"[^>]*disabled/);
  // The one chosen is the one the command opens it in.
  const dir = project("http://127.0.0.1:9");
  try {
    const args = ui.ticketOpenArgs(READY, { capability: "orders", push: true });
    assert.deepEqual(planAction(dir, "propose-ticket", args), {
      ok: true,
      argv: ["propose", "--from-ticket", "PAY-123", "--capability", "orders"],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-446: a ticket that is not ready shows its errors with their fix, and cannot be opened", () => {
  const ui = studioUi();
  const html: string = ui.renderFromTicket("en", {
    review: {
      ...READY,
      ready: false,
      errors: 1,
      warnings: 0,
      status: [
        {
          severity: "error",
          code: "ticket_no_criteria",
          message: "PAY-123 has no acceptance criteria.",
          fix: "Add them in Jira as Given / When / Then.",
        },
      ],
    },
    capabilities: ["billing", "orders"],
  });
  assert.match(html, /Not ready/);
  assert.match(html, /PAY-123 has no acceptance criteria\./);
  assert.match(html, /Add them in Jira as Given \/ When \/ Then\./);
  assert.doesNotMatch(html, /id="ticket-open"/);
  assert.doesNotMatch(html, /ticket-capability/);
});
