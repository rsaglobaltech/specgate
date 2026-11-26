import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import {
  controlsChanged,
  stepLog,
  type ControlRecord,
} from "../../packages/core/src/domain/ControlRecord";
import { guardOff, stepHashes, stepRecordFile } from "../plugin/project-state";
import { fileHash, sealedAcceptance } from "./acceptance";

/**
 * outside-judge REQ-747: the controls as they are in a project. Read before the
 * agent starts and when it stops, by the one who judges the run — and kept by
 * them, never written into the project.
 */

const hash = (text: string) => (text ? `sha256:${createHash("sha256").update(text).digest("hex")}` : "");

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function dirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function controlsOf(projectDir: string): ControlRecord {
  const changes = path.join(projectDir, "docs", "specs", "changes");
  const approvals: Record<string, string> = {};
  for (const id of dirs(changes)) {
    if (id === "archive") continue;
    const line = (/^approved:.*$/m.exec(read(path.join(changes, id, "change.yaml"))) || [""])[0];
    approvals[id] = hash(`${read(path.join(changes, id, "approvals.json"))}${line}`);
  }
  const evidenceDir = path.join(projectDir, ".specgate", "evidence");
  const evidence: string[] = [];
  const stepsReviewed: string[] = [];
  for (const req of dirs(evidenceDir)) {
    const text = read(path.join(evidenceDir, req, "evidence.json"));
    if (!text) continue;
    evidence.push(req);
    try {
      if (JSON.parse(text)?.steps?.reviewed) stepsReviewed.push(req);
    } catch {
      /* evidence that cannot be read says nothing of a review */
    }
  }
  return {
    // The switch as the project says it: the judge's own environment is not the agent's.
    guard: guardOff(projectDir, {}) ? "off" : "on",
    policy: hash(read(path.join(projectDir, ".specgate", "gate.yaml"))),
    approvals,
    evidence,
    stepsReviewed,
    acceptance: Object.fromEntries(
      sealedAcceptance(projectDir).map((t) => {
        const text = read(path.join(projectDir, t.file));
        return [t.file, text === "" && !fs.existsSync(path.join(projectDir, t.file)) ? "" : fileHash(text)];
      })
    ),
  };
}

/** What the session changed, against the reading of before it; the hook log's steps, when there is one. */
export function sessionChanged(projectDir: string, before: ControlRecord, hookLogFile?: string): string[] {
  const log = hookLogFile ? stepLog(read(hookLogFile)) : [];
  return controlsChanged(before, controlsOf(projectDir), {
    log,
    now: {
      files: stepHashes(projectDir),
      recorded: log.map((e) => e.requirement).filter((r) => fs.existsSync(stepRecordFile(projectDir, r))),
    },
  });
}

/**
 * branch-controls: what a branch changes in the controls, against where it
 * left its base — read for the person who reviews it before it merges. The
 * base's controls are read from git into a folder of the check's own; an
 * approval that left with its change into the archive is not a change.
 */
export function branchControls(
  projectDir: string,
  base: string
): { state: "checked"; changed: string[] } | { state: "skipped"; reason: string } {
  const git = (args: string[]) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const met = git(["merge-base", "HEAD", base]);
  if (met.status !== 0) return { state: "skipped", reason: `no common history with '${base}'` };
  const at = met.stdout.trim();
  const prefix = git(["rev-parse", "--show-prefix"]).stdout.trim();
  const listed = git(["ls-tree", "-r", "--name-only", at, "--", ".specgate", "docs/specs/changes"]);
  if (listed.status !== 0) return { state: "skipped", reason: `'${base}' cannot be read` };
  const wanted = /^(\.specgate\/(gate\.yaml|config\.json|evidence\/[^/]+\/evidence\.json)|docs\/specs\/changes\/(?!archive\/)[^/]+\/(change\.yaml|approvals\.json))$/;
  const there = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-base-controls-"));
  try {
    for (const rel of listed.stdout.split("\n").filter((f) => wanted.test(f))) {
      const shown = git(["show", `${at}:${prefix}${rel}`]);
      if (shown.status !== 0) continue;
      fs.mkdirSync(path.dirname(path.join(there, rel)), { recursive: true });
      fs.writeFileSync(path.join(there, rel), shown.stdout);
    }
    const archived = dirs(path.join(projectDir, "docs", "specs", "changes", "archive"));
    const changed = controlsChanged(controlsOf(there), controlsOf(projectDir)).filter((line) => {
      const gone = /^the approval of (.+) is gone$/.exec(line);
      return !(gone && archived.some((a) => a.endsWith(`-${gone[1]}`)));
    });
    return { state: "checked", changed };
  } finally {
    fs.rmSync(there, { recursive: true, force: true });
  }
}
