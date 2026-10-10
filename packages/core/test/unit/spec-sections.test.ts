/**
 * Fase 3.1: `req add` wrote a matrix row and no prose anywhere.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  renderRequirementSection,
  hasRequirementSection,
  requirementSections,
  appendRequirementSection,
  extractRequirementSection,
  templateObligationLines,
} from "../../src/domain/SpecSections";

test("the generated section carries an obligation keyword", () => {
  // Otherwise the section fails --strict-requirements, and a project would be
  // failing a gate over text the tool itself just wrote.
  const section = renderRequirementSection("REQ-014", "Vets are listed alphabetically");
  assert.match(section, /^## REQ-014 — Vets are listed alphabetically$/m);
  assert.match(section, /\bMUST\b/);
});

test("the section says it is a draft, rather than pretending to be finished", () => {
  assert.match(renderRequirementSection("REQ-014", "Vets are listed"), /Replace this sentence/);
});

test("a title starting with an identifier still reads as a sentence", () => {
  // `MUST res.redirect sets Location` is not English. `MUST satisfy:` is, for
  // every title, without a heuristic that guesses at grammar.
  assert.match(
    renderRequirementSection("REQ-002", "res.redirect sets Location and status 302"),
    /MUST satisfy: res\.redirect sets Location and status 302\./
  );
  assert.match(
    renderRequirementSection("REQ-003", "HTTP caching is respected"),
    /MUST satisfy: HTTP caching is respected\./
  );
});

test("an existing section is found, and a different id is not", () => {
  const spec = "# Spec\n\n## REQ-001 — One\n\ntext\n\n## REQ-014 — Fourteen\n\ntext\n";
  assert.equal(hasRequirementSection(spec, "REQ-014"), true);
  assert.equal(hasRequirementSection(spec, "REQ-01"), false, "REQ-01 must not match REQ-014");
  assert.equal(hasRequirementSection(spec, "REQ-999"), false);
  assert.deepEqual(requirementSections(spec), ["REQ-001", "REQ-014"]);
});

test("a mention in prose is not a section, but a nested heading is", () => {
  // The shipped template puts requirements under "8. Key requirements", so
  // insisting on top-level `##` would reject documents that are perfectly well
  // organised. A sentence naming the id is still not a section.
  assert.equal(hasRequirementSection("# Spec\n\nSee REQ-014 for details.\n", "REQ-014"), false);
  assert.equal(hasRequirementSection("# Spec\n\n### REQ-014 — Nested\n\ntext\n", "REQ-014"), true);
  assert.equal(hasRequirementSection("# Spec\n\n##### REQ-014 — Too deep\n", "REQ-014"), false);
});

test("a nested section ends at the next heading of its own level", () => {
  const spec = [
    "## 8. Key requirements",
    "",
    "### REQ-001 — First",
    "",
    "The system MUST do the first thing.",
    "",
    "#### Notes",
    "",
    "still part of REQ-001",
    "",
    "### REQ-002 — Second",
    "",
    "not part of REQ-001",
  ].join("\n");
  const section = extractRequirementSection(spec, "REQ-001");
  assert.match(section!, /MUST do the first thing/);
  assert.match(section!, /still part of REQ-001/, "a deeper sub-heading stays inside");
  assert.doesNotMatch(section!, /not part of REQ-001/);
});

test("appending adds the section once and is idempotent", () => {
  const before = "# Spec\n\n## REQ-001 — One\n\ntext\n";
  const first = appendRequirementSection(before, "REQ-002", "Totals are rounded");
  assert.equal(first.added, true);
  assert.equal(hasRequirementSection(first.content, "REQ-002"), true);

  const second = appendRequirementSection(first.content, "REQ-002", "Totals are rounded");
  assert.equal(second.added, false);
  assert.equal(second.content, first.content, "running req add twice must not duplicate prose");
});

test("appending does not reorder what a person wrote", () => {
  // spec.md is a document someone writes in. Sorting their prose to satisfy an
  // id order is a worse surprise than a section at the end.
  const before = "# Spec\n\n## REQ-050 — Later\n\ntext\n";
  const after = appendRequirementSection(before, "REQ-002", "Earlier").content;
  assert.ok(after.indexOf("REQ-050") < after.indexOf("REQ-002"));
});

test("an empty spec gets a section without a leading blank run", () => {
  const { content } = appendRequirementSection("", "REQ-001", "First");
  assert.ok(content.startsWith("## REQ-001"));
});

// ── The shapes real documents turned out to use ──────────────────────────────

test("a labelled heading declares its requirement", () => {
  // `### Requirement: REQ-100 — title` is what capability specs use. Four
  // shapes turned up before this stopped enumerating them.
  const spec = "## Requirements\n\n### Requirement: REQ-100 — A change is a folder\n\ntext\n";
  assert.equal(hasRequirementSection(spec, "REQ-100"), true);
  assert.match(extractRequirementSection(spec, "REQ-100")!, /A change is a folder/);
});

test("the §8 table counts as the requirement's text", () => {
  // The original `init` template, and this repository's own spec.md. Outlawing
  // it would have turned every project built from that template red on
  // upgrade, over text that is right there in the document.
  const spec = [
    "## 8. Key requirements",
    "",
    "| ID | Requirement | Priority | Status |",
    "|---|---|---|---|",
    "| REQ-001 | `init` generates a valid project skeleton. | Must | Verified |",
    "| REQ-002 | - | Must | Draft |",
  ].join("\n");
  assert.equal(hasRequirementSection(spec, "REQ-001"), true);
  assert.match(extractRequirementSection(spec, "REQ-001")!, /generates a valid project skeleton/);

  // A row with no prose is an id with nothing behind it — the case worth catching.
  assert.equal(hasRequirementSection(spec, "REQ-002"), false);
  assert.deepEqual(requirementSections(spec), ["REQ-001"]);
});

test("a TBD or empty requirement cell is not text", () => {
  for (const cell of ["TBD", "", "   ", "-"]) {
    const spec = `| ID | Requirement |\n|---|---|\n| REQ-005 | ${cell} |\n`;
    assert.equal(hasRequirementSection(spec, "REQ-005"), false, `'${cell}' should not count`);
  }
});

test("the generated obligation is recognised until it is replaced (#67)", () => {
  const section = renderRequirementSection("REQ-002", "El carrito suma el total");
  assert.equal(templateObligationLines(section).length, 2);

  const rewritten = section
    .replace(
      "The system MUST satisfy: El carrito suma el total.",
      "El sistema DEBE sumar precio por cantidad de cada línea."
    )
    .replace(/^> Written by Specgate\..*$/m, "");
  assert.deepEqual(templateObligationLines(rewritten), []);
});

test("a real obligation that says 'satisfy:' is not the template", () => {
  const section =
    "## REQ-003 — Orders are valid\n\nThe system MUST satisfy: every rule in docs/rules.md.\n";
  assert.deepEqual(templateObligationLines(section), []);
});
