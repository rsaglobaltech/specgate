/**
 * brief-domain-views: the project's domain model, to draw (REQ-658) — from a
 * DDD workshop's models or from the specification — and exported as boards
 * DDD Toolbox opens (REQ-659), read back the same. The workshop is the real
 * motor-claims one made on dddtoolbox.com.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const FIX = path.join(ROOT_DIR, "tests", "fixtures", "ddd");
const BOARDS = [
  "siniestros-story",
  "siniestros-event-storming",
  "canvas-siniestros",
  "canvas-polizas",
  "canvas-pagos",
].map((n) => path.join(FIX, `${n}.json`));

function project(t: TestContext, files: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-domain-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  spawnSync("git", ["init", "-q"], { cwd: dir });
  const cli = (...a: string[]) =>
    spawnSync(process.execPath, [CLI, ...a], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  const json = (...a: string[]) => {
    const r = cli(...a, "--json");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  };
  return { dir, cli, json };
}

type Flow = { actor: string | null; command: string | null; outcomes: string[] };
const said = (f: Flow) => [f.actor, f.command, ...f.outcomes].filter(Boolean).join(" · ");

test("REQ-658 SCN-658a: from the claims workshop — source workshop, siniestros core with its ACL to Pólizas, its first flow, its 26-activity story", (t: TestContext) => {
  const p = project(t);
  p.cli("brief", "import", ...BOARDS);
  const { model } = p.json("brief", "model");
  assert.equal(model.source, "workshop");
  assert.deepEqual(
    model.modules.map((m: { slug: string }) => m.slug),
    ["siniestros", "pagos", "polizas"]
  );
  const s = model.modules[0];
  assert.equal(s.classification.domain, "core");
  const acl = s.integrations.find(
    (i: { direction: string; with: string }) => i.direction === "outbound" && i.with === "Pólizas"
  );
  assert.deepEqual(
    [acl.relationship, acl.messages],
    ["ACL", [{ type: "query", label: "Consultar cobertura" }]]
  );
  assert.equal(said(s.flows[0]), "Asegurado · Declarar siniestro · Siniestro declarado");
  assert.equal(s.stories.length, 1);
  assert.equal(s.stories[0].steps.length, 26);
  assert.deepEqual(s.stories[0].steps[0], {
    n: 1,
    actor: "Asegurado",
    activity: "declara",
    object: "Parte de siniestro",
    to: ["Agente del contact center"],
  });
});

test("REQ-658 SCN-658b: from the specification, no workshop — source spec, the context pedidos with its flow, UC-001's story", (t: TestContext) => {
  const p = project(t, {
    "docs/specs/changes/draft-pedidos/specs/pedidos/spec.md": [
      "# Delta — pedidos",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-031 — Cancel an order",
      "",
      "<!-- specgate:trace status=Draft actor=Customer kind=functional -->",
      "",
      "The system SHALL cancel an order not shipped yet.",
      "",
      "#### Scenario: SCN-031 — Cancelled before shipping",
      "",
      "- GIVEN an order not shipped",
      "- WHEN the Customer cancels it",
      "- THEN it is cancelled",
      "",
    ].join("\n"),
    "docs/specs/use-cases.md": [
      "# Use cases",
      "",
      "| ID | Name | Actor | Requirements | Scenarios | Spec | Diagram | Status |",
      "|---|---|---|---|---|---|---|---|",
      "| UC-001 | Cancel an order | Customer | REQ-031 | SCN-031 | docs/specs/use-cases/UC-001.md | - | Draft |",
      "",
    ].join("\n"),
    "docs/specs/use-cases/UC-001.md": [
      "# UC-001 — Cancel an order",
      "",
      "## Overview",
      "",
      "The Customer cancels an order.",
      "",
      "## Actors",
      "",
      "- Customer",
      "",
      "## Preconditions",
      "",
      "- The order is not shipped.",
      "",
      "## Main flow (SCN-031)",
      "",
      "1. The Customer opens the order",
      "2. The Customer asks to cancel it",
      "3. The system cancels it",
      "",
      "## Postconditions",
      "",
      "- The order is cancelled.",
      "",
    ].join("\n"),
  });
  const { model } = p.json("brief", "model");
  assert.equal(model.source, "spec");
  const pedidos = model.modules.find((m: { slug: string }) => m.slug === "pedidos");
  assert.ok(pedidos, JSON.stringify(model.modules.map((m: { slug: string }) => m.slug)));
  assert.equal(said(pedidos.flows[0]), "Customer · Cancel an order · Cancelled before shipping");
  assert.equal(pedidos.flows[0].requirement, "REQ-031");
  assert.equal(pedidos.stories[0].steps.length, 3);
  assert.match(pedidos.stories[0].title, /UC-001/);
});

test("REQ-659 SCN-659a: the claims workshop exported and read back — three canvases, the wall, the story; the same contexts, 26 flows and 26 activities", (t: TestContext) => {
  const p = project(t);
  p.cli("brief", "import", ...BOARDS);
  const { export: ex } = p.json("brief", "export");
  assert.deepEqual([...ex.written].sort(), [
    "docs/brief/ddd-toolbox/event-storming.json",
    "docs/brief/ddd-toolbox/pagos-canvas.json",
    "docs/brief/ddd-toolbox/polizas-canvas.json",
    "docs/brief/ddd-toolbox/siniestros-canvas.json",
    "docs/brief/ddd-toolbox/story-1.json",
  ]);
  // Every shape a record tldraw keeps: an id, a type, a valid index, its parent.
  const wall = JSON.parse(
    fs.readFileSync(path.join(p.dir, "docs/brief/ddd-toolbox/event-storming.json"), "utf8")
  );
  for (const r of Object.values(wall.store) as Array<Record<string, unknown>>)
    if (r.typeName === "shape") {
      assert.match(String(r.index), /^(a[0-9A-Za-z]|b[1-9A-Za-z][0-9A-Za-z])$/);
      assert.ok(r.parentId, String(r.id));
    }
  const back = project(t);
  const files = ex.written.map((w: string) => path.join(p.dir, w));
  assert.equal(back.cli("brief", "import", ...files).status, 0);
  const { model } = back.json("brief", "model");
  assert.deepEqual(model.modules.map((m: { slug: string }) => m.slug).sort(), [
    "pagos",
    "polizas",
    "siniestros",
  ]);
  assert.equal(
    model.modules.reduce((n: number, m: { flows: unknown[] }) => n + m.flows.length, 0),
    26
  );
  const story = model.modules.flatMap((m: { stories: unknown[] }) => m.stories)[0];
  assert.equal(story.steps.length, 26);
  assert.equal(story.steps[25].activity, "reporta");
  // Systems and groups drawn as they were, and the canvas's assumptions kept.
  assert.equal(story.actorKinds["Sistema de pagos"], "system");
  assert.equal(story.actorKinds["Taller concertado"], "group");
  const siniestros = model.modules.find((m: { slug: string }) => m.slug === "siniestros");
  assert.match(siniestros.assumptions, /portal de talleres/);
});
