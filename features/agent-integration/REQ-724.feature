Feature: Delivery and use apart, per tool, model and task

  @REQ-724 @SCN-724a
  Scenario: Delivered without the server
    Given opencode at L2 with 3 of 3 delivered and 0 server calls in every run
    When the Developer runs `specgate compat report`
    Then the cell is green, shows 0 calls, and the report lists opencode L2 under "delivered without using it"

  @REQ-724 @SCN-724b
  Scenario: Two models of one tool
    Given runs of claude with haiku and with sonnet
    When the report is made
    Then claude has two rows, one per model
