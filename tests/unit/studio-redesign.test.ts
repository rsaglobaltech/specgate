/**
 * The new studio (change studio-redesign): one app built from typed source,
 * served by Specgate itself, carrying no runtime dependency.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
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
  assert.deepEqual(studio.readPrefs(storage), {
    mode: "simple",
    lang: "es",
    theme: "system",
    folded: false,
  });
  studio.writePrefs(storage, { mode: "advanced", lang: "en", theme: "dark", folded: true });
  assert.deepEqual(studio.readPrefs(storage), {
    mode: "advanced",
    lang: "en",
    theme: "dark",
    folded: true,
  });
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
  assert.match(html, /class="chip-btn" aria-pressed="true">Orders/);
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

const reportData = () => ({
  project: "shop",
  date: "2026-11-08",
  built: 2,
  total: 3,
  scenarios: 2,
  gate: { ok: true, findings: [] },
  cost: 1.25,
  minutes: 14,
  modules: [{ name: "orders", built: 2, total: 3, waiting: 1, scenarios: 2 }],
  delivered: [
    {
      id: "REQ-001",
      title: "Place an order",
      module: "orders",
      scenarios: [{ id: "SCN-001", title: "A customer places an order" }],
    },
    {
      id: "REQ-003",
      title: "Cancel an order",
      module: "orders",
      scenarios: [{ id: "SCN-003", title: "A customer cancels" }],
    },
  ],
  missing: [
    {
      id: "REQ-002",
      title: "Free shipping",
      module: "orders",
      why: "waiting",
      question: "From what amount?",
    },
  ],
  answered: 1,
  assumptions: 2,
  quality: { measured: 0, coverage: null, mutation: null },
});

test("REQ-217 SCN-217a: the new Report — 2 built of 3, both with their scenario, the one waiting with its question", () => {
  const html: string = studio.renderReport("en", reportData());
  assert.match(html, /<b>2 of 3<\/b>/);
  assert.match(html, /Proven with: A customer places an order/);
  assert.match(html, /Proven with: A customer cancels/);
  assert.match(html, /Orders · Free shipping — Waits for From what amount\?/);
  assert.match(html, /1 wait for an answer/);
  assert.match(html, /\$1\.25/);
  assert.match(html, /1 questions answered · 2 assumptions recorded\./);
  assert.match(html, /href="#\/questions"/);
});

test("REQ-217 SCN-217b: the new Report — the page to print and the file to download", () => {
  const html: string = studio.renderReport("es", reportData());
  assert.match(
    html,
    /<a class="btn-ghost" href="\/report" target="_blank" rel="noopener">Imprimir \/ PDF<\/a>/
  );
  assert.match(html, /<a class="btn-primary" href="\/report.html" download>Descargar informe<\/a>/);
  assert.match(html, /\[ 2026-11-08 \]/);
});

test("REQ-213 SCN-213a: the new Settings — an empty folder: five questions, the agent found already picked", () => {
  const html: string = studio.renderSettings("es", { isProject: false, empty: true });
  assert.match(html, /Empecemos un proyecto/);
  for (const q of [
    "1 · ¿Cómo se llama\\?",
    "2 · ¿Qué vas a construir\\?",
    "3 · ¿Con qué tecnología\\?",
    "4 · ¿Qué asistente programa\\?",
    "5 · ¿Qué nivel de calidad\\?",
  ]) {
    assert.match(html, new RegExp(q));
  }
  assert.match(
    html,
    /class="choice on"><input type="radio" name="np-agent" checked[^>]*\/><span class="name">Claude Code<\/span><span class="faint">· encontrado/
  );
  // A name is needed before it can be created.
  assert.match(html, /disabled[^>]*>Crear proyecto →/);
});

test("REQ-213 SCN-213b: the new Settings — a folder with files is adopted from a terminal, never overwritten", () => {
  const html: string = studio.renderSettings("en", { isProject: false, empty: false });
  assert.match(html, /This folder already holds files/);
  assert.match(html, /<code class="cmd">specgate init<\/code>/);
  assert.doesNotMatch(html, /Create project/);
});

test("REQ-211 SCN-211c: the new Settings — the profiles, which is the default and which streams usage", () => {
  const html: string = studio.renderSettings(
    "en",
    { isProject: true, empty: false },
    [
      {
        name: "fast",
        agent: "claude -p < {prompt_file} | specgate harness events --from claude",
        default: true,
        streams: true,
      },
      { name: "deep", agent: "codex exec {prompt_file}", default: false, streams: false },
    ],
    { claude: true, codex: true },
    {
      level: "basic",
      diffCoverage: 80,
      mutationScore: null,
      docker: false,
      checks: [
        {
          name: "secrets",
          when: "attempt",
          gate: true,
          runner: "docker",
          unavailable: "Docker is not running",
        },
      ],
    }
  );
  assert.match(html, /<strong>fast<\/strong>/);
  assert.match(
    html,
    /<span class="chip">default<\/span><span class="chip ok-chip">live tokens and cost<\/span>/
  );
  assert.match(html, /<strong>deep<\/strong>[\s\S]*steps only/);
  assert.match(html, /Docker does not answer/);
  assert.match(html, /diff coverage 80 % · mutation — %/);
  assert.match(html, /title="Docker is not running">cannot run here/);
  assert.match(html, />Switch to strict</);
  assert.doesNotMatch(html, />Switch to basic</);
});

// ── REQ-433: Live — stopping a run at once ─────────────────────────────────
import * as cp from "node:child_process";
import { stopBuild } from "../../scripts/lib/studio-app";
import { readLive } from "../../scripts/lib/live-model";

const aliveNow = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("REQ-433 SCN-433a: stopping at once ends the run and its requirement, not after the current one", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-stop-now-"));
  // A run as the studio starts it: detached, so it leads its own processes.
  // It starts its agent detached, as the harness does: a process group of its own.
  const agentPidFile = path.join(dir, "agent.pid");
  const runScript = [
    "const cp = require('node:child_process');",
    "const a = cp.spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });",
    `require('node:fs').writeFileSync(${JSON.stringify(agentPidFile)}, String(a.pid));`,
    "setInterval(() => {}, 1000);",
  ].join("\n");
  const run = cp.spawn(process.execPath, ["-e", runScript], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  run.unref();
  for (let i = 0; i < 50 && !fs.existsSync(agentPidFile); i++)
    await new Promise((ok) => setTimeout(ok, 100));
  const agentPid = Number(fs.readFileSync(agentPidFile, "utf8"));
  const events = path.join(dir, ".harness", "events");
  fs.mkdirSync(events, { recursive: true });
  const t = Math.floor(Date.now() / 1000);
  fs.writeFileSync(
    path.join(events, "run.lock"),
    JSON.stringify({ pid: run.pid, started: t, reqs: ["REQ-025"] })
  );
  fs.writeFileSync(
    path.join(events, "REQ-025.jsonl"),
    `${JSON.stringify({ type: "attempt", state: "start", req: "REQ-025", attempt: 1, t })}\n` +
      `${JSON.stringify({ type: "gate-start", stage: "tests", req: "REQ-025", attempt: 1, t })}\n`
  );
  assert.equal(readLive(dir).requirements[0].state, "running");

  const r = stopBuild(dir, true);
  assert.equal(r.ok, true);
  for (let i = 0; i < 40 && aliveNow(run.pid!); i++) await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(aliveNow(run.pid!), false, "the run's process is gone");
  for (let i = 0; i < 40 && aliveNow(agentPid); i++) await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(aliveNow(agentPid), false, "and the agent it started, in its own process group");
  const req = readLive(dir).requirements[0];
  assert.equal(req.state, "fail", "the attempt is ended, not left running");
  assert.match(fs.readFileSync(path.join(events, "REQ-025.jsonl"), "utf8"), /"stage":"stopped"/);
  // Nothing runs now: a second stop says so.
  assert.equal(stopBuild(dir, true).ok, false);
});

test("REQ-204: the sidebar folds to its icons — each section still named, the choice a button that says it", () => {
  const open: string = studio.renderShell("questions", { ...studio.DEFAULTS });
  assert.match(open, /<div class="app">/);
  assert.match(
    open,
    /class="fold" aria-controls="side" aria-expanded="true" aria-label="Plegar la barra lateral"/
  );
  assert.equal((open.match(/<svg class="icon"/g) || []).length, 8);
  const folded: string = studio.renderShell("questions", {
    ...studio.DEFAULTS,
    folded: true,
    lang: "en",
  });
  assert.match(folded, /<div class="app folded">/);
  assert.match(folded, /aria-expanded="false" aria-label="Unfold the sidebar"/);
  // Folded, a link keeps its name for a screen reader and gives it as a tooltip.
  assert.match(
    folded,
    /href="#\/questions" aria-current="page" title="Questions"><svg[^]*?<span class="label">Questions<\/span>/
  );
});

const liveData = (now: number, extra: Record<string, unknown> = {}) => ({
  requirements: [
    {
      req: "REQ-025",
      title: "Cancel an order",
      group: "orders",
      attempt: 2,
      phase: "gate",
      state: "running",
      started: now - 125,
      updated: now,
      elapsed: 125,
      tests: { pass: 3, fail: 1 },
      files: ["src/orders.ts"],
      steps: [
        { type: "gate", stage: "tests", result: "fail", pass: 3, fail: 1, t: now },
        { type: "gate-start", stage: "tests", t: now - 10 },
        { type: "step", kind: "edit", target: "src/orders.ts", t: now - 40 },
      ],
      usage: null,
      question: null,
    },
  ],
  queue: ["REQ-025", "REQ-026"],
  queueStarted: now - 200,
  totals: { input: 12000, output: 3000, cost: 0.42, turns: 9 },
  questions: { open: [] },
  ...extra,
});

test("REQ-433: /live opens the app on Live, and an address still wins", () => {
  assert.equal(studio.sectionOf("", "live"), "live");
  assert.equal(studio.sectionOf("#/questions", "live"), "questions");
  assert.equal(studio.sectionOf("", "nope"), "home");
  const { studioShell } = require("../../scripts/lib/studio-shell");
  assert.match(
    studioShell("shop", "ab12", "live"),
    /<meta name="specgate-section" content="live"\/>/
  );
  assert.doesNotMatch(studioShell("shop", "ab12"), /specgate-section/);
});

test("REQ-434 SCN-434a: the server away — the page says it is reconnecting and that what it shows may be old", () => {
  const html: string = studio.renderStates("es");
  assert.match(html, /<div class="offline" role="status">/);
  assert.match(html, /Sin conexión con el studio · reintentando\./);
  assert.match(html, /Lo que ves puede estar desactualizado\./);
  assert.match(studio.TEXTS.es.backOnline, /Conectado de nuevo/);
});

test("REQ-434: a section's shape while it is read; a failed read inside it, with the way to read again", () => {
  const html: string = studio.renderStates("en", [], "/api/questions · 500");
  assert.match(html, /<div class="skeleton" aria-busy="true" aria-label="Loading…">/);
  assert.match(
    html,
    /<section class="card section-error" role="alert"><h2>This section could not be read<\/h2><p class="faint">\/api\/questions · 500/
  );
  assert.match(html, />Read it again</);
});

test("REQ-434: a success goes by itself; a failure stays, in an alert, with the action that retries it", () => {
  const html: string = studio.renderStates("en", [
    { id: 1, kind: "ok", text: "Draft approved." },
    { id: 2, kind: "err", text: "Could not: the draft is blocked", retry: () => undefined },
  ]);
  assert.match(html, /<div aria-live="polite"><div class="notice notice-ok">/);
  assert.match(
    html,
    /<div role="alert"><div class="notice notice-err">[^]*Could not: the draft is blocked[^]*>Try again<\/button>/
  );
  assert.equal((html.match(/aria-label="Close"/g) || []).length, 2);
});

test("REQ-434 SCN-434a: the heartbeat answers with the studio's current token, so a page that reconnects can write", async () => {
  const http = require("node:http");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-ping-"));
  const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");
  const start = (port: number) =>
    cp.spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: "1" },
      detached: process.platform !== "win32",
    });
  const get = (port: number, url: string) =>
    new Promise<string>((resolve, reject) => {
      http
        .get(
          { host: "127.0.0.1", port, path: url, headers: { host: "localhost" } },
          (res: import("node:http").IncomingMessage) => {
            let data = "";
            res.on("data", (d: Buffer) => (data += d));
            res.on("end", () => resolve(data));
          }
        )
        .on("error", reject);
    });
  const up = (child: import("node:child_process").ChildProcess) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("studio did not start")), 8000);
      child.stdout!.on("data", (d: Buffer) => {
        if (String(d).includes("http://")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  const stop = (child: import("node:child_process").ChildProcess) => {
    try {
      if (process.platform === "win32")
        cp.spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else process.kill(-child.pid!, "SIGTERM");
    } catch {
      /* gone */
    }
  };
  const port = 45000 + Math.floor(Math.random() * 2000);
  const tokenOf = async () => {
    const page = await get(port, "/");
    const ping = JSON.parse(await get(port, "/api/ping"));
    return { page: (/name="specgate-token" content="([0-9a-f]+)"/.exec(page) || [])[1], ping };
  };
  let child = start(port);
  try {
    await up(child);
    const first = await tokenOf();
    assert.equal(first.ping.ok, true);
    assert.equal(first.ping.token, first.page, "the heartbeat carries the page's token");
    stop(child);
    await new Promise((ok) => setTimeout(ok, 500));
    child = start(port);
    await up(child);
    const second = await tokenOf();
    assert.notEqual(second.ping.token, first.ping.token, "a studio started again has a new token");
    assert.equal(second.ping.token, second.page);
  } finally {
    stop(child);
  }
});

test("REQ-434: what the checks say comes in Spanish with the same ids — and as written when it is not known", () => {
  const say = studio.sayFinding;
  assert.equal(
    say(
      "es",
      "D7_answered_still_blocked",
      "Question Q1 is answered, and REQ-002 is still Needs Clarification."
    ),
    "Q1 está respondida y REQ-002 sigue en «Needs Clarification»: confirma que la spec ya lo dice."
  );
  assert.equal(
    say(
      "es",
      "D13_assumption_to_review",
      "Assumption A92 comes from an answer to Q1 the specification may not reflect yet."
    ),
    "El supuesto A92 sale de la respuesta a Q1: puede que la spec aún no lo diga."
  );
  assert.equal(
    say("es", "approve_question_open", "Q2 is open: Until when?"),
    "Q2 sin responder: Until when?"
  );
  assert.equal(
    say("es", "B4_no_example", "The orders section has rules and no example."),
    "La sección orders tiene reglas y ningún ejemplo."
  );
  // English stays English; an unknown sentence is shown as written.
  assert.equal(
    say("en", "B4_no_example", "The orders section has rules and no example."),
    "The orders section has rules and no example."
  );
  assert.equal(say("es", "B4_no_example", "Something new."), "Something new.");
  assert.equal(say("es", "X_unknown", "Q1 is open: x"), "Q1 is open: x");
});

test("REQ-435 SCN-435a: the keyboard — a skip to the content, Enter saves the answer, Q1's row can take the focus", () => {
  const shell: string = studio.renderShell("questions", { ...studio.DEFAULTS });
  assert.match(shell, /^<div class="app"><a class="skip" href="#main">Saltar al contenido<\/a>/);
  assert.match(shell, /<main class="main" id="main" tabindex="-1">/i);
  const html: string = studio.renderQuestions("es", {
    open: [
      {
        id: "Q2",
        change: "draft-orders",
        text: "¿Hasta cuándo?",
        blocks: [],
        options: [],
        from: "draft",
      },
    ],
    toReview: [
      { change: "draft-orders", assumption: "A1", question: "Q1", text: "¿Desde cuánto?" },
    ],
  });
  assert.match(html, /aria-describedby="answer-draft-orders-Q2-hint"/);
  assert.match(
    html,
    /id="answer-draft-orders-Q2-hint" class="faint hint">Enter guarda · Mayús\+Enter, nueva línea/
  );
  assert.match(html, /<div class="confirm-row" data-q="draft-orders:Q1" tabindex="-1">/i);
});

test("REQ-435: a result is announced once — by the notice, not again inside the section; no tabs without arrow keys", () => {
  for (const html of [
    studio.renderQuestions("es", { open: [], toReview: [] }),
    studio.renderBrief("en", briefData(), { advanced: true }),
    studio.renderReport("en", reportData()),
  ]) {
    assert.doesNotMatch(html, /role="tab/);
  }
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "studio", "app.css"), "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce\)\s*\{[^@]*animation:\s*none\s*!important/);
});

test("REQ-435: the button that confirms a stop now can take the focus", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "..", "..", "studio", "src", "sections", "Live.tsx"),
    "utf8"
  );
  assert.match(src, /<Busy\s+id="stop-now-sure"/);
});

test("REQ-436 SCN-436a: the browser journey runs in CI on Windows, macOS and Linux", () => {
  const root = path.join(__dirname, "..", "..", "..");
  const yaml = require("yaml");
  const wf = yaml.parse(
    fs.readFileSync(path.join(root, ".github", "workflows", "e2e.yml"), "utf8")
  );
  const job = wf.jobs.studio;
  assert.deepEqual([...job.strategy.matrix.os].sort(), [
    "macos-latest",
    "ubuntu-latest",
    "windows-latest",
  ]);
  const runs = job.steps.map((s: { run?: string }) => s.run || "").join("\n");
  assert.match(runs, /playwright install --with-deps chromium/);
  assert.match(runs, /npm run e2e:studio/);
  const spec = fs.readFileSync(path.join(root, "e2e", "studio", "studio.spec.mjs"), "utf8");
  for (const step of [
    "Guardar respuesta",
    "Ya está en la spec",
    "Aprobar el borrador",
    "Usar este asistente",
    "/live",
    "Parar ya",
  ]) {
    assert.ok(spec.includes(step), `the journey goes through ${step}`);
  }
  assert.match(spec, /pageerror/);
});

test("REQ-216 SCN-216b: stopping a draft ends its agent too, though it runs in a group of its own", async () => {
  const { stopJob } = require("../../scripts/lib/studio-route");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-stop-draft-"));
  const agentPidFile = path.join(dir, "agent.pid");
  const jobScript = [
    "const cp = require('node:child_process');",
    "const a = cp.spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });",
    `require('node:fs').writeFileSync(${JSON.stringify(agentPidFile)}, String(a.pid));`,
    "setInterval(() => {}, 1000);",
  ].join("\n");
  const job = cp.spawn(process.execPath, ["-e", jobScript], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  job.unref();
  for (let i = 0; i < 50 && !fs.existsSync(agentPidFile); i++)
    await new Promise((ok) => setTimeout(ok, 100));
  const agentPid = Number(fs.readFileSync(agentPidFile, "utf8"));
  fs.mkdirSync(path.join(dir, ".harness", "events"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".harness", "events", "studio-job.json"),
    JSON.stringify({
      kind: "draft",
      module: "orders",
      profile: "",
      pid: job.pid,
      started: 0,
      log: "",
    })
  );
  assert.equal(stopJob(dir).ok, true);
  for (let i = 0; i < 40 && (aliveNow(job.pid!) || aliveNow(agentPid)); i++)
    await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(aliveNow(job.pid!), false, "the draft's job is gone");
  assert.equal(aliveNow(agentPid), false, "and its agent");
});

const liveMatrix = [
  {
    requirement: "REQ-025",
    title: "Cancel an order",
    scenario: "SCN-025",
    group: "orders",
    feature: "features/orders/REQ-025.feature",
    tests: ["tests/orders.test.ts"],
    status: "Draft",
    source: "change",
  },
  {
    requirement: "REQ-026",
    title: "Refund",
    scenario: "SCN-026",
    group: "orders",
    feature: "",
    tests: [],
    status: "Draft",
    source: "change",
  },
  {
    requirement: "REQ-031",
    title: "Invoice",
    scenario: "",
    group: "billing",
    feature: "",
    tests: [],
    status: "Needs Clarification",
    source: "change",
  },
  {
    requirement: "REQ-002",
    title: "Health",
    scenario: "SCN-002",
    group: "spec",
    feature: "features/core/health.feature",
    tests: ["tests/health.test.ts"],
    status: "Implemented",
    source: "spec",
  },
] as const;

test("REQ-433 SCN-433a: the new Live — the test result in the log, Tests the step running, REQ-026 queued", () => {
  const now = 1_800_000_000;
  const data = liveData(now);
  Object.assign(data.requirements[0], {
    running: {
      stage: "tests",
      since: now - 10,
      runner: "host",
      image: "",
    },
  });
  data.requirements[0].steps = data.requirements[0].steps.filter((e) => e.type !== "gate");
  data.requirements[0].steps.unshift({
    type: "step",
    kind: "test",
    target: "npm test",
    pass: 3,
    fail: 1,
    t: now,
  } as never);
  const html: string = studio.renderLive("en", data, "open", now, [...liveMatrix]);
  assert.match(
    html,
    /<li class="pl pl-running" aria-current="step">[^]*?tests<\/span><span class="faint">10 s<\/span><\/li>/
  );
  const log = html.slice(html.indexOf('class="term"'));
  assert.ok(log.indexOf("src/orders.ts") < log.indexOf("started  tests"));
  assert.ok(log.indexOf("started  tests") < log.indexOf("npm test"));
  assert.match(
    html,
    /<section class="wq" aria-label="Up next">[^]*?<span class="id">REQ-026<\/span> Refund/
  );
  assert.match(html, /\$0\.42/);
  assert.match(html, />Stop after this requirement</);
  assert.match(html, />Stop now</);
  assert.match(html, /role="status"><i aria-hidden="true"><\/i>Connected/);
});

test("REQ-179 SCN-179b + REQ-181 SCN-181a: Live reads like a CI run — a header kept in view with the run's figures, the steps Agent to Merge", () => {
  const now = 1_800_000_000;
  const data = liveData(now);
  const html: string = studio.renderLive("en", data, "open", now, [...liveMatrix]);
  assert.match(html, /<header class="live-head">/);
  assert.match(html, /<dl class="run-sum" aria-label="Summary">[^]*?1 passed|0 passed/);
  for (const step of ["Agent", "Specification", "Architecture", "Merge"])
    assert.match(html, new RegExp(`>${step}<`));
  assert.match(html, /tests<\/span><span class="faint">/, "a gate stage by its name");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "studio", "app.css"), "utf8");
  assert.match(css, /\.live-head\{[^}]*position:\s*sticky/);
  // Nothing from another host; no event read as HTML.
  // Our code never sets HTML: every value goes in as text (the bundled library may support it; we do not use it).
  const src = path.join(__dirname, "..", "..", "..", "studio", "src");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.tsx?$/.test(e.name)) files.push(path.join(d, e.name));
    }
  };
  walk(src);
  for (const f of files)
    assert.doesNotMatch(
      fs.readFileSync(f, "utf8"),
      /dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML/,
      f
    );
  assert.doesNotMatch(
    studio.renderLive("en", data, "open", now, [...liveMatrix]),
    /<script|https?:\/\//
  );
});

test("REQ-181 SCN-181c: the run as a matrix by module — a row per module, a segment per requirement, those not reached included", () => {
  const now = 1_800_000_000;
  const rows = studio.matrixByModule(liveData(now).requirements, [...liveMatrix], now);
  assert.deepEqual(
    rows.map((r: { group: string; reqs: Array<{ req: string; state: string }> }) => [
      r.group,
      r.reqs.map((q) => `${q.req}:${q.state}`),
    ]),
    [
      // What the run touched first on top; the rest in id order.
      ["orders", ["REQ-025:running", "REQ-026:queued"]],
      ["spec", ["REQ-002:pass"]],
      ["billing", ["REQ-031:blocked"]],
    ]
  );
  const html: string = studio.renderLive("en", liveData(now), "open", now, [...liveMatrix]);
  assert.match(html, /id="chain" role="group"/);
  for (const w of ["passed", "running", "failed", "asks", "blocked", "queued"])
    assert.match(html, new RegExp(`<\\/span> ${w}<\\/li>`));
  assert.match(
    html,
    /class="seg seg-blocked" aria-pressed="false" aria-label="REQ-031 — Invoice · blocked"/
  );
});

test("REQ-181 SCN-181b: the Traceability view — every row, from the spec and from a change, by module, with its tests and status", () => {
  const html: string = studio.renderTrace("en", [...liveMatrix]);
  assert.match(html, /<details open><summary><strong>orders<\/strong>/);
  assert.match(html, /<details open><summary><strong>spec<\/strong>/);
  assert.match(
    html,
    /REQ-002<\/span> Health<\/th><td>SCN-002<\/td><td><code>features\/core\/health.feature<\/code><\/td><td><code class="block">tests\/health.test.ts<\/code><\/td><td>Implemented <span class="faint">· in the spec/
  );
  assert.match(html, /REQ-025<\/span> Cancel an order[^]*?Draft <span class="faint">· in a change/);
  assert.match(html, /type="search"[^>]*aria-label="Filter: requirement, scenario, module…"/);
});

test("REQ-181 SCN-181a + REQ-182 SCN-182d: the requirement opens in its tabs — Steps, Requirement, Tests and files, Attempts, Agent", () => {
  const now = 1_800_000_000;
  const html: string = studio.renderLive("en", liveData(now), "open", now, [...liveMatrix]);
  assert.match(html, /role="tablist" aria-label="The requirement in detail"/);
  for (const tab of ["Steps", "Requirement", "Tests and files", "Attempts", "Agent"]) {
    assert.match(html, new RegExp(`role="tab"[^>]*>${tab}<`));
  }
  assert.match(
    html,
    /role="tab" id="tab-steps" class="chip-btn" aria-selected="true"[^>]*tabindex="0"/i
  );
});

test("REQ-182 SCN-182d: the sidebar is the run's work queue — Now with model, context and output; Needs attention; Up next; Finished recently", () => {
  const now = 1_800_000_000;
  const data = liveData(now);
  Object.assign(data.requirements[0], {
    agent: {
      model: "claude-sonnet-4-5-20250929",
      version: "2.1",
      permission: "acceptEdits",
      tools: 12,
    },
    usage: {
      context: 42000,
      peak: 50000,
      window: 200000,
      input: 9000,
      output: 3100,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0.12,
      turns: 4,
    },
  });
  const html: string = studio.renderLive("en", data, "open", now, [...liveMatrix]);
  for (const block of [
    "Now",
    "Needs attention",
    "Up next",
    "Open questions",
    "Finished recently",
  ]) {
    assert.match(html, new RegExp(`<section class="wq" aria-label="${block}">`));
  }
  assert.match(html, /<dt>Model<\/dt><dd>sonnet-4-5<\/dd>/);
  assert.match(html, /42k \/ 200k/);
  assert.match(html, /<dt>Output<\/dt><dd>3.1k tokens<\/dd>/);
  assert.match(
    html,
    /REQ-031<\/span> Invoice<\/span><span class="faint">blocked · needs clarification/
  );
});

test("REQ-274 SCN-274a: the step that runs, by its name and how long — in the steps and in Now", () => {
  const now = 1_800_000_000;
  const r = liveData(now).requirements[0];
  Object.assign(r, {
    running: { stage: "quality: coverage", since: now - 180, runner: "docker", image: "maven:3.9" },
  });
  const rows = studio.pipeline(r, now);
  const running = rows.find((x: { state: string }) => x.state === "running");
  assert.equal(running.name, "quality: coverage");
  assert.equal(running.seconds, 180);
  assert.equal(running.image, "maven:3.9");
  const data = liveData(now);
  data.requirements[0] = r;
  const html: string = studio.renderLive("en", data, "open", now, []);
  assert.match(html, /<dt>Running<\/dt><dd><code>quality: coverage<\/code> · 3 min 00 s<\/dd>/);
  assert.match(
    html,
    /quality: coverage<span class="faint"> · maven:3.9<\/span><\/span><span class="faint">3 min 00 s/
  );
});

test("REQ-189 SCN-189c + REQ-201 SCN-201c: what the agent asked waits under Needs attention, with the form that answers it and marks it reviewed", () => {
  const now = 1_800_000_000;
  const data = liveData(now, {
    questions: {
      open: [
        { id: "Q4", change: "draft-orders", text: "Refund to the card?", blocks: ["REQ-025"] },
      ],
    },
  });
  data.requirements[0].state = "question";
  (data.requirements[0] as { question: unknown }).question = { text: "Refund to the card?" };
  const html: string = studio.renderLive("es", data, "lost", now, [...liveMatrix]);
  assert.match(
    html,
    /<section class="wq" aria-label="Necesita atención">[^]*?pregunta: Refund to the card\?/
  );
  assert.match(html, /<label for="live-answer-draft-orders-Q4"/);
  assert.match(html, />Marcar como revisada</);
  assert.match(
    html,
    /<span class="seg seg-question" aria-hidden="true"><\/span> pregunta/,
    "the legend names it"
  );
  assert.match(html, /Sin conexión · reintentando/);
  // Asked by the agent, it is not listed again under Open questions.
  assert.doesNotMatch(
    html.slice(html.indexOf('aria-label="Preguntas abiertas"')),
    /Refund to the card/
  );
});

test("REQ-203 SCN-203a: every open question in Live, each with the form that answers it; a waiting requirement with the command that asks", () => {
  const now = 1_800_000_000;
  const data = liveData(now, {
    questions: {
      open: [{ id: "Q6", change: "draft-billing", text: "Which tax?", blocks: ["REQ-031"] }],
      waitingWithoutQuestion: [{ requirement: "REQ-040", title: "Export" }],
    },
  });
  const html: string = studio.renderLive("en", data, "open", now, []);
  const block = html.slice(html.indexOf('aria-label="Open questions"'));
  assert.match(
    block,
    /<span class="id">Q6<\/span> <span class="faint">draft-billing · Blocks REQ-031<\/span>/
  );
  assert.match(block, /<label for="live-answer-draft-billing-Q6"/);
  assert.match(block, /REQ-040<\/span> Export[^]*?specgate ask REQ-040/);
});

test("REQ-431 SCN-431a: an agent chosen as a command of its own is shown in Settings, which can change it", () => {
  const html: string = studio.renderSettings(
    "en",
    { isProject: true, empty: false },
    [],
    { claude: true, codex: false },
    null,
    "node stub-agent.mjs {prompt_file}"
  );
  assert.doesNotMatch(html, /No assistant is configured yet/);
  assert.match(
    html,
    /<strong>agent<\/strong> <code class="where">node stub-agent.mjs \{prompt_file\}<\/code>/
  );
  assert.match(html, /harness\.config\.yaml/);
  assert.match(html, />Change the assistant</);
  // Nothing configured: Settings offers the form itself, the agent found already chosen.
  const none: string = studio.renderSettings(
    "en",
    { isProject: true, empty: false },
    [],
    { claude: true, codex: false },
    null,
    null
  );
  assert.match(none, /No assistant is configured yet/);
  assert.match(
    none,
    /class="choice on"><input type="radio" name="agent-kind" checked[^>]*\/><span class="name">Claude Code/
  );
});

test("REQ-215 SCN-215a: the brief can be pasted for an agent set as a command, not only as a profile", () => {
  const empty = briefData({ exists: false, product: "", actors: [], modules: [] });
  assert.doesNotMatch(
    studio.renderBrief("en", empty, { profile: "", agent: "node a.mjs {prompt_file}" }),
    /Needs an assistant/
  );
  assert.match(studio.renderBrief("en", empty, { profile: "", agent: "" }), /Needs an assistant/);
});

test("REQ-211 SCN-211c: /api/profiles names the agent command harness.config.yaml holds", () => {
  const { configuredAgent } = require("../../scripts/lib/studio-route");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-agent-cmd-"));
  assert.equal(configuredAgent(dir), null);
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    'test_cmd: npm test\nagent: "node stub-agent.mjs {prompt_file}"\n'
  );
  assert.equal(configuredAgent(dir), "node stub-agent.mjs {prompt_file}");
});
