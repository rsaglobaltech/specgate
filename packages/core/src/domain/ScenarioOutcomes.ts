/**
 * Why each scenario was red, read from the runner's own output (REQ-815):
 * Playwright's list reporter, kept as `before/run.log` and `bdd.log`. Each
 * `✓`/`✘` line is a scenario with its time; each numbered failure under them
 * names the step that failed and what it expected against what came.
 */

export interface ScenarioOutcome {
  /** The scenario's title, without its tags. */
  readonly scenario: string;
  readonly passed: boolean;
  /** As the runner wrote it: `18.7s`, `1.0m`; empty when it wrote none. */
  readonly time: string;
  /** The step that failed, as the runner names it; empty when it passed. */
  readonly step: string;
  /** The failure's `Error:`, `Expected:` and `Received:` lines, in order. */
  readonly reason: ReadonlyArray<string>;
}

// The runner's colours: matching the escape character is the point.
// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
const RESULT =
  /^\s*(✓|✘|ok|x|×)\s+\d+\s+(?:\[[^\]]*\]\s+›\s+)?(.*?)\s*(?:\((\d+(?:\.\d+)?(?:ms|s|m))\))?\s*$/;
const FAILURE = /^\s*\d+\)\s+(?:\[[^\]]*\]\s+›\s+)?(.*)$/;
const REASON =
  /^\s*(Error:|Expected:|Received:|Expected pattern:|Received string:|Locator:|Test timeout)/;

/** `file.spec.js:6:3 › Feature › Scenario @tag @tag › Then step` → its parts. */
function titleParts(text: string): { scenario: string; step: string } {
  const parts = text.split(" › ").map((p) => p.trim());
  // The scenario is the last part that carries tags or, without tags, the last but the step.
  let at = parts.findIndex((p) => /\s@\S+/.test(p));
  if (at < 0) at = parts.length - 1;
  const scenario = parts[at].replace(/\s+@\S+/g, "").trim();
  const step = parts
    .slice(at + 1)
    .join(" › ")
    .trim();
  return { scenario, step };
}

export function scenarioOutcomes(log: string): ScenarioOutcome[] {
  const lines = strip(log).split(/\r?\n/);
  const out: Array<{
    scenario: string;
    passed: boolean;
    time: string;
    step: string;
    reason: string[];
  }> = [];
  for (const line of lines) {
    const m = RESULT.exec(line);
    if (!m || !m[2].includes(" › ")) continue;
    const { scenario } = titleParts(m[2]);
    out.push({
      scenario,
      passed: m[1] === "✓" || m[1] === "ok",
      time: m[3] || "",
      step: "",
      reason: [],
    });
  }
  for (let i = 0; i < lines.length; i += 1) {
    const f = FAILURE.exec(lines[i]);
    if (!f || !f[1].includes(" › ")) continue;
    const { scenario, step } = titleParts(f[1]);
    const row = out.find((r) => r.scenario === scenario && !r.passed);
    if (!row || row.reason.length) continue;
    row.step = step;
    for (let j = i + 1; j < lines.length && !FAILURE.test(lines[j]); j += 1) {
      const t = lines[j].trim();
      if (REASON.test(t) && !row.reason.includes(t)) row.reason.push(t);
      if (/^at\s|^\d+\s*\|/.test(t) && row.reason.length) break;
    }
  }
  return out;
}
