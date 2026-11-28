# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-821 — On main, the evidence compares with the commit before the change

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, when `specgate evidence` or `specgate change archive` is given no `--base` and the base the gate measures from is HEAD itself, compare the evidence's diagrams with the parent of the first commit that holds the change's folder; and SHALL keep the gate's base when the change is not committed yet or a `--base` is named.

#### Scenario: SCN-821a — Delivered on main

- GIVEN a project on `main` whose change `draft-orders` was committed, then `Orders.refund()` added in a later commit
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN EVIDENCE.md says "Changed: `Orders` — added `+refund()`", not "Unchanged since the base"

### Requirement: REQ-822 — The adoption baseline is not a feature runner's scenario

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, on `specgate migrate bdd` — and on `specgate adopt` or `specgate init` when they write `bdd: required` —, tag the adoption baseline scenario ("Existing test suite stays green") `@skip` once, with a comment that the test command the gate runs keeps it, and report it; and SHALL warn `bdd_baseline_runs` on the gate while `bdd: required` and the baseline scenario is not tagged `@skip`.

#### Scenario: SCN-822a — Migrated with the baseline

- GIVEN a project with `features/adoption/baseline.feature` untagged and `bdd: required`
- WHEN the Developer runs `specgate check`, then `specgate migrate bdd`, then `specgate check` again
- THEN the first check warns `bdd_baseline_runs`, the migration tags the scenario `@skip` and says so, and the second check does not warn
