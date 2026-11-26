Feature: Status names the approval a change waits for

  @REQ-777 @SCN-777a
  Scenario: A change nobody approved
    Given export-csv open, its delta written, not approved
    When the developer runs `specgate status`
    Then the next command is `specgate change approve export-csv`, and once a person approved it, it is not
