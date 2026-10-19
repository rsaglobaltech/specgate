"use strict";

// specgate:allow-placeholders — these tests feed the scanner {{VAR}} tokens on purpose.

/**
 * The unresolved-placeholder scan, which `validate` and `doctor` share.
 *
 * They used to have a copy each, and the copies drifted: fixing `validate` to
 * skip dependency trees, template files and documentation that quotes the
 * syntax left `doctor` reporting 64 errors on this repository, every one a
 * false positive.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  findUnresolvedPlaceholders,
  missingVariables,
  isExempt,
} = require("../../scripts/lib/placeholders");

function withTree(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "placeholders-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
  return dir;
}

test("reports a genuinely unresolved placeholder", () => {
  const dir = withTree({ "spec.md": "# {{PROJECT_NAME}}\n" });
  assert.deepEqual(findUnresolvedPlaceholders(dir), ["spec.md"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("does not scan dependency trees or build output", () => {
  const dir = withTree({
    "node_modules/mustache/README.md": "use {{NAME}} in your template\n",
    "dist/bundle.js": "var t = '{{TOKEN}}';\n",
    "coverage/report.html": "<pre>{{VAR}}</pre>\n",
    "spec.md": "# Clean\n",
  });
  // Any project with dependencies installed would otherwise fail on its own
  // template libraries.
  assert.deepEqual(findUnresolvedPlaceholders(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a .tpl file is unrendered by definition, not defective", () => {
  const dir = withTree({ "templates/base/spec.md.tpl": "# {{PROJECT_NAME}}\n" });
  assert.deepEqual(findUnresolvedPlaceholders(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an explicit marker exempts documentation that quotes the syntax", () => {
  const dir = withTree({
    "docs/how-to.md": "<!-- specgate:allow-placeholders -->\nUse {{PROJECT_NAME}} in templates.\n",
    "docs/other.md": "Someone left a real {{PROJECT_NAME}} here.\n",
  });
  // Exemption is declared, never inferred.
  assert.deepEqual(findUnresolvedPlaceholders(dir), ["docs/other.md"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the marker works in any comment syntax", () => {
  assert.equal(isExempt("a.md", "<!-- specgate:allow-placeholders -->\n{{X}}"), true);
  assert.equal(isExempt("a.ts", "// specgate:allow-placeholders\n{{X}}"), true);
  assert.equal(isExempt("a.yaml", "# specgate:allow-placeholders\n{{X}}"), true);
  assert.equal(isExempt("a.md", "{{X}}"), false);
});

test("missingVariables names what still has to be supplied", () => {
  const dir = withTree({
    "spec.md": "{{PROJECT_NAME}} and {{DOMAIN}}\n",
    "README.md": "{{PROJECT_NAME}}\n",
  });
  const offenders = findUnresolvedPlaceholders(dir);
  assert.deepEqual(missingVariables(dir, offenders), ["DOMAIN", "PROJECT_NAME"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("generated report output is not scanned", () => {
  // The Stryker HTML report embeds mutated source, template tokens included.
  const dir = withTree({
    "reports/mutation/mutation.html": "<pre>{{PROJECT_NAME}}</pre>\n",
    "spec.md": "# Clean\n",
  });
  assert.deepEqual(findUnresolvedPlaceholders(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── Gitignored output is not the project's specs ─────────────────────────────
//
// SKIP_DIRS is a fixed list and cannot know what a given project ignores. This
// repository generates a gitignored `book/` full of `{{VAR}}` — it documents
// the placeholder syntax — and `validate` reported every one as unresolved.
// The project's own ignore file already states what is not source.

function repoWithIgnored(ignoreLine: string, files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-ignored-"));
  spawnSync("git", ["-C", dir, "init", "--quiet"], { encoding: "utf8" });
  fs.writeFileSync(path.join(dir, ".gitignore"), `${ignoreLine}\n`, "utf8");
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, "utf8");
  }
  return dir;
}

test("a gitignored directory is not scanned", () => {
  const dir = repoWithIgnored("book/", {
    "book/generated.md": "A doc explaining {{PROJECT_NAME}} syntax.\n",
    "spec.md": "# Spec\n",
  });
  try {
    const findings = findUnresolvedPlaceholders(dir);
    assert.deepEqual(
      findings,
      [],
      `gitignored output must not be scanned:\n${JSON.stringify(findings)}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a tracked file with the same placeholder is still reported", () => {
  // The fix must narrow the scan, not weaken it.
  const dir = repoWithIgnored("book/", {
    "book/generated.md": "{{PROJECT_NAME}}\n",
    "docs/real.md": "This one is source: {{PROJECT_NAME}}\n",
  });
  try {
    const findings = findUnresolvedPlaceholders(dir);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.match(String(findings[0]), /real\.md$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a gitignored file nested inside a tracked directory is skipped too", () => {
  const dir = repoWithIgnored("docs/build/", {
    "docs/build/out.md": "{{PROJECT_NAME}}\n",
    "docs/keep.md": "{{PROJECT_NAME}}\n",
  });
  try {
    const findings = findUnresolvedPlaceholders(dir);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.match(String(findings[0]), /keep\.md$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a directory that is not a git repository still scans", () => {
  // No git, no repository, or a git that errors must not disable the check.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-nogit-"));
  try {
    fs.writeFileSync(path.join(dir, "spec.md"), "{{PROJECT_NAME}}\n", "utf8");
    const findings = findUnresolvedPlaceholders(dir);
    assert.equal(findings.length, 1, "the scan must not depend on git being present");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
