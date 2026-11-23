/**
 * agent-routing: the agent per module (REQ-688), the agent that drafts set
 * apart (REQ-689), every agent checked before it is used (REQ-690), and a run
 * that checks its agents before it starts (REQ-691). Agents are scripts.
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

type CliResult = { status: number | null; stdout: string; stderr: string };
const cli = (cwd: string, ...args: string[]): CliResult =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    // The agents here are scripts: only REQ-691's test asks them the doctor's question.
    env: { ...process.env, SPECGATE_SKIP_DOCTOR: "1", SPECGATE_PROFILE: "", NO_COLOR: "1" },
  });
const out = (r: CliResult) => `${r.stdout}${r.stderr}`;
const git = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" });
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

function requirement(id: string, title: string) {
  return (
    `### Requirement: ${id} — ${title}\n\n` +
    `The system SHALL ${title.toLowerCase()}.\n\n` +
    `#### Scenario: SCN-${id.slice(4)}a — ${title}\n\n` +
    `- GIVEN a member named Ana\n- WHEN she does it\n- THEN she sees "done"\n\n` +
    `<!-- specgate:trace kind=functional actor=Developer -->\n`
  );
}

/** A library with katalog's REQ-004 and ausleihe's REQ-006 approved, and a log the agents write. */
function library() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-routing-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(dir, { recursive: true });
  w(dir, "package.json", '{"name":"app","version":"1.0.0"}\n');
  w(dir, "lib/index.js", "module.exports = {};\n");
  w(dir, "pass.js", "process.exit(0);\n");
  assert.equal(cli(dir, "init").status, 0);
  w(dir, "harness.config.yaml", 'test_cmd: "node pass.js"\n');
  for (const [change, cap, req, title] of [
    ["draft-katalog", "katalog", "REQ-004", "Add a book"],
    ["draft-ausleihe", "ausleihe", "REQ-006", "Borrow a book"],
  ]) {
    assert.equal(cli(dir, "propose", change, "--capability", cap).status, 0);
    w(dir, `docs/specs/changes/${change}/specs/${cap}/spec.md`, `# Delta — ${cap}\n\n## ADDED Requirements\n\n${requirement(req, title)}`);
    assert.equal(cli(dir, "change", "approve", change).status, 0);
  }
  const log = path.join(parent, "who.log");
  /** An agent that writes its requirement's code and test, and says who it is in the log. */
  const agent = (name: string, extra = "") => {
    const file = path.join(parent, `${name}.js`);
    fs.writeFileSync(
      file,
      [
        'const fs = require("node:fs");',
        extra,
        "const req = process.env.SPECGATE_REQ;",
        `fs.appendFileSync(${JSON.stringify(log)}, req + " ${name}\\n");`,
        'fs.mkdirSync("test", { recursive: true });',
        'fs.writeFileSync(`lib/${req}.js`, `// ${req}\\nmodule.exports = 1;\\n`);',
        'fs.writeFileSync(`test/${req}.test.js`, `// ${req} SCN-${req.slice(4)}a\\nrequire("node:test")("ok", () => {});\\n`);',
      ].join("\n")
    );
    return `"${process.execPath}" "${file}" {prompt_file}`;
  };
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.email", "routing@example.com");
  git(dir, "config", "user.name", "Routing Test");
  const commit = () => {
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "seed");
  };
  return { parent, dir, log, agent, commit, done: () => fs.rmSync(parent, { recursive: true, force: true }) };
}

test("REQ-688 SCN-688a: ausleihe with its own agent — careful builds REQ-006, cheap builds REQ-004", () => {
  const p = library();
  try {
    w(
      p.dir,
      ".harness/profiles.yaml",
      [
        "profiles:",
        "  careful:",
        `    agent: '${p.agent("careful")}'`,
        "    match:",
        "      module: ausleihe",
        "  cheap:",
        `    agent: '${p.agent("cheap")}'`,
        "    match:",
        '      module: "*"',
        "",
      ].join("\n")
    );
    p.commit();
    const r = cli(p.dir, "harness", "run", "--agent", p.agent("default"), "--max-attempts", "1", "--req", "REQ-004", "--req", "REQ-006");
    assert.match(out(r), /2 passed/, out(r));
    const who = fs.readFileSync(p.log, "utf8").trim().split("\n").sort();
    assert.deepEqual(who, ["REQ-004 cheap", "REQ-006 careful"]);
  } finally {
    p.done();
  }
});

test("REQ-689 SCN-689a: drafted by its own agent — writer runs with the drafting guide, not the harness's agent", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-routing-draft-"));
  try {
    const dir = path.join(parent, "app");
    fs.mkdirSync(dir);
    git(dir, "init", "-q");
    assert.equal(cli(dir, "init").status, 0);
    w(
      dir,
      "docs/brief.md",
      [
        "---",
        "product: Shop",
        "surfaces: [api]",
        "actors:",
        "  - { name: Customer, surfaces: [api] }",
        "modules: [pedidos]",
        "---",
        "",
        "# Brief",
        "",
        "Customers place an order and may cancel it before it ships.",
        "",
      ].join("\n")
    );
    const log = path.join(parent, "who.log");
    const agent = (name: string) => {
      const file = path.join(parent, `${name}.js`);
      fs.writeFileSync(
        file,
        [
          'const fs = require("node:fs");',
          'const prompt = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");',
          `fs.appendFileSync(${JSON.stringify(log)}, "${name} " + (/pedidos/.test(prompt) ? "guide" : "no-guide") + "\\n");`,
        ].join("\n")
      );
      return `"${process.execPath}" "${file}" {prompt_file}`;
    };
    w(dir, ".harness/profiles.yaml", `profiles:\n  writer:\n    agent: '${agent("writer")}'\n`);
    w(dir, "harness.config.yaml", `agent: '${agent("builder")}'\ndraft_profile: writer\n`);

    cli(dir, "draft", "pedidos");
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["writer guide"]);

    // --no-agent: the guide for your own agent, nobody run.
    fs.rmSync(log);
    const own = cli(dir, "draft", "pedidos", "--no-agent");
    assert.equal(fs.existsSync(log), false, out(own));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

/** A script agent: prints `says` and exits `code`. */
function talker(parent: string, name: string, says: string, code = 0) {
  const file = path.join(parent, `${name}.js`);
  fs.writeFileSync(file, `console.log(${JSON.stringify(says)}); process.exit(${code});\n`);
  return `"${process.execPath}" "${file}" {prompt_file}`;
}

test("REQ-690 SCN-690a: one agent answers, careful's key has expired — the doctor says which, and exits 1", () => {
  const p = library();
  try {
    const careful = talker(p.parent, "careful", "Error: This API key has expired", 1);
    w(p.dir, ".harness/profiles.yaml", `profiles:\n  careful:\n    agent: '${careful}'\n    match:\n      module: ausleihe\n`);
    w(p.dir, "harness.config.yaml", `test_cmd: "node pass.js"\nagent: '${talker(p.parent, "default", "OK")}'\n`);
    const r = cli(p.dir, "harness", "doctor", "--json");
    assert.equal(r.status, 1, out(r));
    const d = JSON.parse(r.stdout).doctor;
    const route = (id: string) => d.routes.find((x: { requirement: string }) => x.requirement === id);
    assert.equal(route("REQ-006").profile, "careful");
    assert.equal(route("REQ-006").module, "ausleihe");
    assert.equal(route("REQ-004").profile, null);
    const agent = (name: string) => d.agents.find((a: { agent: string }) => a.agent.includes(`${name}.js`));
    assert.equal(agent("default").answered, true);
    assert.equal(agent("careful").answered, false);
    assert.match(agent("careful").reason, /This API key has expired/);
    assert.match(agent("careful").fix, /key/);
    assert.deepEqual(agent("careful").usedBy, ["REQ-006"]);
  } finally {
    p.done();
  }
});

test("REQ-690 SCN-690b: not installed — nosuchagent named, and no agent run", () => {
  const p = library();
  try {
    const ran = path.join(p.parent, "ran.log");
    const quiet = path.join(p.parent, "quiet.js");
    fs.writeFileSync(quiet, `require("fs").appendFileSync(${JSON.stringify(ran)}, "ran\\n"); console.log("OK");\n`);
    w(p.dir, ".harness/profiles.yaml", "profiles:\n  ghost:\n    agent: 'nosuchagent -p {prompt_file}'\n    match:\n      module: ausleihe\n");
    w(p.dir, "harness.config.yaml", `test_cmd: "node pass.js"\nagent: '"${process.execPath}" "${quiet}" {prompt_file}'\n`);
    const r = cli(p.dir, "harness", "doctor", "--no-probe", "--json");
    assert.equal(r.status, 1, out(r));
    const ghost = JSON.parse(r.stdout).doctor.agents.find((a: { agent: string }) => a.agent.startsWith("nosuchagent"));
    assert.equal(ghost.installed, false);
    assert.equal(ghost.program, "nosuchagent");
    assert.match(ghost.reason, /nosuchagent is not installed/);
    assert.equal(fs.existsSync(ran), false, "--no-probe runs no agent");
  } finally {
    p.done();
  }
});

test("REQ-690: the program behind env and its options", () => {
  const { programOf } = require("../../scripts/harness/doctor");
  assert.equal(programOf("env -u OPENCODE_API_KEY opencode run --auto -f {prompt_file}"), "opencode");
  assert.equal(programOf("FOO=1 claude -p"), "claude");
  assert.equal(programOf('"/usr/bin/node" agent.js'), "/usr/bin/node");
});

test("REQ-691 SCN-691a: ausleihe's agent is out of quota — the run refuses naming REQ-006, and no worktree is made", () => {
  const p = library();
  try {
    const careful = talker(p.parent, "careful", "Free usage limit reached", 1);
    w(p.dir, ".harness/profiles.yaml", `profiles:\n  careful:\n    agent: '${careful}'\n    match:\n      module: ausleihe\n`);
    // The default agent answers the doctor, then builds.
    const builder = path.join(p.parent, "builder.js");
    fs.writeFileSync(
      builder,
      'const fs = require("node:fs"); if (/Reply with exactly: OK/.test(fs.readFileSync(process.argv[2], "utf8"))) { console.log("OK"); process.exit(0); }\n'
    );
    w(p.dir, "harness.config.yaml", `test_cmd: "node pass.js"\nagent: '"${process.execPath}" "${builder}" {prompt_file}'\n`);
    p.commit();
    const run = (...extra: string[]) =>
      spawnSync(process.execPath, [CLI, "harness", "run", "--max-attempts", "1", ...extra], {
        cwd: p.dir,
        encoding: "utf8",
        env: { ...process.env, SPECGATE_SKIP_DOCTOR: "", SPECGATE_PROFILE: "", NO_COLOR: "1" },
      });
    const r = run("--req", "REQ-006");
    assert.notEqual(r.status, 0, out(r));
    assert.match(out(r), /harness_agent_unavailable/);
    assert.match(out(r), /REQ-006/);
    assert.match(out(r), /Free usage limit reached/);
    assert.equal(git(p.dir, "worktree", "list").stdout.trim().split("\n").length, 1, "no worktree");
    assert.equal(git(p.dir, "branch", "--list", "harness/*").stdout.trim(), "", "no branch");

    // --skip-doctor starts anyway: careful runs, and fails on its own.
    const anyway = run("--req", "REQ-006", "--skip-doctor");
    assert.doesNotMatch(out(anyway), /harness_agent_unavailable/);
    assert.match(out(anyway), /REQ-006/);
  } finally {
    p.done();
  }
});
