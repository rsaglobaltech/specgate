Feature: No contents, output or secrets in an event

  @REQ-130 @SCN-130a
  Scenario: A command with a token in it
    Given a Bash call running "curl -H 'Authorization: Bearer abc123def456' https://api.example.com" with output "secret body", and `GITHUB_TOKEN=ghp_0123456789abcdefghijklmnop` in the environment of a call that echoes it
    When the adapter records them
    Then the events read "Authorization: Bearer ***" and "***" in place of the token, and contain neither "secret body" nor "abc123def456" nor the token's value
