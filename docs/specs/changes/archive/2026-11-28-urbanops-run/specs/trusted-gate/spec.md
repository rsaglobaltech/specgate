# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-821 — On main, the evidence compares with the commit before the change

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when `specgate evidence` or `specgate change archive` is given no `--base` and the base the gate measures from is HEAD itself, compare the evidence's diagrams with the parent of the first commit that holds the change's folder; and SHALL keep the gate's base when the change is not committed yet or a `--base` is named.

#### Scenario: SCN-821a — Delivered on main

- GIVEN a project on `main` whose change `draft-orders` was committed, then `Orders.refund()` added in a later commit
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN EVIDENCE.md says "Changed: `Orders` — added `+refund()`", not "Unchanged since the base"

### Requirement: REQ-822 — The adoption baseline is not a feature runner's scenario

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate migrate bdd` — and on `specgate adopt` or `specgate init` when they write `bdd: required` —, tag the adoption baseline scenario ("Existing test suite stays green") `@skip` once, with a comment that the test command the gate runs keeps it, and report it; and SHALL warn `bdd_baseline_runs` on the gate while `bdd: required` and the baseline scenario is not tagged `@skip`.

#### Scenario: SCN-822a — Migrated with the baseline

- GIVEN a project with `features/adoption/baseline.feature` untagged and `bdd: required`
- WHEN the Developer runs `specgate check`, then `specgate migrate bdd`, then `specgate check` again
- THEN the first check warns `bdd_baseline_runs`, the migration tags the scenario `@skip` and says so, and the second check does not warn

### Requirement: REQ-823 — apply shows the scenarios as a stage

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when `specgate apply` runs a requirement's scenarios on a terminal, show them as a stage after the tests — `Scenarios` and the command it ran, passed or failed — as it shows the specification, the architecture and the tests.

#### Scenario: SCN-823a — Delivered with its scenarios

- GIVEN REQ-031 approved, with `bdd: required` and a `bdd_cmd` that passes for `@REQ-031`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN the output shows `Scenarios` and the command after `Tests`, and REQ-031 is delivered

### Requirement: REQ-824 — Each sequence says whether the run agrees

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, under each scenario's sequence on the evidence page, say whether it matches the run — the run called the endpoint the diagram draws and ended the same way, success or error — or differs from it, naming what the run called and answered; SHALL read the run's calls from the scenario's Playwright trace and from what the project's server recorded in `SPECGATE_HTTP_LOG` (one JSON line per call: `at`, `method`, `path`, `status`, `ms`) during the scenario's time in its trace; SHALL set `SPECGATE_HTTP_LOG`, emptied first, for every run of the scenarios; SHALL say when a sequence could not be checked, and when it was drawn from the steps alone; and SHALL list the server's calls in the calls table, paired within each scenario.

#### Scenario: SCN-824a — A refusal the code reading missed

- GIVEN a screen's scenario whose sequence, read from the code, ends in `201 Created`, and the server's log recording `POST /api/orders` answered 422 during the scenario
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN under the sequence the page says "Read from the code, and the run differs: it ends in `201 Created`; `POST /api/orders` answered 422."
