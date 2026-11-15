Feature: Every release's project keeps working

  @REQ-570 @SCN-570a
  Scenario: A project 0.35.0 wrote
    Given the project 0.35.0 wrote with `init --yes` and `propose pdf-invoices`, its lanes under `roles:`
    When the test suite runs
    Then it validates as it is, status names the migration, `migrate 1.0` succeeds, and it passes `validate --strict`, `config list` and `change validate` afterwards
