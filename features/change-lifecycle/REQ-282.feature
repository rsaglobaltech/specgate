Feature: A change has three layers, each with its owner

  @REQ-282 @SCN-282a
  Scenario: A new change
    Given a project with no active change
    When `specgate change new add-pricing --json` runs
    Then the change holds `discover.md`, `design.md` and `tasks.md`, each with an `Owner:` line naming product, architect and developer, its `change.yaml` says `schema: layered`, and no `proposal.md` is written
