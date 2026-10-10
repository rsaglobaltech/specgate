"use strict";

/** The draft checklist D1–D8 (ADR-0029, docs/specs/draft-from-brief.md §4). */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkDraft,
  requirementTitles,
  statedValues,
  actorSurfaces,
  rowNamesId,
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
        `#### Scenario: ${sid} — the behaviour ${sid} pins\n\n${steps.map((s) => `- ${s}`).join("\n")}\n`
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

test("D6: an assumption row names its ids one by one or as a range (#74)", () => {
  // FinCore wrote `REQ-004..REQ-010` and D6 reported 25 values as unlisted.
  for (const row of [
    "| A1 | 40 m | REQ-100..REQ-110 |",
    "| A1 | 40 m | REQ-100…REQ-110 |",
    "| A1 | 40 m | REQ-100–REQ-110 |",
    "| A1 | 40 m | REQ-100 a REQ-110 |",
    "| A1 | 40 m | SCN-100..105 |",
  ]) {
    const r = checkDraft({ deltas: delta(GOOD), brief: BRIEF, assumptions: row });
    assert.ok(
      !r.status.some((d) => d.code === "D6_unlisted_value" && d.message.includes('"40"')),
      row
    );
  }
  assert.equal(rowNamesId("| A1 | REQ-004..REQ-010 |", "REQ-007"), true);
  assert.equal(rowNamesId("| A1 | REQ-004..REQ-010 |", "REQ-011"), false);
  assert.equal(rowNamesId("| A1 | REQ-004..REQ-010 |", "SCN-007"), false);
  assert.equal(rowNamesId("| A1 | REQ-004, REQ-009 |", "REQ-009"), true);
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

test("D4 flags a promised quantity with no number, not a qualitative constraint", () => {
  const { unmeasured, specNotes } = require("../../packages/core/src/domain/DraftChecklist");
  assert.equal(unmeasured("Punches SHALL be fast."), true);
  assert.equal(unmeasured("A punch SHALL be confirmed within 2 seconds."), false);
  // The four Golden State NFRs it wrongly flagged at first: verifiable, no quantity.
  for (const text of [
    "A downloaded course is usable without network; progress syncs later.",
    "The app reads location only while a punch is being taken.",
    "Email content is not stored beyond the session unless the user saves the draft.",
    "All job-file actions work from the worker's own Android or iPhone, offline included.",
  ]) {
    assert.equal(unmeasured(text), false, text);
  }
  const notes = specNotes(
    [
      {
        path: "spec.md",
        source:
          "## REQ-011 — Fast punch\n\n<!-- csda:trace kind=non-functional -->\n\nPunches SHALL be fast.\n\n" +
          "## REQ-012 — Meal\n\n<!-- csda:trace kind=business-rule -->\n\nMeal periods follow Labor Code §512.\n\n" +
          "## REQ-013 — Offline\n\n<!-- csda:trace kind=non-functional -->\n\nLessons work offline.\n",
      },
    ],
    []
  );
  assert.deepEqual(
    notes.map((n) => [n.code, n.target, n.severity]),
    [
      ["D4_unmeasured_nfr", "REQ-011", "info"],
      ["D5_unsourced_rule", "REQ-012", "info"],
    ]
  );
});

// ── reservas_app pilot (2026-10-09) ──────────────────────────────────────────

test("#42: a page that adapts to the screen is not a promised response time", () => {
  const nfr = req(
    "REQ-147",
    "kind=non-functional",
    "La página de reserva es responsive y usable desde 360 px de ancho.",
    [["SCN-152", ["DADO una pantalla de 360 px", "CUANDO abre la página", "ENTONCES ve el botón"]]]
  );
  const r = checkDraft({ deltas: delta(nfr) });
  assert.ok(!codes(r).includes("D4_unmeasured_nfr"), codes(r).join(","));
});

test("#43: a value repeated in one scenario is one D6 finding", () => {
  const twice = req("REQ-122", "kind=functional", "Text.", [
    [
      "SCN-124",
      [
        'GIVEN "Curling Ironing" of 30 minutes',
        "WHEN a client GETs the services",
        'THEN the answer includes "Curling Ironing"',
      ],
    ],
  ]);
  const d6 = checkDraft({ deltas: delta(twice), brief: BRIEF }).status.filter(
    (d) => d.code === "D6_unlisted_value" && /Curling Ironing/.test(d.message)
  );
  assert.equal(d6.length, 1);
});

test("#45: an answered question no longer holds its requirement", () => {
  const built = req("REQ-146", "kind=functional", "Text.", [
    ["SCN-150", ["GIVEN a booking", "WHEN the client cancels it", "THEN the slot is free"]],
  ]);
  const table = "| # | Question | Blocks |\n|---|---|---|\n| Q1 | Can a client cancel? | REQ-146 |";
  const open = checkDraft({ deltas: delta(built), brief: BRIEF, questions: table });
  assert.ok(codes(open).includes("D7_floating_question"), "unanswered: REQ-146 must wait");

  const below = `${table}\n\nAnswer (Q1): yes, until the business's blocking window starts.\n`;
  assert.ok(
    !codes(checkDraft({ deltas: delta(built), brief: BRIEF, questions: below })).includes(
      "D7_floating_question"
    )
  );

  const column =
    "| # | Question | Blocks | Answer |\n|---|---|---|---|\n| Q1 | Can a client cancel? | REQ-146 | yes |";
  assert.ok(
    !codes(checkDraft({ deltas: delta(built), brief: BRIEF, questions: column })).includes(
      "D7_floating_question"
    )
  );
});

test("#49 / D9: a scenario the harness gate would refuse fails the draft, in either language", () => {
  const titled = (title, steps) =>
    `## ADDED Requirements\n\n### Requirement: REQ-113 — Sin puestos no hay reserva\n\n<!-- csda:trace kind=business-rule -->\n\nEl sistema SHALL cerrar la franja.\n\n#### Scenario: SCN-115 — ${title}\n\n${steps.map((s) => `- ${s}`).join("\n")}\n`;
  const es = [
    "DADO un calendario sin puestos",
    "CUANDO un cliente consulta los huecos",
    "ENTONCES no hay franjas",
    "Y no se puede reservar",
  ];
  const run = (src) =>
    checkDraft({ deltas: [{ path: "specs/c/spec.md", source: src }] }).status.filter(
      (d) => d.code === "D9_scenario_quality"
    );

  assert.deepEqual(
    run(titled("Franja cerrada", es)),
    [],
    "two words name a behaviour; Y inherits ENTONCES"
  );
  assert.equal(
    run(titled("Escenario 1", es)).length,
    1,
    "a placeholder title is refused before the harness sees it"
  );
  assert.ok(
    run(titled("Franja cerrada", ["DADO un calendario", "Y nada más"])).length > 0,
    "no CUANDO / ENTONCES"
  );
});

test("#48: titles come from spec sections, in spec.md and capability specs", () => {
  const titles = requirementTitles([
    { source: "## REQ-001 — Existing behaviour is preserved\n\nText." },
    {
      source:
        "## ADDED Requirements\n\n### Requirement: REQ-111 — Varios calendarios por comercio\n",
    },
  ]);
  assert.equal(titles.get("REQ-001"), "Existing behaviour is preserved");
  assert.equal(titles.get("REQ-111"), "Varios calendarios por comercio");
});

test("#51: a requirement that lives on one surface says so, and D3 asks for that one", () => {
  const menu = (trace) =>
    req("REQ-200", trace, "El sistema SHALL mostrar el menú.", [
      [
        "SCN-202",
        [
          "DADO un propietario",
          'CUANDO abre su panel y pulsa "Calendarios"',
          "ENTONCES ve la pantalla",
        ],
      ],
    ]);
  const brief = "---\nactors:\n  - { name: Propietario, surfaces: [api, web] }\n---\n";
  const d3 = (trace) =>
    checkDraft({ deltas: delta(menu(trace)), brief }).status.filter(
      (d) => d.code === "D3_surface_missing"
    );
  assert.equal(d3("kind=functional actor=Propietario").length, 1, "api still owed by default");
  assert.deepEqual(d3("kind=functional actor=Propietario surfaces=web"), []);
});

test("#52: a value already in the project's specification is not unlisted", () => {
  const second = req("REQ-200", "kind=functional", "Text.", [
    [
      "SCN-203",
      [
        'DADO un propietario en la pantalla "Configuración"',
        'CUANDO pulsa "Agenda"',
        "ENTONCES ve la agenda",
      ],
    ],
  ]);
  const d6 = (specText) =>
    checkDraft({ deltas: delta(second), brief: BRIEF, specText }).status.filter(
      (d) => d.code === "D6_unlisted_value"
    );
  assert.equal(d6(undefined).length, 2);
  assert.deepEqual(d6('Cuando abre "Configuración" … pulsa "Agenda"'), []);
});

test("#55 / D10: an id the project already uses is caught before archiving; MODIFIED keeps its own", () => {
  const used = new Map([
    ["REQ-206", "REQ-206"],
    ["SCN-212", "REQ-209"],
    ["REQ-145", "REQ-145"],
    ["SCN-148", "REQ-145"],
  ]);
  const added = req("REQ-212", "kind=business-rule", "Text.", [
    ["SCN-212", ["GIVEN a booking", "WHEN the task runs", "THEN a mail goes out"]],
  ]);
  const d10 = (deltas) =>
    checkDraft({ deltas, idsInUse: used }).status.filter((d) => d.code === "D10_id_in_use");
  assert.match(d10(delta(added))[0].message, /SCN-212 is already a scenario of REQ-209/);

  const modified = [
    {
      path: "specs/reservas/spec.md",
      source: `## MODIFIED Requirements\n\n${req("REQ-145", "kind=functional", "Text.", [
        ["SCN-148", ["GIVEN a day", "WHEN the owner opens the agenda", "THEN the bookings show"]],
      ])}`,
    },
  ];
  assert.deepEqual(d10(modified), [], "a modified requirement reuses its own ids");
});

test("#61: another actor's screen does not prove this actor's screen", () => {
  const brief =
    "---\nactors:\n  - { name: Propietario, surfaces: [api, web] }\n  - { name: Cliente, surfaces: [api, web] }\n---\n";
  const datos = (screenStep) =>
    req("REQ-220", "kind=functional actor=Propietario", "El sistema SHALL guardar los datos.", [
      [
        "SCN-250",
        [
          "DADO el propietario de Pelu1",
          "CUANDO hace PUT /api/comercios/pelu1",
          "ENTONCES la respuesta es 200",
        ],
      ],
      ["SCN-251", ["DADO Pelu1 con sus datos", screenStep, "ENTONCES ve la dirección"]],
    ]);
  const d3 = (step) =>
    checkDraft({ deltas: delta(datos(step)), brief }).status.filter(
      (d) => d.code === "D3_surface_missing"
    );
  assert.equal(
    d3("CUANDO un cliente abre la página de Pelu1").length,
    1,
    "the client's screen is not the owner's"
  );
  assert.deepEqual(d3("CUANDO el propietario abre Mi comercio y pulsa Guardar"), []);
  assert.deepEqual(
    d3("CUANDO abre Mi comercio y pulsa Guardar"),
    [],
    "a step that names nobody still counts"
  );
});

const BANK = `---
product: Banca
actors:
  - { name: Cliente, surfaces: [api] }
  - { name: Operador, surfaces: [api] }
---

Transferencias SEPA que un operador liquida.
`;

const SETTLE = req(
  "REQ-022",
  "kind=functional actor=Operador",
  "El sistema SHALL permitir que un operador liquide una transferencia pendiente.",
  [
    [
      "SCN-026",
      [
        'DADO una transferencia SEPA "pendiente"',
        'CUANDO el operador hace POST /api/transferencias/{id}/liquidacion con el resultado "aceptada"',
        'ENTONCES la respuesta es 200 con el estado "completada"',
      ],
    ],
  ]
);

const d12 = (files) => checkDraft(files).status.filter((d) => d.code === "D12_unreachable_id");

test("#76 / D12: an actor acts on an id no scenario lets them get", () => {
  const found = d12({ deltas: delta(SETTLE), brief: BANK });
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /SCN-026: Operador does POST \/api\/transferencias\/\{id\}\/liquidacion/
  );
  assert.match(found[0].message, /from \/api\/transferencias/);
  assert.match(found[0].fix, /GET \/api\/transferencias/);
});

test("#76 / D12: a list by the same actor, here or in the project, gives them the id", () => {
  const list = req(
    "REQ-029",
    "kind=functional actor=Operador",
    "El sistema SHALL mostrar al operador las transferencias pendientes.",
    [
      [
        "SCN-034",
        [
          "DADO dos transferencias pendientes",
          "CUANDO el operador hace GET /api/transferencias?estado=pendiente",
          "ENTONCES la respuesta es 200 con las dos",
        ],
      ],
    ]
  );
  assert.equal(d12({ deltas: delta(SETTLE, list), brief: BANK }).length, 0);
  // Delivered in an earlier change: the project's specification has it.
  assert.equal(
    d12({
      deltas: delta(SETTLE),
      brief: BANK,
      specs: [{ source: `## ADDED Requirements\n\n${list}` }],
    }).length,
    0
  );
});

test("#76 / D12: another actor's list does not count; the creator receives the id", () => {
  const clientList = req("REQ-030", "kind=functional actor=Cliente", "El sistema SHALL listar.", [
    [
      "SCN-035",
      ["DADO dos transferencias", "CUANDO el cliente hace GET /api/transferencias", "ENTONCES 200"],
    ],
  ]);
  assert.equal(d12({ deltas: delta(SETTLE, clientList), brief: BANK }).length, 1);

  const own = req("REQ-017", "kind=functional actor=Cliente", "El sistema SHALL transferir.", [
    [
      "SCN-019",
      [
        "DADO una cuenta con 500.00 EUR",
        "CUANDO el cliente hace POST /api/transferencias por 120.00 EUR",
        "ENTONCES la respuesta es 201",
      ],
    ],
    [
      "SCN-032",
      [
        "DADO una transferencia suya",
        "CUANDO el cliente hace GET /api/transferencias/{id}",
        "ENTONCES la respuesta es 200",
      ],
    ],
  ]);
  assert.equal(d12({ deltas: delta(own), brief: BANK }).length, 0);
});

test("#76 / D12: an assumption that says where the id comes from; no actor, no finding", () => {
  const teller = req(
    "REQ-004",
    "kind=functional actor=Operador",
    "El sistema SHALL permitir un ingreso.",
    [
      [
        "SCN-005",
        [
          'DADO la cuenta "ES0890000001250000000001" activa',
          "CUANDO el operador hace POST /api/cuentas/ES0890000001250000000001/ingresos con 500.00 EUR",
          "ENTONCES la respuesta es 201",
        ],
      ],
    ]
  );
  assert.equal(d12({ deltas: delta(teller), brief: BANK }).length, 1, "a concrete IBAN is an id");
  const assumptions =
    "| A1 | El operador recibe el IBAN de /api/cuentas del propio cliente en ventanilla | REQ-004 | x | a validar |";
  assert.equal(d12({ deltas: delta(teller), brief: BANK, assumptions }).length, 0);

  const nobody = req("REQ-090", "kind=business-rule", "El sistema SHALL calcular.", [
    ["SCN-090", ["DADO un dato", "CUANDO se hace POST /api/cosas/{id}/calculo", "ENTONCES 200"]],
  ]);
  assert.equal(d12({ deltas: delta(nobody), brief: BANK }).length, 0);
});

test("#76: apiCalls finds the collection before the first id; versions are not ids", () => {
  const { apiCalls } = require("../../packages/core/src/domain/DraftChecklist");
  assert.deepEqual(apiCalls("WHEN they POST /api/transferencias/{id}/liquidacion"), [
    {
      method: "POST",
      path: "/api/transferencias/{id}/liquidacion",
      collection: "/api/transferencias",
    },
  ]);
  assert.equal(apiCalls("GET /api/v1/cuentas?x=1")[0].collection, undefined);
  assert.equal(apiCalls("GET /api/v1/cuentas?x=1")[0].path, "/api/v1/cuentas");
  assert.equal(apiCalls("POST /api/clientes/C-004/kyc")[0].collection, "/api/clientes");
});
