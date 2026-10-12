/**
 * The files `specgate change new` scaffolds.
 *
 * Prose follows the project's language; the grammar never does. `SHALL`,
 * `GIVEN`/`WHEN`/`THEN`, `## ADDED Requirements` and `REQ-NNN` are what the
 * validator parses, so they stay in English in every locale — see
 * `domain/Language`.
 *
 * The phrase table arrives already resolved, which is what keeps this module
 * pure: working out which language a project speaks reads its config.
 */

import { Phrases } from "./Language";
import { renderRequirement } from "./SpecParser";

export function templateProposal(changeId) {
  return `# Proposal: ${changeId}

## Intent

<!-- Why this change exists. The problem, not the solution. -->

## Scope

In scope:

-

Out of scope:

-

## Approach

<!-- One paragraph. The technical detail belongs in design.md. -->
`;
}

export function templateTasks() {
  return `# Tasks

## 1. Specification

- [ ] 1.1 Write the delta spec for each affected capability
- [ ] 1.2 Run \`specgate change validate\`

## 2. Implementation

- [ ] 2.1
`;
}

export function templateDesign(changeId) {
  return `# Design: ${changeId}

## Technical approach

<!-- How. Only what a reviewer needs to judge the approach. -->

## Decisions

### Decision:

<!-- What was chosen, and what was rejected, and why. -->

## Affected files

-
`;
}

export function templateDelta(capability, reqId, t: Phrases) {
  return `# Delta — ${capability}

## ADDED Requirements

### Requirement: ${reqId} — ${t.shortName}

${t.systemShall(t.observableBehaviour)}

#### Scenario: ${t.scenarioName}

- GIVEN ${t.precondition}
- WHEN ${t.action}
- THEN ${t.outcome}

<!-- specgate:trace uc=UC-000 feature=features/<area>/<name>.feature -->
`;
}

/**
 * Route 2 of the three-way resolution for a declared-value divergence
 * (§8.6 → §11): "update the spec". Routes 1 ("fix the code") and 3 ("retire
 * the requirement") need no new tooling — they are pointed at from the
 * report and use `change new`/manual editing exactly as they already do.
 * This is the one route that is glue between pieces that already exist:
 * `specgate report` finds the divergence, `renderRequirement` already knows how
 * to serialise a requirement node, and `ArchiveChangeUseCase` already knows
 * how to apply a `MODIFIED Requirements` delta.
 *
 * The `value_<id>` trace key is rewritten to the code's value — that part is
 * exact, because it is a structured field. The prose is **not**
 * rewritten automatically: "the session times out after 15 minutes" cannot
 * be turned into "after 30 minutes" without risking a sentence that reads
 * wrong, which is exactly the kind of guess this project refuses to make on
 * a human's behalf. A `TODO:` marks it instead — the same restraint
 * `pack infer` already uses for whatever it cannot infer (ADR-0014).
 */
export function templateValueDriftDelta(
  capability: string,
  req: any,
  valueId: string,
  oldValue: string,
  newValue: string
): string {
  const updated = {
    ...req,
    trace: { ...req.trace, [`value_${valueId}`]: newValue },
    text:
      `${req.text || ""}`.trim() +
      `\n\nTODO: this requirement's prose still says \`${valueId}\` is \`${oldValue}\`. ` +
      `Update it to state \`${newValue}\`, the value the code actually declares, or reject ` +
      `this change if the code is what should change instead.`,
  };
  return `# Delta — ${capability}

## MODIFIED Requirements

${renderRequirement(updated)}
`;
}

/** The scaffolded file set, keyed by the artefact `change new` writes. */
export const CHANGE_TEMPLATES = {
  proposal: (changeId: string) => templateProposal(changeId),
  tasks: () => templateTasks(),
  design: (changeId: string) => templateDesign(changeId),
  specs: (_changeId: string, t: Phrases) => templateDelta("<capability>", "REQ-NNN", t),
};
