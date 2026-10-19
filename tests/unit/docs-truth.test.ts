"use strict";

/**
 * Guard: docs/specs/traceability.md must not name a file that does not exist.
 *
 * The matrix is the project's own dogfooding artefact and it had rotted badly —
 * before this test it still pointed at `scripts/new_spec_project.sh`,
 * `scripts/validate_specs.sh` and `tests/shell/new_spec_project.bats`, all
 * deleted by ADR-0008 when the CLI went Node-only. A traceability matrix that
 * points at nothing is worse than none: it reads as a contract.
 *
 * Statuses stay a human judgement. This only enforces that the paths are real.
 */

import { test } from "node:test";
import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const MATRIX = path.join(ROOT_DIR, "docs", "specs", "traceability.md");

/** Has a slash and plausible path characters. */
const PATH_SHAPED = /^[\w.@-]+(?:\/[\w.*{},@-]+)+(?:\/)?$/;

/**
 * A slash alone is not enough — column headers like `Command/Query` are shaped
 * like paths. Require the token to also carry a file extension, a glob, or a
 * trailing slash before treating it as something that must exist on disk.
 */
function looksLikePath(token: string): boolean {
  if (!PATH_SHAPED.test(token)) return false;
  if (token.endsWith("/") || token.includes("*")) return true;
  const last = token.split("/").pop() || "";
  return last.includes(".");
}

/** `a/{b,c}.ts` → ["a/b.ts", "a/c.ts"] */
function expandBraces(token: string): string[] {
  const m = /^(.*)\{([^}]+)\}(.*)$/.exec(token);
  if (!m) return [token];
  return m[2].split(",").flatMap((part) => expandBraces(`${m[1]}${part.trim()}${m[3]}`));
}

/**
 * For a glob, the most we can honestly assert is that the directory it globs
 * inside exists — otherwise the pattern is pointing at nothing.
 */
function resolveTarget(token: string): string {
  if (!token.includes("*")) return token;
  const segments = token.split("/");
  const firstGlob = segments.findIndex((s) => s.includes("*"));
  return segments.slice(0, firstGlob).join("/");
}

function pathsNamedIn(markdown: string): string[] {
  const inline = [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const tokens = inline
    .filter(looksLikePath)
    .flatMap(expandBraces)
    .map(resolveTarget)
    .filter(Boolean);
  return [...new Set(tokens)];
}

test("every path named in traceability.md exists on disk", () => {
  const markdown = fs.readFileSync(MATRIX, "utf8");
  const named = pathsNamedIn(markdown);

  // A matrix that names nothing would pass vacuously.
  assert.ok(named.length > 20, `expected the matrix to name many paths, found ${named.length}`);

  const missing = named.filter((rel) => !fs.existsSync(path.join(ROOT_DIR, rel)));
  assert.deepEqual(
    missing,
    [],
    `traceability.md names paths that do not exist:\n  ${missing.join("\n  ")}`
  );
});

test("a path-shaped column header is not treated as a path", () => {
  // `Command/Query` is a matrix column name, not a file.
  assert.equal(looksLikePath("Command/Query"), false);
  assert.equal(looksLikePath("scripts/req.ts"), true);
  assert.equal(looksLikePath("features/cli/"), true);
  assert.equal(looksLikePath("packages/*/test/unit/**"), true);
});

test("brace and glob tokens resolve the way the guard assumes", () => {
  assert.deepEqual(expandBraces("scripts/change/{parser,delta}.ts"), [
    "scripts/change/parser.ts",
    "scripts/change/delta.ts",
  ]);
  assert.equal(resolveTarget("scripts/specops/*.ts"), "scripts/specops");
  assert.equal(resolveTarget("packages/*/test/unit/**"), "packages");
  assert.equal(resolveTarget("scripts/req.ts"), "scripts/req.ts");
});

// ── Internal links ────────────────────────────────────────────────────────────

/** Every markdown file the repository ships, excluding dependencies. */
function markdownFiles(): string[] {
  const out: string[] = [];
  const SKIP = new Set(["node_modules", "dist", "coverage", ".git", "_site"]);
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".md")) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  walk(ROOT_DIR);
  return out;
}

test("no markdown file links to another that does not exist", () => {
  // Splitting how-to.md into topic guides moved a lot of links at once, and a
  // dead link in the docs is the same defect class as a dead path in the
  // matrix: the document claims something that is not true.
  const broken: string[] = [];
  for (const file of markdownFiles()) {
    const body = fs.readFileSync(file, "utf8");
    for (const m of body.matchAll(/\]\(([^)#:]+\.md)(?:#[^)]*)?\)/g)) {
      const target = path.resolve(path.dirname(file), m[1]);
      if (!fs.existsSync(target)) {
        broken.push(`${path.relative(ROOT_DIR, file)} → ${m[1]}`);
      }
    }
  }
  assert.deepEqual(broken, [], `broken links:\n  ${broken.join("\n  ")}`);
});

test("no shipped guide is longer than 300 lines", () => {
  // The exception is deliberate and named: the tutorial is one narrative, and
  // splitting it into four files would make it worse, not more navigable.
  const EXCEPTIONS = new Set(["docs/tutorial.md"]);
  const tooLong: string[] = [];
  for (const file of fs.readdirSync(path.join(ROOT_DIR, "docs"))) {
    if (!file.endsWith(".md")) continue;
    const rel = `docs/${file}`;
    if (EXCEPTIONS.has(rel)) continue;
    const lines = fs.readFileSync(path.join(ROOT_DIR, "docs", file), "utf8").split("\n").length;
    if (lines > 300) tooLong.push(`${rel} (${lines} lines)`);
  }
  assert.deepEqual(tooLong, [], `guides over 300 lines:\n  ${tooLong.join("\n  ")}`);
});

test("the README stays short enough to read", () => {
  const lines = fs.readFileSync(path.join(ROOT_DIR, "README.md"), "utf8").split("\n").length;
  assert.ok(lines < 150, `README is ${lines} lines; it should stay under 150 and link out`);
});

test("every command the CLI dispatches is documented somewhere", () => {
  // Phases 4 and 5 shipped commands after the docs were reorganised, and the
  // documentation quietly fell behind: `status` and `req` are in the eight-command
  // core help and appeared in no guide at all. A command nobody wrote down is a
  // command nobody finds.
  const bin = fs.readFileSync(path.join(ROOT_DIR, "bin", "specgate.ts"), "utf8");
  const dispatched = [...new Set([...bin.matchAll(/command === "([a-z-]+)"/g)].map((m) => m[1]))];

  const docs = [
    "README.md",
    ...fs
      .readdirSync(path.join(ROOT_DIR, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `docs/${f}`),
  ]
    .map((rel) => fs.readFileSync(path.join(ROOT_DIR, rel), "utf8"))
    .join("\n");

  // Every spelling counts: the guides lead with `specgate`, and the alias
  // `create-spec-driven-app` still appears in bootstrap lines and in records of
  // how a command used to be invoked.
  const undocumented = dispatched.filter(
    (cmd) =>
      !new RegExp(`\\b(specgate(@[\\w.-]+)?|create-spec-driven-app(@[\\w.-]+)?) ${cmd}\\b`).test(
        docs
      )
  );
  assert.deepEqual(
    undocumented,
    [],
    `commands with no mention in README.md or docs/*.md:\n  ${undocumented.join("\n  ")}`
  );
});

/**
 * Guard: one name for the command in user-facing text.
 *
 * The CLI ships two binaries — `specgate` and the `create-spec-driven-app`
 * alias. (The tool's first name, and its alias, went with ADR-0032.)
 * Aliases exist so an old invocation keeps working, not so documentation can
 * pick whichever it likes: for a while the docs and the help strings used them
 * interchangeably and the same command appeared under two names depending on
 * which page you landed on.
 *
 * `specgate` is the one to type. `create-spec-driven-app` stays in npm links
 * and in file paths, so this only matches the alias followed by a real
 * sub-command.
 */
test("user-facing text invokes the CLI as `specgate`, not by an alias", () => {
  const SUBCOMMANDS = [
    "init",
    "adopt",
    "onboard",
    "doctor",
    "status",
    "plan",
    "req",
    "change",
    "validate",
    "done",
    "fix",
    "report",
    "pack",
    "specops",
    "harness",
    "ci",
    "alm",
    "config",
    "agents",
    "update",
    "schema",
    "completion",
    "studio",
    "expand",
  ];
  // Not preceded by `npx `, by a path separator, or by `@` — those are the
  // package, not the command.
  const bareInvocation = new RegExp(
    `(?<!npx )(?<![\\w/@.:-])(?:create-spec-driven-app) (?:${SUBCOMMANDS.join("|")})\\b`
  );

  const collect = (dir: string, exts: string[], skip: RegExp) => {
    const out: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        // POSIX separators: `path.relative` yields backslashes on Windows,
        // so a skip pattern written with `/` would silently match nothing
        // there and the guard would scan the very files it exempts.
        const rel = path.relative(ROOT_DIR, full).split(path.sep).join("/");
        if (skip.test(rel)) continue;
        if (entry.isDirectory()) walk(full);
        else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
      }
    };
    walk(path.join(ROOT_DIR, dir));
    return out;
  };

  // ADRs, archived changes and the published case study are dated records:
  // they say what was true when written and are not rewritten to match a later
  // naming convention. dist/ is build output.
  const skip =
    /(^|\/)(dist|node_modules)(\/|$)|docs\/specs\/adr\/|docs\/specs\/changes\/archive\/|docs\/case-studies\//;
  const files = [
    ...collect("scripts", [".ts"], skip),
    ...collect("docs", [".md", ".html"], skip),
    ...collect("templates", [".tpl", ".md"], skip),
    path.join(ROOT_DIR, "README.md"),
    path.join(ROOT_DIR, "CONTRIBUTING.md"),
  ];

  const offenders: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    content.split("\n").forEach((line, i) => {
      // `completion` registers both binary names on purpose.
      if (/complete\s+-[FcC]|compdef/.test(line)) return;
      if (bareInvocation.test(line)) {
        const rel = path.relative(ROOT_DIR, file).split(path.sep).join("/");
        offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `invoke the CLI as \`specgate\` in user-facing text:\n  ${offenders.join("\n  ")}`
  );
});
