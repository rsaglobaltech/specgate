import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { ArchiveChangeUseCase } from "../../packages/core/src/application/ArchiveChangeUseCase";
import { DiskProjectRepository } from "../../packages/core/src/infrastructure/DiskProjectRepository";
import { listChangeIds, listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import type { ChangeDelta } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { isUntouchedDelta } from "../../packages/core/src/domain/ChangeTemplates";
import { info } from "./diagnostics";
import { refreshDerivedMatrix } from "../cli/commands/spec/MatrixCommand";
import type { Diagnostic } from "./diagnostics";

/**
 * The requirements of open changes, while they are in flight (ADR-0035).
 *
 * A change is archived when its code is done, so until then its requirements
 * live only in its delta. `status`, `apply` and `check` still have to see them:
 * they read the project *as it will be after archive* — a copy with every open
 * change archived into it by the archive engine itself. What the gate passes
 * there is what it passes after the real archive, by construction.
 *
 * Nothing is written to the project: the copy lives in the OS temp directory
 * and is removed by `cleanup()`.
 */

/** Statuses that say the requirement is delivered; archive waits for one of these. */
export const DELIVERED = ["Implemented", "Verified", "Released"];

export interface InFlightRequirement {
  id: string;
  change: string;
  capability: string;
  /** The delta file, relative to the project, posix separators. */
  deltaFile: string;
  status: string;
}

/** A delta still as `propose` wrote it: placeholders only, nothing to judge. */
function untouched(d: ChangeDelta): boolean {
  try {
    return isUntouchedDelta(fs.readFileSync(d.file, "utf8"), d.capability);
  } catch {
    return false;
  }
}

/**
 * The open changes whose every delta is still the skeleton: proposed, not
 * written yet. The in-flight view leaves them out — judging `<short name>`
 * right after `propose` failed `check` before anyone had written a word.
 */
export function unwrittenChanges(projectDir: string): string[] {
  return listChangeIds(projectDir).filter((change) => {
    const deltas = listDeltas(projectDir, change);
    return deltas.length > 0 && deltas.every(untouched);
  });
}

/** What `status` and `check` say about each unwritten change: a note, not a failure. */
export function unwrittenNotes(projectDir: string): Diagnostic[] {
  return unwrittenChanges(projectDir).map((change) =>
    info(
      "change_delta_unwritten",
      `Change ${change}: its delta is not written yet — it is judged once it is.`,
      { target: change, fix: `Write docs/specs/changes/${change}/specs/<capability>/spec.md` }
    )
  );
}

/** Every requirement an open change adds or modifies, change by change. */
export function inFlightRequirements(projectDir: string): InFlightRequirement[] {
  const out: InFlightRequirement[] = [];
  for (const change of listChangeIds(projectDir)) {
    out.push(...changeRequirements(projectDir, change));
  }
  return out;
}

/** The requirements one change adds or modifies. */
export function changeRequirements(projectDir: string, change: string): InFlightRequirement[] {
  const out: InFlightRequirement[] = [];
  for (const d of listDeltas(projectDir, change)) {
    if (untouched(d)) continue;
    let parsed: ReturnType<typeof parseDelta>;
    try {
      parsed = parseDelta(fs.readFileSync(d.file, "utf8"));
    } catch {
      continue; // `change validate` reports a delta that does not parse
    }
    for (const req of [...(parsed.added || []), ...(parsed.modified || [])]) {
      if (!req.id) continue;
      out.push({
        id: req.id,
        change,
        capability: d.capability,
        deltaFile: path.relative(projectDir, d.file).split(path.sep).join("/"),
        status: String((req.trace || {}).status || "Draft"),
      });
    }
  }
  return out;
}

/** Never copied: dependencies, build output, VCS and run state. */
const SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  ".harness",
  ".gradle",
  ".venv",
  "venv",
  "__pycache__",
  ".stryker-tmp",
]);

/** A diagnostic from laying one change over the copy, and which change. */
export type InFlightProblem = Diagnostic & { change: string };

export interface InFlightView {
  /** The copy: the project with every open change archived into it. */
  dir: string;
  requirements: InFlightRequirement[];
  /** Why a change could not be laid over the copy (an invalid delta), with its file. */
  problems: InFlightProblem[];
  /** A path inside the copy, as the project's own path. */
  toProject(text: string): string;
  cleanup(): void;
}

/**
 * The project as it will be once every open change is archived, or `null`
 * when no open change adds or modifies a requirement.
 */
export function inFlightView(projectDir: string): InFlightView | null {
  const requirements = inFlightRequirements(projectDir);
  if (requirements.length === 0) return null;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-in-flight-"));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  // Commands leave through process.exit(), which skips `finally`: the copy is
  // removed on exit too.
  process.once("exit", cleanup);
  fs.cpSync(projectDir, dir, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)),
  });

  const problems: InFlightProblem[] = [];
  const repo = new DiskProjectRepository(dir);
  for (const change of listChangeIds(dir)) {
    // A delta nobody has written yet is not laid over: its placeholders
    // would fail as if they were the author's words.
    const deltas = listDeltas(dir, change);
    const skeletons = deltas.filter(untouched);
    if (skeletons.length === deltas.length) continue;
    for (const d of skeletons) fs.rmSync(d.file, { force: true });
    // Tasks and the draft checklist are the person's gate at archive; here only
    // the specification is laid over, so it can be judged.
    const plan = new ArchiveChangeUseCase(repo).execute(change, { force: true, draft: true });
    if (!plan.ok) {
      for (const d of plan.diagnostics) problems.push({ ...d, change });
      continue;
    }
    repo.executePlan(plan);
  }
  refreshDerivedMatrix(dir);

  const real = path.resolve(projectDir);
  // Full paths first, then the bare folder name a header may print.
  const aliases = [fs.realpathSync(dir), dir, path.basename(dir)];
  const realName = path.basename(real);
  return {
    dir,
    requirements,
    problems,
    toProject: (text: string) =>
      aliases.reduce(
        (t, d, i) => t.split(d).join(i < aliases.length - 1 ? real : realName),
        String(text)
      ),
    cleanup,
  };
}
