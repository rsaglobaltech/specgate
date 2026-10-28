Feature: Stopping a run after the requirement in progress

  @REQ-209 @SCN-209a
  Scenario: The run stops between requirements
    Given a chain of REQ-001 and REQ-002, and a stop asked while REQ-001 runs
    When REQ-001 ends
    Then REQ-002 is not attempted, the reason says a stop was asked, and the stop request is gone
