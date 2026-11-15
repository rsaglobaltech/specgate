Feature: A scratch file that cannot be removed never fails the command

  @REQ-372 @SCN-372a
  Scenario: Windows still holds the prompt file
    Given removing a prompt file fails with `EBUSY` twice, then succeeds
    When the file is removed
    Then it is removed on the third try and nothing is thrown

  @REQ-372 @SCN-372b
  Scenario: The file stays held
    Given removing a prompt file always fails with `EBUSY`
    When the file is removed
    Then nothing is thrown, and the file is reported as left
