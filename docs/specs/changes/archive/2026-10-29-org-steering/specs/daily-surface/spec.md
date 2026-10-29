# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-337 — Adopt one area of a large system

The system SHALL, with `specgate adopt --scope <path>`, propose requirements only for the areas under that path, write a baseline scenario that names it, and record the scope in spec.md; a path that does not exist is refused before anything is written.

#### Scenario: SCN-337a — The billing area only

- GIVEN a repository with src/billing/invoices, src/billing/payments and src/shipping/routes, each holding source files
- WHEN the developer runs `specgate adopt --scope src/billing`
- THEN spec.md proposes invoices and payments, not routes, names src/billing as the scope, and features/adoption/baseline.feature names src/billing

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-338 — A specification too big to review is said

The system SHALL warn `adopt_too_big`, when adoption finds more areas than the eight it proposes, naming how many it left out and `specgate adopt --scope <area>` as the way to start with the part being touched.

#### Scenario: SCN-338a — Ten areas

- GIVEN a repository whose src holds ten areas with source files
- WHEN the developer runs `specgate adopt`
- THEN it proposes eight and warns `adopt_too_big` naming the two left out and `adopt --scope`

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->
