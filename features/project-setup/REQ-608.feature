Feature: A folder with no code is adopted as a new project

  @REQ-608 @SCN-608a
  Scenario: An empty folder
    Given an empty folder
    When the developer runs `specgate adopt`, then `specgate check` and `specgate status`
    Then adopt says `No code here yet: set up as a new project`, `AGENTS.md` says `new project` and `Stack: TBD · API: TBD · Testing: TBD`, `spec.md` has `REQ-001 — The project builds and its tests run` and names neither brownfield nor REST, `check` exits 0, and `status` says `add the first thing the product should do`

  @REQ-608 @SCN-608b
  Scenario: A folder with code
    Given a folder with a `package.json` and `src/a.js`
    When the developer runs `specgate adopt`
    Then `AGENTS.md` says `existing project` and `API: as built`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`

  @REQ-608 @SCN-608c
  Scenario: Sources with no manifest
    Given a folder holding only `src/main.py`
    When the developer runs `specgate adopt --var API_STYLE=GraphQL`
    Then `AGENTS.md` says `existing project` and `Stack: TBD · API: GraphQL`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`
