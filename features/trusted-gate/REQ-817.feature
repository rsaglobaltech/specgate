Feature: The page shows what the AI model decided

  @REQ-817 @SCN-817a
  Scenario: The model's verdict
    Given a `bdd_cmd` that writes `{"model":"llama3.2","input":"Haz eso","output":{"category":"C"},"ms":812}` to `$SPECGATE_AI_LOG`
    When the Developer runs `specgate evidence before REQ-031`, then `specgate evidence draft-orders`
    Then the page shows, before, `llama3.2`, `Haz eso`, `{"category":"C"}` and `812 ms`
