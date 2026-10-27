Feature: Status names the module of the next use case

  @REQ-193 @SCN-193a
  Scenario: The module from the change or the feature's folder
    Given REQ-022 is in change draft-diario, or its feature is features/diario/registrar-clase.feature
    When status proposes the next command
    Then it is `specgate add usecase diario/<Name> --req REQ-022`, or `specgate add usecase diario/RegistrarClase --req REQ-022`
