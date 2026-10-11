Feature: Two sessions at the same time

  @REQ-307 @SCN-310
  Scenario: Two sessions at the same time
    Given "marta.ruiz@example.com" with a seat in "Kubernetes in production" from 09:30 to 10:30
    When she books a seat in "Cloud security" from 09:30 to 10:30
    Then the response is 409 with the error "attendee_busy"
