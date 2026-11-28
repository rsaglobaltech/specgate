Feature: Each sequence says whether the run agrees

  @REQ-824 @SCN-824a
  Scenario: A refusal the code reading missed
    Given a screen's scenario whose sequence, read from the code, ends in `201 Created`, and the server's log recording `POST /api/orders` answered 422 during the scenario
    When the Developer runs `specgate evidence draft-orders`
    Then under the sequence the page says "Read from the code, and the run differs: it ends in `201 Created`; `POST /api/orders` answered 422."
