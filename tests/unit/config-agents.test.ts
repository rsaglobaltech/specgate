/**
 * config-agents: a profile made to serve a module or a requirement (REQ-705),
 * the sandbox set one field at a time (REQ-706), and `config unset` (REQ-707)
 * — what the studio's Settings › Agents saves through.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
type R = { status: number | null; stdout: string; stderr: string };
const out = (r: R) => `${r.stdout}${r.stderr}`;
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

function requirement(id: string, title: string) {
  return `### Requirement: ${id} — ${title}\n\nThe system SHALL ${title.toLowerCase()}.\n\n#### Scenario: SCN-${id.slice(4)}a — ${title}\n\n- GIVEN a member named Ana\n- WHEN she does it\n- THEN she sees "done"\n\n<!-- specgate:trace kind=functional actor=Developer -->\n`;
}

/** katalog and ausleihe, each with a requirement in its approved change. */
function library() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-config-agents-"));
  const cli = (...args: string[]): R =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", SPECGATE_PROFILE: "" } });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.equal(cli("init").status, 0);
  for (const [change, cap, id, title] of [
    ["draft-katalog", "katalog", "REQ-004", "Add a book"],
    ["draft-ausleihe", "ausleihe", "REQ-006", "Borrow a book"],
  ]) {
    assert.equal(cli("propose", change, "--capability", cap).status, 0);
    w(dir, `docs/specs/changes/${change}/specs/${cap}/spec.md`, `# Delta — ${cap}\n\n## ADDED Requirements\n\n${requirement(id, title)}`);
    assert.equal(cli("change", "approve", change).status, 0);
  }
  return { dir, cli, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("REQ-705 SCN-705a: ausleihe given its own agent, and a module it lacks refused naming those it has", () => {
  const p = library();
  try {
    assert.equal(p.cli("config", "set", "agent", "claude -p < {prompt_file}").status, 0);
    assert.equal(p.cli("config", "set", "profiles.careful.agent", "codex exec - < {prompt_file}").status, 0);
    const r = p.cli("config", "set", "profiles.careful.match.module", "ausleihe");
    assert.equal(r.status, 0, out(r));
    assert.match(read(p.dir, ".harness/profiles.yaml"), /careful:[\s\S]*match:\s*\n\s+module: "ausleihe"/);
    const routes = JSON.parse(p.cli("harness", "doctor", "--no-probe", "--json").stdout).doctor.routes;
    assert.equal(routes.find((x: { requirement: string }) => x.requirement === "REQ-006").profile, "careful");
    assert.equal(routes.find((x: { requirement: string }) => x.requirement === "REQ-004").profile, null);
    const no = p.cli("config", "set", "profiles.careful.match.module", "pagos");
    assert.notEqual(no.status, 0);
    assert.match(out(no), /no module pagos: ausleihe, katalog/);
    // And read back by list, as the studio reads it.
    const list = JSON.parse(p.cli("config", "list", "--json").stdout).config;
    assert.equal(list["profiles.careful.match.module"], "ausleihe");
  } finally {
    p.done();
  }
});

test("REQ-706 SCN-706a: a swarm in sbx set from the command line; an engine it does not know refused", () => {
  const p = library();
  try {
    for (const [k, v] of [
      ["sandbox.engine", "sbx"],
      ["sandbox.kit", "opencode"],
      ["sandbox.allow", "registry.npmjs.org, opencode.ai"],
      ["sandbox.setup", "sh scripts/sandbox-setup.sh"],
    ]) {
      const r = p.cli("config", "set", k, v);
      assert.equal(r.status, 0, `${k}: ${out(r)}`);
    }
    const list = JSON.parse(p.cli("config", "list", "--json").stdout).config;
    assert.equal(list["sandbox.engine"], "sbx");
    assert.equal(list["sandbox.kit"], "opencode");
    assert.deepEqual(list["sandbox.allow"], ["registry.npmjs.org", "opencode.ai"]);
    assert.equal(list["sandbox.setup"], "sh scripts/sandbox-setup.sh");
    // The harness reads it: the doctor runs with it.
    assert.equal(p.cli("harness", "doctor", "--no-probe", "--json").status === null, false);
    assert.notEqual(p.cli("config", "set", "sandbox.engine", "lxc").status, 0);
    assert.equal(JSON.parse(p.cli("config", "get", "sandbox.engine", "--json").stdout).config["sandbox.engine"], "sbx");
  } finally {
    p.done();
  }
});

test("REQ-707 SCN-707a: careful removed — ausleihe back to the default agent; the sandbox removed whole", () => {
  const p = library();
  try {
    p.cli("config", "set", "agent", "claude -p < {prompt_file}");
    p.cli("config", "set", "profiles.careful.agent", "codex exec - < {prompt_file}");
    p.cli("config", "set", "profiles.careful.match.module", "ausleihe");
    p.cli("config", "set", "profiles.fast.agent", "claude -p --model haiku < {prompt_file}");
    const r = p.cli("config", "unset", "profiles.careful", "--json");
    assert.equal(r.status, 0, out(r));
    assert.equal(JSON.parse(r.stdout).removed, true);
    const profiles = read(p.dir, ".harness/profiles.yaml");
    assert.doesNotMatch(profiles, /careful/);
    assert.match(profiles, /fast:/, "the other profile stays");
    const routes = JSON.parse(p.cli("harness", "doctor", "--no-probe", "--json").stdout).doctor.routes;
    assert.equal(routes.find((x: { requirement: string }) => x.requirement === "REQ-006").profile, null);
    // Not set: not an error.
    const again = p.cli("config", "unset", "profiles.careful", "--json");
    assert.equal(again.status, 0);
    assert.equal(JSON.parse(again.stdout).removed, false);
    p.cli("config", "set", "sandbox.engine", "sbx");
    p.cli("config", "set", "sandbox.kit", "shell");
    assert.equal(p.cli("config", "unset", "sandbox").status, 0);
    assert.doesNotMatch(read(p.dir, "harness.config.yaml"), /sandbox/);
    assert.match(read(p.dir, "harness.config.yaml"), /agent:/, "the rest of the file stays");
  } finally {
    p.done();
  }
});
