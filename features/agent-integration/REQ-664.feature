@change:agent-hunks
Feature: A plan applied hunk by hunk

  @REQ-664 @SCN-664a
  Scenario: The first of two hunks applied
    Given a plan that changes spec.md's first line and adds a line at its end
    When the Developer runs `specgate agent apply <id> --hunk spec.md#1`
    Then spec.md's first line is changed, its last line is not added, and `applied.hunks` is `["spec.md#1"]`

  @REQ-664 @SCN-664b
  Scenario: A hunk the plan does not have
    Given the same plan
    When the Developer runs `specgate agent apply <id> --hunk spec.md#3`
    Then it is refused with `hunk_not_found` and nothing is written
