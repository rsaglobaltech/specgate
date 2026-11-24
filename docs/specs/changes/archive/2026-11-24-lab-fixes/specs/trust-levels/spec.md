# Delta — trust-levels

## ADDED Requirements

### Requirement: REQ-694 — Chaining on a branch of your own

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-694.feature actor=Developer kind=functional -->

The system SHALL, with trust levels declared, accept `specgate harness run --chain` on any branch but the project's main branch — `main`, `master`, or the one `origin/HEAD` names —, and SHALL keep refusing it there, so that a module's requirements build on one another and a person merges the result.

> Found on 2026-11-23: two agents of one module, each from main, chose an array and a Map.

#### Scenario: SCN-694a — On a feature branch

- GIVEN `trust: { mitglieder: 4 }` and the branch `feature/mitglieder` checked out
- WHEN the Developer runs `specgate harness run --chain --req REQ-002 --req REQ-003`
- THEN REQ-003 is cut from REQ-002's merge on `feature/mitglieder`, and `main` is unchanged

#### Scenario: SCN-694b — On main, still refused

- GIVEN `trust: { mitglieder: 4 }` and `main` checked out
- WHEN the Developer runs `specgate harness run --chain`
- THEN it is refused, naming a branch of your own as the fix

### Requirement: REQ-696 — Gate tooling and exam fixtures are not code

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-696.feature actor=Developer kind=functional -->

The system SHALL treat each file of the project named by `bdd_cmd`, `arch_cmd` or `test_cmd` as tooling, and each file under `evals/`, as an exam fixture: neither code nor a test of any requirement, in the map, the report or the derived matrix.

> Found on 2026-11-23: an example `@REQ-006` in the scenario runner's comment made it REQ-006's only code, and an exam's fixture under `evals/` counted as REQ-001's test.

#### Scenario: SCN-696a — The scenario runner mentions REQ-006

- GIVEN `bdd_cmd: node scripts/scenarios.mjs` whose comment says `@REQ-006`, and no other code mentioning REQ-006
- WHEN the Developer runs `specgate map --json`
- THEN REQ-006 has 0 code files

#### Scenario: SCN-696b — An exam fixture is not a test

- GIVEN `evals/conventions/tasks/t/test/baseline.test.js` naming REQ-001, beside `test/baseline.test.js`
- WHEN the Developer runs `specgate matrix --json`
- THEN REQ-001's tests are only `test/baseline.test.js`
