Feature: Determining whether is no condition

  @REQ-820 @SCN-820a
  Scenario: The operator determines whether
    Given a module whose rule is "El operador determina si el reporte corresponde a un servicio municipal."
    When the Product owner runs `specgate propose --from-brief --check`
    Then no `B11_condition_last` is listed for it, and "La incidencia se cierra si el técnico la resuelve." still has one
