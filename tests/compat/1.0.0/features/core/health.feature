Feature: Platform health baseline
  @REQ-000 @SCN-000
  Scenario: API reports service as healthy
    Given the backend service is running
    When I request the "/health" endpoint
    Then the response status should be 200
    And the payload should include "status" with value "UP"
