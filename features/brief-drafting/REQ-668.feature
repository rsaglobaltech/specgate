Feature: A scenario's steps in another language

  @REQ-668 @SCN-668a
  Scenario: Spanish title, English steps
    Given a draft whose SCN-002 is titled "El adulto entra con credenciales válidas" and whose steps read "the family is authorised and its child profile exists"
    When the Developer runs `specgate draft --check`
    Then `D16_scenario_language` names SCN-002, its fix to write its steps in Spanish
