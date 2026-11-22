/**
 * What a run says when it ends: the report on the terminal, the same as a
 * document for `--format json`, and whether the run was stopped.
 */

import * as ui from "../../lib/ui";
import { RequirementResult, STOP_ASKED } from "./shared";
import { streamEvent } from "../../lib/harness-stream";
import { RunState } from "./state";
/**
 * How much of a failing gate's output the text report shows.
 *
 * Runners put the useful part at the end, so the tail is what a human needs.
 * Twenty lines is enough for a failing assertion with its stack, and short
 * enough that ten failed requirements do not bury the summary.
 */
export const FAILURE_TAIL_LINES = 20;

/** Why a run started no more requirements (REQ-491): a stop asked, or its budget. */
export interface RunStopped {
  by: "request" | "budget";
  code: string;
  reason: string;
  notAttempted: string[];
}

/** What `--allow-dirty` left out (REQ-490). */
export interface RunDirty {
  allowed: boolean;
  leftOut: string[];
}

/** The requirements a stop or a budget kept from starting, and why; `null` when none. */
export function runStopped(results: RequirementResult[]): RunStopped | null {
  const halted = results.filter((r) => r.stoppedBy);
  if (halted.length === 0) return null;
  const code = String(halted[0].stoppedBy);
  return {
    by: code === STOP_ASKED ? "request" : "budget",
    code,
    reason: String(halted[0].error || "").replace(/^Not attempted: /, ""),
    notAttempted: halted.map((r) => r.requirement),
  };
}

/** The document `--format json` prints, and the stream's `run-end` carries. */
export function reportDocument(
  results: RequirementResult[],
  extra: { dirty?: RunDirty; stopped?: RunStopped | null } = {}
) {
  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.result] = (acc[r.result] || 0) + 1;
    return acc;
  }, {});
  return {
    schemaVersion: 1,
    total: results.length,
    summary,
    results,
    dirty: extra.dirty || { allowed: false, leftOut: [] },
    stopped: extra.stopped === undefined ? runStopped(results) : extra.stopped,
  };
}

export function printReport(
  results: RequirementResult[],
  format: string,
  recorded?: string,
  extra: { dirty?: RunDirty } = {},
  run: RunState = new RunState()
): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(reportDocument(results, extra), null, 2) + "\n");
    return;
  }
  if (format === "jsonl") {
    for (const r of results) run.streamResult(r);
    streamEvent({ type: "run-end", report: reportDocument(results, extra), status: [] });
    return;
  }

  const MARK = {
    pass: `${ui.c.ok}${ui.sym.ok}${ui.c.reset}`,
    fail: `${ui.c.bad}${ui.sym.fail}${ui.c.reset}`,
    blocked: `${ui.c.warn}${ui.sym.warn}${ui.c.reset}`,
    skipped: `${ui.c.muted}${ui.sym.empty}${ui.c.reset}`,
    question: `${ui.c.warn}?${ui.c.reset}`,
    unverified: `${ui.c.warn}${ui.sym.warn}${ui.c.reset}`,
  };
  const COLOR = {
    pass: ui.c.ok,
    fail: ui.c.bad,
    blocked: ui.c.warn,
    skipped: ui.c.muted,
    question: ui.c.warn,
    unverified: ui.c.warn,
  };
  const idWidth = Math.max(9, ...results.map((r) => String(r.requirement).length));
  process.stdout.write("\n" + ui.section("Harness report"));
  for (const r of results) {
    process.stdout.write(
      `  ${MARK[r.result] || MARK.fail}  ${ui.c.bold}${ui.pad(String(r.requirement), idWidth)}${ui.c.reset} ` +
        `${COLOR[r.result] || ""}${ui.pad(r.result, 10)}${ui.c.reset}` +
        ui.muted(`${r.attempts} attempt${r.attempts === 1 ? "" : "s"}`) +
        `   ${ui.c.accent}${ui.sym.arrow} ${r.branch}${ui.c.reset}\n`
    );
    const sub = (t: string | undefined) => process.stdout.write(`       ${t}\n`);
    if (r.result === "blocked") {
      // Nothing ran, so there is no gate output to show — only the reason.
      sub(r.error);
      continue;
    }
    if (r.result !== "pass" && r.error) {
      // The full gate output — the test failure that explains *why* — was
      // captured and then thrown away here, leaving "Gate failed at: test
      // command" and nothing to act on. With the worktree removed by default,
      // that made a failed run undiagnosable. Show the tail, where runners put
      // the actual failure, and name the two flags that give more.
      const lines = String(r.error).split("\n");
      const head = lines[0];
      const tail = lines
        .slice(1)
        .filter((l) => l.trim() !== "")
        .slice(-FAILURE_TAIL_LINES);
      sub(head);
      for (const line of tail) sub(`${ui.muted(ui.sym.pipe)} ${line}`);
      if (tail.length > 0) {
        sub(ui.muted(`${ui.sym.corner} full output: --format json · reproduce: --keep-worktrees`));
      }
      if (r.result === "unverified") {
        sub(`${ui.c.warn}no test ran:${ui.c.reset} set the project's test command, then build it again`);
      }
      if (r.workPreserved) {
        sub(ui.muted(`↳ the attempt is committed on ${r.branch} — review it`));
      } else if (r.result === "fail") {
        sub(ui.muted("↳ the agent produced no files"));
      }
    }
    if (r.pushed) {
      sub(
        ui.muted(
          `pushed${r.prCreated ? ` · PR created${r.prOutput ? `: ${r.prOutput}` : ""}` : ""}`
        )
      );
    }
    if (r.publishError) {
      sub(`${ui.c.warn}publish issue:${ui.c.reset} ${String(r.publishError).split("\n")[0]}`);
    }
  }
  const pass = results.filter((r) => r.result === "pass").length;
  const fail = results.filter((r) => r.result === "fail").length;
  const skip = results.filter((r) => r.result === "skipped").length;
  const blocked = results.filter((r) => r.result === "blocked").length;
  // Blocked is counted apart from failed on purpose: one broken predecessor
  // used to produce N failures and N wasted agent invocations, which said
  // nothing about the N-1 requirements that were never attempted.
  const blockedNote = blocked > 0 ? ` · ${blocked} blocked` : "";
  // REQ-649: built but proved by no test — counted apart, never as passed.
  const unverified = results.filter((r) => r.result === "unverified").length;
  const unverifiedNote = unverified > 0 ? ` · ${unverified} unverified` : "";
  process.stdout.write(
    `\n  ${ui.progress(pass, results.length, "passed")}` +
      ui.muted(
        `   ${pass} passed · ${fail} failed · ${skip} skipped${blockedNote}${unverifiedNote}`
      ) +
      "\n"
  );
  if (recorded) {
    process.stdout.write(
      `  ${ui.muted(`Run recorded in ${recorded} — specgate harness report sums them up`)}\n`
    );
  }
  if (pass > 0) {
    // `pass > 0`, so there is one.
    const first = results.find((r) => r.result === "pass")!;
    process.stdout.write(
      ui.next(
        `git diff HEAD...${first.branch}`,
        "review and merge the harness/* branches you trust"
      )
    );
  } else {
    process.stdout.write("\n");
  }
}
