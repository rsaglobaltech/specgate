Feature: The whole suite stays the default, and CI always runs it

  @REQ-514 @SCN-514a
  Scenario: --ci with --affected
    Given the project of SCN-510a on its branch
    When a tool runs `specgate check --json`, then `specgate check --ci --affected --json`
    Then both ran the whole suite with `selection.mode` `full`; the second has the finding `affected_ignored_ci` and no test file `cached`
