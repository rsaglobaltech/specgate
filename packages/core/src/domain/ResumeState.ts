/**
 * Picking a run back up where it stopped (C3).
 *
 * ## What actually survives an interruption
 *
 * Before designing this, a run was killed mid-attempt with `kill -9` and the
 * remains inspected. What is left:
 *
 * ```
 * branch harness/REQ-000        exists, sitting at base — no commits
 * worktree                      still registered, holding the agent's
 *                               uncommitted partial work
 * .harness/runs/                empty
 * .specops/harness-prompts/     REQ-000-…-attempt-1-agent.md
 * ```
 *
 * The run ledger is **not** a usable source. It is written when a run finishes,
 * and C3 exists precisely for the runs that do not: a crash, a Ctrl-C, a spend
 * limit. Reaching for it would have produced a `--resume` that works in every
 * case except the one it was built for.
 *
 * The prompt archive is the thing that survives, and it happens to record the
 * attempt number in its filename. It was added for reviewability, not for this
 * — which is why it is worth writing down that it is now load-bearing for
 * resume, so nobody 'tidies' the naming later.
 *
 * The archive is readable in both endings, through the same path:
 *
 * - **interrupted** — the files sit uncommitted in the surviving worktree;
 * - **attempts exhausted** — `preserveFailedAttempt` runs `git add -A`, so the
 *   archive is committed on the branch and a fresh worktree checks it out.
 *
 * ## Why resume re-runs the interrupted attempt rather than skipping it
 *
 * An attempt that was killed never reached a verdict: the gate never ran, so
 * nothing was learned and nothing was proved. Charging it against
 * `max_attempts` would spend budget for no information. The partial work is
 * still in the worktree, so the agent continues from it rather than from
 * nothing.
 *
 * A *completed* attempt is different — it produced a gate verdict, and its
 * successor is the one to run next.
 */

/** One archived prompt, as its filename describes it. */
export interface ArchivedPrompt {
  readonly requirement: string;
  readonly attempt: number;
  readonly role: string;
  /** The timestamp exactly as the filename spells it, which sorts correctly. */
  readonly stamp: string;
  readonly fileName: string;
}

/**
 * `REQ-000-2026-08-22T12-11-14-133Z-attempt-1-agent.md`, taken apart.
 *
 * Returns `null` for anything that is not one of ours, because a person may
 * well have dropped a note in that directory.
 */
export function parseArchivedPromptName(fileName: string): ArchivedPrompt | null {
  // Taken apart by hand: `^(REQ-\d+)-(.+)-attempt-(\d+)-([^.]+)\.md$` ran
  // polynomially on names with many "-attempt-" (CodeQL js/polynomial-redos).
  // Same result — the stamp runs to the last "-attempt-", as `.+` did.
  if (!fileName.endsWith(".md")) return null;
  const base = fileName.slice(0, -3);
  const req = /^REQ-\d+-/.exec(base);
  if (!req) return null;
  const rest = base.slice(req[0].length);
  const at = rest.lastIndexOf("-attempt-");
  if (at < 1) return null;
  const stamp = rest.slice(0, at);
  const tail = rest.slice(at + "-attempt-".length);
  const dash = tail.indexOf("-");
  if (dash < 1) return null;
  const digits = tail.slice(0, dash);
  const role = tail.slice(dash + 1);
  if (!/^\d+$/.test(digits) || role === "" || role.includes(".")) return null;
  const attempt = Number(digits);
  if (!Number.isInteger(attempt) || attempt < 1) return null;
  return { requirement: req[0].slice(0, -1), stamp, attempt, role, fileName };
}

export interface ResumePoint {
  /** The attempt number to run next. 1 when there is nothing to resume from. */
  readonly attempt: number;
  /** The newest archived prompt for the requirement, or `null`. */
  readonly latest: ArchivedPrompt | null;
}

/**
 * Where to pick up, given the archive filenames and how the last attempt ended.
 *
 * `lastAttemptCompleted` is the caller's knowledge, not ours: a harness that
 * knows the last attempt reached a gate verdict passes `true` and gets the
 * next attempt; an interrupted run passes `false` and re-runs the one that was
 * cut short. See the module note on why that distinction is not cosmetic.
 */
export function resumePoint(
  fileNames: readonly string[],
  requirement: string,
  lastAttemptCompleted = false
): ResumePoint {
  const mine = fileNames
    .map(parseArchivedPromptName)
    .filter((p): p is ArchivedPrompt => p !== null && p.requirement === requirement);

  if (mine.length === 0) return { attempt: 1, latest: null };

  const highest = mine.reduce((a, b) => (b.attempt > a.attempt ? b : a));
  // Among the files for that attempt, the newest one — an attempt may archive a
  // reviewer prompt and then the implementing one.
  const latest = mine
    .filter((p) => p.attempt === highest.attempt)
    .reduce((a, b) => (b.stamp > a.stamp ? b : a));

  return { attempt: lastAttemptCompleted ? highest.attempt + 1 : highest.attempt, latest };
}

/**
 * The failure text an archived prompt carries from the attempt before it.
 *
 * `AgentPrompt` writes it under a `Previous attempt failed` heading inside a
 * fenced block, so a resumed run can recover what the gate said without any
 * record of its own. Returns `""` when the prompt has no such section — which
 * is the normal case for attempt 1.
 */
export function previousFailureFromPrompt(promptText: string): string {
  // `[ \t]*` rather than `\s*`: `\s` matches a newline, so with `#+` in front
  // the engine can backtrack across lines on a long prompt. A heading's
  // whitespace is spaces and tabs.
  const heading = /^#{1,6}[ \t]*Previous attempt failed[^\n]*$/m.exec(promptText || "");
  if (!heading) return "";
  const after = promptText.slice(heading.index + heading[0].length);
  // Located with `indexOf`, not a lazy `[\s\S]*?` between two fences: the class
  // matches the newline the pattern then requires, so the engine can split the
  // text between them in every possible way (js/polynomial-redos). Two index
  // lookups say the same thing and cannot backtrack at all.
  const open = after.indexOf("```\n");
  if (open === -1) return "";
  const bodyStart = open + 4;
  const close = after.indexOf("\n```", bodyStart);
  if (close === -1) return "";
  return after.slice(bodyStart, close).trim();
}
