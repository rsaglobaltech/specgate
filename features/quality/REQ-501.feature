Feature: The coverage report for one capability

  @REQ-501 @SCN-501a
  Scenario: The orders capability, then one that does not exist
    Given a project with REQ-001 in spec.md and REQ-002 and REQ-003 in the capability `orders`
    When a tool runs `specgate report --format json --stdout --capability orders`, then `--capability nothing`
    Then the first report has `capability` `orders`, a total of 2 and only REQ-002 and REQ-003; the second exits 2 with `capability_unknown` and a fix that names `orders`
