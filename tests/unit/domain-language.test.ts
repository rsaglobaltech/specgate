"use strict";

/**
 * REQ-538, REQ-539, REQ-540, REQ-541 — one word for one thing, numbered and
 * tested business rules, and the entity and actor diagrams generated from
 * their sources (change domain-language).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { forbiddenWords, parseGlossary } = require("../../packages/core/src/domain/Glossary");
const {
  duplicateRules,
  rulesIn,
  untestedRules,
} = require("../../packages/core/src/domain/BusinessRules");
const {
  aggregatesIn,
  mergeEntities,
  modelSourceEntities,
  renderActors,
  renderModel,
} = require("../../packages/core/src/domain/DomainDiagrams");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** A scaffolded project (`init --yes`, derived matrix). */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-domain-"));
  madeDirs.push(parent);
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}
const sg = (dir: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};
const put = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const edit = (dir: string, rel: string, f: (s: string) => string) =>
  fs.writeFileSync(path.join(dir, rel), f(fs.readFileSync(path.join(dir, rel), "utf8")));
const codes = (doc: { status: Array<{ code: string }> }) => doc.status.map((d) => d.code);

// ── REQ-538 ─────────────────────────────────────────────────────────────────

test('REQ-538 SCN-538a: a requirement says "client"', () => {
  const dir = project();
  assert.ok(
    fs.existsSync(path.join(dir, "docs/specs/glossary.md")),
    "init writes an empty glossary"
  );
  edit(
    dir,
    "docs/specs/glossary.md",
    (s) => s.trimEnd() + "\n| Customer | Who buys. | client, buyer |\n"
  );
  edit(dir, "spec.md", (s) =>
    s.replace(
      "### REQ-000 — The service reports its own health\n",
      (h) => `${h}\nA client downloads the invoice.\n`
    )
  );
  const r = sg(dir, "validate", ".", "--json");
  assert.equal(r.status, 0, r.out);
  const found = JSON.parse(r.stdout).status.filter(
    (d: { code: string }) => d.code === "glossary_term_forbidden"
  );
  assert.equal(found.length, 1, r.out);
  assert.equal(found[0].target, "client");
  assert.equal(found[0].file, "spec.md");
  const line =
    fs
      .readFileSync(path.join(dir, "spec.md"), "utf8")
      .split("\n")
      .indexOf("A client downloads the invoice.") + 1;
  assert.equal(found[0].line, line);
  assert.match(found[0].message, /the glossary's term is Customer/);

  const strict = sg(dir, "validate", ".", "--strict", "--json");
  assert.ok(codes(JSON.parse(strict.stdout)).includes("glossary_term_forbidden"));
});

test("REQ-538: whole words, ignoring case, never inside code or comments", () => {
  const g = parseGlossary(
    "| Term | Definition | Avoid |\n|---|---|---|\n| Customer | x | `client` |\n"
  );
  assert.deepEqual(g[0].avoid, ["client"]);
  const found = forbiddenWords(
    "The Client pays.\nclientele is fine\n`client` in code\n<!-- client -->\n```\nclient\n```\n",
    g
  );
  assert.deepEqual(
    found.map((f: { line: number; word: string }) => [f.line, f.word]),
    [[1, "Client"]]
  );
});

// ── REQ-539 ─────────────────────────────────────────────────────────────────

test("REQ-539 SCN-539a: one rule tested, one not", () => {
  const dir = project();
  edit(dir, "spec.md", (s) =>
    s
      .replace(
        "reading logs.\n",
        "reading logs.\n\nRules:\n\n- BR-001 The payload names the service.\n- BR-002 The status is UP.\n"
      )
      .replace("<!-- specgate:trace ", "<!-- specgate:trace status=Implemented ")
  );
  put(dir, "tests/health.test.js", "// REQ-000 SCN-000 BR-001: the payload names the service\n");
  assert.equal(sg(dir, "matrix").status, 0, "the derived matrix follows the edit");
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 1, r.out);
  const doc = JSON.parse(r.stdout);
  const untested = doc.status.filter((d: { code: string }) => d.code === "rule_untested");
  assert.deepEqual(
    untested.map((d: { target: string }) => d.target),
    ["BR-002"],
    r.out
  );
});

test("REQ-539: rules are read from a requirement's Rules list, unique across the spec", () => {
  const spec =
    "## REQ-001 — A\n\nRules:\n- BR-001 one\n- **BR-002** two\n\n<!-- specgate:trace status=Implemented -->\n\n" +
    "## REQ-002 — B\n\nRules:\n- BR-002 again\n";
  const all = rulesIn("spec.md", spec);
  assert.deepEqual(
    all.map((r: { requirement: string; status: string; rules: Array<{ id: string }> }) => [
      r.requirement,
      r.status,
      r.rules.map((x) => x.id),
    ]),
    [
      ["REQ-001", "Implemented", ["BR-001", "BR-002"]],
      ["REQ-002", "", ["BR-002"]],
    ]
  );
  assert.deepEqual(
    duplicateRules(all).map((r: { id: string; requirement: string }) => [r.id, r.requirement]),
    [["BR-002", "REQ-002"]]
  );
  const untested = untestedRules(
    all,
    ["BR-0010 is not BR-001"],
    (_: string, s: string) => s === "Implemented"
  );
  assert.deepEqual(
    untested.map((r: { id: string }) => r.id),
    ["BR-002"]
  );
});

test("REQ-539: a rule id used twice fails validate", () => {
  const dir = project();
  edit(dir, "spec.md", (s) =>
    s.replace("reading logs.\n", "reading logs.\n\nRules:\n\n- BR-001 a\n- BR-001 b\n")
  );
  const r = sg(dir, "validate", ".", "--json");
  assert.equal(r.status, 1, r.out);
  assert.ok(codes(JSON.parse(r.stdout)).includes("rule_duplicate"));
});

// ── REQ-540 ─────────────────────────────────────────────────────────────────

const AGGREGATES =
  "# Aggregates\n\n| ID | Aggregate | Context | Responsibilities | Invariants |\n|---|---|---|---|---|\n" +
  "| AGG-001 | Invoice | BC-001 | Invoice line items, totals | - |\n" +
  "| AGG-002 | Payment | BC-002 | Settlement, refund | - |\n";

test("REQ-540 SCN-540a: a pack's aggregate becomes an entity", () => {
  const dir = project();
  put(dir, "docs/specs/aggregates.md", AGGREGATES);
  const c = sg(dir, "check");
  assert.equal(c.status, 0, c.out);
  assert.match(c.out, /docs\/specs\/model\.md regenerated/);
  const model = fs.readFileSync(path.join(dir, "docs/specs/model.md"), "utf8");
  assert.match(model, /```mermaid\nerDiagram\n/);
  assert.match(model, /^ {2}Invoice \{/m);
  assert.match(model, /^ {2}Payment \{/m);
  assert.equal(sg(dir, "validate", ".", "--json").status, 0, "current copy passes");

  fs.appendFileSync(path.join(dir, "docs/specs/model.md"), "\nEdited by hand.\n");
  const v = sg(dir, "validate", ".", "--json");
  assert.equal(v.status, 1, v.out);
  assert.ok(codes(JSON.parse(v.stdout)).includes("model_stale"));
});

test("REQ-540: model.yaml adds attributes and relations; the template's row is no entity", () => {
  assert.deepEqual(
    aggregatesIn(
      "| ID | Aggregate | Context | Invariants |\n|---|---|---|---|\n| AGG-001 | CoreAggregate | Core | x |\n"
    ),
    []
  );
  const model = modelSourceEntities(
    "entities:\n  - name: Invoice\n    attributes:\n      - id uuid PK\n      - total money\n    relations:\n      - to: Payment\n        kind: one-to-many\n        label: settled by\n"
  );
  const md = renderModel(mergeEntities(aggregatesIn(AGGREGATES), model));
  assert.match(md, /^ {4}uuid id PK$/m);
  assert.match(md, /^ {2}Invoice \|\|--o\{ Payment : "settled by"$/m);
  assert.match(md, /\| total \| money \| - \|/);
  assert.equal(renderModel([]), null);
  assert.equal(renderModel(mergeEntities(aggregatesIn(AGGREGATES), model)), md, "deterministic");
});

// ── REQ-541 ─────────────────────────────────────────────────────────────────

test("REQ-541 SCN-541a: two actors, one unknown", () => {
  const dir = project();
  put(
    dir,
    "docs/brief.md",
    "---\nactors:\n  - { name: Customer, surfaces: [web] }\n  - { name: Clerk, surfaces: [web] }\n---\n\n# Brief\n"
  );
  edit(
    dir,
    "spec.md",
    (s) =>
      s.trimEnd() +
      "\n\n## REQ-001 — A customer sees invoices\n\nThe system SHALL list invoices.\n\n<!-- specgate:trace status=Draft actor=Customer -->\n" +
      "\n## REQ-002 — An admin resets\n\nThe system SHALL reset.\n\n<!-- specgate:trace status=Draft actor=Admin -->\n"
  );
  sg(dir, "check");
  const actors = fs.readFileSync(path.join(dir, "docs/specs/actors.md"), "utf8");
  assert.match(actors, /actor_Customer --> cap_spec/);
  assert.match(actors, /cap_spec --> req_REQ_001/);
  assert.doesNotMatch(actors, /REQ-002/);
  const v = sg(dir, "validate", ".", "--json");
  const unknown = JSON.parse(v.stdout).status.filter(
    (d: { code: string }) => d.code === "actor_unknown"
  );
  assert.equal(unknown.length, 1, v.out);
  assert.equal(unknown[0].target, "REQ-002");
  assert.match(unknown[0].message, /Admin/);
});

test("REQ-541: no actors in the brief, no diagram", () => {
  assert.equal(
    renderActors([], [{ id: "REQ-001", title: "a", capability: "spec", actor: "X" }]),
    null
  );
});
