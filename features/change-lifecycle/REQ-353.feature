Feature: A delivered requirement ticks its tasks

  @REQ-353 @SCN-353a
  Scenario: The harness delivered REQ-002
    Given an open change whose tasks.md has `- [ ] 2.1 Build the panel (REQ-002)` and `- [ ] 2.2 Docs`
    When `specgate done REQ-002` delivers it
    Then the task naming REQ-002 is ticked and the other is not
