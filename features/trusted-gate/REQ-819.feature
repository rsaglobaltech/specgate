Feature: A failed delivery is kept as an attempt

  @REQ-819 @SCN-819a
  Scenario: Flaky, then delivered
    Given REQ-031 whose scenarios fail twice — the AI log saying `{"category":"A"}` — and then pass
    When the Developer runs `specgate apply REQ-031` three times, then `specgate evidence draft-orders`
    Then attempts 1 and 2 are kept, the first refusal names `attempts/1`, `evidence.json` lists both, and the page's "Failed attempts" shows each with `Received: 202` and `{"category":"A"}`
