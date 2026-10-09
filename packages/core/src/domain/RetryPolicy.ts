/**
 * Whether another harness attempt can change the outcome.
 *
 * The harness retries a failed requirement, feeding the failure back to the
 * agent. That is only worth paying for when the agent can act on it. Two
 * failures in the reservas_app pilot could not be acted on, and each cost three
 * attempts (defect #50):
 *
 * - the gate failed on a scenario title in a `.feature` file — a file the agent
 *   is forbidden to edit, so every retry met the same gate;
 * - the agent exited with "You've hit your session limit", and the harness
 *   retried it three times in 22 seconds.
 *
 * Both now stop the requirement at once, with a message that names who has to
 * act: a person fixing the specification, or the quota resetting.
 */

/** Messages an agent CLI prints when it cannot run at all for now. */
const UNAVAILABLE =
  /(session limit|usage limit|rate[- ]limit(ed)?|quota (exceeded|exhausted)|insufficient_quota|credit balance is too low|too many requests|\b429\b|overloaded_error)/i;

/** The line, if any, saying the agent is out of quota or rate-limited. */
export function agentUnavailable(output: string): string | null {
  const line = output.split(/\r?\n/).find((l) => UNAVAILABLE.test(l));
  return line ? line.trim() : null;
}

/** `  ✖  features/x.feature:4 …` / `  ▲  features/x.feature:17 …` — a finding with a location. */
const LOCATED = /^\s*[✖▲⚠]\s+(\S+?\.[A-Za-z]+)(?::\d+)?\s/;

/**
 * The specification files a failed gate blames, when it blames nothing else.
 *
 * Returns the files when every located finding is in a path the agent may not
 * edit (`isProtected`), and at least one finding is located. Any finding in
 * code, or none located at all, returns null: the agent may still fix it.
 */
export function specSideFailure(
  gateOutput: string,
  isProtected: (file: string) => boolean
): string[] | null {
  const files: string[] = [];
  for (const line of gateOutput.split(/\r?\n/)) {
    const m = LOCATED.exec(line);
    if (!m) continue;
    // "Nothing proves <scenario>" points at the feature file, but its fix is a
    // test — the agent's job. Read as a specification failure, it stopped the
    // harness after one attempt (#63).
    if (/scenario_not_covered|Nothing proves/.test(line)) return null;
    if (!isProtected(m[1])) return null;
    if (!files.includes(m[1])) files.push(m[1]);
  }
  return files.length > 0 ? files : null;
}
