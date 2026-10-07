#!/usr/bin/env node
/**
 * End-to-end: the CLI as a user installs it, on throwaway repositories.
 *
 * The unit and CLI suites run the source tree. This runs the *package*:
 * `npm pack`, install the tarball into an empty directory, and drive the
 * binary from there through the journeys a team actually takes. It catches
 * what the source tree cannot — a file missing from `files`, a path that
 * only resolves inside the repository, a default that differs once installed.
 *
 *   node e2e/run.mjs                    pack this checkout and run everything
 *   node e2e/run.mjs --tarball x.tgz    run against a given package
 *   node e2e/run.mjs --skip-network     skip journeys that fetch a published version
 *   node e2e/run.mjs --only harness     run the journeys whose name matches
 *   node e2e/run.mjs --keep             leave the sandbox on disk for inspection
 *
 * Plain Node, no dependencies, so it runs the same on Linux, macOS and Windows.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-e2e-"));
const isWin = process.platform === "win32";

// ── Installing the package ───────────────────────────────────────────────────

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    shell: isWin,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

function pack() {
  const given = value("--tarball");
  if (given) return path.resolve(given);
  const out = path.join(SANDBOX, "pack");
  fs.mkdirSync(out);
  const r = run("npm", ["pack", "--silent", "--pack-destination", out], { cwd: ROOT });
  if (r.status !== 0) throw new Error(`npm pack failed:\n${r.stdout}${r.stderr}`);
  return path.join(out, fs.readdirSync(out).find((f) => f.endsWith(".tgz")));
}

function install(tarball) {
  const dir = path.join(SANDBOX, "cli");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"e2e-host","private":true}');
  const r = run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarball], { cwd: dir });
  if (r.status !== 0) throw new Error(`npm install failed:\n${r.stdout}${r.stderr}`);
  const bin = path.join(dir, "node_modules", "@rsaglobaltech", "specgate", "bin", "specgate.js");
  if (!fs.existsSync(bin)) throw new Error(`installed package has no bin/specgate.js`);
  return bin;
}

const TARBALL = pack();
const BIN = install(TARBALL);
const VERSION = JSON.parse(
  fs.readFileSync(path.join(path.dirname(BIN), "..", "package.json"), "utf8")
).version;

/** The installed CLI, as a user would type it. */
function sg(cwd, ...cliArgs) {
  return spawnSync(process.execPath, [BIN, ...cliArgs], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

// ── A tiny harness ───────────────────────────────────────────────────────────

const results = [];

class Failure extends Error {}

function expect(cond, message, r) {
  if (cond) return;
  const detail = r ? `\n--- exit ${r.status}\n${r.stdout}\n${r.stderr}` : "";
  throw new Failure(`${message}${detail}`);
}
const ok = (r, what) => expect(r.status === 0, `${what} should exit 0`, r);
const fails = (r, what) => expect(r.status === 1, `${what} should exit 1`, r);
const out = (r) => `${r.stdout}${r.stderr}`;

function journey(name, fn) {
  const only = value("--only");
  if (only && !name.includes(only)) return;
  const dir = fs.mkdtempSync(path.join(SANDBOX, "j-"));
  const started = Date.now();
  try {
    fn(dir);
    results.push({ name, ok: true, ms: Date.now() - started });
    process.stdout.write(`  ✔ ${name} (${Date.now() - started} ms)\n`);
  } catch (e) {
    if (e && e.skip) {
      results.push({ name, ok: true, skipped: true });
      process.stdout.write(`  - ${name} (skipped: ${e.skip})\n`);
      return;
    }
    results.push({ name, ok: false, error: e.message });
    process.stdout.write(`  ✖ ${name}\n${String(e.message).replace(/^/gm, "      ")}\n`);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function write(dir, rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));
const matrixRow = (dir, id) =>
  read(dir, "docs/specs/traceability.md")
    .split("\n")
    .find((l) => l.startsWith(`| ${id} |`)) || "";

function nodeRepo(dir) {
  write(dir, "package.json", '{"name":"shop","version":"1.0.0","scripts":{"test":"node --test"}}');
  write(dir, "src/orders/index.js", "module.exports = { total: (x) => Math.round(x * 100) / 100 };\n");
  return dir;
}

/** Rewrite the <placeholder> steps `new` writes into a real scenario. */
function fillScenario(dir, rel, steps) {
  write(
    dir,
    rel,
    read(dir, rel)
      .replace("<the state before the action>", steps[0])
      .replace("<the action under test>", steps[1])
      .replace("<the observable outcome>", steps[2])
  );
}

function git(dir, ...gitArgs) {
  return spawnSync("git", gitArgs, { cwd: dir, encoding: "utf8" });
}
function gitInit(dir) {
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "e2e@example.com");
  git(dir, "config", "user.name", "E2E");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
}

// ── Journeys ─────────────────────────────────────────────────────────────────

process.stdout.write(`\nspecgate ${VERSION} — installed from ${path.basename(TARBALL)}\n\n`);

journey("the installed binary reports its version and the five-verb help", (dir) => {
  const v = sg(dir, "--version");
  ok(v, "--version");
  expect(v.stdout.includes(VERSION), `--version should print ${VERSION}`, v);
  const help = sg(dir, "--help");
  ok(help, "--help");
  for (const verb of ["init", "status", "new", "check", "done"]) {
    expect(new RegExp(`\\b${verb}\\b`).test(help.stdout), `--help should list ${verb}`, help);
  }
  expect(!/\breq\s{2,}/.test(help.stdout), "--help should not list req any more", help);
  ok(sg(dir, "--help", "--all"), "--help --all");
});

journey("brownfield Node: init adopts, then new → test → done --strict, no req link", (dir) => {
  nodeRepo(dir);
  const init = sg(dir, "init");
  ok(init, "init in a repo with code");
  expect(/Existing code found/.test(out(init)), "init should say it adopted", init);
  expect(read(dir, "src/orders/index.js").includes("Math.round"), "adopt must not touch code");
  expect(read(dir, "docs/specs/traceability.md").includes("specgate:derived"), "matrix generated");
  ok(sg(dir, "check"), "check on a fresh adoption");

  const created = sg(dir, "new", "Totals are rounded to the cent", "--json");
  ok(created, "new");
  const req = JSON.parse(created.stdout).requirement;
  expect(exists(dir, req.featureFile), "new should write the feature file");

  const premature = sg(dir, "done", req.id, "--strict");
  fails(premature, "done --strict on a scenario of placeholders");
  expect(/scenario_placeholder_step/.test(out(premature)), "the refusal names the placeholders", premature);

  fillScenario(dir, req.featureFile, [
    "an order totalling 10.005 EUR",
    "the total is computed",
    "the total is 10.01 EUR",
  ]);
  write(dir, "test/totals.test.js", `// ${req.id} ${req.scenarioId}\nrequire("node:test");\n`);
  fs.appendFileSync(path.join(dir, "src/orders/index.js"), `// ${req.id}: rounding to the cent\n`);

  const done = sg(dir, "done", req.id, "--strict");
  ok(done, "done --strict once the scenario and a test that names it exist");
  expect(/\| test\/totals\.test\.js \| Implemented \|$/.test(matrixRow(dir, req.id)), "test derived");
  expect(/`src\/orders\/index\.js`/.test(matrixRow(dir, req.id)), "code derived from its mention");
  ok(sg(dir, "validate", ".", "--strict"), "validate --strict (what CI runs)");

  const status = sg(dir, "status", "--json");
  ok(status, "status --json");
  const doc = JSON.parse(status.stdout);
  expect(doc.counts.DONE >= 1, "status should count the delivered requirement", status);
});

journey("a stale generated matrix fails validate, and check repairs it", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  ok(sg(dir, "new", "Orders can be cancelled"), "new");
  write(dir, "test/cancel.test.js", "// REQ-002\n");
  const v = sg(dir, "validate", ".", "--json");
  fails(v, "validate on a stale matrix");
  expect(v.stdout.includes("matrix_stale"), "the code is matrix_stale", v);
  sg(dir, "check");
  ok(sg(dir, "validate", "."), "validate after check regenerated");
});

journey("the gate refuses a delivered requirement whose test file is gone", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  const req = JSON.parse(sg(dir, "new", "Refunds are logged", "--json").stdout).requirement;
  fillScenario(dir, req.featureFile, ["a paid order", "it is refunded", "the refund is logged"]);
  write(dir, "test/refund.test.js", `// ${req.id}\n`);
  ok(sg(dir, "done", req.id, "--strict"), "done --strict");
  // Pin the link explicitly, then delete the file: a rotted link.
  ok(sg(dir, "req", "link", req.id, "--test", "test/refund.test.js"), "req link");
  fs.rmSync(path.join(dir, "test/refund.test.js"));
  const c = sg(dir, "check", "--json");
  fails(c, "check with the delivered requirement's test file deleted");
});

journey("check runs the project's tests, and fails when they fail", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  write(dir, "fail.js", "process.exit(3);\n");
  write(dir, "pass.js", "process.exit(0);\n");
  fails(sg(dir, "check", "--test-cmd", "node fail.js"), "check with a failing suite");
  ok(sg(dir, "check", "--test-cmd", "node pass.js"), "check with a passing suite");
  write(dir, "harness.config.yaml", 'test_cmd: "node fail.js"\n');
  fails(sg(dir, "check"), "check reading test_cmd from harness.config.yaml");
});

journey("brownfield Python and Java are recognised by their manifests", (dir) => {
  const py = path.join(dir, "py");
  write(py, "pyproject.toml", '[project]\nname = "billing"\n');
  write(py, "billing/__init__.py", "");
  const a = sg(py, "init");
  ok(a, "init on Python");
  expect(/pyproject\.toml/.test(out(a)), "detected from pyproject.toml", a);
  ok(sg(py, "check"), "check on Python");

  const java = path.join(dir, "java");
  write(java, "pom.xml", "<project><artifactId>clinic</artifactId></project>\n");
  write(java, "src/main/java/App.java", "class App {}\n");
  const b = sg(java, "init");
  ok(b, "init on Java");
  expect(/pom\.xml/.test(out(b)), "detected from pom.xml", b);
  ok(sg(java, "check"), "check on Java");
});

journey("greenfield: init --yes scaffolds a project whose gate passes", (dir) => {
  const r = sg(dir, "init", "--yes", "--no-git");
  ok(r, "init --yes");
  const project = fs.readdirSync(dir).find((d) => fs.statSync(path.join(dir, d)).isDirectory());
  const p = path.join(dir, project);
  expect(read(p, "docs/specs/traceability.md").includes("specgate:derived"), "matrix generated");
  ok(sg(p, "check"), "check on the scaffold");
  ok(sg(p, "validate", ".", "--strict"), "validate --strict on the scaffold");
});

journey("a hand-kept matrix migrates row for row, or not at all", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "adopt", "--keep-matrix", "--no-capabilities"), "adopt --keep-matrix");
  expect(!read(dir, "docs/specs/traceability.md").includes("specgate:derived"), "hand-kept");
  ok(sg(dir, "req", "add", "Coupons expire"), "req add");
  write(dir, "test/coupon.test.js", "// coupons\n");
  ok(sg(dir, "req", "link", "REQ-002", "--test", "test/coupon.test.js", "--code", "src/orders/index.js"), "req link");
  ok(sg(dir, "done", "REQ-002"), "done");
  const before = read(dir, "docs/specs/traceability.md");

  const m = sg(dir, "matrix", "--migrate");
  ok(m, "matrix --migrate");
  expect(/identical row for row/.test(m.stdout), "migration reports a lossless result", m);
  const norm = (md) =>
    md
      .split("\n")
      .filter((l) => l.startsWith("| REQ-"))
      .map((l) => l.replace(/`/g, "").replace(/\| TBD \|/g, "| - |"));
  expect(
    JSON.stringify(norm(read(dir, "docs/specs/traceability.md"))) === JSON.stringify(norm(before)),
    "rows identical after migration"
  );
  ok(sg(dir, "matrix", "--check"), "matrix --check");
  ok(sg(dir, "validate", "."), "validate after migration");
});

journey("ci init writes a workflow that runs the one gate", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  ok(sg(dir, "ci", "init", "--provider", "github"), "ci init --provider github");
  const wf = fs
    .readdirSync(path.join(dir, ".github", "workflows"))
    .map((f) => read(dir, `.github/workflows/${f}`))
    .join("\n");
  expect(/validate \. --strict\b/.test(wf), "the workflow runs validate --strict");
  expect(!/--strict-tdd/.test(wf), "and not the weaker --strict-tdd");
});

journey("agents init writes /specgate:* commands", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  ok(sg(dir, "agents", "init", "--tool", "claude,cursor"), "agents init");
  expect(exists(dir, ".claude/commands/specgate/apply.md"), "claude commands under specgate/");
  expect(exists(dir, ".cursor/rules/specgate.mdc"), "cursor rule named specgate");
  expect(/# \/specgate:apply/.test(read(dir, ".claude/commands/specgate/apply.md")), "heading");
  for (const step of ["explore", "new", "apply", "verify", "done"]) {
    expect(exists(dir, `.claude/commands/specgate/${step}.md`), `the daily loop has /specgate:${step}`);
  }
  expect(/specgate check --json/.test(read(dir, ".claude/commands/specgate/verify.md")), "verify runs check");
  expect(/names `REQ-NNN`/.test(read(dir, "AGENTS.md")), "AGENTS.md teaches the mention as the link");
});

journey("update moves agent files generated by 0.9.0, keeping a team's edit", (dir) => {
  if (flag("--skip-network")) throw Object.assign(new Error(), { skip: "--skip-network" });
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  const old = run("npx", ["-y", "@rsaglobaltech/specgate@0.9.0", "agents", "init", "--tool", "claude,cursor"], {
    cwd: dir,
  });
  expect(old.status === 0, "0.9.0 agents init (needs the network)", old);
  expect(exists(dir, ".claude/commands/csda/apply.md"), "0.9.0 wrote csda paths");
  fs.appendFileSync(path.join(dir, ".claude/commands/csda/apply.md"), "\nOUR TEAM RULE\n");
  write(dir, "README.md", "# Our project\n");

  ok(sg(dir, "update"), "update");
  expect(!exists(dir, ".claude/commands/csda"), "old directory removed");
  const moved = read(dir, ".claude/commands/specgate/apply.md");
  expect(moved.includes("OUR TEAM RULE"), "the team's edit survived");
  expect(!/\/csda:/.test(moved), "no /csda: left");
  expect(read(dir, "README.md") === "# Our project\n", "the project README is untouched");
  const again = JSON.parse(sg(dir, "update", "--json").stdout);
  expect(again.update.files.every((f) => f.outcome === "unchanged"), "a second update is a no-op");
});

journey("harness run delivers a requirement on a generated matrix", (dir) => {
  nodeRepo(dir);
  ok(sg(dir, "init"), "init");
  const req = JSON.parse(sg(dir, "new", "Totals are rounded to the cent", "--json").stdout).requirement;
  fillScenario(dir, req.featureFile, [
    "an order totalling 10.005 EUR",
    "the total is computed",
    "the total is 10.01 EUR",
  ]);
  gitInit(dir);
  // An agent that does what the prompt asks: a test that names the
  // requirement, and the code. It is not allowed to edit the spec.
  write(
    path.join(SANDBOX, "agents"),
    `agent-${path.basename(dir)}.js`,
    [
      "const fs = require('node:fs');",
      "fs.mkdirSync('test', { recursive: true });",
      `fs.writeFileSync('test/totals.test.js', '// ${req.id} ${req.scenarioId}\\n');`,
      "fs.appendFileSync('src/orders/index.js', '// rounding\\n');",
    ].join("\n")
  );
  const agent = path.join(SANDBOX, "agents", `agent-${path.basename(dir)}.js`);
  const r = sg(dir, "harness", "run", "--agent", `node "${agent}" {prompt_file}`, "--max-attempts", "1");
  ok(r, "harness run");
  expect(new RegExp(`✅ ${req.id}\\s+pass`).test(out(r)), "the requirement passes the gate", r);
  expect(!/req link/.test(out(r)), "and nothing tells the user to req link on a generated matrix", r);
  const branchMatrix = git(dir, "show", `harness/${req.id}:docs/specs/traceability.md`).stdout;
  expect(branchMatrix.includes("test/totals.test.js"), "the branch's matrix links the agent's test");
});

// ── Summary ──────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);
process.stdout.write(
  `\n${results.length - failed.length - skipped.length} passed · ${failed.length} failed · ${skipped.length} skipped\n`
);
if (flag("--keep")) process.stdout.write(`sandbox kept at ${SANDBOX}\n`);
else fs.rmSync(SANDBOX, { recursive: true, force: true });
process.exit(failed.length === 0 ? 0 : 1);
