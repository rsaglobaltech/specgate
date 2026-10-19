# ADR-0034 — Execute ADR-0019: `csda studio` is the product

## Status

Accepted — 2026-08-29

Written as a second ADR-0024; renumbered to 0034 on 2026-10-19 so every number names one decision.

## Context

\`mejoras/plan-cierre-enterprise.md\` phase 10 introduced a conflict: task C10-01 asked to "decide which of the two studios is the product" (\`csda studio\` vs \`CsdaStudioApp\`), despite [ADR-0019](0019-studio-surface.md) already deciding on \`csda studio\` and explicitly rejecting the standalone SPA as a product.
Furthermore, task C10-08 continued to frame the dogfooding of \`CsdaStudioApp\` (phases 8-10 of \`csda-studio-handoff.md\`) in a way that contradicted ADR-0019's assertion that it is just an experiment.

An accepted ADR contradicted by a plan document causes confusion and undermines the ADR process (the same shape of failure that led to H13). We must either execute the existing decision or explicitly revoke it.

## Decision

We **execute** ADR-0019 without revocation. \`csda studio\` remains the single supported product surface for visualisation.

Consequently, \`CsdaStudioApp\` (#109) is strictly an internal dogfooding experiment used to validate the spec-driven delivery flow. The resulting React SPA is not a product offering, and we will not invest in its hosting, dependency management, or release train.

## Consequences

- **Alignment:** The plan now reflects the architectural decision. C10-01 is resolved.
- **Dogfooding:** C10-08 continues solely as a dogfooding exercise to prove the harness and agent loop, not to produce a shippable application.
- **Investment:** Agent runs and developer time will not be spent polishing \`CsdaStudioApp\` beyond what is necessary to validate the framework.
