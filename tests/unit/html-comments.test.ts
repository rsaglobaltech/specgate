"use strict";

/**
 * Comment stripping and HTML-to-text without the patterns CodeQL reports
 * (js/incomplete-multi-character-sanitization, js/polynomial-redos,
 * js/double-escaping) — found when the 1.0 line met main's required checks.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  trimEndChars,
  withoutHtmlComments,
} = require("../../packages/core/src/domain/HtmlComments");
const { htmlToText } = require("../../scripts/alm/providers/azure");

test("every comment goes, an unterminated one to the end", () => {
  assert.equal(withoutHtmlComments("a <!-- x --> b <!-- y --> c"), "a  b  c");
  assert.equal(withoutHtmlComments("keep <!-- never closed"), "keep ");
  assert.equal(withoutHtmlComments("no comment"), "no comment");
  // What a one-pass regex leaves behind is gone here.
  assert.ok(!withoutHtmlComments("<!<!---->-- x -->").includes("<!--"));
});

test("a comment alone on its line leaves no blank line", () => {
  assert.equal(
    withoutHtmlComments("## Story\n  <!-- hint -->  \nThe text.\n", { wholeLine: true }),
    "## Story\nThe text.\n"
  );
});

test("trailing punctuation is trimmed in linear time", () => {
  assert.equal(trimEndChars("api=x.yaml#op).,", ".,;:)"), "api=x.yaml#op");
  const many = "x" + ")".repeat(50000) + "y";
  const t0 = Date.now();
  assert.equal(trimEndChars(many, ".,;:)"), many);
  assert.ok(Date.now() - t0 < 200);
});

test("a work item's HTML reads as plain text, tags gone and entities decoded once", () => {
  assert.equal(htmlToText("<p>Pay <b>now</b></p><div>A &amp; B</div>"), "Pay now\nA & B");
  assert.equal(htmlToText("&amp;lt;b&amp;gt;"), "&lt;b&gt;", "decoded once, not twice");
  assert.ok(!/<script/i.test(htmlToText("<scr<b>ipt>alert(1)</scr</b>ipt>")));
});
