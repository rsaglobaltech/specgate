Feature: An applied plan taken back

  @REQ-665 @SCN-665a
  Scenario: Applied, then taken back
    Given a plan applied to spec.md
    When the Developer runs `specgate agent revert <id>`
    Then spec.md is as before the plan, and `reverted.files` names spec.md

  @REQ-665 @SCN-665b
  Scenario: Changed since it was applied
    Given a plan applied to spec.md, then spec.md edited
    When the Developer runs `specgate agent revert <id>`
    Then it is refused with `revert_stale` naming spec.md, and spec.md keeps the edit
