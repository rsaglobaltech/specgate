Feature: A physician outside the team

  @REQ-402 @SCN-402
  Scenario: A physician outside the team
    Given the case of "Laura Gómez Pérez" held by "MED-1"
    When the physician "MED-2" reads its timeline
    Then the response is 404 with the error "case_not_found"
