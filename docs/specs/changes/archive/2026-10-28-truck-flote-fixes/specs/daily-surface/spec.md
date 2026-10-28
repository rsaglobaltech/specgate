# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-236 — forja is found, or the person is told how to get it

The system SHALL run forja, for `specgate init --forja` and `specgate add`, from `SPECGATE_FORJA_CMD` when it is set, else from a `forja` on the PATH, else with npx at the pinned major; and SHALL, before running npx for `init --forja`, ask npm whether that package exists and, when it does not, stop with an error that says how to install forja and names `SPECGATE_FORJA_CMD`, instead of npm's 404; and SHALL give forja its own version in `SPECGATE_VERSION`, so the project forja generates depends on the Specgate that generated it.

#### Scenario: SCN-236a — No forja anywhere

- GIVEN no `forja` on the PATH, no `SPECGATE_FORJA_CMD`, and an npm registry that does not have `@rsaglobaltech/forja`
- WHEN `specgate init --forja fleet --backend spring` runs
- THEN it exits with an error naming `npm i -g @rsaglobaltech/forja` and `SPECGATE_FORJA_CMD`, and runs nothing

#### Scenario: SCN-236b — forja learns the Specgate that called it

- GIVEN a forja that records its environment
- WHEN `specgate init --forja shop` runs
- THEN forja sees `SPECGATE_VERSION` set to Specgate's own version

<!-- specgate:trace status=Implemented test=tests/unit/forja-front-door.test.ts actor=Developer kind=functional -->
