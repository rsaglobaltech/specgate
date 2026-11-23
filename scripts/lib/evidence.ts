/**
 * What proved a delivery, kept beside it (REQ-680): `.specgate/evidence/<REQ>/`
 * with `evidence.json` (the command that ran the requirement's scenarios, its
 * exit code and duration), `bdd.log` (its output) and `artifacts/` (what the
 * browser tests left in `test-results/` during that run — screenshots, traces,
 * videos). `artifacts/` stays out of git.
 */

import * as fs from "node:fs";
import * as path from "node:path";

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

/** Write the evidence of `id`'s delivery; returns its folder, relative to the project. */
export function keepEvidence(projectDir: string, id: string, run: ScenarioRun, at = new Date()): string {
  const root = path.join(projectDir, EVIDENCE_DIR);
  const dir = path.join(root, id);
  // The red run of a reproduced bug (REQ-683) stays; the last green replaces the one before.
  fs.rmSync(path.join(dir, "artifacts"), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const red = readRed(projectDir, id);
  const ignore = path.join(root, ".gitignore");
  if (!fs.existsSync(ignore))
    fs.writeFileSync(ignore, "# Screenshots, traces and videos: kept here, not in git (REQ-680).\n*/artifacts/\n", "utf8");

  const results = path.join(projectDir, RESULTS_DIR);
  const artifacts = filesChangedSince(results, run.startedAt);
  for (const rel of artifacts) {
    const to = path.join(dir, "artifacts", rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(results, rel), to);
  }
  fs.writeFileSync(
    path.join(dir, "bdd.log"),
    run.output.split("\n").slice(-LOG_LINES).join("\n").trimEnd() + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "evidence.json"),
    JSON.stringify(
      {
        requirement: id,
        at: at.toISOString(),
        scenarios: { command: run.command, exitCode: run.exitCode, ms: run.ms, tags: [`@${id}`] },
        artifacts: artifacts.map((a) => `artifacts/${a}`).sort(),
        ...(red ? { red } : {}),
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
      { requirement: id, command: run.command, exitCode: run.exitCode, ms: run.ms, at: at.toISOString() },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "red.log"),
    run.output.split("\n").slice(-LOG_LINES).join("\n").trimEnd() + "\n",
    "utf8"
  );
  return path.relative(projectDir, path.join(dir, "red.json")).split(path.sep).join("/");
}

/** Whether a requirement's trace says it must be reproduced first (REQ-683). */
export function mustReproduce(projectDir: string, id: string): boolean {
  const heading = new RegExp(`^#{2,4}\\s+(?:Requirement:\\s*)?${id}\\b`);
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

/** The command that runs a requirement's scenarios, `{tags}` as `@<REQ>`. */
export function scenarioCommand(bddCmd: string, id: string): string {
  return bddCmd.includes("{tags}") ? bddCmd.split("{tags}").join(`@${id}`) : `${bddCmd} @${id}`;
}
