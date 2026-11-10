/**
 * onboarding-fixes: an existing local project onboarded without asking an
 * agent to finish the setup — adopt saves what it detects and says what is
 * ready (REQ-470), the areas it finds stay out of the matrix (REQ-471), an
 * earlier adoption's proposals are flagged (REQ-472), one command sets up the
 * agent (REQ-473).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/cli";

/** A local Node project with four areas and tests under one of them, committed. */
function shop(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-onboard-"));
  const put = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put("package.json", JSON.stringify({ name: "shop", scripts: { test: "node --test" } }));
  for (const area of ["auth", "catalog", "orders", "payments"]) {
    for (const f of ["a", "b", "c"]) put(`src/${area}/${f}.js`, "export const x = 1;\n");
  }
  put("test/auth/auth.test.js", "require('node:test')('auth', () => {});\n");
  return dir;
}

/** A PATH with a fake `claude` on it — or with none — and the rest of the system's. */
function pathWith(claude: boolean): string {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "sg-bin-"));
  if (claude) {
    const file = path.join(bin, process.platform === "win32" ? "claude.cmd" : "claude");
    fs.writeFileSync(file, process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\n");
    fs.chmodSync(file, 0o755);
  }
  // Only what node and git need: no real agent CLI leaks in.
  const system = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(
      (p) => !fs.existsSync(path.join(p, process.platform === "win32" ? "claude.cmd" : "claude"))
    );
  return [bin, ...system].join(path.delimiter);
}

function adopt(dir: string, claude = false, ...flags: string[]) {
  return runCli(["adopt", "--project-dir", dir, ...flags], {
    env: { ...process.env, PATH: pathWith(claude), CI: "1" },
  });
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const harness = (dir: string) =>
  fs.existsSync(path.join(dir, "harness.config.yaml")) ? read(dir, "harness.config.yaml") : "";

test("REQ-470 SCN-470a: adopt --yes on a Node project saves `test_cmd: npm test`, check runs it, and the readiness list says what is set and what is not", () => {
  const dir = shop();
  try {
    const r = adopt(dir, false, "--yes");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(harness(dir), /^test_cmd: "?npm test"?$/m);
    const out = r.stdout + r.stderr;
    assert.match(out, /Ready/);
    assert.match(out, /✔\s+Tests\s+npm test/);
    assert.match(out, /·\s+Architecture\s+not set — specgate config set arch_cmd "<command>"/);
    assert.match(out, /·\s+Agent\s+not set — specgate agents init --tool claude/);
    assert.match(out, /✔\s+CI gate\s+\.github\/workflows\/spec-gate\.yml/);
    const check = runCli(["check", dir], { env: { ...process.env, CI: "1" } });
    assert.match(check.stdout + check.stderr, /Tests\s+npm test/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-470: with an agent's CLI on the PATH, adopt sets Build's agent too; a value already set is never replaced", () => {
  const dir = shop();
  try {
    const r = adopt(dir, true, "--yes");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(harness(dir), /^agent: "?claude .*-p < \{prompt_file\}/m);
    assert.match(r.stdout + r.stderr, /✔\s+Agent\s+claude/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const kept = shop();
  try {
    fs.writeFileSync(path.join(kept, "harness.config.yaml"), "test_cmd: npm run test:unit\n");
    const r = adopt(kept, false, "--yes");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(harness(kept), /^test_cmd: "?npm run test:unit"?$/m);
    assert.doesNotMatch(harness(kept), /^test_cmd: "?npm test"?$/m);
  } finally {
    fs.rmSync(kept, { recursive: true, force: true });
  }
});

test("REQ-470: a dry run saves nothing and says what it would set", () => {
  const dir = shop();
  try {
    const r = adopt(dir, true, "--dry-run");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(harness(dir), "");
    assert.match(r.stdout + r.stderr, /would set test_cmd: npm test/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-471 SCN-471a: the four areas go to docs/specs/adoption.md with their folders, files and tests — the matrix and status keep REQ-001 alone", () => {
  const dir = shop();
  try {
    const r = adopt(dir, false, "--yes");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const areas = read(dir, "docs/specs/adoption.md");
    for (const [title, folder] of [
      ["Auth", "src/auth"],
      ["Catalog", "src/catalog"],
      ["Orders", "src/orders"],
      ["Payments", "src/payments"],
    ]) {
      assert.match(areas, new RegExp(`## ${title}[\\s\\S]*?\`${folder}\` · 3 source files`));
    }
    assert.match(areas, /## Auth[\s\S]*?Tests: `test\/auth\/auth\.test\.js`/);
    assert.match(areas, /specgate new "/);
    const rows = read(dir, "docs/specs/traceability.md").match(/^\| REQ-\d+/gm) ?? [];
    assert.deepEqual(rows, ["| REQ-001"]);
    assert.doesNotMatch(read(dir, "spec.md"), /Proposed, not specified/);
    const status = JSON.parse(
      runCli(["status", "--json", "--project-dir", dir], { env: { ...process.env, CI: "1" } })
        .stdout
    );
    assert.equal(status.total, 1);
    assert.match(r.stdout + r.stderr, /docs\/specs\/adoption\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('REQ-472 SCN-472a: REQ-002 "Auth" left proposed by an earlier adoption is flagged by status and doctor, with how to fix it', () => {
  const dir = shop();
  try {
    assert.equal(adopt(dir, false, "--yes").status, 0);
    fs.appendFileSync(
      path.join(dir, "spec.md"),
      "\n## REQ-002 — Auth\n\n<!-- specgate:trace artifact=src/auth uc='UC-002 Auth' -->\n\n" +
        "**Proposed, not specified.** Read off `src/auth` (3 source files), which says this codebase has a\n" +
        "Auth area — not what it must do.\n"
    );
    const status = JSON.parse(
      runCli(["status", "--json", "--project-dir", dir], { env: { ...process.env, CI: "1" } })
        .stdout
    );
    const f = (status.status as Array<{ code: string; target?: string; fix?: string }>).find(
      (x) => x.code === "proposal_unspecified"
    );
    assert.ok(f, JSON.stringify(status.status));
    assert.equal(f.target, "REQ-002");
    assert.match(f.fix ?? "", /specgate new/);
    assert.match(f.fix ?? "", /remove/i);
    const doctor = runCli(["doctor", "--project-dir", dir], { env: { ...process.env, CI: "1" } });
    assert.match(doctor.stdout + doctor.stderr, /REQ-002[\s\S]*proposed, not specified/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-473 SCN-473a: `agents init --tool claude` also sets Build's agent when none is set", () => {
  const dir = shop();
  try {
    assert.equal(adopt(dir, false, "--yes").status, 0);
    assert.doesNotMatch(harness(dir), /^agent:/m);
    const r = runCli(["agents", "init", "--tool", "claude", "--project-dir", dir], {
      env: { ...process.env, CI: "1" },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const get = runCli(["config", "get", "agent", "--project-dir", dir], {
      env: { ...process.env, CI: "1" },
    });
    assert.match(get.stdout, /claude .*-p < \{prompt_file\}/);
    // A second run, or another agent set by hand, is left alone.
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      harness(dir).replace(/^agent: .*$/m, "agent: my-agent {prompt_file}")
    );
    runCli(["agents", "init", "--tool", "claude", "--project-dir", dir], {
      env: { ...process.env, CI: "1" },
    });
    assert.match(harness(dir), /^agent: "?my-agent \{prompt_file\}"?$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const route = () =>
  require("../../scripts/lib/studio-route") as typeof import("../../scripts/lib/studio-route");
const studioUi = () => require(path.join(__dirname, "..", "..", "studio-test", "studio.cjs"));

test("REQ-474 SCN-474a: the studio on a folder with code says to adopt it and leads to Adopt; on an empty one, to create the project", () => {
  const code = shop();
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "sg-empty-"));
  try {
    const r = route().route(code);
    assert.equal(r.isProject, false);
    assert.equal(r.hint, "adopt");
    const html: string = studioUi().renderHome("en", r, null);
    assert.match(html, /Adopt this folder/);
    assert.doesNotMatch(html, /Create the project/);
    assert.match(html, /href="#\/settings"/);
    assert.equal(route().route(empty).hint, "create");
    assert.match(studioUi().renderHome("es", route().route(empty), null), /Crea el proyecto/);
  } finally {
    fs.rmSync(code, { recursive: true, force: true });
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("REQ-474 SCN-474a: once adopted, Home's next step is the one status gives — specify a behaviour, with the areas found", () => {
  const dir = shop();
  try {
    assert.equal(adopt(dir, false, "--yes").status, 0);
    const r = route().route(dir);
    assert.equal(r.isProject, true);
    assert.equal(r.hint, "specify");
    assert.equal(r.areas, 4);
    const html: string = studioUi().renderHome("en", r, null);
    assert.match(html, /Specify a behaviour you rely on/);
    assert.match(html, /4 areas in docs\/specs\/adoption\.md/);
    assert.match(html, /href="#\/changes"/);
    // With a brief, the brief stays the next step.
    fs.writeFileSync(path.join(dir, "docs", "brief.md"), "# Brief\n");
    assert.notEqual(route().route(dir).hint, "specify");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-470: a project with no test yet gets no test command — the readiness list says so, and check still passes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-notests-"));
  try {
    fs.writeFileSync(path.join(dir, "pyproject.toml"), '[project]\nname = "billing"\n');
    fs.mkdirSync(path.join(dir, "billing"));
    fs.writeFileSync(path.join(dir, "billing", "__init__.py"), "");
    const r = adopt(dir, false, "--yes");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(harness(dir), /^test_cmd:/m);
    assert.match(
      r.stdout + r.stderr,
      /·\s+Tests\s+no test found yet — specgate config set test_cmd "pytest" once there is one/
    );
    const check = runCli(["check", dir], { env: { ...process.env, CI: "1" } });
    assert.equal(check.status, 0, check.stdout + check.stderr);
    // Tests added later: a second look finds them.
    fs.mkdirSync(path.join(dir, "tests"));
    fs.writeFileSync(
      path.join(dir, "tests", "test_total.py"),
      "def test_total():\n    assert True\n"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
