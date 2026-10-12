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

<!-- specgate:trace actor=Member kind=functional -->

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
  assert.match(r.stdout, /Save it as docs\/brief\.md, then {2}specgate draft/);
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

test("a brief without front matter gets the block to paste, not a guess", (t) => {
  const { cli } = project(t, { brief: "# Plan\n\nMembers book courts.\n" });
  const r = cli("draft");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /The whole block, to paste at the top and change/);
  assert.doesNotMatch(r.stdout, /Modules\n/, "no modules are invented");
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

// ── Writing the brief (#95) ─────────────────────────────────────────────────

const { BRIEF_TEMPLATE, checkFrontMatter, briefBody } = require("../../scripts/draft/brief-setup");
const { actorSurfaces } = require("../../packages/core/src/domain/DraftChecklist");

const NOTES = `# Lingo

Lingo is an online language school. Students learn on the web or on their phone.
`;

const codesOf = (brief: string) => checkFrontMatter(brief).map((p: any) => p.code);

test("no brief: what a brief is, and --new-brief to start one", (t) => {
  const { cli } = project(t, { brief: null });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /your own plan, a\s+client's email, meeting notes/);
  assert.match(r.stdout, /what you don't know yet — those become questions/);
  assert.match(r.stdout, /specgate draft --new-brief/);
  const doc = JSON.parse(cli("draft", "--json").stdout);
  assert.equal(doc.status[0].code, "draft_no_brief");
});

test("--new-brief writes the template, and never over a brief that exists", (t) => {
  const { dir, cli } = project(t, { brief: null });
  const r = cli("draft", "--new-brief");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const file = path.join(dir, "docs", "brief.md");
  assert.equal(fs.readFileSync(file, "utf8"), BRIEF_TEMPLATE);
  for (const section of [
    "## What the product is",
    "## Who uses it and how",
    "## What each one must be able to do",
    "## Rules and numbers you already know",
    "## What you don't know yet",
    "## Out of scope",
  ]) {
    assert.ok(BRIEF_TEMPLATE.includes(section), section);
  }
  fs.writeFileSync(file, NOTES);
  const again = cli("draft", "--new-brief");
  assert.equal(again.status, 1);
  assert.match(again.stdout + again.stderr, /already exists — nothing was written/);
  assert.equal(fs.readFileSync(file, "utf8"), NOTES, "the brief is untouched");
});

test("the template's placeholders are reported one field at a time", (t) => {
  const { cli } = project(t, { brief: BRIEF_TEMPLATE });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /needs 4 fix\(es\)/);
  assert.match(r.stdout, /`surfaces:` still says <surface>, <surface>/);
  // The commented examples are not actors the person declared.
  assert.equal(actorSurfaces(BRIEF_TEMPLATE).has("teacher"), false);
});

test("a brief without front matter gets every field explained, and the agent's guide", (t) => {
  const { dir, cli } = project(t, { brief: NOTES });
  const r = cli("draft");
  assert.equal(r.status, 0, r.stderr);
  for (const field of ["product ", "surfaces ", "actors ", "modules "]) {
    assert.match(r.stdout, new RegExp(`^  ${field}`, "m"), field);
  }
  assert.match(r.stdout, /Any of: api, web, mobile, desktop/);
  assert.match(r.stdout, /25 requirements at\s+most/);
  assert.match(r.stdout, /not a single screen/);
  assert.match(
    r.stdout,
    /Propose the front matter of docs\/brief\.md: follow docs\/specs\/BRIEF-SETUP\.md/
  );
  assert.match(r.stdout, /specgate draft --agent "claude -p"/);
  const guide = fs.readFileSync(path.join(dir, "docs", "specs", "BRIEF-SETUP.md"), "utf8");
  assert.match(guide, /Change nothing below the front matter/);
  assert.match(guide, /Never invent an actor, a surface or a module/);
  assert.match(guide, /# check:/);
  assert.match(guide, /Do not run `specgate draft <module>`/);
});

test("front matter problems, in plain words, each with its fix", () => {
  const fm = (body: string) => `---\n${body}\n---\n\nThe brief.\n`;
  assert.deepEqual(
    codesOf(
      fm(
        "product: Lingo\nsurfaces: [web, tablet]\nactors:\n  - { name: Teacher, surfaces: [web, mobile] }\n  - { name: Admin }\nmodules: [courses, Live classes, courses]"
      )
    ).sort(),
    [
      "brief_actor_without_surfaces",
      "brief_module_name",
      "brief_module_twice",
      "brief_surface_not_in_product",
      "brief_unknown_surface",
    ]
  );
  assert.deepEqual(codesOf(fm("surfaces: [web]")).sort(), [
    "brief_no_actors",
    "brief_no_modules",
    "brief_no_product",
  ]);
  const fixes = checkFrontMatter(
    fm("product: X\nactors:\n  - { name: A, surfaces: [web] }\nmodules: [Live classes]")
  );
  assert.match(fixes[0].fix, /live-classes/);
  assert.deepEqual(
    codesOf(
      fm(
        "product: X\nsurfaces: [api, web]\nactors:\n  - { name: A, surfaces: [web] }\nmodules: [a, b]"
      )
    ),
    []
  );
});

/** A stand-in agent proposing a front matter; with MANGLE it also rewrites the body. */
const FM_STUB = `
const fs = require("fs");
const prompt = fs.readFileSync(0, "utf8");
if (!/Change nothing below the front matter/.test(prompt)) process.exit(3);
const body = fs.readFileSync("docs/brief.md", "utf8");
const fm = "---\\nproduct: Lingo\\nsurfaces: [web, mobile]\\nactors:\\n  - { name: Student, surfaces: [web, mobile] }\\nmodules: [courses, lessons]\\n---\\n\\n";
fs.writeFileSync("docs/brief.md", fm + (process.env.MANGLE ? body.replace("online", "offline") : body));
fs.writeFileSync("stray.txt", "x\\n");
`;

function withGit(t: any, brief: string) {
  const p = project(t, { brief });
  git(p.dir, "init", "-q");
  git(
    p.dir,
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
  const stub = path.join(p.dir, "..", `fm-${path.basename(p.dir)}.js`);
  fs.writeFileSync(stub, FM_STUB);
  t.after(() => fs.rmSync(stub, { force: true }));
  const agent = (env = {}) =>
    spawnSync(process.execPath, [CLI, "draft", "--agent", `node ${stub}`], {
      cwd: p.dir,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  return { ...p, agent };
}

test("--agent proposes the front matter; the body stays byte for byte, the rest is undone", (t) => {
  const { dir, agent, cli } = withGit(t, NOTES);
  const r = agent();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /The agent proposed this, at the top of docs\/brief\.md/);
  assert.match(r.stdout, /Review it — change anything — then {2}specgate draft/);
  const after = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.equal(briefBody(after), NOTES, "the brief below the front matter is unchanged");
  assert.equal(fs.existsSync(path.join(dir, "stray.txt")), false);
  assert.match(cli("draft").stdout, /Next {2}specgate draft courses/);
});

test("--agent that rewrites the brief itself is undone whole", (t) => {
  const { dir, agent } = withGit(t, NOTES);
  const r = agent({ MANGLE: "1" });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /draft_brief_body_changed/);
  assert.equal(fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8"), NOTES);
});

test("--agent on a complete front matter does nothing", (t) => {
  const { agent } = withGit(t, BRIEF);
  const r = agent();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /already there and complete/);
});

test("/specgate:draft writes only the front matter, then stops for the person", () => {
  const body = slashCommandBody(STEPS.find((s) => s.name === "draft"));
  assert.match(body, /follow `docs\/specs\/BRIEF-SETUP\.md`/);
  assert.match(body, /never a word below it/);
  assert.match(body, /\*\*stop\*\* and show the front matter to the person/);
  assert.match(body, /specgate draft --new-brief/);
});
