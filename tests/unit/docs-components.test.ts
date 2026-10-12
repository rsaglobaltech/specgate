"use strict";

/**
 * The content components, tested against the module rather than the site.
 *
 * These exist so a guide can show two installation routes side by side without
 * a reader scrolling past the one that does not apply to them. The property
 * that matters most is the last test in this file: a malformed directive stops
 * the build. A component that silently swallows a section is worse than no
 * component, because nobody finds out.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { expandComponents, ComponentError } = require("../../scripts/docs/components");

/** Stand-ins for the site's own renderer and link rewriter. */
const inline = (md: string) => `<p>${md.trim()}</p>`;
const href = (h: string) => h.replace(/\.md$/, ".html");

const expand = (source: string, slug = "page") => expandComponents(source, slug, inline, href);

// ── cards ────────────────────────────────────────────────────────────────────

test("a list of links becomes a grid of cards", () => {
  const html = expand(
    [
      "<!-- specgate:cards cols=3 -->",
      "- [Quickstart](./quickstart.md) — One page.",
      "- [Harness](./harness.md) — Drive an agent.",
      "<!-- specgate:endcards -->",
    ].join("\n")
  );

  assert.match(html, /<div class="cards" data-cols="3">/);
  assert.match(html, /<strong class="card__title">Quickstart<\/strong>/);
  assert.match(html, /<span class="card__body">One page\.<\/span>/);
  assert.equal((html.match(/class="card"/g) || []).length, 2);
});

test("card links go through the site's rewriter, never to raw markdown", () => {
  // The whole site is careful not to send a reader to a `.md` file; a card that
  // skipped the rewriter would be the one place that did.
  const html = expand(
    [
      "<!-- specgate:cards -->",
      "- [Harness](./harness.md) — Drive an agent.",
      "<!-- specgate:endcards -->",
    ].join("\n")
  );
  assert.match(html, /href="\.\/harness\.html"/);
  assert.doesNotMatch(html, /href="[^"]*\.md"/);
});

test("a description is optional", () => {
  const html = expand(
    ["<!-- specgate:cards -->", "- [Harness](./harness.md)", "<!-- specgate:endcards -->"].join(
      "\n"
    )
  );
  assert.match(html, /card__title">Harness</);
  assert.doesNotMatch(html, /card__body/);
});

// ── tabs ─────────────────────────────────────────────────────────────────────

test("tabs render one panel visible and the rest hidden", () => {
  const html = expand(
    [
      "<!-- specgate:tabs -->",
      "<!-- specgate:tab npm -->",
      "install with npm",
      "<!-- specgate:tab Docker -->",
      "install with docker",
      "<!-- specgate:endtabs -->",
    ].join("\n")
  );

  assert.equal((html.match(/role="tab"/g) || []).length, 2);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((html.match(/hidden>/g) || []).length, 1, "exactly one panel is hidden");
  // Only the selected tab is reachable by Tab; the arrows move between them.
  assert.match(html, /tabindex="0"/);
  assert.match(html, /tabindex="-1"/);
});

test("every tab panel is labelled by its own tab", () => {
  const html = expand(
    ["<!-- specgate:tabs -->", "<!-- specgate:tab One -->", "a", "<!-- specgate:endtabs -->"].join(
      "\n"
    )
  );
  const tab = /id="([^"]+)" aria-controls="([^"]+)"/.exec(html);
  assert.ok(tab, "tab is missing its id/aria-controls pair");
  assert.match(html, new RegExp(`id="${tab![2]}" aria-labelledby="${tab![1]}"`));
});

// ── steps ────────────────────────────────────────────────────────────────────

test("steps are numbered from their headings", () => {
  const html = expand(
    [
      "<!-- specgate:steps -->",
      "### Install",
      "run it",
      "### Verify",
      "check it",
      "<!-- specgate:endsteps -->",
    ].join("\n")
  );

  assert.match(html, /<ol class="steps">/);
  assert.match(html, /steps__n" aria-hidden="true">1</);
  assert.match(html, /steps__n" aria-hidden="true">2</);
  assert.match(html, /steps__title">Install</);
});

// ── callouts ─────────────────────────────────────────────────────────────────

test("each callout kind carries its own label", () => {
  for (const [kind, label] of [
    ["note", "Note"],
    ["tip", "Tip"],
    ["warning", "Warning"],
    ["danger", "Careful"],
  ]) {
    const html = expand(`<!-- specgate:${kind} -->\nbody\n<!-- specgate:end${kind} -->`);
    assert.match(html, new RegExp(`callout--${kind}`));
    assert.match(html, new RegExp(`>${label}</p>`));
    assert.match(html, /role="note"/);
  }
});

// ── failure, which is the point ──────────────────────────────────────────────

test("an unclosed directive fails the build rather than eating the rest", () => {
  assert.throws(
    () => expand("<!-- specgate:cards -->\n- [A](./a.md) — x", "guide"),
    (error: Error) => {
      assert.ok(error instanceof ComponentError);
      assert.match(error.message, /guide\.md/, "the message names the page to fix");
      assert.match(error.message, /never closed/);
      return true;
    }
  );
});

test("a closer with no opener fails too", () => {
  assert.throws(() => expand("text\n<!-- specgate:endsteps -->", "guide"), ComponentError);
});

test("a tab outside a tabs block fails", () => {
  assert.throws(() => expand("<!-- specgate:tab One -->\nbody", "guide"), ComponentError);
});

test("cards with no items fail rather than rendering an empty grid", () => {
  assert.throws(
    () => expand("<!-- specgate:cards -->\njust prose\n<!-- specgate:endcards -->"),
    ComponentError
  );
});

test("two blocks of the same kind on one page both expand", () => {
  const one = "<!-- specgate:note -->\nfirst\n<!-- specgate:endnote -->";
  const html = expand(`${one}\n\ntext\n\n${one}`);
  assert.equal((html.match(/class="callout callout--note"/g) || []).length, 2);
});

test("markdown with no directives is returned untouched", () => {
  const source = "# Title\n\nA paragraph with a <!-- plain comment -->.\n";
  assert.equal(expand(source), source);
});
