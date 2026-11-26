/**
 * sandbox-swarm: the agent in its module's sandbox (REQ-698), the hosts each
 * sandbox may reach (REQ-699), archive removing a change's sandboxes
 * (REQ-700), and no sandbox left behind unseen (REQ-701). `sbx` is a fake.
 */
import { posixTest as test } from "../helpers/posix";
import assert from "node:assert/strict";
import { fakeSbx } from "../helpers/fake-sbx";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

type CliResult = { status: number | null; stdout: string; stderr: string };
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

const SANDBOX = [
  "sandbox:",
  "  engine: sbx",
  "  kit: opencode",
  "  allow:",
  "    - registry.npmjs.org",
  "    - opencode.ai",
  '  setup: "touch .installed"',
].join("\n");

/** A library: katalog's REQ-004, ausleihe's REQ-006 and REQ-007, approved; agents in sbx. */
function library(extraEnv: Record<string, string> = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-swarm-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(dir);
  const sbx = fakeSbx();
  const cli = (...args: string[]): CliResult =>
    spawnSync(process.execPath, [CLI, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        SPECGATE_SBX: sbx.bin,
        SPECGATE_SKIP_DOCTOR: "1",
        SPECGATE_PROFILE: "",
        NO_COLOR: "1",
        ...extraEnv,
      },
    });
  w(dir, "package.json", '{"name":"app","version":"1.0.0"}\n');
  w(dir, "lib/index.js", "module.exports = {};\n");
  w(dir, "pass.js", "process.exit(0);\n");
  assert.equal(cli("init").status, 0);
  const changes: Array<[string, string, Array<[string, string]>]> = [
    ["draft-katalog", "katalog", [["REQ-004", "Add a book"]]],
    [
      "draft-ausleihe",
      "ausleihe",
      [
        ["REQ-006", "Borrow a book"],
        ["REQ-007", "Return a book"],
      ],
    ],
  ];
  for (const [change, cap, reqs] of changes) {
    assert.equal(cli("propose", change, "--capability", cap).status, 0);
    w(
      dir,
      `docs/specs/changes/${change}/specs/${cap}/spec.md`,
      `# Delta — ${cap}\n\n## ADDED Requirements\n\n${reqs.map(([id, t]) => requirement(id, t)).join("\n")}`
    );
    assert.equal(cli("change", "approve", change).status, 0);
  }
  const agent = path.join(parent, "agent.js");
  fs.writeFileSync(
    agent,
    [
      'const fs = require("node:fs");',
      "const req = process.env.SPECGATE_REQ;",
      'fs.mkdirSync("test", { recursive: true });',
      "fs.writeFileSync(`lib/${req}.js`, `// ${req}\\nmodule.exports = 1;\\n`);",
      'fs.writeFileSync(`test/${req}.test.js`, `// ${req} SCN-${req.slice(4)}a\\nrequire("node:test")("ok", () => {});\\n`);',
    ].join("\n")
  );
  w(
    dir,
    "harness.config.yaml",
    `test_cmd: "node pass.js"\nagent: '"${process.execPath}" "${agent}" {prompt_file}'\n${SANDBOX}\n`
  );
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.email", "swarm@example.com");
  git(dir, "config", "user.name", "Swarm Test");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
  const registry = () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, ".harness", "sandboxes.json"), "utf8"));
    } catch {
      return [];
    }
  };
  return {
    dir,
    sbx,
    cli,
    registry,
    done: () => {
      for (const r of registry()) fs.rmSync(r.workspace, { recursive: true, force: true });
      fs.rmSync(parent, { recursive: true, force: true });
    },
  };
}

test("REQ-698 SCN-698a: two requirements of ausleihe, one sandbox — set up once, both agents in it", () => {
  const p = library();
  try {
    const r = p.cli(
      "harness",
      "run",
      "--max-attempts",
      "1",
      "--req",
      "REQ-006",
      "--req",
      "REQ-007"
    );
    assert.match(out(r), /2 passed/, out(r));
    const calls = p.sbx.calls();
    const creates = calls.filter((c) => c[0] === "create");
    assert.equal(creates.length, 1, JSON.stringify(creates));
    assert.ok(creates[0].includes("sg-draft-ausleihe-ausleihe"));
    assert.ok(creates[0].includes("opencode"));
    const execs = calls.filter((c) => c[0] === "exec");
    assert.equal(
      execs.filter((c) => c.join(" ").includes("touch .installed")).length,
      1,
      "setup ran once"
    );
    const agents = execs.filter((c) => c.join(" ").includes("agent.js"));
    assert.equal(agents.length, 2, "both agents ran in the sandbox");
    for (const [req, c] of [
      ["REQ-006", agents[0]],
      ["REQ-007", agents[1]],
    ] as const) {
      const cwd = c[c.indexOf("-w") + 1];
      assert.match(cwd, new RegExp(`specgate-harness-${req}-`), "in its own worktree");
      assert.ok(c.includes("sg-draft-ausleihe-ausleihe"));
    }
    const [rec] = p.registry();
    assert.equal(rec.name, "sg-draft-ausleihe-ausleihe");
    assert.equal(rec.change, "draft-ausleihe");
    assert.equal(rec.module, "ausleihe");
  } finally {
    p.done();
  }
});

test("REQ-699 SCN-699a: two hosts opened for that sandbox alone, twenty-nine from the kit, and said", () => {
  const p = library();
  try {
    const r = p.cli("harness", "run", "--max-attempts", "1", "--req", "REQ-006");
    assert.match(
      out(r),
      /sg-draft-ausleihe-ausleihe may reach 31 hosts: 2 yours, 29 from the kit opencode/,
      out(r)
    );
    const allows = p.sbx.calls().filter((c) => c[0] === "policy" && c[1] === "allow");
    assert.deepEqual(
      allows.map((c) => [c[c.indexOf("--sandbox") + 1], c[c.length - 1]]),
      [
        ["sg-draft-ausleihe-ausleihe", "registry.npmjs.org"],
        ["sg-draft-ausleihe-ausleihe", "opencode.ai"],
      ]
    );
    const [rec] = p.registry();
    assert.deepEqual(
      rec.rules.map((x: { host: string }) => x.host),
      ["registry.npmjs.org", "opencode.ai"]
    );
    assert.ok(
      rec.rules.every((x: { id: string }) => /^0{8}-/.test(x.id)),
      "the rules' ids are kept"
    );
    assert.equal(rec.kitHosts.length, 29);
  } finally {
    p.done();
  }
});

test("REQ-700 SCN-700a: archiving draft-ausleihe removes its sandbox and its 2 rules; katalog's stays", () => {
  const p = library();
  try {
    const run = p.cli(
      "harness",
      "run",
      "--max-attempts",
      "1",
      "--req",
      "REQ-006",
      "--req",
      "REQ-007",
      "--req",
      "REQ-004"
    );
    assert.match(out(run), /3 passed/, out(run));
    assert.equal(p.registry().length, 2);
    // ausleihe delivered: its branches merged by a person, then applied.
    for (const req of ["REQ-006", "REQ-007"]) {
      const m = git(
        p.dir,
        "-c",
        "user.email=s@e",
        "-c",
        "user.name=s",
        "merge",
        "--no-edit",
        "-q",
        `harness/${req}`
      );
      assert.equal(m.status, 0, m.stdout + m.stderr);
      const a = p.cli("apply", req);
      assert.equal(a.status, 0, out(a));
    }
    const r = p.cli("archive", "draft-ausleihe", "--json");
    assert.equal(r.status, 0, out(r));
    assert.deepEqual(JSON.parse(r.stdout).archive.sandboxesRemoved, ["sg-draft-ausleihe-ausleihe"]);
    const st = p.sbx.state();
    assert.deepEqual(Object.keys(st.sandboxes), ["sg-draft-katalog-katalog"]);
    assert.deepEqual(
      st.rules.map((x: { sandbox: string }) => x.sandbox),
      ["sg-draft-katalog-katalog", "sg-draft-katalog-katalog"],
      "ausleihe's 2 rules are gone"
    );
    assert.deepEqual(
      p.registry().map((x: { name: string }) => x.name),
      ["sg-draft-katalog-katalog"]
    );
  } finally {
    p.done();
  }
});

test("REQ-701 SCN-701a: one left behind, one stray — --prune removes both, the open change's stays", () => {
  const p = library();
  try {
    assert.match(
      out(p.cli("harness", "run", "--max-attempts", "1", "--req", "REQ-004")),
      /1 passed/
    );
    // A sandbox of a change archived long ago, and one nobody recorded.
    const recs = p.registry();
    const old = {
      ...recs[0],
      name: "sg-old-pagos",
      change: "old",
      module: "pagos",
      workspace: path.join(os.tmpdir(), "specgate-sbx-sg-old-pagos"),
      rules: [],
    };
    fs.writeFileSync(
      path.join(p.dir, ".harness", "sandboxes.json"),
      JSON.stringify([...recs, old])
    );
    p.sbx.add("sg-old-pagos");
    p.sbx.add("sg-stray");

    const list = p.cli("harness", "sandboxes", "--json");
    assert.equal(list.status, 0, out(list));
    const doc = JSON.parse(list.stdout).sandboxes;
    assert.deepEqual(
      doc.strays.map((s: { name: string }) => s.name),
      ["sg-stray"]
    );
    assert.equal(
      doc.recorded.find((r: { name: string }) => r.name === "sg-old-pagos").changeOpen,
      false
    );

    const pruned = p.cli("harness", "sandboxes", "--prune", "--json");
    assert.deepEqual(JSON.parse(pruned.stdout).sandboxes.removed.sort(), [
      "sg-old-pagos",
      "sg-stray",
    ]);
    assert.deepEqual(Object.keys(p.sbx.state().sandboxes), ["sg-draft-katalog-katalog"]);
    assert.deepEqual(
      p.registry().map((x: { name: string }) => x.name),
      ["sg-draft-katalog-katalog"]
    );
  } finally {
    p.done();
  }
});

test("REQ-698: two requirements of one module at once — one sandbox made, both agents in it", () => {
  // Making a sandbox takes a moment: both workers ask for it at the same time.
  const p = library({ FAKE_SBX_CREATE_MS: "1500" });
  try {
    const gate = path.join(p.dir, ".specgate", "gate.yaml");
    fs.writeFileSync(
      gate,
      `${fs.readFileSync(gate, "utf8").replace(/\n*$/, "\n")}trust: { ausleihe: 4, katalog: 4 }\n`
    );
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "trust");
    const r = p.cli("harness", "run", "--max-attempts", "1", "--concurrency", "2");
    assert.match(out(r), /3 passed/, out(r));
    const creates = p.sbx
      .calls()
      .filter((c) => c[0] === "create")
      .map((c) => c[c.indexOf("--name") + 1]);
    assert.deepEqual(creates.sort(), ["sg-draft-ausleihe-ausleihe", "sg-draft-katalog-katalog"]);
  } finally {
    p.done();
  }
});

test("REQ-698: a sandbox that cannot be made is the requirement's reason, not a silent worker", () => {
  const p = library({ FAKE_SBX_FAIL_CREATE: "Docker is not running" });
  try {
    const r = p.cli("harness", "run", "--max-attempts", "1", "--req", "REQ-006");
    assert.match(
      out(r),
      /sandbox: sbx could not create the sandbox sg-draft-ausleihe-ausleihe: ERROR: Docker is not running/,
      out(r)
    );
    assert.doesNotMatch(out(r), /Worker produced no report/);
  } finally {
    p.done();
  }
});

test("REQ-698: the setup is a script of the project — it runs once, in the first worktree, where the script is", () => {
  const p = library();
  try {
    w(p.dir, "scripts/sandbox-setup.sh", "echo set-up > .sandbox-ready\n");
    const cfg = path.join(p.dir, "harness.config.yaml");
    fs.writeFileSync(
      cfg,
      fs
        .readFileSync(cfg, "utf8")
        .replace('setup: "touch .installed"', 'setup: "sh scripts/sandbox-setup.sh"')
    );
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-qm", "a setup script");
    const r = p.cli(
      "harness",
      "run",
      "--max-attempts",
      "1",
      "--req",
      "REQ-006",
      "--req",
      "REQ-007"
    );
    assert.match(out(r), /2 passed/, out(r));
    const setups = p.sbx
      .calls()
      .filter((c) => c[0] === "exec" && c.join(" ").includes("sandbox-setup.sh"));
    assert.equal(setups.length, 1, "once for the module");
    assert.match(
      setups[0][setups[0].indexOf("-w") + 1],
      /specgate-harness-REQ-006-/,
      "in the first worktree"
    );
    assert.equal(p.registry()[0].setUp, true);
  } finally {
    p.done();
  }
});
