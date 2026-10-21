/**
 * ticket-source — a Jira ticket as source text (ADR-0039, REQ-143…REQ-150).
 *
 * Jira is faked at the `fetch` boundary, from a routes file the shim reads, so
 * every scenario runs offline and the requests it made can be inspected.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const ALM_CLI = path.join(ROOT_DIR, "dist", "scripts", "alm", "cli.js");

/** One canned answer: the first route whose `match` the URL contains wins. */
interface Route {
  match: string;
  method?: string;
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
}

/** What the fake Jira saw. */
interface Seen {
  url: string;
  method: string;
  authorization: boolean;
}

/** A Specgate project with an `alm.config.yaml`. */
function project(config: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ticket-"));
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    "# Traceability Matrix\n\n| Requirement | Status |\n|---|---|\n",
    "utf8"
  );
  fs.writeFileSync(path.join(dir, "alm.config.yaml"), config, "utf8");
  return dir;
}

const JIRA = [
  "alm_version: 1",
  "provider: jira",
  "base_url: https://specgatedemo.atlassian.net",
  "project_key: KAN",
  "token_env: TICKET_TEST_TOKEN",
  "user_env: TICKET_TEST_USER",
  "",
].join("\n");

/** Run a CLI with `fetch` answering from `routes`; returns the run and what was requested. */
function runWithJira(dir: string, cli: string, args: string[], routes: Route[]) {
  const shim = path.join(dir, "shim.js");
  const routesFile = path.join(dir, "routes.json");
  const seenFile = path.join(dir, "seen.json");
  fs.writeFileSync(routesFile, JSON.stringify(routes), "utf8");
  fs.writeFileSync(
    shim,
    [
      `const fs = require("node:fs");`,
      `const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));`,
      `const seenFile = process.argv[3];`,
      `const seen = [];`,
      `globalThis.fetch = async (url, init = {}) => {`,
      `  const headers = init.headers || {};`,
      `  seen.push({ url: String(url), method: init.method || "GET", authorization: Boolean(headers.Authorization) });`,
      `  fs.writeFileSync(seenFile, JSON.stringify(seen));`,
      `  const r = routes.find((x) => String(url).includes(x.match));`,
      `  const status = r ? (r.status || 200) : 404;`,
      `  const body = r && r.json !== undefined ? JSON.stringify(r.json) : "not found";`,
      `  const h = new Map(Object.entries((r && r.headers) || {}).map(([k, v]) => [k.toLowerCase(), v]));`,
      `  return { ok: status < 400, status, headers: { get: (n) => h.get(n.toLowerCase()) ?? null },`,
      `    json: async () => JSON.parse(body), text: async () => body };`,
      `};`,
      `const target = process.argv[4];`,
      `process.argv = [process.argv[0], target, ...process.argv.slice(5)];`,
      `require(target);`,
    ].join("\n"),
    "utf8"
  );
  const run = spawnSync(process.execPath, [shim, routesFile, seenFile, cli, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      TICKET_TEST_TOKEN: "secret-token",
      TICKET_TEST_USER: "ba@example.com",
    },
  });
  const seen: Seen[] = fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, "utf8")) : [];
  return { ...run, seen };
}

/** A Jira issue as `/search/jql` returns it. */
function issue(key: string, summary: string) {
  return {
    key,
    fields: {
      summary,
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: summary }] }],
      },
    },
  };
}

// ── REQ-143 ──────────────────────────────────────────────────────────────────

test("REQ-143 SCN-143a: alm pull searches /search/jql and follows nextPageToken", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [
        { match: "/rest/api/3/search?", status: 410, json: { errorMessages: ["removed"] } },
        {
          match: "nextPageToken=page-2",
          json: { issues: [issue("KAN-16", "Register vehicle exit")], isLast: true },
        },
        {
          match: "/rest/api/3/search/jql",
          json: { issues: [issue("KAN-13", "Register vehicle entry")], nextPageToken: "page-2" },
        },
      ]
    );
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.match(run.stdout, /KAN-13/);
    assert.match(run.stdout, /KAN-16/);
    assert.ok(
      !run.seen.some((s) => s.url.includes("/rest/api/3/search?")),
      "nothing may go to the removed search endpoint"
    );
    const first = run.seen.find((s) => s.url.includes("/search/jql"))!;
    assert.match(first.url, /maxResults=100/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-144 ──────────────────────────────────────────────────────────────────

test("REQ-144 SCN-144a: cloud_id auto sends the API to the gateway, links keep the site", () => {
  const dir = project(JIRA + "cloud_id: auto\n");
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--json", "--project-dir", dir],
      [
        { match: "/_edge/tenant_info", json: { cloudId: "9e49" } },
        {
          match: "api.atlassian.com/ex/jira/9e49/rest/api/3/search/jql",
          json: { issues: [issue("KAN-13", "Register vehicle entry")], isLast: true },
        },
      ]
    );
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const tenant = run.seen.find((s) => s.url.includes("tenant_info"))!;
    assert.equal(tenant.url, "https://specgatedemo.atlassian.net/_edge/tenant_info");
    assert.equal(tenant.authorization, false, "tenant_info must carry no credential");
    const search = run.seen.find((s) => s.url.includes("/search/jql"))!;
    assert.match(
      search.url,
      /^https:\/\/api\.atlassian\.com\/ex\/jira\/9e49\/rest\/api\/3\/search\/jql/
    );
    assert.equal(search.authorization, true);
    const out = JSON.parse(run.stdout) as { pulled: Array<{ issue: string; url: string }> };
    assert.equal(out.pulled[0].url, "https://specgatedemo.atlassian.net/browse/KAN-13");
    assert.ok(!run.stdout.includes("secret-token") && !run.stderr.includes("secret-token"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-144 SCN-144b: a 401 from the site names cloud_id: auto in the fix", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [{ match: "specgatedemo.atlassian.net", status: 401, json: { message: "Unauthorized" } }]
    );
    assert.equal(run.status, 1);
    assert.match(run.stderr + run.stdout, /cloud_id: auto/);
    assert.match(run.stderr + run.stdout, /scope/i);
    assert.ok(!(run.stdout + run.stderr).includes("secret-token"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-144 SCN-144c: a search answered as anonymous fails instead of finding nothing", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--dry-run", "--project-dir", dir],
      [
        {
          match: "/rest/api/3/search/jql",
          json: { issues: [], isLast: true },
          headers: { "X-Seraph-LoginReason": "AUTHENTICATED_FAILED" },
        },
      ]
    );
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr + run.stdout, /cloud_id: auto/);
    assert.doesNotMatch(run.stdout, /No open issues/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Exported tickets ─────────────────────────────────────────────────────────

const PROPOSE = path.join(ROOT_DIR, "dist", "scripts", "propose.js");

type Inline = string | { strong: string };

/** A paragraph as Jira's editor writes one: text runs, some bold. */
function para(...runs: Inline[]) {
  return {
    type: "paragraph",
    content: runs.map((r) =>
      typeof r === "string"
        ? { type: "text", text: r }
        : { type: "text", text: r.strong, marks: [{ type: "strong" }] }
    ),
  };
}

function list(ordered: boolean, items: Inline[][]) {
  return {
    type: ordered ? "orderedList" : "bulletList",
    content: items.map((runs) => ({ type: "listItem", content: [para(...runs)] })),
  };
}

/** "Given …, when …, then …" with the keywords bold, as the analyst wrote KAN-18. */
const gwt = (given: string, when: string, then: string): Inline[] => [
  { strong: "Given" },
  ` ${given}, `,
  { strong: "when" },
  ` ${when}, `,
  { strong: "then" },
  ` ${then}`,
];

const KAN_18 = {
  key: "KAN-18",
  fields: {
    summary: "Parking fee calculation",
    issuetype: { name: "Story" },
    parent: { key: "KAN-6" },
    labels: ["garage-system", "open-questions", "spec-2.2"],
    description: {
      type: "doc",
      version: 1,
      content: [
        para(
          "As an administrator, I want the system to calculate the parking fee automatically so that customers are charged correctly."
        ),
        para({ strong: "Source:" }, " Spec §2.2"),
        para({ strong: "Acceptance Criteria" }),
        list(true, [
          gwt(
            "a vehicle without an active subscription",
            "its exit is registered",
            "the fee = billing increments (rounded up) × rate per increment, and never less than the minimum charge."
          ),
          gwt(
            "a vehicle whose plate has an active subscription on the exit date",
            "its exit is registered",
            "the subscription rule is applied instead of the time-based fee."
          ),
          gwt("the rate in force at exit time", "the fee is calculated", "that rate is used."),
          gwt(
            "the calculation logic",
            "unit tests run",
            "they cover at least: 0 minutes, exactly 1 hour, 1 hour 1 minute, a stay crossing midnight, and a multi-day stay."
          ),
          gwt(
            "any calculated fee",
            "it is stored",
            "it is rounded to 2 decimal places using a decimal type."
          ),
        ]),
        para({ strong: "Open questions" }),
        list(false, [
          [
            "When a subscriber exits, is an invoice issued with amount 0, or no invoice at all? Assumption: invoice issued with amount 0.",
          ],
        ]),
      ],
    },
  },
};

/** A ticket's parts, as `--check --json` reports them. */
interface TicketJson {
  key: string;
  summary: string;
  type: string;
  parent: string | null;
  intent: string;
  source: string | null;
  criteria: string[];
  questions: Array<{ text: string; assumption: string | null }>;
}

function runPropose(dir: string, args: string[]) {
  return spawnSync(process.execPath, [PROPOSE, ...args, "--project-dir", dir], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function exported(dir: string, name: string, issue: unknown): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(issue), "utf8");
  return file;
}

// ── REQ-145 ──────────────────────────────────────────────────────────────────

test("REQ-145 SCN-145a: a story is read into intent, source, criteria and questions", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "KAN-18.json", KAN_18);
    const run = runPropose(dir, ["--from-ticket", file, "--check", "--json"]);
    const doc = JSON.parse(run.stdout) as { ticket: TicketJson };
    const t = doc.ticket;
    assert.equal(t.key, "KAN-18");
    assert.equal(t.type, "Story");
    assert.equal(t.parent, "KAN-6");
    assert.match(t.intent, /^As an administrator/);
    assert.equal(t.source, "Spec §2.2");
    assert.equal(t.criteria.length, 5);
    assert.match(t.criteria[0], /^Given a vehicle without an active subscription, when/);
    assert.equal(t.questions.length, 1);
    assert.match(t.questions[0].text, /^When a subscriber exits/);
    assert.equal(t.questions[0].assumption, "invoice issued with amount 0.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-145 SCN-145b: German headings in a plain-text description", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "story.json", {
      key: "KAN-70",
      fields: {
        summary: "Kennzeichen suchen",
        issuetype: { name: "Story" },
        labels: [],
        description: [
          "Als Administrator möchte ich ein Fahrzeug nach Kennzeichen finden.",
          "",
          "Akzeptanzkriterien:",
          "- Angenommen das Kennzeichen AB123CD ist in der Garage, wenn ich AB123CD suche, dann erscheint es in der Liste.",
          "- Angenommen kein Fahrzeug passt, wenn ich suche, dann erscheint 'Kein Fahrzeug gefunden'.",
          "",
          "Offene Fragen",
          "- Soll die Suche Teiltreffer finden? Annahme: ja, ab 3 Zeichen.",
        ].join("\n"),
      },
    });
    const run = runPropose(dir, ["--from-ticket", file, "--check", "--json"]);
    const t = (JSON.parse(run.stdout) as { ticket: TicketJson }).ticket;
    assert.equal(t.criteria.length, 2);
    assert.match(t.criteria[1], /Kein Fahrzeug gefunden/);
    assert.equal(t.questions.length, 1);
    assert.equal(t.questions[0].assumption, "ja, ab 3 Zeichen.");
    assert.match(t.intent, /^Als Administrator/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-145: acceptance_field, when it has text, is where the criteria come from", () => {
  const dir = project(JIRA + "acceptance_field: customfield_10050\n");
  try {
    const file = exported(dir, "story.json", {
      key: "KAN-71",
      fields: {
        summary: "Export invoices",
        issuetype: { name: "Story" },
        description: "As an accountant I want a CSV of the month's invoices.",
        customfield_10050: {
          type: "doc",
          content: [
            list(false, [
              ["Given October has 3 invoices, when I export October, then the CSV has 3 rows."],
            ]),
          ],
        },
      },
    });
    const run = runPropose(dir, ["--from-ticket", file, "--check", "--json"]);
    const t = (JSON.parse(run.stdout) as { ticket: TicketJson }).ticket;
    assert.deepEqual(t.criteria, [
      "Given October has 3 invoices, when I export October, then the CSV has 3 rows.",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-146 ──────────────────────────────────────────────────────────────────

const { checkTicket, readTicket } = require("../../packages/core/src/domain/TicketText");

/** A story with these criteria, as plain text. */
function story(key: string, criteria: string[], extra: Record<string, unknown> = {}) {
  return {
    key,
    fields: {
      summary: "A story",
      issuetype: { name: "Story" },
      labels: [],
      description: [
        "As an administrator I want this.",
        "",
        ...(criteria.length ? ["Acceptance Criteria", ...criteria.map((c) => `- ${c}`)] : []),
      ].join("\n"),
      ...extra,
    },
  };
}

const codes = (issue: unknown) =>
  (checkTicket(readTicket(issue)) as Array<{ code: string }>).map((d) => d.code);

test("REQ-146 SCN-146a: no criteria is T1, nothing is written", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "story.json", story("KAN-72", []));
    const before = fs.readdirSync(dir).sort();
    const run = runPropose(dir, ["--from-ticket", file, "--check"]);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stdout + run.stderr, /T1_no_criteria/);
    assert.match(run.stdout + run.stderr, /Acceptance Criteria/);
    assert.deepEqual(fs.readdirSync(dir).sort(), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-146 SCN-146b: a criterion that prescribes tests warns, the ticket is ready", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "KAN-18.json", KAN_18);
    const run = runPropose(dir, ["--from-ticket", file, "--check"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /T6_test_instruction[^\n]*criterion 4/);
    assert.match(run.stdout, /Ready to draft/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-146 SCN-146c: vague German words are T2, named", () => {
  const dir = project(JIRA);
  try {
    const file = exported(
      dir,
      "story.json",
      story("KAN-73", ["Die Liste lädt schnell und ist benutzerfreundlich"])
    );
    const run = runPropose(dir, ["--from-ticket", file, "--check"]);
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /T2_vague[^\n]*"schnell"[^\n]*"benutzerfreundlich"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-146 SCN-146d: criteria about deliverables are T7", () => {
  const dir = project(JIRA);
  try {
    const file = exported(
      dir,
      "story.json",
      story("KAN-56", [
        "Given the design work, when user flows are delivered, then they cover login.",
        "Given the flows, when they are reviewed, then the product owner approves them.",
      ])
    );
    const run = runPropose(dir, ["--from-ticket", file, "--check"]);
    assert.match(run.stdout, /T7_not_behaviour/);
    assert.match(run.stdout, /tracked on the board, not specified/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-146: the remaining T-rules, each on the case it names", () => {
  const nine = Array.from(
    { length: 9 },
    (_, i) => `Given ${i} cars, when one leaves, then ${i - 1} remain.`
  );
  assert.ok(codes(story("KAN-80", nine)).includes("T5_too_big"));
  assert.ok(
    codes(
      story("KAN-81", [
        "Given a busy morning, when an entry is saved, then the response time stays low",
      ])
    ).includes("T3_unmeasured")
  );
  assert.ok(
    codes(story("KAN-82", ["Given a plate, when it is saved, then PostgreSQL stores it"])).includes(
      "T4_technical"
    )
  );
  const orphan = {
    key: "KAN-3",
    fields: {
      summary: "Subtask 2.1",
      issuetype: { name: "Subtask" },
      description: { type: "doc", content: [] },
    },
  };
  assert.deepEqual(codes(orphan).sort(), ["T1_no_criteria", "T8_orphan_subtask"]);
  assert.ok(
    codes(KAN_18).every((c: string) => c !== "T9_open_question"),
    "KAN-18's question states its assumption"
  );
  const asked = story("KAN-83", ["Given a plate, when it is saved, then it is listed."]);
  (asked.fields as { description: string }).description +=
    "\n\nOpen questions\n- Do we keep plates after a year?";
  assert.ok(codes(asked).includes("T9_open_question"));
  assert.deepEqual(
    codes(story("KAN-84", ["Given a plate AB123CD, when it is saved, then it is listed."])),
    []
  );
  // What the real KAN board taught: behaviour words that are not quantities.
  assert.deepEqual(
    codes(
      story("KAN-63", [
        'Given the dashboard, when it loads, then quick-action buttons "Register entry" are visible.',
        "Given a voided invoice, when I void it again, then the action is not available.",
      ])
    ),
    []
  );
  const epic = {
    key: "KAN-5",
    fields: { summary: "E2 · Vehicle Entry & Exit", issuetype: { name: "Epic" } },
  };
  assert.deepEqual(codes(epic), ["ticket_epic"]);
});

// ── REQ-147 ──────────────────────────────────────────────────────────────────

const KAN_13 = {
  key: "KAN-13",
  fields: {
    summary: "Register vehicle entry",
    issuetype: { name: "Story" },
    parent: { key: "KAN-5" },
    labels: ["garage-system", "spec-2.1"],
    description: {
      type: "doc",
      version: 1,
      content: [
        para(
          "As an administrator, I want to register a vehicle's entry so that I can track which vehicles are in the garage and since when."
        ),
        para({ strong: "Source:" }, " Spec §2.1 (Vehicle entry registration)"),
        para({ strong: "Acceptance Criteria" }),
        list(false, [
          gwt(
            "the entry form",
            "it is displayed",
            "it contains: license plate (required), vehicle type (required), owner name (optional) and entry date/time."
          ),
          gwt(
            "the entry form",
            "it opens",
            "the entry date/time is pre-filled with the current date and time."
          ),
          gwt(
            'a plate typed with lowercase letters or spaces (e.g. "ab 123 cd")',
            "I save",
            'it is stored normalized as uppercase without spaces ("AB123CD").'
          ),
          gwt(
            "a required field is empty",
            "I save",
            "the entry is not saved and the missing field is highlighted."
          ),
          gwt(
            "a plate that already has an open entry",
            "I try to register a new entry",
            'it is rejected with the message "Vehicle is already in the garage".'
          ),
          gwt(
            "valid input",
            "I save",
            'the entry is stored with status "inside" and appears in the list of vehicles in the garage.'
          ),
        ]),
      ],
    },
  },
};

const CHANGE_13 = path.join("docs", "specs", "changes", "kan-13-register-vehicle-entry");

test("REQ-147 SCN-147a: KAN-13 opens a change checked against its own words", () => {
  const dir = project(JIRA + "epics:\n  KAN-5: entry-exit\n");
  try {
    const file = exported(dir, "KAN-13.json", KAN_13);
    const run = runPropose(dir, ["--from-ticket", file, "--no-branch"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const change = path.join(dir, CHANGE_13);
    const read = (f: string) => fs.readFileSync(path.join(change, f), "utf8");
    assert.match(read("ticket.md"), /Vehicle is already in the garage/);
    assert.match(read("ticket.md"), /As an administrator, I want to register/);
    assert.match(read("proposal.md"), /ticket: KAN-13/);
    assert.match(read("proposal.md"), /> As an administrator/);
    const guide = read("DRAFTING.md");
    assert.equal((guide.match(/^\d\. Given /gm) || []).length, 6, guide);
    assert.match(guide, /`AB123CD`/);
    assert.ok(fs.existsSync(path.join(change, "specs", "entry-exit", "spec.md")));
    const yaml = read("change.yaml");
    assert.match(
      yaml,
      new RegExp(`^brief: ${CHANGE_13.split(path.sep).join("/")}/ticket\\.md$`, "m")
    );
    assert.match(yaml, /^ticket: KAN-13$/m);
    assert.match(yaml, /^ticket_sha256: [0-9a-f]{64}$/m);
    assert.match(run.stdout, /kan-13-register-vehicle-entry/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-147 SCN-147b: an epic nobody mapped opens nothing", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "KAN-13.json", KAN_13);
    const run = runPropose(dir, ["--from-ticket", file, "--no-branch"]);
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /ticket_no_capability/);
    assert.match(run.stdout + run.stderr, /--capability/);
    assert.match(run.stdout + run.stderr, /epics:/);
    assert.ok(!fs.existsSync(path.join(dir, CHANGE_13)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-147: a ticket with an error opens nothing", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "story.json", story("KAN-72", []));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "x", "--no-branch"]);
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /ticket_not_ready/);
    assert.ok(!fs.existsSync(path.join(dir, "docs", "specs", "changes")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-147 SCN-147c: the copy edited to pass is refused", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "KAN-13.json", KAN_13);
    const opened = runPropose(dir, [
      "--from-ticket",
      file,
      "--capability",
      "entry-exit",
      "--no-branch",
    ]);
    assert.equal(opened.status, 0, opened.stdout + opened.stderr);
    const copy = path.join(dir, CHANGE_13, "ticket.md");
    fs.appendFileSync(copy, "\n- Given anything, then 42.\n");
    const again = runPropose(dir, ["--from-ticket", file, "--no-branch"]);
    assert.match(again.stdout + again.stderr, /ticket_copy_edited/);
    assert.doesNotMatch(again.stdout, /Ready to review/);
    assert.equal(again.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-148 ──────────────────────────────────────────────────────────────────

const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

function git(dir: string, ...args: string[]) {
  const r = spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=T", ...args],
    {
      encoding: "utf8",
    }
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

/**
 * A project in a git repository, everything committed on `main`. Its own
 * identity: `propose` commits the opening (REQ-165), and a CI runner has no
 * global one.
 */
function repo(config = JIRA): string {
  const dir = project(config);
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}

test("REQ-148 SCN-148a: a story becomes feature/KAN-13-…, a bug bugfix/…", () => {
  const dir = repo();
  try {
    const file = path.join(os.tmpdir(), `kan13-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(
      git(dir, "rev-parse", "--abbrev-ref", "HEAD"),
      "feature/KAN-13-register-vehicle-entry"
    );
    fs.rmSync(file);

    git(dir, "checkout", "-q", "main");
    git(dir, "clean", "-qfd");
    const bug = story(
      "KAN-90",
      ["Given a plate with a dash, when I save, then it is stored without it."],
      {
        summary: "Plate with dash rejected",
        issuetype: { name: "Bug" },
      }
    );
    const bugFile = path.join(os.tmpdir(), `kan90-${process.pid}.json`);
    fs.writeFileSync(bugFile, JSON.stringify(bug));
    const fixed = runPropose(dir, ["--from-ticket", bugFile, "--capability", "entry-exit"]);
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    assert.equal(
      git(dir, "rev-parse", "--abbrev-ref", "HEAD"),
      "bugfix/KAN-90-plate-with-dash-rejected"
    );
    fs.rmSync(bugFile);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148: --no-branch, or uncommitted work, leaves the branch alone", () => {
  const dir = repo();
  try {
    fs.writeFileSync(path.join(dir, "wip.txt"), "unsaved");
    const file = exported(dir, "KAN-13.json", KAN_13);
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD"), "main");
    assert.match(run.stdout, /uncommitted/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148 SCN-148b: check warns for each commit that does not name the ticket", () => {
  const dir = repo();
  try {
    git(dir, "checkout", "-q", "-b", "feature/KAN-13-register-vehicle-entry");
    fs.writeFileSync(path.join(dir, "a.txt"), "a");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-13 REQ-151: normalize plates");
    fs.writeFileSync(path.join(dir, "b.txt"), "b");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "fix typo");
    const run = spawnSync(process.execPath, [CLI, "check", dir, "--json"], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    const doc = JSON.parse(run.stdout) as { status: Array<{ code: string; message: string }> };
    const missing = doc.status.filter((d) => d.code === "ticket_key_missing");
    assert.equal(missing.length, 1, run.stdout);
    assert.match(missing[0].message, /fix typo/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148 SCN-148c: the analyst changed a criterion", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "KAN-13.json", KAN_13);
    assert.equal(
      runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit", "--no-branch"]).status,
      0
    );
    const changed = JSON.parse(JSON.stringify(KAN_13));
    const second = changed.fields.description.content[3].content[1].content[0].content;
    second[second.length - 1].text = " the entry date/time is pre-filled with the current time.";
    fs.writeFileSync(file, JSON.stringify(changed));
    const run = runPropose(dir, ["--from-ticket", file, "--check"]);
    assert.match(run.stdout, /ticket_changed/);
    assert.match(run.stdout, /- .*pre-filled with the current date and time\./);
    assert.match(run.stdout, /\+ .*pre-filled with the current time\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-149 ──────────────────────────────────────────────────────────────────

const PR_CONFIG =
  JIRA +
  "pr:\n  provider: github\n  repo: acme/garage\n  base: develop\n  token_env: TICKET_TEST_GH\n";

/** A repo on the ticket's branch, with a change holding REQ-151 Implemented, and a bare origin. */
function ticketRepo(): { dir: string; origin: string } {
  const dir = repo(PR_CONFIG);
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-origin-"));
  git(origin, "init", "-q", "--bare");
  git(dir, "remote", "add", "origin", origin);
  git(dir, "checkout", "-q", "-b", "feature/KAN-13-register-vehicle-entry");
  const change = path.join(dir, CHANGE_13);
  fs.mkdirSync(path.join(change, "specs", "entry-exit"), { recursive: true });
  fs.writeFileSync(
    path.join(change, "ticket.md"),
    "# KAN-13 — Register vehicle entry\n\n<!-- specgate:ticket key=KAN-13 url=https://specgatedemo.atlassian.net/browse/KAN-13 -->\n"
  );
  fs.writeFileSync(
    path.join(change, "change.yaml"),
    "specgate_change_version: 1\nticket: KAN-13\n"
  );
  fs.writeFileSync(
    path.join(change, "specs", "entry-exit", "spec.md"),
    [
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-151 — License plate normalization",
      "",
      "<!-- specgate:trace actor=Administrator kind=business-rule status=Implemented -->",
      "",
    ].join("\n")
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "KAN-13 REQ-151: normalize plates");
  return { dir, origin };
}

/** The bodies the fake GitHub received, by method. */
function sent(dir: string): Array<{ url: string; method: string; body: Record<string, unknown> }> {
  const file = path.join(dir, "bodies.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

function runPr(dir: string, routes: Route[]) {
  const shim = path.join(dir, "..", `pr-shim-${process.pid}.js`);
  const routesFile = path.join(dir, "..", `pr-routes-${process.pid}.json`);
  fs.writeFileSync(routesFile, JSON.stringify(routes));
  fs.writeFileSync(
    shim,
    [
      `const fs = require("node:fs");`,
      `const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));`,
      `const out = process.argv[3];`,
      `globalThis.fetch = async (url, init = {}) => {`,
      `  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];`,
      `  all.push({ url: String(url), method: init.method || "GET", auth: (init.headers || {}).Authorization || "", body: init.body ? JSON.parse(init.body) : null });`,
      `  fs.writeFileSync(out, JSON.stringify(all));`,
      `  const r = routes.find((x) => String(url).includes(x.match) && (!x.method || x.method === (init.method || "GET")));`,
      `  const status = r ? (r.status || 200) : 404;`,
      `  const body = JSON.stringify(r ? r.json : { message: "Not Found" });`,
      `  return { ok: status < 400, status, headers: { get: () => null }, json: async () => JSON.parse(body), text: async () => body };`,
      `};`,
      `process.argv = [process.argv[0], process.argv[4], ...process.argv.slice(5)];`,
      `require(process.argv[1]);`,
    ].join("\n")
  );
  const run = spawnSync(
    process.execPath,
    [
      shim,
      routesFile,
      path.join(dir, "bodies.json"),
      ALM_CLI,
      "pr",
      "kan-13-register-vehicle-entry",
      "--no-check",
      "--project-dir",
      dir,
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1", TICKET_TEST_GH: "gh-secret" } }
  );
  fs.rmSync(shim);
  fs.rmSync(routesFile);
  return run;
}

test("REQ-149 SCN-149a: the first pull request, titled with the key, against develop", () => {
  const { dir, origin } = ticketRepo();
  try {
    const run = runPr(dir, [
      { match: "/repos/acme/garage/pulls?", json: [] },
      {
        match: "/repos/acme/garage/pulls",
        method: "POST",
        json: { number: 7, html_url: "https://github.com/acme/garage/pull/7" },
      },
    ]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(
      git(origin, "rev-parse", "--verify", "feature/KAN-13-register-vehicle-entry").length,
      40
    );
    const posts = sent(dir).filter((s) => s.method === "POST");
    assert.equal(posts.length, 1);
    const pr = posts[0].body;
    assert.equal(pr.title, "KAN-13 Register vehicle entry");
    assert.equal(pr.base, "develop");
    assert.equal(pr.head, "feature/KAN-13-register-vehicle-entry");
    assert.match(String(pr.body), /KAN-13/);
    assert.match(String(pr.body), /REQ-151[^\n]*Implemented/);
    assert.match(String(pr.body), /specgate check/);
    assert.match(
      sent(dir)[0].url,
      /head=acme%3Afeature%2FKAN-13-register-vehicle-entry|head=acme:feature\/KAN-13/
    );
    assert.match(run.stdout, /github\.com\/acme\/garage\/pull\/7/);
    assert.ok(!(run.stdout + run.stderr).includes("gh-secret"));
    assert.ok(
      sent(dir).every((s) => s.method !== "PUT" && !/merge/.test(s.url)),
      "never merges"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-149 SCN-149b: run again, the same pull request is updated", () => {
  const { dir, origin } = ticketRepo();
  try {
    const run = runPr(dir, [
      {
        match: "/repos/acme/garage/pulls?",
        json: [{ number: 7, html_url: "https://github.com/acme/garage/pull/7" }],
      },
      {
        match: "/repos/acme/garage/pulls/7",
        method: "PATCH",
        json: { number: 7, html_url: "https://github.com/acme/garage/pull/7" },
      },
    ]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(sent(dir).filter((s) => s.method === "POST").length, 0);
    const patch = sent(dir).find((s) => s.method === "PATCH")!;
    assert.equal(patch.body.title, "KAN-13 Register vehicle entry");
    assert.match(run.stdout, /updated/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

// ── REQ-150 ──────────────────────────────────────────────────────────────────

test("REQ-150 SCN-150a: the page and the help agree", () => {
  const page = fs.readFileSync(path.join(ROOT_DIR, "docs", "from-a-ticket.md"), "utf8");
  for (const rule of [
    "T1_no_criteria",
    "T2_vague",
    "T3_unmeasured",
    "T4_technical",
    "T5_too_big",
    "T6_test_instruction",
    "T7_not_behaviour",
    "T8_orphan_subtask",
    "T9_open_question",
    "ticket_epic",
    "ticket_changed",
    "ticket_key_missing",
  ]) {
    assert.ok(page.includes(rule), `the page explains ${rule}`);
  }
  assert.match(page, /cloud_id: auto/);
  assert.match(page, /specgate alm pr/);
  assert.match(page, /token_env/);
  assert.doesNotMatch(page, /ATATT|ghp_|github_pat_/, "no token, not even an example one");
  const help = spawnSync(process.execPath, [CLI, "propose", "--help"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  }).stdout;
  assert.match(help, /--from-ticket/);
  const alm = spawnSync(process.execPath, [ALM_CLI, "--help"], { encoding: "utf8" }).stdout;
  assert.match(alm, /alm pr/);
  const commands = fs.readFileSync(path.join(ROOT_DIR, "docs", "commands.md"), "utf8");
  assert.match(commands, /--from-ticket/);
  assert.match(commands, /specgate alm pr/);
});

test("REQ-150: propose --from-ticket --help explains the options, it is not a ticket key", () => {
  const run = spawnSync(process.execPath, [PROPOSE, "--from-ticket", "--help"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--capability/);
  assert.match(run.stdout, /--no-branch/);
  assert.match(run.stdout, /from-a-ticket\.md/);
});

// ── Review findings: the edges ───────────────────────────────────────────────

test("REQ-147: a key that is not a Jira key opens nothing, wherever it would point", () => {
  for (const key of ["../../../../escape-1", "KAN-1\nticket_sha256: 0", "", "kan-1"]) {
    const dir = project(JIRA);
    try {
      const file = exported(
        dir,
        "bad.json",
        story(key, ["Given a plate, when saved, then listed."])
      );
      const run = runPropose(dir, ["--from-ticket", file, "--capability", "x", "--no-branch"]);
      assert.equal(run.status, 1, `${JSON.stringify(key)}: ${run.stdout}`);
      assert.match(run.stdout + run.stderr, /ticket_bad_key/);
      assert.ok(!fs.existsSync(path.join(dir, "docs", "specs", "changes")));
      assert.ok(!fs.existsSync(path.resolve(dir, "..", "..", "escape-1")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("REQ-145: no text of a criteria section is lost, list or not", () => {
  const t = readTicket({
    key: "KAN-91",
    fields: {
      description: [
        "Acceptance Criteria",
        "Given a plate AB123CD, when I save, then it is listed.",
        "- Given an empty plate, when I save, then it is refused.",
        "",
        "Given a full garage, when a car arrives, then entry is refused.",
      ].join("\n"),
    },
  });
  assert.equal(t.criteria.length, 3, JSON.stringify(t.criteria));
  assert.match(t.criteria[2], /full garage/);
});

test("REQ-145: mentions, emoji, links and dates keep their text", () => {
  const { documentText } = require("../../packages/core/src/domain/TicketText");
  const text = documentText({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Given " },
          { type: "mention", attrs: { text: "@Ana" } },
          { type: "text", text: " opens " },
          { type: "inlineCard", attrs: { url: "https://example.com/x" } },
          { type: "emoji", attrs: { text: "✅" } },
        ],
      },
    ],
  });
  assert.equal(text, "Given @Ana opens https://example.com/x✅");
});

test("REQ-143: alm pull keeps a paragraph on one line, bold words and all", () => {
  const dir = project(JIRA);
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--label", "spec-driven", "--project-dir", dir],
      [
        {
          match: "/rest/api/3/search/jql",
          json: {
            isLast: true,
            issues: [
              {
                key: "KAN-13",
                fields: {
                  summary: "Register vehicle entry",
                  description: {
                    type: "doc",
                    content: [para("This is ", { strong: "bold" }, " text")],
                  },
                },
              },
            ],
          },
        },
      ]
    );
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const proposal = fs.readFileSync(
      path.join(dir, "docs", "specs", "changes", "alm-kan-13", "proposal.md"),
      "utf8"
    );
    assert.match(proposal, /This is bold text/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-144: credentials never travel over plain http", () => {
  const dir = project(JIRA.replace("https://specgatedemo", "http://specgatedemo"));
  try {
    const run = runWithJira(
      dir,
      ALM_CLI,
      ["pull", "--dry-run", "--project-dir", dir],
      [{ match: "/search/jql", json: { issues: [], isLast: true } }]
    );
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /https/);
    assert.equal(run.seen.length, 0, "no request may leave");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148: the ticket's branch starts from the base, not from another ticket's branch", () => {
  const dir = repo();
  try {
    git(dir, "checkout", "-q", "-b", "feature/KAN-12-other");
    fs.writeFileSync(path.join(dir, "other.txt"), "x");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-12 other work");
    const file = path.join(os.tmpdir(), `kan13b-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit"]);
    fs.rmSync(file);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(
      git(dir, "rev-parse", "--abbrev-ref", "HEAD"),
      "feature/KAN-13-register-vehicle-entry"
    );
    // Only the opening of KAN-13's change (REQ-165); nothing of KAN-12 comes along.
    assert.equal(
      git(dir, "log", "--format=%s", "main..HEAD"),
      "KAN-13 docs(spec): open the change from the ticket"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-149: alm pr refuses uncommitted work: the pull request would not hold it", () => {
  const { dir, origin } = ticketRepo();
  try {
    fs.writeFileSync(path.join(dir, "wip.txt"), "unsaved");
    const run = runPr(dir, []);
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /uncommitted/);
    assert.equal(sent(dir).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-149: the update keeps what a person wrote, and only looks at the base it targets", () => {
  const { dir, origin } = ticketRepo();
  try {
    const run = runPr(dir, [
      {
        match: "/repos/acme/garage/pulls?",
        json: [
          {
            number: 7,
            html_url: "https://github.com/acme/garage/pull/7",
            title: "KAN-13 Register entry (reviewed by Ana)",
            base: { ref: "develop" },
            body: "Reviewer notes: check the plates.\n\n<!-- specgate:pr change=kan-13-register-vehicle-entry -->\nold\n<!-- /specgate:pr -->",
          },
        ],
      },
      {
        match: "/repos/acme/garage/pulls/7",
        method: "PATCH",
        json: { number: 7, html_url: "https://github.com/acme/garage/pull/7" },
      },
    ]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(sent(dir)[0].url, /base=develop/);
    const patch = sent(dir).find((s) => s.method === "PATCH")!;
    assert.equal(patch.body.title, undefined, "a title that names the key is the person's");
    assert.match(String(patch.body.body), /^Reviewer notes: check the plates\./);
    assert.match(String(patch.body.body), /REQ-151/);
    assert.doesNotMatch(String(patch.body.body), /\nold\n/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-145: criteria on consecutive lines, each opening with Given, stay apart", () => {
  const plain = readTicket({
    key: "KAN-92",
    fields: {
      description: [
        "Akzeptanzkriterien",
        "Angenommen A, wenn B, dann C.",
        "Angenommen D, wenn E, dann F.",
        "Given G, when H,",
        "then I.",
      ].join("\n"),
    },
  });
  assert.equal(plain.criteria.length, 3, JSON.stringify(plain.criteria));
  assert.equal(plain.criteria[2], "Given G, when H, then I.");
  const adf = readTicket({
    key: "KAN-93",
    fields: {
      description: {
        type: "doc",
        content: [
          para({ strong: "Acceptance Criteria" }),
          para("Given A, then B."),
          para("Given C, then D."),
          para("Given E, then F."),
        ],
      },
    },
  });
  assert.equal(adf.criteria.length, 3, JSON.stringify(adf.criteria));
});

test("REQ-148: a base that is not a safe git ref is refused, never replaced by HEAD", () => {
  const dir = repo();
  try {
    git(dir, "checkout", "-q", "-b", "feature/KAN-12-other");
    const file = path.join(os.tmpdir(), `kan13c-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = spawnSync(
      process.execPath,
      [PROPOSE, "--from-ticket", file, "--capability", "entry-exit", "--project-dir", dir],
      {
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "--output=/tmp/x" },
      }
    );
    fs.rmSync(file);
    assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD"), "feature/KAN-12-other");
    assert.match(run.stdout, /not a safe git ref/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-147: a change being opened is not a change", () => {
  const { listChangeIds } = require("../../packages/core/src/infrastructure/ChangeWorkspace");
  const dir = project(JIRA);
  try {
    fs.mkdirSync(path.join(dir, "docs", "specs", "changes", ".kan-13-x.opening"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(dir, "docs", "specs", "changes", "kan-14-y"), { recursive: true });
    assert.deepEqual(listChangeIds(dir), ["kan-14-y"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-149: a lost closing marker does not make the block grow on every run", () => {
  const { mergeBody } = require("../../scripts/vcs/github-pr");
  const block = "<!-- specgate:pr change=c -->\nnew\n<!-- /specgate:pr -->";
  const once = mergeBody("Notes.\n\n<!-- specgate:pr change=c -->\nold, closer deleted", block);
  assert.equal(once, `Notes.\n\n${block}`);
  assert.equal(mergeBody(once, block), once);
});

test("REQ-149: a ticket: in change.yaml that is not a Jira key pushes nothing", () => {
  const { dir, origin } = ticketRepo();
  try {
    const yaml = path.join(dir, CHANGE_13, "change.yaml");
    fs.writeFileSync(yaml, "specgate_change_version: 1\nticket: KAN-1(\n");
    git(dir, "commit", "-qam", "KAN-13 broken key");
    const run = runPr(dir, []);
    assert.equal(run.status, 1);
    assert.match(run.stdout + run.stderr, /not a Jira issue key/);
    assert.equal(
      spawnSync("git", ["-C", origin, "branch", "--list"], { encoding: "utf8" }).stdout.trim(),
      ""
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-147: --agent on an open change hands the agent the findings to fix", () => {
  const dir = repo();
  try {
    const file = path.join(os.tmpdir(), `kan13d-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    assert.equal(
      runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit", "--no-branch"]).status,
      0
    );
    const change = path.join(dir, CHANGE_13);
    fs.writeFileSync(
      path.join(change, "specs", "entry-exit", "spec.md"),
      [
        "## ADDED Requirements",
        "",
        "### Requirement: REQ-001 — Plates are normalized",
        "",
        "<!-- specgate:trace actor=Administrator kind=business-rule -->",
        "",
        "The system SHALL store a plate in uppercase without spaces.",
        "",
        "#### Scenario: SCN-001 — A lowercase plate",
        "",
        '- GIVEN a plate typed as "ab 123 cd"',
        "- WHEN I save",
        '- THEN it is stored as "AB123CD"',
        "",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(change, "questions.md"),
      "| # | Question | Blocks | Answer |\n|---|---|---|---|\n| Q1 | Keep plates after a year? |  |  |\n"
    );
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "draft");
    const prompt = path.join(os.tmpdir(), `prompt-${process.pid}.txt`);
    const run = runPropose(dir, ["--from-ticket", file, "--agent", `cat > ${prompt}`]);
    fs.rmSync(file);
    const sentPrompt = fs.readFileSync(prompt, "utf8");
    fs.rmSync(prompt);
    assert.match(sentPrompt, /Fix these findings, and only these/, run.stdout);
    assert.match(sentPrompt, /D7_floating_question/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148 SCN-148d: the branch is on the host as soon as work starts", () => {
  const dir = repo();
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-origin-"));
  try {
    git(origin, "init", "-q", "--bare");
    git(dir, "remote", "add", "origin", origin);
    git(dir, "push", "-q", "origin", "main");
    const file = path.join(os.tmpdir(), `kan13e-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit"]);
    fs.rmSync(file);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(
      git(origin, "branch", "--list", "feature/KAN-13-register-vehicle-entry")
        .replace("*", "")
        .trim(),
      "feature/KAN-13-register-vehicle-entry"
    );
    assert.equal(
      git(dir, "rev-parse", "--abbrev-ref", "@{upstream}"),
      "origin/feature/KAN-13-register-vehicle-entry"
    );
    assert.match(run.stdout, /pushed/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-148: --no-push keeps the branch local; a failed push is said, the change stays", () => {
  const dir = repo();
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-origin-"));
  try {
    git(origin, "init", "-q", "--bare");
    git(dir, "remote", "add", "origin", origin);
    const file = path.join(os.tmpdir(), `kan13f-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    assert.equal(
      runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit", "--no-push"]).status,
      0
    );
    assert.equal(git(origin, "branch", "--list"), "");
    git(dir, "checkout", "-q", "main");
    git(dir, "branch", "-q", "-D", "feature/KAN-13-register-vehicle-entry");
    fs.rmSync(path.join(dir, CHANGE_13), { recursive: true, force: true });
    git(dir, "remote", "set-url", "origin", path.join(origin, "missing"));
    const failed = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit"]);
    fs.rmSync(file);
    assert.equal(failed.status, 0, failed.stdout + failed.stderr);
    assert.match(failed.stdout, /not pushed/i);
    assert.ok(fs.existsSync(path.join(dir, CHANGE_13, "ticket.md")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

test("REQ-152 SCN-152a: two tickets on two branches never mint the same id", () => {
  const dir = repo(JIRA + "epics:\n  KAN-5: parking\n");
  try {
    git(dir, "checkout", "-q", "-b", "develop");
    git(dir, "checkout", "-q", "-b", "feature/KAN-14-vehicle-type-catalog");
    const other = path.join(dir, "docs", "specs", "changes", "kan-14-vehicle-type-catalog");
    fs.mkdirSync(path.join(other, "specs", "parking"), { recursive: true });
    fs.writeFileSync(
      path.join(other, "change.yaml"),
      "specgate_change_version: 1\nreq_range: [REQ-002, REQ-005]\n"
    );
    fs.writeFileSync(
      path.join(other, "specs", "parking", "spec.md"),
      "## ADDED Requirements\n\n### Requirement: REQ-005 — x\n\n#### Scenario: SCN-006 — y\n"
    );
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-14 draft");
    git(dir, "checkout", "-q", "develop");
    const file = path.join(os.tmpdir(), `kan13g-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "parking", "--no-push"]);
    fs.rmSync(file);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const yaml = fs.readFileSync(path.join(dir, CHANGE_13, "change.yaml"), "utf8");
    assert.match(yaml, /req_range: \[REQ-006, /);
    assert.match(
      fs.readFileSync(path.join(dir, CHANGE_13, "DRAFTING.md"), "utf8"),
      /Scenario ids:\*\* `SCN-007` …/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-153, REQ-154 ─────────────────────────────────────────────────────────

/** A forja-shaped monorepo: npm workspaces, a Spring API, a Next.js web app. */
function monorepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-mono-"));
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write(
    "package.json",
    JSON.stringify({
      name: "garage",
      private: true,
      workspaces: ["apps/web", "packages/*"],
      scripts: { test: "npm run test:api && npm run test:web" },
      devDependencies: { typescript: "5" },
    })
  );
  write(
    "apps/api/pom.xml",
    "<project><artifactId>garage-api</artifactId><properties><java.version>21</java.version></properties><parent><artifactId>spring-boot-starter-parent</artifactId></parent><dependencies><dependency><artifactId>testcontainers</artifactId></dependency></dependencies></project>"
  );
  write(
    "apps/web/package.json",
    JSON.stringify({
      name: "web",
      dependencies: { next: "16", react: "19" },
      devDependencies: { typescript: "5", vitest: "3" },
    })
  );
  return dir;
}

test("REQ-153 SCN-153a: a monorepo's stack is read from its apps", () => {
  const dir = monorepo();
  try {
    const run = spawnSync(
      process.execPath,
      [CLI, "adopt", "--no-capabilities", "--no-agents", "--project-dir", dir],
      {
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
      }
    );
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    const stack = /^Stack: (.*)$/m.exec(agents)![1];
    assert.match(stack, /Spring Boot[^+]*\(apps\/api\)/, stack);
    assert.match(stack, /next[^+]*\(apps\/web\)/, stack);
    assert.match(agents, /Testing: [^\n]*JUnit 5, Testcontainers/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-154 SCN-154a: the agent contract names the ticket path", () => {
  const dir = monorepo();
  try {
    spawnSync(
      process.execPath,
      [CLI, "adopt", "--no-capabilities", "--no-agents", "--project-dir", dir],
      { encoding: "utf8" }
    );
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    const section = agents.slice(agents.indexOf("## From a brief or a Jira ticket"));
    assert.ok(agents.includes("## From a brief or a Jira ticket"), agents);
    assert.match(section, /specgate propose --from-ticket/);
    assert.match(section, /ticket\.md/);
    assert.match(section, /commit message/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-155 ──────────────────────────────────────────────────────────────────

test("REQ-155 SCN-155a: updating Specgate updates the agent contract", () => {
  const dir = project(JIRA);
  try {
    const oldBlock = [
      "<!-- specgate:begin — generated by specgate; edit outside this block -->",
      "# AGENTS.md — garage",
      "",
      "existing project · architecture: hexagonal · domain: general",
      "Stack: Java 21, Spring Boot (apps/api) · API: REST with DTO boundaries · Testing: JUnit 5",
      "",
      "## From a plan or brief",
      "",
      "Old text.",
      "",
      "## Project rules",
      "",
      "- The test command is `npm test`.",
      "<!-- specgate:end -->",
      "",
      "Ask Ana before touching billing.",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "AGENTS.md"), oldBlock);
    const dry = spawnSync(process.execPath, [CLI, "update", "--dry-run", "--project-dir", dir], {
      encoding: "utf8",
    });
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.equal(
      fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"),
      oldBlock,
      "--dry-run writes nothing"
    );
    const run = spawnSync(process.execPath, [CLI, "update", "--project-dir", dir], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(agents, /## From a brief or a Jira ticket/);
    assert.doesNotMatch(agents, /## From a plan or brief/);
    assert.match(agents, /Stack: Java 21, Spring Boot \(apps\/api\)/);
    assert.match(agents, /architecture: hexagonal/);
    assert.match(agents, /- The test command is `npm test`\./);
    assert.match(agents, /<!-- specgate:end -->\n\nAsk Ana before touching billing\.\n$/);
    assert.match(run.stdout, /AGENTS\.md/);
    const again = spawnSync(process.execPath, [CLI, "update", "--project-dir", dir], {
      encoding: "utf8",
    });
    assert.equal(
      fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"),
      agents,
      "a second run changes nothing"
    );
    assert.equal(again.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-156 ──────────────────────────────────────────────────────────────────

test("REQ-156 SCN-156a: the harness's commits name the ticket", () => {
  const { ticketKeyOf, harnessCommitMessage } = require("../../scripts/lib/ticket-keys");
  const dir = project(JIRA);
  try {
    const change = path.join(dir, "docs", "specs", "changes", "kan-14-vehicle-type-catalog");
    fs.mkdirSync(path.join(change, "specs", "parking"), { recursive: true });
    fs.writeFileSync(
      path.join(change, "change.yaml"),
      "specgate_change_version: 1\nticket: KAN-14\n"
    );
    fs.writeFileSync(
      path.join(change, "specs", "parking", "spec.md"),
      "## ADDED Requirements\n\n### Requirement: REQ-002 — Default vehicle types\n"
    );
    assert.equal(ticketKeyOf(dir, "REQ-002"), "KAN-14");
    assert.equal(ticketKeyOf(dir, "REQ-020"), null);
    assert.match(
      harnessCommitMessage(dir, "REQ-002", 3, 3),
      /^KAN-14 REQ-002: implement via specgate harness\n\nAttempt 3\/3\./
    );
    assert.match(
      harnessCommitMessage(dir, "REQ-020", 1, 3),
      /^feat\(REQ-020\): implement via specgate harness/
    );
    fs.writeFileSync(
      path.join(change, "change.yaml"),
      "specgate_change_version: 1\nticket: KAN-1(\n"
    );
    assert.equal(ticketKeyOf(dir, "REQ-002"), null, "a key that is not a Jira key is not used");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-157, REQ-158 ─────────────────────────────────────────────────────────

test("REQ-157 SCN-157a: a change reserves its scenario ids", () => {
  const dir = project(JIRA);
  try {
    const kan14 = path.join(dir, "docs", "specs", "changes", "kan-14-vehicle-type-catalog");
    fs.mkdirSync(path.join(kan14, "specs", "parking"), { recursive: true });
    fs.writeFileSync(
      path.join(kan14, "change.yaml"),
      "specgate_change_version: 1\nreq_range: [REQ-002, REQ-007]\nscn_range: [SCN-002, SCN-019]\n"
    );
    fs.writeFileSync(path.join(kan14, "specs", "parking", "spec.md"), "<!-- placeholder -->\n");
    const file = exported(dir, "KAN-13.json", KAN_13);
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "parking", "--no-branch"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const yaml = fs.readFileSync(path.join(dir, CHANGE_13, "change.yaml"), "utf8");
    const range = /^scn_range: \[(SCN-\d+), (SCN-\d+)\]$/m.exec(yaml);
    assert.ok(range, yaml);
    assert.equal(range![1], "SCN-020");
    const guide = fs.readFileSync(path.join(dir, CHANGE_13, "DRAFTING.md"), "utf8");
    assert.ok(
      guide.includes(range![1]) && guide.includes(range![2]),
      "DRAFTING.md names the range"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-158 SCN-158a: status points a Jira project to its tickets", () => {
  const dir = monorepo();
  try {
    spawnSync(
      process.execPath,
      [CLI, "adopt", "--no-capabilities", "--no-agents", "--project-dir", dir],
      { encoding: "utf8" }
    );
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), JIRA);
    const run = spawnSync(process.execPath, [CLI, "status", "--project-dir", dir], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.match(run.stdout, /specgate propose --from-ticket <KEY> --check/, run.stdout);
    assert.doesNotMatch(run.stdout, /specgate new "/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── REQ-159 ──────────────────────────────────────────────────────────────────

test("REQ-159 SCN-159a: the pull request carries the archived change", () => {
  const { dir, origin } = ticketRepo();
  try {
    const archive = path.join(
      dir,
      "docs",
      "specs",
      "changes",
      "archive",
      "2026-10-20-kan-13-register-vehicle-entry"
    );
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    fs.renameSync(path.join(dir, CHANGE_13), archive);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-13 archive");
    const run = runPr(dir, [
      { match: "/repos/acme/garage/pulls?", json: [] },
      {
        match: "/repos/acme/garage/pulls",
        method: "POST",
        json: { number: 8, html_url: "https://github.com/acme/garage/pull/8" },
      },
    ]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const post = sent(dir).find((s) => s.method === "POST")!;
    assert.equal(post.body.title, "KAN-13 Register vehicle entry");
    assert.match(String(post.body.body), /REQ-151/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(origin, { recursive: true, force: true });
  }
});

// ── REQ-148 (gitflow base), REQ-161 ──────────────────────────────────────────

test("REQ-148 SCN-148e: gitflow — the ticket's branch starts from develop, not the remote's main", () => {
  const upstream = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-upstream-"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-clone-"));
  try {
    // An upstream whose default branch is main, cloned: origin/HEAD → origin/main.
    git(upstream, "init", "-q", "-b", "main");
    fs.writeFileSync(path.join(upstream, "README.md"), "upstream\n");
    git(upstream, "add", "-A");
    git(upstream, "commit", "-qm", "upstream history");
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(spawnSync("git", ["clone", "-q", upstream, dir]).status, 0);
    git(dir, "checkout", "-q", "-b", "develop");
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "docs", "specs", "traceability.md"),
      "# Traceability Matrix\n\n| Requirement | Status |\n|---|---|\n"
    );
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), PR_CONFIG);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "the company's adoption, only on develop");
    const file = path.join(os.tmpdir(), `kan13h-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "entry-exit", "--no-push"]);
    fs.rmSync(file);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(
      git(dir, "rev-parse", "--abbrev-ref", "HEAD"),
      "feature/KAN-13-register-vehicle-entry"
    );
    assert.ok(
      fs.existsSync(path.join(dir, "alm.config.yaml")),
      "develop's files are on the ticket's branch"
    );
    assert.equal(git(dir, "merge-base", "--is-ancestor", "develop", "HEAD"), "");
    const { ticketKeyFindings } = require("../../scripts/lib/ticket-keys");
    // The opening is committed with the key (REQ-165); develop's commits are not the ticket's.
    assert.deepEqual(ticketKeyFindings(dir), [], "develop's own commits are not the ticket's");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(upstream, { recursive: true, force: true });
  }
});

test("REQ-148 SCN-148f: a local develop behind origin is not the base", () => {
  // Nobody updates their local develop. Measured from it, a colleague's commit
  // merged from origin/develop looked like this ticket's.
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-origin-"));
  const colleague = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-colleague-"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-clone-"));
  try {
    git(origin, "init", "-q", "--bare", "-b", "develop");
    git(dir, "init", "-q", "-b", "develop");
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), PR_CONFIG);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "adoption");
    git(dir, "remote", "add", "origin", origin);
    git(dir, "push", "-q", "-u", "origin", "develop");

    fs.rmSync(colleague, { recursive: true, force: true });
    assert.equal(spawnSync("git", ["clone", "-q", origin, colleague]).status, 0);
    fs.writeFileSync(path.join(colleague, "README.md"), "pull requests target develop\n");
    git(colleague, "add", "-A");
    git(colleague, "commit", "-qm", "chore: pull requests target develop");
    git(colleague, "push", "-q", "origin", "develop");

    git(dir, "checkout", "-q", "-b", "feature/KAN-13-register-vehicle-entry");
    fs.writeFileSync(path.join(dir, "notes.md"), "entry\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "KAN-13 docs(spec): open the change from the ticket");
    git(dir, "fetch", "-q", "origin");
    git(dir, "merge", "-q", "--no-edit", "origin/develop");

    const { ticketKeyFindings } = require("../../scripts/lib/ticket-keys");
    const messages = ticketKeyFindings(dir).map((d: { message: string }) => d.message);
    assert.ok(
      !messages.some((m: string) => m.includes("pull requests target develop")),
      messages.join("\n")
    );
  } finally {
    for (const d of [dir, colleague, origin]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("REQ-161 SCN-161a: a German summary makes a readable change id", () => {
  const dir = project(JIRA);
  try {
    const file = exported(dir, "PET-101.json", {
      key: "PET-101",
      fields: {
        summary: "Suche ignoriert Groß-/Kleinschreibung nicht",
        issuetype: { name: "Bug" },
        description:
          'Akzeptanzkriterien\n- Angenommen "Davis", wenn ich "davis" suche, dann wird "Davis" angezeigt.',
      },
    });
    const run = runPropose(dir, ["--from-ticket", file, "--capability", "owners", "--no-branch"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.ok(
      fs.existsSync(
        path.join(
          dir,
          "docs",
          "specs",
          "changes",
          "pet-101-suche-ignoriert-gross-kleinschreibung-nicht"
        )
      ),
      fs.readdirSync(path.join(dir, "docs", "specs", "changes")).join(", ")
    );
    const { changeIdFor } = require("../../scripts/cli/commands/change/TicketCommand");
    assert.equal(
      changeIdFor({ key: "PET-7", summary: "Größe für Ärzte ändern, café" }),
      "pet-7-groesse-fuer-aerzte-aendern-cafe"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-148: with --agent too, the branch and a failed push are said", () => {
  const dir = repo();
  try {
    git(dir, "remote", "add", "origin", path.join(os.tmpdir(), `no-such-origin-${process.pid}`));
    const file = path.join(os.tmpdir(), `kan13i-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(KAN_13));
    const run = runPropose(dir, [
      "--from-ticket",
      file,
      "--capability",
      "entry-exit",
      "--agent",
      "true",
    ]);
    fs.rmSync(file);
    assert.match(run.stdout, /On branch feature\/KAN-13-register-vehicle-entry/, run.stdout);
    assert.match(run.stdout, /not pushed/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-147: the agent is told everything it needs is in the guide", () => {
  const { ticketPrompt } = require("../../scripts/draft/ticket-guide");
  const prompt = ticketPrompt({ key: "KAN-13" }, "kan-13-x", "GUIDE");
  assert.match(prompt, /Everything you need is in this guide/);
  assert.match(prompt, /do not read Specgate's own code/i);
});

// ── REQ-162 ──────────────────────────────────────────────────────────────────

test("REQ-162 SCN-162a: OpenCode gets the loop's commands", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-opencode-"));
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.writeFileSync(path.join(dir, "opencode.json"), "{}\n");
    const run = spawnSync(
      process.execPath,
      [CLI, "agents", "init", "--tool", "opencode", "--project-dir", dir],
      {
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
      }
    );
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const draft = fs.readFileSync(
      path.join(dir, ".opencode", "commands", "specgate-draft.md"),
      "utf8"
    );
    assert.match(draft, /^---\ndescription: .+\n/);
    assert.match(draft, /^specgate propose --from-brief \$ARGUMENTS$/m);
    assert.match(draft, /^# \/specgate-draft$/m);
    assert.ok(fs.existsSync(path.join(dir, "AGENTS.md")));
    const help = spawnSync(process.execPath, [CLI, "agents", "init", "--help"], {
      encoding: "utf8",
    }).stdout;
    assert.match(help, /opencode/);
    const { detectAgents } = require("../../scripts/agents/detect");
    assert.ok(detectAgents(dir).includes("opencode"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
