/**
 * The getting-started journeys, recorded from the real CLI into the pages.
 *
 * `docs/start/*.md` shows what each command prints. Typed by hand, that output
 * would be wrong by the next release — and a newcomer comparing their terminal
 * with the page is exactly the reader who notices. So every output block is
 * generated: this script builds the two projects in a scratch home, runs each
 * step of `journey-storyboard.ts`, flattens what varies (paths, dates, SHAs)
 * with the landing recording's own rules, and writes the result between the
 * page's `out-<id>` sentinels.
 *
 *   npm run docs:journey          rewrite the blocks
 *   npm run docs:journey:check    fail if a page no longer matches the CLI
 *
 * What a person or their agent writes between commands — the brief, the
 * draft, the test, the code — is written here too, off the record, and every
 * page says who wrote it. Nothing shown is staged: the commands are real.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ASSUMPTIONS_MD,
  BOOKINGS_JS,
  BOOKINGS_TEST_JS,
  BRIEF_MD,
  QUESTIONS_MD,
  assertNoSecrets,
  buildEnv,
  draftSpec,
  gitInit,
  normalise,
  prepareBin,
  run,
  write,
  type NormaliseContext,
} from "./record-terminal";
import { readBlock, replaceBlock } from "./blocks";
import {
  JOURNEYS,
  blockName,
  displayCommand,
  type Journey,
  type JourneyStep,
} from "./journey-storyboard";

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");

type Hook = (project: string, env: NodeJS.ProcessEnv) => void;

const CHANGE = path.join("docs", "specs", "changes", "draft-bookings");

function commit(project: string, env: NodeJS.ProcessEnv, message: string): void {
  run(project, env, ["git", "add", "-A"]);
  run(project, env, ["git", "commit", "-qm", message]);
}

// ── Writing the brief: Lingo ─────────────────────────────────────────────────

/** Lingo's brief as its owner wrote it: plain notes, no front matter. */
export const LINGO_BRIEF = `# Lingo

Lingo is an online language school. A teacher runs small groups of adult
students.

The teacher creates courses by level and publishes lessons with their
material. Students follow their course on the web or on their phone, do the
exercises of each lesson and see their progress. The teacher sees each
student's progress and corrects written exercises.

We don't know yet whether students pay per course or per month.
`;

/** What the stand-in for Claude proposes. The real agent reads the same guide. */
const LINGO_FRONT_MATTER = `---
product: Lingo — online lessons for a language school
surfaces: [web, mobile]
actors:
  - { name: Teacher, surfaces: [web] }
  # check: the brief says students use "the web or their phone"
  - { name: Student, surfaces: [web, mobile] }
modules: [courses, lessons, exercises, progress]
---

`;

function lingoProject(scratch: string, name: string, env: NodeJS.ProcessEnv): string {
  const project = path.join(scratch, name);
  write(
    path.join(project, "package.json"),
    `${JSON.stringify({ name, version: "1.0.0", scripts: { test: "node --test" } }, null, 2)}\n`
  );
  gitInit(project, env);
  run(project, env, ["specgate", "init", "--no-capabilities"]);
  commit(project, env, "npm init, specgate init");
  return project;
}

const BRIEF_HOOKS: Record<string, Hook> = {
  "brief-none": (project, env) => {
    lingoProject(path.dirname(project), "lingo", env);
    lingoProject(path.dirname(project), "lingo-new", env);
  },
  // You: your notes, saved as they are.
  "brief-plain": (project, env) => {
    const lingo = path.join(path.dirname(project), "lingo");
    write(path.join(lingo, "docs", "brief.md"), LINGO_BRIEF);
    commit(lingo, env, "the brief");
  },
  // A stand-in for `claude -p` on PATH: it reads the prompt and does what
  // BRIEF-SETUP.md asks — a front matter on top, the notes untouched.
  "brief-agent": (project) => {
    const scratch = path.dirname(project);
    const fmFile = path.join(scratch, "tmp", "lingo-front-matter.md");
    write(fmFile, LINGO_FRONT_MATTER);
    const claude = path.join(scratch, "bin", "claude");
    fs.writeFileSync(
      claude,
      [
        "#!/usr/bin/env bash",
        "cat > /dev/null",
        `cat "${fmFile}" docs/brief.md > docs/brief.md.new && mv docs/brief.md.new docs/brief.md`,
        'echo "Added a front matter to docs/brief.md: 2 actors, 4 modules; one line marked to check."',
        "",
      ].join("\n"),
      { mode: 0o755 }
    );
  },
  // You, reviewing: a tablet, an admin, a module written as a title.
  "brief-error": (project) => {
    const brief = path.join(path.dirname(project), "lingo", "docs", "brief.md");
    const text = fs
      .readFileSync(brief, "utf8")
      .replace(
        "  - { name: Teacher, surfaces: [web] }",
        "  - { name: Teacher, surfaces: [web, tablet] }\n  - { name: Admin }"
      )
      .replace(
        "modules: [courses, lessons, exercises, progress]",
        "modules: [courses, lessons, Live classes, progress]"
      );
    write(brief, text);
  },
  // You: fixed — the front matter the agent proposed, reviewed.
  "brief-ready": (project) => {
    const brief = path.join(path.dirname(project), "lingo", "docs", "brief.md");
    write(brief, LINGO_FRONT_MATTER + LINGO_BRIEF);
  },
};

// ── From scratch: court bookings ────────────────────────────────────────────

const SCRATCH_SETUP: { before: Hook; steps: Record<string, Hook> } = {
  // What `npm init -y` writes, minus what changes between npm versions.
  before: (project, env) => {
    write(
      path.join(project, "package.json"),
      `${JSON.stringify({ name: "court-bookings", version: "1.0.0", scripts: { test: "node --test" } }, null, 2)}\n`
    );
    gitInit(project, env);
    commit(project, env, "npm init");
  },
  steps: {
    ...BRIEF_HOOKS,
    // You: the brief, as the client sent it.
    "scratch-draft-list": (project, env) => {
      write(path.join(project, "docs", "brief.md"), BRIEF_MD);
      commit(project, env, "the specification setup and the brief");
    },
    // Your agent: the first draft, with the fee the brief never states.
    "scratch-draft-check": (project) => {
      write(path.join(project, CHANGE, "specs", "bookings", "spec.md"), draftSpec(false));
    },
    // You: the fee becomes a question; the HTTP codes an assumption.
    "scratch-draft-check-again": (project) => {
      write(path.join(project, CHANGE, "specs", "bookings", "spec.md"), draftSpec(true));
      write(path.join(project, CHANGE, "assumptions.md"), ASSUMPTIONS_MD);
      write(path.join(project, CHANGE, "questions.md"), QUESTIONS_MD);
    },
    // You or your agent: the test first, then the code.
    "scratch-node-test": (project, env) => {
      commit(project, env, "the specification");
      write(path.join(project, "test", "bookings.test.js"), BOOKINGS_TEST_JS);
      write(path.join(project, "src", "bookings.js"), BOOKINGS_JS);
    },
    "scratch-harness-prompt": (project, env) => commit(project, env, "REQ-002: book a court"),
    "scratch-ci": (project, env) => commit(project, env, "REQ-002 done"),
  },
};

// ── An existing project: invoicing ──────────────────────────────────────────

const TOTAL_JS = `/** Sum of the lines, VAT included, rounded to the cent. */
function total(lines, vatRate) {
  const net = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  return Math.round(net * (1 + vatRate) * 100) / 100;
}

module.exports = { total };
`;

const NUMBERING_JS = `/** Invoice numbers run per year and never repeat: 2026-0001, 2026-0002, … */
const last = new Map();

function next(year) {
  const n = (last.get(year) || 0) + 1;
  last.set(year, n);
  return \`\${year}-\${String(n).padStart(4, "0")}\`;
}

module.exports = { next };
`;

const CUSTOMERS_JS = `const customers = new Map();

function register(id, name, taxId) {
  if (customers.has(id)) throw new Error("customer already registered");
  customers.set(id, { id, name, taxId });
}

module.exports = { register, find: (id) => customers.get(id) };
`;

function totalTest(named: boolean): string {
  const tag = named ? "REQ-004: " : "";
  return `const test = require("node:test");
const assert = require("node:assert");
const { total } = require("../src/invoices/total");

test("${tag}three lines at 21% VAT are rounded to the cent", () => {
  const lines = [
    { quantity: 3, unitPrice: 0.1 },
    { quantity: 1, unitPrice: 19.99 },
    { quantity: 2, unitPrice: 4.55 },
  ];
  assert.equal(total(lines, 0.21), 35.56);
});
`;
}

const NUMBERING_TEST_JS = `const test = require("node:test");
const assert = require("node:assert");
const { next } = require("../src/invoices/numbering");

test("numbers run per year", () => {
  assert.equal(next(2026), "2026-0001");
  assert.equal(next(2026), "2026-0002");
});
`;

const ROUNDING_FEATURE = (
  req: string,
  scn: string
) => `Feature: An invoice total is rounded to the cent

  @${req} @${scn}
  Scenario: Three lines at 21% VAT
    Given an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
    When its total is computed at 21% VAT
    Then the total is 35.56
`;

const EXISTING_SETUP: { before: Hook; steps: Record<string, Hook> } = {
  before: (project, env) => {
    write(
      path.join(project, "package.json"),
      `${JSON.stringify({ name: "invoicing", version: "2.3.0", scripts: { test: "node --test" } }, null, 2)}\n`
    );
    write(path.join(project, "src", "invoices", "total.js"), TOTAL_JS);
    write(path.join(project, "src", "invoices", "numbering.js"), NUMBERING_JS);
    write(path.join(project, "src", "customers", "customers.js"), CUSTOMERS_JS);
    write(path.join(project, "test", "total.test.js"), totalTest(false));
    write(path.join(project, "test", "numbering.test.js"), NUMBERING_TEST_JS);
    gitInit(project, env);
    commit(project, env, "invoicing 2.3.0");
  },
  steps: {
    "existing-status": (project, env) => commit(project, env, "adopt specgate"),
    // You: the placeholders `new` wrote, replaced with the real example.
    "existing-feature": (project) => {
      const file = path.join(project, "features", "an-invoice-total-is-rounded-to.feature");
      const tags = /@(REQ-\d+) @(SCN-\d+)/.exec(fs.readFileSync(file, "utf8"));
      if (!tags)
        throw new Error("`new` wrote no tags — the journey's scenario cannot be filled in");
      fs.writeFileSync(file, ROUNDING_FEATURE(tags[1], tags[2]), "utf8");
      const spec = path.join(project, "spec.md");
      fs.writeFileSync(
        spec,
        fs
          .readFileSync(spec, "utf8")
          .replace(
            /(## REQ-004[^\n]*\n)([\s\S]*?)(?=\n## |\n---|$)/,
            (_m, head) =>
              `${head}\n<!-- specgate:trace kind=business-rule -->\n\nThe system SHALL round an invoice total, VAT included, to the cent.\n`
          ),
        "utf8"
      );
    },
    // You: the test you already had, now naming the requirement.
    "existing-test": (project) =>
      write(path.join(project, "test", "total.test.js"), totalTest(true)),
    "existing-ci": (project, env) => commit(project, env, "REQ-004 done"),
  },
};

const SETUP: Record<Journey["id"], { before: Hook; steps: Record<string, Hook> }> = {
  scratch: SCRATCH_SETUP,
  existing: EXISTING_SETUP,
};

// ── Capture ─────────────────────────────────────────────────────────────────

export interface Output {
  step: JourneyStep;
  exit: number;
  /** The block's contents: a fenced transcript. */
  block: string;
}

export function renderBlock(step: JourneyStep, lines: string[], omitted: number): string {
  const body = [`$ ${displayCommand(step)}`, ...lines];
  if (omitted > 0) body.push(`… ${omitted} more line${omitted === 1 ? "" : "s"}`);
  return ["```text", ...body, "```"].join("\n");
}

export function recordJourney(journey: Journey, keep = false): Output[] {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-journey-"));
  const env = buildEnv(scratch);
  const ctx: NormaliseContext = {
    scratch: [...new Set([fs.realpathSync(scratch), scratch])].sort((a, b) => b.length - a.length),
    repoRoot: ROOT,
    home: os.homedir(),
    hostname: os.hostname(),
    shas: new Map(),
  };
  const project = path.join(scratch, journey.project);
  const setup = SETUP[journey.id];
  const out: Output[] = [];
  try {
    prepareBin(scratch);
    fs.mkdirSync(project, { recursive: true });
    setup.before(project, env);
    for (const step of journey.steps) {
      setup.steps[step.id]?.(project, env);
      const argv = step.shell ? ["bash", "-c", step.shell] : [...(step.argv || [])];
      const r = spawnSync(argv[0], argv.slice(1), {
        cwd: path.join(scratch, step.cwd),
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      });
      if (r.error) throw new Error(`${step.id}: ${r.error.message}`);
      const lines = `${r.stdout || ""}${r.stderr || ""}`
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => normalise(l, ctx));
      lines.forEach((l) => assertNoSecrets(l, step.id));
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      while (lines.length && lines[0].trim() === "") lines.shift();
      const kept = lines.slice(0, step.maxLines);
      out.push({
        step,
        exit: r.status === null ? -1 : r.status,
        block: renderBlock(step, kept, lines.length - kept.length),
      });
    }
    return out;
  } finally {
    if (keep) process.stderr.write(`kept ${scratch}\n`);
    else fs.rmSync(scratch, { recursive: true, force: true });
  }
}

export function pagePath(step: JourneyStep): string {
  return path.join(DOCS, `${step.page}.md`);
}

function main(): void {
  const check = process.argv.includes("--check");
  const keep = process.argv.includes("--keep");
  const problems: string[] = [];
  for (const journey of JOURNEYS) {
    for (const { step, exit, block } of recordJourney(journey, keep)) {
      const expected = step.expectExit ?? 0;
      if (exit !== expected) problems.push(`${step.id} exited ${exit}, expected ${expected}`);
      const file = pagePath(step);
      const source = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (check) {
        if ((readBlock(source, blockName(step)) || "") !== block.trim()) {
          problems.push(`${step.page}.md: ${blockName(step)} no longer matches the CLI`);
        }
      } else if (source) {
        fs.writeFileSync(file, replaceBlock(source, blockName(step), block), "utf8");
      } else {
        problems.push(`${step.page}.md does not exist`);
      }
    }
  }
  if (problems.length > 0) {
    process.stderr.write(`${problems.join("\n")}\n`);
    if (check) process.stderr.write("run `npm run docs:journey`\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(check ? "the journey pages are current\n" : "recorded the journey pages\n");
}

if (require.main === module) main();
