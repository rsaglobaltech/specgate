/**
 * The landing page's terminal, recorded from the real CLI.
 *
 * ## Why a recording and not a GIF
 *
 * This repository ships no binaries, and a marketing GIF would be the first —
 * unreviewable in a diff, stale the moment output changes, and heavier than the
 * rest of the page put together. A recording is text: it diffs, it is asserted
 * against the CLI it claims to show, and the whole thing is about 15 KB.
 *
 * The claim the page makes is "this is what it prints". That claim is only
 * worth making if it stays true, which is what `--check`, the guards in
 * `tests/unit/docs-terminal.test.ts` and the pinned version are for.
 *
 * ## Determinism
 *
 * Every capture must produce the same bytes, or the file churns, people stop
 * regenerating it, and the recording quietly becomes a lie. Two mechanisms: the
 * environment is built from scratch rather than inherited (`buildEnv`), and
 * what survives that is flattened by an ordered, named list of rules (`RULES`).
 *
 * Colour is not captured. `NO_COLOR` and a piped stdout make the CLI emit no
 * escape at all, and the meaning is recovered from the markers it already
 * prints — the tick, the cross, the warning sign. Classify, do not capture.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { STORYBOARDS, type Beat, type Storyboard } from "./terminal-storyboard";
import { readBlock, replaceBlock } from "./blocks";

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");

/** The pinned instant. Every timestamp in the recording becomes this. */
const PINNED_TIME = "2026-01-01T00-00-00-000Z";

/** Terminal width the capture pretends to have. */
export const COLS = 88;

export type LineClass = "ok" | "err" | "warn" | "info" | "dim" | "out";

export interface Line {
  readonly t: string;
  readonly c: LineClass;
  readonly s: "out" | "err";
}

export interface Step {
  id: string;
  caption: string;
  cwd: string;
  command: string;
  surface: string | null;
  exit: number;
  typeMs: number;
  holdMs: number;
  truncated: boolean;
  omitted: number;
  lines: Line[];
}

export interface Recording {
  schemaVersion: number;
  recordedWith: { version: string; node: string; platform: string; packSource: string };
  recordedAt: string;
  title: string;
  cols: number;
  streamsMerged: boolean;
  steps: Step[];
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * A line's colour, derived from what the CLI printed rather than from ANSI.
 *
 * The CLI's diagnostics carry a marker in every surface, which is exactly the
 * information the escape sequence would have encoded.
 */
export function classify(line: string): LineClass {
  const t = line.trim();
  if (t === "") return "out";
  if (/^(❌|✖|✗)/.test(t) || /\[ERROR\]/.test(t) || /^not ok /.test(t)) return "err";
  if (/^(⚠|▲|⛔)/.test(t) || /\[WARN\]/.test(t)) return "warn";
  // The tick is not always first: the CLI prefixes most surfaces with an info
  // marker, so `ℹ️ [INFO] ✅ Validation passed` would read as neutral grey if
  // this were anchored. Error and warning are checked above, so a line carrying
  // both still comes out as the worse of the two.
  if (/[✅✔✓]/.test(t)) return "ok";
  if (/^\s*\d+ passed\b/.test(t)) return "ok";
  if (/^(ℹ)/.test(t) || /\[INFO\]/.test(t)) return "info";
  if (/^[─—-]{2,}/.test(t) || t.startsWith("#")) return "dim";
  return "out";
}

// ── Normalisation ────────────────────────────────────────────────────────────

export interface NormaliseContext {
  /** Both spellings of the scratch root: as created, and as `realpath` sees it. */
  scratch: string[];
  repoRoot: string;
  home: string;
  hostname: string;
  /** Short SHAs already seen, so the same SHA gets the same alias twice. */
  shas: Map<string, string>;
}

/**
 * The rules, in order and by name.
 *
 * Named rather than inlined so the test can assert each one still runs, and so
 * a new rule cannot be slipped in without appearing here. Order matters: the
 * scratch directory lives under the system temp directory, so `scratch` has to
 * win before `tmp` gets a chance to flatten it.
 */
export const RULES: ReadonlyArray<{
  id: string;
  apply: (s: string, ctx: NormaliseContext) => string;
}> = [
  {
    // A spinner rewrites its line with a carriage return; only the last write
    // was ever visible.
    id: "carriage",
    apply: (s) => (s.includes("\r") ? s.slice(s.lastIndexOf("\r") + 1) : s),
  },
  {
    // Belt and braces: NO_COLOR should mean there is nothing here to strip.
    // `no-control-regex` is disabled because matching the escape character is
    // the entire job — there is no way to strip ANSI without naming it.
    id: "ansi",
    apply: (s) =>
      s
        // eslint-disable-next-line no-control-regex
        .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
        // eslint-disable-next-line no-control-regex
        .replace(/\u001b\][^\u0007]*\u0007/g, ""),
  },
  {
    id: "scratch",
    apply: (s, ctx) => ctx.scratch.reduce((acc, root) => acc.split(root).join("~"), s),
  },
  {
    id: "repo",
    apply: (s, ctx) => s.split(ctx.repoRoot).join("."),
  },
  {
    id: "tmp",
    apply: (s) => s.replace(/\/var\/folders\/\S+/g, "/tmp/specgate-demo"),
  },
  {
    // A path built by string concatenation would have escaped `scratch`.
    id: "home",
    apply: (s, ctx) =>
      s
        .split(ctx.home)
        .join("~")
        .replace(/\/Users\/[^/\s"']+/g, "~")
        .replace(/\/home\/[^/\s"']+/g, "~"),
  },
  {
    id: "iso",
    apply: (s) => s.replace(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z?/g, PINNED_TIME),
  },
  {
    // `change archive` names its folder after today's date. Pinned like an
    // instant, or the brief recording would churn every day.
    id: "date",
    apply: (s) => s.replace(/\b20\d\d-\d\d-\d\d(?=-[a-z])/g, "2026-01-01"),
  },
  {
    // Git dates are pinned, but a SHA still depends on tree content, so a
    // template edit would otherwise rewrite every SHA in the file.
    id: "sha",
    apply: (s, ctx) =>
      s.replace(/\b[0-9a-f]{7,40}\b/g, (sha) => {
        let alias = ctx.shas.get(sha);
        if (!alias) {
          alias = (0xc5da000 + ctx.shas.size).toString(16);
          ctx.shas.set(sha, alias);
        }
        return alias;
      }),
  },
  {
    id: "duration",
    apply: (s) =>
      s
        .replace(/duration_ms [\d.]+/g, "duration_ms 1.234")
        .replace(/\b\d+(\.\d+)?ms\b/g, "12ms")
        .replace(/\b\d+\.\d+s\b/g, "1.2s"),
  },
  {
    id: "nodever",
    apply: (s) => s.replace(/\bv(\d+)\.\d+\.\d+\b/g, "v$1.x"),
  },
  {
    id: "hostname",
    apply: (s, ctx) => (ctx.hostname ? s.split(ctx.hostname).join("demo-host") : s),
  },
  {
    id: "trim",
    apply: (s) => s.replace(/[ \t]+$/, ""),
  },
];

export function normalise(line: string, ctx: NormaliseContext): string {
  return RULES.reduce((acc, rule) => rule.apply(acc, ctx), line);
}

/**
 * Abort the capture on anything credential-shaped.
 *
 * Redacting silently would let a leaked pattern become normal. The recording is
 * committed, so the only safe behaviour is to fail loudly and let a person look.
 */
export function assertNoSecrets(line: string, where: string): void {
  const pattern =
    /(ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY/;
  if (pattern.test(line)) {
    throw new Error(
      `credential-shaped string in "${where}" — capture aborted, look at it yourself`
    );
  }
}

// ── Pacing ───────────────────────────────────────────────────────────────────

/**
 * Computed, never hand-tuned.
 *
 * A hand-edited pace is the kind of edit that turns a recording into a
 * dramatisation, so the test bounds-checks both numbers.
 */
export function pace(lineCount: number): { typeMs: number; holdMs: number } {
  const hold = 700 + lineCount * 90;
  return { typeMs: 26, holdMs: Math.max(900, Math.min(3600, hold)) };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function promptFor(step: Step): string {
  return `${step.cwd} $`;
}

/** The transcript as plain text — what a reader would have seen. */
export function renderTranscript(rec: Recording): string {
  const out: string[] = [];
  for (const step of rec.steps) {
    out.push(`${promptFor(step)} ${step.command}`);
    for (const line of step.lines) out.push(line.t);
    if (step.truncated) out.push(`… ${step.omitted} more lines`);
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/**
 * The no-JavaScript fallback, written into `index.html` between sentinels.
 *
 * The player hides this only after its JSON has parsed, so a blocked fetch, a
 * `file://` origin or a schema version it does not know all leave the reader
 * with the complete transcript.
 */
export function renderFallbackHtml(rec: Recording): string {
  return `<pre class="term__transcript"><code>${escapeHtml(renderTranscript(rec))}\n</code></pre>`;
}

// ── Capture ──────────────────────────────────────────────────────────────────

export function buildEnv(scratch: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  return {
    PATH: [path.join(scratch, "bin"), nodeDir, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    HOME: scratch,
    TMPDIR: path.join(scratch, "tmp"),
    TZ: "UTC",
    LC_ALL: "C",
    LANG: "C.UTF-8",
    NO_COLOR: "1",
    TERM: "dumb",
    COLUMNS: String(COLS),
    CI: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "specgate demo",
    GIT_COMMITTER_NAME: "specgate demo",
    GIT_AUTHOR_EMAIL: "demo@example.invalid",
    GIT_COMMITTER_EMAIL: "demo@example.invalid",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00+0000",
    GIT_COMMITTER_DATE: "2026-01-01T00:00:00+0000",
  };
}

const CONFIG_YAML = `PROJECT_NAME: Smart Parking
PROJECT_SLUG: smart-parking
PROJECT_TYPE: backend
DOMAIN: parking operations
STACK: Node 20, Express, PostgreSQL
API_STYLE: REST with DTO boundaries
TESTING: node:test
`;

const HARNESS_YAML = `harness_version: 1
agent: 'specgate-stub-agent {prompt_file}'
test_cmd: 'node --test test/*.test.js'
max_attempts: 1
`;

export function run(cwd: string, env: NodeJS.ProcessEnv, argv: string[]): void {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`setup failed: ${argv.join(" ")}\n${r.stdout || ""}${r.stderr || ""}`);
  }
}

export function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

/** The `specgate` shim every recording puts on PATH. */
export function prepareBin(scratch: string): void {
  const bin = path.join(scratch, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(scratch, "tmp"), { recursive: true });
  fs.writeFileSync(
    path.join(bin, "specgate"),
    `#!/usr/bin/env bash\nexec node "${path.join(ROOT, "bin", "specgate.js")}" "$@"\n`,
    { mode: 0o755 }
  );
}

/**
 * Build the world the harness beats run in.
 *
 * Nothing here is shown. It exists so that what *is* shown is worth a reader's
 * attention: putting a stub agent on PATH and copying a pack next to the work
 * are both true, and neither is why anyone is on the page.
 */
function prepare(scratch: string): void {
  const bin = path.join(scratch, "bin");
  // Reused, not forked: one deterministic agent, one place to fix it.
  fs.copyFileSync(
    path.join(ROOT, "scripts", "demo", "stub-agent.sh"),
    path.join(bin, "specgate-stub-agent")
  );
  fs.chmodSync(path.join(bin, "specgate-stub-agent"), 0o755);

  // A local pack rather than a clone: a recording CI can reproduce cannot
  // depend on the network, and `--pack-root` is a documented way to work.
  fs.cpSync(path.join(ROOT, "packs", "multi-tenant"), path.join(scratch, "packs", "multi-tenant"), {
    recursive: true,
  });

  fs.writeFileSync(path.join(scratch, "smart-parking.yaml"), CONFIG_YAML, "utf8");
}

/**
 * The repository the harness needs, created between the `plan` and `harness`
 * beats.
 *
 * The harness reads git's own config rather than the environment, and refuses
 * to start without an identity — measured, not assumed, and the reason
 * `git config` appears here as well as in `buildEnv`.
 */
function projectSetup(scratch: string, env: NodeJS.ProcessEnv): void {
  const project = path.join(scratch, "smart-parking");
  fs.writeFileSync(path.join(project, "harness.config.yaml"), HARNESS_YAML, "utf8");
  gitInit(project, env);
  run(project, env, ["git", "add", "-A"]);
  run(project, env, ["git", "commit", "-qm", "initial: specs and the pack"]);
}

export function gitInit(project: string, env: NodeJS.ProcessEnv): void {
  run(project, env, ["git", "init", "-q", "-b", "main", "."]);
  run(project, env, ["git", "config", "user.name", "specgate demo"]);
  run(project, env, ["git", "config", "user.email", "demo@example.invalid"]);
}

// ── The court-bookings project: the brief and gate recordings ───────────────

export const BRIEF_MD = `---
product: Court bookings for a tennis club
surfaces: [api]
actors:
  - { name: Member, surfaces: [api] }
modules: [bookings]
---

# Brief

Members book a court for one hour. A court cannot be booked twice for
the same hour. Members can cancel a booking. Late cancellations may be charged.
`;

/** The draft an agent would write. REQ-004 invents a fee the brief never states. */
export function draftSpec(answered: boolean): string {
  const cancel = answered
    ? `<!-- specgate:trace actor=Member kind=functional status="Needs Clarification" -->

The system SHALL let a member cancel their own booking, and SHALL charge a
late cancellation the fee the club decides (Q1).`
    : `<!-- specgate:trace actor=Member kind=functional -->

The system SHALL let a member cancel their own booking, and SHALL charge a
fee of 5 euros when they cancel less than 24 hours before.`;
  const fee = answered ? "the late-cancellation fee is charged" : "a fee of 5 euros is charged";
  return `# Delta — bookings

## ADDED Requirements

### Requirement: REQ-002 — A member books a court for one hour

<!-- specgate:trace actor=Member kind=functional -->

The system SHALL let a member book a free court for one hour.

> Brief: "Members book a court for one hour."

#### Scenario: SCN-002 — Booking a free court

- GIVEN the centre court is free on Monday evening
- WHEN the member sends POST /api/bookings for the centre court on Monday evening
- THEN the response is 201 and the booking lasts one hour

#### Scenario: SCN-003 — A member sees their bookings

- GIVEN the member booked the centre court on Monday evening
- WHEN the member sends GET /api/bookings
- THEN the list holds that booking

### Requirement: REQ-003 — A court is never booked twice for the same hour

<!-- specgate:trace actor=Member kind=business-rule -->

The system SHALL refuse a booking for a court and hour that is already booked.

> Brief: "A court cannot be booked twice for the same hour."

#### Scenario: SCN-004 — The second booking is refused

- GIVEN the centre court is booked on Monday evening
- WHEN another member sends POST /api/bookings for the centre court on Monday evening
- THEN the response is 409 with the reason "court already booked"

### Requirement: REQ-004 — A member cancels a booking

${cancel}

> Brief: "Members can cancel a booking. Late cancellations may be charged."

#### Scenario: SCN-005 — Cancelling late is charged

- GIVEN the member booked the centre court on Monday evening
- WHEN the member sends DELETE /api/bookings/{id} on Monday morning
- THEN the response is 204 and ${fee}
`;
}

export const ASSUMPTIONS_MD = `# Assumptions

| # | Assumption | Used in | Why | Status |
|---|---|---|---|---|
| A1 | HTTP answers: 201 created, 204 cancelled, 409 taken, reason "court already booked" | REQ-002..REQ-004 | REST convention | confirmed |
`;

export const QUESTIONS_MD = `# Open questions

| # | Question | Blocks | Options seen |
|---|---|---|---|
| Q1 | How much is a late cancellation, and how late is late? | REQ-004 | A flat fee · the full hour · nothing in the first season |
`;

export const BOOKINGS_JS = `const bookings = [];

function book(member, court, slot) {
  if (bookings.some((b) => b.court === court && b.slot === slot)) {
    return { status: 409, reason: "court already booked" };
  }
  bookings.push({ member, court, slot, minutes: 60 });
  return { status: 201, minutes: 60 };
}

module.exports = { book, list: (member) => bookings.filter((b) => b.member === member) };
`;

export const BOOKINGS_TEST_JS = `const test = require("node:test");
const assert = require("node:assert");
const { book, list } = require("../src/bookings");

test("REQ-002 SCN-002: booking a free court lasts one hour", () => {
  assert.deepEqual(book("ana", "centre", "mon-18"), { status: 201, minutes: 60 });
});

test("REQ-002 SCN-003: a member sees their bookings", () => {
  assert.equal(list("ana").length, 1);
});
`;

const CHANGE_DIR = path.join("docs", "specs", "changes", "draft-bookings");

/**
 * An existing Node project, adopted, with the brief and the agent's first
 * draft committed — where the brief recording starts.
 */
function courtsWithDraft(scratch: string, env: NodeJS.ProcessEnv): string {
  const project = path.join(scratch, "courts");
  fs.mkdirSync(path.join(project, "src"), { recursive: true });
  fs.mkdirSync(path.join(project, "test"), { recursive: true });
  write(
    path.join(project, "package.json"),
    `${JSON.stringify({ name: "courts", version: "0.1.0", scripts: { test: "node --test" } }, null, 2)}\n`
  );
  gitInit(project, env);
  run(project, env, ["specgate", "init", "--no-capabilities"]);
  run(project, env, ["specgate", "config", "set", "test_cmd", "node --test"]);
  write(path.join(project, "docs", "brief.md"), BRIEF_MD);
  // One command opens the draft, linked to the brief, with DRAFTING.md for
  // the agent; what the agent then wrote is the next line.
  run(project, env, ["specgate", "draft", "bookings"]);
  write(path.join(project, CHANGE_DIR, "specs", "bookings", "spec.md"), draftSpec(false));
  run(project, env, ["git", "add", "-A"]);
  run(project, env, ["git", "commit", "-qm", "the brief and the agent's first draft"]);
  return project;
}

/** What the author does after reading the first check: write it down, ask. */
function answerTheChecklist(project: string): void {
  write(path.join(project, CHANGE_DIR, "specs", "bookings", "spec.md"), draftSpec(true));
  write(path.join(project, CHANGE_DIR, "assumptions.md"), ASSUMPTIONS_MD);
  write(path.join(project, CHANGE_DIR, "questions.md"), QUESTIONS_MD);
}

function writeTheTest(project: string): void {
  write(path.join(project, "src", "bookings.js"), BOOKINGS_JS);
  write(path.join(project, "test", "bookings.test.js"), BOOKINGS_TEST_JS);
}

/**
 * Each recording's hidden setup: once before the first beat, and before named
 * beats. Every step here is something the page says happened ("the agent
 * drafted", "a test that names the requirement") — done for real, off camera.
 */
const SETUP: Record<
  string,
  {
    before: (scratch: string, env: NodeJS.ProcessEnv) => void;
    beats: Record<string, (scratch: string, env: NodeJS.ProcessEnv) => void>;
  }
> = {
  harness: {
    before: (scratch) => prepare(scratch),
    beats: { "harness-config": (scratch, env) => projectSetup(scratch, env) },
  },
  brief: {
    before: (scratch, env) => {
      courtsWithDraft(scratch, env);
    },
    beats: { "the-fix": (scratch) => answerTheChecklist(path.join(scratch, "courts")) },
  },
  gate: {
    before: (scratch, env) => {
      const project = courtsWithDraft(scratch, env);
      answerTheChecklist(project);
      // Reviewed and left open: a draft is archived after it is applied (ADR-0035).
      run(project, env, ["git", "add", "-A"]);
      run(project, env, ["git", "commit", "-qm", "the specification"]);
    },
    beats: { "the-test": (scratch) => writeTheTest(path.join(scratch, "courts")) },
  },
};

function truncate(lines: Line[], maxLines: number) {
  if (lines.length <= maxLines) return { lines, truncated: false, omitted: 0 };
  return { lines: lines.slice(0, maxLines), truncated: true, omitted: lines.length - maxLines };
}

/** The command as a reader should type it, with the scratch path shown as `~`. */
function displayCommand(beat: Beat): string {
  if (beat.shell) return beat.shell;
  return (beat.argv || [])
    .map((a) => a.replace("{HOME}", "~"))
    .map((a) => (/[ '"$]/.test(a) ? `"${a}"` : a))
    .join(" ");
}

export function recordTranscript(board: Storyboard): Recording {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-term-"));
  const env = buildEnv(scratch);
  const ctx: NormaliseContext = {
    // Longest first, so a prefix never shadows the path it is a prefix of.
    scratch: [...new Set([fs.realpathSync(scratch), scratch])].sort((a, b) => b.length - a.length),
    repoRoot: ROOT,
    home: os.homedir(),
    hostname: os.hostname(),
    shas: new Map(),
  };

  try {
    prepareBin(scratch);
    const setup = SETUP[board.id];
    if (!setup) throw new Error(`no setup for the "${board.id}" recording`);
    setup.before(scratch, env);

    const steps: Step[] = [];
    for (const beat of board.beats) {
      setup.beats[beat.id]?.(scratch, env);

      const cwd = path.join(scratch, beat.cwd);
      const argv = beat.shell
        ? ["bash", "-c", beat.shell]
        : (beat.argv || []).map((a) => a.replace("{HOME}", scratch));

      const r = spawnSync(argv[0], argv.slice(1), {
        cwd,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      });
      if (r.error) throw new Error(`${beat.id}: ${r.error.message}`);

      const collect = (raw: string, stream: "out" | "err"): Line[] =>
        (raw || "")
          .replace(/\r\n/g, "\n")
          .split("\n")
          .map((line) => normalise(line, ctx))
          .map((t) => {
            assertNoSecrets(t, beat.id);
            return { t, c: classify(t), s: stream };
          });

      // stdout and stderr come off two pipes; their real interleaving is not
      // reproducible, so stderr is appended and `streamsMerged: false` says so
      // rather than pretending otherwise.
      const all = [...collect(r.stdout, "out"), ...collect(r.stderr, "err")];
      while (all.length && all[all.length - 1].t.trim() === "") all.pop();
      while (all.length && all[0].t.trim() === "") all.shift();

      const { lines, truncated, omitted } = truncate(all, beat.maxLines);
      const { typeMs, holdMs } = pace(lines.length);

      steps.push({
        id: beat.id,
        caption: beat.caption,
        cwd: beat.cwd ? `~/${beat.cwd}` : "~",
        command: displayCommand(beat),
        surface: beat.surface,
        exit: r.status === null ? -1 : r.status,
        typeMs,
        holdMs,
        truncated,
        omitted,
        lines,
      });
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    return {
      schemaVersion: 1,
      recordedWith: {
        version: pkg.version,
        node: process.version.replace(/^v(\d+)\..*/, "v$1.x"),
        platform: process.platform,
        packSource: "local",
      },
      recordedAt: new Date().toISOString().slice(0, 10),
      title: board.title,
      cols: COLS,
      streamsMerged: false,
      steps,
    };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// ── Writing ──────────────────────────────────────────────────────────────────

export const INDEX_PATH = path.join(DOCS, "index.html");

export function jsonPath(board: Storyboard): string {
  return path.join(DOCS, "assets", board.file);
}

export function serialise(rec: Recording): string {
  return `${JSON.stringify(rec, null, 2)}\n`;
}

export function writeRecording(board: Storyboard, rec: Recording): void {
  fs.writeFileSync(jsonPath(board), serialise(rec), "utf8");
  const index = fs.readFileSync(INDEX_PATH, "utf8");
  fs.writeFileSync(INDEX_PATH, replaceBlock(index, board.block, renderFallbackHtml(rec)), "utf8");
}

function main(): void {
  const check = process.argv.includes("--check");
  const at = process.argv.indexOf("--only");
  const only = at !== -1 ? process.argv[at + 1] : null;
  const problems: string[] = [];

  for (const board of STORYBOARDS) {
    if (only && board.id !== only) continue;
    const rec = recordTranscript(board);

    // A beat that exits other than it was written for is a demo of something
    // else: a refusal that stopped refusing, or a step that started failing.
    for (const [i, beat] of board.beats.entries()) {
      const expected = beat.expectExit ?? 0;
      if (rec.steps[i].exit !== expected) {
        problems.push(`${board.id}/${beat.id} exited ${rec.steps[i].exit}, expected ${expected}`);
      }
    }

    if (!check) {
      writeRecording(board, rec);
      const bytes = Buffer.byteLength(serialise(rec));
      process.stdout.write(
        `recorded ${board.id}: ${rec.steps.length} steps from v${rec.recordedWith.version} — ` +
          `${(bytes / 1024).toFixed(1)} KB\n`
      );
      continue;
    }

    const file = jsonPath(board);
    const onDisk = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    // `recordedAt` is a date, not a claim about the CLI, so a capture on a later
    // day is not staleness. Everything else must match byte for byte.
    const strip = (s: string) => s.replace(/"recordedAt": "[^"]*"/, '"recordedAt": "-"');
    if (strip(onDisk) !== strip(serialise(rec))) {
      problems.push(`docs/assets/${board.file} is out of date — run \`npm run docs:terminal\``);
    }
    const block = readBlock(fs.readFileSync(INDEX_PATH, "utf8"), board.block);
    if ((block || "").trim() !== renderFallbackHtml(rec).trim()) {
      problems.push(
        `the ${board.block} fallback in docs/index.html no longer matches the recording`
      );
    }
  }

  if (problems.length > 0) {
    process.stderr.write(`${problems.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  if (check) process.stdout.write("the recordings are current\n");
}

if (require.main === module) main();
