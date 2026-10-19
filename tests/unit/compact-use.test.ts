"use strict";

/**
 * Four verbs, one lifecycle (ADR-0035, change `compact-use`).
 *
 * propose → apply → archive, and status: the daily loop over the gates that
 * already exist. A change's requirements count while it is in flight, apply
 * delivers one through the gate, and archive waits until all of them are.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { SpawnSyncReturns } from "node:child_process";
import type { CliResult } from "../helpers/cli";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(cwd: string, ...args: string[]): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPECGATE_PROFILE: "", NO_COLOR: "1" },
  });
}

/** The closing "Next" step: the command line and the reason under it. */
function nextStep(text: string) {
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(-2).join("\n");
}

function json(r: CliResult) {
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}

function out(r: CliResult) {
  return `${r.stdout}${r.stderr}`;
}

function lastLine(text: string) {
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] || "";
}

/** A Node repository with code, adopted by plain `specgate init`. */
function adopted(testCmd = "node pass.js") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-compact-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"app","version":"1.0.0","scripts":{"test":"node --test test/"}}\n'
  );
  fs.writeFileSync(path.join(dir, "lib", "index.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir, "pass.js"), "process.exit(0);\n");
  fs.writeFileSync(path.join(dir, "fail.js"), "process.exit(1);\n");
  const r = cli(dir, "init");
  assert.equal(r.status, 0, out(r));
  if (testCmd) fs.writeFileSync(path.join(dir, "harness.config.yaml"), `test_cmd: "${testCmd}"\n`);
  return { parent, dir, done: () => fs.rmSync(parent, { recursive: true, force: true }) };
}

function requirement(id: string, title: string, opts: { steps?: string[]; status?: string } = {}) {
  const scn = `SCN-${id.slice(4)}a`;
  const steps = opts.steps || [
    "- GIVEN a customer named Ada",
    "- WHEN the greeting is asked for",
    '- THEN it reads "Hello, Ada"',
  ];
  const trace = opts.status ? ` status=${opts.status}` : "";
  return (
    `### Requirement: ${id} — ${title}\n\n` +
    `The system SHALL ${title.toLowerCase()}.\n\n` +
    `#### Scenario: ${scn} — ${title}\n\n` +
    `${steps.join("\n")}\n\n` +
    `<!-- specgate:trace${trace} kind=functional actor=Customer -->\n`
  );
}

/** An open change with the given delta body, opened as `propose` opens it. */
function openChange(dir: string, id: string, body: string, capability = "greeting") {
  const r = cli(dir, "change", "new", id, "--capability", capability);
  assert.equal(r.status, 0, out(r));
  fs.writeFileSync(
    path.join(dir, "docs/specs/changes", id, "specs", capability, "spec.md"),
    `# Delta — ${capability}\n\n${body}`
  );
}

function added(...reqs: string[]) {
  return `## ADDED Requirements\n\n${reqs.join("\n")}`;
}

function nameInTest(dir: string, file: string, ...ids: string[]) {
  fs.writeFileSync(
    path.join(dir, "test", file),
    `// ${ids.join(" ")}\nrequire("node:test")("greets", () => {});\n`
  );
}

function capabilityFiles(dir: string) {
  const root = path.join(dir, "docs/specs/capabilities");
  if (!fs.existsSync(root)) return "";
  return fs
    .readdirSync(root)
    .sort()
    .map((c: string) => fs.readFileSync(path.join(root, c, "spec.md"), "utf8"))
    .join("\n");
}

function featureFiles(dir: string) {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else found.push(`${path.relative(dir, f)}:${fs.readFileSync(f, "utf8")}`);
    }
  };
  walk(path.join(dir, "features"));
  return found.sort().join("\n");
}

// ── REQ-107 ──────────────────────────────────────────────────────────────────

test("REQ-107 SCN-107a: the default help shows init, the four verbs and check", () => {
  const r = cli(os.tmpdir(), "--help");
  assert.equal(r.status, 0, out(r));
  const shown = [...r.stdout.matchAll(/^\s{4}\S+\s{2}(\S+)\s{2,}/gm)].map((m) => m[1]);
  assert.deepEqual(shown, ["init", "propose", "apply", "status", "archive", "check"]);
  assert.match(r.stdout, /Start here[\s\S]*init[\s\S]*Every day[\s\S]*CI[\s\S]*check/);
  assert.match(lastLine(r.stdout), /specgate --help --all/);

  const all = cli(os.tmpdir(), "--help", "--all").stdout;
  for (const name of ["draft", "done", "change", "new", "add", "plan"]) {
    assert.match(all, new RegExp(`\\s${name}\\s`), `${name} is still in --help --all`);
  }
});

// ── REQ-108 ──────────────────────────────────────────────────────────────────

test("REQ-108 SCN-108a: propose opens a change with a delta skeleton", () => {
  const p = adopted();
  try {
    const r = cli(p.dir, "propose", "add-dynamic-pricing");
    assert.equal(r.status, 0, out(r));
    const change = path.join(p.dir, "docs/specs/changes/add-dynamic-pricing");
    for (const f of [
      "proposal.md",
      "tasks.md",
      "change.yaml",
      "specs/add-dynamic-pricing/spec.md",
    ]) {
      assert.ok(fs.existsSync(path.join(change, f)), `${f} exists`);
    }
    assert.match(fs.readFileSync(path.join(change, "change.yaml"), "utf8"), /req_range: \[REQ-\d+/);
    assert.match(nextStep(r.stdout), /specgate apply/);

    const named = cli(p.dir, "propose", "add-loyalty", "--capability", "loyalty", "--json");
    assert.equal(named.status, 0, out(named));
    assert.ok(
      fs.existsSync(path.join(p.dir, "docs/specs/changes/add-loyalty/specs/loyalty/spec.md"))
    );
  } finally {
    p.done();
  }
});

test("REQ-108 SCN-108b: propose --from-brief is draft", () => {
  const p = adopted();
  try {
    fs.writeFileSync(
      path.join(p.dir, "docs/brief.md"),
      "---\nproduct: Orders\nsurfaces: [api]\nactors:\n  - { name: Clerk, surfaces: [api] }\n" +
        "modules: [billing, shipping]\n---\n\n# Brief\n\nInvoices and parcels for each order.\n"
    );
    const viaPropose = cli(p.dir, "propose", "--from-brief", "--json");
    const viaDraft = cli(p.dir, "draft", "--json");
    assert.equal(viaPropose.status, viaDraft.status, out(viaPropose));
    assert.deepEqual(json(viaPropose), json(viaDraft));
    assert.match(JSON.stringify(json(viaPropose)), /billing/);

    const opened = cli(p.dir, "propose", "--from-brief", "billing");
    assert.equal(opened.status, 0, out(opened));
    assert.ok(fs.existsSync(path.join(p.dir, "docs/specs/changes/draft-billing/DRAFTING.md")));
  } finally {
    p.done();
  }
});

// ── REQ-109 ──────────────────────────────────────────────────────────────────

test("REQ-109 SCN-109a: status shows an open change's requirement, nothing is written", () => {
  const p = adopted();
  try {
    openChange(p.dir, "add-greeting", added(requirement("REQ-002", "Greet a customer by name")));
    const before = { caps: capabilityFiles(p.dir), features: featureFiles(p.dir) };
    const r = cli(p.dir, "status", "--json");
    assert.equal(r.status, 0, out(r));
    const req = json(r).requirements.find((x: { id: string }) => x.id === "REQ-002");
    assert.ok(req, "REQ-002 is listed");
    assert.equal(req.change, "add-greeting");
    assert.notEqual(req.category, "DONE");
    assert.equal(capabilityFiles(p.dir), before.caps);
    assert.equal(featureFiles(p.dir), before.features);
  } finally {
    p.done();
  }
});

test("REQ-109 SCN-109b: check judges an open change's requirement", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-greeting",
      added(requirement("REQ-002", "Greet a customer by name", { steps: [] }))
    );
    const r = cli(p.dir, "check", "--json");
    assert.equal(r.status, 1, out(r));
    const text = JSON.stringify(json(r));
    assert.match(text, /REQ-002|SCN-002a/);
    assert.match(text, /docs\/specs\/changes\/add-greeting\/specs\/greeting\/spec\.md/);
  } finally {
    p.done();
  }
});

test("REQ-109 SCN-109c: the harness delivers an open change's requirement", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-dynamic-pricing",
      added(requirement("REQ-002", "Charge a peak surcharge")),
      "pricing"
    );
    const git = (...args: string[]): SpawnSyncReturns<string> =>
      spawnSync("git", args, { cwd: p.dir, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "harness-test@example.com");
    git("config", "user.name", "Harness Test");
    git("add", "-A");
    git("commit", "-qm", "seed");

    const agent = path.join(p.parent, "agent.js");
    fs.writeFileSync(
      agent,
      'const fs = require("node:fs");\n' +
        // An empty test/ is not committed, so the worktree may not have it.
        'fs.mkdirSync("test", { recursive: true });\n' +
        'fs.writeFileSync("lib/surcharge.js", "module.exports = (x) => x * 1.2;\\n");\n' +
        'fs.writeFileSync("test/surcharge.test.js", "// REQ-002 SCN-002a\\nrequire(\\"node:test\\")(\\"peak\\", () => {});\\n");\n'
    );
    const r = cli(
      p.dir,
      "harness",
      "run",
      "--req",
      "REQ-002",
      "--agent",
      `"${process.execPath}" "${agent}" {prompt_file}`,
      "--max-attempts",
      "1"
    );
    assert.match(out(r), /1 passed/, out(r));
    // The harness never merges: a person reviews the branch and merges it.
    const delta = git(
      "show",
      "harness/REQ-002:docs/specs/changes/add-dynamic-pricing/specs/pricing/spec.md"
    ).stdout;
    assert.match(delta, /specgate:trace status=Implemented/);
    assert.equal(git("merge", "-q", "--no-edit", "harness/REQ-002").status, 0);
    const archived = cli(p.dir, "archive", "add-dynamic-pricing");
    assert.equal(archived.status, 0, out(archived));
  } finally {
    p.done();
  }
});

// ── REQ-110 ──────────────────────────────────────────────────────────────────

test("REQ-110 SCN-110a: apply refuses a requirement no test names", () => {
  const p = adopted();
  try {
    openChange(p.dir, "add-greeting", added(requirement("REQ-002", "Greet a customer by name")));
    const r = cli(p.dir, "apply", "REQ-002");
    assert.equal(r.status, 1, out(r));
    assert.match(out(r), /apply_no_test/);
    assert.equal(
      lastLine(out(r)),
      "fix: write a test that names REQ-002 (and its scenario SCN-002a), then run specgate apply REQ-002"
    );
  } finally {
    p.done();
  }
});

test("REQ-110 SCN-110b: a green gate makes it Implemented and names the next one", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-greeting",
      added(
        requirement("REQ-002", "Greet a customer by name"),
        requirement("REQ-003", "Greet a returning customer")
      )
    );
    nameInTest(p.dir, "greet.test.js", "REQ-002", "SCN-002a");
    const r = cli(p.dir, "apply", "REQ-002");
    assert.equal(r.status, 0, out(r));
    const delta = fs.readFileSync(
      path.join(p.dir, "docs/specs/changes/add-greeting/specs/greeting/spec.md"),
      "utf8"
    );
    assert.match(delta, /REQ-002[\s\S]*?specgate:trace status=Implemented/);
    assert.match(nextStep(r.stdout), /specgate apply REQ-003/);
  } finally {
    p.done();
  }
});

test("REQ-110 SCN-110c: a red gate writes nothing", () => {
  const p = adopted("node fail.js");
  try {
    openChange(p.dir, "add-greeting", added(requirement("REQ-002", "Greet a customer by name")));
    nameInTest(p.dir, "greet.test.js", "REQ-002", "SCN-002a");
    const deltaFile = path.join(p.dir, "docs/specs/changes/add-greeting/specs/greeting/spec.md");
    const before = fs.readFileSync(deltaFile, "utf8");
    const r = cli(p.dir, "apply", "REQ-002");
    assert.equal(r.status, 1, out(r));
    assert.equal(fs.readFileSync(deltaFile, "utf8"), before);
    assert.match(lastLine(out(r)), /^fix: .*node fail\.js/);
  } finally {
    p.done();
  }
});

test("REQ-110 SCN-110d: apply without an id takes the next pending requirement", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-greeting",
      added(
        requirement("REQ-002", "Greet a customer by name"),
        requirement("REQ-003", "Greet a returning customer")
      )
    );
    nameInTest(p.dir, "greet.test.js", "REQ-002", "SCN-002a");
    const next = json(cli(p.dir, "status", "--json")).nextCommand;
    assert.equal(next, "specgate apply REQ-002");
    const r = cli(p.dir, "apply");
    assert.equal(r.status, 0, out(r));
    assert.match(r.stdout.split("\n").find((l: string) => l.trim()) || "", /REQ-002/);
  } finally {
    p.done();
  }
});

// ── REQ-111 ──────────────────────────────────────────────────────────────────

test("REQ-111 SCN-111a: done and apply give the same result", () => {
  const a = adopted();
  const b = adopted();
  try {
    for (const p of [a, b]) {
      openChange(p.dir, "add-greeting", added(requirement("REQ-002", "Greet a customer by name")));
      nameInTest(p.dir, "greet.test.js", "REQ-002", "SCN-002a");
    }
    const viaDone = cli(a.dir, "done", "REQ-002", "--json");
    const viaApply = cli(b.dir, "apply", "REQ-002", "--json");
    assert.equal(viaDone.status, 0, out(viaDone));
    assert.equal(viaApply.status, 0, out(viaApply));
    assert.deepEqual(json(viaDone), json(viaApply));
  } finally {
    a.done();
    b.done();
  }
});

// ── REQ-112 ──────────────────────────────────────────────────────────────────

test("REQ-112 SCN-112a: archive refuses while a requirement is pending", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-dynamic-pricing",
      added(
        requirement("REQ-002", "Charge a peak surcharge", { status: "Implemented" }),
        requirement("REQ-003", "Charge an off-peak discount")
      ),
      "pricing"
    );
    const before = capabilityFiles(p.dir);
    const r = cli(p.dir, "archive", "add-dynamic-pricing");
    assert.equal(r.status, 1, out(r));
    assert.match(out(r), /archive_requirements_pending/);
    assert.match(out(r), /REQ-003/);
    assert.equal(lastLine(out(r)), "fix: specgate apply REQ-003");
    assert.equal(capabilityFiles(p.dir), before);
    assert.ok(fs.existsSync(path.join(p.dir, "docs/specs/changes/add-dynamic-pricing")));

    const forced = cli(p.dir, "archive", "add-dynamic-pricing", "--force");
    assert.equal(forced.status, 1, "--force does not skip delivery");
  } finally {
    p.done();
  }
});

test("REQ-112 SCN-112b: archive merges a delivered change, keeping its statuses", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-dynamic-pricing",
      added(
        requirement("REQ-002", "Charge a peak surcharge"),
        requirement("REQ-003", "Charge an off-peak discount")
      ),
      "pricing"
    );
    nameInTest(p.dir, "pricing.test.js", "REQ-002", "SCN-002a", "REQ-003", "SCN-003a");
    for (const id of ["REQ-002", "REQ-003"]) {
      const r = cli(p.dir, "apply", id);
      assert.equal(r.status, 0, out(r));
    }
    const r = cli(p.dir, "archive", "add-dynamic-pricing");
    assert.equal(r.status, 0, out(r));
    assert.match(out(r), /archive_tasks_incomplete/, "unchecked tasks are a warning");
    const spec = capabilityFiles(p.dir);
    assert.match(spec, /REQ-002[\s\S]*?status=Implemented/);
    assert.match(spec, /REQ-003[\s\S]*?status=Implemented/);
    assert.match(featureFiles(p.dir), /@REQ-002/);
    assert.ok(!fs.existsSync(path.join(p.dir, "docs/specs/changes/add-dynamic-pricing")));
    const archived = fs.readdirSync(path.join(p.dir, "docs/specs/changes/archive"));
    assert.ok(archived.some((d: string) => d.endsWith("-add-dynamic-pricing")));
    assert.equal(cli(p.dir, "check").status, 0);
  } finally {
    p.done();
  }
});

test("REQ-112 SCN-112c: a change that only removes is archived without waiting", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-export",
      added(requirement("REQ-002", "Export orders as CSV")),
      "export"
    );
    nameInTest(p.dir, "export.test.js", "REQ-002", "SCN-002a");
    assert.equal(cli(p.dir, "apply", "REQ-002").status, 0);
    assert.equal(cli(p.dir, "archive", "add-export").status, 0);

    const r0 = cli(p.dir, "change", "new", "retire-legacy-export", "--capability", "export");
    assert.equal(r0.status, 0, out(r0));
    const change = path.join(p.dir, "docs/specs/changes/retire-legacy-export");
    fs.writeFileSync(
      path.join(change, "specs/export/spec.md"),
      "# Delta — export\n\n## REMOVED Requirements\n\n### Requirement: REQ-002 — Export orders as CSV\n\n**Reason**: replaced by the reporting module.\n"
    );
    fs.writeFileSync(
      path.join(change, "change.yaml"),
      fs
        .readFileSync(path.join(change, "change.yaml"), "utf8")
        .replace("retire_capabilities: false", "retire_capabilities: true")
    );
    fs.writeFileSync(
      path.join(change, "tasks.md"),
      "# Tasks\n\n- [x] 1.1 Remove the requirement\n"
    );
    const r = cli(p.dir, "archive", "retire-legacy-export");
    assert.equal(r.status, 0, out(r));
  } finally {
    p.done();
  }
});

// ── REQ-113 ──────────────────────────────────────────────────────────────────

test("REQ-113 SCN-113a: one fix line, the same in the JSON", () => {
  const p = adopted();
  try {
    openChange(
      p.dir,
      "add-dynamic-pricing",
      added(requirement("REQ-002", "Charge a peak surcharge")),
      "pricing"
    );
    const plain = out(cli(p.dir, "archive", "add-dynamic-pricing"));
    const fixLines = plain.split("\n").filter((l) => l.trim().startsWith("fix:"));
    assert.equal(fixLines.length, 1, plain);
    assert.equal(lastLine(plain), fixLines[0].trim());
    const doc = json(cli(p.dir, "archive", "add-dynamic-pricing", "--json"));
    const fixes = doc.status
      .filter((d: { severity: string }) => d.severity === "error")
      .map((d: { fix: string }) => d.fix);
    assert.deepEqual(fixes, [fixLines[0].trim().replace(/^fix: /, "")]);
    assert.doesNotMatch(fixes[0], /\n/);
  } finally {
    p.done();
  }
});

// ── REQ-114 ──────────────────────────────────────────────────────────────────

test("REQ-114 SCN-114a: the four verbs and check write one JSON document", () => {
  const p = adopted();
  try {
    openChange(p.dir, "add-greeting", added(requirement("REQ-002", "Greet a customer by name")));
    const runs = [
      cli(p.dir, "propose", "add-loyalty", "--json"),
      cli(p.dir, "apply", "REQ-002", "--json"),
      cli(p.dir, "status", "--json"),
      cli(p.dir, "archive", "add-greeting", "--json"),
      cli(p.dir, "check", "--json"),
    ];
    for (const r of runs) {
      const doc = JSON.parse(r.stdout);
      assert.equal(typeof doc, "object", r.stdout);
      assert.ok(Array.isArray(doc.status), `a status array in ${r.stdout.slice(0, 200)}`);
      assert.ok(Object.keys(doc).length >= 2, `the command's own key in ${r.stdout.slice(0, 200)}`);
    }
  } finally {
    p.done();
  }
});

// ── REQ-115 ──────────────────────────────────────────────────────────────────

test("REQ-115 SCN-115a: a script written for 0.20 keeps working", () => {
  const p = adopted();
  try {
    const opened = cli(p.dir, "change", "new", "add-greeting", "--capability", "greeting");
    assert.equal(opened.status, 0, out(opened));
    fs.writeFileSync(
      path.join(p.dir, "docs/specs/changes/add-greeting/specs/greeting/spec.md"),
      `# Delta — greeting\n\n${added(requirement("REQ-002", "Greet a customer by name"))}`
    );
    nameInTest(p.dir, "greet.test.js", "REQ-002", "SCN-002a");
    const closed = cli(p.dir, "done", "REQ-002");
    assert.equal(closed.status, 0, out(closed));

    for (const [args, verb] of [
      [["change", "archive", "--help"], "archive"],
      [["change", "new", "--help"], "propose"],
      [["draft", "--help"], "propose --from-brief"],
      [["done", "--help"], "apply"],
    ] as Array<[string[], string]>) {
      const help =
        cli(p.dir, ...args)
          .stdout.split("\n")
          .find((l: string) => l.trim()) || "";
      assert.match(
        help,
        new RegExp(`Same as specgate ${verb.replace(/-/g, "\\-")}\\b`),
        args.join(" ")
      );
    }
  } finally {
    p.done();
  }
});

// ── REQ-116 ──────────────────────────────────────────────────────────────────

test("REQ-116 SCN-116a: one loop, four verbs", () => {
  const p = adopted("npm test");
  try {
    const proposed = cli(p.dir, "propose", "add-greeting");
    assert.equal(proposed.status, 0, out(proposed));
    const range = /req_range: \[(REQ-\d+)/.exec(
      fs.readFileSync(path.join(p.dir, "docs/specs/changes/add-greeting/change.yaml"), "utf8")
    )![1];
    fs.writeFileSync(
      path.join(p.dir, "docs/specs/changes/add-greeting/specs/add-greeting/spec.md"),
      `# Delta — add-greeting\n\n${added(requirement(range, "Greet a customer by name"))}`
    );
    fs.writeFileSync(
      path.join(p.dir, "lib/greet.js"),
      "module.exports = (name) => `Hello, ${name}`;\n"
    );
    fs.writeFileSync(
      path.join(p.dir, "test/greet.test.js"),
      `// ${range} SCN-${range.slice(4)}a\n` +
        'const test = require("node:test");\nconst assert = require("node:assert");\n' +
        'test("greets", () => assert.equal(require("../lib/greet")("Ada"), "Hello, Ada"));\n'
    );
    for (const args of [["status"], ["apply"], ["archive", "add-greeting"]]) {
      const r = cli(p.dir, ...args);
      assert.equal(r.status, 0, `${args.join(" ")}: ${out(r)}`);
    }
    assert.match(capabilityFiles(p.dir), new RegExp(`${range}[\\s\\S]*?status=Implemented`));
    const pending = json(cli(p.dir, "status", "--json")).requirements.filter(
      (x: { category: string }) => x.category !== "DONE"
    );
    assert.ok(!pending.some((x: { id: string }) => x.id === range), JSON.stringify(pending));
  } finally {
    p.done();
  }
});
