"use strict";

/**
 * REQ-542, REQ-560 — the outputs for the business read a 1.0 change's
 * Discover: its Context is the why, its acceptance criteria are what the
 * review shows and the acceptance checks (change layered-outputs). A 0.x
 * change's proposal still reads as before.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const { intentOf } = require("../../packages/core/src/domain/ReleaseNotes");
const { renderAcceptance } = require("../../packages/core/src/domain/Acceptance");

const made: string[] = [];
require("node:test").after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
const sg = (dir: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};

const DISCOVER = `# Discover: pdf-invoices

## Context

<!-- Who has the problem, and what it costs them today. -->
Customers ask support for a copy of every invoice; a download ends that.

## Use case

A customer opens an invoice and downloads it.

## Acceptance criteria

- AC-1: A paid invoice downloads as a PDF.
- AC-2: Nobody downloads another customer's invoice.
`;

test("REQ-542: the why is the Discover's Context, or the proposal's Intent", () => {
  assert.equal(
    intentOf(DISCOVER),
    "Customers ask support for a copy of every invoice; a download ends that."
  );
  assert.equal(intentOf("# Proposal: x\n\n## Intent\n\nOld words.\n"), "Old words.");
});

test("REQ-560: the acceptance checks each criterion before the scenarios", () => {
  const md = renderAcceptance(
    "pdf-invoices",
    [
      {
        id: "REQ-001",
        title: "Download",
        scenarios: [{ title: "A paid one", steps: ["GIVEN x"] }],
      },
    ],
    [
      { id: "AC-1", text: "A paid invoice downloads as a PDF." },
      { id: "AC-2", text: "Nobody downloads another customer's invoice." },
    ]
  );
  const criteria = md.indexOf("## Acceptance criteria");
  assert.ok(criteria > 0 && criteria < md.indexOf("## REQ-001"));
  assert.match(md, /^- \[ \] AC-1: A paid invoice downloads as a PDF\.$/m);
  assert.match(md, /^- \[ \] AC-2: /m);
  assert.doesNotMatch(renderAcceptance("x", []), /Acceptance criteria/);
});

test("REQ-560 SCN-560a: a layered change reviewed and accepted", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-layered-"));
  made.push(parent);
  const init = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, fs.readdirSync(parent)[0]);
  assert.equal(sg(dir, "propose", "pdf-invoices").status, 0);
  const change = path.join(dir, "docs/specs/changes/pdf-invoices");
  fs.writeFileSync(path.join(change, "discover.md"), DISCOVER);

  assert.equal(sg(dir, "review", "pdf-invoices").status, 0);
  const html = fs.readFileSync(path.join(dir, "pdf-invoices-review.html"), "utf8");
  assert.match(html, /<h2>Why<\/h2><p>Customers ask support/);
  assert.match(html, /<h2>Acceptance criteria<\/h2>/);
  assert.match(html, /<strong>AC-2<\/strong> Nobody downloads another customer&#39;s invoice\./);
  assert.match(html, /<title>pdf-invoices<\/title>/);

  sg(dir, "acceptance", "pdf-invoices");
  const acceptance = fs.readFileSync(path.join(change, "acceptance.md"), "utf8");
  assert.match(acceptance, /^- \[ \] AC-1: A paid invoice downloads as a PDF\.$/m);
});
