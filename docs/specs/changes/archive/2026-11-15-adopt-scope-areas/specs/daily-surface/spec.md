# Delta — daily-surface

## MODIFIED Requirements

### Requirement: REQ-337 — Adopt one area of a large system

The system SHALL, with `specgate adopt --scope <path>`, list in `docs/specs/adoption.md` only the areas under that path — proposing no requirement, as any adoption — write a baseline scenario that names it, and record the scope in spec.md; a path that does not exist is refused before anything is written.

#### Scenario: SCN-337a — The billing area only

- GIVEN a repository with src/billing/invoices, src/billing/payments and src/shipping/routes, each holding source files
- WHEN the developer runs `specgate adopt --scope src/billing`
- THEN docs/specs/adoption.md lists invoices and payments, not routes, spec.md names src/billing as the scope, and features/adoption/baseline.feature names src/billing

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-337.feature test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->
