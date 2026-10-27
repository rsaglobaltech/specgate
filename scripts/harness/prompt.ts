/**
 * Builds the structured prompt handed to a coding agent for one requirement.
 */

import { STAGES } from "../change/instructions";
import { DiskHarnessConfigRepository } from "../../packages/core/src/infrastructure/DiskHarnessConfigRepository";
import { GenerateAgentPromptUseCase } from "../../packages/core/src/application/GenerateAgentPromptUseCase";
import {
  PromptOptions as CorePromptOptions,
  PromptRequirement,
} from "../../packages/core/src/domain/AgentPrompt";

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
  'The one exception: when the requirement leaves a decision open that its statement, scenarios and assumptions do not settle, do not guess. Run `specgate ask <REQ> "<your question>"` and stop: the harness ends the attempt without spending another and asks the person.',
];

export function buildPrompt(
  req: Record<string, unknown>,
  projectDir: string,
  opts: PromptOptions = {}
): string {
  const repo = new DiskHarnessConfigRepository();
  const useCase = new GenerateAgentPromptUseCase(repo);

  return useCase.execute(req as PromptRequirement, projectDir, {
    ...opts,
    stageRules: HARNESS_RULES,
  });
}
