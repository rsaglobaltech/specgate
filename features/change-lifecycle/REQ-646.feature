Feature: status --json carries what an open change proposes, before archive

  @REQ-646 @SCN-646a
  Scenario: Proposed before archive
    Given a catalog with only the template, and the open change draft-cuenta-perfiles adding UC-002 with its specification and UC-003 without one, and writing Cuenta's machine
    When the Developer runs `specgate status --json`
    Then useCases.proposed lists UC-002 and UC-003 of draft-cuenta-perfiles as added, UC-002 with its specification's lanes and activity; stateMachines lists Cuenta proposed by draft-cuenta-perfiles
