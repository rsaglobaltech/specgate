# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-660 — An approved change's scenarios are feature files before any code

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-660.feature actor=Developer kind=functional -->

The system SHALL, when a change's three layers are approved, write each of its requirements' scenarios as `features/<capability>/<REQ>.feature` — or the file its trace names — tagged `@change:<change>` while the change is open, so the scenarios are executable before the code is written (BDD, then TDD); SHALL write them again with `specgate change features <change>` when the delta changes after approval; and SHALL drop the tag when the change is archived.

> "¿No debería escribirse el feature antes de empezar a programar, para que los tests de TDD con Cucumber pasen? BDD y TDD son importantes: ese es el sentido de specgate, un gate siempre" (2026-11-22). Two requirements were built and no feature file existed: they were written only at archive.

#### Scenario: SCN-660a — Approved, before any code

- GIVEN a project whose draft-pedidos has REQ-031 with the scenarios SCN-031 and SCN-032
- WHEN the Developer approves draft-pedidos's discover, design and tasks layers
- THEN `features/pedidos/REQ-031.feature` exists, tagged `@change:draft-pedidos`, with SCN-031 and SCN-032 tagged in it

#### Scenario: SCN-660b — Archived, the tag dropped

- GIVEN draft-pedidos approved and every requirement applied
- WHEN the Developer archives draft-pedidos
- THEN `features/pedidos/REQ-031.feature` keeps its scenarios and no longer has `@change:draft-pedidos`

### Requirement: REQ-661 — The gate requires executable scenarios in every project

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-661.feature actor=Developer kind=functional -->

The system SHALL, in a project whose `.specgate/gate.yaml` says `bdd: required`, fail the gate when a change is approved and the harness has no `bdd_cmd` — the command that runs the feature files, `{tags}` standing for the scenarios to run; before, it warns — or when a requirement of an approved change has no feature file, or one whose scenarios differ from its delta's, each with its fix; and SHALL warn, in a project that does not say it yet, that its scenarios are not executable, with `specgate migrate bdd` as the fix.

#### Scenario: SCN-661a — Required, no runner

- GIVEN a project with `bdd: required`, no `bdd_cmd`, and draft-pedidos approved
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `bdd_cmd_missing` naming draft-pedidos, whose fix names `specgate config set bdd_cmd`

#### Scenario: SCN-661b — An approved requirement without its feature

- GIVEN a project with `bdd: required`, a `bdd_cmd`, and draft-pedidos approved whose `features/pedidos/REQ-031.feature` was deleted
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `bdd_feature_missing` for REQ-031, whose fix is `specgate change features draft-pedidos`

#### Scenario: SCN-661c — Not set up yet

- GIVEN a project adopted before, with no `bdd` in its gate.yaml
- WHEN the Developer runs `specgate check`
- THEN the gate warns `bdd_not_set_up` with `specgate migrate bdd`, and passes as it did

### Requirement: REQ-662 — Apply runs the requirement's scenarios

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-662.feature actor=Developer kind=functional -->

The system SHALL, on `specgate apply <REQ>` in a project with `bdd: required`, run its `bdd_cmd` with `{tags}` as `@<REQ>`, and refuse to mark the requirement delivered unless it ends well, saying which scenarios failed when it does not.

#### Scenario: SCN-662a — A scenario failing

- GIVEN a project with `bdd: required` and a `bdd_cmd` that fails for `@REQ-031`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN apply refuses with `apply_bdd_failed`, the command it ran naming `@REQ-031`, and REQ-031 is not Implemented

#### Scenario: SCN-662b — Its scenarios pass, it is delivered

- GIVEN the same project whose `bdd_cmd` passes for `@REQ-031`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN REQ-031 is Implemented

### Requirement: REQ-663 — New, adopted and migrated projects run their scenarios

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-663.feature actor=Developer kind=functional -->

The system SHALL, on `specgate init` — `init --forja` once forja has made the project —, `specgate adopt` and `specgate migrate bdd`, write `bdd: required` in `.specgate/gate.yaml` and, when the stack says how, the `bdd_cmd` that runs the feature files — the project's own `test:bdd` script when it has one (`npm run test:bdd --silent -- --grep "{tags}"`, as forja writes it), `npx bddgen && npx playwright test --grep "{tags}"` for a project with Playwright (playwright-bdd), `mvn -q test -Dcucumber.filter.tags="{tags}"` for a Maven one (Cucumber) — and SHALL write the feature files of every approved change; and, when the stack does not say, leave `bdd_cmd` to set, the gate saying so.

#### Scenario: SCN-663b — A project with its own test:bdd script

- GIVEN a project whose package.json has the script `test:bdd`
- WHEN the Developer runs `specgate migrate bdd`
- THEN harness.config.yaml's `bdd_cmd` is `npm run test:bdd --silent -- --grep "{tags}"`

#### Scenario: SCN-663a — A web project migrated

- GIVEN a project with `apps/web/package.json` depending on `@playwright/test` and no `bdd` in its gate.yaml
- WHEN the Developer runs `specgate migrate bdd`
- THEN gate.yaml says `bdd: required` and harness.config.yaml's `bdd_cmd` is `npx bddgen && npx playwright test --grep "{tags}"`
