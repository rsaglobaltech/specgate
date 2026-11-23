@change:reproduce-first
Feature: A bug is delivered only after its red

  @REQ-683 @SCN-683a
  Scenario: Never seen red
    Given REQ-090 with `repro=required` and no `red.json`
    When the Developer runs `specgate apply REQ-090`
    Then apply refuses with `apply_not_reproduced`, whose fix is `specgate reproduce run REQ-090`, and REQ-090 is not Implemented

  @REQ-683 @SCN-683b
  Scenario: Red, then green
    Given REQ-090 with `repro=required`, its `red.json` kept, and its scenarios now passing
    When the Developer runs `specgate apply REQ-090`
    Then REQ-090 is Implemented, and its `evidence.json` holds the red run and the green one
