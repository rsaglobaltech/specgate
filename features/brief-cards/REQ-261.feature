Feature: D6 reads a value made of listed parts

  @REQ-261 @SCN-261a
  Scenario: The truck-flote fleet module
    Given scenario values "1234-BCD › Ejes" and "Lucía Martín — E000001234567890", and rows listing "1234-BCD", "Ejes", "Lucía Martín" and "E000001234567890" for their requirements
    When the draft is checked
    Then neither is a D6 finding, and "1234-BCD › Remolque" still is
