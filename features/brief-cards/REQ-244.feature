Feature: The brief checks read Spanish as written

  @REQ-244 @SCN-244a
  Scenario: "dice si cabe" and "un desvío aceptable"
    Given the rules "El sistema dice en menos de 1 s si cabe la carga." and "Un camión es candidato con un desvío aceptable."
    When the brief is checked
    Then the first has no B11 warning and the second has a B5 warning naming "aceptable"
