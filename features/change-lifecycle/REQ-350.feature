Feature: change validate reports what approval refuses

  @REQ-350 @SCN-350a
  Scenario: A requirement with no kind
    Given a layered change whose requirement has a trace with no `kind=`
    When `specgate change validate` runs
    Then it fails with `change_not_approvable` naming the missing kind, as `change approve` would
