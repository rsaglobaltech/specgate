// specgate:allow-placeholders — this file quotes the {{VAR}} template syntax.
/**
 * Every Gherkin file this repository ships, parsed by Cucumber's own parser.
 *
 * ## Why this exists (H14)
 *
 * 27 of the 28 scenarios in `packs/**` had **zero steps** as far as Cucumber was
 * concerned. The templates wrote their keywords in upper case:
 *
 *     Scenario: Evaluation respects rollout percentage
 *       GIVEN a flag with 50% rollout in production
 *       WHEN 100 users are evaluated
 *       THEN approximately half receive value=true
 *
 * **Gherkin keywords are case-sensitive.** `GIVEN` is not a keyword, so the real
 * parser absorbed those three lines as the scenario's *description*. No syntax
 * error, no warning: the scenario exists and is empty. And an empty scenario
 * passes — `1 scenario (1 passed) · 0 steps · exit 0`.
 *
 * That is H1 wearing a different coat. H1 was "the gate did not run the scenario
 * it was supervising"; this was "the scenario it supervises contains nothing to
 * run". Every project seeded with `specgate specops add` inherited a reward signal
 * that approves anything, and the harness driving those requirements was not
 * verifying — it was signing.
 *
 * Our own linter agreed everything was fine, because `pack lint` matches
 * `/(Given|When|Then|And|But)/i` — case-insensitively. It saw three steps where
 * Cucumber saw none. A linter that approves what the runner ignores is worse
 * than no linter: it grants a guarantee that does not exist.
 *
 * ## Why it is written against the reference parser
 *
 * The defect was invisible to three hand-written parsers in this repository and
 * obvious to `@cucumber/gherkin`, which is already a devDependency. Checking
 * shipped Gherkin with anything other than the parser that will actually run it
 * is how this happened, so this test imports the real one and no other.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const { Parser, AstBuilder, GherkinClassicTokenMatcher } = require("@cucumber/gherkin");
const { IdGenerator } = require("@cucumber/messages");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);

/** Where this repository keeps Gherkin it hands to other projects. */
const SHIPPED_ROOTS = ["packs", "templates"];

/**
 * Every shipped Gherkin file.
 *
 * `.env.feature`, `.env.feature.app` and `.env.feature.infra` are environment
 * files for the *feature* environment, not Gherkin — matching `*.feature`
 * naively picks them up and the parser then dies on `APP_ENV=feature`. Found by
 * writing this walk carelessly the first time.
 */
function shippedGherkinFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const isGherkin = entry.name.endsWith(".feature") || entry.name.endsWith(".feature.tpl");
      if (isGherkin && !entry.name.startsWith(".env")) out.push(full);
    }
  };
  for (const root of SHIPPED_ROOTS) walk(path.join(ROOT_DIR, root));
  return out.sort();
}

/**
 * Parse with Cucumber's parser, tolerating `{{PLACEHOLDER}}` tokens.
 *
 * A `.tpl` is Gherkin with variables in it; the placeholders sit inside step
 * text and headings, where Gherkin allows arbitrary prose, so they parse fine.
 */
function parseGherkin(file: string) {
  const source = fs.readFileSync(file, "utf8");
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
  return parser.parse(source);
}

/** Every scenario in a document, including those inside a Rule. */
function scenariosOf(doc: any): any[] {
  const out: any[] = [];
  const collect = (children: any[]) => {
    for (const child of children || []) {
      if (child.scenario) out.push(child.scenario);
      if (child.rule) collect(child.rule.children);
    }
  };
  collect(doc.feature?.children || []);
  return out;
}

test("every shipped Gherkin file parses with Cucumber's own parser", () => {
  const failures: string[] = [];
  for (const file of shippedGherkinFiles()) {
    try {
      parseGherkin(file);
    } catch (err) {
      failures.push(`${path.relative(ROOT_DIR, file)}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}`);
});

test("no shipped scenario is empty as far as Cucumber is concerned", () => {
  // The check H14 needed. An empty scenario passes, so a pack full of them
  // hands every project that installs it a gate that approves anything.
  const empty: string[] = [];
  let total = 0;

  for (const file of shippedGherkinFiles()) {
    for (const scenario of scenariosOf(parseGherkin(file))) {
      total += 1;
      if ((scenario.steps || []).length === 0) {
        empty.push(`${path.relative(ROOT_DIR, file)}: "${scenario.name}"`);
      }
    }
  }

  assert.ok(total > 0, "found no shipped scenarios to check — the walk is broken");
  assert.deepEqual(
    empty,
    [],
    `\n  These scenarios have zero steps for Cucumber and therefore pass without\n` +
      `  running anything. The usual cause is upper-case keywords: Gherkin is\n` +
      `  case-sensitive, so GIVEN/WHEN/THEN are read as description, not steps.\n` +
      `  Use Given / When / Then / And.\n\n  ${empty.join("\n  ")}`
  );
});

test("the walk finds the Gherkin that is really there", () => {
  // Guards the two tests above from passing by looking at nothing — the failure
  // mode that makes a green suite meaningless.
  const files = shippedGherkinFiles();
  assert.ok(files.length >= 30, `expected the shipped Gherkin corpus, found ${files.length} files`);
  assert.ok(
    files.some((f) => f.includes(`${path.sep}packs${path.sep}`)),
    "packs/ contributes no Gherkin — the walk is wrong"
  );
  assert.ok(
    files.some((f) => f.includes(`${path.sep}templates${path.sep}`)),
    "templates/ contributes no Gherkin — the walk is wrong"
  );
  assert.ok(
    !files.some((f) => path.basename(f).startsWith(".env")),
    "an .env.feature file is not Gherkin and must not be parsed as one"
  );
});
