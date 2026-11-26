@change:walkthrough-fixes-2
Feature: A requirement waiting for an answer is never handed to an agent

  @REQ-782 @SCN-782a
  Scenario: Asked for by name
    Given REQ-004 marked Needs Clarification in an approved change
    When the developer runs `specgate harness run --req REQ-004`
    Then no agent runs, no branch `harness/REQ-004` exists, and the output says it waits for an answer
