Feature: Who has seen Laura

  @REQ-408 @SCN-410
  Scenario: Who has seen Laura
    Given the accesses of "MED-1" and the denied attempt of "MED-2" to the data of "Laura Gómez Pérez"
    When the privacy officer "DPO-1" looks up the accesses of "Laura"
    Then the denied attempt by "MED-2" comes first and the allowed access by "MED-1" second
