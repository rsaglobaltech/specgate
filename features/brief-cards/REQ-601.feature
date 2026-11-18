Feature: Quality requirements under ISO/IEC 25010

  @REQ-601 @SCN-601a
  Scenario: A quality entry no test can check
    Given a Lingo brief whose `## Quality` section says "- performance efficiency: The course list loads fast."
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 1 with `B14_quality_unmeasured` naming the entry's line, and `specgate propose --from-brief courses` refuses with `brief_not_ready`

  @REQ-601 @SCN-601b
  Scenario: Measured entries, an alias and an unknown characteristic
    Given a `## Quality` section saying "- performance (courses): The course list loads in under 2 seconds for 500 students at once.", "- disponibilidad: 99.5% each month." and "- beauty: Every screen uses the school's colours."
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 0, reports `B14_quality_characteristic` for beauty with a fix naming the nine characteristics, and reports nothing for the other two

  @REQ-601 @SCN-601c
  Scenario: An unknown module and no characteristic
    Given a `## Quality` section saying "- security (billing): Card numbers are never stored." and "- Every page meets WCAG 2.2 AA."
    When the developer runs `specgate propose --from-brief --check`
    Then it reports the error `B14_quality_module` for billing and the warning `B14_quality_shape` for the second item
