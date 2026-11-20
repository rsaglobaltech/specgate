/**
 * REQ-607 (issue #502): a project adopted with no build manifest states its stack as
 * TBD, an agent is told how the person decides it, and `config set stack`
 * writes the decision into AGENTS.md.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  contractFact,
  setContractFact,
  undecided,
  undecidedFacts,
} from "../../scripts/agents/contract-file";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const CLI = path.join(ROOT, "bin", "specgate.js");

function run(dir: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function adopted(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-stack-"));
  const r = run(dir, "adopt");
  assert.equal(r.status, 0, r.out);
  return dir;
}

test("undecided reads TBD and the wording 1.4 wrote", () => {
  assert.equal(undecided("TBD"), true);
  assert.equal(undecided("unknown — edit AGENTS.md with your stack"), true);
  assert.equal(undecided("TypeScript, Node 24"), false);
  assert.equal(undecided(null), false);
});

test("REQ-607 SCN-607a: adopt with no manifest states the stack as TBD and says how to decide it", () => {
  const dir = adopted();
  const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
  assert.match(agents, /^Stack: TBD · .* · Testing: TBD$/m);
  assert.match(agents, /specgate config set stack/);
  assert.match(agents, /specgate init --forja/);
  assert.deepEqual(undecidedFacts(dir), ["stack", "testing"]);
});

test("status and doctor name the command while the stack is undecided", () => {
  const dir = adopted();
  assert.match(run(dir, "status").out, /specgate config set stack "<yours>"/);
  const doctor = run(dir, "doctor");
  assert.match(doctor.out, /agent contract/);
  assert.match(doctor.out, /specgate config set testing "<yours>"/);
});

test("config set stack writes AGENTS.md and the notices go", () => {
  const dir = adopted();
  assert.equal(run(dir, "config", "set", "stack", "TypeScript, Node 24").status, 0);
  assert.equal(run(dir, "config", "set", "testing", "node:test").status, 0);
  assert.match(
    fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"),
    /^Stack: TypeScript, Node 24 · API: .* · Testing: node:test$/m
  );
  assert.equal(contractFact(dir, "stack"), "TypeScript, Node 24");
  assert.deepEqual(undecidedFacts(dir), []);
  assert.doesNotMatch(run(dir, "status").out, /to be decided/);
  assert.doesNotMatch(run(dir, "doctor").out, /agent contract/);
});

test("REQ-607 SCN-607b: config set stack keeps the team's text and refuses a value that breaks the header", () => {
  const dir = adopted();
  const file = path.join(dir, "AGENTS.md");
  fs.appendFileSync(file, "\n## Ours\n\nStack: do not touch this line\n");
  const refused = run(dir, "config", "set", "stack", "a · b");
  assert.equal(refused.status, 2);
  assert.match(refused.out, /config_value_invalid/);
  assert.equal(run(dir, "config", "set", "stack", "Go").status, 0);
  assert.equal(run(dir, "config", "set", "testing", "go test").status, 0);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^Stack: Go · .* · Testing: go test$/m);
  assert.match(text, /^Stack: do not touch this line$/m);
  assert.doesNotMatch(run(dir, "status").out, /to be decided/);
  assert.doesNotMatch(run(dir, "doctor").out, /agent contract/);
});

test("config set stack is refused where AGENTS.md has no Specgate block", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-stack-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Ours\n\nStack: Rust\n");
  assert.equal(setContractFact(dir, "stack", "Go"), false);
  assert.equal(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), "# Ours\n\nStack: Rust\n");
});

test("REQ-607 SCN-607c: a project with a manifest is not asked anything", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-stack-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "shop", scripts: { test: "node --test" } })
  );
  assert.equal(run(dir, "adopt").status, 0);
  assert.deepEqual(undecidedFacts(dir), []);
});
