/**
 * What proved a delivery, kept beside it (REQ-680): `.specgate/evidence/<REQ>/`
 * with `evidence.json` (the command that ran the requirement's scenarios, its
 * exit code and duration), `bdd.log` (its output) and `artifacts/` (what the
 * browser tests left in `test-results/` during that run — screenshots, traces,
 * videos). `before/` is the same, for a run before the code (ADR-0047,
 * REQ-803). Every `artifacts/` stays out of git.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { escapeRegExp } from "./escape";
import { workspaceDirs } from "./workspaces";

export const EVIDENCE_DIR = ".specgate/evidence";
/** Where Playwright, and most browser runners, leave screenshots and traces. */
const RESULTS_DIR = "test-results";
const LOG_LINES = 400;

export interface ScenarioRun {
  command: string;
  exitCode: number;
  ms: number;
  output: string;
  /** When the run started, epoch ms: the artifacts are the files changed since. */
  startedAt: number;
}

function filesChangedSince(root: string, since: number, rel = "", out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) filesChangedSince(root, since, child, out);
    else if (e.isFile()) {
      try {
        if (fs.statSync(path.join(root, child)).mtimeMs >= since - 1000) out.push(child);
      } catch {
        /* gone meanwhile */
      }
    }
  }
  return out;
}

/** What stays out of git under `.specgate/evidence/`; a line an older file lacks is added. */
const IGNORED = ["*/artifacts/", "*/before/artifacts/", "*/attempts/*/artifacts/"];

function ignoreArtifacts(root: string): void {
  const ignore = path.join(root, ".gitignore");
  let text = "";
  try {
    text = fs.readFileSync(ignore, "utf8");
  } catch {
    text = "# Screenshots, traces and videos: kept here, not in git (REQ-680, REQ-803).\n";
  }
  const lines = text.split(/\r?\n/);
  const missing = IGNORED.filter((l) => !lines.includes(l));
  if (missing.length === 0) return;
  fs.writeFileSync(ignore, `${text.trimEnd()}\n${missing.join("\n")}\n`, "utf8");
}

/**
 * Copy what the runner wrote under `test-results/` since the run started into
 * `<dir>/artifacts/`; a workspace's `test-results/` lands under
 * `artifacts/<workspace>/` (REQ-809).
 */
function keepArtifacts(projectDir: string, dir: string, run: ScenarioRun): string[] {
  fs.rmSync(path.join(dir, "artifacts"), { recursive: true, force: true });
  const kept: string[] = [];
  for (const ws of ["", ...workspaceDirs(projectDir)]) {
    const results = path.join(projectDir, ws, RESULTS_DIR);
    for (const rel of filesChangedSince(results, run.startedAt)) {
      const as = ws ? `${ws}/${rel}` : rel;
      const to = path.join(dir, "artifacts", as);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(results, rel), to);
      kept.push(`artifacts/${as}`);
    }
  }
  return kept.sort();
}

const tail = (output: string) => output.split("\n").slice(-LOG_LINES).join("\n").trimEnd() + "\n";

/**
 * The run of `id`'s scenarios before its code (ADR-0047, REQ-803):
 * `before/run.json`, `before/run.log` and `before/artifacts/`, red or green.
 * Returns its run.json, relative to the project.
 */
export function keepBefore(
  projectDir: string,
  id: string,
  run: ScenarioRun,
  at = new Date()
): string {
  const root = path.join(projectDir, EVIDENCE_DIR);
  const dir = path.join(root, id, "before");
  // A new before starts a new cycle: the attempts after the old one go (REQ-819).
  fs.rmSync(path.join(root, id, "attempts"), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  ignoreArtifacts(root);
  const artifacts = keepArtifacts(projectDir, dir, run);
  fs.writeFileSync(path.join(dir, "run.log"), tail(run.output), "utf8");
  const file = path.join(dir, "run.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        requirement: id,
        at: at.toISOString(),
        command: run.command,
        exitCode: run.exitCode,
        ms: run.ms,
        artifacts,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return path.relative(projectDir, file).split(path.sep).join("/");
}

export interface Attempt {
  n: number;
  command: string;
  exitCode: number;
  at: string;
}

/** The deliveries of a requirement whose scenarios failed, oldest first (REQ-819). */
export function readAttempts(projectDir: string, id: string): Attempt[] {
  const dir = path.join(projectDir, EVIDENCE_DIR, id, "attempts");
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => /^\d+$/.test(n))
    .map((n) => {
      try {
        const run = JSON.parse(fs.readFileSync(path.join(dir, n, "run.json"), "utf8"));
        return { n: Number(n), command: run.command, exitCode: run.exitCode, at: run.at };
      } catch {
        return null;
      }
    })
    .filter((a): a is Attempt => a !== null)
    .sort((a, b) => a.n - b.n);
}

/**
 * A delivery whose scenarios failed, kept as the next attempt (REQ-819):
 * `attempts/<n>/run.json`, `run.log` and `artifacts/` — what the runner and
 * the AI log wrote. Returns its folder, relative to the project.
 */
export function keepAttempt(projectDir: string, id: string, run: ScenarioRun, at = new Date()): string {
  const root = path.join(projectDir, EVIDENCE_DIR);
  const n = (readAttempts(projectDir, id).pop()?.n || 0) + 1;
  const dir = path.join(root, id, "attempts", String(n));
  fs.mkdirSync(dir, { recursive: true });
  ignoreArtifacts(root);
  const artifacts = keepArtifacts(projectDir, dir, run);
  fs.writeFileSync(path.join(dir, "run.log"), tail(run.output), "utf8");
  fs.writeFileSync(
    path.join(dir, "run.json"),
    JSON.stringify(
      { requirement: id, attempt: n, at: at.toISOString(), command: run.command, exitCode: run.exitCode, ms: run.ms, artifacts },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return path.relative(projectDir, dir).split(path.sep).join("/");
}

/** The before of a requirement, as `evidence.json` names it (REQ-804), or null. */
export function readBefore(
  projectDir: string,
  id: string
): { command: string; exitCode: number; at: string } | null {
  try {
    const run = JSON.parse(
      fs.readFileSync(path.join(projectDir, EVIDENCE_DIR, id, "before", "run.json"), "utf8")
    );
    return { command: run.command, exitCode: run.exitCode, at: run.at };
  } catch {
    return null;
  }
}

/** Write the evidence of `id`'s delivery; returns its folder, relative to the project. */
export function keepEvidence(
  projectDir: string,
  id: string,
  run: ScenarioRun,
  at = new Date()
): string {
  const root = path.join(projectDir, EVIDENCE_DIR);
  const dir = path.join(root, id);
  // The red run of a reproduced bug (REQ-683) and the before (REQ-803) stay;
  // the last green replaces the one before it.
  fs.mkdirSync(dir, { recursive: true });
  const red = readRed(projectDir, id);
  const before = readBefore(projectDir, id);
  const attempts = readAttempts(projectDir, id);
  ignoreArtifacts(root);
  const artifacts = keepArtifacts(projectDir, dir, run);
  fs.writeFileSync(path.join(dir, "bdd.log"), tail(run.output), "utf8");
  fs.writeFileSync(
    path.join(dir, "evidence.json"),
    JSON.stringify(
      {
        requirement: id,
        at: at.toISOString(),
        scenarios: { command: run.command, exitCode: run.exitCode, ms: run.ms, tags: [`@${id}`] },
        artifacts,
        ...(red ? { red } : {}),
        ...(before ? { before } : {}),
        ...(attempts.length ? { attempts } : {}),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return path.relative(projectDir, dir).split(path.sep).join("/");
}

/** The red run of a requirement that had to be reproduced (REQ-682), or null. */
export function readRed(
  projectDir: string,
  id: string
): { command: string; exitCode: number; at: string } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, EVIDENCE_DIR, id, "red.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Keep the red run that reproduced a bug (REQ-682): red.json and red.log. */
export function keepRed(projectDir: string, id: string, run: ScenarioRun, at = new Date()): string {
  const dir = path.join(projectDir, EVIDENCE_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "red.json"),
    JSON.stringify(
      {
        requirement: id,
        command: run.command,
        exitCode: run.exitCode,
        ms: run.ms,
        at: at.toISOString(),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(path.join(dir, "red.log"), tail(run.output), "utf8");
  return path.relative(projectDir, path.join(dir, "red.json")).split(path.sep).join("/");
}

/** Whether a requirement's trace says it must be reproduced first (REQ-683). */
export function mustReproduce(projectDir: string, id: string): boolean {
  const heading = new RegExp(`^#{2,4}\\s+(?:Requirement:\\s*)?${escapeRegExp(id)}\\b`);
  const files: string[] = [path.join(projectDir, "spec.md")];
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "archive") walk(full);
      else if (e.name === "spec.md") files.push(full);
    }
  };
  walk(path.join(projectDir, "docs", "specs"));
  for (const f of files) {
    let lines: string[];
    try {
      lines = fs.readFileSync(f, "utf8").split("\n");
    } catch {
      continue;
    }
    const at = lines.findIndex((l) => heading.test(l.trim()));
    if (at < 0) continue;
    for (let i = at + 1; i < lines.length && !/^#{2,4}\s/.test(lines[i]); i += 1) {
      if (/specgate:trace\b[^>]*\brepro=required\b/.test(lines[i])) return true;
    }
  }
  return false;
}

/** Where a project records what its AI models decided during a run (REQ-817), under the runner's results. */
export const AI_LOG = "test-results/specgate/ai-decisions.jsonl";

/**
 * The environment of a run of a requirement's scenarios: SPECGATE_AI_LOG,
 * absolute, emptied first, so what the project writes there belongs to this
 * run and is kept with its artifacts (REQ-817).
 */
export function scenarioEnv(projectDir: string): NodeJS.ProcessEnv {
  const file = path.resolve(projectDir, AI_LOG);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.rmSync(file, { force: true });
  } catch {
    /* an unwritable results folder: the run goes on without the record */
  }
  return { ...process.env, SPECGATE_AI_LOG: file };
}

/** The command that runs a requirement's scenarios, `{tags}` as `@<REQ>`. */
export function scenarioCommand(bddCmd: string, id: string): string {
  return bddCmd.includes("{tags}") ? bddCmd.split("{tags}").join(`@${id}`) : `${bddCmd} @${id}`;
}
