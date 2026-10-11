Feature: Annotating a closed case

  @REQ-406 @SCN-408
  Scenario: Annotating a closed case
    Given the case of "Laura Gómez Pérez" closed by "MED-1" with the reason "resolved"
    When "MED-1" records the symptom "Headache"
    Then the response is 409 with the error "case_closed"
