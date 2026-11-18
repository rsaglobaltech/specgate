"use strict";

/**
 * Quality and objectives in the brief (change `brief-quality`, issue #485).
 *
 * A `## Quality` section read under ISO/IEC 25010:2023 (B14), a `## Why` that
 * states a success you can measure (B15), and each quality entry handed to
 * the draft that writes it as a non-functional requirement.
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
const {
  qualityCharacteristic,
  qualityFor,
  readBriefQuality,
} = require("../../packages/core/src/domain/BriefCards");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const FRONT = `---
product: Lingo — online lessons for a language school
surfaces: [api, web]
actors:
  - { name: Teacher, surfaces: [api, web] }
  - { name: Student, surfaces: [api, web] }
modules: [courses, lessons]
---

# Lingo
`;

const MODULES = `
## Module: courses

Rules
- A course holds at most 12 students.

Examples
- The one where a Student joins "Spanish A2", which has 11 students.

## Module: lessons

Rules
- A lesson belongs to one course.

Examples
- The one where a Teacher adds "Greetings" to "Spanish A2".
`;

/** A Lingo brief with these extra sections after the modules. */
const lingo = (...sections: string[]) => FRONT + MODULES + sections.join("\n");
const quality = (...items: string[]) => "\n## Quality\n\n" + items.map((i) => `- ${i}\n`).join("");

type Finding = { code: string; severity: string; target?: string; line?: number; fix?: string };
const check = (text: string): Finding[] => checkBrief(text, "docs/brief.md");
const only = (found: Finding[], prefix: string) => found.filter((d) => d.code.startsWith(prefix));

function git(dir: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}

/** A Specgate project in git, with docs/brief.md committed when given. */
function project(t: TestContext, text: string | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-quality-"));
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
  const codes = () => {
    const r = cli("propose", "--from-brief", "--check", "--json");
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    const found: string[] = JSON.stringify(doc).match(/"B1[45]_[a-z_]+"/g) || [];
    return { status: r.status, found: found.map((c) => c.slice(1, -1)) };
  };
  const guide = (module: string) =>
    fs.readFileSync(
      path.join(dir, "docs", "specs", "changes", `draft-${module}`, "DRAFTING.md"),
      "utf8"
    );
  return { dir, cli, codes, guide };
}

// ── REQ-601 ───────────────────────────────────────────────────────────────────

test("REQ-601 SCN-601a: a quality entry no test can check stops the draft", (t: TestContext) => {
  const text = lingo(quality("performance efficiency: The course list loads fast."));
  const found = only(check(text), "B14");
  assert.deepEqual(
    found.map((d) => [d.code, d.severity]),
    [["B14_quality_unmeasured", "error"]]
  );
  assert.equal(
    found[0].line,
    text.split("\n").indexOf("- performance efficiency: The course list loads fast.") + 1
  );

  const { cli, codes } = project(t, text);
  const r = codes();
  assert.equal(r.status, 1);
  assert.ok(r.found.includes("B14_quality_unmeasured"), r.found.join());
  const d = cli("propose", "--from-brief", "courses");
  assert.equal(d.status, 1, d.stdout + d.stderr);
  assert.match(d.stdout + d.stderr, /brief_not_ready/);
});

test("REQ-601 SCN-601b: measured entries and an alias pass; an unknown characteristic is a warning", (t: TestContext) => {
  const text = lingo(
    quality(
      "performance (courses): The course list loads in under 2 seconds for 500 students at once.",
      "disponibilidad: 99.5% each month.",
      "beauty: Every screen uses the school's colours."
    )
  );
  const found = only(check(text), "B14");
  assert.deepEqual(
    found.map((d) => [d.code, d.severity, d.target]),
    [["B14_quality_characteristic", "warning", "beauty"]]
  );
  for (const c of ["functional suitability", "interaction capability", "flexibility", "safety"]) {
    assert.ok(found[0].fix!.includes(c), c);
  }
  const { codes } = project(t, text);
  assert.equal(codes().status, 0);
});

test("REQ-601 SCN-601c: an unknown module is an error, an item with no characteristic a warning", () => {
  const found = only(
    check(
      lingo(
        quality(
          "security (billing): Card numbers are never stored.",
          "Every page meets WCAG 2.2 AA."
        )
      )
    ),
    "B14"
  );
  assert.deepEqual(
    found.map((d) => [d.code, d.severity]),
    [
      ["B14_quality_module", "error"],
      ["B14_quality_shape", "warning"],
    ]
  );
  assert.match(found.find((d) => d.code === "B14_quality_module")!.fix!, /courses, lessons/);
});

test("REQ-601: no quality section, no B14; aliases map to the 2023 names", () => {
  assert.deepEqual(only(check(lingo()), "B14"), []);
  assert.equal(qualityCharacteristic("Usability"), "interaction capability");
  assert.equal(qualityCharacteristic("portabilidad"), "flexibility");
  assert.equal(qualityCharacteristic("Seguridad"), "security");
  assert.equal(qualityCharacteristic("availability"), "reliability");
  assert.equal(qualityCharacteristic("rendimiento"), "performance efficiency");
  assert.equal(qualityCharacteristic("beauty"), undefined);
  const entries = readBriefQuality(
    "## Calidad\n\n<!-- - performance: fast -->\n- rendimiento (Courses, lessons): Under 2 s.\n  For 500 students.\n"
  );
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].modules, ["courses", "lessons"]);
  assert.equal(entries[0].statement, "Under 2 s. For 500 students.");
  assert.equal(entries[0].line, 4);
});

// ── REQ-602 ───────────────────────────────────────────────────────────────────

test("REQ-602 SCN-602a: a why with no number is a warning", (t: TestContext) => {
  const text = lingo(
    "\n## Why\n\nStudents lose track of their lessons. We want them to find them easily.\n"
  );
  const found = only(check(text), "B15");
  assert.deepEqual(
    found.map((d) => [d.code, d.severity]),
    [["B15_why_unmeasured", "warning"]]
  );
  const { codes } = project(t, text);
  const r = codes();
  assert.equal(r.status, 0);
  assert.ok(r.found.includes("B15_why_unmeasured"), r.found.join());
});

test("REQ-602 SCN-602b: a measured why, an absent one and a comment-only one report nothing", () => {
  for (const text of [
    lingo("\n## Why\n\nA student finds today's lesson in under 10 seconds.\n"),
    lingo(),
    lingo("\n## Why\n\n<!-- the problem, and a success you can measure -->\n"),
  ]) {
    assert.deepEqual(only(check(text), "B15"), []);
  }
});

// ── REQ-603 ───────────────────────────────────────────────────────────────────

const SCOPED = lingo(
  quality(
    "performance (lessons): A lesson opens in under 3 seconds.",
    "reliability: Available 99.5% of each month."
  )
);

test("REQ-603: scoped entries go to their module, product-wide ones to the first", () => {
  const texts = (m: string) => qualityFor(SCOPED, m).map((q: { text: string }) => q.text);
  assert.deepEqual(texts("courses"), ["reliability: Available 99.5% of each month."]);
  assert.deepEqual(texts("lessons"), ["performance (lessons): A lesson opens in under 3 seconds."]);
});

test("REQ-603 SCN-603a: each draft lists its own quality entries as non-functional requirements", (t: TestContext) => {
  for (const [module, mine, other] of [
    ["courses", "reliability: Available 99.5% of each month.", "A lesson opens in under 3 seconds"],
    ["lessons", "performance (lessons): A lesson opens in under 3 seconds.", "99.5%"],
  ]) {
    const { cli, guide } = project(t, SCOPED);
    const r = cli("propose", "--from-brief", module);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const g = guide(module);
    assert.match(g, /Quality requirements to write[\s\S]*kind `non-functional`/);
    assert.ok(g.includes(`- ${mine}`), `${module}: ${mine}`);
    assert.ok(!g.includes(other), `${module} must not list ${other}`);
  }
});

test("REQ-603 SCN-603b: the new brief teaches Quality and a measurable Why", (t: TestContext) => {
  const { dir, cli, codes } = project(t, null);
  const w = cli("propose", "--from-brief", "--new-brief");
  assert.equal(w.status, 0, w.stdout + w.stderr);
  const text = fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");
  assert.match(text, /## Quality\n\n<!--[\s\S]*ISO\/IEC 25010[\s\S]*-->/);
  assert.match(text, /## Why\n\n<!--[\s\S]*value and its unit[\s\S]*-->/);
  assert.deepEqual(codes().found, []);
});

test("REQ-603: the cards guide asks for a Quality section; the no-brief text names quality", () => {
  const { briefCardsGuide, noBriefExplanation } = require("../../scripts/draft/brief-setup");
  assert.match(briefCardsGuide("docs/brief.md", ["courses"]), /## Quality[\s\S]*ISO\/IEC 25010/);
  assert.match(noBriefExplanation("docs/brief.md"), /how well it must work/);
});

test("REQ-601: a percentage is a measure, for B14 and for D4", () => {
  const { unmeasured } = require("../../packages/core/src/domain/DraftChecklist");
  assert.equal(unmeasured("Available 99.5% of each month."), false);
  assert.equal(unmeasured("Uptime of 99.9% per month"), false);
  assert.equal(unmeasured("High availability"), true);
});
