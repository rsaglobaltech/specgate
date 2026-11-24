/**
 * A requirement's scenarios run through the project's `bdd_cmd`
 * (gate-runs-scenarios REQ-733, REQ-734): by the requirement's own tag, as
 * `apply` runs them, and — only when that fails — one scenario at a time, to
 * say which. Whoever gates a requirement runs them here: the harness gate and
 * `specgate check`, besides `apply`.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { readHarnessConfig } from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { readGatePolicy } from "./gate-policy";
import { forShell } from "./shell-command";
import { scenariosOf } from "../cli/commands/spec/ScenariosCommand";

/** The project's gate requires executable scenarios (REQ-661). */
export const scenariosRequired = (projectDir: string): boolean => readGatePolicy(projectDir).bdd === "required";

/** The command that runs the feature files, or "" when the project has none. */
export const scenarioCommand = (projectDir: string): string => (readHarnessConfig(projectDir)?.bddCmd || "").trim();

export interface ScenarioVerdict {
  ok: boolean;
  /** The command that ran for the requirement's tag. */
  command: string;
  ms: number;
  /** What the runner printed, its last lines. */
  output: string;
  /** The scenarios that did not end well; empty when the run by the requirement's tag passed, or when none could be told apart. */
  failed: string[];
}

const withTag = (bddCmd: string, tag: string) => (bddCmd.includes("{tags}") ? bddCmd.split("{tags}").join(tag) : `${bddCmd} ${tag}`);

export function runRequirementScenarios(projectDir: string, requirement: string, bddCmd = scenarioCommand(projectDir)): ScenarioVerdict {
  const command = withTag(bddCmd, `@${requirement}`);
  const started = Date.now();
  const run = spawnSync(forShell(command), { cwd: projectDir, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout || ""}${run.stderr || ""}`.trim().split("\n").slice(-40).join("\n");
  if (run.status === 0) return { ok: true, command, ms: Date.now() - started, output, failed: [] };
  const failed: string[] = [];
  for (const s of scenariosOf(projectDir, requirement)) {
    const one = spawnSync(forShell(withTag(bddCmd, `@${s.id}`)), { cwd: projectDir, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
    if (one.status !== 0) failed.push(s.id);
  }
  return { ok: false, command, ms: Date.now() - started, output, failed };
}

/**
 * The requirements that have a scenario in a feature file, read in one pass
 * over `features/` — `status` asks this for every delivered requirement, and a
 * walk per requirement made it grow with the square of the project (REQ-517).
 */
export function requirementsWithScenarios(projectDir: string): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".feature")) {
        const text = fs.readFileSync(full, "utf8");
        if (!/@SCN-[\w-]+/.test(text)) continue;
        for (const m of text.matchAll(/@(REQ-\d+)\b/g)) out.add(m[1]!);
      }
    }
  };
  walk(path.join(projectDir, "features"));
  return out;
}
