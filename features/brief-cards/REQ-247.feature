Feature: D6 reads a value however the assumption writes it

  @REQ-247 @SCN-247a
  Scenario: The truck-flote assumptions
    Given scenario values "3 ejes", "7100 kg", "11500 kg" and "Dispositivo: TRK-0001", and rows "Three axles of 7100, 11500 and 8000 kg" for SCN-006 and "Device identifier TRK-0001" for SCN-008
    When the draft is checked
    Then none of them is a D6 finding, and "4 ejes" still is
