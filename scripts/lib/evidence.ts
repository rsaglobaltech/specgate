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
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
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
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return path.relative(projectDir, dir).split(path.sep).join("/");
}
