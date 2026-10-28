Feature: A requirement an open change modifies is reworked

  @REQ-198 @SCN-198a
  Scenario: Modified with tests needs rework
    Given REQ-017 is modified by an open change and has tests
    When the harness reads the plan
    Then REQ-017 is NEEDS_REWORK, and the in-flight view says the change modifies it

  @REQ-198 @SCN-198b
  Scenario: The prompt says what changed
    Given REQ-017 is NEEDS_REWORK
    When its prompt is built
    Then it says the tests and code are for the old text and the tests must fail against the current behaviour first
