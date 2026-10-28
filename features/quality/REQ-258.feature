Feature: The quality reports are not committed

  @REQ-258 @SCN-258a
  Scenario: A run after init
    Given a project where `specgate quality init` ran and its result is committed
    When a quality run writes `.specgate/quality/osv.sarif`
    Then `.gitignore` lists `.specgate/quality/`, the report is not shown by `git status`, and `.specgate/quality-baseline.json` is not ignored
