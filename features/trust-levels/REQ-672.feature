@change:trust-levels
Feature: A level rises only through a change a person approved

  @REQ-672 @SCN-672a
  Scenario: Raised by hand
    Given a project whose ledger's last line for catalogo is level 3
    When the Developer writes `catalogo: 4` in gate.yaml and runs `specgate check`
    Then the gate fails with `trust_raised_unapproved` for catalogo, whose fix is `specgate trust promote catalogo`

  @REQ-672 @SCN-672b
  Scenario: Promoted by an approved change
    Given catalogo at level 3 and `specgate trust promote catalogo` run
    When a person approves the change trust-catalogo-4's three layers
    Then gate.yaml says `catalogo: 4`, the ledger ends with a `promotion` line from 3 to 4 naming trust-catalogo-4, and `specgate check` passes
