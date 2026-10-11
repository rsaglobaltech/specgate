Feature: Provisional, then confirmed

  @REQ-403 @SCN-404
  Scenario: Provisional, then confirmed
    Given the open case of "Laura Gómez Pérez"
    When the physician "MED-1" records the diagnosis "J45.9" "Asthma, unspecified" and then confirms it
    Then the diagnosis moves from "provisional" to "confirmed" and both annotations carry "MED-1" and their time
