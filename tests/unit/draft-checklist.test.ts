"use strict";

/** The draft checklist D1–D8 (ADR-0029, docs/specs/draft-from-brief.md §4). */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkDraft,
  statedValues,
  actorSurfaces,
} = require("../../packages/core/src/domain/DraftChecklist");

const BRIEF = `---
product: Golden State field app
actors:
  - { name: Worker, surfaces: [api, mobile] }
  - { name: Office, surfaces: [api] }
---

Workers clock in at rebar jobsites inside a geofence of 100 m. A punch is
confirmed within 2 seconds. Meal periods follow California Labor Code §512.
`;

const req = (id, trace, body, scenarios) =>
  `### Requirement: ${id} — ${id} title\n\n<!-- csda:trace ${trace} -->\n\n${body}\n\n` +
  scenarios
    .map(
      ([sid, steps]) =>
        `#### Scenario: ${sid} — ${sid}\n\n${steps.map((s) => `- ${s}`).join("\n")}\n`
    )
    .join("\n");

const delta = (...reqs) => [
  { path: "specs/attendance/spec.md", source: `## ADDED Requirements\n\n${reqs.join("\n")}` },
];

const codes = (r) => r.status.map((d) => d.code);

const GOOD = req(
  "REQ-101",
  "kind=functional actor=Worker",
  "The system SHALL accept a clock in inside the geofence.",
  [
    [
      "SCN-101",
      [
        "GIVEN a worker 40 m from the center of a 100 m geofence",
        "WHEN they POST /api/attendance/punches",
        "THEN the response is 201",
      ],
    ],
    [
      "SCN-102",
      [
        "GIVEN a signed-in worker",
        'WHEN they tap "Marcar entrada"',
        "THEN they see the punch confirmed",
      ],
    ],
  ]
);
const ASSUMED =
  '| A1 | A worker 40 m from the center is inside | SCN-101 | the brief gives the radius, not a distance |\n| A2 | 201 is the success status | SCN-101 | HTTP convention |\n| A3 | The button reads "Marcar entrada" | SCN-102 | the crews are Spanish-speaking |';

test("a complete draft passes every rule", () => {
  const r = checkDraft({ deltas: delta(GOOD), brief: BRIEF, assumptions: ASSUMED });
  assert.deepEqual(codes(r), []);
  assert.equal(r.requirements, 1);
  assert.equal(r.scenarios, 2);
  assert.deepEqual(r.skipped, []);
});

test("D1 and D2: no scenario, no kind", () => {
  const r = checkDraft({
    deltas: delta("### Requirement: REQ-102 — Bare\n\nThe system SHALL do it.\n"),
    brief: BRIEF,
  });
  assert.ok(codes(r).includes("D1_no_scenario"));
  assert.ok(codes(r).includes("D2_no_kind"));
});

test("D3: an actor's surface with no scenario exercising it", () => {
  const apiOnly = req("REQ-103", "kind=functional actor=Worker", "Text.", [
    [
      "SCN-103",
      ["GIVEN a worker", "WHEN they POST /api/attendance/punches", "THEN the response is 201"],
    ],
  ]);
  const r = checkDraft({
    deltas: delta(apiOnly),
    brief: BRIEF,
    assumptions: "| A | 201 | SCN-103 |",
  });
  const d3 = r.status.filter((d) => d.code === "D3_surface_missing");
  assert.equal(d3.length, 1, "mobile is missing, api is there");
  assert.match(d3[0].message, /mobile/);
});

test("D4: a non-functional requirement with no measure", () => {
  const vague = req("REQ-104", "kind=non-functional", "Punches SHALL be fast.", [
    ["SCN-104", ["GIVEN a worker", "WHEN they clock in", "THEN it is quick"]],
  ]);
  const measured = req(
    "REQ-105",
    "kind=non-functional",
    "A punch SHALL be confirmed within 2 seconds.",
    [["SCN-105", ["GIVEN a worker", "WHEN they clock in", "THEN it is confirmed within 2 seconds"]]]
  );
  assert.ok(
    codes(checkDraft({ deltas: delta(vague), brief: BRIEF })).includes("D4_unmeasured_nfr")
  );
  assert.ok(
    !codes(checkDraft({ deltas: delta(measured), brief: BRIEF })).includes("D4_unmeasured_nfr")
  );
});

test("D5: a business rule citing the law needs its source", () => {
  const scn = [["SCN-106", ["GIVEN a worker", "WHEN they work", "THEN a meal period is offered"]]];
  const bare = req(
    "REQ-106",
    "kind=business-rule",
    "Meal periods SHALL follow California Labor Code §512.",
    scn
  );
  const sourced = req(
    "REQ-106",
    "kind=business-rule",
    "Meal periods SHALL follow California Labor Code §512.\nSource: https://leginfo.legislature.ca.gov/",
    scn
  );
  assert.ok(codes(checkDraft({ deltas: delta(bare), brief: BRIEF })).includes("D5_unsourced_rule"));
  assert.ok(
    !codes(checkDraft({ deltas: delta(sourced), brief: BRIEF })).includes("D5_unsourced_rule")
  );
});

test("D6: an invented value is caught; one from the brief or listed for that scenario is not", () => {
  const r = checkDraft({ deltas: delta(GOOD), brief: BRIEF, assumptions: "" });
  const d6 = r.status.filter((d) => d.code === "D6_unlisted_value").map((d) => d.message);
  assert.ok(
    d6.some((m) => m.includes('"40"')),
    "40 m is not in the brief"
  );
  assert.ok(!d6.some((m) => m.includes('"100"')), "100 m is in the brief");
  // Listed, but for another scenario: still caught.
  const wrongRow = checkDraft({
    deltas: delta(GOOD),
    brief: BRIEF,
    assumptions: "| A1 | 40 m | SCN-999 |",
  });
  assert.ok(
    wrongRow.status.some((d) => d.code === "D6_unlisted_value" && d.message.includes('"40"'))
  );
});

test("D6 reads numbers and quoted strings, not ids or code", () => {
  assert.deepEqual(
    statedValues('WHEN REQ-101 sends "Marcar entrada" with `CODE_42` at 07:42 and 5,707 lb'),
    ["Marcar entrada", "07", "42", "5,707"]
  );
});

test("D7: a question must block requirements, and they must wait", () => {
  const blocked = req("REQ-107", "kind=functional", "Text.", [
    ["SCN-107", ["GIVEN a", "WHEN b", "THEN c"]],
  ]);
  const q =
    "| # | Question | Blocks |\n|---|---|---|\n| Q1 | Which threshold? | REQ-107 |\n| Q2 | Anything? | |";
  const r = checkDraft({ deltas: delta(blocked), brief: BRIEF, questions: q });
  const d7 = r.status.filter((d) => d.code === "D7_floating_question");
  assert.equal(d7.length, 2, "Q2 blocks nothing; REQ-107 is not Needs Clarification");
  const waiting = req("REQ-107", 'kind=functional status="Needs Clarification"', "Text.", [
    ["SCN-107", ["GIVEN a", "WHEN b", "THEN c"]],
  ]);
  const ok = checkDraft({
    deltas: delta(waiting),
    brief: BRIEF,
    questions: q.split("\n").slice(0, 3).join("\n"),
  });
  assert.ok(!codes(ok).includes("D7_floating_question"));
});

test("D8: a draft too large to review", () => {
  const many = Array.from({ length: 4 }, (_, i) =>
    req(`REQ-2${i}0`, "kind=functional", "T.", [[`SCN-2${i}0`, ["GIVEN a", "WHEN b", "THEN c"]]])
  );
  assert.ok(
    codes(checkDraft({ deltas: delta(...many), brief: BRIEF, maxRequirements: 3 })).includes(
      "D8_too_large"
    )
  );
});

test("a rule that cannot run says so instead of passing", () => {
  const r = checkDraft({ deltas: delta(GOOD) });
  assert.deepEqual(r.skipped.map((s) => s.rule).sort(), ["D3", "D6"]);
  assert.equal(actorSurfaces("no front matter").size, 0);
});

test("draft --check runs the checklist on a change, with the brief from change.yaml", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { spawnSync } = require("node:child_process");
  const ROOT_DIR = path.resolve(
    __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-draft-"));
  const cli = (...a) =>
    spawnSync(process.execPath, [path.join(ROOT_DIR, "bin", "specgate.js"), ...a], {
      cwd: dir,
      encoding: "utf8",
    });
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
    fs.writeFileSync(path.join(dir, "brief.md"), BRIEF);
    const change = path.join(dir, "docs", "specs", "changes", "draft-attendance");
    fs.mkdirSync(path.join(change, "specs", "attendance"), { recursive: true });
    fs.writeFileSync(path.join(change, "change.yaml"), "schema: spec-driven\nbrief: brief.md\n");
    fs.writeFileSync(path.join(change, "specs", "attendance", "spec.md"), delta(GOOD)[0].source);

    const red = cli("draft", "--check", "draft-attendance", "--json");
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.ok(JSON.parse(red.stdout).status.some((d) => d.code === "D6_unlisted_value"));

    fs.writeFileSync(path.join(change, "assumptions.md"), ASSUMED);
    const green = cli("draft", "--check", "draft-attendance");
    assert.equal(green.status, 0, green.stdout + green.stderr);
    assert.match(green.stdout, /Ready to review/);

    assert.equal(cli("draft", "--check", "nope", "--json").status, 1);
    assert.equal(cli("draft").status, 2, "--check is required");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
