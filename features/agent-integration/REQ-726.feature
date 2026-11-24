@change:compat-evidence
Feature: The server as the only way to Specgate

  @REQ-726 @SCN-726a
  Scenario: No shell to fall back on
    Given a run of claude at level M
    When the agent starts
    Then its command allows the server's tools and file edits and no shell, and the copy has the server's configuration and AGENTS.md

  @REQ-726 @SCN-726b
  Scenario: Delivered through the server
    Given an agent at level M that writes the test and the code and calls the server's apply tool
    When the run is judged
    Then the run passes and its line has at least one server call
