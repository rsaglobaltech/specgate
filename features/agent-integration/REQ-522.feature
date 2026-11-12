Feature: A plan is kept in the git folder until it is applied or discarded

  @REQ-522 @SCN-522a
  Scenario: Listed, then discarded
    Given the plan SCN-520a proposed
    When a tool runs `specgate agent plans --json`, `specgate agent discard <id> --json`, then both again
    Then the first lists the plan with `spec.md` and `stale` false, and its folder is under the git folder's `specgate/plans/`; the discard answers its id; then the list is empty and the second discard is refused with `plan_not_found`
