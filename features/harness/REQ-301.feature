Feature: Specgate suggests the gap from what it recorded

  @REQ-301 @SCN-301a
  Scenario: A rejection the agent fixed
    Given REQ-002's attempt 1 was rejected at `quality check: pmd` and attempt 2 passed
    When the report is read
    Then REQ-002 is suggested as spec → implementation, caught by `pmd`

  @REQ-301 @SCN-301b
  Scenario: A requirement changed after review
    Given REQ-010 passed on attempt 1, and the draft's `questions.md` has an answered question that blocks REQ-010
    When the report is read
    Then REQ-010 is suggested as intent → spec
