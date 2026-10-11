"use strict";

/**
 * The second round of pilot findings (FinCore, EventTech, HealthTech), 0.17.10:
 * `done` with several ids runs the suite once (#77), `change archive` refuses a
 * draft whose checklist fails (#57), the harness asks Spring for a startup
 * test (#78), and a trace line no requirement owns is reported (#79).
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
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

/** An adopted project with two real requirements (REQ-002, REQ-003) and a counting test command. */
function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-round2-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  for (const title of ["Totals are rounded half-up", "Discounts never go below zero"]) {
    assert.equal(cli("new", title, "--project-dir", dir).status, 0);
  }
  const spec = path.join(dir, "spec.md");
  fs.writeFileSync(
    spec,
    fs
      .readFileSync(spec, "utf8")
      .replace(
        "The system MUST satisfy: Totals are rounded half-up.",
        "The system MUST round every invoice total half-up to two decimals."
      )
      .replace(
        "The system MUST satisfy: Discounts never go below zero.",
        "The system MUST never apply a discount larger than the total."
      )
      .replace(/^> Written by Specgate\..*$/gm, "")
  );
  for (const f of fs.readdirSync(path.join(dir, "features"))) {
    const file = path.join(dir, "features", f);
    if (!f.endsWith(".feature")) continue;
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace("<the state before the action>", "an order totalling 10.005 EUR")
        .replace("<the action under test>", "the invoice total is computed")
        .replace("<the observable outcome>", "the total is 10.01 EUR")
    );
  }
  // Each run of the "suite" appends a line: the test counts the runs.
  fs.writeFileSync(
    path.join(dir, "count.js"),
    "require('fs').appendFileSync('runs.txt', 'x\\n');\n"
  );
  assert.equal(cli("config", "set", "test_cmd", "node count.js", "--project-dir", dir).status, 0);
  return { parent, dir };
}

const status = (dir, id) =>
  (
    fs
      .readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`| ${id} |`)) || ""
  )
    .split("|")
    .slice(-2, -1)[0]
    .trim();

const runs = (dir) =>
  fs.existsSync(path.join(dir, "runs.txt"))
    ? fs.readFileSync(path.join(dir, "runs.txt"), "utf8").trim().split("\n").length
    : 0;

test("#77: done with two ids runs the suite once and closes both", () => {
  const { parent, dir } = project();
  try {
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "test/a.test.js"), "// REQ-002 SCN-002\n");
    fs.writeFileSync(path.join(dir, "test/b.test.js"), "// REQ-003 SCN-003\n");
    const r = cli("done", "REQ-002", "REQ-003", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(runs(dir), 1, "the tests ran once");
    assert.equal(status(dir, "REQ-002"), "Implemented");
    assert.equal(status(dir, "REQ-003"), "Implemented");
    assert.match(r.stdout, /2 of 2 closed/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("#77: one requirement without its test is left; the other closes", () => {
  const { parent, dir } = project();
  try {
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "test/a.test.js"), "// REQ-002 SCN-002\n");
    const r = cli("done", "REQ-002", "REQ-003", "--project-dir", dir, "--json");
    assert.equal(r.status, 1);
    const doc = JSON.parse(r.stdout);
    assert.deepEqual(
      doc.requirements.map((x) => [x.id, x.ok, x.code]),
      [
        ["REQ-002", true, undefined],
        ["REQ-003", false, "done_validate_failed"],
      ]
    );
    assert.equal(status(dir, "REQ-002"), "Implemented");
    assert.equal(status(dir, "REQ-003"), "Draft");
    assert.equal(runs(dir), 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("#57: change archive refuses a draft whose checklist fails; --force archives it", () => {
  const { parent, dir } = project();
  try {
    fs.writeFileSync(
      path.join(dir, "docs/brief.md"),
      "---\nproduct: Shop\nactors:\n  - { name: Customer, surfaces: [api] }\n---\n\nA shop.\n"
    );
    assert.equal(
      cli("change", "new", "draft-cart", "--capability", "cart", "--project-dir", dir).status,
      0
    );
    const changeDir = path.join(dir, "docs/specs/changes/draft-cart");
    fs.appendFileSync(path.join(changeDir, "change.yaml"), "brief: docs/brief.md\n");
    fs.writeFileSync(
      path.join(changeDir, "specs/cart/spec.md"),
      "# Delta — cart\n\n## ADDED Requirements\n\n### Requirement: REQ-010 — Add to cart\n\n" +
        "<!-- csda:trace actor=Customer kind=functional -->\n\nThe system SHALL add a product to the cart.\n\n" +
        "#### Scenario: SCN-010 — A bike in the cart\n\n" +
        '- GIVEN a product "Bike" priced 199 EUR\n' +
        "- WHEN the customer does POST /api/cart with it\n" +
        "- THEN the response is 201 and the cart holds 199 EUR\n"
    );
    fs.writeFileSync(
      path.join(changeDir, "tasks.md"),
      "# Tasks\n\n- [x] 1.1 Write the delta spec\n"
    );
    const refused = cli("change", "archive", "draft-cart", "--project-dir", dir);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stdout + refused.stderr, /archive_draft_not_ready/);
    assert.match(refused.stdout + refused.stderr, /D6_unlisted_value/);
    assert.ok(fs.existsSync(changeDir), "nothing was archived");

    const forced = cli("change", "archive", "draft-cart", "--force", "--project-dir", dir);
    assert.equal(forced.status, 0, forced.stdout + forced.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("#78: a Spring project's harness prompt asks for a startup test; a Node one does not", () => {
  const { startupTestAdvice, harnessFiles } = require("../../scripts/harness/init");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-startup-"));
  try {
    fs.writeFileSync(
      path.join(parent, "pom.xml"),
      "<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent></project>"
    );
    assert.match(startupTestAdvice(parent), /@SpringBootTest/);
    const prompt = harnessFiles(parent, "mvn -B test").find((f) => /prompt/.test(f.dest)).body;
    assert.match(prompt, /boots the real application context with no test doubles/);

    fs.writeFileSync(
      path.join(parent, "pom.xml"),
      "<project><artifactId>io.quarkus</artifactId></project>"
    );
    assert.match(startupTestAdvice(parent), /@QuarkusTest/);

    fs.rmSync(path.join(parent, "pom.xml"));
    fs.writeFileSync(path.join(parent, "package.json"), "{}");
    assert.equal(startupTestAdvice(parent), null);
    const nodePrompt = harnessFiles(parent, "npm test").find((f) => /prompt/.test(f.dest)).body;
    assert.doesNotMatch(nodePrompt, /test doubles/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("#79: a trace line no requirement section owns is found; one under its heading is read", () => {
  const {
    unreadTraceLines,
    requirementsIn,
  } = require("../../packages/core/src/domain/DerivedMatrix");
  const spec =
    "# App\n\n<!-- csda:trace status=Implemented -->\n\n## REQ-002 — Totals\n" +
    '<!-- csda:trace status="Needs Clarification" -->\n\nThe system MUST round.\n\n' +
    "## Notes\n\n<!-- csda:trace kind=functional -->\n\n```md\n<!-- csda:trace in a fence -->\n```\n";
  assert.deepEqual(unreadTraceLines(spec), [3, 12]);
  assert.equal(requirementsIn(spec)[0].trace.status, "Needs Clarification");
});
