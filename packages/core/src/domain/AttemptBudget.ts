/**
 * What one requirement's agent sessions may cost (REQ-535) and how many
 * tokens they may use (REQ-585).
 *
 * A retry is more sessions, so the ceiling is the requirement's, not the
 * attempt's: it is asked before each attempt and before each session, and a
 * session is not started once either limit is reached. A limit of zero is no
 * limit. A session that reports no cost adds nothing to what was spent — the
 * caller says so once, or refuses it when the project requires a known cost.
 */

import type { StepUsage } from "./HarnessRun";

export interface AttemptLimits {
  /** USD across the requirement's sessions; 0 or absent is no ceiling. */
  maxCostUsd?: number;
  /** Tokens across the requirement's sessions; 0 or absent is no ceiling. */
  maxTokens?: number;
}

export class AttemptBudget {
  private readonly maxCost: number;
  private readonly maxTokens: number;
  private spent = 0;
  private tokens = 0;

  constructor(
    private readonly requirement: string,
    limits: AttemptLimits
  ) {
    this.maxCost = limits.maxCostUsd || 0;
    this.maxTokens = limits.maxTokens || 0;
  }

  /** Is there a ceiling on cost at all? */
  get limitsCost(): boolean {
    return this.maxCost > 0;
  }

  /** Count one session: its tokens always, its cost when it said one. */
  add(used: StepUsage | null): void {
    if (!used) return;
    this.tokens += used.input + used.output + used.cacheRead + used.cacheWrite;
    if (typeof used.cost === "number") this.spent += used.cost;
  }

  /** Has either limit been reached? */
  over(): boolean {
    return (
      (this.maxCost > 0 && this.spent >= this.maxCost) ||
      (this.maxTokens > 0 && this.tokens >= this.maxTokens)
    );
  }

  /** Which limit was reached, as the next prompt and the report say it. */
  message(): string {
    return this.maxTokens > 0 && this.tokens >= this.maxTokens
      ? `budget_exceeded — ${this.requirement} used ${this.tokens} of its ${this.maxTokens} tokens ` +
          "(max_tokens), so no further session ran."
      : `budget_exceeded — ${this.requirement} spent $${this.spent.toFixed(2)} of its $${this.maxCost} ` +
          "budget (max_cost_usd), so no further session ran.";
  }
}

/** Did this session say what it cost? */
export function costKnown(used: StepUsage | null): boolean {
  return Boolean(used && typeof used.cost === "number");
}
