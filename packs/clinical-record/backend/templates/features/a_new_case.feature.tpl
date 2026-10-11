Feature: A new case

  @REQ-401 @SCN-401
  Scenario: A new case
    Given the patient "Laura Gómez Pérez"
    When the physician "MED-1" opens a case with the reason "Shortness of breath on exertion for three weeks"
    Then the case is "open" with "MED-1" as the physician responsible
