Feature: A reviewer per package, that only advises

  @REQ-318 @SCN-318a
  Scenario: The review instruction names each package
    Given the security and performance packages apply to REQ-002
    When the review instruction is written
    Then it asks for a line for security and one for performance, and says the advice does not decide the verdict
