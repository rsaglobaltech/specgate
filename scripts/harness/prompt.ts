/**
 * Builds the structured prompt handed to a coding agent for one requirement.
 */

import { featureMap } from "../lib/feature-map";
import type { MapEntry } from "../lib/feature-map";
import * as fs from "node:fs";
import { STAGES } from "../change/instructions";
import { DiskHarnessConfigRepository } from "../../packages/core/src/infrastructure/DiskHarnessConfigRepository";
import { GenerateAgentPromptUseCase } from "../../packages/core/src/application/GenerateAgentPromptUseCase";
import {
  PromptOptions as CorePromptOptions,
  PromptRequirement,
} from "../../packages/core/src/domain/AgentPrompt";
import { packagesFor, rolePromptSection } from "../lib/role-packages";
import { operationsSection } from "../lib/contracts";
import { workspaceMemberDirs } from "../lib/story-part";
import { testCommandParts } from "../lib/agent-permission";

export type PromptOptions = CorePromptOptions;

/**
 * The apply stage's rules, as an agent inside the harness must read them. The
 * interactive loop has the agent run `specgate status` and `specgate apply`;
 * here the harness runs the gate and marks the requirement itself, and an
 * agent told to run them ran whatever `specgate` was on its PATH — an old
 * global install with no `apply` — and spent the attempt on it.
 */
const HARNESS_RULES: string[] = [
  ...(STAGES?.apply?.rules ?? []).filter(
    (r) => !/is the queue|Close each requirement with `specgate apply/.test(r)
  ),
  "Do not run `specgate` yourself: when you finish, the harness runs the gate and marks the " +
    "requirement. The `specgate` on your PATH may not even be this project's version.",
  // REQ-189: the one command an agent runs — asking beats guessing.
  // REQ-234: the gate checks commit messages against Conventional Commits 1.0.0.
  "Do not commit: the harness commits your work as `feat(<REQ>): …`. If you must commit, " +
    "write Conventional Commits 1.0.0 with the requirement as scope — `feat(REQ-007): …`, " +
    "`test(REQ-007): …`, `fix(REQ-007): …` — or the gate refuses the attempt.",
  'The one exception: when the requirement leaves a decision open that its statement, scenarios and assumptions do not settle, do not guess. Run `specgate ask <REQ> "<your question>"` and stop: the harness ends the attempt without spending another and asks the person.',
];

export function buildPrompt(
  req: Record<string, unknown>,
  projectDir: string,
  opts: PromptOptions & { testCmd?: string } = {}
): string {
  const repo = new DiskHarnessConfigRepository();
  const useCase = new GenerateAgentPromptUseCase(repo);

  const { testCmd, ...promptOpts } = opts;
  const prompt = useCase.execute(req as PromptRequirement, projectDir, {
    ...promptOpts,
    stageRules: testCmd ? [...HARNESS_RULES, testRule(testCmd)] : HARNESS_RULES,
  });
  // REQ-316: what each role asks of this requirement, written once by that role.
  const roles = rolePromptSection(packagesFor(projectDir, String(req.requirement || "")));
  const withRoles = roles ? `${prompt.replace(/\n*$/, "\n")}\n${roles}` : prompt;
  // REQ-407: each operation it cites, as the contract writes it.
  const ops = operationsSection(
    projectDir,
    String(req.requirement || ""),
    workspaceMemberDirs(projectDir)
  );
  const withOps = ops ? `${withRoles.replace(/\n*$/, "\n")}\n${ops}` : withRoles;
  // REQ-679: where the requirement lives in the app, and how to open it.
  const where = whereSection(projectDir, String(req.requirement || ""));
  const withWhere = where ? `${withOps.replace(/\n*$/, "\n")}\n${where}` : withOps;
  // REQ-344: a story's other parts, handed over by `workspace harness run`.
  const story = storyContext();
  return story ? `${withWhere.replace(/\n*$/, "\n")}\n${story}` : withWhere;
}

/** REQ-614: the command the agent runs its tests with — the gate's own. */
function testRule(testCmd: string): string {
  const parts = testCommandParts(testCmd);
  if (parts.length === 0) return `The gate runs \`${testCmd}\` when you finish.`;
  const runs = parts.map((part) => `\`${part}\``).join(", then ");
  return (
    `Run the tests with ${runs}, written exactly so: the gate runs the same, and your ` +
    "permissions may refuse any other command that runs something. See the new test fail " +
    "before you write the code that makes it pass."
  );
}

/** The workspace story this run builds a part of, when `workspace harness run` names one. */
function storyContext(): string {
  const file = process.env.SPECGATE_STORY_CONTEXT;
  if (!file) return "";
  try {
    return fs.readFileSync(file, "utf8").trim() + "\n";
  } catch {
    return "";
  }
}

/** REQ-679: the requirement's place in the app, from the map, when the map knows it. */
function whereSection(projectDir: string, id: string): string {
  if (!id) return "";
  let entry: MapEntry | undefined;
  try {
    entry = featureMap(projectDir).find((e) => e.requirement === id);
  } catch {
    return "";
  }
  if (!entry || (!entry.route && entry.e2e.length === 0)) return "";
  const lines = [
    "## Where it lives in the app",
    "",
    ...(entry.route ? [`- Route: \`${entry.route}\``] : []),
    ...(entry.url ? [`- Address: ${entry.url}`] : []),
    ...(entry.e2e.length
      ? [`- End-to-end tests that reach it: ${entry.e2e.map((t) => `\`${t}\``).join(", ")}`]
      : []),
  ];
  if (entry.url) {
    lines.push(
      "",
      `Open ${entry.url} with your browser tool (for example the Playwright MCP) before you change anything, and again after: check that the app does what the scenarios describe, as a person using it would. \`specgate map --json\` gives the place of every other requirement.`
    );
  }
  return lines.join("\n") + "\n";
}
