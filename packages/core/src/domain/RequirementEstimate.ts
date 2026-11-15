/**
 * What a pending requirement will take, before it starts (REQ-493).
 *
 * The harness measures wall-clock and, through the profiles' declared hints,
 * an estimated price — never tokens, which only the agent sees. An estimate is
 * built from those same records, and it is only worth showing when it says
 * what it rests on: a number without its basis invites more belief than it
 * has earned. So every number carries one, from the strongest to the weakest:
 *
 * - `history` — this requirement's own recorded runs, averaged;
 * - `size` — what delivered requirements took per scenario step, times this
 *   one's steps;
 * - `average` — the project's time per delivered requirement, failures
 *   included, as `harness report` computes it;
 * - `none` — nothing recorded supports a number, and it is `null`.
 *
 * Arithmetic over records, no files: the caller reads the ledger and the
 * feature files.
 */

import type { ResultRow } from "./HarnessReport";
import { estimateRunCost } from "./RunBudget";

export type EstimateBasis = "history" | "size" | "average" | "none";

export interface EstimatedNumber {
  basis: EstimateBasis;
  /** The rows it rests on: this requirement's runs, or the delivered requirements. */
  samples: number;
  /** The basis in words, for a person. */
  detail: string;
}

export interface RequirementEstimate {
  requirement: string;
  /** Scenario steps (Given/When/Then and their And/But) across its scenarios. */
  steps: number;
  time: EstimatedNumber & { ms: number | null };
  /** `null` when no profile declares `cost_per_run_hint`: there is no price to apply. */
  cost: (EstimatedNumber & { amount: number | null }) | null;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** What one recorded row cost by the hints, or `null` when none of its attempts has one. */
function rowCost(row: ResultRow, hints: Readonly<Record<string, number>>): number | null {
  const priced = estimateRunCost(
    (row.attemptLog ?? []).map((a) => a?.profiles ?? []),
    hints
  );
  return priced ? priced.total : null;
}

/**
 * One estimate per pending requirement, in the order given.
 *
 * `rows` are every recorded result of every run (a requirement run twice has
 * two); `stepsOf` gives any requirement's scenario steps, delivered ones
 * included, because `size` divides by theirs.
 */
export function estimateRequirements(
  pending: ReadonlyArray<{ requirement: string; steps: number }>,
  rows: readonly ResultRow[],
  stepsOf: (requirement: string) => number,
  costHints: Readonly<Record<string, number>> = {}
): RequirementEstimate[] {
  const timed = rows.filter((r) => (r.durationMs ?? 0) > 0);
  const delivered = timed.filter((r) => r.result === "pass");
  const sized = delivered.filter((r) => stepsOf(r.requirement) > 0);
  const sizedSteps = sized.reduce((n, r) => n + stepsOf(r.requirement), 0);
  const sizedMs = sized.reduce((n, r) => n + (r.durationMs ?? 0), 0);
  const totalMs = timed.reduce((n, r) => n + (r.durationMs ?? 0), 0);

  const priced = Object.keys(costHints || {}).length > 0;
  const costOf = (r: ResultRow) => rowCost(r, costHints);
  const pricedDelivered = sized.filter((r) => costOf(r) !== null);
  const pricedSteps = pricedDelivered.reduce((n, r) => n + stepsOf(r.requirement), 0);
  const pricedCost = pricedDelivered.reduce((n, r) => n + (costOf(r) ?? 0), 0);
  const pricedRows = rows.filter((r) => costOf(r) !== null);
  const totalCost = pricedRows.reduce((n, r) => n + (costOf(r) ?? 0), 0);

  return pending.map(({ requirement, steps }) => {
    const own = timed.filter((r) => r.requirement === requirement);
    let time: RequirementEstimate["time"];
    if (own.length > 0) {
      const ms = own.reduce((n, r) => n + (r.durationMs ?? 0), 0) / own.length;
      time = {
        ms: Math.round(ms),
        basis: "history",
        samples: own.length,
        detail: `the mean of its ${own.length} recorded run(s)`,
      };
    } else if (steps > 0 && sizedSteps > 0) {
      time = {
        ms: Math.round((sizedMs / sizedSteps) * steps),
        basis: "size",
        samples: sized.length,
        detail: `${steps} step(s) at the time ${sized.length} delivered requirement(s) took per step`,
      };
    } else if (delivered.length > 0) {
      time = {
        ms: Math.round(totalMs / delivered.length),
        basis: "average",
        samples: delivered.length,
        detail: "the project's time per delivered requirement, failed attempts included",
      };
    } else {
      time = { ms: null, basis: "none", samples: 0, detail: "no run recorded yet" };
    }

    let cost: RequirementEstimate["cost"] = null;
    if (priced) {
      const ownPriced = rows
        .filter((r) => r.requirement === requirement)
        .map(costOf)
        .filter((c): c is number => c !== null);
      if (ownPriced.length > 0) {
        cost = {
          amount: round(ownPriced.reduce((n, c) => n + c, 0) / ownPriced.length, 4),
          basis: "history",
          samples: ownPriced.length,
          detail: `the mean declared price of its ${ownPriced.length} recorded run(s)`,
        };
      } else if (steps > 0 && pricedSteps > 0) {
        cost = {
          amount: round((pricedCost * steps) / pricedSteps, 4),
          basis: "size",
          samples: pricedDelivered.length,
          detail: `${steps} step(s) at the declared price per step of ${pricedDelivered.length} delivered requirement(s)`,
        };
      } else if (pricedRows.length > 0 && delivered.length > 0) {
        cost = {
          amount: round(totalCost / delivered.length, 4),
          basis: "average",
          samples: delivered.length,
          detail: "the project's declared price per delivered requirement",
        };
      } else {
        cost = {
          amount: null,
          basis: "none",
          samples: 0,
          detail: "no recorded attempt ran a profile that declares a price",
        };
      }
    }
    return { requirement, steps, time, cost };
  });
}
