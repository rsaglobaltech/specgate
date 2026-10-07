#!/usr/bin/env node
/**
 * End-to-end: the CLI as a user installs it, on throwaway repositories.
 *
 * The unit and CLI suites run the source tree. This runs the *package*:
 * `npm pack`, install the tarball into an empty directory, and drive the
 * binary through the journeys a team actually takes. It catches what the
 * source tree cannot — a file missing from `files`, a path that only resolves
 * inside the repository, a default that differs once installed.
 *
 *   node e2e/run.mjs                    pack this checkout and run every journey
 *   node e2e/run.mjs --tarball x.tgz    run against a given package
 *   node e2e/run.mjs --skip-network     skip journeys that fetch a published version
 *   node e2e/run.mjs --only harness     run the journeys whose name matches
 *   node e2e/run.mjs --jobs 4           journey files run in parallel (default: 4)
 *   node e2e/run.mjs --keep             leave the sandbox on disk for inspection
 *   node e2e/run.mjs --coverage         which commands no journey covers (no packing)
 *
 * Journeys live in e2e/journeys/*.mjs, one file per area. Each declares the
 * commands it `covers`; `--coverage` compares that with the command surface
 * and with e2e/uncovered.json, the list of commands not covered yet, which can
 * only shrink. Plain Node, no dependencies, the same on Linux, macOS, Windows.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { ROOT, context, install, pack, versionOf } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const JOURNEYS_DIR = path.join(ROOT, "e2e", "journeys");
const UNCOVERED = path.join(ROOT, "e2e", "uncovered.json");

const journeyFiles = () =>
  fs
    .readdirSync(JOURNEYS_DIR)
    .filter((f) => f.endsWith(".mjs"))
    .sort()
    .map((f) => path.join(JOURNEYS_DIR, f));

const load = async (file) => (await import(pathToFileURL(file).href)).default;

// ── Worker: one journey file, sequentially ───────────────────────────────────

async function worker() {
  const file = value("--worker");
  const t = context({
    bin: value("--bin"),
    sandbox: value("--sandbox"),
    tarball: value("--tarball-path"),
    flags: { skipNetwork: flag("--skip-network") },
  });
  t.version = versionOf(t.bin);
  const only = value("--only");
  for (const j of await load(file)) {
    if (only && !j.name.includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(t.sandbox, "j-"));
    const started = Date.now();
    let result;
    try {
      j.run(dir, t);
      result = { name: j.name, ok: true, ms: Date.now() - started };
    } catch (e) {
      result =
        e && e.skip
          ? { name: j.name, ok: true, skipped: e.skip }
          : { name: j.name, ok: false, error: String((e && e.message) || e) };
    }
    process.stdout.write(`@@RESULT ${JSON.stringify(result)}\n`);
  }
}

// ── Coverage: the command surface against what journeys declare ──────────────

function surfaceCommands() {
  const require = createRequire(import.meta.url);
  const { SURFACE } = require(path.join(ROOT, "dist", "scripts", "lib", "surface.js"));
  const names = [];
  for (const c of SURFACE) {
    // Plumbing git calls as a merge driver: nobody types it.
    if (c.name === "merge-traceability") continue;
    if (c.subcommands) for (const s of c.subcommands) names.push(`${c.name} ${s.name}`);
    else names.push(c.name);
  }
  return names;
}

async function coverage() {
  const covered = new Set();
  for (const file of journeyFiles())
    for (const j of await load(file)) for (const c of j.covers || []) covered.add(c);
  const surface = surfaceCommands();
  const allowed = new Set(JSON.parse(fs.readFileSync(UNCOVERED, "utf8")).uncovered);
  const unknown = [...covered].filter((c) => !surface.includes(c));
  const missing = surface.filter((c) => !covered.has(c) && !allowed.has(c));
  const stale = [...allowed].filter((c) => covered.has(c) || !surface.includes(c));

  const pct = Math.round(
    ((surface.length - [...surface].filter((c) => !covered.has(c)).length) / surface.length) * 100
  );
  process.stdout.write(
    `E2E coverage: ${surface.length - surface.filter((c) => !covered.has(c)).length}/${surface.length} commands (${pct}%)\n`
  );
  const problems = [];
  if (missing.length)
    problems.push(
      `not covered and not in e2e/uncovered.json — add a journey: ${missing.join(", ")}`
    );
  if (stale.length)
    problems.push(`in e2e/uncovered.json but covered or gone — remove them: ${stale.join(", ")}`);
  if (unknown.length)
    problems.push(`journeys declare commands that do not exist: ${unknown.join(", ")}`);
  if (flag("--list"))
    process.stdout.write(`still uncovered: ${surface.filter((c) => !covered.has(c)).join(", ")}\n`);
  for (const p of problems) process.stdout.write(`  ✖ ${p}\n`);
  process.exit(problems.length ? 1 : 0);
}

// ── Main: install once, fan the journey files out to workers ─────────────────

async function main() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-e2e-"));
  const tarball = pack(sandbox, value("--tarball"));
  const bin = install(sandbox, tarball);
  process.stdout.write(
    `\nspecgate ${versionOf(bin)} — installed from ${path.basename(tarball)}\n\n`
  );

  const passthrough = ["--skip-network", "--only"].flatMap((f) =>
    flag(f) ? (f === "--only" ? [f, value(f)] : [f]) : []
  );
  const queue = journeyFiles();
  const jobs = Math.max(1, Number(value("--jobs")) || 4);
  const results = [];

  const runFile = (file) =>
    new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          path.join(ROOT, "e2e", "run.mjs"),
          "--worker",
          file,
          "--bin",
          bin,
          "--sandbox",
          sandbox,
          "--tarball-path",
          tarball,
          ...passthrough,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      let buf = "";
      let err = "";
      child.stdout.on("data", (d) => (buf += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => {
        const mine = buf
          .split("\n")
          .filter((l) => l.startsWith("@@RESULT "))
          .map((l) => JSON.parse(l.slice("@@RESULT ".length)));
        if (code !== 0 && mine.length === 0) {
          mine.push({
            name: path.basename(file),
            ok: false,
            error: `worker crashed (exit ${code})\n${err}`,
          });
        }
        for (const r of mine) {
          results.push(r);
          const area = path.basename(file, ".mjs");
          if (r.skipped) process.stdout.write(`  - [${area}] ${r.name} (skipped: ${r.skipped})\n`);
          else if (r.ok) process.stdout.write(`  ✔ [${area}] ${r.name} (${r.ms} ms)\n`);
          else
            process.stdout.write(
              `  ✖ [${area}] ${r.name}\n${String(r.error).replace(/^/gm, "      ")}\n`
            );
        }
        resolve();
      });
    });

  const workers = Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) await runFile(queue.shift());
  });
  await Promise.all(workers);

  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  process.stdout.write(
    `\n${results.length - failed.length - skipped.length} passed · ${failed.length} failed · ${skipped.length} skipped\n`
  );
  if (flag("--keep")) process.stdout.write(`sandbox kept at ${sandbox}\n`);
  else fs.rmSync(sandbox, { recursive: true, force: true });
  process.exit(failed.length === 0 && results.length > 0 ? 0 : 1);
}

if (flag("--worker")) await worker();
else if (flag("--coverage")) await coverage();
else await main();
