Feature: A run leaves nothing half-done behind

  @REQ-579 @SCN-579a
  Scenario: Throwaway bases after the run
    Given a project with `harness/base/REQ-004` and `harness/REQ-004` branches
    When a run ends
    Then `harness/base/REQ-004` is gone and `harness/REQ-004` stays
