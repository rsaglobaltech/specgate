Feature: Deprecation before removal

  @REQ-569 @SCN-569a
  Scenario: A removal in a major, after a deprecation
    Given `status --json` deprecated in 1.4.0 for `--format json`
    When 2.0.0 removes it, and another 2.0.0 removes an item never deprecated
    Then the first passes, and the second fails, saying to deprecate it in a minor release first
