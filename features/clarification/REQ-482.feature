Feature: An answered question waits to be confirmed in sight

  @REQ-482 @SCN-482a
  Scenario: Q1 answered "50 €", then confirmed
    Given the draft `draft-orders` whose Q1 blocks REQ-002
    When a tool runs `specgate answer Q1 "50 €" --change draft-orders`, then `specgate questions --json`, then `specgate answer Q1 --reviewed --change draft-orders` and `specgate questions --json` again
    Then the first answer lists Q1 in `answered` with `answer` "50 €" and blocks REQ-002, and not in `open`; the second lists Q1 in neither
