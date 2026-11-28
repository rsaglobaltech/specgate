Feature: The evidence page compares with the base the person names

  @REQ-814 @SCN-814a
  Scenario: The base named
    Given a change whose code changed since the commit `base-tag`
    When the Developer runs `specgate evidence draft-orders --base base-tag`
    Then the diagrams at the base are those of `base-tag`
