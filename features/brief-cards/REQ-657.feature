Feature: From a workshop to a draft in one command

  @REQ-657 @SCN-657a
  Scenario: Imported and drafted
    Given a project with no brief and the claims workshop's five files
    When the Developer runs `specgate propose --from-model` with them
    Then the models and the brief are written, the draft change of siniestros is opened, and the answer names polizas and pagos as next
