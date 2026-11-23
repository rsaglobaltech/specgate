# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-608 — A folder with no code is adopted as a new project

The system SHALL, when `adopt` finds neither a build manifest nor a source file, say that the folder has no code yet, state `new project` and `API: TBD` in the header of `AGENTS.md`, and write as REQ-001 "The project builds and its tests run", with a scenario and a matrix row to match, in place of the requirement to preserve existing behaviour; SHALL, in that project, have `check` pass and `status` say to add the first thing the product should do; and SHALL, when the folder has a manifest or a source file, adopt it as an existing project whose REQ-001 preserves existing behaviour, stating its API as `as built` unless `--var API_STYLE` says otherwise.

#### Scenario: SCN-608a — An empty folder

- GIVEN an empty folder
- WHEN the developer runs `specgate adopt`, then `specgate check` and `specgate status`
- THEN adopt says `No code here yet: set up as a new project`, `AGENTS.md` says `new project` and `Stack: TBD · API: TBD · Testing: TBD`, `spec.md` has `REQ-001 — The project builds and its tests run` and names neither brownfield nor REST, `check` exits 0, and `status` says `add the first thing the product should do`

#### Scenario: SCN-608b — A folder with code

- GIVEN a folder with a `package.json` and `src/a.js`
- WHEN the developer runs `specgate adopt`
- THEN `AGENTS.md` says `existing project` and `API: as built`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`

#### Scenario: SCN-608c — Sources with no manifest

- GIVEN a folder holding only `src/main.py`
- WHEN the developer runs `specgate adopt --var API_STYLE=GraphQL`
- THEN `AGENTS.md` says `existing project` and `Stack: TBD · API: GraphQL`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`

<!-- specgate:trace status=Implemented feature=features/project-setup/REQ-608.feature actor=Developer kind=functional -->
