Feature: The Discover says what, not how

  @REQ-284 @SCN-284a
  Scenario: A database in the business story
    Given a layered change whose Discover says "the prices are stored in PostgreSQL"
    When `specgate change validate` runs
    Then it warns `layer_discover_technical`, naming PostgreSQL
