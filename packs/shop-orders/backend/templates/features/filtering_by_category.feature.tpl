Feature: Filtering by category

  @REQ-603 @SCN-603
  Scenario: Filtering by category
    Given "Drill 500 W" in "Tools" and "LED lamp" in "Home"
    When a visitor lists the products of "Tools"
    Then "Drill 500 W" is listed and "LED lamp" is not
