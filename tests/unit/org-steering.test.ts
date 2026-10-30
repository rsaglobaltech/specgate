/**
 * The organization's principles, drift, API contracts and adopting one area
 * (REQ-330..338).
 *
 * Every test builds a real project in a temp folder — `specgate init`, git
 * with its own identity (CI runners have none) — and drives the CLI.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { contractOperations, resolveApiRef } = require("../../packages/core/src/domain/ApiContract");
const { parsePrinciples, compareVersions } = require("../../packages/core/src/domain/Principles");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-steer-"));
  made.push(d);
  return d;
}

function sg(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "" },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function json(r: { stdout: string }) {
  return JSON.parse(r.stdout);
}

function codes(doc: { status?: Array<{ code: string }> }): string[] {
  return (doc.status || []).map((d) => d.code);
}

/** A fresh Specgate project, under git with its own identity, on main. */
function project(root = tmp(), name = "app"): string {
  const out = path.join(root, `.init-${name}`);
  const r = sg(root, "init", "--yes", "--out", out, "--no-git", "--keep-matrix");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = path.join(root, name);
  fs.renameSync(path.join(out, "my-spec-driven-app"), dir);
  fs.rmSync(out, { recursive: true, force: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  commitAll(dir, "seed");
  return dir;
}

function write(dir: string, rel: string, text: string) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
}

function commitAll(dir: string, message: string) {
  git(dir, "add", "-A");
  const r = git(dir, "commit", "-qm", message);
  assert.equal(r.status, 0, r.stdout + r.stderr);
}

function principles(version: string, source: string, body = "") {
  return [
    "---",
    `principles_version: ${version}`,
    ...(source ? [`source: ${source}`] : []),
    "---",
    "# Principles",
    "",
    body,
  ].join("\n");
}

// ── REQ-330 ──────────────────────────────────────────────────────────────────

test("REQ-330 SCN-330a: the workspace raised its principles", () => {
  const root = tmp();
  const dir = project(root);
  write(root, "ws/principles.md", principles("1.1.0", ""));
  write(dir, "docs/specs/principles.md", principles("1.0.0", "../ws/principles.md"));
  commitAll(dir, "principles");
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  assert.equal(doc.check.principles.version, "1.0.0");
  const behind = doc.status.find((d: { code: string }) => d.code === "principles_behind");
  assert.ok(behind, r.stdout);
  assert.match(behind.message, /1\.0\.0/);
  assert.match(behind.message, /1\.1\.0/);
});

test("REQ-330 SCN-330b: up to date", () => {
  const root = tmp();
  const dir = project(root);
  write(root, "ws/principles.md", principles("1.1.0", ""));
  write(dir, "docs/specs/principles.md", principles("1.1.0", "../ws/principles.md"));
  commitAll(dir, "principles");
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!codes(json(r)).includes("principles_behind"), r.stdout);
  assert.equal(compareVersions("1.10.0", "1.9.2"), 1);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
});

// ── REQ-331 ──────────────────────────────────────────────────────────────────

test("REQ-331 SCN-331a: a forbidden pattern in the code", () => {
  const dir = project();
  write(
    dir,
    "docs/specs/principles.md",
    principles(
      "1.0.0",
      "",
      '## P1 — No credentials in code\n\n<!-- specgate:principle forbid="password\\s*=\\s*\\"" in="src/**" -->\n'
    )
  );
  write(dir, "src/config.ts", 'export const password = "x";\n');
  commitAll(dir, "config");
  const parsed = parsePrinciples(
    fs.readFileSync(path.join(dir, "docs/specs/principles.md"), "utf8")
  );
  assert.equal(parsed.principles[0].id, "P1");
  assert.equal(parsed.principles[0].forbid, 'password\\s*=\\s*"');
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const failed = json(r).status.find((d: { code: string }) => d.code === "principle_failed");
  assert.ok(failed, r.stdout);
  assert.match(failed.message, /P1/);
  assert.match(failed.message, /src\/config\.ts:1/);
});

test("REQ-331 SCN-331b: a principle given as advice", () => {
  const dir = project();
  // Scripts, not `node -e process.exit(3)`: sh reads the parentheses as its own
  // syntax, so the command failed on Linux and macOS for a reason of its own.
  write(dir, "scripts/audit.js", "process.exit(3);\n");
  write(dir, "scripts/lint.js", "process.exit(0);\n");
  write(
    dir,
    "docs/specs/principles.md",
    principles(
      "1.0.0",
      "",
      [
        "## P2 — Audit runs clean",
        "",
        '<!-- specgate:principle run="node scripts/audit.js" level=warn -->',
        "",
        "## P3 — Lint runs clean",
        "",
        '<!-- specgate:principle run="node scripts/lint.js" -->',
        "",
      ].join("\n")
    )
  );
  commitAll(dir, "principles");
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const found = json(r).status.filter((d: { code: string }) => d.code === "principle_failed");
  assert.equal(found.length, 1, r.stdout);
  assert.equal(found[0].severity, "warning");
  assert.match(found[0].message, /P2/);
});

// ── REQ-332 ──────────────────────────────────────────────────────────────────

test("REQ-332 SCN-332a: the organization released its principles pack 2.0.0", () => {
  const root = tmp();
  const dir = project(root);
  const pack = path.join(root, "org-packs");
  write(
    pack,
    "principles/pack.yaml",
    'schema_version: "1.3.0"\nmetadata:\n  name: "Acme principles"\n  version: "2.0.0"\n'
  );
  write(dir, "docs/specs/principles.md", principles("1.0.0", "pack:principles"));
  write(
    dir,
    ".specops.lock",
    JSON.stringify(
      {
        specops_version: 1,
        specgate_version: "1.0.0",
        packs: [{ repo: pack, version: "1.0.0", pack_id: "principles", pack: "principles" }],
      },
      null,
      2
    )
  );
  commitAll(dir, "principles pack");
  const r = sg(dir, "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const behind = json(r).status.find((d: { code: string }) => d.code === "principles_behind");
  assert.ok(behind, r.stdout);
  assert.match(behind.message, /1\.0\.0/);
  assert.match(behind.message, /2\.0\.0/);
  assert.match(behind.fix, /specgate specops sync/);
});

// ── REQ-333 / REQ-334 ────────────────────────────────────────────────────────

function drifted(): string {
  const dir = project();
  git(dir, "checkout", "-q", "-b", "feature");
  write(dir, "src/billing.ts", "export const total = 1;\n");
  commitAll(dir, "fix totals");
  write(dir, "src/totals.ts", "export const totals = 2;\n");
  commitAll(dir, "feat(REQ-004): totals");
  write(dir, "src/round.ts", "export const round = 3;\n");
  write(dir, "tests/round.test.ts", "// REQ-005: rounding\n");
  commitAll(dir, "round");
  write(dir, "docs/notes.md", "notes\n");
  commitAll(dir, "notes");
  return dir;
}

test("REQ-333 SCN-333a: a quick fix without a requirement", () => {
  const dir = drifted();
  const r = sg(dir, "drift", "--base", "main", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const commits = json(r).drift.commits;
  assert.equal(commits.length, 1, r.stdout);
  assert.equal(commits[0].subject, "fix totals");
  assert.deepEqual(commits[0].files, ["src/billing.ts"]);
  const c = sg(dir, "check", "--base", "main", "--json");
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.ok(codes(json(c)).includes("spec_drift"), c.stdout);
});

test("REQ-334 SCN-334a: the team makes drift a gate", () => {
  const dir = drifted();
  const config = path.join(dir, "harness.config.yaml");
  const before = fs.existsSync(config) ? fs.readFileSync(config, "utf8") : "harness_version: 1\n";
  fs.writeFileSync(config, `${before.trimEnd()}\ndrift: gate\n`);
  commitAll(dir, "chore: drift gate (REQ-001)");
  const r = sg(dir, "drift", "--base", "main", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const d = json(r).status.find((x: { code: string }) => x.code === "spec_drift");
  assert.equal(d.severity, "error");
});

// ── REQ-335 / REQ-336 ────────────────────────────────────────────────────────

const OPENAPI = [
  "openapi: 3.0.3",
  "info:",
  "  title: Tracking",
  "  version: 1.0.0",
  "paths:",
  "  /positions:",
  "    post:",
  "      operationId: reportPosition",
  "      responses:",
  '        "201":',
  "          description: stored",
  '  "/positions/{id}":',
  "    get:",
  "      operationId: getPosition",
  "",
].join("\n");

function withApi(api: string, status = ""): string {
  const dir = project();
  write(dir, "openapi.yaml", OPENAPI);
  assert.equal(sg(dir, "new", "Report a position").status, 0);
  const spec = path.join(dir, "spec.md");
  const text = fs.readFileSync(spec, "utf8");
  fs.writeFileSync(
    spec,
    text.replace(
      /(## REQ-001 — Report a position\n)/,
      `$1\n<!-- specgate:trace api=${api}${status ? ` status=${status}` : ""} -->\n`
    )
  );
  commitAll(dir, "api");
  return dir;
}

test("REQ-335 SCN-335a: the operation exists", () => {
  const ops = contractOperations(OPENAPI, "openapi.yaml");
  assert.deepEqual(
    ops.map((o: { pointer: string }) => o.pointer),
    ["/paths/~1positions/post", "/paths/~1positions~1{id}/get"]
  );
  assert.equal(resolveApiRef("openapi.yaml#reportPosition", { "openapi.yaml": ops }).ok, true);
  const json = JSON.stringify({ openapi: "3.0.3", paths: { "/a": { get: { operationId: "a" } } } });
  assert.equal(contractOperations(json, "c.json")[0].operationId, "a");
  const dir = withApi("openapi.yaml#/paths/~1positions/post");
  const r = sg(dir, "validate", ".", "--strict");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("REQ-335 SCN-335b: the operation is not in the contract", () => {
  // Delivered: a requirement still Draft is only warned about (REQ-385).
  const dir = withApi("reportSpeed", "Implemented");
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const missing = json(r).status.find((d: { code: string }) => d.code === "api_operation_missing");
  assert.ok(missing, r.stdout);
  assert.match(missing.message, /REQ-001/);
  assert.match(missing.message, /reportSpeed/);
});

test("REQ-336 SCN-336a: one operation without a requirement", () => {
  const dir = withApi("reportPosition");
  const r = sg(dir, "contract", "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  const c = doc.contract.contracts[0];
  assert.equal(c.file, "openapi.yaml");
  assert.deepEqual(c.uncited, ["GET /positions/{id}"]);
  assert.ok(codes(doc).includes("api_operation_uncited"), r.stdout);
});

// ── REQ-385: a contract written one requirement at a time ───────────────────

/** Three requirements: the first cites the OpenAPI file, the others a file not written yet. */
function contractsInProgress(): string {
  const dir = project();
  write(dir, "openapi.yaml", OPENAPI);
  for (const t of ["Report a position", "Stream vehicle telemetry", "Stream tachograph events"]) {
    assert.equal(sg(dir, "new", t).status, 0);
  }
  const spec = path.join(dir, "spec.md");
  const cite: Record<string, string> = {
    "Report a position": "openapi.yaml#reportPosition",
    "Stream vehicle telemetry": "asyncapi.yaml#receiveTelemetry",
    "Stream tachograph events": "asyncapi.yaml#receiveTachographEvent",
  };
  let text = fs.readFileSync(spec, "utf8");
  for (const [title, api] of Object.entries(cite)) {
    text = text.replace(
      new RegExp(`(## (REQ-\\d+) — ${title}\\n)`),
      `$1\n<!-- specgate:trace api=${api} -->\n`
    );
  }
  fs.writeFileSync(spec, text);
  commitAll(dir, "three operations, one contract written");
  return dir;
}

test("REQ-385 SCN-385a: the contracts repository delivers its first operation", () => {
  const dir = contractsInProgress();
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const pending = json(r).status.filter((d: { code: string }) => d.code === "api_contract_missing");
  assert.equal(pending.length, 2, r.stdout);
  for (const d of pending) {
    assert.equal(d.severity, "warning");
    assert.match(d.message, /once it is delivered/);
  }
  // The requirement being delivered is held to its citation, the others are not.
  const { apiReferenceProblems } = require("../../scripts/lib/contracts");
  const asFirst = apiReferenceProblems(dir, { delivering: "REQ-001" });
  assert.ok(
    asFirst.every((d: { severity: string }) => d.severity === "warning"),
    JSON.stringify(asFirst)
  );
  const asSecond = apiReferenceProblems(dir, { delivering: "REQ-002" });
  const held = asSecond.filter((d: { severity: string }) => d.severity === "error");
  assert.equal(held.length, 1, JSON.stringify(asSecond));
  assert.equal(held[0].target, "REQ-002");
});

test("REQ-385 SCN-385b: delivered, its contract still missing", () => {
  const dir = contractsInProgress();
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "api=asyncapi.yaml#receiveTelemetry -->",
        "api=asyncapi.yaml#receiveTelemetry status=Implemented -->"
      )
  );
  commitAll(dir, "REQ-002 delivered");
  const r = sg(dir, "validate", ".", "--strict", "--json");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const missing = json(r).status.find(
    (d: { code: string; severity: string }) =>
      d.code === "api_contract_missing" && d.severity === "error"
  );
  assert.ok(missing, r.stdout);
  assert.equal(missing.target, "REQ-002");
});

// ── REQ-337 / REQ-338 ────────────────────────────────────────────────────────

function sources(dir: string, areas: string[]) {
  for (const a of areas) write(dir, `${a}/index.ts`, "export {};\n");
}

test("REQ-337 SCN-337a: the billing area only", () => {
  const dir = tmp();
  sources(dir, ["src/billing/invoices", "src/billing/payments", "src/shipping/routes"]);
  const missing = sg(dir, "adopt", "--scope", "src/nowhere", "--no-agents");
  assert.notEqual(missing.status, 0);
  assert.ok(!fs.existsSync(path.join(dir, "spec.md")), "nothing is written for a missing scope");
  const r = sg(dir, "adopt", "--scope", "src/billing", "--no-agents");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
  assert.match(spec, /invoices/i);
  assert.match(spec, /payments/i);
  assert.doesNotMatch(spec, /routes/i);
  assert.match(spec, /src\/billing/);
  const baseline = fs.readFileSync(path.join(dir, "features/adoption/baseline.feature"), "utf8");
  assert.match(baseline, /src\/billing/);
});

test("REQ-338 SCN-338a: ten areas", () => {
  const dir = tmp();
  const areas = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"].map(
    (a) => `src/${a}`
  );
  for (const [i, a] of areas.entries()) {
    for (let n = 0; n <= 10 - i; n++) write(dir, `${a}/f${n}.ts`, "export {};\n");
  }
  const r = sg(dir, "adopt", "--no-agents");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = r.stdout + r.stderr;
  assert.match(out, /adopt_too_big/);
  assert.match(out, /2 left out/);
  assert.match(out, /specgate adopt --scope/);
});
