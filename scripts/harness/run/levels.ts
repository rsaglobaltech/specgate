/**
 * Which requirements run together: the queue in dependency levels, each level
 * in this process or across worker processes, a failure blocking what waits on
 * it, and the run's budget and stop request asked between requirements.
 */

import { BudgetVerdict, budgetVerdict } from "../../../packages/core/src/domain/RunBudget";
import {
  HarnessRequirement,
  RequirementResult,
  RunContext,
  STOP_ASKED,
  notAttempted,
  unattempted,
  warn,
} from "./shared";
import { deriveBase } from "./branches";
import { processRequirement } from "./requirement";
import { runSpentUsdSoFar } from "./state";
import { runWorkers } from "./workers";
import { scheduleLevels } from "../../../packages/core/src/domain/HarnessRun";
import { takeStop } from "../../lib/harness-guard";
/** Runs one level of the schedule: in process, or through worker processes. */
export type LevelRunner = (
  runnable: string[],
  byId: Map<string, HarnessRequirement>,
  hintByReq: Map<string, string>,
  ctx: RunContext,
  concurrency: number
) => Promise<RequirementResult[]>;

/**
 * Run one level.
 *
 * At concurrency 1 this is the loop the harness has always had: one
 * requirement, in this process, synchronously. Above 1 each requirement is
 * handed to a worker process running this same script with `--req`, because
 * every step inside `processRequirement` is a blocking `spawnSync` and there
 * is no way to interleave two of them in one process without rewriting all of
 * it.
 *
 * The worker is not a reduced version of the real thing: it *is* `harness run`
 * scoped to one requirement, so a parallel run and a serial run execute the
 * same code.
 */
export const dispatchLevel: LevelRunner = async (runnable, byId, hintByReq, ctx, concurrency) => {
  if (concurrency <= 1) {
    const results: RequirementResult[] = [];
    for (const id of runnable) {
      // Asked before each one, not once for the level. Independent
      // requirements all land in a single level — the common case — so a
      // ceiling checked only between levels never fires. Measured: a
      // `--budget-seconds 2` run of three 3-second agents ran all three.
      if (ctx.mayStart && !ctx.mayStart()) {
        results.push(notAttempted(byId.get(id), id, ctx.stopReason!(), ctx.stopCode?.()));
        continue;
      }
      // Every id in a level comes from the queue `byId` was built from.
      results.push(
        processRequirement(byId.get(id)!, {
          ...ctx,
          baseRef: ctx.baseFor ? ctx.baseFor(id) : ctx.baseRef,
          hint: hintByReq.get(id),
        })
      );
    }
    return results;
  }
  return runWorkers(runnable, byId, ctx, concurrency);
};

/**
 * Run the queue level by level.
 *
 * **Why concurrency 1 stays on the in-process path.** Every step of a
 * requirement — the gate, the agent, `done`, git — is a `spawnSync`, and
 * §12.11 of the closure plan is a list of eleven defects that only appeared
 * when this loop ran against a real agent. Converting all of it to async so
 * that one requirement could run "in parallel" with nothing would put the one
 * path that has actually been exercised behind an untested rewrite. So the
 * default path is the path it has always been, and only `--concurrency > 1`
 * dispatches through worker processes.
 *
 * **Why a failure blocks rather than fails.** Without dependencies expressed,
 * `harness run` processed the matrix in order and a broken predecessor made
 * every successor fail too — N failures for one cause, and N wasted agent
 * invocations. A requirement whose dependency failed has not been attempted;
 * calling that a failure would be a lie in the report.
 */
export async function runLevels(
  pending: HarnessRequirement[],
  ctx: RunContext,
  opts: { concurrency: number; hintByReq: Map<string, string>; runOne: LevelRunner }
): Promise<RequirementResult[]> {
  const { concurrency, hintByReq, runOne } = opts;
  /**
   * The run's ceiling (C1). Checked before starting a level, never inside one:
   * interrupting an attempt mid-flight would throw away the money already spent
   * on it and leave a worktree nobody asked for. A budget bounds what a run
   * *begins*.
   */
  const limits = {
    budgetSeconds: ctx.budgetSeconds || 0,
    maxRequirements: ctx.maxRequirements || 0,
    maxRunCostUsd: ctx.settings?.maxRunCostUsd || 0,
  };
  const budgetStartedAt = Date.now();
  let started = 0;
  // Asserted rather than annotated: it is assigned inside `mayStart`, and an
  // annotated `null` would stay narrowed to `null` everywhere below.
  let stoppedBy = null as BudgetVerdict | null;
  const schedule = scheduleLevels(pending);
  const { levels, cycles, graph } = schedule;
  // REQ → the requirements in this run it waits for. Core builds it as a plain
  // object and does not declare its shape.
  const dependsOn: Record<string, string[]> = schedule.dependsOn;
  const byId = new Map<string, HarnessRequirement>(pending.map((r) => [r.requirement, r]));

  if (cycles.length > 0) {
    // `validate` is the gate that reports the cycle properly. Here we only
    // have to refuse to loop forever, and say which requirements are stuck.
    for (const cycle of cycles) {
      warn(`Dependency cycle, not attempted: ${[...cycle, cycle[0]].join(" → ")}`);
    }
  }

  const results: RequirementResult[] = [];
  const blocked = new Set<string>();
  /** REQ → the branch its work landed on, for the requirements that follow it. */
  const passedBranches = new Map<string, string>();

  for (const level of levels) {
    const runnable = level.filter((id) => !blocked.has(id));

    for (const id of level) {
      if (!blocked.has(id)) continue;
      const req = byId.get(id);
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: ${(dependsOn[id] || []).filter((d) => blocked.has(d) || results.some((r) => r.requirement === d && r.result !== "pass")).join(", ")} did not pass.`
        )
      );
    }

    if (runnable.length === 0) continue;

    // A requirement is cut from its dependencies' branches, not from the run's
    // base: that is where the code it builds on exists during a run.
    const derivationFailures = new Map<string, string>();
    const baseFor = (id: string): string => {
      const derived = deriveBase(ctx.projectDir, id, dependsOn[id] || [], passedBranches, ctx);
      if ("error" in derived) {
        derivationFailures.set(id, derived.error);
        return ctx.baseRef;
      }
      return derived.base;
    };

    const bases = new Map(runnable.map((id) => [id, baseFor(id)]));
    const attemptable = runnable.filter((id) => !derivationFailures.has(id));

    for (const [id, reason] of derivationFailures) {
      const req = byId.get(id);
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: could not assemble its base. ${reason}`
        )
      );
      for (const dependent of graph.transitiveDependents(id)) blocked.add(dependent);
    }

    if (attemptable.length === 0) continue;

    if (stoppedBy) break;
    // The ceiling bites *inside* the level, through `mayStart` below —
    // independent requirements all land in one level, which is the common
    // case, so a check that only ran between levels would let a run of
    // fourteen sail past `--max-requirements 2`. Measured: it did exactly
    // that, and again with `--budget-seconds`.
    const levelResults = await runOne(
      attemptable,
      byId,
      hintByReq,
      {
        ...ctx,
        // Only `attemptable` ids reach the runner, and each has a base.
        baseFor: (id) => bases.get(id)!,
        // The level asks before starting each requirement. `started` counts
        // what was actually begun, so the count ceiling and the clock agree.
        mayStart: () => {
          if (stoppedBy) return false;
          // REQ-209: a stop asked while a requirement ran starts no other.
          if (started > 0 && takeStop(ctx.projectDir)) {
            stoppedBy = { stop: true, code: STOP_ASKED, reason: "a stop was asked" };
            return false;
          }
          const verdict = budgetVerdict(
            limits,
            { startedAt: budgetStartedAt, started, spentUsd: runSpentUsdSoFar() },
            Date.now()
          );
          if (verdict.stop) {
            stoppedBy = verdict;
            return false;
          }
          started += 1;
          return true;
        },
        stopReason: () => (stoppedBy ? stoppedBy.reason : ""),
        stopCode: () => (stoppedBy && stoppedBy.code) || "",
      },
      concurrency
    );
    results.push(...levelResults);

    for (const r of levelResults) {
      if (r.result === "pass") passedBranches.set(r.requirement, r.branch);
    }

    for (const r of levelResults) {
      if (r.result !== "pass") {
        for (const dependent of graph.transitiveDependents(r.requirement)) {
          blocked.add(dependent);
        }
      }
    }
  }

  // Once the budget is spent, later levels are not even walked: their
  // requirements are named as not attempted, with the same reason.
  if (stoppedBy) {
    for (const level of levels) {
      for (const id of level) {
        if (results.some((r) => r.requirement === id)) continue;
        results.push(notAttempted(byId.get(id), id, stoppedBy.reason, stoppedBy.code || ""));
      }
    }
  }

  // Requirements caught in a cycle never reach a level. Report them rather
  // than dropping them from the run.
  for (const cycle of cycles) {
    for (const id of cycle) {
      if (results.some((r) => r.requirement === id)) continue;
      const req = byId.get(id);
      results.push(
        unattempted(
          id,
          req ? req.category : "",
          "blocked",
          `harness/${id}`,
          `Not attempted: caught in a dependency cycle (${cycle.join(" → ")}). Run \`specgate validate\` for the fix.`
        )
      );
    }
  }

  return results;
}

/**
 * The requirements a run takes: one row each (the plan has one per scenario,
 * and two rows cost two agent sessions), none already done, and never the
 * adoption baseline unless it is named — an agent cannot build "existing
 * behaviour is preserved"; a test that names REQ-001 closes it (REQ-478).
 */
export function harnessQueue<
  T extends { requirement: string; category?: string; featureFile?: string; feature_file?: string },
>(rows: T[], reqs: readonly string[]): T[] {
  const wanted = new Set(reqs);
  const firstRow = new Set<string>();
  return rows.filter((r) => {
    if (r.category === "DONE" || firstRow.has(r.requirement)) return false;
    if (wanted.size > 0 && !wanted.has(r.requirement)) return false;
    const baseline = String(r.featureFile ?? r.feature_file ?? "").includes(
      "features/adoption/baseline"
    );
    if (baseline && !wanted.has(r.requirement)) return false;
    firstRow.add(r.requirement);
    return true;
  });
}
