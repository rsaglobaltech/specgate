/**
 * The last gate result, kept and read back (REQ-504).
 *
 * Each `specgate check` that reaches a verdict writes `last-check.json` where
 * the pet keeps its state (REQ-256): the repository's git folder, so a check
 * leaves `git status` as it was, or `.specgate/`, ignored there, outside git.
 * specgate-studio's Report view reads it back with `check --last --json` or
 * the API's `lastCheck(dir)` instead of running the whole gate.
 *
 * The git folder is found by reading `.git` — a folder, or a file naming one
 * (a worktree) — not by running git: the API starts no process.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { info } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import type { GateStage } from "./gate-stages";
import type { TestSelection } from "./test-selection";

export const LAST_CHECK_FILE = "last-check.json";
const STATE_DIR = ".specgate";

export interface LastCheck {
  schemaVersion: 1;
  /** When the check ended, ISO 8601. */
  ranAt: string;
  /** HEAD when it ran; null outside git or before the first commit. */
  commit: string | null;
  branch: string | null;
  /** Whether the working tree had changes `commit` does not hold. */
  dirty: boolean | null;
  passed: boolean;
  /** `check --ci`: the ci-stage quality checks ran too. */
  ci: boolean;
  stages: GateStage[];
  /** Which tests it ran, and why (REQ-510); absent from a check older than it. */
  selection?: TestSelection;
  /** The findings the check answered with. */
  status: Diagnostic[];
}

/** The git folder of the repository `dir` is in, or null; read, not asked of git. */
export function gitDirOf(dir: string): string | null {
  let at = path.resolve(dir);
  for (;;) {
    const dotGit = path.join(at, ".git");
    try {
      const st = fs.statSync(dotGit);
      if (st.isDirectory()) return dotGit;
      if (st.isFile()) {
        const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotGit, "utf8"));
        return m ? path.resolve(at, m[1]) : null;
      }
    } catch {
      /* not here: look in the parent */
    }
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

/** Where the last check is kept: the git folder's `specgate/`, else `.specgate/`. */
function stateFile(projectDir: string): { file: string; inGit: boolean } {
  return stateFileFor(projectDir, LAST_CHECK_FILE);
}

/**
 * Where this machine's state named `name` is kept beside the last check — the
 * git folder's `specgate/`, else `.specgate/`, ignored there (REQ-516).
 */
export function stateFileFor(projectDir: string, name: string): { file: string; inGit: boolean } {
  const git = gitDirOf(projectDir);
  return git
    ? { file: path.join(git, "specgate", name), inGit: true }
    : { file: path.join(projectDir, STATE_DIR, name), inGit: false };
}

/** Write this machine's state beside the last check; outside git, ignored in `.specgate/`. */
export function writeState(projectDir: string, name: string, text: string): void {
  const { file, inGit } = stateFileFor(projectDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!inGit) {
    // `.specgate/config.json` is the team's; this is this machine's.
    const ignore = path.join(path.dirname(file), ".gitignore");
    const lines = fs.existsSync(ignore) ? fs.readFileSync(ignore, "utf8") : "";
    if (!lines.split(/\r?\n/).includes(name)) {
      const sep = lines && !lines.endsWith("\n") ? "\n" : "";
      fs.writeFileSync(ignore, `${lines}${sep}${name}\n`, "utf8");
    }
  }
  fs.writeFileSync(file, text, "utf8");
}

/** What git says about where the check ran; nulls outside git. */
function revision(projectDir: string): Pick<LastCheck, "commit" | "branch" | "dirty"> {
  const git = (...args: string[]) => {
    const r = spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
    return r.status === 0 ? String(r.stdout || "").trim() : null;
  };
  const commit = git("rev-parse", "HEAD");
  if (!commit) return { commit: null, branch: null, dirty: null };
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const porcelain = git("status", "--porcelain");
  return {
    commit,
    branch: branch && branch !== "HEAD" ? branch : null,
    dirty: porcelain === null ? null : porcelain !== "",
  };
}

/**
 * Keep this check's result. Best effort: what the gate decided stands even
 * when it cannot be written.
 */
export function recordLastCheck(
  projectDir: string,
  result: {
    passed: boolean;
    ci: boolean;
    stages: GateStage[];
    status: Diagnostic[];
    selection?: TestSelection;
  },
  now = new Date()
): void {
  try {
    const record: LastCheck = {
      schemaVersion: 1,
      ranAt: now.toISOString(),
      ...revision(projectDir),
      passed: result.passed,
      ci: result.ci,
      stages: result.stages,
      ...(result.selection ? { selection: result.selection } : {}),
      status: result.status,
    };
    writeState(projectDir, LAST_CHECK_FILE, `${JSON.stringify(record, null, 2)}\n`);
  } catch {
    /* the gate's verdict stands without the record */
  }
}

/** The last check's result, or null when none was kept. */
export function readLastCheck(projectDir: string): LastCheck | null {
  for (const file of [
    stateFile(projectDir).file,
    path.join(projectDir, STATE_DIR, LAST_CHECK_FILE),
  ]) {
    try {
      const doc = JSON.parse(fs.readFileSync(file, "utf8")) as LastCheck;
      if (doc && typeof doc.passed === "boolean" && Array.isArray(doc.stages)) return doc;
    } catch {
      /* not there */
    }
  }
  return null;
}

/** What `check --last --json` and the API's `lastCheck(dir)` answer. */
export function lastCheckAnswer(projectDir: string): {
  lastCheck: Omit<LastCheck, "status"> | null;
  status: Diagnostic[];
} {
  const last = readLastCheck(projectDir);
  if (!last) {
    return {
      lastCheck: null,
      status: [
        info(
          "last_check_none",
          "No gate result is kept for this project: no check has run here yet.",
          {
            fix: "specgate check",
          }
        ),
      ],
    };
  }
  const { status, ...rest } = last;
  return { lastCheck: rest, status: status || [] };
}
