Feature: The harness template shows the streaming agent

  @REQ-200 @SCN-200a
  Scenario: The template proposes the streaming command
    Given `specgate harness init`
    When it writes harness.config.yaml
    Then the file shows `claude -p --output-format stream-json --verbose … | specgate harness events --from claude` and `e2e_dir`
