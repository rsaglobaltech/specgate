Feature: Specgate's server and plugin record what they saw

  @REQ-717 @SCN-717a
  Scenario: A call is counted
    Given an exam run at L2 whose agent calls the server's status tool once
    When the run ends
    Then its line in runs.jsonl has mcpCalls 1

  @REQ-717 @SCN-717b
  Scenario: No call, no credit
    Given an exam run at L2 whose agent delivers with the CLI alone
    When the run ends
    Then its line has mcpCalls 0 and still both checks passed
