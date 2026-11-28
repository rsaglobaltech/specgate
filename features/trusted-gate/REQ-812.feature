Feature: A scenario followed through the code as a UML sequence

  @REQ-812 @SCN-812a
  Scenario: From the endpoint to the port
    Given `OrderController` mapped to `POST /api/orders` with `@ResponseStatus(HttpStatus.CREATED)`, calling `review.execute(text)`, and `ReviewOrder.execute` calling `classifier.classify(text)`
    When REQ-041's scenario that sends `POST /api/orders` is drawn
    Then the sequence has lifelines `:OrderController`, `:ReviewOrder` and `:AiClassifier`, the messages `execute(text : String)` and `classify(text : String)` in that order, and the reply `201 Created` to the actor

  @REQ-812 @SCN-812b
  Scenario: No endpoint in the code
    Given a scenario that sends `POST /api/unknown`, which no controller declares
    When it is drawn
    Then the diagram is the one from its steps, with `participant S as System`
