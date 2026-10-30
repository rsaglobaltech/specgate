Feature: A criterion unanswered, or claimed twice, is reported

  @REQ-362 @SCN-362a
  Scenario: AC-3 is nobody's, AC-1 is twice
    Given follow-shipment with AC-1..AC-3, mapping AC-1 to fleet and tracking and AC-2 to tracking
    When the developer runs `specgate workspace check --json`
    Then it warns that AC-3 is answered by no repository and that AC-1 is claimed by fleet and tracking
