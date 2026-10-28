"use strict";

/**
 * Brief cards (ADR-0038, change `brief-cards`).
 *
 * A brief shaped like what it becomes — per module, rules, examples and
 * questions — checked before any agent drafts from it: shapes reported as
 * shapes, empty modules and missing cards as errors, untestable wording as
 * warnings, and the module's own cards handed to whoever drafts it.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";
import type { CliResult } from "../helpers/cli";
const { checkBrief } = require("../../scripts/draft/brief-check");
const { keepsEveryLine } = require("../../scripts/draft/brief-setup");
const { readBriefBody, cardValues } = require("../../packages/core/src/domain/BriefCards");
const { LINGO_EXAMPLE } = require("../../scripts/docs/record-journey");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const FRONT = `---
product: Lingo — online lessons for a language school
surfaces: [api, web, mobile]
actors:
  - { name: Teacher, surfaces: [api, web] }
  - { name: Student, surfaces: [api, web, mobile] }
modules: [courses, lessons]
non_goals: [payments]
---
`;

const NOTES = `
# Lingo

Lingo is an online language school.
A teacher runs small groups of adult students.
Students join a course and follow its lessons on the web or on their phone.
`;

/** A courses section from its rules and examples; lessons always filled. */
const brief = (
  rules: string[],
  examples = ['The one where Ana joins "Spanish A2", which has 11 students.'],
  questions: string[] = []
) =>
  FRONT +
  NOTES +
  "\n## Module: courses\n\nRules\n" +
  rules.map((r) => `- ${r}\n`).join("") +
  (examples.length ? "\nExamples\n" + examples.map((e) => `- ${e}\n`).join("") : "") +
  (questions.length ? "\nQuestions\n" + questions.map((q) => `- ${q}\n`).join("") : "") +
  '\n## Module: lessons\n\nRules\n- A lesson belongs to one course.\n\nExamples\n- The one where a Teacher adds "Greetings" to "Spanish A2".\n';

const COURSES = brief(
  [
    "A course holds at most 12 students.",
    'When a course is full, joining it is refused with "This course is full".',
  ],
  [
    'The one where Ana joins "Spanish A2", which has 11 students.',
    'The one where Ana tries to join "Spanish A2", which has 12.',
  ],
  ["Can a student be in two courses at once?"]
);

function git(dir: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

/** A Specgate project in git, with docs/brief.md committed. */
function project(t: TestContext, text: string | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-cards-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  if (text !== null) {
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "brief.md"), text);
  }
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
  const cli = (...a: string[]): CliResult =>
    spawnSync(process.execPath, [CLI, ...a], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  const json = (...a: string[]) => {
    const r = cli(...a, "--json");
    return { status: r.status, doc: JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))) };
  };
  return { dir, cli, json };
}

const codes = (doc: { status: Array<{ code: string }> }) => doc.status.map((d) => d.code);

// ── REQ-135 ───────────────────────────────────────────────────────────────────

test("REQ-135 SCN-135a: a scalar surface and a bare actor are reported as shapes", (t: TestContext) => {
  const text = FRONT.replace("surfaces: [api, web, mobile]", "surfaces: web")
    .replace(/actors:\n(?: {2}-.*\n)+/, "actors: [Admin]\n")
    .replace("non_goals: [payments]\n", "");
  const { cli, json } = project(t, text + NOTES);
  const r = cli("propose", "--from-brief");
  assert.equal(r.status, 1, r.stdout);
  assert.doesNotMatch(r.stdout, /There is no `actors:` list/);
  const { doc } = json("propose", "--from-brief");
  const shapes = doc.status.filter((d: { code: string }) => d.code === "brief_wrong_shape");
  assert.equal(shapes.length, 2, JSON.stringify(doc.status));
  assert.ok(shapes.some((d: { fix: string }) => d.fix.includes("surfaces: [web]")));
  assert.ok(
    shapes.some((d: { fix: string }) => d.fix.includes("- { name: Admin, surfaces: [web] }"))
  );
});

test("REQ-135: modules and non_goals written as words, not lists", () => {
  const text = FRONT.replace("modules: [courses, lessons]", "modules: courses, lessons").replace(
    "non_goals: [payments]",
    "non_goals: payments"
  );
  const shapes = checkBrief(text + NOTES, "docs/brief.md").filter(
    (d: { code: string }) => d.code === "brief_wrong_shape"
  );
  assert.deepEqual(
    shapes.map((d: { fix: string }) => d.fix),
    ["Write it as modules: [courses, lessons]", "Write it as non_goals: [payments]"]
  );
});

// ── REQ-136 ───────────────────────────────────────────────────────────────────

const EMPTY_COURSES =
  FRONT +
  NOTES +
  "\n## Module: courses\n\n<!-- rules go here -->\n" +
  '\n## Module: lessons\n\nRules\n- A lesson belongs to one course.\n\nExamples\n- The one where a Teacher adds "Greetings".\n';

test("REQ-136 SCN-136a: --check names an empty module and writes nothing", (t: TestContext) => {
  const { dir, cli, json } = project(t, EMPTY_COURSES);
  const r = cli("propose", "--from-brief", "--check");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /B2_empty_module {2}courses/);
  assert.match(r.stdout, /fix: Write its Rules/);
  const { doc } = json("propose", "--from-brief", "--check");
  const finding = doc.status.find((d: { code: string }) => d.code === "B2_empty_module");
  assert.equal(finding.target, "courses");
  assert.equal(doc.draft.ready, false);
  assert.equal(git(dir, "status", "--porcelain"), "");
});

test("REQ-136 SCN-136b: a draft is not opened over an error", (t: TestContext) => {
  const { dir, cli } = project(t, EMPTY_COURSES);
  const r = cli("propose", "--from-brief", "courses");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout + r.stderr, /brief_not_ready/);
  assert.equal(fs.existsSync(path.join(dir, "docs", "specs", "changes", "draft-courses")), false);
});

test("REQ-136 SCN-136c: warnings only — ready to draft", (t: TestContext) => {
  const { cli, json } = project(t, brief(["The list of courses loads fast"]));
  const r = cli("propose", "--from-brief", "--check");
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Ready to draft/);
  const { doc } = json("propose", "--from-brief", "--check");
  for (const code of ["B5_vague", "B6_unmeasured"]) {
    const d = doc.status.find((x: { code: string }) => x.code === code);
    assert.ok(d, code);
    assert.equal(d.target, "courses");
    assert.equal(d.severity, "warning");
  }
});

test("REQ-136: --check <change-id> still checks a draft, and --check needs no module", (t: TestContext) => {
  const { cli } = project(t, COURSES);
  const r = cli("propose", "--from-brief", "--check", "nope");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /draft_no_change/);
  const both = cli("propose", "--from-brief", "courses", "--check");
  assert.equal(both.status, 2, both.stdout + both.stderr);
});

// ── REQ-137 ───────────────────────────────────────────────────────────────────

test("REQ-137 SCN-137a: a missing and an unknown section", (t: TestContext) => {
  const text =
    FRONT +
    NOTES +
    "\n## Module: courses\n\nRules\n- A course holds at most 12 students.\n\nExamples\n- The one where a course has 12.\n\n## Module: billing\n\nRules\n- An invoice is sent monthly.\n\nExamples\n- The one where March is invoiced.\n";
  const { json } = project(t, text);
  const { status, doc } = json("propose", "--from-brief", "--check");
  assert.equal(status, 1);
  const find = (code: string) => doc.status.find((d: { code: string }) => d.code === code);
  assert.equal(find("B3_no_section").target, "lessons");
  assert.equal(find("B3_unknown_module").target, "billing");
});

test("REQ-137 SCN-137b: rules without examples", (t: TestContext) => {
  const { json } = project(
    t,
    brief(["A course holds at most 12 students.", "A course has one level."], [])
  );
  const { status, doc } = json("propose", "--from-brief", "--check");
  assert.equal(status, 1);
  const d = doc.status.find((x: { code: string }) => x.code === "B4_no_example");
  assert.equal(d.target, "courses");
});

test("REQ-137: a section with prose and no rule", () => {
  const text =
    FRONT +
    NOTES +
    "\n## Module: courses\n\nTeachers create courses.\n\n## Module: lessons\n\nRules\n- A lesson belongs to one course.\n\nExamples\n- The one where a lesson is added.\n";
  const found = checkBrief(text, "docs/brief.md").map((d: { code: string }) => d.code);
  assert.ok(found.includes("B4_no_rule"), found.join());
});

test("REQ-137 SCN-137c: a pasted email keeps working", (t: TestContext) => {
  const { json } = project(t, FRONT + NOTES);
  const { status, doc } = json("propose", "--from-brief", "--check");
  assert.equal(status, 0, JSON.stringify(doc.status));
  assert.deepEqual(codes(doc), ["B3_no_sections"]);
  assert.equal(doc.status[0].severity, "info");
});

test("REQ-137: an empty body is an error, and cards wrap and keep their lines", () => {
  const found = checkBrief(FRONT + "\n# Lingo\n\n<!-- write here -->\n", "docs/brief.md");
  assert.ok(found.some((d: { code: string }) => d.code === "B2_empty_brief"));
  const body = readBriefBody(
    FRONT +
      "\n## Module: courses\n\nRules\n- A course holds at most\n  12 students.\n\nExamples\n- The one where it is full.\n"
  );
  const courses = body.modules[0];
  assert.equal(courses.rules[0].text, "A course holds at most 12 students.");
  assert.equal(courses.rules[0].line, 14);
  assert.equal(courses.examples.length, 1);
});

// ── REQ-138 ───────────────────────────────────────────────────────────────────

test("REQ-138 SCN-138a: three warnings, no error", (t: TestContext) => {
  const rules = [
    "Joining is refused if the course is full",
    "Teachers can see payments of a course",
    "Courses are stored in PostgreSQL",
  ];
  const { json } = project(
    t,
    brief(rules, [
      "The one where Ana joins.",
      "The one where a Teacher looks.",
      "The one where it is saved.",
    ])
  );
  const { status, doc } = json("propose", "--from-brief", "--check");
  assert.equal(status, 0, JSON.stringify(doc.status));
  const about = (code: string) =>
    doc.status
      .filter((d: { code: string }) => d.code === code)
      .map((d: { message: string }) => d.message);
  assert.match(about("B11_condition_last").join(), /Joining is refused if the course is full/);
  assert.match(about("B10_non_goal").join(), /payments/);
  assert.match(about("B7_technical").join(), /PostgreSQL/);
  assert.equal(
    about("B11_condition_last").length,
    1,
    "a rule that opens with its condition is EARS"
  );
});

test("REQ-138: vague words in Spanish, too many cards, an actor nobody mentions", () => {
  const many = Array.from({ length: 8 }, (_, i) => `A course has rule number ${i + 1}.`);
  const text = brief(
    ["La lista carga rápido.", ...many],
    ["The one where it loads."],
    ["One?", "Two?", "Three?", "Four?"]
  ).replace(
    "  - { name: Student, surfaces: [api, web, mobile] }\n",
    "  - { name: Student, surfaces: [api, web, mobile] }\n  - { name: Auditor, surfaces: [web] }\n"
  );
  const found = checkBrief(text, "docs/brief.md");
  const byCode = (code: string) => found.filter((d: { code: string }) => d.code === code);
  assert.match(byCode("B5_vague")[0].message, /rápido/);
  assert.equal(byCode("B8_too_big").length, 1);
  assert.equal(byCode("B9_actor_unnamed")[0].target, "auditor");
  assert.ok(found.every((d: { severity: string }) => d.severity !== "error"));
});

test('REQ-138: quoted labels are not judged — a message may say "fast"', () => {
  const found = checkBrief(
    brief(['When it is full, the page says "Book fast next time".']),
    "docs/brief.md"
  );
  assert.equal(found.filter((d: { code: string }) => d.code === "B5_vague").length, 0);
});

// ── REQ-139 ───────────────────────────────────────────────────────────────────

test("REQ-139 SCN-139a: the new brief has cards, and its check reports placeholders", (t: TestContext) => {
  const { dir, cli, json } = project(t, null);
  const w = cli("propose", "--from-brief", "--new-brief");
  assert.equal(w.status, 0, w.stdout + w.stderr);
  const text = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  for (const s of [
    "## Module: <first-module>",
    "\nRules\n",
    "\nExamples\n",
    "\nQuestions\n",
    "## Why",
    "## Glossary",
    "## Notes",
    "# non_goals: [",
  ]) {
    assert.ok(text.includes(s), s);
  }
  const { status, doc } = json("propose", "--from-brief", "--check");
  assert.equal(status, 1);
  const found = codes(doc);
  assert.ok(found.includes("brief_placeholder"), found.join());
  assert.ok(found.includes("B2_empty_module"), found.join());
  assert.ok(!found.includes("B3_no_section"), found.join());
});

// ── REQ-140 ───────────────────────────────────────────────────────────────────

test("REQ-140 SCN-140a: DRAFTING.md quotes the courses cards, their values and question", (t: TestContext) => {
  const { dir, cli } = project(t, COURSES);
  const r = cli("propose", "--from-brief", "courses");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const guide = fs.readFileSync(
    path.join(dir, "docs", "specs", "changes", "draft-courses", "DRAFTING.md"),
    "utf8"
  );
  assert.match(guide, /- A course holds at most 12 students\./);
  assert.match(
    guide,
    /- When a course is full, joining it is refused with "This course is full"\./
  );
  assert.match(guide, /The values you may use[\s\S]*`12`[\s\S]*`"This course is full"`/);
  assert.match(
    guide,
    /Questions to copy into `questions\.md`[\s\S]*- Can a student be in two courses at once\?/
  );
  assert.match(guide, /each \*\*rule\*\* becomes a requirement/i);
});

test("REQ-140: the values of a section, in order and once each", () => {
  const section = readBriefBody(COURSES).modules[0];
  assert.deepEqual(cardValues(section), ["12", '"This course is full"', '"Spanish A2"', "11"]);
});

test("REQ-140 SCN-140b: a value only in a comment is not the brief's", (t: TestContext) => {
  const text = brief(["A course holds at most 12 students."]).replace(
    "## Module: courses",
    "<!-- e.g. 48 hours -->\n\n## Module: courses"
  );
  const { dir, cli, json } = project(t, text);
  assert.equal(cli("propose", "--from-brief", "courses").status, 0);
  const spec = path.join(
    dir,
    "docs",
    "specs",
    "changes",
    "draft-courses",
    "specs",
    "courses",
    "spec.md"
  );
  fs.writeFileSync(
    spec,
    [
      "# Delta — courses",
      "",
      "## ADDED Requirements",
      "",
      "### Requirement: REQ-001 — A course closes after a while",
      "",
      "<!-- specgate:trace actor=Teacher kind=functional surfaces=api -->",
      "",
      "The system SHALL close a course.",
      "",
      '> Brief: "A course holds at most 12 students."',
      "",
      "#### Scenario: SCN-001 — Closing",
      "",
      "- GIVEN the course Spanish A2 opened",
      "- WHEN the Teacher sends POST /api/courses/close after 48 hours",
      "- THEN the response says closed",
      "",
    ].join("\n")
  );
  const { doc } = json("propose", "--from-brief", "courses");
  const d6 = doc.status.filter((d: { code: string }) => d.code === "D6_unlisted_value");
  assert.ok(
    d6.some((d: { message: string }) => d.message.includes('"48"')),
    JSON.stringify(doc.status)
  );
});

// ── REQ-141 ───────────────────────────────────────────────────────────────────

const CARDS_STUB = (mangle: boolean) => `
const fs = require("fs");
const prompt = fs.readFileSync(0, "utf8");
if (!/Keep every line that is there/.test(prompt)) process.exit(3);
let text = fs.readFileSync("docs/brief.md", "utf8");
${mangle ? 'text = text.replace("A teacher runs small groups of adult students.", "A teacher runs groups.");' : ""}
text += "\\n## Module: courses\\n\\nRules\\n- A course holds at most 12 students.\\n\\nExamples\\n- The one where a course has 12.\\n";
text += "\\n## Module: lessons\\n\\nRules\\n- A lesson belongs to one course.\\n\\nExamples\\n- The one where a lesson is added.\\n";
fs.writeFileSync("docs/brief.md", text);
`;

function cardsAgent(t: TestContext, mangle: boolean) {
  const p = project(t, FRONT + NOTES);
  const stub = path.join(p.dir, "..", `cards-${path.basename(p.dir)}.js`);
  fs.writeFileSync(stub, CARDS_STUB(mangle));
  t.after(() => fs.rmSync(stub, { force: true }));
  return { ...p, r: p.cli("propose", "--from-brief", "--agent", `node ${stub}`) };
}

test("REQ-141 SCN-141a: the agent adds a section per module below the notes", (t: TestContext) => {
  const { dir, r } = cardsAgent(t, false);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const text = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.ok(text.startsWith(FRONT + NOTES), "the notes are kept as they were");
  assert.match(text, /## Module: courses/);
  assert.match(text, /## Module: lessons/);
  assert.match(r.stdout, /➜ {2}specgate propose --from-brief --check/);
  assert.ok(fs.existsSync(path.join(dir, "docs", "specs", "BRIEF-CARDS.md")));
});

test("REQ-141 SCN-141b: a rewritten line puts the brief back", (t: TestContext) => {
  const { dir, r } = cardsAgent(t, true);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout + r.stderr, /draft_brief_text_lost/);
  assert.equal(fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8"), FRONT + NOTES);
});

test("REQ-141: every line kept, in order", () => {
  assert.equal(keepsEveryLine("a\n\nb\n", "a\nnew\nb\nmore\n"), true);
  assert.equal(keepsEveryLine("a\nb\n", "b\na\n"), false);
  assert.equal(keepsEveryLine("a\nb\n", "a\nB\n"), false);
});

// ── REQ-142 ───────────────────────────────────────────────────────────────────

const PAGE = path.join(ROOT_DIR, "docs", "start", "write-the-brief.md");

test("REQ-142 SCN-142a: the help says when a brief is needed", (t: TestContext) => {
  const { cli } = project(t, null);
  const r = cli("propose", "--help");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /One behaviour to fix or change\s+No brief/);
  assert.match(r.stdout, /A product, or a large area of one\s+A brief/);
});

test("REQ-142 SCN-142a: the page teaches eight steps, a glossary, and the four verbs", () => {
  const page = fs.readFileSync(PAGE, "utf8");
  for (let n = 1; n <= 8; n += 1)
    assert.match(page, new RegExp(`^## Step ${n} — `, "m"), `step ${n}`);
  assert.match(page, /^## Words used here/m);
  assert.match(page, /\| One behaviour to fix or change \| No brief/);
  // Commands the page shows; recorded outputs keep their own header.
  const commands = page.split("\n").filter((l: string) => /^\$ |^specgate /.test(l));
  assert.ok(
    commands.every((l: string) => !/specgate draft\b/.test(l)),
    commands.join("\n")
  );
});

test("REQ-142 SCN-142a: the page's example brief passes --check", (t: TestContext) => {
  const page = fs.readFileSync(PAGE, "utf8");
  const m = /<!-- specgate:example-brief -->\s*```markdown\n([\s\S]*?)\n```/.exec(page);
  assert.ok(m, "the page marks its example brief");
  // The example is the one the recorder runs, so the outputs on the page are its own.
  assert.equal(m![1] + "\n", LINGO_EXAMPLE);
  const { cli } = project(t, m![1] + "\n");
  const r = cli("propose", "--from-brief", "--check");
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Ready to draft/);
});

test("REQ-142: explore prints a project snapshot, not a brief", () => {
  const src = fs.readFileSync(
    path.join(ROOT_DIR, "scripts", "cli", "commands", "spec", "ExploreCommand.ts"),
    "utf8"
  );
  assert.doesNotMatch(src, /\bbrief\b/i);
  assert.match(src, /project snapshot/);
});

// ── REQ-243..246 (truck-flote, second run) ──────────────────────────────────

const FORJA_BRIEF = `---
product: truck-flote
surfaces: [api, web]
actors:
  - { name: Customer, surfaces: [api, web] }
modules: []
---

# Proyecto: control de flota

El despachador asigna cargas a los camiones en ruta.
`;

test("REQ-243 SCN-243a: status points at a brief still to fill in", (t: TestContext) => {
  const { dir, cli } = project(t, null);
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fleet", scripts: { test: "node -e 0" } })
  );
  // The helper's spec.md would read as "already spec-driven": adopt for real.
  fs.rmSync(path.join(dir, "spec.md"));
  assert.equal(cli("init", "--no-capabilities").status, 0);
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "brief.md"), FORJA_BRIEF);
  const r = cli("status");
  assert.match(r.stdout, /docs\/brief\.md/, r.stdout);
  assert.match(r.stdout, /specgate draft/, r.stdout);
  assert.doesNotMatch(r.stdout, /specgate new/, r.stdout);
});

test('REQ-244 SCN-244a: "dice si cabe" and "un desvío aceptable"', () => {
  const text = `${FRONT.replace("modules: [courses, lessons]", "modules: [carga]")}
${NOTES}
## Module: carga

Rules
- El sistema dice en menos de 1 s si cabe la carga.
- Un camión es candidato con un desvío aceptable.

Examples
- The one where una carga de 4 palés cabe en el camión.
- The one where un desvío de 20 km es aceptable.
`;
  const found = checkBrief(text, "docs/brief.md");
  const b11 = found.filter((d: { code: string }) => d.code === "B11_condition_last");
  assert.deepEqual(b11, [], '"si" after "dice" is whether, not a condition');
  const b5 = found.filter((d: { code: string }) => d.code === "B5_vague");
  assert.ok(
    b5.some((d: { message: string }) => /aceptable/.test(d.message)),
    JSON.stringify(found)
  );
  for (const vague of [
    "lo más cerca posible",
    "cerca del punto",
    "casi vacío",
    "as close as possible",
    "almost full",
  ]) {
    const one = text.replace("con un desvío aceptable", vague);
    assert.ok(
      checkBrief(one, "docs/brief.md").some((d: { code: string }) => d.code === "B5_vague"),
      vague
    );
  }
});

test("REQ-245 SCN-245a: ten modules and a driver on mobile, in a web project", () => {
  const modules = "[a, b, c, d, e, f, g, h, i, j]";
  const text = `---
product: truck-flote
surfaces: [api, web, mobile]
actors:
  - { name: Despachador, surfaces: [web] }
  - { name: Conductor, surfaces: [mobile] }
modules: ${modules}
---

El Despachador asigna cargas; el Conductor las ve en su teléfono.
`;
  const web = checkBrief(text, "docs/brief.md", { mobileApp: false });
  assert.ok(
    web.some(
      (d: { code: string; message: string }) =>
        d.code === "B12_too_many_modules" && /10/.test(d.message)
    )
  );
  assert.ok(
    web.some(
      (d: { code: string; message: string }) =>
        d.code === "B13_surface_missing" && /Conductor/.test(d.message) && /mobile/.test(d.message)
    )
  );
  const mobile = checkBrief(text, "docs/brief.md", { mobileApp: true });
  assert.ok(!mobile.some((d: { code: string }) => d.code === "B13_surface_missing"));
  const unknown = checkBrief(text, "docs/brief.md");
  assert.ok(
    !unknown.some((d: { code: string }) => d.code === "B13_surface_missing"),
    "no project, no comparison"
  );
});

test("REQ-246 SCN-246a: forja's template, modules empty", (t: TestContext) => {
  const { cli } = project(t, FORJA_BRIEF);
  const r = cli("draft");
  assert.notEqual(r.status, 0);
  for (const field of ["product", "surfaces", "actors", "modules"])
    assert.match(r.stdout, new RegExp(field), field);
  assert.match(r.stdout, /Customer/);
  assert.match(r.stdout, /specgate draft --agent/);
});

// ── REQ-251..253 (truck-flote, third run) ───────────────────────────────────

const CLIENT_BRIEF = `# Proyecto: control de flota

El despachador asigna cargas a los camiones en ruta.
`;

const FORJA_TEMPLATE = `---
product: truck-flote
surfaces: [api, web]
actors:
  - { name: Customer, surfaces: [api, web] }
modules: []
---

# Brief

Paste the client's brief here **as it is**, without rewriting it.
`;

test("REQ-251 SCN-251a: the client's brief pushed first, forja's template beside it", (t: TestContext) => {
  const { dir, cli } = project(t, null);
  fs.rmSync(path.join(dir, "spec.md"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fleet", scripts: { test: "node -e 0" } })
  );
  assert.equal(cli("init", "--no-capabilities").status, 0);
  fs.writeFileSync(path.join(dir, "brief.md"), CLIENT_BRIEF);
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "brief.md"), FORJA_TEMPLATE);
  for (const args of [["status"], ["draft"]]) {
    const r = cli(...args);
    const said = r.stdout + r.stderr;
    assert.match(said, /brief\.md at the root/, `${args[0]}: ${said}`);
    assert.match(said, /docs\/brief\.md/, args[0]);
  }
});

test("REQ-252 SCN-252a: forja's front matter, modules empty", (t: TestContext) => {
  const { cli } = project(t, FORJA_TEMPLATE);
  const r = cli("draft");
  assert.doesNotMatch(r.stdout, /no front matter yet/);
  assert.match(r.stdout, /front matter at the top of \S+ is incomplete/);
});

test("REQ-253 SCN-253a: the guide an agent reads", () => {
  const { briefSetupGuide } = require("../../scripts/draft/brief-setup");
  const guide = briefSetupGuide("docs/brief.md");
  assert.match(guide, /as the brief writes (it|them)/);
  assert.match(guide, /in the brief's language/);
  assert.match(guide, /three to eight/);
  assert.match(guide, /forja\.config\.json/);
});

test("REQ-257 SCN-257a: forja's front matter, modules empty", (t: TestContext) => {
  const { cli } = project(t, FORJA_TEMPLATE);
  assert.match(cli("draft").stdout, /These are the four fields\s+that tell Specgate what to draft/);
});

// ── REQ-259..260 (truck-flote, sixth run) ───────────────────────────────────

test("REQ-259 SCN-259a: the client's brief pushed first, forja's template beside it", (t: TestContext) => {
  const { dir, cli } = project(t, FORJA_TEMPLATE);
  fs.writeFileSync(path.join(dir, "brief.md"), CLIENT_BRIEF);
  const r = cli("draft");
  const text = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  const front = FORJA_TEMPLATE.slice(0, FORJA_TEMPLATE.indexOf("# Brief"));
  assert.ok(text.startsWith(front), text);
  assert.ok(text.includes(CLIENT_BRIEF), text);
  assert.doesNotMatch(text, /Paste the client's brief here/);
  assert.ok(fs.existsSync(path.join(dir, "brief.md")), "the root file is kept");
  assert.match(r.stdout, /brief\.md at the root/);
  assert.match(r.stdout, /now below the front matter of docs\/brief\.md/);
});

test("REQ-259 SCN-259b: a body the person wrote is left alone", (t: TestContext) => {
  const own = FORJA_TEMPLATE.replace(
    "Paste the client's brief here **as it is**, without rewriting it.",
    "Our own notes: the despachador plans the day's loads."
  );
  const { dir, cli } = project(t, own);
  fs.writeFileSync(path.join(dir, "brief.md"), CLIENT_BRIEF);
  cli("draft");
  assert.equal(fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8"), own);
});

const SETUP_STUB = `
const fs = require("fs");
const text = fs.readFileSync("docs/brief.md", "utf8");
fs.writeFileSync("docs/brief.md", ${JSON.stringify(FRONT)} + text);
`;

test("REQ-260 SCN-260a: the agent's front matter needs no fix", (t: TestContext) => {
  const p = project(t, NOTES);
  const stub = path.join(p.dir, "..", `setup-${path.basename(p.dir)}.js`);
  fs.writeFileSync(stub, SETUP_STUB);
  t.after(() => fs.rmSync(stub, { force: true }));
  const r = p.cli("draft", "--agent", `node ${stub}`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    fs.readFileSync(path.join(p.dir, "docs", "brief.md"), "utf8"),
    /^---\nproduct: Lingo/
  );
  assert.ok(!fs.existsSync(path.join(p.dir, "docs", "specs", "BRIEF-SETUP.md")), r.stdout);
  assert.equal(git(p.dir, "status", "--porcelain").trim(), "M docs/brief.md");
});
