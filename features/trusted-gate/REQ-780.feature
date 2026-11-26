Feature: The verdict names the fix for what a person approved

  @REQ-780 @SCN-780a
  Scenario: A sealed test changed
    Given export-csv's acceptance test sealed and then changed
    When the developer runs `specgate check`
    Then it fails with `acceptance_not_sealed` and `check_approved_changed`, and not with `check_change_invalid`
