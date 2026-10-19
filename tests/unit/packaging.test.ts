/**
 * The published tarball only ships what `files` in package.json lists. The CLI
 * spans several top-level directories (dist/bin, dist/scripts, dist/packages/core),
 * so a new cross-directory import can leave the tarball missing a module that
 * every local build resolves fine. These tests walk the real require graph from
 * the shipped entry point and assert `files` still covers all of it.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const distDir = path.join(repoRoot, "dist");
const packageJson = require(path.join(repoRoot, "package.json"));

const { SURFACE } = require("../../scripts/lib/surface");

/** A command registry row, as `scripts/lib/surface` declares it. */
interface SurfaceRow {
  name: string;
  script?: string[];
  subcommands?: SurfaceRow[];
}

/**
 * Every registry row that names a script, subcommands included.
 *
 * Walking only the top level misses `specops sync`, `change archive` and the
 * rest — which are exactly the rows most likely to be moved and left behind.
 */
function dispatchableRows(): Array<{ name: string; script: string[] }> {
  const out: Array<{ name: string; script: string[] }> = [];
  const visit = (rows: SurfaceRow[] | undefined, prefix: string) => {
    for (const row of rows || []) {
      const name = prefix ? `${prefix} ${row.name}` : row.name;
      if (row.script) out.push({ name, script: row.script });
      visit(row.subcommands, name);
    }
  };
  visit(SURFACE, "");
  return out;
}

/** Entry points a user can reach: the bin shim plus every command it dispatches to. */
function entryPoints(): string[] {
  const entries = [path.join(distDir, "bin", "specgate.js")];
  for (const row of dispatchableRows()) {
    entries.push(path.join(distDir, "scripts", ...row.script));
  }
  return entries.filter((f) => fs.existsSync(f));
}

/** Every relative `require(...)` specifier in a compiled CommonJS file. */
function relativeRequires(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const specs: string[] = [];
  const re = /require\((['"])(\.[^'"]*)\1\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[2]);
  return specs;
}

/** Transitive closure of first-party modules reachable from the CLI entry points. */
function reachableDistFiles(): Set<string> {
  const seen = new Set<string>();
  const queue = entryPoints();
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of relativeRequires(file)) {
      let resolved: string;
      try {
        resolved = require.resolve(spec, { paths: [path.dirname(file)] });
      } catch {
        continue; // optional or dynamically-guarded require
      }
      if (resolved.startsWith(distDir + path.sep)) queue.push(resolved);
    }
  }
  return seen;
}

/**
 * A repo-relative path with the separators npm uses.
 *
 * `path.relative` gives `dist\\packages\\core\\…` on Windows, and `files` in
 * `package.json` is written with `/` — comparing the two directly reported
 * every module as unpublished. npm's own paths are posix, so that is the form
 * these tests compare in.
 */
function repoRelative(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

/** True when a `files` entry (npm's directory-or-path form) covers a repo-relative path. */
function coveredByFiles(relPath: string): boolean {
  return (packageJson.files as string[]).some((entry) => {
    const normalised = entry.replace(/\/$/, "");
    return relPath === normalised || relPath.startsWith(normalised + "/");
  });
}

/**
 * Does this compiled module actually do something when node runs it?
 *
 * Two styles are in use: most commands guard on `require.main === module`,
 * while `alm/cli` calls `main()` unconditionally at load. Both run; a module
 * that only re-exports does not.
 */
function runsSomething(js: string): boolean {
  if (js.includes("require.main === module")) return true;
  return /^[A-Za-z_$][\w$]*\s*\(/m.test(js); // an unindented top-level call
}

test("every module the CLI requires is inside a published `files` entry", () => {
  const reachable = reachableDistFiles();
  assert.ok(reachable.size > 0, "expected to walk a non-empty require graph");

  const missing = [...reachable]
    .map(repoRelative)
    .filter((rel) => !coveredByFiles(rel))
    .sort();

  assert.deepEqual(
    missing,
    [],
    `These modules load locally but are absent from the published tarball. ` +
      `Add their directory to "files" in package.json:\n  ${missing.join("\n  ")}`
  );
});

test("the CLI require graph really does span packages/core", () => {
  // Guards the test above against silently passing if the walk stops early.
  const reachable = [...reachableDistFiles()].map(repoRelative);
  assert.ok(
    reachable.some((rel) => rel.startsWith("dist/packages/core/")),
    "expected the walk to reach dist/packages/core; if core is genuinely unused, drop it from `files`"
  );
});

test("every script the command registry dispatches to is a runnable entry point", () => {
  // The registry spawns these files by path. A module that only re-exports its
  // command loads fine, resolves fine, and does nothing — which is how moving a
  // command into `scripts/cli/commands/` and leaving a shim behind silently
  // turned `specgate specops sync` into a no-op.
  const missing: string[] = [];
  for (const row of dispatchableRows()) {
    const file = path.join(distDir, "scripts", ...row.script);
    if (!fs.existsSync(file)) {
      missing.push(`${row.name}: ${row.script.join("/")} was not built`);
      continue;
    }
    if (!runsSomething(fs.readFileSync(file, "utf8"))) {
      missing.push(`${row.name}: ${row.script.join("/")} never runs its command`);
    }
  }
  assert.deepEqual(missing, [], `\n  ${missing.join("\n  ")}`);
});

// ── The published shim has to start the CLI on every platform ────────────────
//
// `bin/specgate.js` is two lines that `require` the built entry
// point, so `require.main` is the shim and not the module. The guard therefore
// has to recognise the shim by name — and the form it used,
// `filename.endsWith("bin/specgate.js")`, never matched on
// Windows, where `filename` carries backslashes.
//
// The CLI then loaded, dispatched nothing, and exited 0 with **no output on
// either stream**. 437 tests failed and not one message said why, because there
// was no message. It survived 53 commits because the branch had not been
// through CI and both development machines use `/`.

test("the entry-point guard matches the shim on posix and on windows", () => {
  const posix = "/home/runner/work/repo/bin/specgate.js";
  const win = "D:\\a\\repo\\repo\\bin\\specgate.js";

  // What the guard does now — `path.basename` is `path.win32.basename` on
  // Windows, so one expression covers both.
  assert.equal(path.posix.basename(posix), "specgate.js");
  assert.equal(path.win32.basename(win), "specgate.js");

  // What it used to do, which is the bug.
  assert.equal(win.endsWith("bin/specgate.js"), false);
});

test("the shim starts the CLI, not just loads it", () => {
  // The end-to-end version: run the published entry point the way npm does and
  // require it to actually produce output.
  const shim = path.join(repoRoot, "bin", "specgate.js");
  const r = spawnSync(process.execPath, [shim, "--version"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/, `the shim produced no version:\n${r.stdout}`);
});
