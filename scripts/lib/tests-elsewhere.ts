/**
 * recover-guidance: when a gate is red because of another requirement's test.
 *
 * Agents told to keep to their requirement and to the approved design stopped
 * at a red suite whose failing test belonged to a requirement delivered
 * before (the exam's `recover`, 4 of 6 runs on 2026-11-25), and said fixing it
 * was out of scope. It is not: the design's scope judges new files only, and a
 * delivered requirement's test that is red is a regression to repair — in the
 * code, never in the test.
 */

/** A line of a test runner's output that reports a failure: node:test, TAP, Jest/Vitest, JUnit/Maven, pytest. */
const FAILED = /(✖|✗|×|\bnot ok\b|\bFAIL(?:ED)?\b|\bfailed\b|\bERROR\b|<<< FAILURE)/;

/** The requirements the failing tests name, other than the ones being delivered; empty when a failing test names one of them, or none. */
export function failingElsewhere(output: string, delivering: readonly string[]): string[] {
  const named = new Set<string>();
  for (const line of String(output || "").split("\n")) {
    if (!FAILED.test(line)) continue;
    for (const m of line.matchAll(/\bREQ-\d+\b/g)) named.add(m[0]);
  }
  if (named.size === 0 || delivering.some((id) => named.has(id))) return [];
  return [...named].sort();
}

/** What a refusal says when only another requirement's test is red. */
export function elsewhereFix(others: readonly string[], delivering: readonly string[], again: string): { message: string; fix: string } {
  const them = others.join(", ");
  const mine = delivering.join(", ");
  return {
    message: `the project's tests failed — and the failing tests name ${them}, not ${mine}: a requirement delivered before is red`,
    fix: `Repair ${them}'s code so its test passes again — never its test. That is not leaving ${mine}'s scope: the design's scope judges new files only, and a red suite blocks every delivery. Then run ${again}`,
  };
}
