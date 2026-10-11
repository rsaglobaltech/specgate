"use strict";

/**
 * The recorded terminal on the landing page.
 *
 * ## What is being protected
 *
 * The page says, in as many words, "this is what it actually prints". For a
 * project whose whole thesis is that a specification must not be able to
 * quietly become false, a marketing claim that can quietly become false is the
 * worst thing on the site.
 *
 * The full defence is `npm run docs:terminal:check`, which re-runs the CLI and
 * diffs. That takes half a minute and a build, and it fails on exactly the
 * pull requests that *should* change the output — which is how a guard becomes
 * a reflex nobody reads. So it runs nightly and at release, and what runs on
 * every commit is this file: cheap invariants that catch the drift that
 * actually matters — a recording from the wrong version, a command the CLI no
 * longer has, a flag that was renamed, a fallback that fell out of sync.
 *
 * Nothing here executes the CLI.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");

const INDEX = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(DOCS, "assets", "terminal.css"), "utf8");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const { STORYBOARDS } = require("../../scripts/docs/terminal-storyboard");
const { renderFallbackHtml, RULES, classify, pace } = require("../../scripts/docs/record-terminal");
const { readBlock } = require("../../scripts/docs/blocks");
const { SURFACE } = require("../../scripts/lib/surface");

/** Every recording, with the storyboard it claims to be of. */
const RECORDINGS = STORYBOARDS.map((board: any) => {
  const raw = fs.readFileSync(path.join(DOCS, "assets", board.file), "utf8");
  return { board, raw, rec: JSON.parse(raw) };
});

/** One test per recording, named after it, so a failure says which. */
function eachRecording(name: string, fn: (r: { board: any; raw: string; rec: any }) => void) {
  for (const r of RECORDINGS) test(`${r.board.id}: ${name}`, () => fn(r));
}

test("there are three recordings, and the page offers each as a tab", () => {
  assert.deepEqual(
    STORYBOARDS.map((b: any) => b.id),
    ["brief", "gate", "harness"]
  );
  for (const board of STORYBOARDS) {
    assert.match(INDEX, new RegExp(`data-term-src="\\./assets/${board.file.replace(".", "\\.")}"`));
    assert.ok(INDEX.includes(`>${board.label}<`), `no tab labelled "${board.label}"`);
  }
});

// ── Shape ────────────────────────────────────────────────────────────────────

eachRecording("the recording is the shape the player knows", ({ board, raw: RAW, rec: REC }) => {
  assert.equal(REC.schemaVersion, 1);
  assert.ok(Array.isArray(REC.steps) && REC.steps.length > 0, "no steps");
  for (const step of REC.steps) {
    for (const field of ["id", "caption", "cwd", "command", "exit", "typeMs", "holdMs", "lines"]) {
      assert.ok(step[field] !== undefined, `${step.id}: missing ${field}`);
    }
    assert.ok(Array.isArray(step.lines), `${step.id}: lines is not an array`);
  }
});

eachRecording("the storyboard and the recording agree, beat for beat", ({ board, raw: RAW, rec: REC }) => {
  // Catches a beat added to the storyboard and never captured.
  assert.deepEqual(
    REC.steps.map((s) => s.id),
    board.beats.map((b: any) => b.id),
    "run `npm run docs:terminal` — the storyboard changed and the recording did not"
  );
});

// ── Staleness ────────────────────────────────────────────────────────────────

eachRecording("the recording was made by the version this repository is on", ({ board, raw: RAW, rec: REC }) => {
  // The primary staleness gate, and the right one: the recording is a claim
  // about a version, so the version is what has to match.
  assert.equal(
    REC.recordedWith.version,
    PKG.version,
    `the terminal was recorded from v${REC.recordedWith.version} and this is v${PKG.version} — ` +
      "re-record with `npm run docs:terminal` when cutting a release"
  );
});

eachRecording("every specgate command in the recording is a command this CLI has", ({ board, raw: RAW, rec: REC }) => {
  const labels = new Set();
  for (const command of SURFACE) {
    labels.add(command.name);
    for (const sub of command.subcommands || []) labels.add(`${command.name} ${sub.name}`);
  }

  let checked = 0;
  for (const step of REC.steps) {
    if (!step.surface) continue;
    checked += 1;
    assert.ok(
      labels.has(step.surface),
      `the recording runs \`specgate ${step.surface}\`, which is not in scripts/lib/surface.ts`
    );
    assert.ok(
      step.command.startsWith(`specgate ${step.surface}`),
      `${step.id}: the declared surface and the recorded command disagree`
    );
  }
  assert.ok(checked >= 3, `only ${checked} steps exercise the CLI — the recording lost its point`);
});

eachRecording("every flag in the recording still exists in the source", ({ board, raw: RAW, rec: REC }) => {
  // Coarse on purpose: it needs no maintenance and it catches the realistic
  // drift, which is a flag that was renamed or removed.
  const source = readAll(path.join(ROOT, "scripts")) + readAll(path.join(ROOT, "packages"));
  const missing = [];
  for (const step of REC.steps) {
    if (!step.surface) continue;
    for (const flag of step.command.match(/--[a-z][a-z0-9-]*/g) || []) {
      if (!source.includes(flag)) missing.push(`${step.id}: ${flag}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `flags the recording uses and the source does not define:\n  ${missing.join("\n  ")}`
  );
});

function readAll(dir) {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out += readAll(full);
    } else if (entry.name.endsWith(".ts")) {
      out += fs.readFileSync(full, "utf8");
    }
  }
  return out;
}

// ── What must not be in a committed file ─────────────────────────────────────

eachRecording("the recording carries no ANSI escape", ({ board, raw: RAW, rec: REC }) => {
  // eslint-disable-next-line no-control-regex -- naming the escape is the check
  assert.doesNotMatch(RAW, /\u001b\[/, "colour was captured instead of classified");
});

eachRecording("no machine leaked into the recording", ({ board, raw: RAW, rec: REC }) => {
  const os = require("node:os");
  for (const leak of ["/Users/", "/home/", "/var/folders/", os.homedir(), os.hostname(), ROOT]) {
    if (!leak) continue;
    assert.ok(!RAW.includes(leak), `the recording contains ${leak}`);
  }
});

eachRecording("every timestamp in the recording is the pinned one", ({ board, raw: RAW, rec: REC }) => {
  const pinned = "2026-01-01T00-00-00-000Z";
  for (const match of RAW.match(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z?/g) || []) {
    assert.equal(match, pinned, `an unpinned timestamp survived: ${match}`);
  }
  assert.match(REC.recordedAt, /^\d{4}-\d{2}-\d{2}$/, "recordedAt is a date, not an instant");
});

eachRecording("no credential-shaped string reached the recording", ({ board, raw: RAW, rec: REC }) => {
  assert.doesNotMatch(
    RAW,
    /(ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY/
  );
});

eachRecording("the recording is small enough to sit on a landing page", ({ board, raw: RAW, rec: REC }) => {
  const bytes = Buffer.byteLength(RAW);
  assert.ok(bytes < 64 * 1024, `${(bytes / 1024).toFixed(1)} KB — trim maxLines in the storyboard`);
});

// ── The recording against the page ───────────────────────────────────────────

eachRecording("the no-JavaScript fallback is the recording, exactly", ({ board, raw: RAW, rec: REC }) => {
  // Generated by the same function that wrote it, so drift is structurally
  // impossible. This is what stands in for re-running the CLI.
  const block = readBlock(INDEX, board.block);
  assert.ok(block, `docs/index.html has no csda:${board.block} block`);
  assert.equal(
    block.trim(),
    renderFallbackHtml(REC).trim(),
    "run `npm run docs:terminal` — the transcript in index.html no longer matches the JSON"
  );
});

eachRecording("the fallback contains no markup of its own", ({ board, raw: RAW, rec: REC }) => {
  const block = readBlock(INDEX, board.block) || "";
  const body = block.replace(/^<pre[^>]*><code>/, "").replace(/<\/code><\/pre>$/, "");
  assert.ok(!body.includes("<"), "a captured line reached the page unescaped");
});

test("the landing page loads the player", () => {
  assert.match(INDEX, /assets\/terminal\.css/);
  assert.match(INDEX, /class="term__transcript"/);
  for (const asset of ["assets/terminal.css", ...STORYBOARDS.map((b: any) => `assets/${b.file}`)]) {
    assert.ok(fs.existsSync(path.join(DOCS, asset)), `${asset} is missing`);
  }
});

eachRecording("every line class the recording uses has a colour", ({ board, raw: RAW, rec: REC }) => {
  const known = ["ok", "err", "warn", "info", "dim", "out"];
  const used = new Set<string>();
  for (const step of REC.steps) for (const line of step.lines) used.add(line.c);

  for (const cls of used) {
    assert.ok(known.includes(cls), `unknown line class "${cls}"`);
    if (cls === "out") continue; // the default colour, inherited
    assert.ok(
      CSS.includes(`.term__line--${cls}`),
      `the recording uses class "${cls}" and terminal.css does not style it`
    );
  }
});

// ── What the recording has to prove ──────────────────────────────────────────

test("the recordings prove the loop the page promises", () => {
  // The landing page names these by name. A set of recordings that skipped
  // one would be illustrating a different product.
  const surfaces = RECORDINGS.flatMap(({ rec }) => rec.steps.map((s: any) => s.surface));
  for (const required of ["init", "plan", "harness run", "validate", "draft", "done", "check", "status"]) {
    assert.ok(
      surfaces.includes(required),
      `the page promises \`specgate ${required}\` and no terminal runs it`
    );
  }
});

eachRecording("every step exits the way its beat says, and the last one is green", ({ board, rec }) => {
  // A refusal is part of the demo, so it is declared on the beat — and a beat
  // that stopped refusing is as wrong as one that started failing.
  const wrong = rec.steps
    .map((s: any, i: number) => ({ id: s.id, exit: s.exit, want: board.beats[i].expectExit ?? 0 }))
    .filter((s: any) => s.exit !== s.want)
    .map((s: any) => `${s.id} exited ${s.exit}, expected ${s.want}`);
  assert.deepEqual(wrong, []);
  const last = rec.steps[rec.steps.length - 1];
  assert.equal(last.exit, 0, "the last step of the demo failed");
  assert.ok(
    rec.steps.some((s: any) => s.lines.some((l: any) => l.c === "ok")),
    "nothing in the whole recording is green"
  );
});

eachRecording("pacing stays inside sane bounds", ({ board, raw: RAW, rec: REC }) => {
  // Guards a hand-edited JSON, which is how a recording turns into a
  // dramatisation. `pace` computes both numbers; nothing should differ from it.
  for (const step of REC.steps) {
    const expected = pace(step.lines.length);
    assert.equal(step.typeMs, expected.typeMs, `${step.id}: typeMs was edited by hand`);
    assert.equal(step.holdMs, expected.holdMs, `${step.id}: holdMs was edited by hand`);
    assert.ok(step.holdMs >= 400 && step.holdMs <= 5000, `${step.id}: holdMs out of range`);
  }
});

eachRecording("the whole replay is short enough that somebody watches it", ({ board, raw: RAW, rec: REC }) => {
  const total = REC.steps.reduce((sum, s) => sum + s.holdMs + s.command.length * s.typeMs, 0);
  assert.ok(total < 90_000, `the replay runs ${Math.round(total / 1000)}s — cut a beat`);
});

// ── The pieces the recorder depends on ───────────────────────────────────────

test("the normalisation rules are all still there, in order", () => {
  // Named so that removing one is a visible edit rather than a silent one. Each
  // of these exists because something leaked or churned without it.
  assert.deepEqual(
    RULES.map((r) => r.id),
    [
      "carriage",
      "ansi",
      "scratch",
      "repo",
      "tmp",
      "home",
      "iso",
      "date",
      "sha",
      "duration",
      "nodever",
      "hostname",
      "trim",
    ]
  );
});

test("classification reads the CLI's own markers", () => {
  assert.equal(classify("✅ REQ-000  pass (1 attempt)"), "ok");
  assert.equal(classify("ℹ️ [INFO] ✅ Validation passed"), "ok", "the tick is not always first");
  assert.equal(classify("❌ [harness] git has no user.name"), "err");
  assert.equal(classify("⚠️  [harness] the row declares no test artifact"), "warn");
  assert.equal(classify("ℹ️ [INFO] Rendering base template"), "info");
  assert.equal(classify("── harness report ──"), "dim");
  assert.equal(classify("PROJECT_SLUG: smart-parking"), "out");
});
