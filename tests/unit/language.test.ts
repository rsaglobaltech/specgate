"use strict";

/**
 * Language context.
 *
 * The one property that matters: prose translates, grammar does not. `SHALL`,
 * `GIVEN`/`WHEN`/`THEN` and the section headings are what the validator parses
 * — translating any of them produces a file the tool cannot read, in a language
 * the user asked for. That is a worse failure than leaving everything English.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const { PHRASES, KEYWORDS } = require("../../packages/core/src/domain/Language");
const {
  resolveLanguage,
  phrases,
} = require("../../packages/core/src/infrastructure/DiskLanguageRepository");

function cli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: ROOT_DIR });
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "language-"));
  const r = cli(
    "init",
    "--config",
    path.join(ROOT_DIR, "examples/project.config.example"),
    "--out",
    root,
    "--force",
    "--no-git"
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  try {
    fn(path.join(root, "acme-energy-hub"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("no translation table translates a keyword", () => {
  // The heart of it. If a table ever renders "DEBE" where SHALL belongs, the
  // generated delta stops parsing.
  for (const [lang, table] of Object.entries(PHRASES) as [string, any][]) {
    const rendered = [
      table.systemShall("x"),
      table.systemShallMeet("y"),
      table.todoSteps("z"),
      table.todoStepsPlain,
    ].join("\n");
    assert.match(rendered, /\bSHALL\b/, `${lang} must keep SHALL`);
    assert.match(rendered, /GIVEN \/ WHEN \/ THEN/, `${lang} must keep the step keywords`);
  }
});

test("every language declares the same phrases", () => {
  const reference = Object.keys(PHRASES.en).sort();
  for (const [lang, table] of Object.entries(PHRASES)) {
    assert.deepEqual(Object.keys(table).sort(), reference, `${lang} is missing phrases`);
  }
});

test("KEYWORDS names what must never be translated", () => {
  for (const keyword of ["SHALL", "GIVEN", "WHEN", "THEN", "specgate:trace"]) {
    assert.ok(KEYWORDS.includes(keyword), `${keyword} should be protected`);
  }
});

test("a regional tag falls back to its base language, not to English", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "language-tag-"));
  try {
    fs.mkdirSync(path.join(dir, ".specgate"), { recursive: true });
    const write = (language) =>
      fs.writeFileSync(
        path.join(dir, ".specgate", "config.json"),
        JSON.stringify({ language }),
        "utf8"
      );

    write("pt-BR");
    assert.equal(resolveLanguage(dir), "pt", "closer beats default");
    write("es");
    assert.equal(resolveLanguage(dir), "es");
    write("klingon");
    assert.equal(resolveLanguage(dir), "en", "an unknown language falls back");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no config means English", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "language-none-"));
  try {
    assert.equal(resolveLanguage(dir), "en");
    assert.equal(phrases(dir).added, "Added");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a Spanish project gets Spanish prose and English grammar", () => {
  withProject((dir) => {
    assert.equal(cli("config", "set", "language", "es", "--project-dir", dir).status, 0);
    assert.equal(cli("change", "new", "add-pricing", "--project-dir", dir).status, 0);

    const r = cli("change", "instructions", "specs", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stderr);
    const template = JSON.parse(r.stdout).instructions.template;

    // Prose is Spanish…
    assert.match(template, /El sistema SHALL/);
    assert.match(template, /<comportamiento observable>/);
    // …and the grammar is not.
    assert.match(template, /## ADDED Requirements/);
    assert.match(template, /- GIVEN /);
    assert.match(template, /- WHEN /);
    assert.match(template, /- THEN /);
    assert.match(template, /specgate:trace/);
  });
});

test("the default project gets English prose", () => {
  withProject((dir) => {
    cli("change", "new", "add-pricing", "--project-dir", dir);
    const template = JSON.parse(
      cli("change", "instructions", "specs", "--project-dir", dir, "--json").stdout
    ).instructions.template;
    assert.match(template, /The system SHALL/);
    assert.doesNotMatch(template, /El sistema/);
  });
});
