Feature: Diff fails on a pack it cannot render; sync fails on an id clash

  @REQ-786 @SCN-786a
  Scenario: The pack's REQ-006 and the project's
    Given a project with its own REQ-006, and a pack version that adds a REQ-006
    When the developer runs `specgate specops sync --pack-version <new>`
    Then it fails naming REQ-006, and does not say there was no conflict
