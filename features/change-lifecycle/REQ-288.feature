Feature: Status and drafting name the layers

  @REQ-288 @SCN-288a
  Scenario: The next layer and its owner
    Given a layered change fresh from `change new`
    When `specgate change status --json` runs
    Then the artifacts are discover, specs, design and tasks, and a next step reads "Write discover.md (product)"

  @REQ-288 @SCN-288b
  Scenario: A module drafted from the brief
    Given a project whose brief lists the module "pricing"
    When `specgate propose --from-brief pricing` runs
    Then the draft holds `discover.md`, `design.md` and `tasks.md` under `schema: layered`, and its DRAFTING.md names the three layers
