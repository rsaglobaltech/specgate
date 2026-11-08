/**
 * The new studio (change studio-redesign): one app built from typed source,
 * served by Specgate itself, carrying no runtime dependency.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { studioShell, studioAsset } from "../../scripts/lib/studio-shell";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const DIST = path.join(ROOT_DIR, "dist", "studio");

test("REQ-432 SCN-432a: the package ships the studio's script and styles, and depends on nothing", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {}, "installing Specgate adds no runtime dependency");
  assert.ok(pkg.files.includes("dist/studio/"), "the built studio is packed");
  for (const f of ["app.js", "app.css"]) {
    assert.ok(fs.existsSync(path.join(DIST, f)), `dist/studio/${f} is built`);
  }
  // Nothing from another host: not the shell, not the styles, not a font.
  const shell = studioShell("shop", "tok123");
  assert.doesNotMatch(shell, /https?:\/\//);
  assert.match(shell, /<meta name="specgate-token" content="tok123"/);
  assert.match(shell, /src="\/studio\/app\.js"/);
  assert.match(shell, /href="\/studio\/app\.css"/);
  assert.doesNotMatch(fs.readFileSync(path.join(DIST, "app.css"), "utf8"), /url\(\s*["']?https?:/);
  assert.doesNotMatch(fs.readFileSync(path.join(DIST, "app.js"), "utf8"), /fetch\(\s*["'`]https?:/);
});

test("REQ-432: the studio serves its own files, and nothing outside them", () => {
  const js = studioAsset("/studio/app.js");
  assert.ok(js && js.type.startsWith("text/javascript"), JSON.stringify(js && js.type));
  assert.equal(studioAsset("/studio/app.css")?.type.split(";")[0], "text/css");
  for (const bad of [
    "/studio/../package.json",
    "/studio/%2e%2e/package.json",
    "/studio/..\\package.json",
    "/studio/",
  ]) {
    assert.equal(studioAsset(bad), null, bad);
  }
});

// ── REQ-204: one app, a sidebar of sections, an address for each ──

const studio = require(path.join(ROOT_DIR, "dist", "studio-test", "studio.cjs"));

test("REQ-204 SCN-204a: the app lists its sections, each at its own address", () => {
  assert.deepEqual(studio.SECTIONS, [
    "home",
    "brief",
    "changes",
    "questions",
    "build",
    "live",
    "report",
    "settings",
  ]);
  // Reloading or following a link opens the same section.
  assert.equal(studio.sectionOf("#/questions"), "questions");
  assert.equal(studio.sectionOf("#/questions?q=Q1"), "questions");
  assert.equal(studio.sectionOf("#/nope"), "home");
  assert.equal(studio.sectionOf(""), "home");
  const html: string = studio.renderShell("questions", studio.DEFAULTS);
  for (const s of studio.SECTIONS) assert.match(html, new RegExp(`href="#/${s}"`), s);
  assert.match(html, /href="#\/questions" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  for (const word of [
    "Inicio",
    "Brief",
    "Cambios",
    "Preguntas",
    "Construir",
    "En vivo",
    "Informe",
    "Ajustes",
  ]) {
    assert.match(html, new RegExp(word), word);
  }
  assert.match(studio.renderShell("home", { ...studio.DEFAULTS, lang: "en" }), /Changes/);
});

test("REQ-204: Spanish and English say every word; the viewer's choices are remembered, and a refusing storage is no error", () => {
  assert.deepEqual(Object.keys(studio.TEXTS.en).sort(), Object.keys(studio.TEXTS.es).sort());
  const kept = new Map<string, string>();
  const storage = {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  };
  assert.deepEqual(studio.readPrefs(storage), { mode: "simple", lang: "es", theme: "system" });
  studio.writePrefs(storage, { mode: "advanced", lang: "en", theme: "dark" });
  assert.deepEqual(studio.readPrefs(storage), { mode: "advanced", lang: "en", theme: "dark" });
  kept.set("sg-studio-prefs", "{not json");
  assert.deepEqual(studio.readPrefs(storage), studio.DEFAULTS);
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(studio.readPrefs(refusing), studio.DEFAULTS);
  assert.doesNotThrow(() => studio.writePrefs(refusing, studio.DEFAULTS));
});

// ── REQ-212: Home shows the route, and its next step opens the section that does it ──

const step = (key: string, state: string, counts: Record<string, number> = {}) => ({
  key,
  state,
  counts,
});

test("REQ-212 SCN-212a: a project with a brief and no draft — the next step opens Changes", () => {
  const route = {
    project: "shop",
    isProject: true,
    steps: [
      step("project", "done"),
      step("brief", "done", { modules: 3 }),
      step("drafts", "current", { done: 0, total: 3 }),
      step("questions", "open"),
      step("review", "open"),
      step("build", "locked"),
      step("report", "locked"),
    ],
    next: "drafts",
  };
  const html: string = studio.renderHome("es", route, {
    built: 0,
    total: 0,
    questions: 0,
    drafts: 0,
    ready: 0,
    modules: [{ name: "orders", done: 0, total: 3, waiting: 0, draft: true }],
  });
  assert.match(html, /\[ SIGUIENTE PASO \]/);
  assert.match(html, /Redacta los módulos del brief/);
  assert.match(html, /class="btn-primary" href="#\/changes"/);
  for (const [key, state] of [
    ["project", "done"],
    ["drafts", "current"],
    ["build", "locked"],
    ["report", "locked"],
  ]) {
    assert.match(html, new RegExp(`class="step step-${state}" data-state="${state}"`), key);
  }
  // A locked step is no link; an open one is.
  assert.doesNotMatch(html, /<a class="step-name" href="#\/build">/);
  assert.match(html, /<a class="step-name" href="#\/questions">/);
  assert.match(html, /aria-valuenow="0"/);
});

test("REQ-212 SCN-212b: a folder that is not a project — the next step is the project, in Settings", () => {
  const route = {
    project: "empty",
    isProject: false,
    steps: [
      step("project", "current"),
      ...["brief", "drafts", "questions", "review", "build", "report"].map((k) =>
        step(k, "locked")
      ),
    ],
    next: "project",
  };
  const html: string = studio.renderHome("en", route, null);
  assert.match(html, /Create the project/);
  assert.match(html, /class="btn-primary" href="#\/settings"/);
  assert.equal((html.match(/data-state="locked"/g) || []).length, 6);
});

test("REQ-210 SCN-210a: the new Questions — each open question to answer, one row per answer to confirm", () => {
  const html: string = studio.renderQuestions("es", {
    open: [
      {
        id: "Q2",
        change: "draft-orders",
        text: "¿Se puede cancelar un pedido ya enviado?",
        blocks: ["REQ-012"],
        options: ["No", "Sí, con coste"],
        from: "draft",
      },
    ],
    toReview: [{ change: "project", assumption: "A1", question: "Q1", text: "¿Moneda?" }],
  });
  assert.match(html, /¿Se puede cancelar un pedido ya enviado\?/);
  assert.match(html, /Bloquea REQ-012/);
  assert.match(html, /del borrador orders/);
  // Options are chips that fill the answer; the answer has a label.
  assert.equal((html.match(/class="chip-btn"/g) || []).length, 2);
  assert.match(html, /<label for="answer-draft-orders-Q2"/);
  assert.match(html, /Guardar respuesta →/);
  // Saving needs an answer: an empty one cannot be sent.
  assert.match(html, /<button type="button" class="btn-primary" disabled/);
  assert.equal((html.match(/class="confirm-row"/g) || []).length, 1);
  assert.match(html, /Ya está en la spec/);
});

test("REQ-210 SCN-210a: nothing open — Questions says so instead of an empty page", () => {
  const html: string = studio.renderQuestions("en", { open: [], toReview: [] });
  assert.match(html, /No question is open\./);
});

const mod = (key: string, stage: string, extra: Record<string, unknown> = {}) => ({
  key,
  stage,
  requirements: 2,
  scenarios: 2,
  questions: 0,
  findings: [],
  progress: null,
  ...extra,
});
const draft = (blockers: unknown[]) => ({
  change: "draft-orders",
  module: "orders",
  requirements: [
    {
      id: "REQ-002",
      title: "Free shipping",
      statement: "The system SHALL not charge shipping above the amount.",
      status: "Needs Clarification",
      scenarios: [
        { id: "SCN-002", title: "Above", steps: ["GIVEN a cart above it", "THEN shipping is 0"] },
      ],
    },
  ],
  blockers,
  notes: [],
  questions: [{ id: "Q1", text: "From what amount?", blocks: ["REQ-002"] }],
});

test("REQ-206 SCN-206c: the new Changes — every blocker with its action, approval said why it waits", () => {
  const html: string = studio.renderChanges(
    "es",
    {
      brief: true,
      modules: [mod("orders", "review", { questions: 1 }), mod("users", "todo")],
      job: null,
      step: "",
    },
    [
      draft([
        {
          code: "approve_question_open",
          message: "Q1 is open",
          action: { kind: "answer", question: "Q1" },
        },
        { code: "D13", message: "A1 to review", action: { kind: "confirm", question: "Q3" } },
        {
          code: "D2",
          message: "REQ-004 has no scenario",
          action: { kind: "open", requirement: "REQ-004" },
        },
      ]),
    ]
  );
  assert.match(html, /<a class="btn-ghost" href="#\/questions">Responder Q1<\/a>/);
  assert.match(html, /Ya está en la spec/);
  assert.match(html, /REQ-004 · docs\/specs\/changes\/draft-orders/);
  assert.match(html, /disabled[^>]*>Aprobar el borrador/);
  assert.match(html, /Faltan 3 cosas\./);
  assert.match(html, /<b class="kw">Dado<\/b> a cart above it/);
  assert.match(html, /Espera Q1/);
  assert.match(html, /aria-current="true"[^>]*><span class="name">orders/);
});

test("REQ-206 SCN-206a: the new Changes — a draft with nothing missing can be approved", () => {
  const html: string = studio.renderChanges(
    "en",
    { brief: true, modules: [mod("orders", "review")], job: null, step: "" },
    [draft([])]
  );
  assert.match(html, /Nothing stops it/);
  assert.doesNotMatch(html, /disabled[^>]*>Approve the draft/);
  assert.match(html, />Approve the draft</);
});

test("REQ-216 SCN-216b: the new Changes — while one module is drafted, no other starts", () => {
  const html: string = studio.renderChanges(
    "en",
    {
      brief: true,
      modules: [
        mod("orders", "drafting", {
          progress: {
            seconds: 90,
            requirements: 2,
            scenarios: 0,
            notes: false,
            lastStep: "writing REQ-002",
          },
        }),
        mod("users", "todo"),
      ],
      job: { kind: "draft", module: "orders" },
      step: "",
    },
    []
  );
  assert.match(html, /Drafting · 2 min/);
  assert.match(html, /writing REQ-002/);
  assert.match(html, />Stop</);
  assert.match(html, /disabled[^>]*>Draft the next one/);
});

test("REQ-216 SCN-216a: the new Changes — no brief yet sends the reader to Brief", () => {
  const html: string = studio.renderChanges(
    "en",
    { brief: false, modules: [], job: null, step: "" },
    []
  );
  assert.match(html, /No brief yet/);
  assert.match(html, /href="#\/brief"/);
});

const buildData = (extra: Record<string, unknown> = {}) => ({
  ready: [
    { id: "REQ-001", title: "Place an order", module: "orders" },
    { id: "REQ-002", title: "Free shipping", module: "orders" },
  ],
  agent: true,
  running: null,
  estimate: { minutes: 6, costPerRequirement: 0.4 },
  ...extra,
});

test("REQ-208 SCN-208a: the new Build — what is ready, each picked, the button says how many", () => {
  const html: string = studio.renderBuild("es", buildData());
  assert.match(html, /Listos para construir · 2/);
  assert.equal((html.match(/type="checkbox" checked/g) || []).length, 2);
  assert.match(html, />Construir 2 requisitos →</);
  assert.match(html, /6 min · \$0\.40 por requisito/);
  assert.doesNotMatch(html, /Elige el asistente/);
});

test("REQ-208 SCN-208c: the new Build — no agent, no build, and Claude Code found is offered first", () => {
  const html: string = studio.renderBuild(
    "en",
    buildData({ agent: false, installed: { claude: true, codex: false } })
  );
  assert.match(html, /Choose the assistant that codes/);
  assert.match(
    html,
    /class="choice on"><input type="radio" name="agent-kind" checked[^>]*\/><span class="name">Claude Code<\/span><span class="chip ok-chip">found/
  );
  assert.match(html, /disabled[^>]*>Build 2 requirements →/);
  assert.match(html, /Choose an assistant above to build\./);
});

test("REQ-431 SCN-431a: the new Build — nothing installed, the own command is picked", () => {
  const html: string = studio.renderBuild(
    "en",
    buildData({ agent: false, installed: { claude: false, codex: false } })
  );
  assert.match(
    html,
    /class="choice on"><input type="radio" name="agent-kind" checked[^>]*\/><span class="name">My own command/
  );
  assert.match(html, /placeholder="my-agent run \{prompt_file\}"/);
});

test("REQ-209 SCN-209a: the new Build — what runs, its stage, a way to watch it and to stop it", () => {
  const now = 1_800_000_000;
  const html: string = studio.renderBuild(
    "en",
    buildData({ running: { pid: 7, reqs: ["REQ-001"] } }),
    [],
    [
      {
        req: "REQ-001",
        title: "Place an order",
        state: "running",
        started: now - 300,
        updated: now,
        elapsed: 300,
        steps: [{ type: "gate-start", stage: "tests" }],
      },
    ],
    now
  );
  assert.match(html, /Running/);
  assert.match(html, /5 min/);
  assert.match(html, /<li class="now" aria-current="step"><i><\/i>Test<\/li>/);
  assert.match(html, /href="#\/live"/);
  assert.match(html, />Stop</);
  assert.match(html, /disabled[^>]*>Build 2 requirements →/);
});

const briefData = (extra: Record<string, unknown> = {}) => ({
  exists: true,
  product: "Tienda",
  actors: [{ name: "Customer", surfaces: ["api"] }],
  modules: [
    {
      key: "orders",
      name: "Orders",
      prose: "",
      rules: ["An order has items"],
      examples: [],
      questions: [],
    },
    { key: "users", name: "Users", prose: "", rules: [], examples: [], questions: [] },
  ],
  markdown: "---\nproduct: Tienda\n---\n",
  findings: [],
  ...extra,
});

test("REQ-214 SCN-214a: the new Brief — the form: product, who uses it, each module's cards", () => {
  const html: string = studio.renderBrief("es", briefData());
  assert.match(html, /<label for="bf-product" class="label">El producto, en una frase<\/label>/);
  assert.match(html, /value="Tienda"/);
  assert.match(html, /value="Customer" aria-label="Tipo de usuario 1"/);
  assert.match(html, /type="checkbox" checked[^>]*\/> API/);
  assert.match(html, /role="tab" class="chip-btn" aria-selected="true"[^>]*>Orders/);
  assert.match(html, /value="An order has items" aria-label="Reglas 1"/);
  assert.match(html, /\+ Regla/);
  assert.match(html, /Todo en orden/);
  assert.match(html, /<a class="btn-primary" href="#\/changes">Siguiente: redactar los módulos →/);
  // The markdown tab is the advanced mode's.
  assert.doesNotMatch(html, />Markdown</);
  assert.match(studio.renderBrief("es", briefData(), { advanced: true }), />Markdown</);
});

test("REQ-214 SCN-214b: the new Brief — a finding is shown, an error keeps the drafts waiting", () => {
  const html: string = studio.renderBrief(
    "en",
    briefData({
      findings: [
        { severity: "warning", code: "B5", message: "Module users has no example." },
        { severity: "error", code: "B1", message: "No product." },
        { severity: "info", code: "B3", message: "an info only" },
      ],
    })
  );
  assert.match(html, /Module users has no example\./);
  assert.match(html, /No product\./);
  assert.doesNotMatch(html, /an info only/);
  assert.match(html, />Users · !</);
  assert.match(html, /aria-disabled="true">Next: draft the modules →/);
  assert.match(html, /Fix what is marked in red first\./);
});

test("REQ-215 SCN-215a: the new Brief — no brief yet: paste it for the assistant, or start from scratch", () => {
  const empty = briefData({ exists: false, product: "", actors: [], modules: [] });
  const html: string = studio.renderBrief("en", empty);
  assert.match(html, /Have the client's text, an email or notes\?/);
  assert.match(html, /Let the assistant structure it/);
  assert.match(html, /Start from scratch/);
  assert.doesNotMatch(html, /Replace the current brief/);
  // Without an assistant, the paste says where to set one up.
  assert.match(
    studio.renderBrief("en", empty, { profile: "" }),
    /Needs an assistant: <a href="#\/build">/
  );
});

test("REQ-215 SCN-215b: the new Brief — an existing brief is replaced only when asked", () => {
  const html: string = studio.renderBrief("en", briefData());
  assert.match(html, /<input type="checkbox"\/> Replace the current brief/);
  const reading: string = studio.renderBrief("en", briefData(), { job: { kind: "brief" } });
  assert.match(reading, /The assistant is reading the text…/);
  assert.match(reading, />Stop</);
});

test("REQ-214 SCN-214a: a module's key comes from its name", () => {
  assert.equal(studio.keyOf("Pedidos y envíos"), "pedidos-y-envios");
  assert.equal(studio.keyOf("  "), "");
});
