Feature: Each step says what it checks and how to remove it

  @REQ-457 @SCN-457a
  Scenario: The matrix explained in the YAML
    Given the gate `specgate init` wrote for GitHub
    When the person reads the job's `strategy.matrix`
    Then the comment above it says it runs the gate on Ubuntu, macOS and Windows, and that deleting `macos-latest` and `windows-latest` keeps Ubuntu only
