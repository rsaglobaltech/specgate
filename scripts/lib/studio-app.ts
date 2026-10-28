import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { listChangeIds, listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { assumptionsToReview } from "../../packages/core/src/domain/Clarification";
import { readHarnessConfig } from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { allQuestions, waiting } from "./clarification";
import { liveMatrix } from "./live-detail";
import { readLive } from "./live-model";
import {
  approvalBlockers,
  approvedOn,
  reviewNotes,
  type Blocker,
  type ReviewNote,
} from "./change-review";
import { requestStop, runLockHolder } from "./harness-guard";
import { findCliRoot } from "./project-root";

/**
 * What the visual studio shows and does (REQ-204..210): each read is built from
 * what the specgate commands read, and each write runs the command that makes
 * it, so the app and the CLI never disagree.
 */

const DELIVERED = new Set(["Implemented", "Verified", "Released"]);
const cli = () => path.join(findCliRoot(__dirname), "bin", "specgate.js");

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

// ── Review ──────────────────────────────────────────────────────────────────

export interface DraftRequirement {
  id: string;
  title: string;
  statement: string;
  status: string;
  scenarios: Array<{ id: string; title: string; steps: string[] }>;
}

export interface DraftView {
  change: string;
  module: string;
  requirements: DraftRequirement[];
  blockers: Blocker[];
  notes: ReviewNote[];
  questions: Array<{ id: string; text: string; blocks: string[] }>;
}

/** The requirements a change adds or modifies, as a person reads them. */
function draftRequirements(projectDir: string, change: string): DraftRequirement[] {
  const out: DraftRequirement[] = [];
  for (const d of listDeltas(projectDir, change)) {
    let parsed: ReturnType<typeof parseDelta>;
    try {
      parsed = parseDelta(fs.readFileSync(d.file, "utf8"));
    } catch {
      continue;
    }
    for (const r of [...(parsed.added || []), ...(parsed.modified || [])]) {
      if (!r.id) continue;
      const text = Array.isArray(r.text) ? r.text.join("\n") : String(r.text || "");
      out.push({
        id: r.id,
        title: String(r.name || ""),
        statement: text
          .split(/\r?\n/)
          .filter((l) => l.trim() && !/^>|<!--/.test(l.trim()))
          .join(" ")
          .trim(),
        status: String((r.trace || {}).status || "Draft"),
        scenarios: (r.scenarios || []).map((s) => ({
          id: String(s.id || ""),
          title: String(s.name || ""),
          steps: (s.steps || []).map((st: unknown) =>
            typeof st === "string"
              ? st
              : `${(st as { keyword?: string }).keyword || ""} ${(st as { text?: string }).text || ""}`.trim()
          ),
        })),
      });
    }
  }
  return out;
}

/** Open changes a person has not approved yet, each as Review shows it (REQ-206). */
export function drafts(projectDir: string): DraftView[] {
  const open = waiting(projectDir).questions;
  return listChangeIds(projectDir)
    .filter((c) => !approvedOn(projectDir, c))
    .map((change) => ({
      change,
      module: change.replace(/^draft-/, "").replace(/-additions$/, ""),
      requirements: draftRequirements(projectDir, change),
      blockers: approvalBlockers(projectDir, change),
      notes: reviewNotes(projectDir, change),
      questions: open
        .filter((q) => q.change === change)
        .map((q) => ({ id: q.id, text: q.text, blocks: q.blocks })),
    }))
    .filter((d) => d.requirements.length > 0);
}

// ── Questions ───────────────────────────────────────────────────────────────

export interface QuestionsView {
  open: Array<{
    id: string;
    change: string;
    text: string;
    blocks: string[];
    options: string[];
    from: "agent" | "draft" | "project";
  }>;
  toReview: Array<{ change: string; assumption: string; question: string; text: string }>;
}

/** Every open question with where it comes from, and the answers still to confirm (REQ-210). */
export function questionsView(projectDir: string): QuestionsView {
  const asked = new Set(
    readLive(projectDir)
      .requirements.filter((r) => r.question)
      .map((r) => r.question!.text)
  );
  const open = allQuestions(projectDir)
    .filter((q) => !q.answered)
    .map((q) => ({
      id: q.id,
      change: q.change,
      text: q.text,
      blocks: q.blocks,
      options: q.options,
      from: (asked.has(q.text) ? "agent" : q.change === "project" ? "project" : "draft") as
        "agent" | "draft" | "project",
    }));
  const toReview: QuestionsView["toReview"] = [];
  const texts = new Map(allQuestions(projectDir).map((q) => [`${q.change}:${q.id}`, q.text]));
  for (const change of [...listChangeIds(projectDir), "project"]) {
    const file =
      change === "project"
        ? path.join(projectDir, "docs", "specs", "assumptions.md")
        : path.join(projectDir, "docs", "specs", "changes", change, "assumptions.md");
    for (const a of assumptionsToReview(read(file) || "")) {
      const q = (/Q\d+/.exec(a.why) || [""])[0];
      toReview.push({
        change,
        assumption: a.id,
        question: q,
        text: texts.get(`${change}:${q}`) || "",
      });
    }
  }
  return { open, toReview };
}

/** The names `.harness/profiles.yaml` declares (REQ-211). */
function profileNames(projectDir: string): string[] {
  const text = read(path.join(projectDir, ".harness", "profiles.yaml")) || "";
  return [...text.matchAll(/^ {2}([\w.-]+):\s*$/gm)].map((m) => m[1]);
}

// ── Build ───────────────────────────────────────────────────────────────────

export interface BuildView {
  ready: Array<{ id: string; title: string; module: string }>;
  agent: boolean;
  running: { pid: number; reqs: string[] } | null;
  estimate: { minutes: number | null; costPerRequirement: number | null };
}

function plan(projectDir: string): Array<{ id: string; title: string; category: string }> {
  const r = spawnSync(process.execPath, [cli(), "status", "--json", "--project-dir", projectDir], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    return doc.requirements || [];
  } catch {
    return [];
  }
}

/** The median of past passing requirements' durations, and their mean reported cost. */
function estimateFrom(projectDir: string): { minutesEach: number | null; costEach: number | null } {
  const durations: number[] = [];
  const runs = path.join(projectDir, ".harness", "runs");
  let files: string[] = [];
  try {
    files = fs.readdirSync(runs).filter((f) => f.endsWith(".json"));
  } catch {
    /* no runs yet */
  }
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(runs, f), "utf8"));
      for (const r of doc.results || []) {
        if (r.result === "pass" && Number(r.durationMs) > 0) durations.push(Number(r.durationMs));
      }
    } catch {
      /* a record being written */
    }
  }
  durations.sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  const costs = readLive(projectDir)
    .requirements.map((r) => (r.usage && r.usage.cost !== null ? r.usage.cost : null))
    .filter((c): c is number => c !== null);
  return {
    minutesEach: median ? Math.round(median / 60000) : null,
    costEach: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
  };
}

/** What is ready to build: not delivered, waiting for no answer, its draft approved (REQ-208). */
export function buildView(projectDir: string): BuildView {
  const matrix = liveMatrix(projectDir);
  const byReq = new Map(matrix.map((r) => [r.requirement, r]));
  const unapproved = new Set<string>();
  for (const change of listChangeIds(projectDir)) {
    if (approvedOn(projectDir, change)) continue;
    for (const r of draftRequirements(projectDir, change)) unapproved.add(r.id);
  }
  const ready = plan(projectDir)
    .filter((r) => r.category !== "DONE" && r.category !== "WAITING_FOR_ANSWER")
    .filter((r) => r.id !== "REQ-001" || byReq.has(r.id))
    .filter((r) => !unapproved.has(r.id))
    .filter((r) => (byReq.get(r.id) || { status: "" }).status !== "Needs Clarification")
    .map((r) => ({ id: r.id, title: r.title, module: (byReq.get(r.id) || { group: "" }).group }));
  const cfg = (readHarnessConfig(projectDir) || {}) as {
    agent?: string;
    attemptProfiles?: unknown[];
  };
  const est = estimateFrom(projectDir);
  const holder = runLockHolder(projectDir);
  return {
    ready,
    agent:
      Boolean(cfg.agent) || (Array.isArray(cfg.attemptProfiles) && cfg.attemptProfiles.length > 0),
    running: holder ? { pid: holder.pid, reqs: holder.reqs } : null,
    estimate: {
      minutes: est.minutesEach === null ? null : est.minutesEach * ready.length,
      costPerRequirement: est.costEach,
    },
  };
}

export type StartOutcome =
  | { ok: true; started: string[]; saved: string[]; log: string; pid: number }
  | { ok: false; code: string; message: string };

/** Start a harness run on the chosen requirements, in the background (REQ-208). */
export function startBuild(projectDir: string, reqs: string[], profile = ""): StartOutcome {
  const view = buildView(projectDir);
  if (profile && !profileNames(projectDir).includes(profile)) {
    return {
      ok: false,
      code: "build_unknown_profile",
      message: `No profile ${profile} in .harness/profiles.yaml.`,
    };
  }
  if (!view.agent && !profile) {
    return {
      ok: false,
      code: "build_no_agent",
      message:
        "No agent is configured. Set agent: in harness.config.yaml (specgate harness init writes it).",
    };
  }
  if (view.running) {
    return {
      ok: false,
      code: "build_running",
      message: `A run is already working on ${view.running.reqs.join(", ")}.`,
    };
  }
  const ready = new Set(view.ready.map((r) => r.id));
  const chosen = reqs.filter((r) => /^REQ-\d+$/.test(r) && ready.has(r));
  if (chosen.length === 0) {
    return {
      ok: false,
      code: "build_nothing",
      message: "None of those requirements is ready to build.",
    };
  }
  const saved = saveSpecification(projectDir);
  if (!saved.ok) return saved;
  const log = path.join(projectDir, ".harness", "events", "studio-run.log");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.openSync(log, "a");
  const child = spawn(
    process.execPath,
    [
      cli(),
      "harness",
      "run",
      "--chain",
      ...chosen.flatMap((r) => ["--req", r]),
      ...(profile ? ["--profile", profile] : []),
      "--project-dir",
      projectDir,
    ],
    {
      cwd: projectDir,
      detached: true,
      stdio: ["ignore", out, out],
      env: { ...process.env, NO_COLOR: "1" },
    }
  );
  child.unref();
  return {
    ok: true,
    started: chosen,
    saved: saved.committed,
    log: path.relative(projectDir, log).split(path.sep).join("/"),
    pid: child.pid || 0,
  };
}

/** What the studio and the drafting write: the specification, never code. */
const SPECIFICATION = [
  /^docs\/brief\.md$/,
  /^spec\.md$/,
  /^docs\/specs\//,
  /^features\//,
  /^harness\.config\.yaml$/,
  /^\.harness\/(?:profiles\.yaml|prompt-prefix\.md)$/,
];

/** Uncommitted paths, from `git status --porcelain -z`: renames give their new path. */
function uncommitted(projectDir: string): string[] | null {
  const r = spawnSync("git", ["-C", projectDir, "status", "--porcelain", "-z", "-uall"], {
    encoding: "utf8",
  });
  if (r.status !== 0) return null;
  const parts = r.stdout.split("\0").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const status = parts[i].slice(0, 2);
    out.push(parts[i].slice(3));
    if (/[RC]/.test(status)) i += 1; // the old path of a rename follows
  }
  return out;
}

/**
 * Commit the specification the studio wrote, so the harness finds the clean
 * tree it needs (REQ-233). Anything else uncommitted is the person's work in
 * progress: the build is refused and the files are named, never committed.
 */
export function saveSpecification(
  projectDir: string
): { ok: true; committed: string[] } | { ok: false; code: string; message: string } {
  const dirty = uncommitted(projectDir);
  if (dirty === null) {
    return { ok: false, code: "build_no_git", message: "This folder is not a git repository." };
  }
  if (dirty.length === 0) return { ok: true, committed: [] };
  const other = dirty.filter((f) => !SPECIFICATION.some((re) => re.test(f)));
  if (other.length) {
    return {
      ok: false,
      code: "build_uncommitted",
      message:
        `Uncommitted files that are not the specification: ${other.slice(0, 8).join(", ")}` +
        `${other.length > 8 ? ` and ${other.length - 8} more` : ""}. Commit or stash them first.`,
    };
  }
  const email = spawnSync("git", ["-C", projectDir, "config", "user.email"], { encoding: "utf8" });
  if (!String(email.stdout || "").trim()) {
    return {
      ok: false,
      code: "build_no_identity",
      message:
        'Git does not know who you are. Run git config --global user.name "Your Name" and git config --global user.email you@example.com.',
    };
  }
  const add = spawnSync("git", ["-C", projectDir, "add", "--", ...dirty], { encoding: "utf8" });
  const commit =
    add.status === 0
      ? spawnSync(
          "git",
          [
            "-C",
            projectDir,
            "commit",
            "-q",
            "-m",
            "chore(spec): save the specification from the studio",
          ],
          { encoding: "utf8" }
        )
      : add;
  if (commit.status !== 0) {
    return {
      ok: false,
      code: "build_commit_failed",
      message: `git could not commit the specification: ${(commit.stderr || commit.stdout || "").trim()}`,
    };
  }
  return { ok: true, committed: dirty };
}

/** Ask the run in progress to stop after its current requirement (REQ-209). */
export function stopBuild(
  projectDir: string
): { ok: true } | { ok: false; code: string; message: string } {
  if (!runLockHolder(projectDir))
    return { ok: false, code: "build_not_running", message: "No run is working." };
  requestStop(projectDir);
  return { ok: true };
}

// ── Home ────────────────────────────────────────────────────────────────────

export interface HomeView {
  project: string;
  built: number;
  total: number;
  questions: number;
  drafts: number;
  ready: number;
  modules: Array<{ name: string; done: number; total: number; waiting: number; draft: boolean }>;
  next:
    | { kind: "answer"; count: number }
    | { kind: "review"; count: number; change: string }
    | { kind: "build"; count: number }
    | { kind: "done" };
}

/** Where the project stands, and the one thing to do next (REQ-205). */
export function home(projectDir: string): HomeView {
  const matrix = liveMatrix(projectDir);
  const reqs = new Map<string, { status: string; group: string }>();
  for (const r of matrix)
    if (!reqs.has(r.requirement)) reqs.set(r.requirement, { status: r.status, group: r.group });
  reqs.delete("REQ-001");
  const built = [...reqs.values()].filter((r) => DELIVERED.has(r.status)).length;
  const open = drafts(projectDir);
  const draftReqs = new Set(open.flatMap((d) => d.requirements.map((r) => r.id)));
  const groups = new Map<string, HomeView["modules"][number]>();
  for (const [id, r] of reqs) {
    const name = r.group || "spec";
    const g = groups.get(name) || { name, done: 0, total: 0, waiting: 0, draft: false };
    g.total += 1;
    if (DELIVERED.has(r.status)) g.done += 1;
    if (r.status === "Needs Clarification") g.waiting += 1;
    if (draftReqs.has(id)) g.draft = true;
    groups.set(name, g);
  }
  const questions = waiting(projectDir).questions.length;
  const ready = buildView(projectDir).ready.length;
  const next: HomeView["next"] = questions
    ? { kind: "answer", count: questions }
    : open.length
      ? { kind: "review", count: open.length, change: open[0].change }
      : ready
        ? { kind: "build", count: ready }
        : { kind: "done" };
  return {
    project: path.basename(projectDir),
    built,
    total: reqs.size,
    questions,
    drafts: open.length,
    ready,
    modules: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    next,
  };
}

/** The specification gate, without the project's tests: quick enough for a page. */
export function gate(projectDir: string): { ok: boolean; findings: string[] } {
  const r = spawnSync(process.execPath, [cli(), "validate", projectDir, "--strict"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const findings = `${r.stdout}${r.stderr}`
    .split("\n")
    .filter((l) => /✖/.test(l))
    .map((l) => l.replace(/^\s*✖\s*/, "").trim())
    .slice(0, 10);
  return { ok: r.status === 0, findings };
}
