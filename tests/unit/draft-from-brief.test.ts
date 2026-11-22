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
import type { SpawnSyncReturns } from "node:child_process";
import type { TestContext } from "node:test";
import type { CliResult } from "../helpers/cli";
const { briefModules } = require("../../packages/core/src/domain/DraftChecklist");
const {
  agentInvocation,
  withOutsideDir,
  withWritePermission,
} = require("../../scripts/draft/confined-agent");
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

<!-- specgate:trace actor=Member kind=functional uc=UC-900 -->

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

/** The draft's use case (REQ-626): UC-900 delivered by REQ-002. */
const USE_CASES = `# Use cases — draft-bookings

## ADDED Use Cases

| ID | Use Case | Actor | Requirements |
| --- | --- | --- | --- |
| UC-900 | Book a court | Member | REQ-002 |
`;
/** UC-900's specification (REQ-632): its flows name the draft's two scenarios. */
const UC_SPEC = `# UC-900 — Book a court

## Overview

A member books a free court for one hour.

## Actors

- Member

## Main flow (SCN-002)

1. The member sends POST /api/bookings for the centre court.
2. The system books it for one hour.

## Alternative flows

### A1 — Booking on the screen (at step 1) (SCN-003)

1. The member opens the courts and taps the centre court.
`;
const writeUseCases = (dir: string) => {
  const change = path.join(dir, "docs", "specs", "changes", "draft-bookings");
  fs.writeFileSync(path.join(change, "use-cases.md"), USE_CASES);
  fs.mkdirSync(path.join(change, "use-cases"), { recursive: true });
  fs.writeFileSync(path.join(change, "use-cases", "UC-900.md"), UC_SPEC);
};

const git = (dir: string, ...a: string[]): SpawnSyncReturns<string> =>
  spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });

function project(
  t: TestContext,
  { brief = BRIEF, init = true }: { brief?: string | null; init?: boolean } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-brief-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (init) fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  if (brief !== null) {
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "brief.md"), brief);
  }
  const cli = (...a: string[]): CliResult =>
    spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: "utf8" });
  return { dir, cli };
}

const change = (dir: string, m = "bookings") =>
  path.join(dir, "docs", "specs", "changes", `draft-${m}`);

test("briefModules reads the front matter, inline or as a list", () => {
  assert.deepEqual(briefModules(BRIEF), ["bookings", "coupons"]);
  assert.deepEqual(briefModules("---\nmodules:\n  - curriculum\n  - 'live-classes'\n---\n"), [
    "curriculum",
    "live-classes",
  ]);
  assert.deepEqual(briefModules("# no front matter"), []);
});

test("specgate draft with no brief says where to put one", (t: TestContext) => {
  const { cli } = project(t, { brief: null });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Save it as docs\/brief\.md, then {2}specgate propose --from-brief/);
});

test("specgate draft lists the brief's modules and names the next", (t: TestContext) => {
  const { cli } = project(t);
  const r = cli("draft");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bookings\s+not started/);
  assert.match(r.stdout, /➜ {2}specgate propose --from-brief bookings/);
  const doc = JSON.parse(cli("draft", "--json").stdout).draft;
  assert.deepEqual(
    doc.modules.map((m: { module: string; state: string }) => [m.module, m.state]),
    [
      ["bookings", "not started"],
      ["coupons", "not started"],
    ]
  );
});

test("a brief without front matter gets the block to paste, not a guess", (t: TestContext) => {
  const { cli } = project(t, { brief: "# Plan\n\nMembers book courts.\n" });
  const r = cli("draft");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /The whole block, to paste at the top and change/);
  assert.doesNotMatch(r.stdout, /Modules\n/, "no modules are invented");
});

test("draft <module> opens the draft linked to the brief, with its guide", (t: TestContext) => {
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
  // The developer's layer is there (REQ-288), with nothing to tick yet.
  assert.doesNotMatch(
    fs.readFileSync(path.join(change(dir), "tasks.md"), "utf8"),
    /- \[ \]/,
    "a draft has no tasks to tick"
  );

  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, /only the bookings module/);
  assert.match(guide, /`REQ-001` … `REQ-010`/);
  assert.match(guide, /\*\*Member\*\* — an API scenario .*; a web scenario/);
  assert.match(guide, /\| # \| Assumption \| Used in \|/, "the format D6 reads");
  assert.match(guide, /\| # \| Question \| Blocks \|/, "the format D7 reads");
  assert.match(guide, /status="Needs Clarification"/);
  assert.match(guide, /specgate propose --from-brief bookings/);
});

test("draft <module> again: the placeholder, then findings, then ready", (t: TestContext) => {
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
  assert.ok(
    doc.status.some(
      (d: { code: string; message: string }) =>
        d.code === "D6_unlisted_value" && d.message.includes('"12"')
    )
  );

  fs.writeFileSync(spec, DRAFT());
  writeUseCases(dir);
  const green = cli("draft", "bookings");
  assert.equal(green.status, 0, green.stdout);
  assert.match(green.stdout, /Ready to review/);
  // Reviewed, then applied; archived once its requirements are delivered (ADR-0035).
  assert.match(green.stdout, /specgate apply/);
  assert.match(green.stdout, /specgate archive draft-bookings/);
  assert.match(cli("draft").stdout, /bookings\s+ready to review/);
});

test("archiving a ready draft needs no task boxes, and points at the next module", (t: TestContext) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");
  // Delivered, as `specgate apply` leaves it: archive waits for that (ADR-0035).
  fs.writeFileSync(
    path.join(change(dir), "specs", "bookings", "spec.md"),
    DRAFT().replace("<!-- specgate:trace actor=", "<!-- specgate:trace status=Implemented actor=")
  );
  writeUseCases(dir);
  const archived = cli("change", "archive", "draft-bookings");
  assert.equal(archived.status, 0, archived.stdout + archived.stderr);
  assert.match(archived.stdout, /➜ {2}specgate propose --from-brief\n/);
  assert.doesNotMatch(archived.stdout, /will fail until the tests exist/, "#92");
  const overview = cli("draft");
  assert.match(overview.stdout, /bookings\s+archived/);
  assert.match(overview.stdout, /➜ {2}specgate propose --from-brief coupons/);
  assert.match(cli("draft", "bookings").stdout, /already drafted and archived/);
});

test("draft <module> outside a Specgate project asks for init first", (t: TestContext) => {
  const { cli } = project(t, { init: false });
  const r = cli("draft", "bookings");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /specgate init/);
});

test("a module the brief does not list is drafted, with a note", (t: TestContext) => {
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
if (process.env.USE_CASES_TEXT) fs.writeFileSync("docs/specs/changes/draft-bookings/use-cases.md", process.env.USE_CASES_TEXT);
if (process.env.UC_SPEC_TEXT) { fs.mkdirSync("docs/specs/changes/draft-bookings/use-cases", { recursive: true }); fs.writeFileSync("docs/specs/changes/draft-bookings/use-cases/UC-900.md", process.env.UC_SPEC_TEXT); }
fs.writeFileSync("stray.txt", "not the agent's to write\\n");
fs.appendFileSync("docs/brief.md", "\\nThe agent rewrote the brief.\\n");
`;

const AGENT_COMMANDS: Array<[string, (stub: string) => string]> = [
  ["stdin", (stub) => `node ${stub}`],
  ["{prompt_file}", (stub) => `node ${stub} {prompt_file}`],
];

for (const [label, command] of AGENT_COMMANDS) {
  test(`--agent (${label}) drafts, undoes what it wrote elsewhere, keeps the person's edits`, (t: TestContext) => {
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
      env: {
        ...process.env,
        DRAFT_TEXT: DRAFT(),
        USE_CASES_TEXT: USE_CASES,
        UC_SPEC_TEXT: UC_SPEC,
      },
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

test("--agent without git refuses, and says how to go on", (t: TestContext) => {
  const { cli } = project(t);
  const r = cli("draft", "bookings", "--agent", "true");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /draft_agent_needs_git/);
});

test("status reads an open draft where it is, and counts it as drafted once ready", (t: TestContext) => {
  const { dir, cli } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  assert.equal(cli("init", "--no-capabilities").status, 0);
  assert.equal(cli("draft", "bookings").status, 0);
  fs.writeFileSync(
    path.join(change(dir), "specs", "bookings", "spec.md"),
    DRAFT().replace(
      "<!-- specgate:trace actor=",
      '<!-- specgate:trace status="Needs Clarification" actor='
    )
  );
  writeUseCases(dir);
  fs.writeFileSync(
    path.join(change(dir), "questions.md"),
    "# Questions\n\n| # | Question | Blocks | Answer |\n|---|---|---|---|\n" +
      "| Q1 | Can a member book two hours in a row? | REQ-002 | |\n"
  );
  assert.equal(cli("draft", "bookings").status, 0, "the draft is ready to review");
  const r = cli("status");
  // The open change's questions file is where it is — not under archive/,
  // which is only where the in-flight view lays it.
  assert.match(r.stdout, /Q1 \(docs\/specs\/changes\/draft-bookings\/questions\.md\)/);
  assert.doesNotMatch(r.stdout, /changes\/archive\//);
  assert.match(r.stdout, /1 of 2 module\(s\) drafted\s+next: coupons/);
  const doc = JSON.parse(cli("status", "--json").stdout);
  const req = doc.requirements.find((q: { id: string }) => q.id === "REQ-002");
  assert.equal(req.question, "Q1 (docs/specs/changes/draft-bookings/questions.md)");
});

test("status points at the brief's next module while nothing real is pending", (t: TestContext) => {
  const { dir, cli } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  const init = cli("init", "--no-capabilities");
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const doc = JSON.parse(cli("status", "--json").stdout);
  assert.equal(doc.nextCommand, "specgate propose --from-brief bookings");
  assert.deepEqual(
    doc.brief.modules.map((m: { state: string }) => m.state),
    ["not started", "not started"]
  );
  assert.match(
    cli("status").stdout,
    /Brief\s+░+\s+0 of 2 module\(s\) drafted\s+next: bookings\s+docs\/brief\.md/
  );
});

test("init names specgate draft when the brief is already there", (t: TestContext) => {
  const { dir } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  const r = spawnSync(process.execPath, [CLI, "init", "--no-capabilities"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout + r.stderr,
    /specgate propose --from-brief\s+docs\/brief\.md → requirements/
  );
});

test("the draft slash command takes the module as its argument", () => {
  const step = STEPS.find((s: { name: string }) => s.name === "draft");
  assert.ok(step, "a /specgate:draft step");
  const body = slashCommandBody(step);
  assert.match(body, /^argument-hint: <module>$/m);
  assert.match(body, /^specgate propose --from-brief \$ARGUMENTS$/m);
  assert.match(body, /Do not archive/);
  // Every other tool reads the plain form.
  assert.ok(step.run.includes("specgate propose --from-brief <module>"));
});

// ── Writing the brief (#95) ─────────────────────────────────────────────────

const { BRIEF_TEMPLATE, checkFrontMatter, briefBody } = require("../../scripts/draft/brief-setup");
const { actorSurfaces } = require("../../packages/core/src/domain/DraftChecklist");

const NOTES = `# Lingo

Lingo is an online language school. Students learn on the web or on their phone.
`;

const codesOf = (brief: string) => checkFrontMatter(brief).map((p: any) => p.code);

test("no brief: what a brief is, and --new-brief to start one", (t: TestContext) => {
  const { cli } = project(t, { brief: null });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /your own plan, a\s+client's email, meeting notes/);
  assert.match(r.stdout, /what you don't know yet — those become questions/);
  assert.match(r.stdout, /specgate propose --from-brief --new-brief/);
  const doc = JSON.parse(cli("draft", "--json").stdout);
  assert.equal(doc.status[0].code, "draft_no_brief");
});

test("--new-brief writes the template, and never over a brief that exists", (t: TestContext) => {
  const { dir, cli } = project(t, { brief: null });
  const r = cli("draft", "--new-brief");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const file = path.join(dir, "docs", "brief.md");
  assert.equal(fs.readFileSync(file, "utf8"), BRIEF_TEMPLATE);
  // ADR-0038: why, a glossary, a card per module, and notes.
  for (const section of [
    "## Why",
    "## Glossary",
    "## Module: <first-module>",
    "Rules\n",
    "Examples\n",
    "Questions\n",
    "## Notes",
  ]) {
    assert.ok(BRIEF_TEMPLATE.includes(section), section);
  }
  fs.writeFileSync(file, NOTES);
  const again = cli("draft", "--new-brief");
  assert.equal(again.status, 1);
  assert.match(again.stdout + again.stderr, /already exists — nothing was written/);
  assert.equal(fs.readFileSync(file, "utf8"), NOTES, "the brief is untouched");
});

test("the template's placeholders are reported one field at a time", (t: TestContext) => {
  const { cli } = project(t, { brief: BRIEF_TEMPLATE });
  const r = cli("draft");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /needs 4 fix\(es\)/);
  assert.match(r.stdout, /`surfaces:` still says <surface>, <surface>/);
  // The commented examples are not actors the person declared.
  assert.equal(actorSurfaces(BRIEF_TEMPLATE).has("teacher"), false);
});

test("a brief without front matter gets every field explained, and the agent's guide", (t: TestContext) => {
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
  assert.match(r.stdout, /specgate propose --from-brief --agent "claude -p"/);
  const guide = fs.readFileSync(path.join(dir, "docs", "specs", "BRIEF-SETUP.md"), "utf8");
  assert.match(guide, /Change nothing below the front matter/);
  assert.match(guide, /Never invent an actor, a surface or a module/);
  assert.match(guide, /# check:/);
  assert.match(guide, /Do not run `specgate propose --from-brief <module>`/);
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

test("--agent proposes the front matter; the body stays byte for byte, the rest is undone", (t: TestContext) => {
  const { dir, agent, cli } = withGit(t, NOTES);
  const r = agent();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /The agent proposed this, at the top of docs\/brief\.md/);
  assert.match(r.stdout, /➜ {2}specgate propose --from-brief\n\s+review it — change anything/);
  const after = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.equal(briefBody(after), NOTES, "the brief below the front matter is unchanged");
  assert.equal(fs.existsSync(path.join(dir, "stray.txt")), false);
  assert.match(cli("draft").stdout, /➜ {2}specgate propose --from-brief courses/);
});

test("--agent that rewrites the brief itself is undone whole", (t: TestContext) => {
  const { dir, agent } = withGit(t, NOTES);
  const r = agent({ MANGLE: "1" });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /draft_brief_body_changed/);
  assert.equal(fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8"), NOTES);
});

test("--agent on a complete front matter with its module sections does nothing", (t: TestContext) => {
  const sections = [
    "",
    "## Module: bookings",
    "",
    "Rules",
    "- A court cannot be booked twice for the same hour.",
    "",
    "Examples",
    "- The one where a Member books the centre court at 18:00.",
    "",
    "## Module: coupons",
    "",
    "Rules",
    "- A coupon is used once.",
    "",
    "Examples",
    "- The one where a Member uses a coupon twice.",
    "",
  ].join("\n");
  const { agent } = withGit(t, BRIEF + sections);
  const r = agent();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /already there and complete/);
});

test("/specgate:draft writes only the front matter, then stops for the person", () => {
  const body = slashCommandBody(STEPS.find((s: { name: string }) => s.name === "draft"));
  assert.match(body, /follow `docs\/specs\/BRIEF-SETUP\.md`/);
  assert.match(body, /never a word below it/);
  assert.match(body, /\*\*stop\*\* and show the front matter to the person/);
  assert.match(body, /specgate propose --from-brief --new-brief/);
});

// ── #103 and #105: an agent that cannot write, and what comes after ────────────

function committed(dir: string) {
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
}

test("claude -p gets edit permission, unless the command brings its own", () => {
  assert.deepEqual(withWritePermission("claude -p"), {
    command: "claude --strict-mcp-config --permission-mode acceptEdits -p",
    added: true,
  });
  assert.equal(withWritePermission("claude --print < {prompt_file}").added, true);
  // Its own permission is kept; the person's MCP servers are not loaded (REQ-650).
  for (const own of [
    "claude -p --permission-mode acceptEdits",
    "claude -p --allowedTools Edit Write",
    "claude -p --dangerously-skip-permissions",
  ]) {
    assert.deepEqual(
      withWritePermission(own),
      { command: own.replace(/^claude/, "claude --strict-mcp-config"), added: false },
      own
    );
  }
  for (const other of [
    "claude",
    "codex exec -",
    "node agent.js -p",
    "claude -p --mcp-config m.json",
  ]) {
    assert.deepEqual(
      withWritePermission(other).command.includes("--strict-mcp-config"),
      false,
      other
    );
  }
});

const PIPED =
  "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude";

test("REQ-616 SCN-616a: a piped agent gets --add-dir in claude's own command, not after the pipe", () => {
  assert.equal(
    withOutsideDir(PIPED, "/tmp/brief"),
    'claude --add-dir "/tmp/brief" --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude'
  );
  assert.equal(withOutsideDir("claude -p", "/tmp/brief"), 'claude --add-dir "/tmp/brief" -p');
  const own =
    'claude --add-dir "$TMPDIR" -p < {prompt_file} | specgate harness events --from claude';
  assert.equal(withOutsideDir(own, "/tmp/brief"), own, "a command with its own --add-dir is kept");
  assert.equal(withOutsideDir("codex exec - | cat", "/tmp/brief"), "codex exec - | cat");
});

test("REQ-616 SCN-616b: a piped agent without edit permission gets it in claude's own command", () => {
  assert.deepEqual(
    withWritePermission("claude -p < {prompt_file} | specgate harness events --from claude"),
    {
      command:
        "claude --strict-mcp-config --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude",
      added: true,
    }
  );
  assert.deepEqual(withWritePermission(PIPED), {
    command: PIPED.replace(/^claude/, "claude --strict-mcp-config"),
    added: false,
  });
});

test("an agent that writes nothing is told apart from a draft to fix, with the likely cause", (t: TestContext) => {
  const { dir } = project(t);
  committed(dir);
  const r = spawnSync(process.execPath, [CLI, "draft", "bookings", "--agent", "true"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /The agent ran, but the draft is still the placeholder/);
  assert.match(r.stdout, /--permission-mode acceptEdits/);
});

test("after the agent, the next steps are numbered and the brief's progress is shown", (t: TestContext) => {
  const { dir } = project(t);
  committed(dir);
  const stub = path.join(dir, "..", `next-${path.basename(dir)}.js`);
  fs.writeFileSync(stub, STUB);
  t.after(() => fs.rmSync(stub, { force: true }));
  const r = spawnSync(process.execPath, [CLI, "draft", "bookings", "--agent", `node ${stub}`], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, DRAFT_TEXT: DRAFT(), USE_CASES_TEXT: USE_CASES, UC_SPEC_TEXT: UC_SPEC },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /─{20}/, "a rule separates the agent's output from Specgate's");
  assert.match(
    r.stdout,
    /Brief {2}bookings ● ready · coupons ○ not started {3}\(0 of 2 archived\)/
  );
  assert.match(r.stdout, /What now ─+\n\s+1\s+Read docs\/specs\/changes\/draft-bookings\/specs\//);
  // Reviewed, applied, then archived (ADR-0035).
  assert.match(r.stdout, /3\s+➜ specgate apply\s+.*then specgate archive draft-bookings/);
  assert.match(
    r.stdout,
    /4\s+➜ specgate propose --from-brief coupons\s+the next module of the brief/
  );
});

test("a bare specgate inside a project says where it stands; outside, the help", (t: TestContext) => {
  const { dir, cli } = project(t, { init: false });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","scripts":{"test":"node --test"}}');
  assert.equal(cli("init", "--no-capabilities").status, 0);
  const inside = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: "utf8" });
  assert.match(inside.stdout, /All commands: specgate --help/);
  assert.match(inside.stdout, /➜ {2}specgate propose --from-brief bookings/);
  const outside = spawnSync(process.execPath, [CLI], { cwd: os.tmpdir(), encoding: "utf8" });
  assert.match(outside.stdout, /Usage/);
});

test("under --agent the prompt says Specgate checks the result, so the agent does not ask to (#106)", () => {
  const { draftingPrompt } = require("../../scripts/draft/drafting-guide");
  const { briefSetupPrompt } = require("../../scripts/draft/brief-setup");
  for (const prompt of [
    draftingPrompt("bookings", "draft-bookings", "guide"),
    briefSetupPrompt("guide"),
  ]) {
    assert.match(prompt, /Specgate runs `specgate propose --from-brief` itself .* do not run it/);
  }
});

test("a second --agent pass gets the draft's findings in its prompt", (t: TestContext) => {
  const { dir } = project(t);
  committed(dir);
  const stub = path.join(dir, "..", `pass-${path.basename(dir)}.js`);
  fs.writeFileSync(stub, STUB);
  t.after(() => fs.rmSync(stub, { force: true }));
  // First pass: a draft with a value the brief never gave (a D6 finding).
  const first = spawnSync(process.execPath, [CLI, "draft", "bookings", "--agent", `node ${stub}`], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, DRAFT_TEXT: DRAFT(" and costs 9 euros") },
  });
  assert.equal(first.status, 1, first.stdout + first.stderr);
  // Second pass: an agent that records its prompt.
  const seen = path.join(dir, "..", `seen-${path.basename(dir)}.txt`);
  t.after(() => fs.rmSync(seen, { force: true }));
  spawnSync(process.execPath, [CLI, "draft", "bookings", "--agent", `cat > ${seen}`], {
    cwd: dir,
    encoding: "utf8",
  });
  const prompt = fs.readFileSync(seen, "utf8");
  assert.match(prompt, /Fix these findings, and only these/);
  assert.match(prompt, /D6_unlisted_value/);
});

test("REQ-197 SCN-197a: opening a module while another draft is unwritten warns that its range stops growing", (t: TestContext) => {
  const { cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const r = cli("draft", "coupons", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const note = doc.status.find((d: { code: string }) => d.code === "draft_other_unwritten");
  assert.ok(note, r.stdout);
  assert.match(note.message, /draft-bookings/);
  assert.match(note.fix, /--reserve/);
});

test("REQ-248 SCN-248a: a log edited by hand while the agent drafts", () => {
  const { runConfinedAgent } = require("../../scripts/draft/confined-agent");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-undone-"));
  try {
    const git = (...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "notes.md"), "before\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
    // The "agent" writes its draft, and the notes change while it runs.
    const script = path.join(dir, "agent.js");
    fs.writeFileSync(
      script,
      'const fs=require("fs");fs.mkdirSync("docs/specs/changes/draft-x",{recursive:true});' +
        'fs.writeFileSync("docs/specs/changes/draft-x/spec.md","x");' +
        'fs.writeFileSync("docs/notes.md","edited by hand\\n");'
    );
    git("add", "agent.js");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "agent");
    const run = runConfinedAgent({
      projectDir: dir,
      changeId: "draft-x",
      command: `"${process.execPath}" agent.js`,
      prompt: "draft",
      showOutput: false,
    });
    assert.deepEqual(run.reverted, ["docs/notes.md"]);
    // git may check it out with CRLF on Windows.
    const back = fs.readFileSync(path.join(dir, "docs", "notes.md"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(back, "before\n");
    assert.ok(run.kept, "where the removed content went");
    assert.equal(
      fs.readFileSync(path.join(dir, run.kept, "docs", "notes.md"), "utf8"),
      "edited by hand\n"
    );
    assert.match(run.kept, /^\.git\/specgate-undone\//);
    // Only the draft the agent was allowed to write is new: no copy, no .gitignore line.
    assert.equal(git("status", "--porcelain").stdout.trim(), "?? docs/specs/");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  }
});

test("REQ-626 SCN-626a: a draft opens with use-cases.md and a reserved uc_range, and DRAFTING.md asks for uc= and the use cases", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const yaml = fs.readFileSync(path.join(change(dir), "change.yaml"), "utf8");
  const range = /^uc_range: \[(UC-\d+), (UC-\d+)\]$/m.exec(yaml);
  assert.ok(range, yaml);
  const useCases = fs.readFileSync(path.join(change(dir), "use-cases.md"), "utf8");
  assert.match(useCases, /## ADDED Use Cases\n\n\| ID \| Use Case \| Actor \| Requirements \|/);
  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, new RegExp(`uc=${range![1]}`));
  assert.match(guide, /## 1b\. The use cases — `use-cases\.md`/);
});

test("REQ-626 SCN-626b: a requirement with no use case, or one its use case does not list, keeps the draft from ready", (t: TestContext) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");
  const spec = path.join(change(dir), "specs", "bookings", "spec.md");
  fs.writeFileSync(spec, DRAFT().replace(" uc=UC-900", ""));
  writeUseCases(dir);
  const none = JSON.parse(cli("draft", "bookings", "--json").stdout);
  const codes = (none.status || []).map((d: { code: string }) => d.code);
  assert.ok(codes.includes("D14_no_use_case"), JSON.stringify(codes));
  assert.ok(codes.includes("D14_use_case_mismatch"), "UC-900 lists REQ-002, which names none");

  fs.writeFileSync(spec, DRAFT().replace("uc=UC-900", "uc=UC-901"));
  const unknown = JSON.parse(cli("draft", "bookings", "--json").stdout);
  assert.ok(
    (unknown.status || []).some((d: { code: string }) => d.code === "D14_unknown_use_case"),
    JSON.stringify(unknown.status)
  );

  fs.writeFileSync(spec, DRAFT());
  const ready = cli("draft", "bookings");
  assert.match(ready.stdout, /Ready to review/);
});

test("REQ-632 SCN-632a: DRAFTING.md asks for each use case's specification, its flows naming the scenarios", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, /## 1c\. Each use case's specification — `use-cases\/UC-NNN\.md`/);
  assert.match(guide, /## Main flow \(SCN-\d+\)/);
  assert.match(guide, /### A1 — <what goes otherwise> \(at step 2\) \(SCN-NNN\)/);
});

test("REQ-639 SCN-639c: DRAFTING.md asks for an entity's state machine as a delta, each transition naming its requirement", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, /## 1d\. An entity's states — `state-machines\/<Entity>\.md`/);
  assert.match(guide, /## ADDED Transitions/);
  assert.match(guide, /\| From \| To \| Trigger \| Requirement \|/);
  assert.match(guide, /## ADDED Forbidden/);
});

test("REQ-639 SCN-639d: a state machine the draft writes keeps it from ready while it names a state or a requirement that is not there", (t: TestContext) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");
  fs.writeFileSync(path.join(change(dir), "specs", "bookings", "spec.md"), DRAFT());
  writeUseCases(dir);
  const file = path.join(change(dir), "state-machines", "Booking.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const machine = (to: string, req: string) =>
    `# Delta — Booking\n\n## ADDED States\n\n- Requested (initial)\n- Confirmed (final)\n\n## ADDED Transitions\n\n| From | To | Trigger | Requirement |\n|---|---|---|---|\n| Requested | ${to} | confirm | ${req} |\n`;
  fs.writeFileSync(file, machine("Confirmd", "REQ-404"));
  const bad = JSON.parse(cli("draft", "bookings", "--json").stdout);
  const codes = (bad.status || []).map((d: { code: string }) => d.code);
  assert.ok(codes.includes("D16_sm_unknown_requirement"), JSON.stringify(bad.status));
  fs.writeFileSync(file, machine("Confirmd", "REQ-002"));
  const typo = JSON.parse(cli("draft", "bookings", "--json").stdout);
  assert.ok(
    (typo.status || []).some((d: { code: string }) => d.code === "D16_sm_unknown_state"),
    JSON.stringify(typo.status)
  );
  fs.writeFileSync(file, machine("Confirmed", "REQ-002"));
  assert.match(cli("draft", "bookings").stdout, /Ready to review/);
});

test("REQ-642 SCN-642a: DRAFTING.md asks for each step's actor as a [Who] tag, every lane listed under Actors", (t: TestContext) => {
  const { dir, cli } = project(t);
  assert.equal(cli("draft", "bookings").status, 0);
  const guide = fs.readFileSync(path.join(change(dir), "DRAFTING.md"), "utf8");
  assert.match(guide, /Start a step with `\[Who\]`/);
  assert.match(guide, /2\. \[System\] <the system answers>/);
  assert.match(guide, /## Actors\n\n- [^\n]+\n- System/);
});

test("REQ-632 SCN-632b: a use case with no specification, or a scenario no flow names, keeps the draft from ready", (t: TestContext) => {
  const { dir, cli } = project(t);
  cli("draft", "bookings");
  fs.writeFileSync(path.join(change(dir), "specs", "bookings", "spec.md"), DRAFT());
  writeUseCases(dir);
  const spec = path.join(change(dir), "use-cases", "UC-900.md");
  fs.rmSync(spec);
  const none = JSON.parse(cli("draft", "bookings", "--json").stdout);
  assert.ok(
    (none.status || []).some((d: { code: string }) => d.code === "D15_no_spec"),
    JSON.stringify(none.status)
  );
  fs.writeFileSync(spec, UC_SPEC.replace(/\n## Alternative flows[\s\S]*$/, "\n"));
  const half = JSON.parse(cli("draft", "bookings", "--json").stdout);
  const unflowed = (half.status || []).find(
    (d: { code: string }) => d.code === "D15_ucs_scenario_unflowed"
  );
  assert.ok(unflowed, JSON.stringify(half.status));
  assert.match(unflowed.message, /SCN-003/);
  fs.writeFileSync(spec, UC_SPEC);
  assert.match(cli("draft", "bookings").stdout, /Ready to review/);
});
