Feature: The report and the live view say which packages were used

  @REQ-317 @SCN-317a
  Scenario: Two runs with the security package
    Given two recorded runs whose results name `security@2`, one of them also `performance@1`
    When `harness report --json` is read and the live model folds a `prompt` event naming `security@2`
    Then the report lists security@2 for 2 requirements and performance@1 for 1, and the live requirement shows security@2
