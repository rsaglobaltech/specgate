Feature: When nothing maps, the whole suite runs, and says why

  @REQ-512 @SCN-512a
  Scenario: Only an unlinked file changed
    Given the project of SCN-510a on a branch where only `src/helpers.sql`, which no requirement, test or import names, changed
    When a tool runs `specgate check --affected --json`
    Then `selection.mode` is `full`, its `reason` names `src/helpers.sql` as linked to nothing, and the tests stage ran the whole suite
