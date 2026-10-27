Feature: A client's text becomes the brief

  @REQ-215 @SCN-215a
  Scenario: Pasting a text
    Given a project with no brief and a profile `fast`
    When a client's text is pasted
    Then docs/brief.md holds the text and the agent's run has started with `fast`

  @REQ-215 @SCN-215b
  Scenario: An existing brief is kept
    Given a project with a brief
    When a text is pasted without asking to replace
    Then it is refused and the brief is unchanged
