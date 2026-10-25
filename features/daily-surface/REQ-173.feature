Feature: Approved owes a test, as the strict gate says

  @REQ-173 @SCN-173a
  Scenario: Approved before the test is refused
    Given a project with REQ-002 in Draft and no test that names it
    When the developer runs `specgate apply REQ-002 --status Approved`
    Then the command exits 1 naming TDD-1 and the fix "write a test that names REQ-002", and REQ-002 is still Draft

  @REQ-173 @SCN-173b
  Scenario: Approved once a test names it
    Given the same project with a test that names REQ-002 and SCN-002
    When the developer runs `specgate apply REQ-002 --status Approved`
    Then REQ-002 is Approved

  @REQ-173 @SCN-173c
  Scenario: An unknown status is refused
    Given the same project
    When the developer runs `specgate apply REQ-002 --status Aproved`
    Then the command exits 2 naming the statuses it accepts, and REQ-002 is still Draft

  @REQ-173 @SCN-173d
  Scenario: `--no-check` writes it and warns
    Given the project with no test that names REQ-002
    When the developer runs `specgate apply REQ-002 --status Approved --no-check`
    Then REQ-002 is Approved and stderr warns that `validate --strict` fails TDD-1 until a test names REQ-002
