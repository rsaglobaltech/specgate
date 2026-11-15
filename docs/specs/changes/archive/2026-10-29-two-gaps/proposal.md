# Proposal: two-gaps

## Intent

Item 6 of the 1.0 line ([enterprise-sdd-gap.md](../../../enterprise-sdd-gap.md)):
the InfoQ article on enterprise spec-driven development measures a context
harness by two gaps. **Spec → implementation**: the spec was clear and the code
diverged — strengthen validation and constraints. **Intent → spec**: a detail of
the use case was missed while talking — strengthen elicitation. `harness report`
counted attempts, cost and false failures, and could say neither.

## Scope

- A person classifies a requirement's gap (`harness report --classify`), with a
  reason, kept append-only beside the false-failure marks.
- Specgate suggests a classification from what it recorded: a gate rejection
  the agent fixed on a later attempt is spec → implementation, naming the check
  that caught it; a requirement that changed after review — an answered
  question, a review note, a modified delta, a gate failing on the spec — is
  intent → spec. A person's mark overrides a suggestion.
- `harness report` shows both rates overall and per module, and what to
  strengthen; the studio's report shows both rates.
- The ledger records the gate stage of a rejected attempt, which the suggestion
  needs.

## Not in scope

Changing what the harness does with a classification; this measures.
