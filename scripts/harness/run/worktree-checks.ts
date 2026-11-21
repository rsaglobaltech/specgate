/**
 * What an agent left in its worktree, judged before and after the gate: what
 * it wrote, whether it touched the contract it is judged against, the gate
 * command, a decision kept for a person, the artifacts its row declares, the
 * operation it cites — and, with lanes, what a role wrote outside its own.
 *
 * Each check reads the worktree through git and the filesystem and returns
 * what it found, or nothing. None decides what the attempt does next: that is
 * the attempt's own business (`RunCommand`).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  checkWriteScope,
  parseGitStatus,
  WriteScopeChanges,
  onlyTraceStatusChanged,
  onlyTaskTicksChanged,
} from "../../../packages/core/src/domain/WriteScope";
import {
  DECISION_RIGHTS_FILE,
  decisionsExceeded,
  parseDecisionRights,
} from "../../../packages/core/src/domain/DecisionRights";
import { gateCommandIntegrity } from "../../../packages/core/src/domain/GateCommandIntegrity";
import { isEmptyAttempt, PROMPT_ARCHIVE_DIR } from "../../../packages/core/src/domain/EmptyAttempt";
import { checkDeclaredArtifacts } from "../../../packages/core/src/domain/DeclaredArtifacts";
import { isTestFile } from "../../../packages/core/src/infrastructure/DerivedMatrixSources";
import type { HarnessRole } from "../../../packages/core/src/domain/HarnessRun";
import type { HarnessSettings } from "../../../packages/core/src/infrastructure/HarnessConfigFile";
import { derivedMatrixFor } from "../../cli/commands/spec/MatrixCommand";
import { isDerivedProject } from "../../lib/derived-writes";
import { citedOperation, conformanceWarnings, memberCitations } from "../../lib/contracts";
import { workspaceMemberDirs } from "../../lib/story-part";
import { git, HarnessRequirement } from "./shared";

/**
 * Did the agent edit the contract it was being judged against? (A1, closes H16)
 *
 * The prompt asks it not to; nothing checked. An agent that cannot make the
 * scenario pass can relax the scenario, or add a permissive line to
 * `AI_RULES.md`, and the gate approves — `validate --strict-tdd` verifies that
 * the feature exists and is in the matrix, never that it still says what it
 * said. "Specs as executable contracts" stops being true the moment the
 * executor may edit the contract.
 *
 * Run **before** the gate, not after: once the scenario has been loosened, a
 * green gate means nothing, so there is no point asking it.
 *
 * The diff of the offending paths goes back into the next attempt's prompt.
 * That is not politeness — in practice the agent almost always did it without
 * meaning to, and being shown the hunk is what corrects it. A refusal with no
 * evidence just gets repeated.
 */
/**
 * What the agent wrote, as git sees it.
 *
 * `-uall` is not optional. Plain `--porcelain` collapses a wholly new directory
 * into a single `?? src/` entry, so `src/Health.java` never appears and any
 * check reading it concludes the file was never written. Found by an agent that
 * had correctly created both declared artifacts and was reported as having
 * touched neither.
 */
export function worktreeChanges(worktreeDir: string): WriteScopeChanges | null {
  const status = git(worktreeDir, ["status", "--porcelain", "-uall"]);
  if (status.status !== 0) return null;
  return parseGitStatus(status.stdout || "");
}

/**
 * Did the agent write anything at all? (H19)
 *
 * The gate runs *before* `specgate done`, so at gate time the requirement is still
 * `Draft` — and `--strict-tdd`'s "no Test Artifact = TBD past Draft" rule does
 * not apply to a Draft row. `done` then flips the status to `Implemented` and
 * nothing validates again. The consequence, reproduced on 2026-08-26 with
 * `--agent "cat {prompt_file} > /dev/null"` against a freshly generated
 * project: **an agent that wrote zero files reported `pass (1 attempt)`**, with
 * the row moved to `Implemented` and its Test artifact still `TBD`.
 *
 * `--strict-artifacts` cannot catch this either: it compares the diff against
 * the paths the row declares, and a row that declares none has nothing to
 * compare.
 *
 * So the harness asks the one question that needs no declaration and has no
 * legitimate negative answer: did anything change? An agent that produced no
 * files cannot have implemented a requirement, whatever the gate says about the
 * documents around it. That makes this a hard failure rather than an opt-in
 * flag, under the rule ADR-0023 sets out — a content check is a gate only when
 * failing it is always a defect, and this one is.
 *
 * The prompt archive does not count. The harness writes it itself, so counting
 * it would mean the harness's own bookkeeping vouches for the agent.
 *
 * Run **before** the gate, for the same reason `checkWriteScopeInWorktree` is:
 * a green gate over an empty diff proves nothing, so there is no point asking
 * it. It is also the cheaper order — an empty attempt stops before the project's
 * test command runs.
 */
export function producedNothing(worktreeDir: string): boolean {
  return isEmptyAttempt(touchedPaths(worktreeDir));
}

/**
 * A generated matrix that says exactly what regenerating it says was not
 * edited — it was regenerated. Writing tests that name scenarios changes the
 * derived matrix the moment anything runs `specgate` in the worktree, and the
 * write-scope guard failed REQ-302 twice for a matrix identical to its own
 * regeneration (golden_app finding #37). A hand edit still differs, and still
 * fails.
 */
export function isRegeneratedMatrix(worktreeDir: string, rel: string): boolean {
  if (rel !== "docs/specs/traceability.md" || !isDerivedProject(worktreeDir)) return false;
  try {
    const current = fs.readFileSync(path.join(worktreeDir, rel), "utf8");
    return derivedMatrixFor(worktreeDir, current) === current;
  } catch {
    return false;
  }
}

/** A spec file whose only change is the `status=` `specgate done` writes (#56). */
export function isStatusOnlyEdit(worktreeDir: string, rel: string): boolean {
  if (!/\.md$/.test(rel)) return false;
  const d = git(worktreeDir, ["diff", "-U0", "HEAD", "--", rel]);
  return d.status === 0 && onlyTraceStatusChanged(d.stdout || "");
}

/** REQ-375: a change's tasks.md whose tasks only changed their box. */
export function isTaskTickOnlyEdit(worktreeDir: string, rel: string): boolean {
  if (!/(^|\/)docs\/specs\/changes\/[^/]+\/tasks\.md$/.test(rel.split(path.sep).join("/")))
    return false;
  const d = git(worktreeDir, ["diff", "-U0", "HEAD", "--", rel]);
  return d.status === 0 && onlyTaskTicksChanged(d.stdout || "");
}

export function checkWriteScopeInWorktree(worktreeDir: string, settings: HarnessSettings) {
  const all = worktreeChanges(worktreeDir);
  if (!all) return null;
  const changes = {
    ...all,
    modified: all.modified.filter(
      (p) =>
        !isRegeneratedMatrix(worktreeDir, p) &&
        !isStatusOnlyEdit(worktreeDir, p) &&
        !isTaskTickOnlyEdit(worktreeDir, p)
    ),
  };

  const violations = checkWriteScope(changes, {
    protectedPaths: settings.protectedPaths.length ? settings.protectedPaths : undefined,
    allowPaths: settings.allowPaths,
  });
  if (violations.length === 0) return null;

  const diff = git(worktreeDir, ["diff", "--", ...violations.map((v) => v.path)]);
  const evidence = (diff.stdout || "").trim();

  return {
    violations,
    message:
      `agent_touched_protected_path — the agent modified ${violations.length} file(s) it is ` +
      `not allowed to change:\n` +
      violations.map((v) => `  ${v.path}  (protected by \`${v.pattern}\`)`).join("\n") +
      `\n\nThese files are the contract this requirement is judged against. Editing them ` +
      `makes a passing gate meaningless. Revert them and satisfy the scenario as written.\n` +
      (evidence ? `\nWhat was changed:\n\n\`\`\`diff\n${evidence}\n\`\`\`\n` : "") +
      `\nIf the change is genuinely required, it belongs in a spec change ` +
      `(\`specgate propose\`), reviewed by a person — not in this attempt.`,
  };
}

/**
 * REQ-547: a decision the project keeps for a person — a dependency, a
 * migration, a public API operation — taken by the agent anyway. Read from the
 * diff against the attempt's base; the rights file is read from the worktree's
 * base too, so an agent cannot grant itself the right (the file is protected).
 */
export function checkDecisionRightsInWorktree(worktreeDir: string) {
  const committed = git(worktreeDir, ["show", `HEAD:${DECISION_RIGHTS_FILE}`]);
  if (committed.status !== 0) return null;
  const { rights } = parseDecisionRights(committed.stdout || "");
  if (![...rights.values()].includes("ask")) return null;
  const all = worktreeChanges(worktreeDir);
  if (!all) return null;
  const read = (rel: string) => {
    const full = path.join(worktreeDir, rel);
    return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, "utf8") : null;
  };
  const changes = [
    ...all.modified.map((p) => {
      const before = git(worktreeDir, ["show", `HEAD:${p}`]);
      return { path: p, before: before.status === 0 ? before.stdout : null, after: read(p) };
    }),
    ...all.added.map((p) => ({ path: p, before: null, after: read(p) })),
  ];
  const exceeded = decisionsExceeded(rights, changes);
  if (exceeded.length === 0) return null;
  return {
    exceeded,
    message:
      `decision_right_exceeded — the attempt took ${exceeded.length} decision(s) ` +
      `${DECISION_RIGHTS_FILE} keeps for a person:\n` +
      exceeded.map((e) => `  ${e.decision}: ${e.file} (${e.detail})`).join("\n") +
      `\n\nUndo them and meet the requirement without them. If it cannot be met ` +
      `without one, ask: \`specgate ask <REQ> "<what you need, and why>"\`.`,
  };
}

/**
 * Did the agent rewrite the definition the gate command depends on? (#167)
 *
 * The write-scope guard covers the contract — spec.md, AI_RULES.md, features/**
 * — and not the file that defines the command the gate runs. Measured with a
 * stub agent that wrote no implementation at all and only replaced
 * `"test": "node --test tests/*.test.js"` with `"echo 'all good'"` over a red
 * suite: `✅ REQ-001 pass (1 attempt)`.
 *
 * This does not protect the manifest — adding a dependency mid-implementation
 * is legitimate, and a guard that blocks it gets switched off. It compares one
 * value: the script the gate actually invokes, at the base commit and now.
 *
 * Returns null when there is nothing to report, including when the gate command
 * is one whose meaning does not live in a file we can read.
 */
export function checkGateCommandInWorktree(worktreeDir: string, baseRef: string, testCmd: string) {
  if (!testCmd) return null;

  const probe = gateCommandIntegrity(testCmd, "{}", "{}");
  if (!probe.script) return null;
  const manifest = probe.script.manifest;

  const show = git(worktreeDir, ["show", `${baseRef}:${manifest}`]);
  const before = show.status === 0 ? show.stdout : null;
  const currentPath = path.join(worktreeDir, manifest);
  const after = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, "utf8") : null;

  const result = gateCommandIntegrity(testCmd, before, after);
  if (!result.checked || !result.changed) return null;
  // A checked result always names its script: the probe above resolved it.
  const changed = result.script!;

  return {
    manifest,
    script: changed.script,
    message:
      `agent_rewrote_gate_command — the gate runs \`${testCmd}\`, and this attempt ` +
      `changed what that means.\n\n` +
      `  ${manifest} → scripts.${changed.script}\n` +
      `  before: ${result.before === null ? "(absent)" : result.before}\n` +
      `  after:  ${result.after === null ? "(absent)" : result.after}\n\n` +
      `The command the gate runs is part of the contract this requirement is ` +
      `judged against, exactly like the scenario is. Weakening it makes a green ` +
      `gate meaningless.\n\n` +
      `Revert that script and make the suite pass as it stands. If the command is ` +
      `genuinely wrong, that is a change for a person to make — not something to ` +
      `fix inside the attempt being measured by it.`,
  };
}

/**
 * Every path the agent wrote in this worktree — added and modified alike.
 *
 * Shared with the write-scope guard, which is why A2 costs almost nothing: the
 * diff was already being read.
 */
export function touchedPaths(worktreeDir: string): string[] {
  const changes = worktreeChanges(worktreeDir);
  return changes ? [...changes.modified, ...changes.added] : [];
}

/**
 * Did the green diff touch what the matrix said it would? (A2)
 *
 * The row declares `test_artifact` and `technical_artifact` and the prompt
 * hands both to the agent, but nothing checked the diff contained them. An
 * agent can implement somewhere else, pass the scenario, and leave the matrix
 * pointing at a file where the logic does not live — the documentary lie
 * `AI_RULES.md` forbids this repository.
 *
 * Run after a **green** gate, because the claim being checked is about a diff
 * that already works. A red attempt has a more urgent problem.
 *
 * A warning by default. An implementation can legitimately land in a shared
 * module that already exists, and a hard failure there would be the kind of
 * gate that rejects good work — which already cost two runs on REQ-002.
 * `--strict-artifacts` is for a project that wants it enforced.
 */
export function checkDeclaredArtifactsInWorktree(
  worktreeDir: string,
  req: HarnessRequirement,
  strict: boolean
) {
  const findings = checkDeclaredArtifacts(
    {
      touched: touchedPaths(worktreeDir),
      testArtifact: req.testArtifact || req.test_artifact,
      technicalArtifact: req.technicalArtifact || req.technical_artifact,
      requirement: req.requirement,
    },
    strict
  );
  return findings.length > 0 ? findings : null;
}

/** REQ-418: the operations `requirement` cites whose path no source file of the worktree has. */
export function contractNotMet(worktreeDir: string, projectDir: string, requirement: string) {
  const dirOf = workspaceMemberDirs(projectDir);
  // Another repository's operation: the contracts repository cites its own
  // operations unqualified, and serves none of them.
  const cited = memberCitations(worktreeDir).filter(
    (c) => c.requirement === requirement && /^[A-Za-z][A-Za-z0-9-]*:[^#]+#/.test(c.ref)
  );
  if (cited.length === 0) return [];
  return conformanceWarnings(
    worktreeDir,
    "",
    cited,
    (c) => citedOperation(c.ref, dirOf, worktreeDir)?.operation || null,
    () => "Implemented",
    true
  );
}

/**
 * Build manifests either role may change (REQ-533): a tester adds the test
 * runner, an implementer the library it uses. Kept and visible in the diff.
 */
export const LANE_FREE =
  /(^|\/)(package\.json|package-lock\.json|pom\.xml|build\.gradle|build\.gradle\.kts)$/;

/** Is this file outside the lane of `role` (REQ-533)? */
export function outsideLane(role: HarnessRole, rel: string): boolean {
  if (rel.startsWith(PROMPT_ARCHIVE_DIR) || LANE_FREE.test(rel)) return false;
  return role === "tester" ? !isTestFile(rel) : isTestFile(rel);
}

/** What the role is told, before the requirement's own prompt (REQ-532). */
export function roleInstruction(role: HarnessRole, requirement: string): string {
  return role === "tester"
    ? `You are the **tester** for ${requirement}. Write the failing tests its scenarios call ` +
        `for, each naming ${requirement} and its scenario id, in the project's test style. Write ` +
        "no production code: a separate implementer session makes your tests pass, and any " +
        "file you write outside the tests is reverted."
    : `You are the **implementer** for ${requirement}. The tester has written its tests; make ` +
        "them pass by writing the production code. Do not change any test file: test changes " +
        "are reverted, and a test that is wrong is the tester's to fix on the next attempt.";
}

/**
 * The worktree's uncommitted files of one lane, to put back the ones a session
 * changes outside it (REQ-533). Only what is dirty is kept: a file clean at
 * the start of the session is HEAD's, and git can restore it.
 */
export function laneGuard(worktreeDir: string, role: HarnessRole): () => string[] {
  const dirtyNow = () => {
    const c = worktreeChanges(worktreeDir);
    return c ? [...c.modified, ...c.added] : [];
  };
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(worktreeDir, rel));
    } catch {
      return null;
    }
  };
  const before = new Map<string, Buffer | null>();
  for (const rel of dirtyNow()) if (outsideLane(role, rel)) before.set(rel, read(rel));

  return () => {
    const reverted: string[] = [];
    const after = dirtyNow().filter((rel) => outsideLane(role, rel));
    for (const rel of new Set([...after, ...before.keys()])) {
      const now = read(rel);
      const was = before.has(rel) ? before.get(rel)! : undefined;
      if (was !== undefined) {
        if (was === null ? now === null : now !== null && now.equals(was)) continue;
        if (was === null) fs.rmSync(path.join(worktreeDir, rel), { force: true });
        else {
          fs.mkdirSync(path.dirname(path.join(worktreeDir, rel)), { recursive: true });
          fs.writeFileSync(path.join(worktreeDir, rel), was);
        }
      } else if (git(worktreeDir, ["cat-file", "-e", `HEAD:${rel}`]).status === 0) {
        git(worktreeDir, ["checkout", "HEAD", "--", rel]);
      } else {
        fs.rmSync(path.join(worktreeDir, rel), { force: true });
      }
      reverted.push(rel);
    }
    return reverted.sort();
  };
}
