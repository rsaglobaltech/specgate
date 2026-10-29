Feature: Two requirements naming one feature file are reported

  @REQ-352 @SCN-352a
  Scenario: Three requirements, one feature file
    Given a change whose REQ-002 and REQ-003 both trace `feature=features/x/follow.feature`
    When `specgate change validate` runs
    Then it fails with `change_feature_shared` naming REQ-002, REQ-003 and the file
