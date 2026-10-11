"use strict";

/**
 * `specgate draft` and `specgate draft <module>` — the brief-first path
 * (#93, #94). A person who starts from a plan saves it as docs/brief.md and
 * repeats one command; an agent gets everything it needs from DRAFTING.md.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { briefModules } = require("../../packages/core/src/domain/DraftChecklist");
const { agentInvocation } = require("../../scripts/draft/confined-agent");
const { STEPS } = require("../../scripts/agents/commands");
const { slashCommandBody } = require("../../scripts/agents/init");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const BRIEF = `---
product: Court bookings
surfaces: [api, web]
actors:
  - { name: Member, surfaces: [api, web] }
modules: [bookings, coupons]
---

# Brief

Members book a court for one hour. A court cannot be booked twice for the same hour.
`;

/** The draft an agent would write for `bookings`: one value the brief never gave. */
const DRAFT = (extra = "") => `# Delta — bookings

## ADDED Requirements

### Requirement: REQ-002 — A member books a court for one hour

<!-- csda:trace actor=Member kind=functional -->

The system SHALL let a member book a free court for one hour.

> Brief: "Members book a court for one hour."

#### Scenario: SCN-002 — Booking through the API

- GIVEN the centre court is free
- WHEN the member sends POST /api/bookings for the centre court
- THEN the booking lasts one hour${extra}

#### Scenario: SCN-003 — Booking on the screen

- GIVEN the centre court is free
- WHEN the member opens the courts and taps the centre court
- THEN the member sees the booking for one hour
`;

const git = (dir, ...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });

function project(t, { brief = BRIEF, init = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-brief-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (init) fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  if (brief !== null) {
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "brief.md"), brief);
  }
  const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: "utf8" });
  return { dir, cli };
}

const change = (dir, m = "bookings") => path.join(dir, "docs", "specs", "changes", `draft-${m}`);

test("briefModules reads the front matter, inline or as a list", () => {
  assert.deepEqual(briefModules(BRIEF), ["bookings", "coupons"]);
  assert.deepEqual(briefModules("---\nmodules:\n  - curriculum\n  - 'live-classes'\n---\n"), [
    "curriculum",
    "live-classes",
  ]);
  assert.deepEqual(briefModules("# no front matter"), []);
});

test("specgate draft with no brief says where to put one", (t) => {
  const { cli } = project(t, { brief: null });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Save your plan or brief as docs\/brief\.md/);
});

test("specgate draft lists the brief's modules and names the next", (t) => {
  const { cli } = project(t);
  const r = cli("draft");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bookings\s+not started/);
  assert.match(r.stdout, /Next {2}specgate draft bookings/);
  const doc = JSON.parse(cli("draft", "--json").stdout).draft;
  assert.deepEqual(
    doc.modules.map((m) => [m.module, m.state]),
    [
      ["bookings", "not started"],
      ["coupons", "not started"],
    ]
  );
});

test("a brief without modules gets a front matter to paste, not a guess", (t) => {
  const { cli } = project(t, { brief: "# Plan\n\nMembers book courts.\n" });
  const r = cli("draft");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /modules: \[<first-module>, <second-module>\]/);
});

test("draft <module> opens the draft linked to the brief, with its guide", (t) => {
  const { dir, cli } = project(t);
  const r = cli("draft", "bookings");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout,
    /Draft the bookings module: follow docs\/specs\/changes\/draft-bookings\/DRAFTING\.md/
  );
  assert.match(r.stdout, /--agent "claude -p"/);

  const yaml = fs.readFileSync(path.join(change(dir), "change.yaml"), "utf8");
  assert.match(yaml, /^brief: docs\/brief\.md$/m);
  assert.match(yaml, /req_range: \[REQ-001, REQ-010\]/, "ten ids by default");
  assert.ok(fs.existsSync(path.join(change(dir), "specs", "bookings", "spec.md")));
  assert.ok(!fs.existsSync(path.join(change(dir), "tasks.md")), "a draft has no tasks to tick");

  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, /only the bookings module/);
  assert.match(guide, /`REQ-001` … `REQ-010`/);
  assert.match(guide, /\*\*Member\*\* — an API scenario .*; a web scenario/);
  assert.match(guide, /\| # \| Assumption \| Used in \|/, "the format D6 reads");
  assert.match(guide, /\| # \| Question \| Blocks \|/, "the format D7 reads");
  assert.match(guide, /status="Needs Clarification"/);
  assert.match(guide, /specgate draft bookings/);
});

test("draft <module> again: the placeholder, then findings, then ready", (t) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");

  const unwritten = cli("draft", "bookings");
  assert.equal(unwritten.status, 1);
  assert.match(unwritten.stdout, /still the placeholder/);

  const spec = path.join(change(dir), "specs", "bookings", "spec.md");
  fs.writeFileSync(spec, DRAFT(', and costs "12" euros'));
  const red = cli("draft", "bookings", "--json");
  assert.equal(red.status, 1);
  const doc = JSON.parse(red.stdout);
  assert.equal(doc.draft.state, "drafting");
  assert.ok(doc.status.some((d) => d.code === "D6_unlisted_value" && d.message.includes('"12"')));

  fs.writeFileSync(spec, DRAFT());
  const green = cli("draft", "bookings");
  assert.equal(green.status, 0, green.stdout);
  assert.match(green.stdout, /Ready to review/);
  assert.match(green.stdout, /specgate change archive draft-bookings/);
  assert.match(cli("draft").stdout, /bookings\s+ready to review/);
});

test("archiving a ready draft needs no task boxes, and points at the next module", (t) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");
  fs.writeFileSync(path.join(change(dir), "specs", "bookings", "spec.md"), DRAFT());
  const archived = cli("change", "archive", "draft-bookings");
  assert.equal(archived.status, 0, archived.stdout + archived.stderr);
  assert.match(archived.stdout, /Next: specgate draft/);
  assert.doesNotMatch(archived.stdout, /will fail until the tests exist/, "#92");
  const overview = cli("draft");
  assert.match(overview.stdout, /bookings\s+archived/);
  assert.match(overview.stdout, /Next {2}specgate draft coupons/);
  assert.match(cli("draft", "bookings").stdout, /already drafted and archived/);
});

test("draft <module> outside a Specgate project asks for init first", (t) => {
  const { cli } = project(t, { init: false });
  const r = cli("draft", "bookings");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /specgate init/);
});

test("a module the brief does not list is drafted, with a note", (t) => {
  const { cli } = project(t);
  const r = cli("draft", "payments");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /payments is not among the brief's modules/);
});

test("the agent gets the prompt on stdin, or in a file when the command asks", () => {
  assert.deepEqual(agentInvocation("claude -p", "/tmp/p.md"), {
    command: "claude -p",
    stdin: true,
  });
  assert.deepEqual(agentInvocation("opencode run {prompt_file}", "/tmp/p.md"), {
    command: "opencode run /tmp/p.md",
    stdin: false,
  });
});

/** A stand-in agent: writes the draft, then strays — into the brief and a new file. */
const STUB = `
const fs = require("fs");
const prompt = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");
if (!/Draft the bookings module/.test(prompt) || !/assumptions\\.md/.test(prompt)) process.exit(3);
fs.writeFileSync("docs/specs/changes/draft-bookings/specs/bookings/spec.md", process.env.DRAFT_TEXT);
fs.writeFileSync("stray.txt", "not the agent's to write\\n");
fs.appendFileSync("docs/brief.md", "\\nThe agent rewrote the brief.\\n");
`;

const AGENT_COMMANDS: Array<[string, (stub: string) => string]> = [
  ["stdin", (stub) => `node ${stub}`],
  ["{prompt_file}", (stub) => `node ${stub} {prompt_file}`],
];

for (const [label, command] of AGENT_COMMANDS) {
  test(`--agent (${label}) drafts, undoes what it wrote elsewhere, keeps the person's edits`, (t) => {
    const { dir } = project(t);
    git(dir, "init", "-q");
    git(
      dir,
      "-c",
      "user.email=t@t",
      "-c",
      "user.name=t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "start"
    );
    // Uncommitted on purpose: the person has just written their brief.
    const stub = path.join(dir, "..", `stub-${path.basename(dir)}.js`);
    fs.writeFileSync(stub, STUB);
    t.after(() => fs.rmSync(stub, { force: true }));

    const r = spawnSync(process.execPath, [CLI, "draft", "bookings", "--agent", command(stub)], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, DRAFT_TEXT: DRAFT() },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Undone — the agent wrote outside the draft: .*docs\/brief\.md/);
    assert.match(r.stdout, /Ready to review/);
    assert.equal(fs.existsSync(path.join(dir, "stray.txt")), false, "the agent's new file is gone");
    assert.equal(
      fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8"),
      BRIEF,
      "the brief is the person's, uncommitted edit and all"
    );
    assert.match(
      fs.readFileSync(path.join(change(dir), "specs", "bookings", "spec.md"), "utf8"),
      /REQ-002 — A member books a court/
    );
  });
}

test("--agent without git refuses, and says how to go on", (t) => {
  const { cli } = project(t);
  const r = cli("draft", "bookings", "--agent", "true");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /draft_agent_needs_git/);
});

test("status points at the brief's next module while nothing real is pending", (t) => {
  const { dir, cli } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  const init = cli("init", "--no-capabilities");
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const doc = JSON.parse(cli("status", "--json").stdout);
  assert.equal(doc.nextCommand, "specgate draft bookings");
  assert.deepEqual(
    doc.brief.modules.map((m) => m.state),
    ["not started", "not started"]
  );
  assert.match(
    cli("status").stdout,
    /Brief {2}docs\/brief\.md · 0 of 2 module\(s\) drafted · next: bookings/
  );
});

test("init names specgate draft when the brief is already there", (t) => {
  const { dir } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  const r = spawnSync(process.execPath, [CLI, "init", "--no-capabilities"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /specgate draft {15}# docs\/brief\.md → requirements/);
});

test("the draft slash command takes the module as its argument", () => {
  const step = STEPS.find((s) => s.name === "draft");
  assert.ok(step, "a /specgate:draft step");
  const body = slashCommandBody(step);
  assert.match(body, /^argument-hint: <module>$/m);
  assert.match(body, /^specgate draft \$ARGUMENTS$/m);
  assert.match(body, /Do not archive/);
  // Every other tool reads the plain form.
  assert.ok(step.run.includes("specgate draft <module>"));
});
