/**
 * `harness run --chain` (ADR-0036): the one place the harness merges.
 */

import { ticketKeyOf } from "../../lib/ticket-keys";
import * as path from "node:path";
import { appendEvent, eventsFileFor } from "../../lib/harness-events";
import { takeStop } from "../../lib/harness-guard";
import { PROMPT_ARCHIVE_DIR } from "../../../packages/core/src/domain/EmptyAttempt";
import { removeTempFile } from "../../lib/temp-file";
import {
  HarnessRequirement,
  RunContext,
  RequirementResult,
  info,
  warn,
  git,
  isGitClean,
  resolveGeneratedConflicts,
  STOP_ASKED,
  notAttempted,
} from "./shared";
import { gateReporter, runGate } from "./gate";

/**
 * `--chain` (ADR-0036): the one place the harness merges, and only on request.
 *
 * Each requirement is cut from the head the previous merge produced, so it
 * builds on everything before it. A green one is merged into the branch the
 * run started on with a merge commit — one revertible commit per requirement,
 * its prompt archive left on its own branch — and the gate runs again on the
 * merged result: green alone is not green together. A red result is undone,
 * and the chain stops at the first requirement that does not pass.
 */
export async function runChain(
  pending: HarnessRequirement[],
  ctx: RunContext,
  hintByReq: Map<string, string>,
  /**
   * Runs one level at concurrency 1: the command's `runLevels` with its
   * in-process runner, handed in so this module does not import the command.
   */
  runOneLevel: (
    reqs: HarnessRequirement[],
    ctx: RunContext,
    hintByReq: Map<string, string>
  ) => Promise<RequirementResult[]>
): Promise<RequirementResult[]> {
  const projectDir = ctx.projectDir;
  const results: RequirementResult[] = [];
  for (let i = 0; i < pending.length; i += 1) {
    const req = pending[i];
    const stop = (reason: string) => {
      for (const rest of pending.slice(i + 1)) {
        results.push(notAttempted(rest, rest.requirement, reason));
      }
    };
    // REQ-209: a stop asked while the last requirement ran starts no other.
    if (i > 0 && takeStop(projectDir)) {
      for (const rest of pending.slice(i)) {
        results.push(notAttempted(rest, rest.requirement, "a stop was asked", STOP_ASKED));
      }
      info(`stopped as asked: ${pending.length - i} requirement(s) not attempted`);
      break;
    }
    const [result] = await runOneLevel([req], ctx, hintByReq);
    results.push(result);
    if (!result || result.result !== "pass") {
      stop(`the chain stopped at ${req.requirement}`);
      break;
    }

    const branch = `harness/${req.requirement}`;
    // REQ-574: where this branch stood before the merge — what every undo goes
    // back to. `HEAD~1` is not it when a step failed: that would be a commit of yours.
    const before = git(projectDir, ["rev-parse", "HEAD"]).stdout.trim();
    const undo = (why: string) => {
      git(projectDir, ["merge", "--abort"]);
      git(projectDir, ["reset", "-q", "--hard", before]);
      Object.assign(result, { result: "fail", error: why });
      stop(`the chain stopped at ${req.requirement}`);
    };
    const merge = git(projectDir, ["merge", "--no-ff", "--no-commit", branch]);
    if (merge.status !== 0) {
      // Concluded below, with the prompts left out, as one commit.
      const unresolved = resolveGeneratedConflicts(projectDir, false);
      if (unresolved.length > 0) {
        git(projectDir, ["merge", "--abort"]);
        Object.assign(result, {
          result: "fail",
          error: `merge into the chain's branch conflicted in: ${unresolved.join(", ")}`,
        });
        stop(`the chain stopped at ${req.requirement}`);
        break;
      }
    }
    // The prompts stay on the requirement's branch, for review and --resume;
    // they never reach the branch the chain merges into.
    const prompts = git(projectDir, [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=A",
      "HEAD",
      "--",
      PROMPT_ARCHIVE_DIR,
    ])
      .stdout.split("\n")
      .filter(Boolean);
    if (prompts.length > 0) {
      git(projectDir, ["rm", "-q", "--cached", "--", ...prompts]);
      for (const f of prompts) removeTempFile(path.join(projectDir, f));
    }
    const title = String(req.title || req.use_case || req.useCase || "").replace(/^UC-\d+\s*/, "");
    const mergeKey = ticketKeyOf(projectDir, req.requirement);
    const made = git(projectDir, [
      "commit",
      "-q",
      "-m",
      `${mergeKey ? `${mergeKey} ` : ""}Merge ${branch}${title ? ` — ${title}` : ""}\n\n` +
        `Merged by \`specgate harness run --chain\` after its gate passed on ${branch}.`,
    ]);
    if (made.status !== 0) {
      undo(
        `the merge commit of ${branch} failed:\n${`${made.stderr || ""}${made.stdout || ""}`.trim()}`
      );
      warn(`${req.requirement}: the merge commit failed — the branch is back where it was`);
      break;
    }

    const eventsFile = eventsFileFor(projectDir, req.requirement);
    const attempt = Number(result.attempts) || undefined;
    appendEvent(eventsFile, { type: "merge", into: "HEAD", branch }, req.requirement, attempt);
    const gate = runGate(
      projectDir,
      ctx.settings.testCmd,
      ctx.timeoutMs,
      req,
      // The checks judged the branch already; the post-merge gate is the suite's.
      { ...ctx.settings, quality: undefined },
      gateReporter(eventsFile, req.requirement, attempt, "post-merge ")
    );
    if (!gate.ok) {
      git(projectDir, ["reset", "-q", "--hard", before]);
      Object.assign(result, {
        result: "fail",
        error: `post-merge gate: ${gate.stage}\n${String(gate.output || "").slice(-4000)}`,
      });
      warn(
        `${req.requirement}: green on ${branch}, red once merged — the merge was undone. ` +
          `This gate runs in the working copy: tests or a server started there by hand ` +
          `while the harness runs can break it.`
      );
      stop(`the chain stopped at ${req.requirement}`);
      break;
    }
    // The gate may regenerate the matrix: it belongs to the merge commit.
    if (!isGitClean(projectDir)) {
      git(projectDir, ["add", "-A"]);
      const amended = git(projectDir, ["commit", "-q", "--amend", "--no-edit"]);
      if (amended.status !== 0) {
        undo(
          `the merge of ${branch} could not take the regenerated files:\n${amended.stderr || ""}`
        );
        warn(`${req.requirement}: the merge was undone — the branch is back where it was`);
        break;
      }
    }
    info(`${req.requirement}: merged into the chain's branch, gate green`);
  }
  return results;
}
