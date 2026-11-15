Feature: After apply, Next stays in the change

  @REQ-465 @SCN-465a
  Scenario: The change's last requirement before the project's
    Given the open change `draft-specgate-port` with REQ-014 still to do, and the project's REQ-000 still to do outside any change
    When `specgate apply REQ-016` delivers a requirement of `draft-specgate-port`
    Then the next step it prints is `specgate apply REQ-014`, not `specgate apply REQ-000`

  @REQ-465 @SCN-465b
  Scenario: The rest of the change waits for an answer
    Given the open change `draft-specgate-port` whose only requirement left, REQ-014, waits for the answer to Q2, and the project's REQ-000 still to do
    When `specgate apply REQ-016` delivers a requirement of `draft-specgate-port`
    Then the next step it prints is `specgate apply REQ-000`
