Feature: A full room

  @REQ-307 @SCN-309
  Scenario: A full room
    Given the session "Kubernetes in production" in a room of 2 seats with two attendees already in
    When "marta.ruiz@example.com", confirmed, books a seat in it
    Then the response is 409 with the error "session_full"
