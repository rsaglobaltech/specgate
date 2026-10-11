Feature: A malformed code

  @REQ-403 @SCN-405
  Scenario: A malformed code
    Given the open case of "Laura Gómez Pérez"
    When the physician "MED-1" records a diagnosis with the code "ASTHMA"
    Then the response is 422 with the error "invalid_code"
