Feature: Every task names the requirement it delivers

  @REQ-286 @SCN-286a
  Scenario: A task with no requirement
    Given a layered change whose implementation tasks are "2.1 REQ-005 — the price list" and "2.2 Refactor the client"
    When `specgate change validate` runs
    Then it warns `layer_task_without_requirement` for "2.2 Refactor the client" only
