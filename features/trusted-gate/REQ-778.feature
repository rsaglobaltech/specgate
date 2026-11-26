Feature: A trace comment over several lines survives apply and archive

  @REQ-778 @SCN-778a
  Scenario: The feature file it names stays its feature file
    Given a requirement whose trace comment names `feature=features/pricing/dynamic_pricing.feature` on its second line
    When it is applied and its change archived
    Then its trace still names `features/pricing/dynamic_pricing.feature`, no other feature file is written for it, and `specgate check` passes
