Feature: Re-running delivered requirements works in the order asked

  @REQ-185 @SCN-185a
  Scenario: --req runs in the order given
    Given a plan ordering REQ-085, REQ-017, REQ-052
    When the run is asked for REQ-017, REQ-052, REQ-085
    Then it runs REQ-017, REQ-052, REQ-085; and without `--req` the plan's order stands

  @REQ-185 @SCN-185b
  Scenario: A merged branch is recreated
    Given harness/REQ-017 exists and is merged into the base
    When REQ-017 runs without `--force`
    Then its branch is recreated; and an unmerged branch is skipped unless `--force` or `--resume` is given
