/**
 * Which coding agents does this project already use? (simplification plan,
 * phase 2: the agent is the interface)
 *
 * `init` and `adopt` install the `/specgate:*` commands for the agents they
 * find, so the developer talks to the agent they already have from the first
 * minute — without `agents init` to discover, and without files for ten
 * agents nobody on the team uses.
 *
 * A marker is a file or directory that agent creates or reads. `AGENTS.md`
 * alone is not one: several agents read it and it says nothing about which.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { TOOLS, writeAgentFiles } from "./init";

const MARKERS: ReadonlyArray<[string, string[]]> = [
  ["claude", [".claude", "CLAUDE.md"]],
  ["cursor", [".cursor", ".cursorrules"]],
  ["copilot", [path.join(".github", "copilot-instructions.md")]],
  ["windsurf", [".windsurf", ".windsurfrules"]],
  ["aider", [".aider.conf.yml"]],
  ["gemini", [".gemini", "GEMINI.md"]],
  ["cline", [".clinerules"]],
  ["codex", [".codex"]],
  ["antigravity", [".agents"]],
];

export function detectAgents(projectDir: string): string[] {
  return MARKERS.filter(
    ([tool, files]) => TOOLS[tool] && files.some((f) => fs.existsSync(path.join(projectDir, f)))
  ).map(([tool]) => tool);
}

/**
 * The last step of `init` and `adopt`: install for the detected agents, or say
 * how to. Never overwrites a file, never fails the command it ends.
 */
export function installDetectedAgents(
  projectDir: string,
  opts: { dryRun?: boolean; skip?: boolean },
  log: (msg: string) => void
): void {
  if (opts.skip) return;
  let tools: string[] = [];
  try {
    tools = detectAgents(projectDir);
  } catch {
    return;
  }
  if (tools.length === 0) {
    log("Agent: none detected. To drive the daily loop from your agent:");
    log("  specgate agents init --tool claude   # or cursor, copilot, gemini, … (--help)");
    return;
  }
  try {
    const { written, skipped } = writeAgentFiles(projectDir, tools, { dryRun: opts.dryRun });
    const labels = tools.map((t) => TOOLS[t].label).join(", ");
    log(
      `Agent: ${labels} — ${opts.dryRun ? "would install" : "installed"} the /specgate:* commands` +
        ` (${written.length} file(s)${skipped.length ? `, ${skipped.length} already there, left alone` : ""}).`
    );
    log("  Ask your agent: /specgate:explore   # what is left, and what to do next");
  } catch (err: any) {
    log(
      `Agent: could not install the commands (${err && err.message}); run \`specgate agents init\`.`
    );
  }
}
