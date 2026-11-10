/**
 * The code-scanning alerts closed before 0.33.0: text a person typed never
 * becomes a regular expression or breaks out of a Markdown cell or a shell
 * argument; a parser keeps linear time on hostile input; the studio never
 * sends an exception's details to the page.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { escapeRegExp, markdownCell, quoteArg } from "../../scripts/lib/escape";
import { definedIn, setStatusIn } from "../../scripts/lib/clarification";
import { slug } from "../../packages/core/src/domain/SpecParser";

/** The cells of a Markdown table row, split on pipes that are not escaped. */
function cells(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    if (ch === "\\" && i + 1 < row.length) {
      cur += ch + row[++i];
    } else if (ch === "|") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.slice(1, -1).map((c) => c.trim());
}

test("js/incomplete-sanitization: a Markdown cell escapes the backslash as well as the pipe, so `a\\|b` stays one cell", () => {
  for (const text of ["a|b", "ends with a backslash \\", "a\\|b", "\\\\|", "multi\nline | text"]) {
    const row = `| ${markdownCell(text)} | next |`;
    assert.equal(cells(row).length, 2, `${JSON.stringify(text)} → ${row}`);
  }
  assert.equal(markdownCell("a\\|b"), "a\\\\\\|b");
  assert.equal(markdownCell("  two\n lines "), "two lines");
});

test("js/incomplete-sanitization: an argument is quoted for the shell that reads it — POSIX and Windows", () => {
  assert.equal(quoteArg("plain-arg_1.0", "linux"), "plain-arg_1.0");
  assert.equal(quoteArg("it's $HOME `x`", "linux"), "'it'\\''s $HOME `x`'");
  assert.equal(quoteArg("claude -p < {prompt_file}", "darwin"), "'claude -p < {prompt_file}'");
  // Windows (CommandLineToArgvW): a backslash before a quote, and trailing ones, are doubled.
  assert.equal(quoteArg('say "hi"', "win32"), '"say \\"hi\\""');
  assert.equal(quoteArg("C:\\dir with space\\", "win32"), '"C:\\dir with space\\\\"');
  assert.equal(quoteArg('a\\"b', "win32"), '"a\\\\\\"b"');
});

test("js/regex-injection: a requirement id is matched literally — `REQ-1.*` finds nothing, and no pattern is built from it", () => {
  assert.equal(escapeRegExp("REQ-1.*(x)"), "REQ-1\\.\\*\\(x\\)");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-scan-"));
  try {
    fs.writeFileSync(
      path.join(dir, "spec.md"),
      "# Spec\n\n## REQ-017 — A total\n\nThe system SHALL total.\n\n<!-- specgate:trace status=Draft -->\n"
    );
    assert.equal(definedIn(dir, "REQ-1.*"), null);
    assert.equal(definedIn(dir, "REQ-1("), null, "an unbalanced pattern does not throw");
    assert.deepEqual(definedIn(dir, "REQ-017"), {
      change: "project",
      file: path.join(dir, "spec.md"),
    });
    assert.equal(
      setStatusIn(path.join(dir, "spec.md"), dir, "REQ-.*", "Needs Clarification"),
      false
    );
    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), /status=Draft/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("js/polynomial-redos: slug stays linear on a long run of dashes that does not end the text", () => {
  const hostile = "-".repeat(200_000) + "x";
  const start = process.hrtime.bigint();
  const s = slug(hostile);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(s, "x");
  assert.ok(ms < 200, `slug took ${ms.toFixed(0)} ms`);
  assert.equal(slug("  -Café — Total--  "), "cafe-total");
  assert.equal(slug("---"), "");
});
